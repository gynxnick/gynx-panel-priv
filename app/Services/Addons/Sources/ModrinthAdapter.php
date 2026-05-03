<?php

namespace Pterodactyl\Services\Addons\Sources;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Addons\AddonGameRegistry;
use Pterodactyl\Services\Addons\AddonSource;
use Symfony\Component\HttpKernel\Exception\BadGatewayHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Modrinth source adapter. Docs: https://docs.modrinth.com/api/
 *
 * Supports all three add-on types:
 *   - plugin  → facet project_type:plugin  → downloads to /plugins/
 *   - mod     → facet project_type:mod     → downloads to /mods/
 *   - modpack → facet project_type:modpack → .mrpack archive to /modpacks/
 *
 * No auth required for read-only endpoints. Rate limit 300 req/min.
 * User-Agent header is required per Modrinth policy.
 */
class ModrinthAdapter implements AddonSource
{
    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'base_uri' => 'https://api.modrinth.com/v2/',
            'timeout' => 10,
            'headers' => [
                'User-Agent' => 'gynx.gg panel (+https://gynx.gg)',
                'Accept' => 'application/json',
            ],
        ]);
    }

    public function slug(): string
    {
        return 'modrinth';
    }

    public function available(): bool
    {
        return true;
    }

    public function supports(string $type): bool
    {
        return in_array($type, [self::TYPE_PLUGIN, self::TYPE_MOD, self::TYPE_MODPACK], true);
    }

    public function availableFor(Server $server): bool
    {
        // Modrinth is Minecraft-only today — gate per-server on the
        // egg's classified game so non-MC servers don't see it as a
        // selectable source. Drops out cleanly when a future Modrinth
        // adds non-MC content; bump the registry then.
        $game = AddonGameRegistry::forServer($server);
        return $this->available() && $game !== null && $game['slug'] === 'minecraft';
    }

    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 60, ?Server $server = null): array
    {
        $this->assertSupports($type);

        $facets = [['project_type:' . $type]];
        if ($gameVersion) $facets[] = ['versions:' . $gameVersion];

        // Empty query → "browse popular": Modrinth's search endpoint accepts
        // an empty `query` and we sort by downloads to surface the staples.
        $params = [
            'query' => $query,
            'limit' => min($limit, 100),
            'facets' => json_encode($facets),
        ];
        if (trim($query) === '') {
            $params['index'] = 'downloads';
        }

        try {
            $res = $this->http->get('search', ['query' => $params]);
        } catch (TransferException $e) {
            throw new BadGatewayHttpException('Modrinth search failed: ' . $e->getMessage());
        }

        $data = json_decode((string) $res->getBody(), true);
        $hits = $data['hits'] ?? [];

        return array_map(function (array $h) {
            return [
                'external_id' => (string) ($h['project_id'] ?? $h['slug']),
                'slug' => (string) ($h['slug'] ?? ''),
                'name' => (string) ($h['title'] ?? 'Unknown'),
                'author' => (string) ($h['author'] ?? ''),
                'description' => (string) ($h['description'] ?? ''),
                'icon_url' => $h['icon_url'] ?? null,
                'downloads' => (int) ($h['downloads'] ?? 0),
                'latest_version' => $h['latest_version'] ?? null,
                'source' => 'modrinth',
            ];
        }, $hits);
    }

    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null, ?Server $server = null): array
    {
        $this->assertSupports($type);

        try {
            $res = $this->http->get("project/{$externalId}/version");
        } catch (TransferException $e) {
            throw new NotFoundHttpException('Modrinth project not found: ' . $externalId);
        }

        $versions = json_decode((string) $res->getBody(), true) ?: [];
        if (empty($versions)) {
            throw new NotFoundHttpException('This add-on has no downloadable versions.');
        }

        $pick = null;
        if ($versionId) {
            foreach ($versions as $v) {
                if (($v['id'] ?? null) === $versionId) { $pick = $v; break; }
            }
            if (!$pick) throw new NotFoundHttpException('Requested version not found on Modrinth.');
        } else {
            foreach ($versions as $v) {
                $supported = $v['game_versions'] ?? [];
                if (!$gameVersion || in_array($gameVersion, $supported, true)) {
                    $pick = $v;
                    break;
                }
            }
            $pick = $pick ?? $versions[0];
        }

        $file = $pick['files'][0] ?? null;
        if (!$file) {
            throw new NotFoundHttpException('Version has no downloadable file.');
        }

        return [
            'url' => (string) $file['url'],
            'file_name' => (string) $file['filename'],
            'file_hash' => $file['hashes']['sha1'] ?? null,
            'version' => (string) ($pick['version_number'] ?? ''),
            'version_id' => (string) $pick['id'],
        ];
    }

    public function listVersions(string $type, string $externalId, ?string $gameVersion = null, int $limit = 20, ?Server $server = null): array
    {
        $this->assertSupports($type);

        $query = [];
        if ($gameVersion) {
            $query['game_versions'] = json_encode([$gameVersion]);
        }

        try {
            $res = $this->http->get("project/{$externalId}/version", ['query' => $query]);
        } catch (TransferException $e) {
            throw new NotFoundHttpException('Modrinth project not found: ' . $externalId);
        }

        $versions = json_decode((string) $res->getBody(), true) ?: [];
        $sliced = array_slice($versions, 0, max(1, $limit));

        return array_map(function (array $v) {
            $file = $v['files'][0] ?? null;
            return [
                'version_id' => (string) ($v['id'] ?? ''),
                'version' => (string) ($v['version_number'] ?? ''),
                'game_versions' => array_values(array_map('strval', $v['game_versions'] ?? [])),
                'loaders' => array_values(array_map('strval', $v['loaders'] ?? [])),
                'channel' => isset($v['version_type']) ? (string) $v['version_type'] : null,
                'file_name' => $file['filename'] ?? null,
                'downloads' => isset($v['downloads']) ? (int) $v['downloads'] : null,
                'published_at' => $v['date_published'] ?? null,
            ];
        }, $sliced);
    }

    private function assertSupports(string $type): void
    {
        if (!$this->supports($type)) {
            throw new NotFoundHttpException("Modrinth does not serve add-on type '{$type}'.");
        }
    }
}
