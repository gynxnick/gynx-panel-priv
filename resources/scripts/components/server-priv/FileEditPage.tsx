import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router';
import { useRouteMatch } from 'react-router-dom';
import { dirname } from 'path';
import { Icon } from './Icon';
import { ServerContext } from '@/state/server';
import { httpErrorToHuman } from '@/api/http';
import { encodePathSegments, hashToPath } from '@/helpers';
import getFileContents from '@/api/server/files/getFileContents';
import saveFileContentsVersioned from '@/api/server/files/saveFileContentsVersioned';
import CodemirrorEditor from '@/components/elements/CodemirrorEditor';
import Spinner from '@/components/elements/Spinner';
import modes from '@/modes';
import { KNOWN_CONFIGS, adHocEntry } from '@/components/server/configs/known-configs';
import { validate, ValidationError } from '@/components/server/configs/validators';
import SnapshotMenu from './files/SnapshotMenu';

// Priv-styled file editor — replaces the legacy FileEditContainer that
// rendered inside PageContentBlock. The legacy chrome collapsed inside
// the new ServerShell which left only a tiny breadcrumb and a sea of
// black; this page lays the editor out in a flex column inside the priv
// panel, so the CodeMirror surface fills the viewport between header
// and toolbar without any 100vh-based height math.
//
// Reuses the existing CodemirrorEditor component (modes, theme, save
// keymap) — only the chrome around it is rebuilt.

const ALLOWED_ACTIONS = ['edit', 'new'] as const;
type Action = typeof ALLOWED_ACTIONS[number];

const FileEditPage = () => {
    const { action } = useParams<{ action: Action }>();
    const isEdit = action === 'edit';
    const history = useHistory();
    const match = useRouteMatch<{ id: string }>();
    const { hash } = useLocation();
    const path = hashToPath(hash);

    const id = ServerContext.useStoreState((s) => s.server.data!.id);
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const setDirectory = ServerContext.useStoreActions((a) => a.files.setDirectory);

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [initialContent, setInitialContent] = useState('');
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [mode, setMode] = useState('text/plain');
    const [newName, setNewName] = useState('');
    // Snapshots popover + remount key so Restore forces CodeMirror to re-read
    // initialContent (the editor only reads it at mount, so a key bump is the
    // simplest way to swap the buffer).
    const [snapshotsOpen, setSnapshotsOpen] = useState(false);
    const [snapshotRefresh, setSnapshotRefresh] = useState(0);
    const [editorKey, setEditorKey] = useState(0);

    let fetchEditorContent: null | (() => Promise<string>) = null;

    // Config-awareness: resolve the catalog entry for this file (or build an
    // ad-hoc one from the extension), then validate live as the user types.
    // For new files we use the typed name; for unknown formats validate()
    // returns an empty array, so the pill/diagnostics quietly stay hidden.
    const entry = useMemo(() => {
        const target = isEdit ? path : (newName.trim() ? `/${newName.trim().replace(/^\/+/, '')}` : '');
        if (!target) return adHocEntry('untitled');
        return KNOWN_CONFIGS.find((e) => e.path === target) ?? adHocEntry(target);
    }, [isEdit, path, newName]);
    const errors = useMemo<ValidationError[]>(
        () => (entry.format === 'plain' ? [] : validate(content, entry.format)),
        [content, entry.format],
    );
    const errorCount = errors.filter((e) => e.severity === 'error').length;
    const isDirty = isEdit && content !== initialContent;

    useEffect(() => {
        if (!isEdit) return;
        setError(null);
        setLoading(true);
        setDirectory(dirname(path));
        getFileContents(uuid, path)
            .then((c) => {
                setContent(c);
                setInitialContent(c);
            })
            .catch((e) => setError(httpErrorToHuman(e as Error)))
            .finally(() => setLoading(false));
    }, [isEdit, uuid, path]);

    const persist = (filename?: string) => {
        if (!fetchEditorContent) return;
        setSaving(true);
        setError(null);
        let savedContent = '';
        fetchEditorContent()
            .then((c) => { savedContent = c; return saveFileContentsVersioned(uuid, filename || path, c); })
            .then(() => {
                setInitialContent(savedContent);
                setContent(savedContent);
                setSavedAt(Date.now());
                window.setTimeout(() => setSavedAt((t) => (t && Date.now() - t > 2400 ? null : t)), 2600);
                // Bump so an open Snapshots popover picks up the new version.
                setSnapshotRefresh((k) => k + 1);
                if (filename) {
                    history.push(`/server/${id}/files/edit#/${encodePathSegments(filename)}`);
                }
            })
            .catch((e) => setError(httpErrorToHuman(e as Error)))
            .finally(() => setSaving(false));
    };

    // Pull a snapshot's bytes into the editor without saving them. We bump
    // editorKey so CodeMirror remounts and reads the new content as its
    // initialContent; `initialContent` (React state) intentionally STAYS at
    // the on-disk bytes so isDirty flips true and the user has to hit Save
    // to actually overwrite the live file.
    const onRestore = (restored: string) => {
        setContent(restored);
        setEditorKey((k) => k + 1);
    };

    const onSave = () => {
        if (isEdit) {
            persist();
        } else {
            // New file — prompt for a name. Strip leading slash so the
            // backend treats it relative to the current directory.
            const trimmed = newName.trim().replace(/^\/+/, '');
            if (!trimmed) {
                setError('Give the new file a name first.');
                return;
            }
            const dir = dirname(path);
            const target = dir === '/' ? `/${trimmed}` : `${dir}/${trimmed}`;
            persist(target);
        }
    };

    const filesPath = `${match.url.replace(/\/files\/(edit|new).*/, '/files')}`;
    const fileName = path.split('/').filter(Boolean).pop() || (isEdit ? 'untitled' : 'new file');

    return (
        <div
            className={'sub-main'}
            style={{
                padding: '14px 24px 24px',
                display: 'flex', flexDirection: 'column',
                flex: 1, minHeight: 0,
            }}
        >
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
            }}>
                <button
                    className={'btn btn-sm'}
                    onClick={() => history.push(filesPath + (path && path !== '/' ? `#${encodePathSegments(dirname(path))}` : ''))}
                    title={'Back to file manager'}
                >
                    <Icon name={'chevron-right'} size={11} style={{ transform: 'rotate(180deg)' }} />
                    Files
                </button>
                <div style={{
                    fontSize: 12, color: 'var(--text-faint)',
                    fontFamily: "'JetBrains Mono', monospace",
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, minWidth: 0,
                }} title={path}>
                    {isEdit ? (path || '/') : (dirname(path) === '.' ? '/' : dirname(path))}
                </div>
                <div style={{
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 14,
                    color: 'var(--text)', fontWeight: 500,
                }}>
                    {fileName}
                </div>
                {entry.format !== 'plain' && (
                    <ValidationPill format={entry.format} errors={errorCount} dirty={isDirty} saved={!!savedAt && Date.now() - (savedAt || 0) < 2400} />
                )}
            </div>

            {!isEdit && (
                <div style={{ marginBottom: 10 }}>
                    <input
                        className={'priv-input'}
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={'filename — saved into ' + (dirname(path) === '.' ? '/' : dirname(path) || '/')}
                    />
                </div>
            )}

            {error && (
                <div className={'notice warn'} style={{ marginBottom: 10 }}>
                    <Icon name={'zap'} size={14} />{error}
                </div>
            )}

            {loading ? (
                <div className={'panel'} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spinner size={'large'} />
                </div>
            ) : (
                <div
                    className={'panel'}
                    style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        minHeight: 0, padding: 0, overflow: 'hidden',
                    }}
                >
                    <CodemirrorEditor
                        key={editorKey}
                        mode={mode}
                        filename={isEdit ? (path.split('/').pop() || '') : newName}
                        onModeChanged={setMode}
                        initialContent={content}
                        fetchContent={(getter) => { fetchEditorContent = getter; }}
                        onContentSaved={onSave}
                        onChange={setContent}
                        style={{ height: '100%', minHeight: 0, borderRadius: 0, border: 'none' }}
                    />
                </div>
            )}

            {entry.format !== 'plain' && !loading && (
                <DiagnosticsStrip errors={errors} format={entry.format} />
            )}

            <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
            }}>
                <select
                    className={'priv-input'}
                    style={{ width: 'auto', padding: '7px 10px', fontSize: 12 }}
                    value={mode}
                    onChange={(e) => setMode(e.currentTarget.value)}
                >
                    {modes.map((m) => (
                        <option key={`${m.name}_${m.mime}`} value={m.mime}>{m.name}</option>
                    ))}
                </select>
                <div style={{
                    fontSize: 11, color: 'var(--text-faint)',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    {entry.format !== 'plain'
                        ? `${entry.format} · save then restart the server to apply`
                        : '⌘S / Ctrl-S to save'}
                </div>
                <div style={{ flex: 1 }} />
                {isEdit && (
                    <div style={{ position: 'relative' }}>
                        <button
                            type={'button'}
                            className={'btn btn-sm'}
                            onClick={() => setSnapshotsOpen((v) => !v)}
                            title={'Browse and restore past versions of this file'}
                        >
                            <Icon name={'clock'} size={11} />
                            Snapshots
                        </button>
                        {snapshotsOpen && (
                            <SnapshotMenu
                                uuid={uuid}
                                path={path}
                                refreshKey={snapshotRefresh}
                                onRestore={onRestore}
                                onClose={() => setSnapshotsOpen(false)}
                            />
                        )}
                    </div>
                )}
                <button
                    className={'btn btn-primary'}
                    onClick={onSave}
                    disabled={saving || (!isEdit && !newName.trim())}
                >
                    {saving
                        ? <><Icon name={'restart'} size={13} className={'spin'} />Saving…</>
                        : isEdit
                            ? <><Icon name={'save'} size={13} />Save</>
                            : <><Icon name={'plus'} size={13} />Create file</>}
                </button>
            </div>
        </div>
    );
};

export default FileEditPage;

// -- config-aware sub-components --------------------------------------------

// Validation pill — three states (saved / dirty-or-issues / clean) port the
// colour tokens from the standalone Configs editor so the file-editor header
// reads identically to the old surface it replaces.

const ValidationPill: React.FC<{ format: string; errors: number; dirty: boolean; saved: boolean }> = ({
    format, errors, dirty, saved,
}) => {
    const ok = errors === 0;
    const color = saved ? '#34D399' : dirty ? '#FCD34D' : ok ? '#34D399' : '#F87171';
    const bg = saved
        ? 'rgba(52,211,153,0.10)'
        : dirty
            ? 'rgba(252,211,77,0.10)'
            : ok
                ? 'rgba(52,211,153,0.10)'
                : 'rgba(248,113,113,0.10)';
    const border = saved
        ? 'rgba(52,211,153,0.35)'
        : dirty
            ? 'rgba(252,211,77,0.35)'
            : ok
                ? 'rgba(52,211,153,0.35)'
                : 'rgba(248,113,113,0.35)';
    const label = saved
        ? 'saved'
        : dirty
            ? 'unsaved'
            : ok
                ? `valid ${format}`
                : `${errors} issue${errors === 1 ? '' : 's'}`;
    const icon = saved || ok ? 'check' : 'zap';
    return (
        <span
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 600,
                padding: '3px 9px', borderRadius: 999,
                color, background: bg, border: `1px solid ${border}`,
                fontFamily: "'Inter', sans-serif",
                whiteSpace: 'nowrap',
            }}
        >
            <Icon name={icon} size={11} color={color} />
            {label}
        </span>
    );
};

// Diagnostics strip — one row per error/warning, scrollable, capped at 20
// (validators.ts itself caps XML at 20; this just enforces the same on the
// other formats so a runaway error list can't push the toolbar off-screen).

const DiagnosticsStrip: React.FC<{ errors: ValidationError[]; format: string }> = ({ errors, format }) => {
    const empty = errors.length === 0;
    return (
        <div
            style={{
                marginTop: 8,
                padding: '8px 12px',
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: empty ? 'var(--text-faint)' : 'var(--text)',
                background: empty ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.04)',
                borderTop: `1px solid ${empty ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.25)'}`,
                borderRadius: 6,
                maxHeight: 140,
                overflowY: 'auto',
            }}
        >
            {empty ? (
                <span>no issues · {format} · ctrl/⌘+s to save</span>
            ) : (
                errors.slice(0, 20).map((err, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '2px 0',
                            color: err.severity === 'error' ? '#F87171' : '#FCD34D',
                        }}
                    >
                        <span style={{ width: 48, flexShrink: 0 }}>line {err.line}</span>
                        <span style={{ flex: 1 }}>{err.message}</span>
                    </div>
                ))
            )}
        </div>
    );
};
