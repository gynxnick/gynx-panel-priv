<?php

namespace Pterodactyl\Services\Addons\Sources;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Http\Controllers\Admin\IntegrationsController;
use Pterodactyl\Services\Addons\AddonSource;
use Symfony\Component\HttpKernel\Exception\BadGatewayHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;

/**
 * CurseForge source adapter. Docs: https://docs.curseforge.com/
 *
 * Requires the CURSEFORGE_API_KEY env var (CF eyebrow keys are issued via
 * https://console.curseforge.com/). Without it the adapter still loads but
 * available() reports false so the AddonResolver skips it.
 *
 * gameId 432 = Minecraft. classId map:
 *   - plugin  → 5    (Bukkit Plugins)
 *   - mod     → 6    (Mods)
 *   - modpack → 4471 (Modpacks)
 *
 * Some authors disable third-party app downloads ("downloadUrl": null on the
 * file). When that happens we throw a ConflictHttpException with a clear
 * message rather than silently linking elsewhere.
 */
class CurseForgeAdapter implements AddonSource
{
    private const GAME_ID_MINECRAFT = 432;

    private const CLASS_BY_TYPE = [
        self::TYPE_PLUGIN => 5,
        self::TYPE_MOD => 6,
        self::TYPE_MODPACK => 4471,
    ];

    private ?Client $http = null;

    public function __construct(private SettingsRepositoryInterface $settings)
    {
    }

    private function apiKey(): string
    {
        // Admin → Integrations panel value wins; .env CURSEFORGE_API_KEY
        // is the fallback so existing .env-based setups keep working.
        return IntegrationsController::get($this->settings, 'curseforge_api_key');
    }

    private function client(): Client
    {
        if ($this->http) return $this->http;

        $key = $this->apiKey();
        if ($key === '') {
            throw new ServiceUnavailableHttpException(null, 'CurseForge API key is not configured.');
        }

        $this->http = new Client([
            'base_uri' => 'https://api.curseforge.com/v1/',
            'timeout' => 12,
            'headers' => [
                'x-api-key' => $key,
                'User-Agent' => 'gynx.gg panel (+https://gynx.gg)',
                'Accept' => 'application/json',
            ],
        ]);

        return $this->http;
    }

    public function slug(): string
    {
        return 'curseforge';
    }

    public function available(): bool
    {
        return $this->apiKey() !== '';
    }

    public function supports(string $type): bool
    {
        return isset(self::CLASS_BY_TYPE[$type]);
    }

    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 60): array
    {
        $this->assertSupports($type);

        $params = [
            'gameId' => self::GAME_ID_MINECRAFT,
            'classId' => self::CLASS_BY_TYPE[$type],
            'pageSize' => min(max($limit, 1), 50),
            // sortField 2=popularity (best for browse), 6=totalDownloads
            // (best for empty-query "popular"). Auto-pick based on whether
            // there's an actual query.
            'sortField' => trim($query) === '' ? 6 : 2,
            'sortOrder' => 'desc',
        ];
        if (trim($query) !== '') {
            $params['searchFilter'] = $query;
        }
        if ($gameVersion) {
            $params['gameVersion'] = $gameVersion;
        }

        try {
            $res = $this->client()->get('mods/search', ['query' => $params]);
        } catch (TransferException $e) {
            throw new BadGatewayHttpException('CurseForge search failed: ' . $e->getMessage());
        }

        $body = json_decode((string) $res->getBody(), true) ?: [];
        $data = $body['data'] ?? [];

        return array_map(function (array $h) {
            $authors = $h['authors'] ?? [];
            $author = isset($authors[0]['name']) ? (string) $authors[0]['name'] : '';
            $latest = $h['latestFiles'][0]['displayName'] ?? null;

            return [
                'external_id' => (string) ($h['id'] ?? ''),
                'slug' => (string) ($h['slug'] ?? ''),
                'name' => (string) ($h['name'] ?? 'Unknown'),
                'author' => $author,
                'description' => (string) ($h['summary'] ?? ''),
                'icon_url' => $h['logo']['url'] ?? null,
                'downloads' => (int) ($h['downloadCount'] ?? 0),
                'latest_version' => $latest,
                'source' => 'curseforge',
            ];
        }, $data);
    }

    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null): array
    {
        $this->assertSupports($type);

        // List files. CF will filter by gameVersion server-side when provided
        // — but there's no equivalent filter for the version-id case, so we
        // page through and pick out the requested file id ourselves.
        $params = ['pageSize' => 50, 'sortOrder' => 'desc'];
        if ($gameVersion && !$versionId) {
            $params['gameVersion'] = $gameVersion;
        }

        try {
            $res = $this->client()->get("mods/{$externalId}/files", ['query' => $params]);
        } catch (TransferException $e) {
            throw new NotFoundHttpException('CurseForge mod not found: ' . $externalId);
        }

        $body = json_decode((string) $res->getBody(), true) ?: [];
        $files = $body['data'] ?? [];
        if (empty($files)) {
            throw new NotFoundHttpException('This CurseForge add-on has no downloadable files.');
        }

        $pick = null;
        if ($versionId) {
            foreach ($files as $f) {
                if ((string) ($f['id'] ?? '') === (string) $versionId) {
                    $pick = $f;
                    break;
                }
            }
            if (!$pick) {
                throw new NotFoundHttpException('Requested CurseForge file not found.');
            }
        } else {
            // First entry is highest-sorted (= newest stable when default sort applied).
            $pick = $files[0];
        }

        $url = $pick['downloadUrl'] ?? null;
        if (!$url) {
            // CF authors can disable third-party downloads; fall back to the
            // dedicated download-url endpoint which sometimes still returns
            // a URL even when it's blanked on the file record.
            try {
                $dlRes = $this->client()->get("mods/{$externalId}/files/{$pick['id']}/download-url");
                $url = json_decode((string) $dlRes->getBody(), true)['data'] ?? null;
            } catch (TransferException $e) {
                $url = null;
            }
        }

        if (!$url) {
            throw new ConflictHttpException(
                'This CurseForge author has disabled third-party downloads. Install via the CurseForge launcher.'
            );
        }

        $sha1 = null;
        foreach (($pick['hashes'] ?? []) as $h) {
            // hash algo: 1 = sha1, 2 = md5
            if (($h['algo'] ?? null) === 1) { $sha1 = (string) $h['value']; break; }
        }

        return [
            'url' => (string) $url,
            'file_name' => (string) ($pick['fileName'] ?? ('curseforge-' . $pick['id'] . '.jar')),
            'file_hash' => $sha1,
            'version' => (string) ($pick['displayName'] ?? ''),
            'version_id' => (string) $pick['id'],
        ];
    }

    public function listVersions(string $type, string $externalId, ?string $gameVersion = null, int $limit = 20): array
    {
        $this->assertSupports($type);

        $params = ['pageSize' => min(max($limit, 1), 50), 'sortOrder' => 'desc'];
        if ($gameVersion) $params['gameVersion'] = $gameVersion;

        try {
            $res = $this->client()->get("mods/{$externalId}/files", ['query' => $params]);
        } catch (TransferException $e) {
            throw new NotFoundHttpException('CurseForge mod not found: ' . $externalId);
        }

        $body = json_decode((string) $res->getBody(), true) ?: [];
        $files = $body['data'] ?? [];

        // CF release types: 1=release, 2=beta, 3=alpha
        $channelMap = [1 => 'release', 2 => 'beta', 3 => 'alpha'];

        return array_map(function (array $f) use ($channelMap) {
            return [
                'version_id' => (string) ($f['id'] ?? ''),
                'version' => (string) ($f['displayName'] ?? ''),
                'game_versions' => array_values(array_filter(
                    array_map('strval', $f['gameVersions'] ?? []),
                    // CF mixes loaders ('Forge', 'Fabric') into gameVersions —
                    // strip non-numeric entries so the UI shows only MC versions.
                    fn ($s) => (bool) preg_match('/^\d+(\.\d+)*/', $s)
                )),
                'loaders' => array_values(array_filter(
                    array_map('strval', $f['gameVersions'] ?? []),
                    fn ($s) => !preg_match('/^\d+(\.\d+)*/', $s)
                )),
                'channel' => $channelMap[$f['releaseType'] ?? 0] ?? null,
                'file_name' => $f['fileName'] ?? null,
                'downloads' => isset($f['downloadCount']) ? (int) $f['downloadCount'] : null,
                'published_at' => $f['fileDate'] ?? null,
            ];
        }, $files);
    }

    private function assertSupports(string $type): void
    {
        if (!$this->supports($type)) {
            throw new NotFoundHttpException("CurseForge does not serve add-on type '{$type}'.");
        }
    }
}
