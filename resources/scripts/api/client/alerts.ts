import http from '@/api/http';

/**
 * Per-user dismissal. Best-effort — the local dismissal persists in
 * localStorage regardless, so swallowing the error here keeps the UI
 * responsive when the backend endpoint isn't deployed yet.
 */
export const dismissAlert = async (id: string): Promise<void> => {
    try {
        await http.post(`/api/client/alerts/${id}/dismiss`);
    } catch {
        /* intentionally silent */
    }
};
