<?php

namespace Pterodactyl\Services\Addons\SlotSources;

/**
 * What the Slot Manager card needs to render and what `SlotConfigController`
 * returns over the wire. Built by every {@see SlotSource} so the controller
 * doesn't need to know whether the value came from an egg variable, a
 * `server.properties` line, or an INI key — they all produce the same shape.
 */
class SlotState
{
    public function __construct(
        /** Currently-applied slot count, or null when the source has no value yet. */
        public readonly ?int $value,
        public readonly int $min,
        public readonly int $max,
        /** Whether the user is allowed to edit this source for this server. */
        public readonly bool $userEditable,
        /**
         * Short human-readable identifier of where this lives — e.g.
         * `MAX_PLAYERS` for env vars or `server.properties:max-players`
         * for file-based ones. Displayed under the stepper.
         */
        public readonly string $sourceLabel,
        /** Optional friendly name (the egg variable's `name` field, when applicable). */
        public readonly ?string $variableName = null,
        /**
         * Set when the source is detected but not currently editable, so the
         * card can show a specific reason. null when editable.
         */
        public readonly ?string $lockedReason = null,
    ) {
    }
}
