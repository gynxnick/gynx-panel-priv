<?php

namespace Pterodactyl\Http\Controllers\Admin\Settings;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Addons\AddonGameRegistry;
use Pterodactyl\Services\Addons\AddonSource;

/**
 * Admin UI for the addon-installer game registry. Lets panel owners
 * extend the built-in MC/ARK/Stardew/etc. patterns to cover servers
 * whose egg name doesn't match any default pattern, or to add support
 * for new games entirely.
 *
 * Storage is settings-backed JSON via AddonGameRegistry::saveCustom().
 * Custom rows with a built-in slug (e.g. 'minecraft') REPLACE the
 * built-in — admins extending Minecraft patterns should copy the
 * built-in row, add their pattern, and save.
 */
class AddonGamesController extends Controller
{
    public function __construct(
        private ViewFactory $view,
    ) {
    }

    public function index(): View
    {
        return $this->view->make('admin.settings.addon-games', [
            'builtIn' => AddonGameRegistry::builtIn(),
            'custom' => AddonGameRegistry::custom(),
            'addonTypes' => [
                AddonSource::TYPE_PLUGIN,
                AddonSource::TYPE_MOD,
                AddonSource::TYPE_MODPACK,
            ],
        ]);
    }

    /**
     * Replace the entire custom-games map with the posted payload.
     * Posting an empty map clears all customisations and leaves only
     * built-ins active.
     */
    public function update(Request $request): Response
    {
        $payload = $request->validate([
            'games' => 'array',
            'games.*.slug' => 'required|string|max:64',
            'games.*.patterns' => 'nullable|string|max:2000',
            'games.*.curseforge_id' => 'nullable|integer|min:1',
            'games.*.thunderstore_community' => 'nullable|string|max:120',
            'games.*.supports' => 'array',
            'games.*.supports.*' => 'string|in:plugin,mod,modpack',
        ]);

        $rows = $payload['games'] ?? [];
        $games = [];
        foreach ($rows as $row) {
            $patterns = array_values(array_filter(array_map(
                fn ($p) => trim($p),
                preg_split('/\r?\n/', (string) ($row['patterns'] ?? '')) ?: []
            )));
            $games[$row['slug']] = [
                'patterns' => $patterns,
                'curseforge_id' => $row['curseforge_id'] ?? null,
                'thunderstore_community' => $row['thunderstore_community'] ?? null,
                'supports' => $row['supports'] ?? [],
            ];
        }

        AddonGameRegistry::saveCustom($games);

        return response('', 204);
    }

    /**
     * Diagnose what game (if any) the registry would resolve for a
     * given server. Used by the "Test against this server" panel on
     * the admin form so admins can copy-paste the correct pattern
     * without first deploying + clicking around the panel.
     */
    public function diagnose(Request $request): Response
    {
        try {
            $payload = $request->validate([
                'server_uuid' => 'required|string|max:64',
            ]);

            $needle = trim((string) $payload['server_uuid']);

            // Length-aware lookup: uuid is the full 36-char dashed UUID,
            // uuidShort is char(8). Splitting the query avoids an
            // accidental char-truncation comparison on uuidShort when
            // the admin pastes the long form.
            $query = Server::query();
            if (strlen($needle) === 8) {
                $query->where('uuidShort', $needle);
            } else {
                $query->where('uuid', $needle);
            }
            $server = $query->first();

            if (!$server) {
                return response()->json(['error' => 'Server not found.'], 404);
            }

            // Eager-load egg+nest so extractSignals reads them off the
            // already-hydrated server rather than hitting the DB lazily
            // (which masks any relationship errors as the generic 500).
            $server->loadMissing('egg.nest');

            $signals = AddonGameRegistry::extractSignals($server);
            $resolved = AddonGameRegistry::forServer($server);

            return response()->json([
                'data' => [
                    'server' => [
                        'uuid' => $server->uuid,
                        'name' => $server->name,
                    ],
                    'signals' => $signals,
                    'resolved' => $resolved,
                ],
            ]);
        } catch (\Throwable $e) {
            // Admin-only endpoint — surface the real exception instead
            // of the generic 500 page so the operator can see what to fix.
            // Use Pterodactyl's standard errors[].detail shape so the
            // existing frontend showError() picks the message up.
            report($e);
            return response()->json([
                'errors' => [[
                    'code' => 'AddonGamesDiagnoseError',
                    'status' => '500',
                    'detail' => sprintf(
                        '[%s] %s @ %s:%d',
                        class_basename($e),
                        $e->getMessage() ?: '(no message)',
                        basename($e->getFile()),
                        $e->getLine(),
                    ),
                ]],
            ], 500);
        }
    }
}
