<?php

namespace Pterodactyl\Services\Addons\SlotSources;

use Pterodactyl\Models\EggVariable;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Eloquent\ServerVariableRepository;

/**
 * Slot count lives in an egg variable on the panel — the original
 * implementation, kept as a strategy so eggs that DO expose a slot
 * variable (ARK, Rust, custom MC builds) still work via the registry.
 *
 * Configuration shape in the AddonGameRegistry game profile:
 *
 *     'slot_source' => [
 *         'type'  => 'env_var',
 *         'names' => ['MAX_PLAYERS', 'MAXPLAYERS', 'SERVER_MAX_PLAYERS', 'MAX_SLOTS', 'SLOTS'],
 *     ]
 *
 * `names` is the priority-ordered list of env-variable names to look for
 * on the server's egg. The first match wins. If none of the names match,
 * we fall back to matching by friendly variable name ("Max Players") so
 * one weird egg without a standard env var still gets picked up.
 */
class EnvVarSlotSource implements SlotSource
{
    /** Fallback list when the game profile doesn't declare its own. */
    public const DEFAULT_NAMES = [
        'MAX_PLAYERS',
        'MAXPLAYERS',
        'SERVER_MAX_PLAYERS',
        'MAX_SLOTS',
        'SLOTS',
    ];

    /** @param array<int,string> $names */
    public function __construct(
        private readonly ServerVariableRepository $repository,
        private readonly array $names = self::DEFAULT_NAMES,
    ) {
    }

    public function read(Server $server): ?SlotState
    {
        $variable = $this->findVariable($server);
        if (!$variable) {
            return null;
        }

        [$min, $max] = $this->parseRange($variable->rules ?? '');

        $raw = $variable->server_value ?? $variable->default_value ?? '0';
        $parsed = filter_var($raw, FILTER_VALIDATE_INT);
        $value = $parsed === false ? null : $parsed;

        return new SlotState(
            value: $value,
            min: $min,
            max: $max,
            userEditable: (bool) $variable->user_editable,
            sourceLabel: (string) $variable->env_variable,
            variableName: $variable->name,
            lockedReason: $variable->user_editable ? null : 'The slot variable is locked by the panel admin.',
        );
    }

    public function write(Server $server, int $value): SlotState
    {
        $variable = $this->findVariable($server);
        if (!$variable) {
            throw new SlotSourceException('This server does not expose a slot variable.', 404);
        }
        if (!$variable->user_editable) {
            throw new SlotSourceException('This slot variable is read-only.', 403);
        }

        [$min, $max] = $this->parseRange($variable->rules ?? '');
        if ($value < $min || $value > $max) {
            throw new SlotSourceException("Value must be between {$min} and {$max}.", 422);
        }

        $this->repository->updateOrCreate(
            [
                'server_id' => $server->id,
                'variable_id' => $variable->id,
            ],
            [
                'variable_value' => (string) $value,
            ],
        );

        // Refresh so the new server_value flows into the returned SlotState.
        $server->refresh()->loadMissing('variables');
        return $this->read($server) ?? new SlotState(
            value: $value,
            min: $min,
            max: $max,
            userEditable: true,
            sourceLabel: (string) $variable->env_variable,
            variableName: $variable->name,
        );
    }

    /**
     * Find the matching EggVariable on this server. Public-ish so the
     * legacy SlotConfigController shape (which reports `env_variable` and
     * the EggVariable's `id` for activity-log subject binding) can still
     * resolve the same record when needed.
     */
    public function findVariable(Server $server): ?EggVariable
    {
        $vars = $server->variables;

        foreach ($this->names as $env) {
            $needle = strtoupper((string) $env);
            $match = $vars->first(fn (EggVariable $v) => strtoupper($v->env_variable) === $needle);
            if ($match) {
                return $match;
            }
        }

        // Friendly-name fallback for eggs that label the variable
        // "Max Players" but use a weird env var name.
        return $vars->first(
            fn (EggVariable $v) => preg_match('/max\s*(players|slots)/i', $v->name) === 1,
        );
    }

    /** @return array{0:int,1:int} */
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
