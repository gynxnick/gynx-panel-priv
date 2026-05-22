import * as React from 'react';
import { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { Icon } from './Icon';
import { getSlotConfig, updateSlotConfig, SlotConfig } from '@/api/server/slotConfig';
import { httpErrorToHuman } from '@/api/http';

// Universal player-slot editor. Always renders so the right rail layout
// stays consistent across eggs; the actual editability is driven by the
// backend /slot-config endpoint, which respects:
//   - config('gynx.slot_manager.excluded_nests') — nest-level kill switch
//   - the egg's own user_editable flag on the slot variable
//   - per-egg min/max/between rules
//
// When the server type doesn't expose a slot variable, the card renders
// a neutral "not applicable" state instead of returning null, so the
// admin can see at a glance that the feature is unavailable here.

export const SlotManagerCard = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);

    const [config, setConfig] = useState<SlotConfig | null>(null);
    const [draft, setDraft] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        getSlotConfig(uuid)
            .then((c) => {
                if (!alive) return;
                setConfig(c);
                setDraft(c.current_value);
            })
            .catch((e) => alive && setError(httpErrorToHuman(e as Error)))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [uuid]);

    const renderShell = (body: React.ReactNode) => (
        <div className={'panel rail-card'}>
            <div className={'rail-title'} style={{
                display: 'flex', alignItems: 'center', gap: 6,
            }}>
                <Icon name={'users'} size={12} color={'var(--purple)'} />
                <span>Slot Manager</span>
            </div>
            {body}
        </div>
    );

    if (loading) {
        return renderShell(
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>loading…</div>
        );
    }

    if (error && !config) {
        return renderShell(
            <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>
        );
    }

    if (!config) return renderShell(null);

    const clamp = (n: number) => Math.max(config.min, Math.min(config.max, n));
    const canEdit = config.editable;
    const dirty = draft !== null && config.current_value !== null && draft !== config.current_value;

    const onCommit = async () => {
        if (!dirty || draft === null) return;
        setSaving(true);
        setError(null);
        try {
            const next = await updateSlotConfig(uuid, draft);
            setConfig(next);
            setDraft(next.current_value);
            setSavedAt(Date.now());
            window.setTimeout(
                () => setSavedAt((t) => (t && Date.now() - t > 1500 ? null : t)),
                1700,
            );
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setSaving(false);
        }
    };

    return renderShell(
        <>
            <div style={{
                fontSize: 11, color: 'var(--text-faint)',
                fontFamily: "'JetBrains Mono', monospace", marginTop: -4, marginBottom: 10,
            }}>
                {config.env_variable
                    ? `${config.env_variable} · effective on next restart`
                    : 'slot variable not detected for this egg'}
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            }}>
                <button
                    type={'button'}
                    className={'btn btn-sm'}
                    disabled={!canEdit || saving || draft === null || draft <= config.min}
                    onClick={() => setDraft((v) => (v === null ? v : clamp(v - 1)))}
                    style={{ width: 28, padding: 0, justifyContent: 'center' }}
                    aria-label={'Decrease slots'}
                >
                    <Icon name={'chevron-right'} size={11} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <input
                    type={'number'}
                    min={config.min}
                    max={config.max}
                    step={1}
                    value={draft ?? ''}
                    disabled={!canEdit || saving}
                    placeholder={'—'}
                    onChange={(e) => {
                        const n = parseInt(e.currentTarget.value, 10);
                        if (Number.isFinite(n)) setDraft(clamp(n));
                    }}
                    style={{
                        flex: 1, textAlign: 'center',
                        background: 'var(--surface-2)', border: '1px solid var(--line-2)',
                        color: 'var(--text)', borderRadius: 6, padding: '6px 8px',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 16,
                        fontWeight: 700, height: 32,
                    }}
                />
                <button
                    type={'button'}
                    className={'btn btn-sm'}
                    disabled={!canEdit || saving || draft === null || draft >= config.max}
                    onClick={() => setDraft((v) => (v === null ? v : clamp(v + 1)))}
                    style={{ width: 28, padding: 0, justifyContent: 'center' }}
                    aria-label={'Increase slots'}
                >
                    <Icon name={'chevron-right'} size={11} />
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                    fontSize: 10, color: 'var(--text-faint)',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    range {config.min}–{config.max}
                </span>
                <div style={{ flex: 1 }} />
                <button
                    type={'button'}
                    className={dirty ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                    onClick={onCommit}
                    disabled={!canEdit || !dirty || saving}
                >
                    {saving
                        ? <><Icon name={'restart'} size={11} className={'spin'} />Saving</>
                        : savedAt && Date.now() - savedAt < 1700
                            ? <><Icon name={'check'} size={11} />Saved</>
                            : <><Icon name={'save'} size={11} />Save</>}
                </button>
            </div>

            {!canEdit && config.reason && (
                <div style={{
                    fontSize: 10, color: 'var(--text-faint)', marginTop: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    {config.reason}
                </div>
            )}

            {error && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 8 }}>
                    {error}
                </div>
            )}
        </>
    );
};

export default SlotManagerCard;
