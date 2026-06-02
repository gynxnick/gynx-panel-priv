<?php

namespace Pterodactyl\Services\Addons\SlotSources;

use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Eloquent\ServerVariableRepository;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Services\Addons\AddonGameRegistry;

/**
 * Picks the right {@see SlotSource} for a server based on its game profile.
 *
 * Resolution order:
 *   1. Game profile (via {@see AddonGameRegistry::forServer}) declares a
 *      `slot_source` spec → instantiate the matching strategy.
 *   2. No game match OR no `slot_source` on the profile → fall back to a
 *      stock {@see EnvVarSlotSource} with the default name list. That
 *      preserves the historical behaviour for any server the registry
 *      doesn't recognise.
 *
 * Strategies are instantiated per-call (cheap; each holds only a couple of
 * scalars), so the resolver itself is safe to register as a singleton.
 */
class SlotSourceResolver
{
    public function __construct(
        private readonly ServerVariableRepository $variables,
        private readonly DaemonFileRepository $files,
    ) {
    }

    public function forServer(Server $server): SlotSource
    {
        $spec = $this->specFor($server);

        if ($spec === null) {
            // Unrecognised game → keep the historical "look for MAX_PLAYERS-ish env var" path.
            return new EnvVarSlotSource($this->variables);
        }

        return match ($spec['type'] ?? null) {
            'env_var' => new EnvVarSlotSource(
                $this->variables,
                isset($spec['names']) && is_array($spec['names']) && !empty($spec['names'])
                    ? array_values($spec['names'])
                    : EnvVarSlotSource::DEFAULT_NAMES,
            ),
            'properties_file' => new PropertiesFileSlotSource(
                $this->files,
                (string) ($spec['path'] ?? '/server.properties'),
                (string) ($spec['key'] ?? 'max-players'),
                (int) ($spec['min'] ?? 1),
                (int) ($spec['max'] ?? 999),
            ),
            'ini_file' => new IniFileSlotSource(
                $this->files,
                (string) ($spec['path'] ?? ''),
                (string) ($spec['section'] ?? ''),
                (string) ($spec['key'] ?? ''),
                (int) ($spec['min'] ?? 1),
                (int) ($spec['max'] ?? 999),
            ),
            default => new EnvVarSlotSource($this->variables),
        };
    }

    /**
     * Pull the `slot_source` spec for this server's game out of the
     * registry, or null when the game isn't matched / doesn't declare one.
     *
     * @return ?array<string,mixed>
     */
    private function specFor(Server $server): ?array
    {
        try {
            $profile = AddonGameRegistry::forServer($server);
        } catch (\Throwable $e) {
            return null;
        }
        if ($profile === null) return null;

        $slug = $profile['slug'] ?? null;
        if (!is_string($slug) || $slug === '') return null;

        $games = AddonGameRegistry::all();
        $game = $games[$slug] ?? null;
        if (!is_array($game)) return null;

        $spec = $game['slot_source'] ?? null;
        return is_array($spec) ? $spec : null;
    }
}
