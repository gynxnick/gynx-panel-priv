<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $key
 * @property string|null $label
 * @property string $status   'active' | 'revoked' | 'expired'
 * @property \Carbon\Carbon|null $expires_at
 * @property array|null $limits      e.g. ['max_servers' => 5]
 * @property array|null $features    e.g. ['addon_installer', 'subdomain']
 * @property int|null $issued_by
 * @property \Carbon\Carbon|null $last_used_at
 * @property int $use_count
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class LicenseKey extends Model
{
    public const RESOURCE_NAME = 'license_key';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_REVOKED = 'revoked';
    public const STATUS_EXPIRED = 'expired';

    protected $table = 'license_keys';

    protected $guarded = ['id'];

    protected $casts = [
        'expires_at' => 'datetime',
        'last_used_at' => 'datetime',
        'limits' => 'array',
        'features' => 'array',
        'use_count' => 'integer',
        'issued_by' => 'integer',
    ];

    public static array $validationRules = [
        'key' => 'required|string|max:64|unique:license_keys,key',
        'label' => 'nullable|string|max:120',
        'status' => 'required|in:active,revoked,expired',
        'expires_at' => 'nullable|date',
        'limits' => 'nullable|array',
        'features' => 'nullable|array',
        'issued_by' => 'nullable|integer|exists:users,id',
    ];

    public function getRouteKeyName(): string
    {
        return 'id';
    }

    public function usages(): HasMany
    {
        return $this->hasMany(LicenseKeyUsage::class, 'license_key_id');
    }

    public function isUsable(): bool
    {
        if ($this->status !== self::STATUS_ACTIVE) return false;
        if ($this->expires_at && $this->expires_at->isPast()) return false;
        return true;
    }

    public function hasFeature(string $name): bool
    {
        return in_array($name, $this->features ?? [], true);
    }

    public function limit(string $name, ?int $default = null): ?int
    {
        $val = $this->limits[$name] ?? null;
        return is_numeric($val) ? (int) $val : $default;
    }
}
