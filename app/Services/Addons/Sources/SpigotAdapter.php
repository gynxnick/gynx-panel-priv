<?php

namespace Pterodactyl\Services\Addons\Sources;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use Pterodactyl\Services\Addons\AddonSource;
use Symfony\Component\HttpKernel\Exception\BadGatewayHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * SpigotMC source via the SpiGet API (https://spiget.org/documentation/).
 *
 * Plugins only. Many SpigotMC resources are "external" downloads (the
 * author links to an off-site file host). SpiGet returns these as
 * `external: true` and can't give us a direct .jar URL — we refuse to
 * install those and surface a message pointing the user at the resource
 * page. Resources with `file.type = .jar` go through cleanly.
 */
class SpigotAdapter implements AddonSource
{
    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'base_uri' => 'https://api.spiget.org/v2/',
            'timeout' => 10,
            'headers' => [
                'User-Agent' => 'gynx.gg panel (+https://gynx.gg)',
                'Accept' => 'application/json',
            ],
        ]);
    }

    public function slug(): string { return 'spigot'; }
    public function available(): bool { return true; }
    public function supports(string $type): bool { return $type === self::TYPE_PLUGIN; }

    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 20): array
    {
        $this->assertPlugin($type);

        try {
            $res = $this->http->get('search/resources/' . rawurlencode($query), [
                'query' => [
                    'size' => min($limit, 25),
                    'fields' => 'id,name,tag,downloads,icon,file,author,external,testedVersions',
                ],
            ]);
        } catch (TransferException $e) {
            throw new BadGatewayHttpException('SpigotMC search failed: ' . $e->getMessage());
        }

        $hits = json_decode((string) $res->getBody(), true) ?: [];

        return array_map(function (array $r) {
            $iconPath = $r['icon']['url'] ?? null;
            $icon = $iconPath ? 'https://www.spigotmc.org/' . ltrim((string) $iconPath, '/') : null;
            $authorId = $r['author']['id'] ?? null;

            return [
                'external_id' => (string) ($r['id'] ?? ''),
                'slug' => (string) ($r['id'] ?? ''),
                'name' => (string) ($r['name'] ?? 'Unknown'),
                'author' => $authorId ? "author #{$authorId}" : '',
                'description' => (string) ($r['tag'] ?? ''),
                'icon_url' => $icon,
                'downloads' => (int) ($r['downloads'] ?? 0),
                'latest_version' => null,
                'source' => 'spigot',
            ];
        }, $hits);
    }

    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null): array
    {
        $this->assertPlugin($type);

        try {
            $res = $this->http->get("resources/{$externalId}");
        } catch (TransferException $e) {
            throw new NotFoundHttpException('SpigotMC resource not found: ' . $externalId);
        }

        $r = json_decode((string) $res->getBody(), true) ?: [];

        if (!empty($r['external'])) {
            throw new ConflictHttpException(
                'This SpigotMC resource hosts its download off-site. Grab it from the author\'s page and upload it via the File Manager.',
            );
        }

        $fileType = (string) ($r['file']['type'] ?? '');
        if ($fileType === '') {
            throw new NotFoundHttpException('SpigotMC resource has no downloadable file.');
        }

        // SpiGet's download endpoint 302s to the current latest file.
        $url = "https://api.spiget.org/v2/resources/{$externalId}/download";

        $fileName = ((string) ($r['name'] ?? 'resource')) . $fileType;
        $fileName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $fileName);

        return [
            'url' => $url,
            'file_name' => $fileName,
            'file_hash' => null,
            'version' => (string) ($versionId ?? 'latest'),
            'version_id' => (string) ($versionId ?? 'latest'),
        ];
    }

    private function assertPlugin(string $type): void
    {
        if ($type !== self::TYPE_PLUGIN) {
            throw new NotFoundHttpException('SpigotMC only serves plugins.');
        }
    }
}
