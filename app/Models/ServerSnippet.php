<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A reusable text snippet scoped to one server. Powers the editor's
 * "Save as template" + "Templates" picker — the user captures the
 * current buffer with a friendly name, optionally tagged with the
 * file's format and path so the picker can filter to relevant ones
 * when they open another file later.
 *
 * @property int $id
 * @property int $server_id
 * @property string $name
 * @property string|null $path_hint
 * @property string|null $format
 * @property string $content
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class ServerSnippet extends Model
{
    public const RESOURCE_NAME = 'server_snippet';

    protected $table = 'server_snippets';

    protected $guarded = ['id'];

    protected $casts = [
        'server_id' => 'integer',
    ];

    public static array $validationRules = [
        'server_id' => 'required|integer|exists:servers,id',
        'name' => 'required|string|max:120',
        'path_hint' => 'nullable|string|max:512',
        'format' => 'nullable|string|max:16|in:yaml,json,properties,toml,ini,xml,plain',
        'content' => 'required|string',
    ];

    public function getRouteKeyName(): string
    {
        return 'id';
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
