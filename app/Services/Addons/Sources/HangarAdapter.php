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
 * Hangar (PaperMC) source adapter.
 *
 * Docs: https://hangar.papermc.io/api-docs
 * Plugins only — Paper doesn't publish mods or modpacks through Hangar.
 * No auth required for read-only endpoints.
 */
class HangarAdapter implements AddonSource
{
    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'base_uri' => 'https://hangar.papermc.io/api/v1/',
            'timeout' => 10,
            'headers' => [
                'User-Agent' => 'gynx.gg panel (+https://gynx.gg)',
                'Accept' => 'application/json',
            ],
        ]);
    }

    public function slug(): string { return 'hangar'; }
    public function available(): bool { return true; }
    public function supports(string $type): bool { return $type === self::TYPE_PLUGIN; }

    public function availableFor(Server $server): bool
    {
        // Hangar is Paper / Bukkit-only, i.e. Minecraft-only. Gate per
        // server so non-MC eggs don't see it as a selectable source.
        $game = AddonGameRegistry::forServer($server);
        return $game !== null && $game['slug'] === 'minecraft';
    }

    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 60, ?Server $server = null): array
    {
        $this->assertPlugin($type);

        // Empty query is fine here — Hangar returns the top projects sorted
        // by downloads, exactly the "browse popular" behaviour we want.
        $params = [
            'limit' => min($limit, 25),
            'sort' => '-downloads',
        ];
        if (trim($query) !== '') $params['q'] = $query;

        try {
            $res = $this->http->get('projects', ['query' => $params]);
        } catch (TransferException $e) {
            throw new BadGatewayHttpException('Hangar search failed: ' . $e->getMessage());
        }

        $data = json_decode((string) $res->getBody(), true);
        $hits = $data['result'] ?? [];

        return array_map(function (array $p) {
            $ns = $p['namespace'] ?? [];
            $slug = (string) ($ns['slug'] ?? $p['name'] ?? '');
            $owner = (string) ($ns['owner'] ?? '');
            $identifier = $owner && $slug ? "{$owner}/{$slug}" : $slug;

            return [
                'external_id' => $identifier,
                'slug' => $slug,
                'name' => (string) ($p['name'] ?? 'Unknown'),
                'author' => $owner,
                'description' => (string) ($p['description'] ?? ''),
                'icon_url' => $p['avatarUrl'] ?? null,
                'downloads' => (int) ($p['stats']['downloads'] ?? 0),
                'latest_version' => null,
                'source' => 'hangar',
            ];
        }, $hits);
    }

    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null, ?Server $server = null): array
    {
        $this->assertPlugin($type);

        try {
            $res = $this->http->get("projects/{$externalId}/versions", [
                'query' => ['limit' => 20],
            ]);
        } catch (TransferException $e) {
            throw new NotFoundHttpException('Hangar project not found: ' . $externalId);
        }

        $data = json_decode((string) $res->getBody(), true);
        $versions = $data['result'] ?? [];
        if (empty($versions)) {
            throw new NotFoundHttpException('This project has no downloadable versions on Hangar.');
        }

        $pick = null;
        if ($versionId) {
            foreach ($versions as $v) {
                if (((string) ($v['name'] ?? '')) === $versionId) { $pick = $v; break; }
            }
            if (!$pick) throw new NotFoundHttpException('Requested version not found on Hangar.');
        } else {
            if ($gameVersion) {
                foreach ($versions as $v) {
                    $pv = $v['platformDependencies']['PAPER'] ?? [];
                    if (in_array($gameVersion, $pv, true)) { $pick = $v; break; }
                }
            }
            $pick = $pick ?? $versions[0];
        }

        $name = (string) ($pick['name'] ?? '');
        if ($name === '') {
            throw new NotFoundHttpException('Version has no name on Hangar.');
        }

        $platforms = array_keys($pick['downloads'] ?? []);
        if (empty($platforms)) {
            throw new NotFoundHttpException('Version has no platform download on Hangar.');
        }
        $platform = in_array('PAPER', $platforms, true) ? 'PAPER' : $platforms[0];
        $dl = $pick['downloads'][$platform] ?? [];

        $url = $dl['downloadUrl'] ?? $dl['externalUrl'] ?? null;
        $fileName = $dl['fileInfo']['name'] ?? ($externalId . '-' . $name . '.jar');
        $hash = $dl['fileInfo']['sha256Hash'] ?? null;

        if (!$url) {
            throw new NotFoundHttpException('Hangar did not return a downloadable URL for this version.');
        }

        return [
            'url' => (string) $url,
            'file_name' => basename((string) $fileName),
            'file_hash' => $hash,
            'version' => $name,
            'version_id' => $name,
        ];
    }

    public function listVersions(string $type, string $externalId, ?string $gameVersion = null, int $limit = 20, ?Server $server = null): array
    {
        $this->assertPlugin($type);

        try {
            $res = $this->http->get("projects/{$externalId}/versions", [
                'query' => ['limit' => min(max($limit, 1), 25)],
            ]);
        } catch (TransferException $e) {
            throw new NotFoundHttpException('Hangar project not found: ' . $externalId);
        }

        $data = json_decode((string) $res->getBody(), true) ?: [];
        $versions = $data['result'] ?? [];

        return array_map(function (array $v) {
            $name = (string) ($v['name'] ?? '');
            $paperVersions = $v['platformDependencies']['PAPER'] ?? [];
            $loaders = array_keys($v['platformDependencies'] ?? []);

            return [
                'version_id' => $name,
                'version' => $name,
                'game_versions' => array_values(array_map('strval', $paperVersions)),
                'loaders' => array_values(array_map('strval', $loaders)),
                'channel' => isset($v['channel']['name']) ? (string) $v['channel']['name'] : null,
                'file_name' => $v['downloads']['PAPER']['fileInfo']['name'] ?? null,
                'downloads' => isset($v['stats']['totalDownloads']) ? (int) $v['stats']['totalDownloads'] : null,
                'published_at' => $v['createdAt'] ?? null,
            ];
        }, $versions);
    }

    private function assertPlugin(string $type): void
    {
        if ($type !== self::TYPE_PLUGIN) {
            throw new NotFoundHttpException('Hangar only serves plugins.');
        }
    }
}
