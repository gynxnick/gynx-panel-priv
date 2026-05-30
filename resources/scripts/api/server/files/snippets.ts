import http from '@/api/http';
import { ConfigFormat } from '@/components/server/configs/known-configs';

export interface ServerSnippet {
    id: number;
    name: string;
    pathHint: string | null;
    format: ConfigFormat | null;
    content: string;
    createdAt: string | null;
    updatedAt: string | null;
}

const fromJson = (s: any): ServerSnippet => ({
    id: s.id,
    name: s.name,
    pathHint: s.path_hint ?? null,
    format: (s.format ?? null) as ConfigFormat | null,
    content: s.content,
    createdAt: s.created_at ?? null,
    updatedAt: s.updated_at ?? null,
});

export interface ListOptions {
    path?: string;
    format?: ConfigFormat;
}

export const listSnippets = async (uuid: string, opts: ListOptions = {}): Promise<ServerSnippet[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/snippets`, {
        params: {
            path: opts.path,
            format: opts.format,
        },
    });
    return ((data?.data ?? []) as any[]).map(fromJson);
};

export interface CreateSnippetBody {
    name: string;
    path_hint?: string | null;
    format?: ConfigFormat | null;
    content: string;
}

export const createSnippet = async (uuid: string, body: CreateSnippetBody): Promise<ServerSnippet> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/snippets`, body);
    return fromJson(data?.data);
};

export const updateSnippet = async (
    uuid: string,
    id: number,
    body: Partial<CreateSnippetBody>,
): Promise<ServerSnippet> => {
    const { data } = await http.patch(`/api/client/servers/${uuid}/snippets/${id}`, body);
    return fromJson(data?.data);
};

export const deleteSnippet = async (uuid: string, id: number): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/snippets/${id}`);
};
