import { PluginSourceSlug } from '@/api/server/plugins';

export interface ModSearchHit {
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
}

export interface InstalledMod {
    id: number;
    source: PluginSourceSlug;
    externalId: string;
    slug: string | null;
    name: string;
    version: string | null;
    loader: string | null;
    fileName: string;
    installedAt: string;
}
