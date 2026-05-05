import { PluginSourceSlug } from '@/api/server/plugins';

export interface ModpackSearchHit {
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
     * Optional auto-install hint mirrored from PluginSearchHit so the
     * shared installer UI can union all three hit types without
     * narrowing for the badge check. Modpack adapters don't populate
     * it today, so the badge stays absent on the modpacks tab.
     */
    installable?: boolean;
}

export interface InstalledModpack {
    id: number;
    source: PluginSourceSlug;
    externalId: string;
    slug: string | null;
    name: string;
    version: string | null;
    fileName: string;
    status: 'downloaded' | 'extracted' | 'failed';
    installedAt: string;
}
