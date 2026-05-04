<?php

namespace Pterodactyl\Services\Addons;

use Illuminate\Database\ConnectionInterface;
use Pterodactyl\Models\AddonPlugin;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PluginInstallerService
{
    public function __construct(
        private ConnectionInterface $connection,
        private AddonSourceRegistry $registry,
        private DaemonFileRepository $daemonFiles,
        private CrateFlareSolverrService $flareSolverr,
    ) {
    }

    /**
     * Search external source. Returns the adapter's raw search rows plus
     * an `installed` flag per row so the UI can mark "already installed".
     */
    public function search(Server $server, string $sourceSlug, string $query, ?string $gameVersion = null): array
    {
        $source = $this->registry->get($sourceSlug);
        if (!$source->available() || !$source->supports(AddonSource::TYPE_PLUGIN) || !$source->availableFor($server)) return [];

        $hits = $source->search(AddonSource::TYPE_PLUGIN, $query, $gameVersion, 60, $server);
        $installed = AddonPlugin::query()
            ->where('server_id', $server->id)
            ->where('source', $sourceSlug)
            ->pluck('external_id')
            ->all();

        foreach ($hits as &$h) {
            $h['installed'] = in_array($h['external_id'], $installed, true);
        }
        return $hits;
    }

    public function listInstalled(Server $server): array
    {
        return AddonPlugin::query()
            ->where('server_id', $server->id)
            ->orderByDesc('installed_at')
            ->get()
            ->map(fn (AddonPlugin $p) => [
                'id' => $p->id,
                'source' => $p->source,
                'externalId' => $p->external_id,
                'slug' => $p->slug,
                'name' => $p->name,
                'version' => $p->version,
                'fileName' => $p->file_name,
                'installedAt' => $p->installed_at->toIso8601String(),
            ])
            ->all();
    }

    /**
     * Pulls the plugin jar into /plugins/ via Wings, then records it.
     *
     * @throws \Throwable
     */
    public function install(
        Server $server,
        User $actor,
        string $sourceSlug,
        string $externalId,
        ?string $versionId = null,
        ?string $gameVersion = null,
    ): AddonPlugin {
        $source = $this->registry->get($sourceSlug);
        if (!$source->available() || !$source->supports(AddonSource::TYPE_PLUGIN) || !$source->availableFor($server)) {
            throw new ConflictHttpException("Source '{$sourceSlug}' is not available for plugins on this server.");
        }

        if (AddonPlugin::query()
            ->where('server_id', $server->id)
            ->where('source', $sourceSlug)
            ->where('external_id', $externalId)
            ->exists()
        ) {
            throw new ConflictHttpException('This plugin is already installed on this server.');
        }

        $dl = $source->resolveDownload(AddonSource::TYPE_PLUGIN, $externalId, $versionId, $gameVersion, $server);

        // Resolve the display name + slug from the same source's search
        // payload isn't cheap; lean on the resolveDownload metadata + the
        // external id / slug we stored. Use filename as a readable fallback.
        $displayName = $this->readableNameFromFile($dl['file_name']);

        // Hand the URL to Wings; Wings curl's the bytes into /plugins/.
        // All adapters now return URLs Wings can fetch directly:
        //   - Modrinth / CurseForge / Hangar / Thunderstore — their own CDNs
        //   - Spigot — Spiget's `/download/proxy` endpoint, which streams
        //     from cdn.spiget.org and avoids the spigotmc.org Cloudflare
        //     gate that used to break this path.
        //
        // If the pull fails, the customer-facing 502 below points them at
        // the source's resource page so they can download + upload by hand.
        try {
            $this->daemonFiles->setServer($server)->pull($dl['url'], '/plugins', [
                'filename' => $dl['file_name'],
                'foreground' => true,
            ]);
        } catch (\Throwable $e) {
            report($e);

            // Source-specific hint. Spiget's proxy doesn't cover "external"
            // resources where the author hosts the file off-site (Discord,
            // MediaFire, etc.) — those still 302 to a third-party host and
            // can fail. Point the user at the resource page so they can
            // grab the jar themselves and upload it via the File Manager.
            $hint = $sourceSlug === 'spigot'
                ? sprintf(
                    'This resource may be hosted off-site (Discord, MediaFire, or another external host) — Spiget\'s proxy only streams files Spiget itself caches. Download manually from https://www.spigotmc.org/resources/%s/ and upload via your panel\'s File Manager.',
                    $externalId,
                )
                : 'Try downloading the jar manually from the source page and uploading it via your panel\'s File Manager.';

            throw new HttpException(502, sprintf(
                "%s couldn't deliver this plugin's jar to your server. %s (%s)",
                ucfirst($sourceSlug),
                $hint,
                $e->getMessage(),
            ));
        }

        return $this->connection->transaction(function () use ($server, $actor, $sourceSlug, $externalId, $dl, $displayName) {
            return AddonPlugin::query()->create([
                'server_id' => $server->id,
                'source' => $sourceSlug,
                'external_id' => $externalId,
                'slug' => null,
                'name' => $displayName,
                'version' => $dl['version'] ?: null,
                'file_name' => $dl['file_name'],
                'file_hash' => $dl['file_hash'] ?: null,
                'installed_by' => $actor->id,
            ]);
        });
    }

    public function remove(Server $server, AddonPlugin $plugin): void
    {
        if ($plugin->server_id !== $server->id) {
            throw new ConflictHttpException('Plugin does not belong to this server.');
        }

        // Try to delete the jar; swallow file-not-found since the user may
        // have already removed it manually via the File Manager.
        try {
            $this->daemonFiles->setServer($server)->deleteFiles('/plugins', [$plugin->file_name]);
        } catch (\Throwable $e) {
            // Leave the DB row removal happening — the plugin is "gone" from
            // the user's perspective even if Wings didn't find the file.
        }

        $plugin->delete();
    }

    /** "EssentialsX-2.20.1.jar" → "EssentialsX" as a friendly fallback. */
    private function readableNameFromFile(string $file): string
    {
        $base = preg_replace('/\.(jar|zip)$/i', '', $file);
        $base = preg_replace('/[-_][vV]?\d+(\.\d+)*.*$/', '', $base);
        return $base ?: $file;
    }
}
