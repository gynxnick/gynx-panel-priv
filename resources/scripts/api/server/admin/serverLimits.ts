import http from '@/api/http';

export interface ServerLimits {
    memory: number;
    disk: number;
    cpu: number;
    swap: number;
    io: number;
    allocation_limit: number;
    backup_limit: number;
    database_limit: number;
}

export const getServerLimits = async (uuid: string): Promise<ServerLimits> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/admin/limits`);
    return data.data as ServerLimits;
};

export const updateServerLimits = async (
    uuid: string,
    patch: Partial<ServerLimits>,
): Promise<ServerLimits> => {
    const { data } = await http.patch(`/api/client/servers/${uuid}/admin/limits`, patch);
    return data.data as ServerLimits;
};
