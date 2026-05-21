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

// Render guards. Pulling a 50 MB modpack crash through navigator.clipboard
// and stuffing it into a <pre> will lock the tab — so we cap what we hold
// in memory and warn the user when we had to slice.
const MAX_DISPLAY_CHARS = 200 * 1024;

interface DiscoveredCrash {
    path: string;
    name: string;
    size: number;
    modifiedAt: Date;
}

interface ViewerState {
    name: string;
    content: string;
    loading: boolean;
    truncated: boolean;
    error: string | null;
}

const fmtSize = (n: number): string => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const tailSlice = (text: string): { content: string; truncated: boolean } => {
    if (text.length <= MAX_DISPLAY_CHARS) return { content: text, truncated: false };
    return { content: text.slice(text.length - MAX_DISPLAY_CHARS), truncated: true };
};

const ViewerModal = ({
    crash, onDismiss,
}: {
    crash: ViewerState;
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
            {crash.truncated && !crash.loading && !crash.error && (
                <div style={{
                    padding: '8px 16px',
                    background: 'rgba(251, 191, 36, 0.08)',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 11, color: '#fbbf24',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    Large file — showing last {fmtSize(MAX_DISPLAY_CHARS)}. Download for the full report.
                </div>
            )}
            <pre
                style={{
                    flex: 1, margin: 0, padding: 16,
                    background: 'var(--surface-2)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11.5, lineHeight: 1.55,
                    color: crash.error ? '#f87171' : 'var(--text-soft)',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                }}
            >
                {crash.loading
                    ? '— loading crash report —'
                    : crash.error
                        ? crash.error
                        : crash.content || '— empty —'}
            </pre>
        </div>
    </div>
);

export const CrashLogsPanel = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const history = useHistory();
    const match = useRouteMatch<{ id: string }>();

    const [crashes, setCrashes] = useState<DiscoveredCrash[] | null>(null);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [viewer, setViewer] = useState<ViewerState | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let alive = true;
        setScanning(true);
        setError(null);

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

        probe()
            .catch((e) => alive && setError(httpErrorToHuman(e as Error)))
            .finally(() => alive && setScanning(false));
        return () => { alive = false; };
    }, [uuid, refreshKey]);

    const onRefresh = () => setRefreshKey((k) => k + 1);

    const onView = async (c: DiscoveredCrash) => {
        setViewer({ name: c.name, content: '', loading: true, truncated: false, error: null });
        try {
            const text = await getFileContents(uuid, c.path);
            const sliced = tailSlice(text);
            setViewer({
                name: c.name,
                content: sliced.content,
                loading: false,
                truncated: sliced.truncated,
                error: null,
            });
        } catch (e) {
            setViewer({
                name: c.name,
                content: '',
                loading: false,
                truncated: false,
                error: `Failed to load: ${httpErrorToHuman(e as Error)}`,
            });
        }
    };

    const onCopy = async (c: DiscoveredCrash) => {
        const key = `copy:${c.path}`;
        setBusyKey(key);
        setError(null);
        try {
            const text = await getFileContents(uuid, c.path);
            // Copying a 50 MB string into the clipboard can hang the tab too.
            // Tail-slice for clipboard the same way we do for the modal so the
            // "ship this to a Discord ticket" flow stays snappy.
            const sliced = tailSlice(text);
            await navigator.clipboard.writeText(sliced.content);
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
                <button
                    className={'icon-btn'}
                    onClick={onRefresh}
                    disabled={scanning}
                    title={'Rescan crash directories'}
                    aria-label={'Refresh crash logs'}
                    style={{ width: 24, height: 24 }}
                >
                    <Icon name={'restart'} size={11} className={scanning ? 'spin' : undefined} />
                </button>
            </div>

            {error && (
                <div style={{
                    padding: '8px 14px',
                    background: 'rgba(248, 113, 113, 0.08)',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 11, color: '#f87171',
                    fontFamily: "'JetBrains Mono', monospace",
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <span style={{ flex: 1 }}>{error}</span>
                    <button
                        className={'icon-btn'}
                        onClick={() => setError(null)}
                        title={'Dismiss'}
                        aria-label={'Dismiss error'}
                        style={{ width: 20, height: 20 }}
                    >
                        <Icon name={'plus'} size={9} style={{ transform: 'rotate(45deg)' }} />
                    </button>
                </div>
            )}

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
