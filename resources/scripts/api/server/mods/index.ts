import http from '@/api/http';
import { PluginSourceInfo, PluginSourceSlug } from '@/api/server/plugins';
import { InstalledMod, ModSearchHit } from './types';

export const listModSources = async (uuid: string): Promise<PluginSourceInfo[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/addons/mods/sources`);
    return (data?.data ?? []) as PluginSourceInfo[];
};

export const searchMods = async (
    uuid: string,
    source: PluginSourceSlug,
    query: string,
    gameVersion?: string,
    page?: number,
): Promise<ModSearchHit[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/addons/mods/search`, {
        params: { source, q: query, game_version: gameVersion, page },
    });
    return (data?.data ?? []) as ModSearchHit[];
};

export const listInstalledMods = async (uuid: string): Promise<InstalledMod[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/addons/mods`);
    return (data?.data ?? []) as InstalledMod[];
};

export const installMod = async (
    uuid: string,
    body: { source: PluginSourceSlug; external_id: string; version_id?: string; game_version?: string },
) => {
    const { data } = await http.post(`/api/client/servers/${uuid}/addons/mods/install`, body);
    return data?.data;
};

export const removeInstalledMod = async (uuid: string, id: number): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/addons/mods/${id}`);
};

export * from './types';
