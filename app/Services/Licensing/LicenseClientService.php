<?php

namespace Pterodactyl\Services\Licensing;

use Carbon\Carbon;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\TransferException;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

/**
 * Client for the gynx.gg license validation API. Each panel install enters
 * its license key in admin → that key is POSTed to gynx.gg periodically;
 * the response is cached in the panel's settings table so we don't hit
 * the upstream on every page load.
 *
 * Contract (server at gynx.gg, see backend src/app/api/license/validate):
 *   POST {GYNX_LICENSE_API_URL}/validate     (default: https://gynx.gg/api/license)
 *   Body: { key, product: "gynx-panel", instanceId: "<panel hostname>" }
 *
 * Success (200):
 *   { ok: true, data: { valid: true, product, plan, maxServers,
 *                       boundCount, bound, expiresAt } }
 *
 * Failure (403):
 *   { ok: false, error: "Invalid license", details: { reason: <see below> } }
 *   reason ∈ { unknown_key | wrong_product | revoked | expired |
 *              server_limit_reached }
 *
 * Storage keys (settings::gynx:license:*):
 *   - key            the license string, set by admin
 *   - last_check     ISO8601 of the last successful validate call
 *   - status         one of 'unlicensed' | 'valid' | 'invalid' | 'unreachable'
 *   - plan           plan name returned by upstream
 *   - max_servers    integer (the cap upstream enforces)
 *   - bound_count    how many instances are currently bound to this key
 *   - expires_at     iso string from upstream (or empty)
 *   - reason         last upstream rejection reason (when status = invalid)
 *   - message        human-friendly status line for the admin UI
 */
class LicenseClientService
{
    public const STATUS_UNLICENSED = 'unlicensed';
    public const STATUS_VALID = 'valid';
    public const STATUS_INVALID = 'invalid';
    public const STATUS_UNREACHABLE = 'unreachable';

    /** Cache TTL — re-validate at most once per hour by default. */
    public const CACHE_TTL_SECONDS = 3600;

    public function __construct(
        private SettingsRepositoryInterface $settings,
    ) {
    }

    /** Stored license key, or '' when unset. */
    public function key(): string
    {
        return (string) $this->settings->get('settings::gynx:license:key', '');
    }

    public function setKey(string $key): void
    {
        $this->settings->set('settings::gynx:license:key', trim($key));
        // Force a fresh validation on next read so the admin doesn't need to
        // manually click Verify after pasting a key.
        $this->settings->set('settings::gynx:license:last_check', '');
    }

    public function clearKey(): void
    {
        foreach ([
            'key', 'last_check', 'plan', 'expires_at', 'reason', 'message',
            'max_servers', 'bound_count',
        ] as $sub) {
            $this->settings->set("settings::gynx:license:{$sub}", '');
        }
        $this->settings->set('settings::gynx:license:status', self::STATUS_UNLICENSED);
    }

    /**
     * Read the cached status. Use this in render-time checks (admin views,
     * lockdown banners, feature gates) to avoid hitting the upstream API.
     *
     * @return array{
     *   status:string, plan:?string, expires_at:?string,
     *   features:array<int,string>, message:?string, last_check:?string,
     *   key_present:bool,
     * }
     */
    public function status(): array
    {
        $key = $this->key();
        return [
            'status' => (string) $this->settings->get(
                'settings::gynx:license:status',
                $key === '' ? self::STATUS_UNLICENSED : self::STATUS_UNREACHABLE,
            ),
            'plan' => $this->stringOrNull('settings::gynx:license:plan'),
            'expires_at' => $this->stringOrNull('settings::gynx:license:expires_at'),
            'max_servers' => (int) $this->settings->get('settings::gynx:license:max_servers', 0),
            'bound_count' => (int) $this->settings->get('settings::gynx:license:bound_count', 0),
            'reason' => $this->stringOrNull('settings::gynx:license:reason'),
            'message' => $this->stringOrNull('settings::gynx:license:message'),
            'last_check' => $this->stringOrNull('settings::gynx:license:last_check'),
            'key_present' => $key !== '',
        ];
    }

    /**
     * Hit the upstream and update the cache. Safe to call from a cron, or
     * lazily from a request when the cache is stale.
     */
    public function validateNow(): array
    {
        $key = $this->key();
        if ($key === '') {
            $this->settings->set('settings::gynx:license:status', self::STATUS_UNLICENSED);
            return $this->status();
        }

        $endpoint = rtrim((string) env('GYNX_LICENSE_API_URL', 'https://gynx.gg/api/license'), '/');
        $http = new Client([
            'base_uri' => $endpoint . '/',
            'timeout' => 8,
            'http_errors' => false,  // we handle 403 manually below — it's an expected response, not an exception
            'headers' => [
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'User-Agent' => 'gynx-panel/1.0 (+https://gynx.gg)',
            ],
        ]);

        $instanceId = request()?->getHost() ?: gethostname() ?: 'unknown';

        try {
            $res = $http->post('validate', [
                'json' => [
                    'key' => $key,
                    'product' => 'gynx-panel',
                    'instanceId' => $instanceId,
                ],
            ]);
        } catch (TransferException $e) {
            $this->settings->set('settings::gynx:license:status', self::STATUS_UNREACHABLE);
            $this->settings->set('settings::gynx:license:message', 'Could not reach the license server: ' . $e->getMessage());
            $this->settings->set('settings::gynx:license:last_check', Carbon::now()->toIso8601String());
            Log::warning('gynx-panel license validation: transport failure', ['err' => $e->getMessage()]);
            return $this->status();
        }

        $code = $res->getStatusCode();
        $body = json_decode((string) $res->getBody(), true) ?: [];

        if ($code === 200 && ($body['ok'] ?? false)) {
            $data = $body['data'] ?? [];
            $this->settings->set('settings::gynx:license:status', self::STATUS_VALID);
            $this->settings->set('settings::gynx:license:plan', (string) ($data['plan'] ?? ''));
            $this->settings->set('settings::gynx:license:expires_at', (string) ($data['expiresAt'] ?? ''));
            $this->settings->set('settings::gynx:license:max_servers', (string) ($data['maxServers'] ?? 0));
            $this->settings->set('settings::gynx:license:bound_count', (string) ($data['boundCount'] ?? 0));
            $this->settings->set('settings::gynx:license:reason', '');
            $this->settings->set('settings::gynx:license:message', 'License OK — ' . ($data['plan'] ?? 'standard'));
        } elseif ($code === 403) {
            $reason = (string) ($body['details']['reason'] ?? 'invalid');
            $this->settings->set('settings::gynx:license:status', self::STATUS_INVALID);
            $this->settings->set('settings::gynx:license:reason', $reason);
            $this->settings->set('settings::gynx:license:message', $this->reasonHumanLabel($reason));
        } else {
            // 5xx or unexpected shape — treat as transport flake, don't lock down.
            $this->settings->set('settings::gynx:license:status', self::STATUS_UNREACHABLE);
            $this->settings->set('settings::gynx:license:message', "License server returned HTTP {$code}.");
            Log::warning('gynx-panel license validation: bad upstream response', ['status' => $code, 'body' => $body]);
        }

        $this->settings->set('settings::gynx:license:last_check', Carbon::now()->toIso8601String());
        return $this->status();
    }

    private function reasonHumanLabel(string $reason): string
    {
        return match ($reason) {
            'unknown_key' => 'License key not recognised. Double-check the value in Admin → License.',
            'wrong_product' => 'This key is for a different product (e.g. the Discord bot). Use a gynx-panel key.',
            'revoked' => 'This license has been revoked.',
            'expired' => 'This license has expired.',
            'server_limit_reached' => 'This license has reached its install cap. Contact gynx.gg to raise it.',
            default => 'License rejected: ' . $reason,
        };
    }

    /**
     * Lazy validate: only hits the upstream if the cache is older than TTL.
     * Suitable for per-request gating without flooding the API.
     */
    public function refreshIfStale(): array
    {
        $last = $this->stringOrNull('settings::gynx:license:last_check');
        if ($last) {
            try {
                $age = Carbon::parse($last)->diffInSeconds(Carbon::now());
                if ($age < self::CACHE_TTL_SECONDS) {
                    return $this->status();
                }
            } catch (\Throwable $e) {
                // bad timestamp — fall through to revalidate
            }
        }
        return $this->validateNow();
    }

    public function isValid(): bool
    {
        return ($this->status()['status'] ?? null) === self::STATUS_VALID;
    }

    private function stringOrNull(string $key): ?string
    {
        $v = $this->settings->get($key);
        return is_string($v) && $v !== '' ? $v : null;
    }
}
