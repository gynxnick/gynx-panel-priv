import http from '@/api/http';

export interface SubdomainZone {
    id: number;
    label: string;
    domain: string;
}

export interface SubdomainRecord {
    id: number;
    hostname: string;
    recordType: 'A' | 'AAAA' | 'CNAME' | 'SRV';
    fqdn: string;
    zone: { id: number; label: string; domain: string } | null;
    createdAt: string | null;
}

export const listSubdomainZones = async (uuid: string): Promise<SubdomainZone[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/subdomains/zones`);
    return (data?.data ?? []) as SubdomainZone[];
};

export const listSubdomains = async (uuid: string): Promise<SubdomainRecord[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/subdomains`);
    return (data?.data ?? []) as SubdomainRecord[];
};

export const claimSubdomain = async (
    uuid: string,
    body: { zone_id: number; hostname: string },
): Promise<SubdomainRecord[]> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/subdomains`, body);
    return (data?.data ?? []) as SubdomainRecord[];
};

export const releaseSubdomain = async (uuid: string, recordId: number): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/subdomains/${recordId}`);
};
