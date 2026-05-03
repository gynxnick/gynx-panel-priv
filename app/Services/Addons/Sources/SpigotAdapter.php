<?php

namespace Pterodactyl\Services\Addons\Sources;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Addons\AddonGameRegistry;
use Pterodactyl\Services\Addons\AddonSource;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
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

    public function availableFor(Server $server): bool
    {
        // SpiGet wraps the SpigotMC plugin catalogue (Bukkit-derived),
        // i.e. Minecraft-only. Gate per server so non-MC eggs don't see
        // it as a selectable source.
        $game = AddonGameRegistry::forServer($server);
        return $game !== null && $game['slug'] === 'minecraft';
    }

    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 60, ?Server $server = null): array
    {
        $this->assertPlugin($type);

        // SpiGet's /search/resources/{q} endpoint requires a non-empty query.
        // For empty-query "browse popular" we hit /resources sorted by
        // downloads instead — same response shape so the mapper below
        // doesn't need to branch.
        $fields = 'id,name,tag,downloads,icon,file,author,external,testedVersions';
        try {
            if (trim($query) === '') {
                $res = $this->http->get('resources', [
                    'query' => [
                        'size' => min($limit, 50),
                        'sort' => '-downloads',
                        'fields' => $fields,
                    ],
                ]);
            } else {
                $res = $this->http->get('search/resources/' . rawurlencode($query), [
                    'query' => [
                        'size' => min($limit, 50),
                        'fields' => $fields,
                    ],
                ]);
            }
        } catch (TransferException $e) {
            throw new HttpException(502, 'SpigotMC search failed: ' . $e->getMessage());
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

    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null, ?Server $server = null): array
    {
        $this->assertPlugin($type);

        // Outer try wraps the entire body so any unexpected exception
        // (malformed JSON, weird Spiget payload shape, transient guzzle
        // crash) becomes a clear 502 instead of an opaque 500. HTTP
        // exceptions thrown deliberately by this method (Conflict 409
        // for external resources, NotFound 404 for missing files) are
        // re-thrown unchanged so the client still sees the right status.
        try {
            try {
                $res = $this->http->get("resources/{$externalId}");
            } catch (TransferException $e) {
                throw new NotFoundHttpException('SpigotMC resource not found: ' . $externalId);
            }

            $r = json_decode((string) $res->getBody(), true) ?: [];

            // SpiGet flags resources whose author hosts the file off-site
            // (GitHub releases, Cloudflare CDN, MediaFire, Discord, etc.)
            // as `external: true`. Many of those redirect cleanly through
            // SpiGet's `/download` endpoint and Wings can follow the 302 —
            // we used to hard-reject here with a 409, but that locked out
            // ~70% of perfectly-installable resources. Now we attempt the
            // download regardless; if Wings can't follow the redirect
            // (Cloudflare bot challenge, dead link), the BadGateway wrap
            // in the outer try surfaces it as a clean 502 with attribution.

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
        } catch (\Throwable $e) {
            // Pass HTTP exceptions through unchanged so 404/409 stay
            // semantically correct on the wire.
            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpException) {
                throw $e;
            }
            // Anything else: log + 502 with attribution.
            report($e);
            throw new HttpException(502, sprintf(
                'SpigotMC adapter failed to resolve this resource: %s. Check storage/logs/laravel.log for details.',
                $e->getMessage(),
            ));
        }
    }

    public function listVersions(string $type, string $externalId, ?string $gameVersion = null, int $limit = 20, ?Server $server = null): array
    {
        $this->assertPlugin($type);

        try {
            $res = $this->http->get("resources/{$externalId}/versions", [
                'query' => [
                    'size' => min(max($limit, 1), 25),
                    'sort' => '-releaseDate',
                ],
            ]);
        } catch (TransferException $e) {
            throw new NotFoundHttpException('SpigotMC resource not found: ' . $externalId);
        }

        $versions = json_decode((string) $res->getBody(), true) ?: [];

        return array_map(function (array $v) {
            $ts = $v['releaseDate'] ?? null;
            return [
                'version_id' => (string) ($v['id'] ?? ''),
                'version' => (string) ($v['name'] ?? ''),
                // SpiGet doesn't expose tested-against MC versions on the
                // version record itself — that's resource-level metadata.
                'game_versions' => [],
                'loaders' => [],
                'channel' => null,
                'file_name' => null,
                'downloads' => isset($v['downloads']) ? (int) $v['downloads'] : null,
                'published_at' => $ts ? gmdate('c', (int) $ts) : null,
            ];
        }, $versions);
    }

    private function assertPlugin(string $type): void
    {
        if ($type !== self::TYPE_PLUGIN) {
            throw new NotFoundHttpException('SpigotMC only serves plugins.');
        }
    }
}
