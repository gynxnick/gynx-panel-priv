<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Addons;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class InstallModRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_ADDON_MOD_INSTALL;
    }

    public function rules(): array
    {
        return [
            'source' => 'required|in:modrinth,hangar,spigot,curseforge',
            'external_id' => 'required|string|max:100',
            'version_id' => 'nullable|string|max:100',
            'game_version' => 'nullable|string|max:30',
        ];
    }
}
