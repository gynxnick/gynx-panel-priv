<?php

return [
    'slot_manager' => [
        // Nest IDs whose servers may NOT edit player slots from the
        // Slot Manager card. Servers in any of these nests see a locked
        // card with a reason. Configure via GYNX_SLOT_EXCLUDED_NESTS as
        // a comma-separated list (e.g. "3,5,7").
        'excluded_nests' => array_values(array_filter(array_map(
            'intval',
            explode(',', (string) env('GYNX_SLOT_EXCLUDED_NESTS', ''))
        ))),
    ],
];
