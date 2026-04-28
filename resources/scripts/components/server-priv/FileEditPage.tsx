import * as React from 'react';
import { useEffect, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router';
import { useRouteMatch } from 'react-router-dom';
import { dirname } from 'path';
import { Icon } from './Icon';
import { ServerContext } from '@/state/server';
import { httpErrorToHuman } from '@/api/http';
import { encodePathSegments, hashToPath } from '@/helpers';
import getFileContents from '@/api/server/files/getFileContents';
import saveFileContents from '@/api/server/files/saveFileContents';
import CodemirrorEditor from '@/components/elements/CodemirrorEditor';
import Spinner from '@/components/elements/Spinner';
import modes from '@/modes';

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
    const [mode, setMode] = useState('text/plain');
    const [newName, setNewName] = useState('');

    let fetchEditorContent: null | (() => Promise<string>) = null;

    useEffect(() => {
        if (!isEdit) return;
        setError(null);
        setLoading(true);
        setDirectory(dirname(path));
        getFileContents(uuid, path)
            .then(setContent)
            .catch((e) => setError(httpErrorToHuman(e as Error)))
            .finally(() => setLoading(false));
    }, [isEdit, uuid, path]);

    const persist = (filename?: string) => {
        if (!fetchEditorContent) return;
        setSaving(true);
        setError(null);
        fetchEditorContent()
            .then((c) => saveFileContents(uuid, filename || path, c))
            .then(() => {
                if (filename) {
                    history.push(`/server/${id}/files/edit#/${encodePathSegments(filename)}`);
                }
            })
            .catch((e) => setError(httpErrorToHuman(e as Error)))
            .finally(() => setSaving(false));
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
                        mode={mode}
                        filename={isEdit ? (path.split('/').pop() || '') : newName}
                        onModeChanged={setMode}
                        initialContent={content}
                        fetchContent={(getter) => { fetchEditorContent = getter; }}
                        onContentSaved={onSave}
                        style={{ height: '100%', minHeight: 0, borderRadius: 0, border: 'none' }}
                    />
                </div>
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
                    ⌘S / Ctrl-S to save
                </div>
                <div style={{ flex: 1 }} />
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
