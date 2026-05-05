export type PluginSourceSlug = 'modrinth' | 'hangar' | 'spigot' | 'curseforge';

export interface PluginSearchHit {
    external_id: string;
    slug: string;
    name: string;
    author: string;
    description: string;
    icon_url: string | null;
    downloads: number;
    latest_version: string | null;
    source: PluginSourceSlug;
    installed: boolean;
    /**
     * Whether this hit can be auto-installed end-to-end. False only on
     * Spigot when the resource is "external" (author hosts off-site)
     * or has malformed file metadata. Undefined means "yes" — used so
     * Modrinth/CurseForge/Hangar adapters don't have to populate it.
     */
    installable?: boolean;
}

export interface InstalledPlugin {
    id: number;
    source: PluginSourceSlug;
    externalId: string;
    slug: string | null;
    name: string;
    version: string | null;
    fileName: string;
    installedAt: string;
}

export interface PluginSourceInfo {
    slug: PluginSourceSlug;
    available: boolean;
}
