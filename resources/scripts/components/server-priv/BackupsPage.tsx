import * as React from 'react';
import { useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ServerContext } from '@/state/server';
import { ServerBackup } from '@/api/server/types';
import getServerBackups, { Context as ServerBackupContext } from '@/api/swr/getServerBackups';
import getBackupDownloadUrl from '@/api/server/backups/getBackupDownloadUrl';
import deleteBackup from '@/api/server/backups/deleteBackup';
import createServerBackup from '@/api/server/backups/createServerBackup';
import { restoreServerBackup } from '@/api/server/backups';
import { bytesToString } from '@/lib/formatters';
import { httpErrorToHuman } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import { Icon } from './Icon';

/**
 * Backups page — wireframe layout backed by the real Pterodactyl backups
 * API. Stat strip, in-progress card (when a backup is mid-flight), and
 * the snapshot list all run on real data. Per-row actions wire to the
 * standard endpoints: createServerBackup, getBackupDownloadUrl,
 * deleteBackup, restoreServerBackup.
 */

interface BackupsViewProps {
    inner: boolean;
}

const BackupsView = (_: BackupsViewProps) => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const limit = ServerContext.useStoreState((s) => s.server.data!.featureLimits.backups);
    const { data, error, isValidating, mutate } = getServerBackups();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const history = useHistory();
    const match = useRouteMatch<{ id: string }>();

    const allBackups: ServerBackup[] = data?.items ?? [];
    const completedBackups = allBackups.filter((b) => b.completedAt !== null);
    const pending = allBackups.find((b) => b.completedAt === null);

    const totalBytes = completedBackups.reduce((sum, b) => sum + b.bytes, 0);
    const lockedCount = completedBackups.filter((b) => b.isLocked).length;
    const lastBackup = completedBackups.length > 0
        ? completedBackups.reduce((max, b) =>
            !max || (b.completedAt! > (max.completedAt ?? new Date(0))) ? b : max,
            null as ServerBackup | null,
        )
        : null;

    const handleCreate = async () => {
        if (creating) return;
        const name = prompt('Snapshot name (leave empty for auto-generated):', '');
        if (name === null) return;
        setCreating(true);
        try {
            await createServerBackup(uuid, { name: name || undefined, isLocked: false });
            await mutate();
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setCreating(false);
        }
    };

    const handleDownload = async (b: ServerBackup) => {
        try {
            setBusyId(b.uuid);
            const url = await getBackupDownloadUrl(uuid, b.uuid);
            window.location.href = url;
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (b: ServerBackup) => {
        if (b.isLocked) return;
        if (!confirm(`Delete backup "${b.name}"? This is permanent.`)) return;
        try {
            setBusyId(b.uuid);
            await deleteBackup(uuid, b.uuid);
            await mutate();
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusyId(null);
        }
    };

    const handleRestore = async (b: ServerBackup) => {
        if (!confirm(`Restore "${b.name}"? This stops the server and replaces files.`)) return;
        try {
            setBusyId(b.uuid);
            await restoreServerBackup(uuid, b.uuid);
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Backups</div>
                    <div className={'page-sub'}>
                        Snapshots of your full server. Restore in seconds, never lose progress.
                    </div>
                </div>
                <div className={'spacer'} />
                <button
                    className={'btn'}
                    onClick={() => history.push(`/server/${match.params.id}/schedules`)}
                    title={'Set up an automatic backup task in Schedules'}
                >
                    <Icon name={'clock'} size={13} />Backup schedule
                </button>
                <button
                    className={'btn btn-primary'}
                    onClick={handleCreate}
                    disabled={creating || (limit > 0 && completedBackups.length >= limit)}
                >
                    <Icon name={creating ? 'restart' : 'archive'} size={13} />
                    {creating ? 'Creating…' : 'Take snapshot'}
                </button>
            </div>

            <div className={'strip'}>
                <div className={'stat'}>
                    <div className={'sl'}>Slots used</div>
                    <div className={'sv'}>{completedBackups.length} / {limit || '∞'}</div>
                    <div className={'sd'}>{lockedCount > 0 ? `+ ${lockedCount} locked` : ' '}</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Total size</div>
                    <div className={'sv'}>{totalBytes > 0 ? bytesToString(totalBytes) : '—'}</div>
                    <div className={'sd'}>across all snapshots</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Last backup</div>
                    <div className={'sv'}>
                        {pending ? 'Now' : lastBackup?.completedAt
                            ? formatDistanceToNow(lastBackup.completedAt, { addSuffix: true })
                            : '—'}
                    </div>
                    <div className={'sd'}>
                        {pending ? 'in progress' : lastBackup ? format(lastBackup.completedAt!, 'PP') : 'no backups yet'}
                    </div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Restore time</div>
                    <div className={'sv'}>~ varies</div>
                    <div className={'sd'}>depends on size</div>
                </div>
            </div>

            {pending && (
                <div
                    className={'panel'}
                    style={{
                        padding: 16,
                        border: '1px solid rgba(124,58,237,0.5)',
                        background: 'linear-gradient(180deg, rgba(40,30,60,0.6), rgba(22,27,36,0.6))',
                    }}
                >
                    <div className={'row gap-8'} style={{ marginBottom: 10, gap: 10 }}>
                        <Icon name={'archive'} size={16} color={'var(--purple)'} />
                        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, color: 'white' }}>
                            Backup in progress
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--text-faint)' }}>
                            {pending.name}
                        </span>
                        <div className={'spacer'} />
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--purple)' }}>
                            running
                        </span>
                    </div>
                    <div className={'stripe-progress'}><div style={{ width: '100%' }} /></div>
                    <div
                        style={{
                            fontSize: 11.5,
                            color: 'var(--text-faint)',
                            marginTop: 8,
                            fontFamily: "'JetBrains Mono',monospace",
                        }}
                    >
                        Compressing… progress reported when complete.
                    </div>
                </div>
            )}

            {error ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--pink)', fontSize: 13 }}>
                    {httpErrorToHuman(error)}
                </div>
            ) : !data ? (
                <div style={{ padding: 32, textAlign: 'center' }}>
                    <Spinner size={'large'} />
                </div>
            ) : completedBackups.length === 0 ? (
                <div
                    style={{
                        padding: 32,
                        textAlign: 'center',
                        color: 'var(--text-faint)',
                        fontSize: 13,
                        border: '1px dashed var(--line)',
                        borderRadius: 12,
                    }}
                >
                    No backups yet. Take a snapshot to freeze the current state of your server.
                </div>
            ) : (
                <div className={'col gap-8'} style={{ flex: 1, minHeight: 0, overflow: 'auto', gap: 8 }}>
                    {completedBackups.map((b) => {
                        const isAuto = /^auto/i.test(b.name) || /weekly/i.test(b.name);
                        const busy = busyId === b.uuid;
                        return (
                            <div key={b.uuid} className={'backup-row'}>
                                <div className={`backup-icon ${isAuto ? 'auto' : ''}`}>
                                    <Icon name={isAuto ? 'restart' : 'archive'} size={18} color={'#fff'} />
                                </div>
                                <div>
                                    <div className={'backup-name'}>
                                        {b.name}
                                        {b.isLocked && (
                                            <span
                                                className={'tag'}
                                                style={{
                                                    marginLeft: 8,
                                                    background: 'rgba(245,158,11,0.12)',
                                                    borderColor: 'rgba(245,158,11,0.3)',
                                                    color: '#fde68a',
                                                }}
                                            >★ locked</span>
                                        )}
                                    </div>
                                    <div className={'backup-meta'}>
                                        {b.completedAt ? format(b.completedAt, 'PP · HH:mm') : '—'} · sha256:{(b.checksum || '').slice(0, 8)}…
                                    </div>
                                </div>
                                <div className={'mono'} style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                                    {bytesToString(b.bytes)}
                                </div>
                                <span
                                    className={`tag ${isAuto ? '' : 'featured'}`}
                                    style={{ width: 'fit-content' }}
                                >{isAuto ? 'auto' : 'manual'}</span>
                                <span className={'sd-status'} style={{ fontSize: 11.5 }}>
                                    <span
                                        className={'dot'}
                                        style={{
                                            background: b.isSuccessful ? 'var(--green)' : '#ef4444',
                                            boxShadow: `0 0 6px ${b.isSuccessful ? 'var(--green)' : '#ef4444'}`,
                                        }}
                                    />
                                    {b.isSuccessful ? 'Ready' : 'Failed'}
                                </span>
                                <div
                                    className={'row gap-4'}
                                    style={{ justifyContent: 'flex-end', gap: 4 }}
                                >
                                    <button
                                        className={'btn btn-sm'}
                                        disabled={busy || !b.isSuccessful}
                                        onClick={() => handleRestore(b)}
                                    >
                                        <Icon name={'restart'} size={11} />Restore
                                    </button>
                                    <button
                                        className={'icon-btn'}
                                        disabled={busy || !b.isSuccessful}
                                        onClick={() => handleDownload(b)}
                                        title={'Download'}
                                    >
                                        <Icon name={'download'} size={13} />
                                    </button>
                                    <button
                                        className={'icon-btn'}
                                        disabled={busy || b.isLocked}
                                        onClick={() => handleDelete(b)}
                                        title={b.isLocked ? 'Locked — unlock to delete' : 'Delete'}
                                        style={{ color: b.isLocked ? 'var(--text-faint)' : 'var(--pink)' }}
                                    >
                                        <Icon name={'trash'} size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {data && limit > 0 && completedBackups.length > 0 && (
                <div
                    style={{
                        fontSize: 11.5,
                        color: 'var(--text-faint)',
                        textAlign: 'center',
                        marginTop: 4,
                    }}
                >
                    {data.backupCount} of {limit} backup slots used
                    {isValidating && ' · refreshing…'}
                </div>
            )}
        </div>
    );
};

export const BackupsPage = () => {
    const [page, setPage] = useState<number>(1);
    return (
        <ServerBackupContext.Provider value={{ page, setPage }}>
            <BackupsView inner />
        </ServerBackupContext.Provider>
    );
};

export default BackupsPage;
