<?php

namespace Pterodactyl\Services\Addons\Sources;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use Illuminate\Support\Facades\Cache;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Addons\AddonGameRegistry;
use Pterodactyl\Services\Addons\AddonSource;
use Symfony\Component\HttpKernel\Exception\BadGatewayHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Thunderstore source adapter. Docs: https://thunderstore.io/api/docs/
 *
 * Thunderstore segments its catalogue by "community" (one per game):
 * valheim, lethal-company, risk-of-rain-2, project-zomboid, v-rising,
 * subnautica, etc. Per-community search isn't a backend feature — the
 * v1 list endpoint dumps the whole community as a JSON array and
 * clients filter locally. We cache the dump for 5 minutes per community
 * so a session of typing in the search box doesn't rerun the network
 * request on every keystroke.
 *
 * Supports MOD type only. Plugins/modpacks aren't a Thunderstore
 * concept (everything is a mod regardless of role).
 *
 * No auth required for read-only endpoints.
 */
class ThunderstoreAdapter implements AddonSource
{
    private const BASE_URI = 'https://thunderstore.io/';
    private const CACHE_TTL_SECONDS = 300;
    private const CACHE_KEY_PREFIX = 'thunderstore:packages:';

    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'base_uri' => self::BASE_URI,
            'timeout' => 20,
            'headers' => [
                'User-Agent' => 'gynx.gg panel (+https://gynx.gg)',
                'Accept' => 'application/json',
            ],
        ]);
    }

    public function slug(): string
    {
        return 'thunderstore';
    }

    public function available(): bool
    {
        return true;
    }

    public function supports(string $type): bool
    {
        return $type === self::TYPE_MOD;
    }

    public function availableFor(Server $server): bool
    {
        return $this->resolveCommunity($server) !== null;
    }

    private function resolveCommunity(?Server $server): ?string
    {
        if ($server === null) return null;
        $game = AddonGameRegistry::forServer($server);
        return $game['thunderstore_community'] ?? null;
    }

    /**
     * Pull (and cache) the full package list for a community. Thunderstore
     * doesn't expose pagination on this endpoint; the response is one JSON
     * array, which can be hundreds of KB for popular communities. Cache
     * it for a few minutes so repeat searches don't re-fetch.
     *
     * @return array<int,array<string,mixed>>
     */
    private function fetchCommunity(string $community): array
    {
        return Cache::remember(
            self::CACHE_KEY_PREFIX . $community,
            self::CACHE_TTL_SECONDS,
            function () use ($community) {
                try {
                    $res = $this->http->get('c/' . urlencode($community) . '/api/v1/package/');
                } catch (TransferException $e) {
                    throw new BadGatewayHttpException('Thunderstore fetch failed: ' . $e->getMessage());
                }
                $data = json_decode((string) $res->getBody(), true);
                return is_array($data) ? $data : [];
            },
        );
    }

    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 60, ?Server $server = null): array
    {
        if (!$this->supports($type)) return [];
        $community = $this->resolveCommunity($server);
        if ($community === null) return [];

        $packages = $this->fetchCommunity($community);

        // Skip deprecated unless they're the only match — Thunderstore
        // surfaces them in the UI with a strikethrough and we want
        // similar UX (newest, supported things first).
        $needle = strtolower(trim($query));
        $matches = [];
        foreach ($packages as $pkg) {
            if (!is_array($pkg)) continue;
            if (!empty($pkg['is_deprecated'])) continue;

            if ($needle !== '') {
                $haystack = strtolower(
                    (string) ($pkg['name'] ?? '') . ' ' .
                    (string) ($pkg['owner'] ?? '') . ' ' .
                    (string) (($pkg['versions'][0] ?? [])['description'] ?? '')
                );
                if (!str_contains($haystack, $needle)) continue;
            }
            $matches[] = $pkg;
        }

        // Browse-popular: sort by total downloads (sum across versions).
        usort($matches, function ($a, $b) {
            $ad = $this->totalDownloads($a);
            $bd = $this->totalDownloads($b);
            return $bd <=> $ad;
        });

        $matches = array_slice($matches, 0, max(1, min($limit, 60)));

        return array_map(function (array $pkg) {
            $latest = $pkg['versions'][0] ?? [];
            return [
                'external_id' => (string) ($pkg['full_name'] ?? ($pkg['owner'] ?? '') . '-' . ($pkg['name'] ?? '')),
                'slug' => (string) ($pkg['name'] ?? ''),
                'name' => (string) ($pkg['name'] ?? 'Unknown'),
                'author' => (string) ($pkg['owner'] ?? ''),
                'description' => (string) ($latest['description'] ?? ''),
                'icon_url' => $latest['icon'] ?? null,
                'downloads' => $this->totalDownloads($pkg),
                'latest_version' => $latest['version_number'] ?? null,
                'source' => 'thunderstore',
            ];
        }, $matches);
    }

    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null, ?Server $server = null): array
    {
        if (!$this->supports($type)) {
            throw new ConflictHttpException('Thunderstore only serves mods.');
        }
        $community = $this->resolveCommunity($server);
        if ($community === null) {
            throw new ConflictHttpException('Thunderstore is not available for this server.');
        }

        // Locate the package in the cached community list. We could fetch
        // the per-package endpoint /api/experimental/package/{ns}/{name}/
        // but it's another network round trip and the cached community
        // list already has everything we need.
        [$ownerHint, $nameHint] = $this->splitFullName($externalId);
        $packages = $this->fetchCommunity($community);
        $pick = null;
        foreach ($packages as $pkg) {
            if (!is_array($pkg)) continue;
            $owner = (string) ($pkg['owner'] ?? '');
            $name = (string) ($pkg['name'] ?? '');
            if ($ownerHint !== '' && $owner !== $ownerHint) continue;
            if ($nameHint !== '' && $name !== $nameHint) continue;
            $pick = $pkg;
            break;
        }

        if (!$pick) {
            throw new NotFoundHttpException('Thunderstore package not found: ' . $externalId);
        }

        $version = null;
        if ($versionId) {
            foreach ($pick['versions'] ?? [] as $v) {
                if (((string) ($v['version_number'] ?? '')) === $versionId
                    || ((string) ($v['full_name'] ?? '')) === $versionId) {
                    $version = $v;
                    break;
                }
            }
            if (!$version) {
                throw new NotFoundHttpException('Requested Thunderstore version not found.');
            }
        } else {
            $version = $pick['versions'][0] ?? null;
        }

        if (!$version || empty($version['download_url'])) {
            throw new ConflictHttpException('Thunderstore package has no downloadable file.');
        }

        $fullName = (string) ($version['full_name'] ?? ($pick['name'] . '-' . $version['version_number']));
        return [
            'url' => (string) $version['download_url'],
            'file_name' => $fullName . '.zip',
            'file_hash' => null,
            'version' => (string) ($version['version_number'] ?? ''),
            'version_id' => (string) ($version['version_number'] ?? ''),
        ];
    }

    public function listVersions(string $type, string $externalId, ?string $gameVersion = null, int $limit = 20, ?Server $server = null): array
    {
        if (!$this->supports($type)) return [];
        $community = $this->resolveCommunity($server);
        if ($community === null) return [];

        [$ownerHint, $nameHint] = $this->splitFullName($externalId);
        $packages = $this->fetchCommunity($community);
        foreach ($packages as $pkg) {
            if (!is_array($pkg)) continue;
            if ($ownerHint !== '' && (string) ($pkg['owner'] ?? '') !== $ownerHint) continue;
            if ($nameHint !== '' && (string) ($pkg['name'] ?? '') !== $nameHint) continue;
            $versions = $pkg['versions'] ?? [];
            $sliced = array_slice($versions, 0, max(1, $limit));
            return array_map(function (array $v) {
                return [
                    'version_id' => (string) ($v['version_number'] ?? ''),
                    'version' => (string) ($v['version_number'] ?? ''),
                    'game_versions' => [],
                    'loaders' => [],
                    'channel' => 'release',
                    'file_name' => (string) ($v['full_name'] ?? '') . '.zip',
                    'downloads' => (int) ($v['downloads'] ?? 0),
                    'published_at' => (string) ($v['date_created'] ?? ''),
                ];
            }, $sliced);
        }

        return [];
    }

    private function totalDownloads(array $pkg): int
    {
        $sum = 0;
        foreach (($pkg['versions'] ?? []) as $v) {
            $sum += (int) ($v['downloads'] ?? 0);
        }
        return $sum;
    }

    /**
     * Thunderstore uses "owner-name" or "owner-name-version" as the
     * canonical identifier. We accept either as the external_id, which
     * lets the caller treat it as opaque.
     *
     * @return array{0:string, 1:string} [owner, name]
     */
    private function splitFullName(string $externalId): array
    {
        // Two-token split (owner-name) or three-token split with version trailing.
        $parts = explode('-', $externalId);
        if (count($parts) >= 2) {
            return [$parts[0], $parts[1]];
        }
        return ['', $externalId];
    }
}
