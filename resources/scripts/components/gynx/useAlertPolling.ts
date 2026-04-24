import { useEffect } from 'react';
import { useStoreActions, useStoreState } from '@/state/hooks';

const STORAGE_KEY = (uuid: string) => `gynx:alerts:dismissed:${uuid}`;
const POLL_MS = 60_000;

/**
 * Hydrates dismissed-alert ids from localStorage and polls the active
 * alerts endpoint every 60s. No-ops when no user is logged in (auth
 * pages don't mount the AppShell, so this is mostly defensive).
 */
export const useAlertPolling = () => {
    const userUuid = useStoreState((s) => s.user.data?.uuid);
    const fetchAlerts = useStoreActions((a) => a.alerts.fetch);
    const setDismissed = useStoreActions((a) => a.alerts.setDismissed);

    // Hydrate dismissed list from localStorage on user change.
    useEffect(() => {
        if (!userUuid) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY(userUuid));
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setDismissed(parsed.map(String));
            }
        } catch {
            /* ignore corrupt storage */
        }
    }, [userUuid, setDismissed]);

    // Poll.
    useEffect(() => {
        if (!userUuid) return;
        fetchAlerts();
        const id = window.setInterval(() => fetchAlerts(), POLL_MS);
        return () => window.clearInterval(id);
    }, [userUuid, fetchAlerts]);
};

/** Append an id to the user's persisted dismissal list. */
export const persistDismissal = (userUuid: string, id: string) => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY(userUuid));
        const ids: string[] = raw ? JSON.parse(raw) : [];
        if (!ids.includes(id)) {
            ids.push(id);
            localStorage.setItem(STORAGE_KEY(userUuid), JSON.stringify(ids));
        }
    } catch {
        /* ignore */
    }
};
