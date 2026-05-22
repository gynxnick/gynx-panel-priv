<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\EggVariable;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Repositories\Eloquent\ServerVariableRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class SlotConfigController extends ClientApiController
{
    // Env var names recognized as "max players" across our supported eggs.
    // Order matters: first hit wins. Add new names here as eggs are added.
    // Keep the frontend matcher list in sync if you change this.
    private const SLOT_ENV_VARS = [
        'MAX_PLAYERS',
        'MAXPLAYERS',
        'SERVER_MAX_PLAYERS',
        'MAX_SLOTS',
        'SLOTS',
    ];

    public function __construct(private ServerVariableRepository $repository)
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

        $variable = $this->findSlotVariable($server);
        if (!$variable) {
            abort(404, 'This server does not expose a slot variable.');
        }
        if (!$variable->user_editable) {
            abort(403, 'This slot variable is read-only.');
        }

        $original = $variable->server_value;
        $newValue = (string) $data['value'];

        // Revalidate against the egg variable's own rules so any per-egg
        // min/max/between constraints are enforced before the write.
        $this->validate($request, ['value' => $variable->rules]);

        $this->repository->updateOrCreate([
            'server_id' => $server->id,
            'variable_id' => $variable->id,
        ], [
            'variable_value' => $newValue,
        ]);

        Activity::event('server:startup.edit')
            ->subject($variable)
            ->property([
                'variable' => $variable->env_variable,
                'old' => $original,
                'new' => $newValue,
            ])
            ->log();

        // Refresh to return the post-write state.
        $server = $server->refresh();
        $server->loadMissing('variables');

        return ['data' => $this->buildPayload($server)];
    }

    private function buildPayload(Server $server): array
    {
        $excluded = $this->isExcludedByNest($server);
        $variable = $this->findSlotVariable($server);

        $min = 1;
        $max = 999;
        if ($variable) {
            [$min, $max] = $this->parseRange($variable->rules ?? '');
        }

        $current = null;
        if ($variable) {
            $raw = $variable->server_value ?? $variable->default_value ?? '0';
            $parsed = filter_var($raw, FILTER_VALIDATE_INT);
            $current = $parsed === false ? null : $parsed;
        }

        $reason = null;
        if ($excluded) {
            $reason = 'Slot editing is disabled for this server type.';
        } elseif (!$variable) {
            $reason = 'This server type does not expose a slot variable.';
        } elseif (!$variable->user_editable) {
            $reason = 'The slot variable is locked by the panel admin.';
        }

        return [
            'nest_id'          => (int) $server->nest_id,
            'excluded_by_nest' => $excluded,
            'env_variable'     => $variable?->env_variable,
            'variable_name'    => $variable?->name,
            'current_value'    => $current,
            'min'              => $min,
            'max'              => $max,
            'editable'         => $variable && $variable->user_editable && !$excluded,
            'reason'           => $reason,
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

    private function findSlotVariable(Server $server): ?EggVariable
    {
        $vars = $server->variables;

        foreach (self::SLOT_ENV_VARS as $env) {
            $match = $vars->first(fn (EggVariable $v) => strtoupper($v->env_variable) === $env);
            if ($match) {
                return $match;
            }
        }

        // Last-ditch: match by friendly name. Some eggs label the variable
        // "Max Players" without ever exposing a standard env var name.
        return $vars->first(fn (EggVariable $v) => preg_match('/max\s*(players|slots)/i', $v->name) === 1);
    }

    /**
     * Parse the egg variable's rules string into a (min, max) tuple. Falls
     * back to (1, 999) so the stepper always has sane bounds even when
     * the egg's variable doesn't declare them.
     *
     * @return array{0:int,1:int}
     */
    private function parseRange(string $rules): array
    {
        $min = 1;
        $max = 999;

        foreach (explode('|', $rules) as $rule) {
            if (preg_match('/^min:(\d+)$/i', $rule, $m)) {
                $min = max($min, (int) $m[1]);
            } elseif (preg_match('/^max:(\d+)$/i', $rule, $m)) {
                $max = min($max, (int) $m[1]);
            } elseif (preg_match('/^between:(\d+),(\d+)$/i', $rule, $m)) {
                $min = max($min, (int) $m[1]);
                $max = min($max, (int) $m[2]);
            }
        }

        return [$min, $max];
    }
}
