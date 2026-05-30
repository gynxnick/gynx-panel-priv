<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerSnippet;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

/**
 * Per-server "template" snippets used by the file editor's Templates
 * picker + Save-as-template button. Read gates on file.read; mutations
 * gate on file.update so the same audience that can edit configs can
 * manage their templates.
 *
 * Route param {snippet} is bound by id; the destroy/update methods
 * additionally check the snippet belongs to the requested server so a
 * subuser of server A can't manipulate server B's templates via id.
 */
class ServerSnippetsController extends ClientApiController
{
    public function index(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_FILE_READ);

        $query = ServerSnippet::query()->where('server_id', $server->id);

        // Optional client-side filters used by the Templates picker so it
        // only surfaces snippets that match the file the user has open.
        $format = $request->query('format');
        if (is_string($format) && $format !== '') {
            $query->where('format', $format);
        }
        $path = $request->query('path');
        if (is_string($path) && $path !== '') {
            // Exact-path or generic (NULL path_hint) snippets both qualify.
            $query->where(function ($q) use ($path) {
                $q->whereNull('path_hint')->orWhere('path_hint', $path);
            });
        }

        $snippets = $query
            ->orderByDesc('updated_at')
            ->limit(200)
            ->get();

        return new JsonResponse([
            'data' => $snippets->map(fn (ServerSnippet $s) => $this->shape($s))->values(),
        ]);
    }

    public function store(ClientApiRequest $request, Server $server): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_FILE_UPDATE);

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'path_hint' => 'nullable|string|max:512',
            'format' => 'nullable|string|in:yaml,json,properties,toml,ini,xml,plain',
            'content' => 'required|string|max:1048576', // 1 MiB hard cap
        ]);

        $snippet = ServerSnippet::create([
            'server_id' => $server->id,
            'name' => $data['name'],
            'path_hint' => $data['path_hint'] ?? null,
            'format' => $data['format'] ?? null,
            'content' => $data['content'],
        ]);

        return new JsonResponse(['data' => $this->shape($snippet)], 201);
    }

    public function update(ClientApiRequest $request, Server $server, ServerSnippet $snippet): JsonResponse
    {
        $this->ensurePermission($request, $server, Permission::ACTION_FILE_UPDATE);
        $this->ensureOwnership($server, $snippet);

        $data = $request->validate([
            'name' => 'sometimes|string|max:120',
            'path_hint' => 'sometimes|nullable|string|max:512',
            'format' => 'sometimes|nullable|string|in:yaml,json,properties,toml,ini,xml,plain',
            'content' => 'sometimes|string|max:1048576',
        ]);

        $snippet->fill($data)->save();

        return new JsonResponse(['data' => $this->shape($snippet->refresh())]);
    }

    public function destroy(ClientApiRequest $request, Server $server, ServerSnippet $snippet): Response
    {
        $this->ensurePermission($request, $server, Permission::ACTION_FILE_UPDATE);
        $this->ensureOwnership($server, $snippet);

        $snippet->delete();

        return new Response('', 204);
    }

    private function ensureOwnership(Server $server, ServerSnippet $snippet): void
    {
        if ($snippet->server_id !== $server->id) {
            abort(404, 'Template not found on this server.');
        }
    }

    private function shape(ServerSnippet $s): array
    {
        return [
            'id' => $s->id,
            'name' => $s->name,
            'path_hint' => $s->path_hint,
            'format' => $s->format,
            'content' => $s->content,
            'created_at' => optional($s->created_at)->toIso8601String(),
            'updated_at' => optional($s->updated_at)->toIso8601String(),
        ];
    }
}
