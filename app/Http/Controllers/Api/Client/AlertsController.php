<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Pterodactyl\Models\PanelAlert;
use Pterodactyl\Models\PanelAlertDismissal;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class AlertsController extends ClientApiController
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * GET /api/client/alerts/active
     *
     * Returns alerts that are currently in their active window. Node-
     * scoped alerts are only included when the requesting user owns at
     * least one server on that node. Client-side handles per-user
     * dismissal persistence against the ids we return.
     */
    public function active(ClientApiRequest $request): JsonResponse
    {
        $now = Carbon::now();

        $query = PanelAlert::query()
            ->where(function ($q) use ($now) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->orderByRaw("FIELD(severity, 'critical','maint','warn','info')")
            ->orderByDesc('created_at');

        $userNodes = $request->user()->root_admin
            ? null
            : $request->user()->accessibleServers()->pluck('node_id')->unique()->all();

        $alerts = $query->get()->filter(function (PanelAlert $a) use ($userNodes) {
            if ($a->scope === PanelAlert::SCOPE_PANEL) return true;
            if ($userNodes === null) return true;
            return $a->node_id !== null && in_array($a->node_id, $userNodes, true);
        })->values();

        return new JsonResponse([
            'data' => $alerts->map(fn (PanelAlert $a) => [
                'id' => (string) $a->id,
                'scope' => $a->scope,
                'node_id' => $a->node_id,
                'severity' => $a->severity,
                'title' => $a->title,
                'body' => $a->body,
                'link_url' => $a->link_url,
                'dismissible' => $a->dismissible,
                'created_at' => $a->created_at?->toIso8601String(),
            ])->all(),
        ]);
    }

    /**
     * POST /api/client/alerts/{alert}/dismiss
     */
    public function dismiss(ClientApiRequest $request, PanelAlert $alert): JsonResponse
    {
        if (!$alert->dismissible) {
            return new JsonResponse(['error' => 'alert is not dismissible'], Response::HTTP_BAD_REQUEST);
        }

        PanelAlertDismissal::query()->firstOrCreate([
            'alert_id' => $alert->id,
            'user_id' => $request->user()->id,
        ]);

        return new JsonResponse(['data' => ['dismissed_at' => Carbon::now()->toIso8601String()]]);
    }
}
