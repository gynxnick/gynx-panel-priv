<?php

namespace Pterodactyl\Services\Addons;

use Illuminate\Database\ConnectionInterface;
use Pterodactyl\Models\AddonMod;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ModInstallerService
{
    public function __construct(
        private ConnectionInterface $connection,
        private AddonSourceRegistry $registry,
        private DaemonFileRepository $daemonFiles,
    ) {
    }

    public function search(Server $server, string $sourceSlug, string $query, ?string $gameVersion = null): array
    {
        $source = $this->registry->get($sourceSlug);
        if (!$source->available() || !$source->supports(AddonSource::TYPE_MOD) || !$source->availableFor($server)) return [];

        $hits = $source->search(AddonSource::TYPE_MOD, $query, $gameVersion, 60, $server);
        $installed = AddonMod::query()
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
        return AddonMod::query()
            ->where('server_id', $server->id)
            ->orderByDesc('installed_at')
            ->get()
            ->map(fn (AddonMod $m) => [
                'id' => $m->id,
                'source' => $m->source,
                'externalId' => $m->external_id,
                'slug' => $m->slug,
                'name' => $m->name,
                'version' => $m->version,
                'loader' => $m->loader,
                'fileName' => $m->file_name,
                'installedAt' => $m->installed_at->toIso8601String(),
            ])
            ->all();
    }

    /**
     * Pulls the mod jar into /mods/ via Wings, then records it.
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
    ): AddonMod {
        $source = $this->registry->get($sourceSlug);
        if (!$source->available() || !$source->supports(AddonSource::TYPE_MOD) || !$source->availableFor($server)) {
            throw new ConflictHttpException("Source '{$sourceSlug}' is not available for mods on this server.");
        }

        if (AddonMod::query()
            ->where('server_id', $server->id)
            ->where('source', $sourceSlug)
            ->where('external_id', $externalId)
            ->exists()
        ) {
            throw new ConflictHttpException('This mod is already installed on this server.');
        }

        $dl = $source->resolveDownload(AddonSource::TYPE_MOD, $externalId, $versionId, $gameVersion, $server);
        $displayName = $this->readableNameFromFile($dl['file_name']);

        $this->daemonFiles->setServer($server)->pull($dl['url'], '/mods', [
            'filename' => $dl['file_name'],
            'foreground' => true,
        ]);

        return $this->connection->transaction(function () use ($server, $actor, $sourceSlug, $externalId, $dl, $displayName) {
            return AddonMod::query()->create([
                'server_id' => $server->id,
                'source' => $sourceSlug,
                'external_id' => $externalId,
                'slug' => null,
                'name' => $displayName,
                'version' => $dl['version'] ?: null,
                'file_name' => $dl['file_name'],
                'file_hash' => $dl['file_hash'] ?: null,
                'loader' => null, // Modrinth returns loaders per-version; skipped for MVP
                'installed_by' => $actor->id,
            ]);
        });
    }

    public function remove(Server $server, AddonMod $mod): void
    {
        if ($mod->server_id !== $server->id) {
            throw new ConflictHttpException('Mod does not belong to this server.');
        }

        try {
            $this->daemonFiles->setServer($server)->deleteFiles('/mods', [$mod->file_name]);
        } catch (\Throwable $e) {
            // Leave the DB row removal happening — symmetric with plugins.
        }

        $mod->delete();
    }

    private function readableNameFromFile(string $file): string
    {
        $base = preg_replace('/\.(jar|zip)$/i', '', $file);
        $base = preg_replace('/[-_][vV]?\d+(\.\d+)*.*$/', '', $base);
        return $base ?: $file;
    }
}
