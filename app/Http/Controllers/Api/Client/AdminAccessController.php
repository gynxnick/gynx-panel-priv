<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Pterodactyl\Facades\Activity;

/**
 * Backs the in-panel "view as user" admin switcher: search users and
 * list a chosen user's servers, so staff can jump straight into the
 * normal server dashboard for any account without leaving the panel.
 *
 * Both endpoints are hard-gated to root admins. Actually managing the
 * server still flows through the existing per-server authorization +
 * ImpersonationBanner; this controller only powers discovery.
 */
class AdminAccessController extends ClientApiController
{
    public function users(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $q = trim((string) $request->query('query', ''));
        if (mb_strlen($q) < 1) {
            return new JsonResponse(['data' => []]);
        }

        $users = User::query()
            ->where(function ($b) use ($q) {
                $b->where('username', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%")
                    ->orWhere('name_first', 'like', "%{$q}%")
                    ->orWhere('name_last', 'like', "%{$q}%");
                if (ctype_digit($q)) {
                    $b->orWhere('id', (int) $q);
                }
            })
            ->orderBy('username')
            ->limit(25)
            ->get();

        return new JsonResponse([
            'data' => $users->map(fn (User $u) => [
                'id' => $u->id,
                'username' => $u->username,
                'email' => $u->email,
                'name' => trim($u->name_first . ' ' . $u->name_last) ?: $u->username,
                'root_admin' => (bool) $u->root_admin,
            ])->values(),
        ]);
    }

    public function servers(Request $request, User $user): JsonResponse
    {
        $this->ensureAdmin($request);

        $servers = Server::query()
            ->where('owner_id', $user->id)
            ->orderBy('name')
            ->limit(250)
            ->get();

        try {
            Activity::event('admin:view-as.browse')
                ->property('target_user_id', $user->id)
                ->property('target_username', $user->username)
                ->log();
        } catch (\Throwable $e) {
            report($e);
        }

        return new JsonResponse([
            'data' => $servers->map(fn (Server $s) => [
                'uuid' => $s->uuid,
                'identifier' => $s->uuidShort,
                'name' => $s->name,
                'status' => $s->status,
            ])->values(),
            'meta' => [
                'user' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'email' => $user->email,
                ],
            ],
        ]);
    }

    private function ensureAdmin(Request $request): void
    {
        if (!$request->user() || !$request->user()->root_admin) {
            abort(403, 'This action requires administrator access.');
        }
    }
}
