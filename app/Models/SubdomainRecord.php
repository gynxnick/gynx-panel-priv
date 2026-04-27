<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $server_id
 * @property int $zone_id
 * @property string $hostname
 * @property string $record_type
 * @property string $content
 * @property string $provider_record_id
 * @property array|null $meta
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 *
 * @property-read SubdomainZone $zone
 * @property-read Server $server
 */
class SubdomainRecord extends Model
{
    public const RESOURCE_NAME = 'subdomain_record';

    protected $table = 'subdomain_records';

    protected $guarded = ['id'];

    protected $casts = [
        'server_id' => 'integer',
        'zone_id' => 'integer',
        'meta' => 'array',
    ];

    public static array $validationRules = [
        'server_id' => 'required|integer|exists:servers,id',
        'zone_id' => 'required|integer|exists:subdomain_zones,id',
        'hostname' => 'required|string|max:63',
        'record_type' => 'required|in:A,AAAA,CNAME,SRV',
        'content' => 'required|string|max:255',
        'provider_record_id' => 'required|string|max:64',
    ];

    public function getRouteKeyName(): string
    {
        return 'id';
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(SubdomainZone::class, 'zone_id');
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'server_id');
    }

    /** Full hostname (e.g. "myserver.play.gynx.gg"). */
    public function fqdn(): string
    {
        return $this->hostname . '.' . ($this->zone->domain ?? '');
    }
}
