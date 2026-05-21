<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers\Admin;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Servers\BuildModificationService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class ServerLimitsController extends ClientApiController
{
    public function __construct(private BuildModificationService $buildService)
    {
        parent::__construct();
    }

    public function show(Request $request, Server $server): array
    {
        $this->assertAdmin($request);

        return ['data' => $this->serialize($server)];
    }

    public function update(Request $request, Server $server): array
    {
        $this->assertAdmin($request);

        $data = $request->validate([
            'memory'           => 'sometimes|integer|min:0|max:1048576',
            'disk'             => 'sometimes|integer|min:0|max:10485760',
            'cpu'              => 'sometimes|integer|min:0|max:6400',
            'swap'             => 'sometimes|integer|min:-1|max:1048576',
            'io'               => 'sometimes|integer|min:10|max:1000',
            'allocation_limit' => 'sometimes|integer|min:0|max:128',
            'backup_limit'     => 'sometimes|integer|min:0|max:1024',
            'database_limit'   => 'sometimes|integer|min:0|max:128',
        ]);

        $updated = $this->buildService->handle($server, $data);

        return ['data' => $this->serialize($updated)];
    }

    private function assertAdmin(Request $request): void
    {
        abort_unless($request->user()->root_admin, 403, 'Administrator access required.');
    }

    private function serialize(Server $server): array
    {
        return [
            'memory'           => (int) $server->memory,
            'disk'             => (int) $server->disk,
            'cpu'              => (int) $server->cpu,
            'swap'             => (int) $server->swap,
            'io'               => (int) $server->io,
            'allocation_limit' => (int) ($server->allocation_limit ?? 0),
            'backup_limit'     => (int) ($server->backup_limit ?? 0),
            'database_limit'   => (int) ($server->database_limit ?? 0),
        ];
    }
}
