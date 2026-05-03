import * as React from 'react';
import { useState } from 'react';
import { Icon } from '@/components/server-priv/Icon';
import { useSSHKeys, createSSHKey, deleteSSHKey } from '@/api/account/ssh-keys';
import { httpErrorToHuman } from '@/api/http';
import { format } from 'date-fns';
import Spinner from '@/components/elements/Spinner';

// /account/ssh — priv-styled SSH key manager. Hits the same SWR-backed
// hooks as the legacy container; the wireframe is just a left-form /
// right-list layout matching the API keys page.

export const SshKeysPage = () => {
    const { data, isValidating, error: swrError, mutate } = useSSHKeys({
        revalidateOnMount: true,
        revalidateOnFocus: false,
    });

    const [name, setName] = useState('');
    const [publicKey, setPublicKey] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [deleteFingerprint, setDeleteFingerprint] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !publicKey.trim()) {
            setCreateError('Name and public key are both required.');
            return;
        }
        setCreating(true);
        setCreateError(null);
        try {
            const key = await createSSHKey(name.trim(), publicKey.trim());
            mutate((existing) => (existing ?? []).concat(key), false);
            setName('');
            setPublicKey('');
        } catch (e) {
            setCreateError(httpErrorToHuman(e as Error));
        } finally {
            setCreating(false);
        }
    };

    const onDelete = async () => {
        if (!deleteFingerprint) return;
        setDeleting(true);
        try {
            await deleteSSHKey(deleteFingerprint);
            mutate((existing) => (existing ?? []).filter((k) => k.fingerprint !== deleteFingerprint), false);
            setDeleteFingerprint(null);
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setDeleting(false);
        }
    };

    const loadingList = !data && isValidating;
    const apiError = swrError ? httpErrorToHuman(swrError) : error;

    return (
        <div className={'sub-main'} style={{ padding: '20px 24px 32px' }}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>SSH keys</div>
                    <div className={'page-sub'}>
                        Public keys you can use to authenticate against the server SFTP daemon. Paste OpenSSH-format
                        public keys (the line starting with <code style={{
                            background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4,
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                        }}>ssh-ed25519</code> or <code style={{
                            background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4,
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                        }}>ssh-rsa</code>).
                    </div>
                </div>
            </div>

            {apiError && (
                <div className={'notice warn'} style={{ marginBottom: 12 }}>
                    <Icon name={'zap'} size={14} />{apiError}
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
                        Add key
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 14 }}>
                        Pick a memorable name and paste the public half of your keypair.
                    </div>
                    <form onSubmit={onCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label className={'priv-label'}>Name</label>
                            <input
                                className={'priv-input'}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={'e.g. laptop'}
                                maxLength={120}
                            />
                        </div>
                        <div>
                            <label className={'priv-label'}>Public key</label>
                            <textarea
                                className={'priv-input'}
                                value={publicKey}
                                onChange={(e) => setPublicKey(e.target.value)}
                                placeholder={'ssh-ed25519 AAAA…'}
                                rows={6}
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                        {createError && (
                            <div className={'notice warn'}>
                                <Icon name={'zap'} size={14} />{createError}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type={'submit'} className={'btn btn-primary'} disabled={creating}>
                                {creating
                                    ? <><Icon name={'restart'} size={13} className={'spin'} />Saving…</>
                                    : <><Icon name={'plus'} size={13} />Save key</>}
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
                            {data?.length ?? 0}
                        </span>
                    </div>
                    {loadingList ? (
                        <div style={{ padding: 32, textAlign: 'center' }}>
                            <Spinner size={'small'} />
                        </div>
                    ) : !data || data.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                            No SSH keys yet.
                        </div>
                    ) : (
                        data.map((k) => (
                            <div
                                key={k.fingerprint}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 18px', borderBottom: '1px solid var(--line)',
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 13, color: 'var(--text)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {k.name}
                                    </div>
                                    <div style={{
                                        fontSize: 11, color: 'var(--text-faint)', marginTop: 2,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }} title={`SHA256:${k.fingerprint}`}>
                                        SHA256:{k.fingerprint}
                                    </div>
                                    <div style={{
                                        fontSize: 11, color: 'var(--text-faint)', marginTop: 2,
                                    }}>
                                        added {format(k.createdAt, 'MMM do, yyyy HH:mm')}
                                    </div>
                                </div>
                                <button
                                    className={'btn btn-danger btn-sm'}
                                    onClick={() => setDeleteFingerprint(k.fingerprint)}
                                >
                                    <Icon name={'trash'} size={12} />Delete
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {deleteFingerprint && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        background: 'rgba(8,8,12,0.72)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 24,
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) setDeleteFingerprint(null); }}
                >
                    <div className={'panel'} style={{ width: 460, maxWidth: '100%' }}>
                        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
                            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>Delete SSH key</h3>
                        </div>
                        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>
                                The key will stop authenticating immediately. You can always re-add it later.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className={'btn'} onClick={() => setDeleteFingerprint(null)} disabled={deleting}>
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
        </div>
    );
};

export default SshKeysPage;
