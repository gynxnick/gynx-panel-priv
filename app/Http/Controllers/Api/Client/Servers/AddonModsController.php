<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Models\AddonMod;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Addons\AddonSource;
use Pterodactyl\Services\Addons\AddonSourceRegistry;
use Pterodactyl\Services\Addons\ModInstallerService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Addons\InstallModRequest;

class AddonModsController extends ClientApiController
{
    public function __construct(
        private ModInstallerService $installer,
        private AddonSourceRegistry $sources,
    ) {
        parent::__construct();
    }

    public function sources(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_ADDON_MOD_READ);

        $data = [];
        foreach ($this->sources->all() as $slug => $src) {
            $data[] = [
                'slug' => $slug,
                'available' => $src->available() && $src->supports(AddonSource::TYPE_MOD),
            ];
        }

        return new JsonResponse(['data' => $data]);
    }

    public function search(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_ADDON_MOD_READ);

        $source = (string) $request->query('source', 'modrinth');
        $query = trim((string) $request->query('q', ''));
        $gameVersion = $request->query('game_version') ? (string) $request->query('game_version') : null;

        if ($query === '') return new JsonResponse(['data' => []]);

        return new JsonResponse([
            'data' => $this->installer->search($server, $source, $query, $gameVersion),
        ]);
    }

    public function installed(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_ADDON_MOD_READ);

        return new JsonResponse([
            'data' => $this->installer->listInstalled($server),
        ]);
    }

    public function install(InstallModRequest $request, Server $server): JsonResponse
    {
        $mod = $this->installer->install(
            $server,
            $request->user(),
            $request->input('source'),
            $request->input('external_id'),
            $request->input('version_id'),
            $request->input('game_version'),
        );

        try {
            Activity::event('server:addon.mod.install')
                ->property('source', $mod->source)
                ->property('external_id', $mod->external_id)
                ->property('file', $mod->file_name)
                ->log();
        } catch (\Throwable $e) {
            report($e);
        }

        return new JsonResponse([
            'data' => [
                'id' => $mod->id,
                'source' => $mod->source,
                'externalId' => $mod->external_id,
                'name' => $mod->name,
                'version' => $mod->version,
                'fileName' => $mod->file_name,
            ],
        ], Response::HTTP_CREATED);
    }

    public function destroy(ClientApiRequest $request, Server $server, AddonMod $mod): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_ADDON_MOD_DELETE);
        $this->installer->remove($server, $mod);

        try {
            Activity::event('server:addon.mod.remove')
                ->property('source', $mod->source)
                ->property('external_id', $mod->external_id)
                ->property('file', $mod->file_name)
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
