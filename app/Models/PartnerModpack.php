<?php

namespace Pterodactyl\Models;

/**
 * An admin-curated, featured modpack shown at the top of the in-panel
 * installer. It is a presentation-rich pointer at the existing modpack
 * install pipeline: (source, external_id, version_id, game_version) are
 * fed straight into ModpackInstallerService when a user clicks install.
 *
 * @property int $id
 * @property string $title
 * @property string|null $summary
 * @property string|null $banner_url
 * @property string $source        'modrinth' | 'curseforge'
 * @property string $external_id
 * @property string|null $version_id
 * @property string|null $game_version
 * @property string|null $accent    optional card accent hex
 * @property int $sort_order
 * @property bool $is_visible
 * @property bool $is_featured
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PartnerModpack extends Model
{
    public const RESOURCE_NAME = 'partner_modpack';

    protected $table = 'partner_modpacks';

    protected $guarded = ['id'];

    protected $casts = [
        'sort_order' => 'integer',
        'is_visible' => 'boolean',
        'is_featured' => 'boolean',
    ];

    public static array $validationRules = [
        'title' => 'required|string|max:120',
        'summary' => 'nullable|string|max:500',
        'banner_url' => 'nullable|url|max:2048',
        'source' => 'required|in:modrinth,curseforge',
        'external_id' => 'required|string|max:191',
        'version_id' => 'nullable|string|max:191',
        'game_version' => 'nullable|string|max:64',
        'accent' => 'nullable|string|max:9',
        'sort_order' => 'nullable|integer|min:0|max:9999',
        'is_visible' => 'sometimes|boolean',
        'is_featured' => 'sometimes|boolean',
    ];

    public function getRouteKeyName(): string
    {
        return 'id';
    }
}
