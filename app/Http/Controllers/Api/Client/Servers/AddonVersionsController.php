<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Addons\AddonSource;
use Pterodactyl\Services\Addons\AddonSourceRegistry;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/**
 * Lists the available versions of an addon. Backs the install-flow's
 * version-picker dropdown — the user can pick a specific release instead of
 * always getting "latest". One controller serves all three add-on types
 * (plugin / mod / modpack); the type is supplied via query string and gates
 * the per-type read permission.
 */
class AddonVersionsController extends ClientApiController
{
    private const TYPE_PERMISSIONS = [
        AddonSource::TYPE_PLUGIN => Permission::ACTION_ADDON_PLUGIN_READ,
        AddonSource::TYPE_MOD => Permission::ACTION_ADDON_MOD_READ,
        AddonSource::TYPE_MODPACK => Permission::ACTION_ADDON_MODPACK_READ,
    ];

    public function __construct(
        private AddonSourceRegistry $sources,
    ) {
        parent::__construct();
    }

    /**
     * GET /servers/{server}/addons/versions
     *   ?type=plugin|mod|modpack
     *   &source=modrinth|hangar|spigot|curseforge
     *   &external_id=<id>
     *   &game_version=1.21      (optional)
     *   &limit=20               (optional)
     */
    public function index(ClientApiRequest $request, Server $server): JsonResponse
    {
        $type = (string) $request->query('type', '');
        $sourceSlug = (string) $request->query('source', '');
        $externalId = (string) $request->query('external_id', '');
        $gameVersion = $request->query('game_version') ? (string) $request->query('game_version') : null;
        $limit = (int) $request->query('limit', 20);

        if (!isset(self::TYPE_PERMISSIONS[$type])) {
            throw new BadRequestHttpException("Invalid add-on type: {$type}");
        }
        if ($sourceSlug === '' || $externalId === '') {
            throw new BadRequestHttpException('source and external_id are required.');
        }

        $this->ensurePermission($request, $server, self::TYPE_PERMISSIONS[$type]);

        $source = $this->sources->get($sourceSlug);
        if (!$source->available() || !$source->supports($type) || !$source->availableFor($server)) {
            return new JsonResponse(['data' => []]);
        }

        return new JsonResponse([
            'data' => $source->listVersions($type, $externalId, $gameVersion, $limit, $server),
        ]);
    }

    private function ensurePermission(ClientApiRequest $request, Server $server, string $permission): void
    {
        if (!$request->user()->can($permission, $server)) {
            abort(403, 'You do not have permission to perform this action on this server.');
        }
    }
}
