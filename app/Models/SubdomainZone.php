<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $label
 * @property string $domain
 * @property string $provider
 * @property string $provider_zone_id
 * @property string $provider_token
 * @property bool $enabled
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class SubdomainZone extends Model
{
    public const RESOURCE_NAME = 'subdomain_zone';
    public const PROVIDER_CLOUDFLARE = 'cloudflare';

    protected $table = 'subdomain_zones';

    protected $guarded = ['id'];

    protected $hidden = ['provider_token'];

    protected $casts = [
        'enabled' => 'boolean',
    ];

    public static array $validationRules = [
        'label' => 'required|string|max:100',
        'domain' => 'required|string|max:253',
        'provider' => 'required|in:cloudflare',
        'provider_zone_id' => 'required|string|max:64',
        'provider_token' => 'required|string|max:512',
        'enabled' => 'boolean',
    ];

    public function getRouteKeyName(): string
    {
        return 'id';
    }

    public function records(): HasMany
    {
        return $this->hasMany(SubdomainRecord::class, 'zone_id');
    }
}
