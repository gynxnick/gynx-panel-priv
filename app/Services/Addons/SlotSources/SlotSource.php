<?php

namespace Pterodactyl\Services\Addons\SlotSources;

use Pterodactyl\Models\Server;

/**
 * Strategy for "where does this server keep its player-slot count".
 *
 * Concrete implementations:
 *   - {@see EnvVarSlotSource}        — slots live in an egg variable (ARK, Rust, custom MC eggs)
 *   - {@see PropertiesFileSlotSource} — slots live in a Java-properties file (vanilla MC's server.properties)
 *   - {@see IniFileSlotSource}        — slots live in a `[Section] Key=Value` INI file (Palworld, some ARK setups)
 *
 * The controller never instantiates these directly — {@see SlotSourceResolver}
 * picks the right one from {@see \Pterodactyl\Services\Addons\AddonGameRegistry}'s
 * per-game declaration. Every method takes the {@see Server} so a single
 * resolver instance can serve many servers concurrently without holding
 * per-server state.
 */
interface SlotSource
{
    /**
     * Inspect the server's current state and produce a render-ready snapshot.
     * Returns null when the source is misconfigured for this server (e.g. the
     * declared file doesn't exist yet on a freshly-created server) — the
     * controller surfaces that as a friendly "not detected" message.
     */
    public function read(Server $server): ?SlotState;

    /**
     * Persist a new slot count. Throws a `SlotSourceException` on validation
     * failures (out of range, file unreadable, etc.) so the controller can
     * map it to the right HTTP status. Returns the post-write SlotState.
     */
    public function write(Server $server, int $value): SlotState;
}
