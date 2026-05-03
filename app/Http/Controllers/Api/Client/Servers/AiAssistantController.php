<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Ai\GynxAiService;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * gynx.ai diagnostic assistant — single endpoint that takes a question
 * (plus optional console/crash context) and returns the model's
 * response. Frontend gathers context (it's the side that already has
 * the WebSocket console buffer); backend does prompt assembly + the
 * provider call + activity logging.
 *
 * Rate-limited per server, per day. Exceeding the cap returns 429
 * rather than failing inside the provider — the frontend uses the
 * remaining-quota header to disable the button before the user clicks.
 */
class AiAssistantController extends ClientApiController
{
    public function __construct(private GynxAiService $service)
    {
        parent::__construct();
    }

    public function ask(Request $request, Server $server): JsonResponse
    {
        if (!config('services.gynx_ai.enabled', false)) {
            throw new HttpException(503, 'gynx.ai is disabled on this panel.');
        }

        if (!$this->service->provider()->available()) {
            throw new HttpException(503, 'gynx.ai is enabled but the provider is missing credentials.');
        }

        $payload = $request->validate([
            'question' => 'required|string|min:3|max:2000',
            'console' => 'nullable|string',
            'crash' => 'nullable|string',
        ]);

        // Per-server daily cap. Cache key carries the date so the count
        // resets at midnight (server time, which is fine — this isn't a
        // legal-grade quota, just a budget guardrail).
        $cap = (int) config('services.gynx_ai.daily_cap_per_server', 20);
        $cacheKey = sprintf('gynx_ai:srv:%d:%s', $server->id, date('Y-m-d'));
        $used = (int) Cache::get($cacheKey, 0);
        if ($used >= $cap) {
            throw new HttpException(
                429,
                "gynx.ai daily limit reached for this server ({$cap}/day). Try again tomorrow.",
            );
        }

        try {
            $result = $this->service->diagnose(
                $server,
                trim($payload['question']),
                (string) ($payload['console'] ?? ''),
                $payload['crash'] ?? null,
            );
        } catch (HttpException $e) {
            // Propagate provider-level HTTP errors (502/503) as-is so the
            // frontend can show a useful "AI is unreachable right now"
            // message rather than a generic 500.
            throw $e;
        } catch (\Throwable $e) {
            report($e);
            throw new HttpException(502, 'gynx.ai request failed: ' . $e->getMessage());
        }

        // Increment after success — failed calls shouldn't burn quota.
        // 24h TTL covers the cache key in case the day rolls over while
        // the entry is still live (a small over-count, fine in practice).
        Cache::put($cacheKey, $used + 1, now()->endOfDay());
        $remaining = max(0, $cap - ($used + 1));

        try {
            Activity::event('server:ai.ask')
                ->property('provider', $this->service->provider()->slug())
                ->property('tokens_in', $result['tokens_in'])
                ->property('tokens_out', $result['tokens_out'])
                ->log();
        } catch (\Throwable $e) {
            report($e);
        }

        return new JsonResponse([
            'data' => [
                'text' => $result['text'],
                'tokens_in' => $result['tokens_in'],
                'tokens_out' => $result['tokens_out'],
                'provider' => $this->service->provider()->slug(),
                'remaining_today' => $remaining,
                'daily_cap' => $cap,
            ],
        ]);
    }

    /**
     * Lightweight status probe so the frontend can decide whether to
     * render the AI card at all (instead of getting a 503 mid-click).
     */
    public function status(Request $request, Server $server): JsonResponse
    {
        $enabled = (bool) config('services.gynx_ai.enabled', false);
        $hasCredentials = $enabled && $this->service->provider()->available();
        $cap = (int) config('services.gynx_ai.daily_cap_per_server', 20);
        $used = (int) Cache::get(sprintf('gynx_ai:srv:%d:%s', $server->id, date('Y-m-d')), 0);

        return new JsonResponse([
            'data' => [
                'available' => $hasCredentials,
                'provider' => $hasCredentials ? $this->service->provider()->slug() : null,
                'remaining_today' => $hasCredentials ? max(0, $cap - $used) : 0,
                'daily_cap' => $cap,
            ],
        ]);
    }
}
