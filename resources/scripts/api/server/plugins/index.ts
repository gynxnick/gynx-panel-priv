import http from '@/api/http';
import { InstalledPlugin, PluginSearchHit, PluginSourceInfo, PluginSourceSlug } from './types';

export const listPluginSources = async (uuid: string): Promise<PluginSourceInfo[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/addons/plugins/sources`);
    return (data?.data ?? []) as PluginSourceInfo[];
};

export const searchPlugins = async (
    uuid: string,
    source: PluginSourceSlug,
    query: string,
    gameVersion?: string,
    page?: number,
): Promise<PluginSearchHit[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/addons/plugins/search`, {
        params: { source, q: query, game_version: gameVersion, page },
    });
    return (data?.data ?? []) as PluginSearchHit[];
};

export const listInstalledPlugins = async (uuid: string): Promise<InstalledPlugin[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/addons/plugins`);
    return (data?.data ?? []) as InstalledPlugin[];
};

export const installPlugin = async (
    uuid: string,
    body: { source: PluginSourceSlug; external_id: string; version_id?: string; game_version?: string },
) => {
    // 3-min timeout (default axios is 20s). Spigot installs that route
    // through FlareSolverr boot Chromium + solve a CF challenge + stream
    // the file — comfortably 30–90s, occasionally longer on cold start.
    const { data } = await http.post(`/api/client/servers/${uuid}/addons/plugins/install`, body, {
        timeout: 180000,
    });
    return data?.data;
};

export const removeInstalledPlugin = async (uuid: string, id: number): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/addons/plugins/${id}`);
};

export * from './types';
