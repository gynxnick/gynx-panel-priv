<?php

namespace Pterodactyl\Services\Addons;

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
        $eggName = strtolower((string) optional($server->egg)->name);
        $nestName = strtolower((string) optional(optional($server->egg)->nest)->name);
        $haystack = trim($nestName . ' ' . $eggName);
        if ($haystack === '') return null;

        foreach (self::GAMES as $slug => $cfg) {
            foreach ($cfg['patterns'] as $pattern) {
                if (str_contains($haystack, $pattern)) {
                    return [
                        'slug' => $slug,
                        'curseforge_id' => $cfg['curseforge_id'],
                        'thunderstore_community' => $cfg['thunderstore_community'],
                        'supports' => $cfg['supports'],
                    ];
                }
            }
        }

        return null;
    }

    /** Convenience: does this server's game declare support for $type? */
    public static function supports(Server $server, string $type): bool
    {
        $game = self::forServer($server);
        return $game !== null && in_array($type, $game['supports'], true);
    }
}
