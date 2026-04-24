<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PanelAlertDismissal extends Model
{
    public const RESOURCE_NAME = 'panel_alert_dismissal';

    protected $table = 'panel_alert_dismissals';

    public $timestamps = false;

    protected $guarded = ['id', 'dismissed_at'];

    protected $casts = [
        'alert_id' => 'integer',
        'user_id' => 'integer',
        'dismissed_at' => 'datetime',
    ];

    public static array $validationRules = [
        'alert_id' => 'required|integer|exists:panel_alerts,id',
        'user_id' => 'required|integer|exists:users,id',
    ];

    public function getRouteKeyName(): string
    {
        return 'id';
    }

    public function alert(): BelongsTo
    {
        return $this->belongsTo(PanelAlert::class, 'alert_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
