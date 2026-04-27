<?php

namespace Pterodactyl\Http\Middleware\Api\Client;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Pterodactyl\Services\Licensing\LicenseClientService;

/**
 * Soft license lockdown.
 *
 * Blocks /api/client/* requests when the panel's gynx.gg license is in an
 * 'invalid' state (key was rejected by the upstream — wrong product,
 * revoked, expired, exceeded its install cap, etc.).
 *
 * Deliberately does NOT block:
 *   - 'unlicensed'  — fresh install, admin hasn't entered a key yet. Block on
 *                     this would brick the panel before they can paste a key.
 *   - 'unreachable' — license server flake. We use cached state during outages
 *                     instead of locking everyone out for an upstream problem.
 *   - 'valid'       — obvious.
 *
 * Admin routes (/admin/*) aren't covered by this middleware — admins can
 * always reach Admin → License to fix the situation.
 *
 * The middleware also lazily refreshes the cache via refreshIfStale() so
 * status flips on gynx.gg propagate to the panel within an hour without a
 * cron job (one-hour TTL inside LicenseClientService).
 */
class RequireValidLicense
{
    public function __construct(
        private LicenseClientService $licenses,
    ) {
    }

    public function handle(Request $request, Closure $next)
    {
        $status = $this->licenses->refreshIfStale()['status'] ?? LicenseClientService::STATUS_UNLICENSED;

        if ($status === LicenseClientService::STATUS_INVALID) {
            return new JsonResponse([
                'errors' => [[
                    'code' => 'LicenseLockdownException',
                    'status' => '423',
                    'detail' => 'This panel\'s license is invalid. Ask the panel admin to resolve it in Admin → License before continuing.',
                    'meta' => [
                        'license_status' => $status,
                        'license_message' => $this->licenses->status()['message'] ?? null,
                    ],
                ]],
            ], 423);
        }

        return $next($request);
    }
}
