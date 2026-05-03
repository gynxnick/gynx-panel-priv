import * as React from 'react';
import { useEffect, useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import { Icon } from './Icon';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import getFileContents from '@/api/server/files/getFileContents';
import getFileDownloadUrl from '@/api/server/files/getFileDownloadUrl';
import { encodePathSegments } from '@/helpers';
import { httpErrorToHuman } from '@/api/http';
import { formatDistanceToNowStrict } from 'date-fns';

// Last-4-crashes panel sitting under the console. Designed for the
// "support, fast" path: scan, copy, ship to a Discord ticket.
//
// Game coverage today is Minecraft (vanilla / Forge / Fabric / Paper put
// reports in /crash-reports/, modern Forge/NeoForge also dump them under
// /logs/crashes/). We probe both directories and merge whatever we find.

const CRASH_DIRS = ['/crash-reports', '/logs/crashes'];
const MAX_DISPLAYED = 4;

interface DiscoveredCrash {
    /** Full server-relative path used by the file APIs. */
    path: string;
    name: string;
    size: number;
    modifiedAt: Date;
}

const fmtSize = (n: number): string => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const ViewerModal = ({
    crash, onDismiss,
}: {
    crash: { name: string; content: string; loading: boolean };
    onDismiss: () => void;
}) => (
    <div
        style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(8,8,12,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
        <div className={'panel'} style={{
            width: 880, maxWidth: '100%',
            height: '80vh',
            display: 'flex', flexDirection: 'column',
        }}>
            <div style={{
                padding: '12px 16px', borderBottom: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', gap: 12,
            }}>
                <Icon name={'skull'} size={14} color={'#f87171'} />
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5,
                    color: 'var(--text)', flex: 1, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={crash.name}>
                    {crash.name}
                </div>
                <button className={'icon-btn'} onClick={onDismiss} title={'Close'} style={{ width: 28, height: 28 }}>
                    <Icon name={'plus'} size={12} style={{ transform: 'rotate(45deg)' }} />
                </button>
            </div>
            <pre
                style={{
                    flex: 1, margin: 0, padding: 16,
                    background: 'var(--surface-2)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11.5, lineHeight: 1.55,
                    color: 'var(--text-soft)',
                    overflow: 'auto',
                }}
            >
                {crash.loading ? '— loading crash report —' : crash.content || '— empty —'}
            </pre>
        </div>
    </div>
);

export const CrashLogsPanel = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const history = useHistory();
    const match = useRouteMatch<{ id: string }>();

    const [crashes, setCrashes] = useState<DiscoveredCrash[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [viewer, setViewer] = useState<{ name: string; content: string; loading: boolean } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;

        const probe = async () => {
            const all: DiscoveredCrash[] = [];
            for (const dir of CRASH_DIRS) {
                try {
                    const files = await loadDirectory(uuid, dir);
                    files
                        .filter((f: FileObject) => f.isFile && /\.(txt|log)$/i.test(f.name))
                        .forEach((f) => {
                            all.push({
                                path: `${dir}/${f.name}`,
                                name: f.name,
                                size: f.size,
                                modifiedAt: f.modifiedAt,
                            });
                        });
                } catch {
                    // 404 / 500 from a missing directory is fine — Minecraft only
                    // creates them after the first crash. Swallow per-directory
                    // failures and keep probing the others.
                }
            }
            if (!alive) return;
            all.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
            setCrashes(all.slice(0, MAX_DISPLAYED));
        };

        probe().catch((e) => alive && setError(httpErrorToHuman(e as Error)));
        return () => { alive = false; };
    }, [uuid]);

    const onView = async (c: DiscoveredCrash) => {
        setViewer({ name: c.name, content: '', loading: true });
        try {
            const text = await getFileContents(uuid, c.path);
            setViewer({ name: c.name, content: text, loading: false });
        } catch (e) {
            setViewer({ name: c.name, content: `Failed to load: ${httpErrorToHuman(e as Error)}`, loading: false });
        }
    };

    const onCopy = async (c: DiscoveredCrash) => {
        const key = `copy:${c.path}`;
        setBusyKey(key);
        try {
            const text = await getFileContents(uuid, c.path);
            await navigator.clipboard.writeText(text);
            setCopied(c.path);
            window.setTimeout(() => setCopied((p) => (p === c.path ? null : p)), 1800);
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setBusyKey((k) => (k === key ? null : k));
        }
    };

    const onDownload = async (c: DiscoveredCrash) => {
        const key = `dl:${c.path}`;
        setBusyKey(key);
        try {
            const url = await getFileDownloadUrl(uuid, c.path);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setBusyKey((k) => (k === key ? null : k));
        }
    };

    const onOpenInEditor = (c: DiscoveredCrash) => {
        history.push(`/server/${match.params.id}/files/edit#${encodePathSegments(c.path)}`);
    };

    const isLoading = crashes === null;
    const isEmpty = crashes !== null && crashes.length === 0;

    return (
        <div className={'panel'} style={{ padding: 0 }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderBottom: '1px solid var(--line)',
            }}>
                <Icon name={'skull'} size={13} color={'var(--text-faint)'} />
                <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 13, fontWeight: 600, color: 'var(--text)',
                }}>
                    Crash logs
                </div>
                <span className={'tag'} style={{ background: 'var(--surface-2)', fontSize: 10 }}>
                    last {MAX_DISPLAYED}
                </span>
                <div style={{ flex: 1 }} />
                {error && (
                    <span style={{ fontSize: 11, color: '#f87171' }} title={error}>
                        error
                    </span>
                )}
            </div>

            {isLoading ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-faint)' }}>
                    scanning…
                </div>
            ) : isEmpty ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-faint)' }}>
                    No crashes recorded. Nice.
                </div>
            ) : (
                crashes!.map((c) => (
                    <div
                        key={c.path}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderBottom: '1px solid var(--line)',
                        }}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 12.5, color: 'var(--text)',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}
                                title={c.path}
                            >
                                {c.name}
                            </div>
                            <div style={{
                                fontSize: 11, color: 'var(--text-faint)', marginTop: 2,
                                fontFamily: "'JetBrains Mono', monospace",
                            }}>
                                {formatDistanceToNowStrict(c.modifiedAt, { addSuffix: true })}
                                {' · '}
                                {fmtSize(c.size)}
                            </div>
                        </div>
                        <button
                            className={'btn btn-sm'}
                            onClick={() => onView(c)}
                            title={'View inline'}
                        >
                            <Icon name={'expand'} size={11} />View
                        </button>
                        <button
                            className={'btn btn-sm'}
                            onClick={() => onCopy(c)}
                            disabled={busyKey === `copy:${c.path}`}
                            title={'Copy to clipboard'}
                        >
                            <Icon name={busyKey === `copy:${c.path}` ? 'restart' : 'copy'} size={11}
                                className={busyKey === `copy:${c.path}` ? 'spin' : undefined} />
                            {copied === c.path ? 'Copied' : 'Copy'}
                        </button>
                        <button
                            className={'btn btn-sm'}
                            onClick={() => onDownload(c)}
                            disabled={busyKey === `dl:${c.path}`}
                            title={'Download'}
                        >
                            <Icon name={'download'} size={11} />Download
                        </button>
                        <button
                            className={'btn btn-sm'}
                            onClick={() => onOpenInEditor(c)}
                            title={'Open in file editor'}
                            style={{ padding: '0 8px' }}
                        >
                            <Icon name={'chevron-right'} size={11} />
                        </button>
                    </div>
                ))
            )}

            {viewer && <ViewerModal crash={viewer} onDismiss={() => setViewer(null)} />}
        </div>
    );
};

export default CrashLogsPanel;
