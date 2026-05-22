<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Pterodactyl\Models\Server;
use Pterodactyl\Transformers\Api\Client\ServerTransformer;
use Pterodactyl\Services\Servers\GetUserPermissionsService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\GetServerRequest;

class ServerController extends ClientApiController
{
    /**
     * ServerController constructor.
     */
    public function __construct(private GetUserPermissionsService $permissionsService)
    {
        parent::__construct();
    }

    /**
     * Transform an individual server into a response that can be consumed by a
     * client using the API.
     */
    public function index(GetServerRequest $request, Server $server): array
    {
        $user = $request->user();
        $isOwner = $user->id === $server->owner_id;
        $isSubuser = $server->subusers->contains('user_id', $user->id);

        // Admin "view as user" impersonation context. AuthenticateServerAccess
        // already lets root admins through to any server's client API — we
        // surface enough metadata here so the frontend can render the
        // ImpersonationBanner naming the actual owner. Owner email/username
        // are admin-only fields; we don't leak them on responses to the
        // server's actual owner or subusers.
        $meta = [
            'is_server_owner'  => $isOwner,
            'user_permissions' => $this->permissionsService->handle($server, $user),
        ];

        if ($user->root_admin && !$isOwner && !$isSubuser) {
            $owner = $server->user;
            $meta['is_impersonating_owner'] = true;
            $meta['owner_username'] = $owner?->username;
            $meta['owner_email'] = $owner?->email;
        }

        return $this->fractal->item($server)
            ->transformWith($this->getTransformer(ServerTransformer::class))
            ->addMeta($meta)
            ->toArray();
    }
}
