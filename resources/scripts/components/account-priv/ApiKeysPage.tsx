import * as React from 'react';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/server-priv/Icon';
import getApiKeys, { ApiKey } from '@/api/account/getApiKeys';
import createApiKey from '@/api/account/createApiKey';
import deleteApiKey from '@/api/account/deleteApiKey';
import { httpErrorToHuman } from '@/api/http';
import { format } from 'date-fns';
import Spinner from '@/components/elements/Spinner';

// /account/api — priv-styled API key manager. Keeps the same backend
// contract (description + newline-separated allowed IPs) but renders
// inside the new shell. The full secret token is shown once in a modal
// after creation; the list afterwards only shows the public identifier.

const TokenModal = ({ token, onDismiss }: { token: string; onDismiss: () => void }) => {
    const [copied, setCopied] = useState(false);
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
            <div className={'panel'} style={{ width: 540, maxWidth: '100%' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>Your API key</h3>
                </div>
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.55 }}>
                        Copy this now. The full token is only shown once — after you close this dialog only the
                        identifier will be visible.
                    </p>
                    <pre
                        style={{
                            margin: 0, padding: '12px 14px', borderRadius: 8,
                            background: 'var(--surface-2)', border: '1px solid var(--line)',
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5,
                            color: 'var(--text)', wordBreak: 'break-all', whiteSpace: 'pre-wrap',
                        }}
                    >
                        {token}
                    </pre>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                            className={'btn'}
                            onClick={async () => {
                                try { await navigator.clipboard.writeText(token); setCopied(true); } catch { /* noop */ }
                            }}
                        >
                            <Icon name={'copy'} size={13} />{copied ? 'Copied' : 'Copy'}
                        </button>
                        <button className={'btn btn-primary'} onClick={onDismiss}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ApiKeysPage = () => {
    const [keys, setKeys] = useState<ApiKey[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [description, setDescription] = useState('');
    const [allowedIps, setAllowedIps] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [showToken, setShowToken] = useState<string | null>(null);

    const [deleteIdentifier, setDeleteIdentifier] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        let alive = true;
        getApiKeys()
            .then((k) => alive && setKeys(k))
            .catch((e) => alive && setError(httpErrorToHuman(e as Error)))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, []);

    const onCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim() || description.trim().length < 4) {
            setCreateError('Description must be at least 4 characters.');
            return;
        }
        setCreating(true);
        setCreateError(null);
        try {
            const { secretToken, ...key } = await createApiKey(description.trim(), allowedIps);
            setKeys((prev) => [...(prev ?? []), key]);
            setShowToken(`${key.identifier}${secretToken}`);
            setDescription('');
            setAllowedIps('');
        } catch (e) {
            setCreateError(httpErrorToHuman(e as Error));
        } finally {
            setCreating(false);
        }
    };

    const onDelete = async () => {
        if (!deleteIdentifier) return;
        setDeleting(true);
        try {
            await deleteApiKey(deleteIdentifier);
            setKeys((prev) => (prev ?? []).filter((k) => k.identifier !== deleteIdentifier));
            setDeleteIdentifier(null);
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className={'sub-main'} style={{ padding: '20px 24px 32px' }}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>API keys</div>
                    <div className={'page-sub'}>
                        Programmatic access to the panel API. Each key inherits your account&apos;s permissions.
                    </div>
                </div>
            </div>

            {error && (
                <div className={'notice warn'} style={{ marginBottom: 12 }}>
                    <Icon name={'zap'} size={14} />{error}
                </div>
            )}

            <div
                style={{
                    display: 'grid', gap: 14,
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
                }}
            >
                <div className={'panel'} style={{ padding: 18 }}>
                    <div style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4,
                    }}>
                        Create key
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 14 }}>
                        Generate a new bearer token for the panel API. The full token is shown once.
                    </div>
                    <form onSubmit={onCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label className={'priv-label'}>Description</label>
                            <input
                                className={'priv-input'}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={'e.g. CI deploy'}
                                maxLength={120}
                            />
                        </div>
                        <div>
                            <label className={'priv-label'}>Allowed IPs</label>
                            <textarea
                                className={'priv-input'}
                                value={allowedIps}
                                onChange={(e) => setAllowedIps(e.target.value)}
                                placeholder={'1.2.3.4&#10;10.0.0.0/24'}
                                rows={5}
                                style={{ resize: 'vertical' }}
                            />
                            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
                                One IP or CIDR per line. Empty allows any IP.
                            </div>
                        </div>
                        {createError && (
                            <div className={'notice warn'}>
                                <Icon name={'zap'} size={14} />{createError}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type={'submit'} className={'btn btn-primary'} disabled={creating}>
                                {creating
                                    ? <><Icon name={'restart'} size={13} className={'spin'} />Creating…</>
                                    : <><Icon name={'plus'} size={13} />Create key</>}
                            </button>
                        </div>
                    </form>
                </div>

                <div className={'panel'} style={{ padding: 0 }}>
                    <div style={{
                        padding: '14px 18px', borderBottom: '1px solid var(--line)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <div style={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: 14, fontWeight: 600, color: 'var(--text)',
                        }}>
                            Existing keys
                        </div>
                        <span className={'tag'} style={{ background: 'var(--surface-2)' }}>
                            {keys?.length ?? 0}
                        </span>
                    </div>
                    {loading ? (
                        <div style={{ padding: 32, textAlign: 'center' }}>
                            <Spinner size={'small'} />
                        </div>
                    ) : !keys || keys.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                            No API keys yet.
                        </div>
                    ) : (
                        keys.map((k) => (
                            <div
                                key={k.identifier}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 18px', borderBottom: '1px solid var(--line)',
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {k.description}
                                    </div>
                                    <div style={{
                                        fontSize: 11, color: 'var(--text-faint)', marginTop: 2,
                                        fontFamily: "'JetBrains Mono', monospace",
                                    }}>
                                        <code style={{ background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4 }}>
                                            {k.identifier}
                                        </code>
                                        <span style={{ marginLeft: 8 }}>
                                            last used {k.lastUsedAt ? format(k.lastUsedAt, 'MMM do, yyyy HH:mm') : 'never'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    className={'btn btn-danger btn-sm'}
                                    onClick={() => setDeleteIdentifier(k.identifier)}
                                >
                                    <Icon name={'trash'} size={12} />Delete
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {deleteIdentifier && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        background: 'rgba(8,8,12,0.72)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 24,
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) setDeleteIdentifier(null); }}
                >
                    <div className={'panel'} style={{ width: 460, maxWidth: '100%' }}>
                        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
                            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>Delete API key</h3>
                        </div>
                        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>
                                All requests using <code style={{
                                    background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4,
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}>{deleteIdentifier}</code> will be rejected immediately. This can&apos;t be undone.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className={'btn'} onClick={() => setDeleteIdentifier(null)} disabled={deleting}>
                                    Cancel
                                </button>
                                <button className={'btn btn-danger'} onClick={onDelete} disabled={deleting}>
                                    {deleting
                                        ? <><Icon name={'restart'} size={13} className={'spin'} />Deleting…</>
                                        : <><Icon name={'trash'} size={13} />Delete key</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showToken && <TokenModal token={showToken} onDismiss={() => setShowToken(null)} />}
        </div>
    );
};

export default ApiKeysPage;
