<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Services\Addons\SlotSources\SlotSourceException;
use Pterodactyl\Services\Addons\SlotSources\SlotSourceResolver;
use Pterodactyl\Services\Addons\SlotSources\SlotState;

/**
 * Unified Slot Manager endpoint. Backend strategy is picked per-server by
 * {@see SlotSourceResolver}, which consults `AddonGameRegistry` to map the
 * server's game → {@see \Pterodactyl\Services\Addons\SlotSources\SlotSource}
 * (egg-variable / properties-file / ini-file).
 *
 * JSON shape returned to the frontend is unchanged — `env_variable` still
 * holds the under-stepper label (env-var name on the env_var strategy, or
 * a `file:key`-style descriptor for file strategies) so SlotManagerCard
 * doesn't need any rebuild.
 */
class SlotConfigController extends ClientApiController
{
    public function __construct(private readonly SlotSourceResolver $resolver)
    {
        parent::__construct();
    }

    public function show(Request $request, Server $server): array
    {
        return ['data' => $this->buildPayload($server)];
    }

    public function update(Request $request, Server $server): array
    {
        $data = $request->validate([
            'value' => 'required|integer|min:0|max:100000',
        ]);

        if ($this->isExcludedByNest($server)) {
            abort(403, 'Slot editing is disabled for this server type.');
        }

        $source = $this->resolver->forServer($server);
        $before = $source->read($server);

        try {
            $after = $source->write($server, (int) $data['value']);
        } catch (SlotSourceException $e) {
            abort($e->status, $e->getMessage());
        }

        Activity::event('server:startup.edit')
            ->subject($server)
            ->property([
                'source' => $after->sourceLabel,
                'old' => $before?->value,
                'new' => $after->value,
            ])
            ->log();

        return ['data' => $this->payloadFromState($server, $after)];
    }

    private function buildPayload(Server $server): array
    {
        $excluded = $this->isExcludedByNest($server);
        if ($excluded) {
            return [
                'nest_id' => (int) $server->nest_id,
                'excluded_by_nest' => true,
                'env_variable' => null,
                'variable_name' => null,
                'current_value' => null,
                'min' => 1,
                'max' => 999,
                'editable' => false,
                'reason' => 'Slot editing is disabled for this server type.',
            ];
        }

        $source = $this->resolver->forServer($server);
        $state = $source->read($server);

        if ($state === null) {
            return [
                'nest_id' => (int) $server->nest_id,
                'excluded_by_nest' => false,
                'env_variable' => null,
                'variable_name' => null,
                'current_value' => null,
                'min' => 1,
                'max' => 999,
                'editable' => false,
                'reason' => 'This server type does not expose a slot source.',
            ];
        }

        return $this->payloadFromState($server, $state);
    }

    private function payloadFromState(Server $server, SlotState $state): array
    {
        return [
            'nest_id' => (int) $server->nest_id,
            'excluded_by_nest' => false,
            'env_variable' => $state->sourceLabel,
            'variable_name' => $state->variableName,
            'current_value' => $state->value,
            'min' => $state->min,
            'max' => $state->max,
            'editable' => $state->userEditable,
            'reason' => $state->lockedReason,
        ];
    }

    private function isExcludedByNest(Server $server): bool
    {
        // The setting may arrive as an array (from config/gynx.php's env-var
        // bootstrap) OR as a comma-separated string (when an admin saves the
        // setting from the admin panel — SettingsServiceProvider overwrites
        // the config key with the raw DB string). Normalize both shapes.
        $raw = config('gynx.slot_manager.excluded_nests', []);
        $excluded = is_array($raw)
            ? array_map('intval', $raw)
            : array_values(array_filter(array_map('intval', explode(',', (string) $raw))));

        return in_array((int) $server->nest_id, $excluded, true);
    }
}
