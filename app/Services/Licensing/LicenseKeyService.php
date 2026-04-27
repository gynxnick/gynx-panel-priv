<?php

namespace Pterodactyl\Services\Licensing;

use Illuminate\Database\ConnectionInterface;
use Pterodactyl\Models\LicenseKey;
use Pterodactyl\Models\LicenseKeyUsage;
use Pterodactyl\Models\User;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Single home for license-key generation, validation, and usage tracking.
 *
 * Validation flow expected by middleware:
 *   $key = $service->validate($keyString, scope: 'addon.install', request: $req);
 *   if ($key === null) → reject with 401/403
 *   if ($key->limit('max_servers') !== null && Server::count() >= $key->limit('max_servers')) → reject
 *
 * Usage logs are trimmed per key to USAGE_RING_BUFFER entries so the table
 * doesn't grow unbounded for hot keys. We keep the most recent N rows per
 * key, oldest dropped first.
 */
class LicenseKeyService
{
    /** Maximum usage rows we keep per key. Anything beyond is pruned in validate(). */
    public const USAGE_RING_BUFFER = 200;

    /** URL-safe alphabet for generated keys. Excludes ambiguous chars (0, O, l, I). */
    private const KEY_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function __construct(
        private ConnectionInterface $connection,
    ) {
    }

    public function generate(array $attributes, ?User $issuer = null): LicenseKey
    {
        $attributes['key'] = $this->newKeyString();
        $attributes['issued_by'] = $issuer?->id;
        $attributes['status'] ??= LicenseKey::STATUS_ACTIVE;

        return LicenseKey::query()->create($attributes);
    }

    public function revoke(LicenseKey $key): LicenseKey
    {
        $key->forceFill(['status' => LicenseKey::STATUS_REVOKED])->save();
        return $key;
    }

    public function reactivate(LicenseKey $key): LicenseKey
    {
        if ($key->expires_at && $key->expires_at->isPast()) {
            throw new ConflictHttpException('Key is past its expiry — extend the expiry date instead.');
        }
        $key->forceFill(['status' => LicenseKey::STATUS_ACTIVE])->save();
        return $key;
    }

    /**
     * Issue a brand-new key string and write it back. The DB cascade keeps
     * the existing usage history attached so admin can see the timeline
     * across the rotation.
     */
    public function rotate(LicenseKey $key): LicenseKey
    {
        $key->forceFill(['key' => $this->newKeyString()])->save();
        return $key;
    }

    /**
     * Validate a string against the keys table. Returns the active key on
     * success, null otherwise. Records a usage row either way so admins
     * can see rejected attempts in the audit log.
     *
     * @param array{ip?:?string, ua?:?string, scope?:?string} $context
     */
    public function validate(string $keyString, array $context = []): ?LicenseKey
    {
        $key = LicenseKey::query()->where('key', $keyString)->first();

        if (!$key) {
            // No matching key — record an anonymous miss against id=0 isn't
            // possible (FK), so we just bail. Admins can still see rejection
            // patterns in the panel's general activity log if they want.
            return null;
        }

        // Mark expired keys when first observed past their expiry — keeps
        // the admin list state accurate without a cron job.
        if ($key->status === LicenseKey::STATUS_ACTIVE && $key->expires_at && $key->expires_at->isPast()) {
            $key->forceFill(['status' => LicenseKey::STATUS_EXPIRED])->save();
        }

        $accepted = $key->isUsable();

        $this->recordUsage($key, $context, $accepted);

        return $accepted ? $key : null;
    }

    public function recordUsage(LicenseKey $key, array $context = [], bool $accepted = true): void
    {
        $this->connection->transaction(function () use ($key, $context, $accepted) {
            LicenseKeyUsage::query()->create([
                'license_key_id' => $key->id,
                'ip' => $context['ip'] ?? null,
                'user_agent' => isset($context['ua']) ? substr($context['ua'], 0, 255) : null,
                'scope' => $context['scope'] ?? null,
                'accepted' => $accepted,
            ]);

            if ($accepted) {
                $key->forceFill([
                    'last_used_at' => now(),
                    'use_count' => $key->use_count + 1,
                ])->save();
            }

            // Trim to ring buffer.
            $threshold = LicenseKeyUsage::query()
                ->where('license_key_id', $key->id)
                ->orderByDesc('id')
                ->offset(self::USAGE_RING_BUFFER)
                ->limit(1)
                ->value('id');

            if ($threshold) {
                LicenseKeyUsage::query()
                    ->where('license_key_id', $key->id)
                    ->where('id', '<=', $threshold)
                    ->delete();
            }
        });
    }

    /**
     * Generate a 32-char human-readable key string. Format: 4 groups of 8,
     * separated by hyphens, e.g. `xK3p9aQ2-rnTYbHd5-...`. URL-safe and
     * easy to copy/paste.
     */
    private function newKeyString(): string
    {
        $alpha = self::KEY_ALPHABET;
        $len = strlen($alpha);
        $groups = [];
        for ($g = 0; $g < 4; $g++) {
            $chunk = '';
            for ($i = 0; $i < 8; $i++) {
                $chunk .= $alpha[random_int(0, $len - 1)];
            }
            $groups[] = $chunk;
        }
        return implode('-', $groups);
    }

    public function findByKey(string $key): LicenseKey
    {
        $row = LicenseKey::query()->where('key', $key)->first();
        if (!$row) {
            throw new NotFoundHttpException('License key not found.');
        }
        return $row;
    }
}
