import * as React from 'react';
import { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import getServerDatabases, { ServerDatabase } from '@/api/server/databases/getServerDatabases';
import createServerDatabase from '@/api/server/databases/createServerDatabase';
import deleteServerDatabase from '@/api/server/databases/deleteServerDatabase';
import rotateDatabasePassword from '@/api/server/databases/rotateDatabasePassword';
import { httpErrorToHuman } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import { Icon } from './Icon';

// Databases page — wireframe layout backed by the real
// /api/client/servers/<uuid>/databases endpoint set. Each db card has
// connection-string row, copy/rotate-password/delete actions, and inline
// metadata. "New database" is a prompt-driven flow for now (real modal
// can come in a polish pass).

const copyToClipboard = async (text: string) => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    } catch (e) {
        console.error('copy failed', e);
    }
};

export const DatabasesPage = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const limit = ServerContext.useStoreState((s) => s.server.data!.featureLimits.databases);

    const [databases, setDatabases] = useState<ServerDatabase[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());

    const refresh = async () => {
        try {
            const data = await getServerDatabases(uuid);
            setDatabases(data);
        } catch (e) {
            setLoadError(httpErrorToHuman(e as Error));
        }
    };

    useEffect(() => {
        refresh();
    }, [uuid]);

    const handleCreate = async () => {
        if (creating) return;
        const name = prompt('Database name:', '');
        if (!name) return;
        const remote = prompt('Allow connections from (CIDR or %):', '%') ?? '%';
        try {
            setCreating(true);
            const created = await createServerDatabase(uuid, {
                databaseName: name,
                connectionsFrom: remote,
            });
            setDatabases((prev) => [...(prev || []), created]);
            // auto-reveal the password on the freshly-created db
            setRevealedPasswords((prev) => new Set(prev).add(created.id));
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (db: ServerDatabase) => {
        if (!confirm(`Delete database "${db.name}"? This drops all data permanently.`)) return;
        try {
            setBusyId(db.id);
            await deleteServerDatabase(uuid, db.id);
            setDatabases((prev) => (prev || []).filter((x) => x.id !== db.id));
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusyId(null);
        }
    };

    const handleRotate = async (db: ServerDatabase) => {
        if (!confirm(`Rotate password for "${db.name}"? Existing connections will break.`)) return;
        try {
            setBusyId(db.id);
            const updated = await rotateDatabasePassword(uuid, db.id);
            setDatabases((prev) => (prev || []).map((x) => (x.id === db.id ? updated : x)));
            setRevealedPasswords((prev) => new Set(prev).add(db.id));
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusyId(null);
        }
    };

    const togglePassword = (id: string) => {
        setRevealedPasswords((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const dbCount = databases?.length ?? 0;
    const atLimit = limit > 0 && dbCount >= limit;

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Databases</div>
                    <div className={'page-sub'}>
                        MySQL/MariaDB databases for plugins. Provisioned on the same datacenter as your server.
                    </div>
                </div>
                <div className={'spacer'} />
                <button
                    className={'btn btn-primary'}
                    onClick={handleCreate}
                    disabled={creating || atLimit}
                    title={atLimit ? `Hit your database limit (${limit})` : undefined}
                >
                    <Icon name={'plus'} size={13} />
                    {creating ? 'Creating…' : 'New database'}
                </button>
            </div>

            <div className={'strip'}>
                <div className={'stat'}>
                    <div className={'sl'}>Databases</div>
                    <div className={'sv'}>
                        {dbCount}{limit > 0 && <span style={{ fontSize: 14, color: 'var(--text-faint)', fontWeight: 400 }}> / {limit}</span>}
                    </div>
                    <div className={'sd'}>{atLimit ? 'limit reached' : 'available'}</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Total size</div>
                    <div className={'sv'}>—</div>
                    <div className={'sd'}>not tracked</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Active conns</div>
                    <div className={'sv'}>—</div>
                    <div className={'sd'}>see phpMyAdmin</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Engine</div>
                    <div className={'sv'} style={{ fontSize: 16 }}>MariaDB</div>
                    <div className={'sd'}>MySQL-compatible</div>
                </div>
            </div>

            {loadError && (
                <div className={'notice warn'}>
                    <Icon name={'zap'} size={14} />
                    {loadError}
                </div>
            )}

            {databases === null ? (
                <div style={{ padding: 32, textAlign: 'center' }}>
                    <Spinner size={'large'} />
                </div>
            ) : databases.length === 0 ? (
                <div
                    style={{
                        padding: 40, textAlign: 'center',
                        color: 'var(--text-faint)', fontSize: 13,
                        border: '1px dashed var(--line)', borderRadius: 12,
                    }}
                >
                    No databases yet. Click <strong style={{ color: 'var(--text)' }}>New database</strong> above to provision one.
                </div>
            ) : (
                <div
                    className={'col gap-12'}
                    style={{ flex: 1, minHeight: 0, overflow: 'auto', gap: 12 }}
                >
                    {databases.map((db) => {
                        const busy = busyId === db.id;
                        const revealed = revealedPasswords.has(db.id);
                        const password = db.password || '';
                        return (
                            <div key={db.id} className={'db-card'}>
                                <div className={'row gap-8'} style={{ gap: 10 }}>
                                    <div className={'name'}>
                                        <Icon name={'db'} size={16} color={'var(--purple)'} />
                                        {db.name}
                                        <span
                                            style={{
                                                fontFamily: "'JetBrains Mono',monospace",
                                                fontSize: 11,
                                                color: 'var(--text-faint)',
                                                fontWeight: 400,
                                                marginLeft: 4,
                                            }}
                                        >
                                            allow {db.allowConnectionsFrom}
                                        </span>
                                    </div>
                                    <div className={'spacer'} />
                                    <button
                                        className={'btn btn-sm'}
                                        onClick={() => handleRotate(db)}
                                        disabled={busy}
                                        title={'Rotate password'}
                                    >
                                        <Icon name={'restart'} size={12} />Rotate password
                                    </button>
                                    <button
                                        className={'icon-btn'}
                                        onClick={() => handleDelete(db)}
                                        disabled={busy}
                                        title={'Delete database'}
                                        style={{ color: 'var(--pink)' }}
                                    >
                                        <Icon name={'trash'} size={13} />
                                    </button>
                                </div>

                                <div className={'conn-string'}>
                                    <span style={{ color: 'var(--text-faint)' }}>HOST</span>
                                    <span className={'v'} style={{ flex: '0 0 auto' }}>{db.connectionString}</span>
                                    <span style={{ width: 1, height: 14, background: 'var(--line)' }} />
                                    <span style={{ color: 'var(--text-faint)' }}>USER</span>
                                    <span className={'v'} style={{ flex: '0 0 auto' }}>{db.username}</span>
                                    <span style={{ width: 1, height: 14, background: 'var(--line)' }} />
                                    <span style={{ color: 'var(--text-faint)' }}>PASS</span>
                                    <span
                                        className={'v'}
                                        style={{
                                            flex: '0 0 auto',
                                            cursor: 'pointer',
                                            userSelect: revealed ? 'all' : 'none',
                                        }}
                                        onClick={() => togglePassword(db.id)}
                                        title={revealed ? 'Click to hide' : 'Click to reveal'}
                                    >
                                        {revealed && password ? password : '•••••••••••••'}
                                    </span>
                                    <div className={'spacer'} />
                                    <button
                                        className={'icon-btn'}
                                        title={'Copy connection URI'}
                                        onClick={() =>
                                            copyToClipboard(
                                                `mysql://${db.username}:${password || '<password>'}@${db.connectionString}/${db.name}`,
                                            )
                                        }
                                        disabled={!password}
                                    >
                                        <Icon name={'copy'} size={12} />
                                    </button>
                                </div>

                                <div
                                    className={'row gap-8'}
                                    style={{ fontSize: 12, color: 'var(--text-faint)', gap: 14 }}
                                >
                                    <span>
                                        <Icon name={'db'} size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                        {db.name}
                                    </span>
                                    <span style={{ width: 1, height: 12, background: 'var(--line)' }} />
                                    <span>
                                        <Icon name={'globe'} size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                        {db.connectionString}
                                    </span>
                                    <span style={{ width: 1, height: 12, background: 'var(--line)' }} />
                                    <span>connections from {db.allowConnectionsFrom}</span>
                                    <div className={'spacer'} />
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                                        id: {db.id}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DatabasesPage;
