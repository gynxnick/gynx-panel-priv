<?php

namespace Pterodactyl\Services\Addons\Sources;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use Illuminate\Support\Facades\Cache;
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
            // Spiget's resource search returns only `author.id` — no name.
            // Resolve via cached `/authors/{id}` lookup; soft-fails to ''
            // on Spiget errors. 24h cache means a warm catalog avoids
            // the N+1 cost on subsequent searches.
            $authorName = $authorId !== null ? $this->resolveAuthorName((int) $authorId) : '';

            // Mirror the classification resolveDownload does, so the UI
            // can show an "Auto-install" / "Manual" badge before the
            // user clicks Install. Cheap — uses fields we already
            // requested in the search query.
            $fileType = (string) ($r['file']['type'] ?? '');
            $isExternal = $fileType === 'external' || (bool) ($r['external'] ?? false);
            $installable = !$isExternal && $fileType !== '' && preg_match('/^\.[A-Za-z0-9]+$/', $fileType) === 1;

            return [
                'external_id' => (string) ($r['id'] ?? ''),
                'slug' => (string) ($r['id'] ?? ''),
                'name' => (string) ($r['name'] ?? 'Unknown'),
                'author' => $authorName,
                'description' => (string) ($r['tag'] ?? ''),
                'icon_url' => $icon,
                'downloads' => (int) ($r['downloads'] ?? 0),
                'latest_version' => null,
                'source' => 'spigot',
                'installable' => $installable,
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

            $fileType = (string) ($r['file']['type'] ?? '');
            if ($fileType === '') {
                throw new NotFoundHttpException('SpigotMC resource has no downloadable file.');
            }

            // Spiget reports three classes of resource:
            //
            //   (a) Spiget-hosted — file.type is a real extension
            //       (.jar, .zip, etc.) and external=false. Spiget
            //       mirrors the file on cdn.spiget.org. Falls through
            //       to the proxy-URL branch below.
            //
            //   (b) External — file.type='external' or external=true.
            //       The author hosts the file off-site (GitHub releases,
            //       CodeMC, MediaFire, Discord, etc.). Spiget can't
            //       proxy; it would 302 us at the landing page, which
            //       Wings can't reliably curl into a single jar.
            //       Spiget exposes the off-site URL on file.externalUrl
            //       — point the user there and let them download by
            //       hand. SkinsRestorer / EssentialsX / ViaVersion /
            //       ProtocolLib / Multiverse-Core / AuthMe etc. all
            //       fall here; they're the most popular plugins on
            //       SpigotMC and none of them are auto-installable via
            //       Spiget.
            //
            //   (c) Malformed — file.type is something like '.' or any
            //       other non-extension, non-'external' value. Stub
            //       posting where the real file lives in the resource
            //       description. Refuse with a spigotmc.org link.
            $isExternal = $fileType === 'external' || (bool) ($r['external'] ?? false);

            if ($isExternal) {
                $extUrl = (string) ($r['file']['externalUrl'] ?? '');
                $linkTarget = $extUrl !== '' ? $extUrl : "https://www.spigotmc.org/resources/{$externalId}/";
                throw new ConflictHttpException(sprintf(
                    'This SpigotMC resource is hosted off-site (the author links out to GitHub, MediaFire, Discord, or another file host) — Crate cannot auto-install it. Download it from %s and upload via your panel\'s File Manager.',
                    $linkTarget,
                ));
            }

            if (!preg_match('/^\.[A-Za-z0-9]+$/', $fileType)) {
                throw new ConflictHttpException(sprintf(
                    'This SpigotMC resource has no clean downloadable file on Spiget — likely a stub posting where the real file lives in the resource description. Download manually from https://www.spigotmc.org/resources/%s/ and upload via your panel\'s File Manager.',
                    $externalId,
                ));
            }

            // Spiget's proxy endpoint requires a concrete version id —
            // it does not accept "latest" as a path arg (that's a
            // sibling endpoint). When the caller didn't pin a version,
            // ask Spiget which one is current.
            $resolvedVersionId = $versionId !== null && $versionId !== '' && $versionId !== 'latest'
                ? $versionId
                : null;
            if ($resolvedVersionId === null) {
                try {
                    $vRes = $this->http->get("resources/{$externalId}/versions/latest");
                    $vData = json_decode((string) $vRes->getBody(), true) ?: [];
                    $resolvedVersionId = isset($vData['id']) ? (string) $vData['id'] : '';
                } catch (TransferException $e) {
                    throw new HttpException(502, 'SpigotMC version lookup failed: ' . $e->getMessage());
                }
                if ($resolvedVersionId === '') {
                    throw new NotFoundHttpException('SpigotMC resource has no published version.');
                }
            }

            // Use Spiget's `/download/proxy` endpoint — it streams the
            // file bytes from Spiget's own CDN (cdn.spiget.org), which
            // is NOT behind Cloudflare. The plain `/download` endpoint
            // 302s to spigotmc.org (which IS Cloudflare-protected) and
            // Wings's curl gets bot-challenged on the redirect target,
            // which is what was breaking installs.
            //
            // Caveats per Spiget's docs:
            //   - Rate-limited (~1 request per couple of seconds per
            //     IP). Fine for human-paced installs.
            //   - "External" resources (where the author hosts the file
            //     off-site — Discord, MediaFire, etc.) still 302 to the
            //     off-site host and may fail there. Caller surfaces a
            //     clean 502 with a "download manually from spigotmc.org"
            //     hint when that happens.
            $url = "https://api.spiget.org/v2/resources/{$externalId}/versions/{$resolvedVersionId}/download/proxy";

            $fileName = ((string) ($r['name'] ?? 'resource')) . $fileType;
            $fileName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $fileName);

            return [
                'url' => $url,
                'file_name' => $fileName,
                'file_hash' => null,
                'version' => (string) $resolvedVersionId,
                'version_id' => (string) $resolvedVersionId,
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

    /**
     * Look up the SpigotMC author display name for a given numeric
     * author ID. Spiget's resource search response only carries
     * `author.id`; the username comes from a separate `/authors/{id}`
     * call. Cached for 24h since usernames rarely change. Soft-fails
     * to '' on any network or parse error so a flaky Spiget can't
     * break the search response shape.
     */
    private function resolveAuthorName(int $authorId): string
    {
        return Cache::remember(
            'crate:spigot:author:' . $authorId,
            86400,
            function () use ($authorId): string {
                try {
                    $res = $this->http->get("authors/{$authorId}", [
                        'query' => ['fields' => 'name'],
                    ]);
                    $data = json_decode((string) $res->getBody(), true);
                    return (string) ($data['name'] ?? '');
                } catch (TransferException $e) {
                    return '';
                }
            },
        );
    }
}
