<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Models\AddonPlugin;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Addons\AddonSource;
use Pterodactyl\Services\Addons\PluginInstallerService;
use Pterodactyl\Services\Addons\AddonSourceRegistry;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Addons\InstallPluginRequest;

class AddonPluginsController extends ClientApiController
{
    public function __construct(
        private PluginInstallerService $installer,
        private AddonSourceRegistry $sources,
    ) {
        parent::__construct();
    }

    /**
     * GET /servers/{server}/addons/plugins/sources
     */
    public function sources(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, 'file.read');

        $data = [];
        foreach ($this->sources->all() as $slug => $src) {
            try {
                if (!$src->supports(AddonSource::TYPE_PLUGIN)) continue;
                if (!$src->availableFor($server)) continue;
                $data[] = [
                    'slug' => $slug,
                    'available' => $src->available(),
                ];
            } catch (\Throwable $e) {
                // One misbehaving adapter shouldn't 500 the whole list.
                // Log + skip so the user still sees the others.
                report($e);
            }
        }

        return new JsonResponse(['data' => $data]);
    }

    /**
     * GET /servers/{server}/addons/plugins/search
     * ?source=modrinth&q=<query>&game_version=1.21
     */
    public function search(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, 'file.read');

        $source = (string) $request->query('source', 'modrinth');
        $query = trim((string) $request->query('q', ''));
        $gameVersion = $request->query('game_version') ? (string) $request->query('game_version') : null;

        // Empty query is intentional — adapters return their downloads-sorted
        // top picks so the page is populated before the user types anything.
        $results = $this->installer->search($server, $source, $query, $gameVersion);

        return new JsonResponse(['data' => $results]);
    }

    /**
     * GET /servers/{server}/addons/plugins
     */
    public function installed(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, 'file.read');

        return new JsonResponse([
            'data' => $this->installer->listInstalled($server),
        ]);
    }

    /**
     * POST /servers/{server}/addons/plugins/install
     *
     * @throws \Throwable
     */
    public function install(InstallPluginRequest $request, Server $server): JsonResponse
    {
        if (!$request->user()->can('file.create', $server)) {
            abort(403, 'You do not have permission to install plugins on this server.');
        }

        $plugin = $this->installer->install(
            $server,
            $request->user(),
            $request->input('source'),
            $request->input('external_id'),
            $request->input('version_id'),
            $request->input('game_version'),
        );

        try {
            Activity::event('server:addon.plugin.install')
                ->property('source', $plugin->source)
                ->property('external_id', $plugin->external_id)
                ->property('file', $plugin->file_name)
                ->log();
        } catch (\Throwable $e) {
            // Never let an audit-log write kill the install response.
            report($e);
        }

        return new JsonResponse([
            'data' => [
                'id' => $plugin->id,
                'source' => $plugin->source,
                'externalId' => $plugin->external_id,
                'name' => $plugin->name,
                'version' => $plugin->version,
                'fileName' => $plugin->file_name,
            ],
        ], Response::HTTP_CREATED);
    }

    /**
     * DELETE /servers/{server}/addons/plugins/{plugin}
     */
    public function destroy(ClientApiRequest $request, Server $server, AddonPlugin $plugin): JsonResponse
    {
        $this->ensurePermission($request, $server, 'file.delete');

        $this->installer->remove($server, $plugin);

        try {
            Activity::event('server:addon.plugin.remove')
                ->property('source', $plugin->source)
                ->property('external_id', $plugin->external_id)
                ->property('file', $plugin->file_name)
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
