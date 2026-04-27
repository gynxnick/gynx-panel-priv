<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $license_key_id
 * @property string|null $ip
 * @property string|null $user_agent
 * @property string|null $scope
 * @property bool $accepted
 * @property \Carbon\Carbon $used_at
 */
class LicenseKeyUsage extends Model
{
    public const RESOURCE_NAME = 'license_key_usage';

    protected $table = 'license_key_usages';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected $casts = [
        'accepted' => 'boolean',
        'used_at' => 'datetime',
        'license_key_id' => 'integer',
    ];

    public function getRouteKeyName(): string
    {
        return 'id';
    }

    public function key(): BelongsTo
    {
        return $this->belongsTo(LicenseKey::class, 'license_key_id');
    }
}
