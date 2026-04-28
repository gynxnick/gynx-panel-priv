import * as React from 'react';
import { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import {
    EggSwitchOption,
    EggSwitchPreview,
    EggSwitchLogStatus,
    listEggSwitchOptions,
    previewEggSwitch,
    requestEggSwitch,
    eggSwitchStatus,
} from '@/api/server/eggSwitch';
import { httpErrorToHuman } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import { Icon } from './Icon';

// Game-switcher (egg switch) page — wireframe-styled wrapper around the
// existing /api/client/servers/<uuid>/egg-switch endpoints. Lists every
// switch target the panel admin has whitelisted for this server, shows a
// preview of the variable diff before committing, and polls the daemon
// log until the swap completes.

const formatCooldown = (s: number): string => {
    if (s < 60) return `${s}s`;
    const m = Math.ceil(s / 60);
    if (m < 60) return `${m}m`;
    return `${Math.ceil(m / 60)}h`;
};

const ICON_GRADIENT = (i: number): string =>
    i % 3 === 0 ? 'linear-gradient(135deg, #4c1d95, #1e3a8a)'
    : i % 3 === 1 ? 'linear-gradient(135deg, #831843, #4c1d95)'
    : 'linear-gradient(135deg, #0e7490, #1e3a8a)';

interface ConfirmModalProps {
    option: EggSwitchOption;
    preview: EggSwitchPreview | null;
    loadingPreview: boolean;
    loadingConfirm: boolean;
    serverName: string;
    onDismiss: () => void;
    onConfirm: () => void;
}

const ConfirmModal = ({
    option, preview, loadingPreview, loadingConfirm, serverName, onDismiss, onConfirm,
}: ConfirmModalProps) => {
    const [confirmText, setConfirmText] = useState('');
    const wipes = preview?.filesWipeRequired ?? !option.preservesFiles;
    const mustType = wipes;
    const canConfirm = !loadingConfirm && (!mustType || confirmText.trim() === serverName);

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(8,8,12,0.72)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
        >
            <div className={'panel'} style={{ width: 560, maxWidth: '100%', maxHeight: '85vh', overflow: 'auto' }}>
                <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>
                            Switch to {option.name}
                        </h3>
                        <div style={{ flex: 1 }} />
                        <button className={'icon-btn'} onClick={onDismiss} title={'Close'} style={{ width: 28, height: 28 }}>
                            <Icon name={'plus'} size={12} style={{ transform: 'rotate(45deg)' }} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {loadingPreview && !preview && (
                        <div style={{ padding: '24px 0', textAlign: 'center' }}>
                            <Spinner size={'small'} />
                        </div>
                    )}

                    {preview && preview.warnings.length > 0 && (
                        <div className={'notice warn'}>
                            <Icon name={'zap'} size={14} />
                            <div>
                                {preview.warnings.map((w, i) => (
                                    <div key={i} style={i > 0 ? { marginTop: 4 } : undefined}>{w}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {preview && preview.variableChanges.length > 0 && (
                        <div>
                            <div style={{
                                fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                                color: 'var(--text-faint)', marginBottom: 6,
                                fontFamily: "'JetBrains Mono', monospace",
                            }}>
                                Variable changes
                            </div>
                            <div style={{
                                border: '1px solid var(--line)', borderRadius: 8,
                                background: 'var(--surface-2)', overflow: 'hidden',
                                fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                            }}>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
                                    padding: '6px 10px', borderBottom: '1px solid var(--line)',
                                    color: 'var(--text-faint)', textTransform: 'uppercase',
                                    fontSize: 10, letterSpacing: '0.08em',
                                }}>
                                    <span>env var</span><span>from</span><span>to</span>
                                </div>
                                {preview.variableChanges.slice(0, 12).map((v) => (
                                    <div key={v.envKey} style={{
                                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
                                        padding: '6px 10px', borderBottom: '1px solid var(--line)',
                                        alignItems: 'center',
                                    }}>
                                        <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.envKey}>
                                            {v.envKey}
                                        </span>
                                        <span style={{ color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.from ?? ''}>
                                            {v.from ?? '—'}
                                        </span>
                                        <span style={{ color: 'var(--purple-soft, #c4b5fd)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.to ?? ''}>
                                            {v.to ?? '—'}
                                        </span>
                                    </div>
                                ))}
                                {preview.variableChanges.length > 12 && (
                                    <div style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-faint)' }}>
                                        + {preview.variableChanges.length - 12} more
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {mustType && (
                        <div>
                            <div style={{
                                fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                                color: 'var(--text-faint)', marginBottom: 6,
                                fontFamily: "'JetBrains Mono', monospace",
                            }}>
                                Type the server name to confirm wipe
                            </div>
                            <input
                                type={'text'}
                                autoFocus
                                placeholder={serverName}
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.currentTarget.value)}
                                style={{
                                    width: '100%', padding: '8px 12px',
                                    background: 'var(--surface-2)', border: '1px solid var(--line)',
                                    borderRadius: 6, color: 'var(--text)', fontSize: 13,
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            />
                        </div>
                    )}
                </div>

                <div style={{
                    padding: '12px 18px', borderTop: '1px solid var(--line)',
                    display: 'flex', justifyContent: 'flex-end', gap: 8,
                }}>
                    <button className={'btn'} onClick={onDismiss} disabled={loadingConfirm}>
                        Cancel
                    </button>
                    <button
                        className={wipes ? 'btn btn-danger' : 'btn btn-primary'}
                        onClick={onConfirm}
                        disabled={!canConfirm}
                    >
                        {loadingConfirm
                            ? <><Icon name={'restart'} size={13} className={'spin'} />Switching…</>
                            : wipes ? <><Icon name={'zap'} size={13} />Switch &amp; wipe</>
                            : <><Icon name={'play'} size={13} />Switch</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

const POLL_MS = 3000;

interface ProgressPanelProps {
    serverUuid: string;
    logId: number;
    onDone?: (status: 'success' | 'failed') => void;
}

const ProgressPanel = ({ serverUuid, logId, onDone }: ProgressPanelProps) => {
    const [status, setStatus] = useState<EggSwitchLogStatus | null>(null);

    useEffect(() => {
        let mounted = true;
        let timer: number | undefined;

        const poll = async () => {
            try {
                const s = await eggSwitchStatus(serverUuid, logId);
                if (!mounted) return;
                setStatus(s);
                if (s.status === 'success' || s.status === 'failed') {
                    onDone?.(s.status);
                    return;
                }
            } catch {
                // transient — keep polling
            }
            if (mounted) timer = window.setTimeout(poll, POLL_MS);
        };

        poll();
        return () => {
            mounted = false;
            if (timer) window.clearTimeout(timer);
        };
    }, [serverUuid, logId, onDone]);

    const state = status?.status ?? 'queued';
    const terminal = state === 'success' || state === 'failed';

    return (
        <div className={'panel'} style={{ padding: '40px 24px', textAlign: 'center' }}>
            {!terminal && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <Icon name={'restart'} size={40} className={'spin'} color={'var(--purple)'} />
                </div>
            )}
            {state === 'success' && (
                <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(52, 211, 153, 0.10)',
                    border: '1px solid rgba(52, 211, 153, 0.35)',
                    color: '#34d399', fontSize: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                }}>
                    <Icon name={'check'} size={22} />
                </div>
            )}
            {state === 'failed' && (
                <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(248, 113, 113, 0.10)',
                    border: '1px solid rgba(248, 113, 113, 0.35)',
                    color: '#f87171', fontSize: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                }}>
                    <Icon name={'zap'} size={22} />
                </div>
            )}
            <h3 style={{
                margin: '0 0 8px', fontSize: 16, color: 'var(--text)',
                fontFamily: "'Space Grotesk', sans-serif",
            }}>
                {state === 'queued' && 'Queued — waiting for daemon'}
                {state === 'running' && 'Switching — pulling image + running install'}
                {state === 'success' && 'Switch complete'}
                {state === 'failed' && 'Switch failed'}
            </h3>
            <p style={{
                margin: 0, fontSize: 13, color: 'var(--text-soft)',
                maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55,
            }}>
                {state !== 'failed'
                    ? 'Keep this page open. Your server will reinstall into the new game; this can take a minute or two.'
                    : status?.error ?? 'An unexpected error occurred. Check the server activity log for details.'}
            </p>
        </div>
    );
};

export const GamePage = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const serverName = ServerContext.useStoreState((s) => s.server.data!.name);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [options, setOptions] = useState<EggSwitchOption[]>([]);
    const [introCopy, setIntroCopy] = useState<string | null>(null);

    const [selected, setSelected] = useState<EggSwitchOption | null>(null);
    const [preview, setPreview] = useState<EggSwitchPreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [loadingConfirm, setLoadingConfirm] = useState(false);
    const [logId, setLogId] = useState<number | null>(null);

    useEffect(() => {
        let alive = true;
        listEggSwitchOptions(uuid)
            .then((res) => {
                if (!alive) return;
                setOptions(res.options);
                setIntroCopy(res.introCopy);
            })
            .catch((e) => alive && setError(httpErrorToHuman(e as Error)))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [uuid]);

    const onSelect = async (option: EggSwitchOption) => {
        setSelected(option);
        setPreview(null);
        setLoadingPreview(true);
        try {
            const p = await previewEggSwitch(uuid, option.eggId);
            setPreview(p);
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
            setSelected(null);
        } finally {
            setLoadingPreview(false);
        }
    };

    const onConfirm = async () => {
        if (!selected) return;
        setLoadingConfirm(true);
        setError(null);
        try {
            const result = await requestEggSwitch(uuid, selected.eggId);
            setLogId(result.logId);
            setSelected(null);
            setPreview(null);
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setLoadingConfirm(false);
        }
    };

    if (logId !== null) {
        return (
            <div className={'sub-main'}>
                <div className={'page-header'}>
                    <div>
                        <div className={'page-title'}>Game</div>
                        <div className={'page-sub'}>
                            Reinstalling your server into the selected egg. Don&apos;t close this tab.
                        </div>
                    </div>
                </div>
                <ProgressPanel
                    serverUuid={uuid}
                    logId={logId}
                    onDone={(status) => {
                        if (status === 'success') {
                            window.setTimeout(() => {
                                window.location.href = `/server/${uuid}`;
                            }, 1800);
                        }
                    }}
                />
            </div>
        );
    }

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Game</div>
                    <div className={'page-sub'}>
                        {introCopy
                            ?? 'Swap your server’s game template. Picking a new egg pulls a different image, rewrites startup variables, and (depending on the target) wipes existing files.'}
                    </div>
                </div>
            </div>

            {error && (
                <div className={'notice warn'} style={{ marginBottom: 12 }}>
                    <Icon name={'zap'} size={14} />{error}
                </div>
            )}

            {loading ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                    <Spinner size={'large'} />
                </div>
            ) : options.length === 0 ? (
                <div className={'panel'} style={{ padding: 32, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                    No game-switch targets are configured for this server. Ask your panel admin to add an egg-switch rule.
                </div>
            ) : (
                <div className={'item-grid'}>
                    {options.map((o, i) => {
                        const onCooldown = o.cooldownRemainingSeconds > 0;
                        return (
                            <button
                                key={o.eggId}
                                type={'button'}
                                disabled={onCooldown}
                                onClick={() => !onCooldown && onSelect(o)}
                                className={'item-card'}
                                style={{
                                    textAlign: 'left',
                                    cursor: onCooldown ? 'not-allowed' : 'pointer',
                                    opacity: onCooldown ? 0.55 : 1,
                                    padding: 0, overflow: 'hidden',
                                }}
                            >
                                {o.bannerUrl && (
                                    <div style={{
                                        width: '100%', height: 96,
                                        backgroundImage: `linear-gradient(180deg, rgba(11,11,15,0) 55%, rgba(11,11,15,0.72) 100%), url(${o.bannerUrl})`,
                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                    }} />
                                )}
                                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div className={'item-head'}>
                                        <div
                                            className={'item-icon'}
                                            style={
                                                o.iconUrl
                                                    ? { background: `url(${o.iconUrl}) center/cover, ${ICON_GRADIENT(i)}` }
                                                    : { background: ICON_GRADIENT(i) }
                                            }
                                        >
                                            {!o.iconUrl && o.name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className={'item-name'}>{o.name}</div>
                                            <div className={'item-author'}>egg #{o.eggId}</div>
                                        </div>
                                    </div>
                                    {o.description && <div className={'item-desc'}>{o.description}</div>}
                                    <div className={'item-tags'}>
                                        {!o.preservesFiles && (
                                            <span className={'tag warn'}>wipes files</span>
                                        )}
                                        {onCooldown && (
                                            <span className={'tag'}>
                                                cooldown {formatCooldown(o.cooldownRemainingSeconds)}
                                            </span>
                                        )}
                                        {o.warningCopy && !onCooldown && (
                                            <span className={'tag'} title={o.warningCopy}>heads up</span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {selected && (
                <ConfirmModal
                    option={selected}
                    preview={preview}
                    loadingPreview={loadingPreview}
                    loadingConfirm={loadingConfirm}
                    serverName={serverName}
                    onDismiss={() => { setSelected(null); setPreview(null); }}
                    onConfirm={onConfirm}
                />
            )}
        </div>
    );
};

export default GamePage;
