<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $scope  'panel' | 'node'
 * @property int|null $node_id
 * @property string $severity  'info' | 'warn' | 'maint' | 'critical'
 * @property string $title
 * @property string|null $body
 * @property string|null $link_url
 * @property \Carbon\Carbon|null $starts_at
 * @property \Carbon\Carbon|null $ends_at
 * @property bool $dismissible
 * @property int|null $created_by
 */
class PanelAlert extends Model
{
    public const RESOURCE_NAME = 'panel_alert';

    public const SCOPE_PANEL = 'panel';
    public const SCOPE_NODE = 'node';

    protected $table = 'panel_alerts';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $casts = [
        'node_id' => 'integer',
        'dismissible' => 'boolean',
        'created_by' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public static array $validationRules = [
        'scope' => 'required|in:panel,node',
        'node_id' => 'nullable|integer|exists:nodes,id',
        'severity' => 'required|in:info,warn,maint,critical',
        'title' => 'required|string|max:200',
        'body' => 'nullable|string|max:2000',
        'link_url' => 'nullable|url|max:2048',
        'starts_at' => 'nullable|date',
        'ends_at' => 'nullable|date|after_or_equal:starts_at',
        'dismissible' => 'required|boolean',
    ];

    public function getRouteKeyName(): string
    {
        return 'id';
    }

    public function node(): BelongsTo
    {
        return $this->belongsTo(Node::class);
    }

    public function dismissals(): HasMany
    {
        return $this->hasMany(PanelAlertDismissal::class, 'alert_id');
    }
}
