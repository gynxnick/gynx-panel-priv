import http from '@/api/http';

export interface AdminUser {
    id: number;
    username: string;
    email: string;
    name: string;
    rootAdmin: boolean;
}

export interface AdminUserServer {
    uuid: string;
    identifier: string;
    name: string;
    status: string | null;
}

export const searchAdminUsers = async (query: string): Promise<AdminUser[]> => {
    const { data } = await http.get('/api/client/admin/users', { params: { query } });
    return ((data?.data ?? []) as any[]).map(
        (u): AdminUser => ({
            id: u.id,
            username: u.username,
            email: u.email,
            name: u.name,
            rootAdmin: Boolean(u.root_admin),
        }),
    );
};

export const getAdminUserServers = async (userId: number): Promise<AdminUserServer[]> => {
    const { data } = await http.get(`/api/client/admin/users/${userId}/servers`);
    return ((data?.data ?? []) as any[]).map(
        (s): AdminUserServer => ({
            uuid: s.uuid,
            identifier: s.identifier,
            name: s.name,
            status: s.status ?? null,
        }),
    );
};
