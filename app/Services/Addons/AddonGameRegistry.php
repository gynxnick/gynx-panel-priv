<?php

namespace Pterodactyl\Services\Addons;

use Illuminate\Database\QueryException;
use Pterodactyl\Models\Server;

/**
 * Maps a server's egg → the metadata adapters need to query their
 * upstreams for the right game. Lives in a single file so adding a new
 * game is one entry, not a sweep across every adapter.
 *
 * Today this is just CurseForge gameId + Thunderstore community slug,
 * but the shape is intentionally a free-form array per game so a future
 * Steam Workshop / mod.io adapter can slot in extra fields without
 * forcing every existing entry to grow.
 *
 * Pattern matching is naive on purpose: nest + egg name lower-cased,
 * substring contains. Pterodactyl egg names are stable enough and the
 * cost of a mismatch is "addon source temporarily unavailable", which
 * recovers as soon as the registry is updated.
 */
class AddonGameRegistry
{
    /**
     * @var array<string, array{
     *   patterns: array<int,string>,
     *   curseforge_id: ?int,
     *   thunderstore_community: ?string,
     *   supports: array<int,string>,
     * }>
     */
    private const GAMES = [
        'minecraft' => [
            'patterns' => ['minecraft', 'forge', 'fabric', 'paper', 'spigot', 'bukkit', 'purpur', 'bedrock', 'pocketmine'],
            'curseforge_id' => 432,
            'thunderstore_community' => null,
            'supports' => [AddonSource::TYPE_PLUGIN, AddonSource::TYPE_MOD, AddonSource::TYPE_MODPACK],
        ],
        'ark' => [
            'patterns' => ['ark'],
            'curseforge_id' => 83374,
            'thunderstore_community' => null,
            'supports' => [AddonSource::TYPE_MOD],
        ],
        'stardew_valley' => [
            'patterns' => ['stardew'],
            'curseforge_id' => 669,
            'thunderstore_community' => null,
            'supports' => [AddonSource::TYPE_MOD],
        ],
        '7_days_to_die' => [
            'patterns' => ['7 days', 'seven days', '7d2d'],
            'curseforge_id' => 1003,
            'thunderstore_community' => null,
            'supports' => [AddonSource::TYPE_MOD],
        ],
        'valheim' => [
            'patterns' => ['valheim'],
            'curseforge_id' => null,
            'thunderstore_community' => 'valheim',
            'supports' => [AddonSource::TYPE_MOD],
        ],
        'project_zomboid' => [
            'patterns' => ['zomboid'],
            'curseforge_id' => null,
            'thunderstore_community' => 'project-zomboid',
            'supports' => [AddonSource::TYPE_MOD],
        ],
        'v_rising' => [
            'patterns' => ['v rising', 'v-rising', 'vrising'],
            'curseforge_id' => null,
            'thunderstore_community' => 'v-rising',
            'supports' => [AddonSource::TYPE_MOD],
        ],
        'risk_of_rain_2' => [
            'patterns' => ['risk of rain', 'ror2'],
            'curseforge_id' => null,
            'thunderstore_community' => 'risk-of-rain-2',
            'supports' => [AddonSource::TYPE_MOD],
        ],
        'lethal_company' => [
            'patterns' => ['lethal company'],
            'curseforge_id' => null,
            'thunderstore_community' => 'lethal-company',
            'umod_game' => null,
            'supports' => [AddonSource::TYPE_MOD],
        ],
        'rust' => [
            'patterns' => ['rust'],
            'curseforge_id' => null,
            'thunderstore_community' => null,
            'umod_game' => 'rust',
            'supports' => [AddonSource::TYPE_MOD],
        ],
    ];

    /**
     * @return ?array{
     *   slug: string,
     *   curseforge_id: ?int,
     *   thunderstore_community: ?string,
     *   supports: array<int,string>,
     * }
     */
    public static function forServer(Server $server): ?array
    {
        $signals = self::extractSignals($server);
        if ($signals === null) return null;

        $games = self::all();

        // Pterodactyl egg-feature flags are a strong, registry-curated
        // game signal — the 'eula' feature is registered exclusively on
        // Minecraft eggs. Check this first because it doesn't depend on
        // the egg author's chosen display name.
        if (in_array('eula', $signals['features'], true) && isset($games['minecraft'])) {
            return self::pack('minecraft', $games);
        }

        // Docker image is the next-strongest signal: most MC eggs use
        // ghcr.io/pterodactyl/yolks:java_* — anything containing 'java'
        // in the image is reliably Minecraft.
        if (str_contains($signals['image'], 'java') && isset($games['minecraft'])) {
            return self::pack('minecraft', $games);
        }

        $haystack = $signals['haystack'];
        if ($haystack === '') return null;

        foreach ($games as $slug => $cfg) {
            foreach ($cfg['patterns'] as $pattern) {
                $needle = strtolower(trim((string) $pattern));
                if ($needle === '') continue;
                if (str_contains($haystack, $needle)) {
                    return self::pack($slug, $games);
                }
            }
        }

        return null;
    }

    /**
     * Extract the matchable signals from a server in one place. Reused
     * by forServer() and the admin-side diagnose endpoint.
     *
     * @return ?array{features:array<int,string>, image:string, haystack:string, egg_name:string, nest_name:string}
     */
    public static function extractSignals(Server $server): ?array
    {
        try {
            $egg = $server->egg;
            $eggName = strtolower((string) ($egg?->name ?? ''));
            $nestName = strtolower((string) ($egg?->nest?->name ?? ''));
            $rawFeatures = $egg?->features ?? null;
            $features = [];
            if (is_array($rawFeatures)) {
                $features = $rawFeatures;
            } elseif (is_string($rawFeatures) && $rawFeatures !== '') {
                $decoded = json_decode($rawFeatures, true);
                if (is_array($decoded)) $features = $decoded;
            }
            // Lower-case every feature so 'EULA' / 'Eula' / 'eula' all match.
            $features = array_map(fn ($f) => strtolower((string) $f), $features);
            $dockerImage = strtolower((string) ($server->image ?? ''));
        } catch (\Throwable $e) {
            return null;
        }

        return [
            'features' => $features,
            'image' => $dockerImage,
            'egg_name' => $eggName,
            'nest_name' => $nestName,
            'haystack' => trim($nestName . ' ' . $eggName . ' ' . $dockerImage),
        ];
    }

    /**
     * Resolved game catalogue — built-in entries merged with admin-side
     * customizations from the panel settings. Custom entries with a
     * built-in slug REPLACE the built-in (so admins can extend the
     * default Minecraft patterns by copying it + adding their own).
     *
     * @return array<string, array{
     *   patterns: array<int,string>,
     *   curseforge_id: ?int,
     *   thunderstore_community: ?string,
     *   supports: array<int,string>,
     * }>
     */
    public static function all(): array
    {
        return array_merge(self::GAMES, self::customGames());
    }

    /** Built-in catalogue (un-merged). Used by the admin UI for "default" rows. */
    public static function builtIn(): array
    {
        return self::GAMES;
    }

    /** Admin-supplied catalogue (un-merged). Used by the admin UI for "custom" rows. */
    public static function custom(): array
    {
        return self::customGames();
    }

    /**
     * Per-egg override for whether the Install tab should show. Admin
     * picks specific eggs via Settings → Addon Games → Per-egg overrides.
     *
     * Resolution rules in isInstallable():
     *  - If the override list is empty, fall back to pattern matching
     *    via forServer() (default behaviour, what we shipped first).
     *  - If non-empty, the list is the authoritative allowlist — only
     *    these egg IDs get the Install tab, everything else hides.
     *
     * @return array<int,int> egg IDs marked installable by the admin
     */
    public static function installableEggIds(): array
    {
        try {
            $repo = app(\Pterodactyl\Contracts\Repository\SettingsRepositoryInterface::class);
            $raw = $repo->get('settings::addon_install_egg_ids', null);
        } catch (\Throwable $e) {
            return [];
        }
        if (!is_string($raw) || $raw === '') return [];
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) return [];
        return array_values(array_filter(array_map('intval', $decoded)));
    }

    public static function saveInstallableEggIds(array $eggIds): void
    {
        $clean = array_values(array_unique(array_filter(array_map('intval', $eggIds))));
        $repo = app(\Pterodactyl\Contracts\Repository\SettingsRepositoryInterface::class);
        $repo->set('settings::addon_install_egg_ids', json_encode($clean));
    }

    /** Resolves whether a server should see the Install tab. */
    public static function isInstallable(Server $server): bool
    {
        $admin = self::installableEggIds();
        if (!empty($admin)) {
            return in_array((int) $server->egg_id, $admin, true);
        }
        // Fallback: pattern-match via the existing game registry.
        return self::forServer($server) !== null;
    }

    /**
     * Per-egg tab-visibility override. {egg_id: [tab_id, ...]} where the
     * tab IDs are HIDDEN for servers running that egg. Used to drop tabs
     * that don't make sense for a given game (e.g. Install + Game on a
     * Discord-bot egg).
     *
     * @return array<int, array<int,string>>
     */
    public static function hiddenTabsByEgg(): array
    {
        try {
            $repo = app(\Pterodactyl\Contracts\Repository\SettingsRepositoryInterface::class);
            $raw = $repo->get('settings::tab_overrides_by_egg', null);
        } catch (\Throwable $e) {
            return [];
        }
        if (!is_string($raw) || $raw === '') return [];
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) return [];

        $out = [];
        foreach ($decoded as $eggId => $tabIds) {
            $eggInt = (int) $eggId;
            if ($eggInt <= 0 || !is_array($tabIds)) continue;
            $clean = array_values(array_filter(array_map(fn ($t) => (string) $t, $tabIds)));
            if (!empty($clean)) $out[$eggInt] = $clean;
        }
        return $out;
    }

    public static function saveHiddenTabsByEgg(array $map): void
    {
        $clean = [];
        foreach ($map as $eggId => $tabIds) {
            $eggInt = (int) $eggId;
            if ($eggInt <= 0) continue;
            if (!is_array($tabIds)) continue;
            $tabs = array_values(array_unique(array_filter(array_map(fn ($t) => (string) $t, $tabIds))));
            if (!empty($tabs)) $clean[$eggInt] = $tabs;
        }
        $repo = app(\Pterodactyl\Contracts\Repository\SettingsRepositoryInterface::class);
        $repo->set('settings::tab_overrides_by_egg', json_encode($clean));
    }

    /** Hidden tab IDs for the server's current egg (empty when no override). */
    public static function hiddenTabsForServer(Server $server): array
    {
        $map = self::hiddenTabsByEgg();
        return $map[(int) $server->egg_id] ?? [];
    }

    /**
     * Addon types this server's game supports (plugin / mod / modpack).
     * Drives the per-type tab buttons on the install page — Rust shouldn't
     * see Plugins / Modpacks tabs since uMod only does mods.
     *
     * @return array<int,string>
     */
    public static function supportedAddonTypes(Server $server): array
    {
        $game = self::forServer($server);
        return $game['supports'] ?? [];
    }

    /** Persist a fresh custom catalogue. */
    public static function saveCustom(array $games): void
    {
        $repo = app(\Pterodactyl\Contracts\Repository\SettingsRepositoryInterface::class);
        $clean = [];
        foreach ($games as $slug => $cfg) {
            $slug = preg_replace('/[^a-z0-9_]/', '', strtolower((string) $slug));
            if ($slug === '') continue;
            $patterns = array_values(array_filter(array_map(fn ($p) => trim((string) $p), (array) ($cfg['patterns'] ?? []))));
            $supports = array_values(array_intersect((array) ($cfg['supports'] ?? []), [
                AddonSource::TYPE_PLUGIN, AddonSource::TYPE_MOD, AddonSource::TYPE_MODPACK,
            ]));
            $cf = $cfg['curseforge_id'] ?? null;
            $cf = ($cf === '' || $cf === null) ? null : (int) $cf;
            $ts = $cfg['thunderstore_community'] ?? null;
            $ts = ($ts === '' || $ts === null) ? null : (string) $ts;
            $um = $cfg['umod_game'] ?? null;
            $um = ($um === '' || $um === null) ? null : (string) $um;
            $clean[$slug] = [
                'patterns' => $patterns,
                'curseforge_id' => $cf,
                'thunderstore_community' => $ts,
                'umod_game' => $um,
                'supports' => $supports,
            ];
        }
        $repo->set('settings::addon_games:custom', json_encode($clean));
    }

    /** @return array<string, array{patterns:array, curseforge_id:?int, thunderstore_community:?string, supports:array}> */
    private static function customGames(): array
    {
        try {
            $repo = app(\Pterodactyl\Contracts\Repository\SettingsRepositoryInterface::class);
            $raw = $repo->get('settings::addon_games:custom', null);
        } catch (\Throwable $e) {
            // Container resolution / DB / settings table absence → just
            // pretend there are no customisations. Built-ins remain active.
            return [];
        }
        if (!is_string($raw) || $raw === '') return [];
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) return [];

        $out = [];
        foreach ($decoded as $slug => $cfg) {
            if (!is_array($cfg)) continue;
            $out[(string) $slug] = [
                'patterns' => is_array($cfg['patterns'] ?? null) ? $cfg['patterns'] : [],
                'curseforge_id' => isset($cfg['curseforge_id']) && $cfg['curseforge_id'] !== null ? (int) $cfg['curseforge_id'] : null,
                'thunderstore_community' => isset($cfg['thunderstore_community']) && $cfg['thunderstore_community'] !== ''
                    ? (string) $cfg['thunderstore_community']
                    : null,
                'umod_game' => isset($cfg['umod_game']) && $cfg['umod_game'] !== ''
                    ? (string) $cfg['umod_game']
                    : null,
                'supports' => is_array($cfg['supports'] ?? null) ? array_values($cfg['supports']) : [],
            ];
        }
        return $out;
    }

    /** @return array{slug:string, curseforge_id:?int, thunderstore_community:?string, umod_game:?string, supports:array<int,string>} */
    private static function pack(string $slug, array $games): array
    {
        $cfg = $games[$slug];
        return [
            'slug' => $slug,
            'curseforge_id' => $cfg['curseforge_id'] ?? null,
            'thunderstore_community' => $cfg['thunderstore_community'] ?? null,
            'umod_game' => $cfg['umod_game'] ?? null,
            'supports' => $cfg['supports'] ?? [],
        ];
    }

    /** Convenience: does this server's game declare support for $type? */
    public static function supports(Server $server, string $type): bool
    {
        $game = self::forServer($server);
        return $game !== null && in_array($type, $game['supports'], true);
    }
}
