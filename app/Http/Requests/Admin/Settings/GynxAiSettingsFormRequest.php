<?php

namespace Pterodactyl\Http\Requests\Admin\Settings;

use Pterodactyl\Http\Requests\Admin\AdminFormRequest;

class GynxAiSettingsFormRequest extends AdminFormRequest
{
    public function rules(): array
    {
        return [
            'services:gynx_ai:enabled' => 'required|in:true,false',
            'services:gynx_ai:provider' => 'required|string|in:gemini',
            'services:gynx_ai:gemini:api_key' => 'nullable|string|max:512',
            'services:gynx_ai:gemini:model' => 'required|string|max:128',
            'services:gynx_ai:daily_cap_per_server' => 'required|integer|min:0|max:1000',
        ];
    }

    public function attributes(): array
    {
        return [
            'services:gynx_ai:enabled' => 'Enable gynx.ai',
            'services:gynx_ai:provider' => 'Provider',
            'services:gynx_ai:gemini:api_key' => 'Gemini API Key',
            'services:gynx_ai:gemini:model' => 'Gemini Model',
            'services:gynx_ai:daily_cap_per_server' => 'Daily Cap (per server)',
        ];
    }
}
