<?php

namespace Pterodactyl\Services\Addons;

use Illuminate\Database\ConnectionInterface;
use Pterodactyl\Models\AddonModpack;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Modpack installer — MVP.
 *
 * Current flow pulls the modpack archive (Modrinth .mrpack for now) into
 * /modpacks/ via Wings and records a DB row. Does NOT auto-extract or
 * install child mods — a follow-up phase will walk the mrpack manifest,
 * fan out mod downloads, and copy overrides. For now we direct the user
 * to extract manually via the File Manager.
 */
class ModpackInstallerService
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
        if (!$source->available() || !$source->supports(AddonSource::TYPE_MODPACK)) return [];

        $hits = $source->search(AddonSource::TYPE_MODPACK, $query, $gameVersion);
        $installed = AddonModpack::query()
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
        return AddonModpack::query()
            ->where('server_id', $server->id)
            ->orderByDesc('installed_at')
            ->get()
            ->map(fn (AddonModpack $p) => [
                'id' => $p->id,
                'source' => $p->source,
                'externalId' => $p->external_id,
                'slug' => $p->slug,
                'name' => $p->name,
                'version' => $p->version,
                'fileName' => $p->file_name,
                'status' => $p->status,
                'installedAt' => $p->installed_at->toIso8601String(),
            ])
            ->all();
    }

    /**
     * Download the modpack archive into /modpacks/ via Wings. Does not
     * extract. Returns the DB row.
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
    ): AddonModpack {
        $source = $this->registry->get($sourceSlug);
        if (!$source->available() || !$source->supports(AddonSource::TYPE_MODPACK)) {
            throw new ConflictHttpException("Source '{$sourceSlug}' is not available for modpacks.");
        }

        if (AddonModpack::query()
            ->where('server_id', $server->id)
            ->where('source', $sourceSlug)
            ->where('external_id', $externalId)
            ->exists()
        ) {
            throw new ConflictHttpException('This modpack is already downloaded on this server.');
        }

        $dl = $source->resolveDownload(AddonSource::TYPE_MODPACK, $externalId, $versionId, $gameVersion);
        $displayName = $this->readableNameFromFile($dl['file_name']);

        $this->daemonFiles->setServer($server)->pull($dl['url'], '/modpacks', [
            'filename' => $dl['file_name'],
            'foreground' => true,
        ]);

        return $this->connection->transaction(function () use ($server, $actor, $sourceSlug, $externalId, $dl, $displayName) {
            return AddonModpack::query()->create([
                'server_id' => $server->id,
                'source' => $sourceSlug,
                'external_id' => $externalId,
                'slug' => null,
                'name' => $displayName,
                'version' => $dl['version'] ?: null,
                'file_name' => $dl['file_name'],
                'file_hash' => $dl['file_hash'] ?: null,
                'status' => AddonModpack::STATUS_DOWNLOADED,
                'installed_by' => $actor->id,
            ]);
        });
    }

    public function remove(Server $server, AddonModpack $pack): void
    {
        if ($pack->server_id !== $server->id) {
            throw new ConflictHttpException('Modpack does not belong to this server.');
        }

        try {
            $this->daemonFiles->setServer($server)->deleteFiles('/modpacks', [$pack->file_name]);
        } catch (\Throwable $e) {
            // Silent — user may have already removed the archive.
        }

        $pack->delete();
    }

    /**
     * Walk a Modrinth .mrpack archive into the server filesystem.
     *
     *   1. Decompress the archive into a private work dir under /modpacks/.
     *   2. Read modrinth.index.json (the manifest).
     *   3. For each file entry: if the server env rule allows it, dispatch a
     *      Wings pull() at the entry's relative path. We use foreground:false
     *      so Wings queues downloads in parallel rather than serialising.
     *   4. Lift everything in overrides/ and server-overrides/ up to the
     *      server root. We move only top-level entries — Wings rename is a
     *      filesystem rename, so moving a directory takes its whole subtree
     *      with it. Conflicts (e.g. an existing /config dir) are skipped
     *      with a logged warning rather than aborting the whole extract.
     *   5. Drop the work dir + the archive.
     *
     * The DB row flips to EXTRACTED on success, FAILED on any thrown error
     * mid-flight (the partial filesystem state is the user's to clean up,
     * since blanket deletes could clobber their existing config).
     *
     * @throws \Throwable
     */
    public function extract(Server $server, AddonModpack $pack, bool $keepExisting = false): AddonModpack
    {
        if ($pack->server_id !== $server->id) {
            throw new ConflictHttpException('Modpack does not belong to this server.');
        }
        if ($pack->status === AddonModpack::STATUS_EXTRACTED) {
            throw new ConflictHttpException('Modpack is already extracted.');
        }
        if (!str_ends_with(strtolower($pack->file_name), '.mrpack')) {
            throw new ConflictHttpException('Auto-extract is currently only supported for Modrinth .mrpack archives.');
        }

        $files = $this->daemonFiles->setServer($server);
        $workName = '.work-' . $pack->id;
        $workPath = '/modpacks/' . $workName;

        try {
            // 1. Create the work dir + move the archive in. Using root=/
            // with full relative paths to avoid any ambiguity around how
            // Wings resolves nested-root rename pairs.
            $files->createDirectory($workName, '/modpacks');
            $files->renameFiles('/', [[
                'from' => 'modpacks/' . $pack->file_name,
                'to' => 'modpacks/' . $workName . '/' . $pack->file_name,
            ]]);

            // 2. Decompress (sync, up to 15 min — Wings holds the request).
            $files->decompressFile($workPath, $pack->file_name);

            // 3. Manifest. Cap the read at 1 MB; even huge packs (1k+ mods)
            // produce manifests of a few hundred KB tops.
            $manifestRaw = $files->getContent($workPath . '/modrinth.index.json', 1024 * 1024);
            $manifest = json_decode($manifestRaw, true);
            if (!is_array($manifest) || empty($manifest['files'])) {
                throw new ConflictHttpException('modrinth.index.json is missing or empty in this archive.');
            }

            // 3a. Clean install: wipe /mods/ contents so the new pack defines
            // the mod set. Old leftover jars otherwise coexist with the new
            // pack's mods and the server crashes on startup.
            //
            // When the caller asks to keep existing files (preserves mods
            // they added by hand, custom configs, etc.) we skip the wipe
            // and let the manifest's downloads merge into the existing dir.
            // Conflicts in /mods/ on identical filenames will overwrite,
            // which is what users want — the new pack's version of a jar
            // should replace any same-name leftover.
            if (!$keepExisting) {
                $this->wipeDirContents($files, '/mods');
            }

            // 4. Fan out mod downloads. Skip entries marked unsupported on
            // the server side (mostly client-only mods like Sodium).
            foreach ($manifest['files'] as $entry) {
                $serverEnv = $entry['env']['server'] ?? 'required';
                if ($serverEnv === 'unsupported') continue;

                $relPath = ltrim((string) ($entry['path'] ?? ''), '/');
                if ($relPath === '' || str_contains($relPath, '..')) continue;

                $downloads = $entry['downloads'] ?? [];
                $url = $downloads[0] ?? null;
                if (!$url) continue;

                $dir = '/' . trim(dirname($relPath), '/.');
                $name = basename($relPath);

                try {
                    $files->pull($url, $dir === '/' ? '/' : $dir, [
                        'filename' => $name,
                        'foreground' => false,
                    ]);
                } catch (\Throwable $e) {
                    // Best-effort: log via report() but keep walking so a
                    // single dead URL doesn't kill the whole pack.
                    report($e);
                }
            }

            // 5. Lift overrides (and server-overrides for server-side packs)
            // into the server root. client-overrides/ is intentionally
            // skipped — those are launcher-only resources.
            foreach (['server-overrides', 'overrides'] as $overrideDir) {
                $sourcePath = $workPath . '/' . $overrideDir;
                try {
                    $listing = $files->getDirectory($sourcePath);
                } catch (\Throwable $e) {
                    continue; // override dir doesn't exist in this pack
                }

                foreach ($listing as $entry) {
                    $name = $entry['name'] ?? null;
                    if (!$name) continue;

                    // Modpack overrides should win — delete the existing
                    // target (file or directory) before renaming the new
                    // one in. Without this the rename fails on conflict
                    // and stale configs from the previous pack persist.
                    //
                    // In keep-existing mode we instead skip top-level
                    // entries that already exist, so worlds/configs the
                    // user has already customized survive untouched.
                    if ($keepExisting && $this->topLevelEntryExists($files, $name)) {
                        continue;
                    }

                    if (!$keepExisting) {
                        try {
                            $files->deleteFiles('/', [$name]);
                        } catch (\Throwable $e) {
                            // No existing entry, or delete refused — fine, the
                            // rename below will succeed if the slot is empty.
                        }
                    }

                    try {
                        $files->renameFiles('/', [[
                            'from' => ltrim($sourcePath, '/') . '/' . $name,
                            'to' => $name,
                        ]]);
                    } catch (\Throwable $e) {
                        // Genuine rename failure (permissions, etc.) — log
                        // but keep walking the rest of the overrides.
                        report($e);
                    }
                }
            }

            // 6. Drop the work dir (which still contains the archive,
            // overrides we couldn't move, and the manifest).
            try {
                $files->deleteFiles('/modpacks', [$workName]);
            } catch (\Throwable $e) {
                report($e);
            }

            $pack->update(['status' => AddonModpack::STATUS_EXTRACTED]);
            return $pack->refresh();
        } catch (\Throwable $e) {
            $pack->update(['status' => AddonModpack::STATUS_FAILED]);
            throw $e;
        }
    }

    private function readableNameFromFile(string $file): string
    {
        $base = preg_replace('/\.(mrpack|zip|jar)$/i', '', $file);
        $base = preg_replace('/[-_][vV]?\d+(\.\d+)*.*$/', '', $base);
        return $base ?: $file;
    }

    /**
     * Probe whether a top-level entry exists at the server root. Used by
     * the keep-existing extract path to decide whether to skip overrides
     * that would otherwise clobber the user's data.
     */
    private function topLevelEntryExists(\Pterodactyl\Repositories\Wings\DaemonFileRepository $files, string $name): bool
    {
        try {
            $listing = $files->getDirectory('/');
        } catch (\Throwable $e) {
            return false;
        }
        foreach ($listing as $entry) {
            $existing = is_array($entry) ? ($entry['name'] ?? null) : null;
            if ($existing === $name) return true;
        }
        return false;
    }

    /**
     * Empty the contents of a directory, leaving the directory itself in
     * place. Silent if the directory doesn't exist (the next pull will
     * create it).
     */
    private function wipeDirContents(\Pterodactyl\Repositories\Wings\DaemonFileRepository $files, string $dir): void
    {
        try {
            $entries = $files->getDirectory($dir);
        } catch (\Throwable $e) {
            return; // dir doesn't exist yet
        }

        $names = [];
        foreach ($entries as $e) {
            $name = is_array($e) ? ($e['name'] ?? null) : null;
            if (is_string($name) && $name !== '') $names[] = $name;
        }
        if (empty($names)) return;

        try {
            $files->deleteFiles($dir, $names);
        } catch (\Throwable $e) {
            // Best-effort — don't fail the whole extract over leftover files.
            report($e);
        }
    }
}
