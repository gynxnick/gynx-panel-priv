import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { Icon } from '../Icon';
import { httpErrorToHuman } from '@/api/http';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import getFileContents from '@/api/server/files/getFileContents';
import deleteFiles from '@/api/server/files/deleteFiles';
import { snapshotDirFor } from '@/api/server/files/saveFileContentsVersioned';
import { bytesToString } from '@/lib/formatters';

// Popover that lists every snapshot of the currently-open file under
// `.gynx-versions/<path>/`. Each row → Restore (replaces the live buffer
// via the parent's onRestore callback) or Delete (drops the snapshot).
// Read-only on the network side; the parent decides what "Restore"
// actually does with the bytes — usually swap them into the editor and
// leave the actual file write for the user's next Save.

interface Props {
    uuid: string;
    /** The live file path the user is editing. */
    path: string;
    /** Increment from the parent after a successful Save to force a re-list. */
    refreshKey?: number;
    /** Called with the snapshot's contents when the user clicks Restore. */
    onRestore: (contents: string) => void;
    /** Close the popover. */
    onClose: () => void;
}

const formatRelative = (ms: number): string => {
    const diff = Date.now() - ms;
    const s = Math.max(0, Math.floor(diff / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
};

const SnapshotMenu: React.FC<Props> = ({ uuid, path, refreshKey, onRestore, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [versions, setVersions] = useState<FileObject[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    // Reload on open, on path change, and whenever the parent bumps refreshKey.
    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        loadDirectory(uuid, snapshotDirFor(path))
            .then((entries) => {
                if (!alive) return;
                const files = entries
                    .filter((e) => e.isFile && /^\d+$/.test(e.name))
                    .sort((a, b) => Number(b.name) - Number(a.name));
                setVersions(files);
            })
            .catch(() => alive && setVersions([])) // empty dir / 404 = no snapshots yet
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [uuid, path, refreshKey]);

    // Close on Esc or click outside.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        const onClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
        };
        window.addEventListener('keydown', onKey);
        // Defer the click listener so the same click that opened this popover
        // doesn't immediately close it.
        const id = window.setTimeout(() => window.addEventListener('mousedown', onClick), 0);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('mousedown', onClick);
            window.clearTimeout(id);
        };
    }, [onClose]);

    const handleRestore = async (snapshotName: string) => {
        setBusy(snapshotName);
        setError(null);
        try {
            const dir = snapshotDirFor(path);
            const contents = await getFileContents(uuid, `${dir}/${snapshotName}`);
            onRestore(contents);
            onClose();
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setBusy(null);
        }
    };

    const handleDelete = async (snapshotName: string) => {
        setBusy(snapshotName);
        setError(null);
        try {
            await deleteFiles(uuid, snapshotDirFor(path), [snapshotName]);
            setVersions((vs) => vs.filter((v) => v.name !== snapshotName));
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div
            ref={wrapRef}
            className={'panel'}
            style={{
                position: 'absolute',
                right: 0,
                bottom: '100%',
                marginBottom: 8,
                width: 340,
                maxHeight: 320,
                zIndex: 30,
                padding: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 12px 30px -10px rgba(0,0,0,0.55)',
            }}
        >
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 12, fontWeight: 600,
            }}>
                <Icon name={'clock'} size={12} color={'var(--purple)'} />
                Snapshots
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-faint)', fontSize: 10.5 }}>
                    {versions.length}/10
                </span>
                <div style={{ flex: 1 }} />
                <button
                    type={'button'}
                    className={'icon-btn'}
                    onClick={onClose}
                    style={{ width: 22, height: 22 }}
                    aria-label={'Close snapshots'}
                >
                    <Icon name={'plus'} size={11} style={{ transform: 'rotate(45deg)' }} />
                </button>
            </div>

            {error && (
                <div style={{
                    padding: '8px 12px', fontSize: 11, color: '#F87171',
                    background: 'rgba(248,113,113,0.06)',
                    borderBottom: '1px solid rgba(248,113,113,0.18)',
                }}>
                    {error}
                </div>
            )}

            <div style={{ overflowY: 'auto', flex: 1 }}>
                {loading ? (
                    <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
                        loading…
                    </div>
                ) : versions.length === 0 ? (
                    <div style={{ padding: '18px 12px', fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.55 }}>
                        No snapshots yet. The next time you save, the previous bytes get tucked away here. Up to 10 versions are kept; older ones are rotated out automatically.
                    </div>
                ) : (
                    versions.map((v) => {
                        const ts = Number(v.name);
                        return (
                            <div
                                key={v.name}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '8px 12px',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    fontSize: 12,
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: 'var(--text)', fontWeight: 500 }}>
                                        {formatRelative(ts)}
                                    </div>
                                    <div style={{
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: 10.5, color: 'var(--text-faint)',
                                    }}>
                                        {new Date(ts).toLocaleString()} · {bytesToString(v.size)}
                                    </div>
                                </div>
                                <button
                                    type={'button'}
                                    className={'btn btn-sm'}
                                    disabled={busy === v.name}
                                    onClick={() => handleRestore(v.name)}
                                    title={'Replace the editor buffer with this snapshot. Save to commit.'}
                                >
                                    {busy === v.name
                                        ? <><Icon name={'restart'} size={11} className={'spin'} />…</>
                                        : <><Icon name={'refresh'} size={11} />Restore</>}
                                </button>
                                <button
                                    type={'button'}
                                    className={'btn btn-sm btn-danger'}
                                    disabled={busy === v.name}
                                    onClick={() => handleDelete(v.name)}
                                    aria-label={'Delete snapshot'}
                                    style={{ padding: '6px 8px' }}
                                >
                                    <Icon name={'trash'} size={11} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default SnapshotMenu;
