<?php

namespace Pterodactyl\Services\Addons\Sources;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
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

    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 20): array
    {
        $this->assertSupports($type);

        $facets = [['project_type:' . $type]];
        if ($gameVersion) $facets[] = ['versions:' . $gameVersion];

        try {
            $res = $this->http->get('search', [
                'query' => [
                    'query' => $query,
                    'limit' => min($limit, 30),
                    'facets' => json_encode($facets),
                ],
            ]);
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

    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null): array
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

    private function assertSupports(string $type): void
    {
        if (!$this->supports($type)) {
            throw new NotFoundHttpException("Modrinth does not serve add-on type '{$type}'.");
        }
    }
}
