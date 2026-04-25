<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Models\AddonModpack;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Addons\AddonSource;
use Pterodactyl\Services\Addons\AddonSourceRegistry;
use Pterodactyl\Services\Addons\ModpackInstallerService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Addons\InstallModpackRequest;

class AddonModpacksController extends ClientApiController
{
    public function __construct(
        private ModpackInstallerService $installer,
        private AddonSourceRegistry $sources,
    ) {
        parent::__construct();
    }

    public function sources(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_ADDON_MODPACK_READ);

        // Plugin-only sources (Hangar, SpigotMC) don't host modpacks at all,
        // so don't surface them as "· soon" — they're n/a, not coming.
        $data = [];
        foreach ($this->sources->all() as $slug => $src) {
            if (!$src->supports(AddonSource::TYPE_MODPACK)) continue;
            $data[] = [
                'slug' => $slug,
                'available' => $src->available(),
            ];
        }

        return new JsonResponse(['data' => $data]);
    }

    public function search(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_ADDON_MODPACK_READ);

        $source = (string) $request->query('source', 'modrinth');
        $query = trim((string) $request->query('q', ''));
        $gameVersion = $request->query('game_version') ? (string) $request->query('game_version') : null;

        // Empty query is intentional — adapters return their downloads-sorted
        // top picks so the page is populated before the user types anything.
        return new JsonResponse([
            'data' => $this->installer->search($server, $source, $query, $gameVersion),
        ]);
    }

    public function installed(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_ADDON_MODPACK_READ);

        return new JsonResponse([
            'data' => $this->installer->listInstalled($server),
        ]);
    }

    public function install(InstallModpackRequest $request, Server $server): JsonResponse
    {
        $pack = $this->installer->install(
            $server,
            $request->user(),
            $request->input('source'),
            $request->input('external_id'),
            $request->input('version_id'),
            $request->input('game_version'),
        );

        try {
            Activity::event('server:addon.modpack.install')
                ->property('source', $pack->source)
                ->property('external_id', $pack->external_id)
                ->property('file', $pack->file_name)
                ->log();
        } catch (\Throwable $e) {
            report($e);
        }

        return new JsonResponse([
            'data' => [
                'id' => $pack->id,
                'source' => $pack->source,
                'externalId' => $pack->external_id,
                'name' => $pack->name,
                'version' => $pack->version,
                'fileName' => $pack->file_name,
                'status' => $pack->status,
            ],
        ], Response::HTTP_CREATED);
    }

    public function extract(ClientApiRequest $request, Server $server, AddonModpack $modpack): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_ADDON_MODPACK_INSTALL);

        $pack = $this->installer->extract($server, $modpack);

        try {
            Activity::event('server:addon.modpack.extract')
                ->property('source', $pack->source)
                ->property('external_id', $pack->external_id)
                ->property('file', $pack->file_name)
                ->log();
        } catch (\Throwable $e) {
            report($e);
        }

        return new JsonResponse([
            'data' => [
                'id' => $pack->id,
                'source' => $pack->source,
                'externalId' => $pack->external_id,
                'name' => $pack->name,
                'version' => $pack->version,
                'fileName' => $pack->file_name,
                'status' => $pack->status,
            ],
        ]);
    }

    public function destroy(ClientApiRequest $request, Server $server, AddonModpack $modpack): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_ADDON_MODPACK_DELETE);
        $this->installer->remove($server, $modpack);

        try {
            Activity::event('server:addon.modpack.remove')
                ->property('source', $modpack->source)
                ->property('external_id', $modpack->external_id)
                ->property('file', $modpack->file_name)
                ->log();
        } catch (\Throwable $e) {
            report($e);
        }

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    private function ensurePermission(ClientApiRequest $request, Server $server, string $permission): void
    {
        if (!$request->user()->can($permission, $server)) {
            abort(403, 'You do not have permission to perform this action on this server.');
        }
    }
}
