import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ServerContext } from '@/state/server';
import { Icon } from './Icon';
import getServerStartup from '@/api/swr/getServerStartup';
import updateStartupVariable from '@/api/server/updateStartupVariable';
import { ServerEggVariable } from '@/api/server/types';
import { httpErrorToHuman } from '@/api/http';

// Surface the server's "max players" startup variable as a +/- stepper
// in the right rail. Saving writes via the existing startup-variable
// endpoint, same path the legacy Startup page uses, so the two stay in
// sync. The change takes effect on the next restart — Wings rebuilds
// server.properties (or the equivalent) from env vars at boot.

// Env-var names we recognize as "max players" across our supported eggs.
// Order matters: first hit wins. Add new names here as we add games.
const SLOT_ENV_VARS = [
    'MAX_PLAYERS',
    'MAXPLAYERS',
    'SERVER_MAX_PLAYERS',
    'MAX_SLOTS',
    'SLOTS',
];

const findSlotVariable = (vars: ServerEggVariable[]): ServerEggVariable | null => {
    for (const env of SLOT_ENV_VARS) {
        const m = vars.find((v) => v.envVariable.toUpperCase() === env);
        if (m) return m;
    }
    // Last-ditch: match by friendly name. Some eggs label the variable
    // "Max Players" without ever exposing the env var to the user.
    return vars.find((v) => /max\s*(players|slots)/i.test(v.name)) ?? null;
};

const parseLimit = (rules: string[]): { min: number; max: number } => {
    let min = 1;
    let max = 999;
    for (const rule of rules) {
        const minMatch = rule.match(/^min:(\d+)$/i);
        if (minMatch) min = Math.max(min, parseInt(minMatch[1], 10));
        const maxMatch = rule.match(/^max:(\d+)$/i);
        if (maxMatch) max = Math.min(max, parseInt(maxMatch[1], 10));
        const betweenMatch = rule.match(/^between:(\d+),(\d+)$/i);
        if (betweenMatch) {
            min = Math.max(min, parseInt(betweenMatch[1], 10));
            max = Math.min(max, parseInt(betweenMatch[2], 10));
        }
    }
    return { min, max };
};

export const PlayerSlotsCard = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { data, error: swrError, mutate } = getServerStartup(uuid);

    const slotVar = useMemo(() => (data ? findSlotVariable(data.variables) : null), [data]);
    const limits = useMemo(() => (slotVar ? parseLimit(slotVar.rules) : { min: 1, max: 999 }), [slotVar]);

    const [draft, setDraft] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);

    // Sync local draft with the server-known value whenever the SWR result
    // changes. Without this the stepper would lock to the value at first
    // mount and never reflect outside changes (e.g. someone editing the
    // Startup page in another tab).
    useEffect(() => {
        if (!slotVar) return;
        const current = parseInt(slotVar.serverValue ?? slotVar.defaultValue ?? '0', 10);
        if (Number.isFinite(current)) setDraft(current);
    }, [slotVar?.serverValue, slotVar?.defaultValue]);

    if (swrError) {
        return (
            <div className={'panel rail-card'}>
                <div className={'rail-title'}>Player slots</div>
                <div style={{ fontSize: 12, color: '#f87171' }}>
                    {httpErrorToHuman(swrError)}
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className={'panel rail-card'}>
                <div className={'rail-title'}>Player slots</div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>loading…</div>
            </div>
        );
    }

    if (!slotVar || draft === null) {
        // No max-players-like variable on this egg (e.g. games without a
        // hard slot cap, or eggs we haven't taught yet). Render nothing
        // rather than a confusing empty card.
        return null;
    }

    const editable = slotVar.isEditable;
    const dirty = String(draft) !== (slotVar.serverValue ?? slotVar.defaultValue);

    const clamp = (n: number) => Math.max(limits.min, Math.min(limits.max, n));

    const onCommit = async () => {
        if (!dirty) return;
        setSaving(true);
        setError(null);
        try {
            await updateStartupVariable(uuid, slotVar.envVariable, String(draft));
            await mutate();
            setSavedAt(Date.now());
            window.setTimeout(() => setSavedAt((t) => (Date.now() - (t ?? 0) > 1500 ? null : t)), 1700);
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={'panel rail-card'}>
            <div className={'rail-title'}>
                <span>Player slots</span>
            </div>
            <div style={{
                fontSize: 11, color: 'var(--text-faint)',
                fontFamily: "'JetBrains Mono', monospace", marginTop: -4,
            }}>
                {slotVar.envVariable} · effective on next restart
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginTop: 10, marginBottom: 10,
            }}>
                <button
                    type={'button'}
                    className={'btn btn-sm'}
                    disabled={!editable || saving || draft <= limits.min}
                    onClick={() => setDraft((v) => (v === null ? v : clamp(v - 1)))}
                    style={{ width: 28, padding: 0, justifyContent: 'center' }}
                    aria-label={'Decrease'}
                >
                    <Icon name={'chevron-right'} size={11} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <input
                    type={'number'}
                    min={limits.min}
                    max={limits.max}
                    step={1}
                    value={draft}
                    disabled={!editable || saving}
                    onChange={(e) => {
                        const n = parseInt(e.currentTarget.value, 10);
                        if (Number.isFinite(n)) setDraft(clamp(n));
                    }}
                    style={{
                        flex: 1, textAlign: 'center',
                        background: 'var(--surface-2)', border: '1px solid var(--line-2)',
                        color: 'var(--text)', borderRadius: 6, padding: '6px 8px',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                        fontWeight: 600, height: 28,
                    }}
                />
                <button
                    type={'button'}
                    className={'btn btn-sm'}
                    disabled={!editable || saving || draft >= limits.max}
                    onClick={() => setDraft((v) => (v === null ? v : clamp(v + 1)))}
                    style={{ width: 28, padding: 0, justifyContent: 'center' }}
                    aria-label={'Increase'}
                >
                    <Icon name={'chevron-right'} size={11} />
                </button>
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                <span style={{
                    fontSize: 10, color: 'var(--text-faint)',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    range {limits.min}–{limits.max}
                </span>
                <div style={{ flex: 1 }} />
                <button
                    type={'button'}
                    className={dirty ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                    onClick={onCommit}
                    disabled={!editable || !dirty || saving}
                >
                    {saving
                        ? <><Icon name={'restart'} size={11} className={'spin'} />Saving</>
                        : savedAt && Date.now() - savedAt < 1700
                            ? <><Icon name={'check'} size={11} />Saved</>
                            : <><Icon name={'save'} size={11} />Save</>}
                </button>
            </div>

            {!editable && (
                <div style={{
                    fontSize: 10, color: 'var(--text-faint)', marginTop: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    locked by panel admin
                </div>
            )}

            {error && (
                <div style={{
                    fontSize: 11, color: '#f87171', marginTop: 8,
                }}>
                    {error}
                </div>
            )}
        </div>
    );
};

export default PlayerSlotsCard;
