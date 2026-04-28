import http from '@/api/http';
import { PluginSourceInfo, PluginSourceSlug } from '@/api/server/plugins';
import { InstalledModpack, ModpackSearchHit } from './types';

export const listModpackSources = async (uuid: string): Promise<PluginSourceInfo[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/addons/modpacks/sources`);
    return (data?.data ?? []) as PluginSourceInfo[];
};

export const searchModpacks = async (
    uuid: string,
    source: PluginSourceSlug,
    query: string,
    gameVersion?: string,
    page?: number,
): Promise<ModpackSearchHit[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/addons/modpacks/search`, {
        params: { source, q: query, game_version: gameVersion, page },
    });
    return (data?.data ?? []) as ModpackSearchHit[];
};

export const listInstalledModpacks = async (uuid: string): Promise<InstalledModpack[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/addons/modpacks`);
    return (data?.data ?? []) as InstalledModpack[];
};

export const installModpack = async (
    uuid: string,
    body: { source: PluginSourceSlug; external_id: string; version_id?: string; game_version?: string },
) => {
    const { data } = await http.post(`/api/client/servers/${uuid}/addons/modpacks/install`, body);
    return data?.data;
};

export const extractInstalledModpack = async (uuid: string, id: number): Promise<InstalledModpack> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/addons/modpacks/${id}/extract`);
    return data?.data as InstalledModpack;
};

export const removeInstalledModpack = async (uuid: string, id: number): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/addons/modpacks/${id}`);
};

export * from './types';
