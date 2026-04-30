<?php

namespace Pterodactyl\Services\Addons\Sources;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Addons\AddonGameRegistry;
use Pterodactyl\Services\Addons\AddonSource;
use Symfony\Component\HttpKernel\Exception\BadGatewayHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * uMod (oxidemod) adapter — Rust + Hurtworld + a handful of other
 * Oxide-modded games. Public JSON endpoints, no auth required.
 *
 * uMod plugins are single .cs files that drop into oxide/plugins/
 * (Rust) or the equivalent Oxide path. We pull straight to that
 * folder via Wings; the install service handles the rest.
 *
 * Endpoints used:
 *   GET https://umod.org/plugins/search.json
 *       ?query=...&page=1&sort=downloads&sortdir=desc
 *       &categories[]=<game>     (e.g. 'rust')
 *   GET https://umod.org/plugins/<author>/<slug>.json
 *
 * Mods only — uMod has no plugin/modpack distinction.
 */
class UmodAdapter implements AddonSource
{
    private const BASE_URI = 'https://umod.org/';

    /** Where Rust expects Oxide plugins. Other Oxide games may differ. */
    private const INSTALL_PATHS = [
        'rust' => '/oxide/plugins',
    ];

    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'base_uri' => self::BASE_URI,
            'timeout' => 15,
            'headers' => [
                'User-Agent' => 'gynx.gg panel (+https://gynx.gg)',
                'Accept' => 'application/json',
            ],
        ]);
    }

    public function slug(): string
    {
        return 'umod';
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
        return $this->resolveGame($server) !== null;
    }

    private function resolveGame(?Server $server): ?string
    {
        if ($server === null) return null;
        $game = AddonGameRegistry::forServer($server);
        return $game['umod_game'] ?? null;
    }

    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 60, ?Server $server = null): array
    {
        if (!$this->supports($type)) return [];
        $game = $this->resolveGame($server);
        if ($game === null) return [];

        $params = [
            'query' => $query,
            'page' => 1,
            'sort' => trim($query) === '' ? 'downloads' : 'related',
            'sortdir' => 'desc',
            'categories' => [$game],
        ];

        try {
            $res = $this->http->get('plugins/search.json', ['query' => $params]);
        } catch (TransferException $e) {
            throw new BadGatewayHttpException('uMod search failed: ' . $e->getMessage());
        }

        $body = json_decode((string) $res->getBody(), true) ?: [];
        $hits = $body['data'] ?? $body['plugins'] ?? [];

        $sliced = array_slice($hits, 0, max(1, min($limit, 60)));

        return array_map(function (array $h) {
            $author = (string) ($h['author'] ?? '');
            $slug = (string) ($h['slug'] ?? '');
            return [
                'external_id' => $author !== '' ? "{$author}/{$slug}" : $slug,
                'slug' => $slug,
                'name' => (string) ($h['title'] ?? $h['name'] ?? 'Unknown'),
                'author' => $author,
                'description' => (string) ($h['description'] ?? ''),
                'icon_url' => $h['icon_url'] ?? $h['icon'] ?? null,
                'downloads' => (int) ($h['downloads'] ?? 0),
                'latest_version' => $h['latest_release_version'] ?? null,
                'source' => 'umod',
            ];
        }, $sliced);
    }

    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null, ?Server $server = null): array
    {
        if (!$this->supports($type)) {
            throw new ConflictHttpException('uMod only serves mods.');
        }
        $game = $this->resolveGame($server);
        if ($game === null) {
            throw new ConflictHttpException('uMod is not available for this server.');
        }

        // external_id is "<author>/<slug>"; the per-plugin endpoint
        // accepts the same path component.
        $path = ltrim($externalId, '/');
        try {
            $res = $this->http->get('plugins/' . $path . '.json');
        } catch (TransferException $e) {
            throw new NotFoundHttpException('uMod plugin not found: ' . $externalId);
        }

        $body = json_decode((string) $res->getBody(), true) ?: [];
        $url = (string) ($body['latest_release_url'] ?? $body['download_url'] ?? '');
        if ($url === '') {
            throw new ConflictHttpException('uMod plugin has no downloadable file.');
        }

        $version = (string) ($body['latest_release_version'] ?? '');
        $slug = (string) ($body['slug'] ?? basename($externalId));

        return [
            'url' => $url,
            'file_name' => $slug . '.cs',
            'file_hash' => null,
            'version' => $version,
            'version_id' => $version,
        ];
    }

    public function listVersions(string $type, string $externalId, ?string $gameVersion = null, int $limit = 20, ?Server $server = null): array
    {
        // uMod's public JSON exposes only the "latest release" cleanly.
        // Older versions exist but require scraping the plugin's
        // releases page; not worth it for v1.
        return [];
    }

    /**
     * Where Wings should drop the .cs file. Used by the installer
     * service when this adapter is the source.
     */
    public static function installPathFor(?string $umodGame): string
    {
        if ($umodGame !== null && isset(self::INSTALL_PATHS[$umodGame])) {
            return self::INSTALL_PATHS[$umodGame];
        }
        // Reasonable default for any Oxide-style game we haven't
        // explicitly mapped yet.
        return '/oxide/plugins';
    }
}
