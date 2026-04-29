import http from '@/api/http';

export interface AiStatus {
    available: boolean;
    provider: string | null;
    remainingToday: number;
    dailyCap: number;
}

export interface AiAnswer {
    text: string;
    tokensIn: number;
    tokensOut: number;
    provider: string;
    remainingToday: number;
    dailyCap: number;
}

export const getAiStatus = async (uuid: string): Promise<AiStatus> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/ai/status`);
    const d = data?.data ?? {};
    return {
        available: !!d.available,
        provider: d.provider ?? null,
        remainingToday: Number(d.remaining_today ?? 0),
        dailyCap: Number(d.daily_cap ?? 0),
    };
};

export const askAi = async (
    uuid: string,
    body: { question: string; console?: string; crash?: string },
): Promise<AiAnswer> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/ai/ask`, body);
    const d = data?.data ?? {};
    return {
        text: String(d.text ?? ''),
        tokensIn: Number(d.tokens_in ?? 0),
        tokensOut: Number(d.tokens_out ?? 0),
        provider: String(d.provider ?? ''),
        remainingToday: Number(d.remaining_today ?? 0),
        dailyCap: Number(d.daily_cap ?? 0),
    };
};
