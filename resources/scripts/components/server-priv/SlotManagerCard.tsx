import * as React from 'react';
import { useEffect, useState } from 'react';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { ServerContext } from '@/state/server';
import { Icon } from './Icon';
import {
    getServerLimits,
    updateServerLimits,
    ServerLimits,
} from '@/api/server/admin/serverLimits';
import { httpErrorToHuman } from '@/api/http';

// Admin-only resource limit editor that sits where PlayerManager used to
// live in the right rail. Lets a panel admin bump memory / disk / CPU /
// allocation cap on the user-facing server page without going to the
// admin panel. Non-admins never see this card — the show() endpoint
// returns 403, so we also short-circuit the render based on the user
// store flag to avoid the empty network round-trip.

type FieldKey = 'memory' | 'disk' | 'cpu' | 'allocation_limit';

interface FieldSpec {
    key: FieldKey;
    label: string;
    unit: string;
    step: number;
    min: number;
    max: number;
    hint?: string;
}

// Bounds mirror the backend validation in ServerLimitsController so the
// UI rejects invalid values before the request hits the wire. Keep these
// two in sync.
const FIELDS: FieldSpec[] = [
    { key: 'memory',           label: 'Memory',      unit: 'MB',  step: 256, min: 0, max: 1048576, hint: '0 = unlimited' },
    { key: 'disk',             label: 'Disk',        unit: 'MB',  step: 512, min: 0, max: 10485760, hint: '0 = unlimited' },
    { key: 'cpu',              label: 'CPU',         unit: '%',   step: 25,  min: 0, max: 6400,    hint: '100 = 1 core' },
    { key: 'allocation_limit', label: 'Allocations', unit: '',    step: 1,   min: 0, max: 128,     hint: 'extra ports' },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

interface RowProps {
    spec: FieldSpec;
    value: number;
    onChange: (v: number) => void;
    disabled: boolean;
}

const Row = ({ spec, value, onChange, disabled }: RowProps) => (
    <div style={{ marginBottom: 10 }}>
        <div style={{
            display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4,
        }}>
            <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>
                {spec.label}
            </span>
            {spec.hint && (
                <span style={{
                    fontSize: 10, color: 'var(--text-faint)',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    · {spec.hint}
                </span>
            )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
                type={'button'}
                className={'btn btn-sm'}
                disabled={disabled || value <= spec.min}
                onClick={() => onChange(clamp(value - spec.step, spec.min, spec.max))}
                style={{ width: 26, padding: 0, justifyContent: 'center' }}
                aria-label={`Decrease ${spec.label}`}
            >
                <Icon name={'chevron-right'} size={11} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <input
                type={'number'}
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={value}
                disabled={disabled}
                onChange={(e) => {
                    const n = parseInt(e.currentTarget.value, 10);
                    if (Number.isFinite(n)) onChange(clamp(n, spec.min, spec.max));
                }}
                style={{
                    flex: 1, textAlign: 'center',
                    background: 'var(--surface-2)', border: '1px solid var(--line-2)',
                    color: 'var(--text)', borderRadius: 6, padding: '5px 6px',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                    fontWeight: 600, height: 26, minWidth: 0,
                }}
            />
            <span style={{
                fontSize: 10, color: 'var(--text-faint)', minWidth: 24,
                fontFamily: "'JetBrains Mono', monospace",
            }}>
                {spec.unit}
            </span>
            <button
                type={'button'}
                className={'btn btn-sm'}
                disabled={disabled || value >= spec.max}
                onClick={() => onChange(clamp(value + spec.step, spec.min, spec.max))}
                style={{ width: 26, padding: 0, justifyContent: 'center' }}
                aria-label={`Increase ${spec.label}`}
            >
                <Icon name={'chevron-right'} size={11} />
            </button>
        </div>
    </div>
);

export const SlotManagerCard = () => {
    const rootAdmin = useStoreState((s: ApplicationStore) => s.user.data?.rootAdmin) ?? false;
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);

    const [limits, setLimits] = useState<ServerLimits | null>(null);
    const [draft, setDraft] = useState<ServerLimits | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);

    useEffect(() => {
        if (!rootAdmin) {
            setLoading(false);
            return;
        }
        let alive = true;
        setLoading(true);
        setError(null);
        getServerLimits(uuid)
            .then((l) => {
                if (!alive) return;
                setLimits(l);
                setDraft(l);
            })
            .catch((e) => alive && setError(httpErrorToHuman(e as Error)))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [uuid, rootAdmin]);

    if (!rootAdmin) return null;

    const dirty = !!(limits && draft) && FIELDS.some((f) => draft[f.key] !== limits[f.key]);

    const onSave = async () => {
        if (!dirty || !draft || !limits) return;
        // Send only the keys that actually changed so the audit trail is
        // honest and we don't re-touch fields the admin didn't edit.
        const patch: Partial<ServerLimits> = {};
        for (const f of FIELDS) {
            if (draft[f.key] !== limits[f.key]) patch[f.key] = draft[f.key];
        }
        setSaving(true);
        setError(null);
        try {
            const next = await updateServerLimits(uuid, patch);
            setLimits(next);
            setDraft(next);
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

    const onReset = () => {
        if (limits) setDraft(limits);
    };

    return (
        <div className={'panel rail-card'}>
            <div className={'rail-title'} style={{
                display: 'flex', alignItems: 'center', gap: 6,
            }}>
                <Icon name={'shield'} size={12} color={'var(--purple)'} />
                <span>Slot Manager</span>
                <span style={{
                    fontSize: 9, color: 'var(--purple)',
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: 0.5, textTransform: 'uppercase',
                }}>
                    admin
                </span>
            </div>

            <div style={{
                fontSize: 11, color: 'var(--text-faint)',
                fontFamily: "'JetBrains Mono', monospace", marginTop: -4, marginBottom: 8,
            }}>
                pterodactyl server limits · live
            </div>

            {loading && (
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                    loading limits…
                </div>
            )}

            {!loading && error && !limits && (
                <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>
            )}

            {!loading && draft && limits && (
                <>
                    {FIELDS.map((spec) => (
                        <Row
                            key={spec.key}
                            spec={spec}
                            value={draft[spec.key]}
                            onChange={(v) => setDraft({ ...draft, [spec.key]: v })}
                            disabled={saving}
                        />
                    ))}

                    {error && (
                        <div style={{
                            fontSize: 11, color: '#f87171', marginBottom: 8,
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
                    }}>
                        <button
                            type={'button'}
                            className={'btn btn-sm'}
                            onClick={onReset}
                            disabled={!dirty || saving}
                        >
                            Reset
                        </button>
                        <div style={{ flex: 1 }} />
                        <button
                            type={'button'}
                            className={dirty ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                            onClick={onSave}
                            disabled={!dirty || saving}
                        >
                            {saving
                                ? <><Icon name={'restart'} size={11} className={'spin'} />Saving</>
                                : savedAt && Date.now() - savedAt < 1700
                                    ? <><Icon name={'check'} size={11} />Saved</>
                                    : <><Icon name={'save'} size={11} />Save</>}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default SlotManagerCard;
