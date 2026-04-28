<?php

namespace Pterodactyl\Services\Addons;

/**
 * Interface every add-on source adapter (Modrinth / Hangar / Spigot /
 * CurseForge) implements. The services talk to this, never to concrete
 * HTTP APIs. Shared across plugins / mods / modpacks via the $type
 * parameter ('plugin' | 'mod' | 'modpack').
 */
interface AddonSource
{
    public const TYPE_PLUGIN = 'plugin';
    public const TYPE_MOD = 'mod';
    public const TYPE_MODPACK = 'modpack';

    /** Lowercase key matching AddonPlugin::SOURCE_* constants. */
    public function slug(): string;

    /** Whether this source is currently available (API key set, etc.). */
    public function available(): bool;

    /** Whether this source serves the given add-on type. */
    public function supports(string $type): bool;

    /**
     * Search the source for add-ons of the given type.
     *
     * @return array<int,array{
     *   external_id:string, slug:string, name:string, author:?string,
     *   description:?string, icon_url:?string, downloads:?int,
     *   latest_version:?string, source:string
     * }>
     */
    public function search(string $type, string $query, ?string $gameVersion = null, int $limit = 60): array;

    /**
     * @return array{url:string, file_name:string, file_hash:?string, version:string, version_id:string}
     */
    public function resolveDownload(string $type, string $externalId, ?string $versionId, ?string $gameVersion = null): array;

    /**
     * List the most recent versions of an add-on. Used by the install UI's
     * version picker. Sources that can't enumerate versions cheaply (Spigot
     * paid plugins, Hangar's resource model) may return [] — the UI degrades
     * to a "latest only" install, which is the existing default behaviour.
     *
     * @return array<int,array{
     *   version_id:string, version:string, game_versions:array<int,string>,
     *   loaders:array<int,string>, channel:?string, file_name:?string,
     *   downloads:?int, published_at:?string
     * }>
     */
    public function listVersions(string $type, string $externalId, ?string $gameVersion = null, int $limit = 20): array;
}
