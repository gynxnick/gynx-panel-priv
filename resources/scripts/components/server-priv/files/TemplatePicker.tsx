import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { Icon } from '../Icon';
import { httpErrorToHuman } from '@/api/http';
import {
    ServerSnippet,
    listSnippets,
    deleteSnippet,
    createSnippet,
} from '@/api/server/files/snippets';
import { ConfigFormat } from '@/components/server/configs/known-configs';

// Popover above the editor's "Templates" toolbar button. Lists snippets
// scoped to the open file (matching format + matching/empty path_hint),
// lets the user Apply one (replacing the editor buffer) or Delete it,
// and exposes a small "Save current as template…" form so the active
// buffer can be captured without leaving the editor.

interface Props {
    uuid: string;
    path: string;
    format: ConfigFormat;
    /** Current editor buffer — used by "Save as template". */
    currentContent: string;
    /** Called with the snippet's content when Apply is clicked. */
    onApply: (contents: string) => void;
    /** Close the popover. */
    onClose: () => void;
}

const formatRelative = (iso: string | null): string => {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
};

const TemplatePicker: React.FC<Props> = ({ uuid, path, format, currentContent, onApply, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [snippets, setSnippets] = useState<ServerSnippet[]>([]);
    const [busy, setBusy] = useState<number | null>(null);
    const [refresh, setRefresh] = useState(0);

    const [showSave, setShowSave] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [saving, setSaving] = useState(false);

    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        listSnippets(uuid, { path, format: format !== 'plain' ? format : undefined })
            .then((s) => alive && setSnippets(s))
            .catch((e) => alive && setError(httpErrorToHuman(e as Error)))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [uuid, path, format, refresh]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        const onClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
        };
        window.addEventListener('keydown', onKey);
        const id = window.setTimeout(() => window.addEventListener('mousedown', onClick), 0);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('mousedown', onClick);
            window.clearTimeout(id);
        };
    }, [onClose]);

    const handleApply = (s: ServerSnippet) => {
        onApply(s.content);
        onClose();
    };

    const handleDelete = async (s: ServerSnippet) => {
        if (!window.confirm(`Delete the "${s.name}" template? This can't be undone.`)) return;
        setBusy(s.id);
        setError(null);
        try {
            await deleteSnippet(uuid, s.id);
            setSnippets((xs) => xs.filter((x) => x.id !== s.id));
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setBusy(null);
        }
    };

    const handleSave = async () => {
        const name = draftName.trim();
        if (!name) { setError('Give the template a name first.'); return; }
        setSaving(true);
        setError(null);
        try {
            await createSnippet(uuid, {
                name,
                path_hint: path || null,
                format: format !== 'plain' ? format : null,
                content: currentContent,
            });
            setDraftName('');
            setShowSave(false);
            setRefresh((k) => k + 1);
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setSaving(false);
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
                width: 360,
                maxHeight: 380,
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
                <Icon name={'archive'} size={12} color={'var(--purple)'} />
                Templates
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-faint)', fontSize: 10.5 }}>
                    {format !== 'plain' ? format : 'any'} · {snippets.length}
                </span>
                <div style={{ flex: 1 }} />
                <button
                    type={'button'}
                    className={'btn btn-sm'}
                    onClick={() => { setShowSave((v) => !v); setError(null); }}
                    style={{ padding: '4px 8px' }}
                    title={'Capture the current buffer as a new template'}
                >
                    <Icon name={'plus'} size={11} />
                    Save current
                </button>
            </div>

            {showSave && (
                <div style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(124,58,237,0.04)',
                }}>
                    <input
                        className={'priv-input'}
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.currentTarget.value)}
                        placeholder={'template name'}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                        style={{ marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type={'button'}
                            className={'btn btn-primary btn-sm'}
                            onClick={handleSave}
                            disabled={saving || !draftName.trim()}
                        >
                            {saving
                                ? <><Icon name={'restart'} size={11} className={'spin'} />Saving…</>
                                : <><Icon name={'save'} size={11} />Save template</>}
                        </button>
                        <button
                            type={'button'}
                            className={'btn btn-sm'}
                            onClick={() => { setShowSave(false); setDraftName(''); }}
                        >
                            Cancel
                        </button>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace", alignSelf: 'center' }}>
                            {(currentContent.length / 1024).toFixed(1)} KB
                        </span>
                    </div>
                </div>
            )}

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
                ) : snippets.length === 0 ? (
                    <div style={{ padding: '18px 12px', fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.55 }}>
                        No templates saved for this file yet. Tweak the buffer and click <strong>Save current</strong> to capture it.
                    </div>
                ) : (
                    snippets.map((s) => (
                        <div
                            key={s.id}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                fontSize: 12,
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: 'var(--text)', fontWeight: 500 }}>
                                    {s.name}
                                </div>
                                <div style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 10.5, color: 'var(--text-faint)',
                                }}>
                                    {s.pathHint ? `${s.pathHint} · ` : ''}{s.format ?? 'plain'} · {formatRelative(s.updatedAt)}
                                </div>
                            </div>
                            <button
                                type={'button'}
                                className={'btn btn-sm'}
                                disabled={busy === s.id}
                                onClick={() => handleApply(s)}
                                title={'Replace the editor buffer with this template. Save to commit.'}
                            >
                                <Icon name={'download'} size={11} />Apply
                            </button>
                            <button
                                type={'button'}
                                className={'btn btn-sm btn-danger'}
                                disabled={busy === s.id}
                                onClick={() => handleDelete(s)}
                                aria-label={'Delete template'}
                                style={{ padding: '6px 8px' }}
                            >
                                <Icon name={'trash'} size={11} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TemplatePicker;
