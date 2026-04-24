import { Action, action, Thunk, thunk } from 'easy-peasy';
import http from '@/api/http';

export type AlertSeverity = 'info' | 'warn' | 'maint' | 'critical';

export interface PanelAlert {
    id: string;
    scope: 'panel' | 'node';
    severity: AlertSeverity;
    title: string;
    body: string | null;
    linkUrl: string | null;
    dismissible: boolean;
    createdAt: string;
}

export interface AlertsStore {
    items: PanelAlert[];
    dismissed: string[];
    loaded: boolean;
    setAlerts: Action<AlertsStore, PanelAlert[]>;
    setDismissed: Action<AlertsStore, string[]>;
    addDismissed: Action<AlertsStore, string>;
    fetch: Thunk<AlertsStore>;
}

const SEVERITIES: readonly AlertSeverity[] = ['info', 'warn', 'maint', 'critical'] as const;
const normalizeSeverity = (v: unknown): AlertSeverity =>
    SEVERITIES.includes(v as AlertSeverity) ? (v as AlertSeverity) : 'info';

const transform = (raw: any): PanelAlert => ({
    id: String(raw.id),
    scope: raw.scope === 'node' ? 'node' : 'panel',
    severity: normalizeSeverity(raw.severity),
    title: raw.title ?? '',
    body: raw.body ?? null,
    linkUrl: raw.link_url ?? null,
    dismissible: raw.dismissible !== false,
    createdAt: raw.created_at ?? new Date().toISOString(),
});

const alerts: AlertsStore = {
    items: [],
    dismissed: [],
    loaded: false,

    setAlerts: action((state, payload) => {
        state.items = payload;
        state.loaded = true;
    }),

    setDismissed: action((state, ids) => {
        state.dismissed = ids;
    }),

    addDismissed: action((state, id) => {
        if (!state.dismissed.includes(id)) state.dismissed.push(id);
    }),

    // Best-effort fetch: if the backend endpoint isn't implemented yet
    // (404), we settle into empty rather than surfacing an error — the
    // alert system is designed to "no-op" until the Laravel controller
    // ships. On transient network errors we keep the previous snapshot.
    fetch: thunk(async (actions) => {
        try {
            const { data } = await http.get('/api/client/alerts/active');
            const items = (data?.data ?? []).map(transform);
            actions.setAlerts(items);
        } catch (e: any) {
            if (e?.response?.status === 404) {
                actions.setAlerts([]);
            }
        }
    }),
};

export default alerts;
