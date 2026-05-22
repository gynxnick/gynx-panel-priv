<?php

return [
    'slot_manager' => [
        // Nest IDs whose servers may NOT edit player slots from the
        // Slot Manager card. Servers in any of these nests see a locked
        // card with a reason. Configure via GYNX_SLOT_EXCLUDED_NESTS as
        // a comma-separated list (e.g. "3,5,7").
        // Stored as a STRING (not a pre-parsed array) so
        // SettingsServiceProvider's boot pass — which runs strtolower()
        // on every managed setting value — doesn't crash with
        // "strtolower(): Argument #1 must be of type string, array
        // given". The consumer (SlotConfigController::isExcludedByNest)
        // splits this string into an int[] at read time and tolerates
        // either shape.
        'excluded_nests' => (string) env('GYNX_SLOT_EXCLUDED_NESTS', ''),
    ],
];
