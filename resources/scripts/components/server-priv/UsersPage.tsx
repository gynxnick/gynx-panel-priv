import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ServerContext } from '@/state/server';
import { Subuser } from '@/state/server/subusers';
import getServerSubusers from '@/api/server/users/getServerSubusers';
import deleteSubuser from '@/api/server/users/deleteSubuser';
import EditSubuserModal from '@/components/server/users/EditSubuserModal';
import { httpErrorToHuman } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import { Icon } from './Icon';

// Users page — wireframe layout backed by the real Pterodactyl
// subusers API. The wireframe assumes coarse role tiers
// (Owner/Admin/Mod/Viewer) but Pterodactyl uses fine-grained
// permission strings, so the role pill is derived from the size of
// the permission set (Admin > 30, Mod > 10, Viewer otherwise).
// "Owner" is shown only on the current account holder, which the
// subuser API doesn't surface — falls back to permission-count tiers.
//
// Edit modal is the legacy EditSubuserModal — same form, same
// permission tree, opens via a state toggle.

const initials = (s: string): string => {
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (s.slice(0, 2) || '??').toUpperCase();
};

interface DerivedRole {
    key: 'admin' | 'mod' | 'viewer';
    label: 'Admin' | 'Mod' | 'Viewer';
}

const roleFor = (permCount: number): DerivedRole => {
    if (permCount >= 30) return { key: 'admin', label: 'Admin' };
    if (permCount >= 10) return { key: 'mod', label: 'Mod' };
    return { key: 'viewer', label: 'Viewer' };
};

export const UsersPage = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const subusers = ServerContext.useStoreState((s) => s.subusers.data);
    const setSubusers = ServerContext.useStoreActions((a) => a.subusers.setSubusers);
    const removeSubuser = ServerContext.useStoreActions((a) => a.subusers.removeSubuser);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busyUuid, setBusyUuid] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'admin' | 'mod' | 'viewer'>('all');
    const [search, setSearch] = useState('');

    const [editing, setEditing] = useState<Subuser | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        setLoadError(null);
        getServerSubusers(uuid)
            .then(setSubusers)
            .catch((e) => setLoadError(httpErrorToHuman(e as Error)))
            .finally(() => setLoading(false));
    }, [uuid]);

    const filtered = useMemo(() => {
        return subusers.filter((u) => {
            const role = roleFor(u.permissions.length);
            if (filter !== 'all' && role.key !== filter) return false;
            if (search) {
                const q = search.toLowerCase();
                if (!u.username.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [subusers, filter, search]);

    const counts = useMemo(() => {
        const out = { admin: 0, mod: 0, viewer: 0, twoFA: 0 };
        subusers.forEach((u) => {
            const r = roleFor(u.permissions.length);
            out[r.key]++;
            if (u.twoFactorEnabled) out.twoFA++;
        });
        return out;
    }, [subusers]);

    const handleDelete = async (u: Subuser) => {
        if (!confirm(`Remove ${u.username} (${u.email}) from this server?`)) return;
        try {
            setBusyUuid(u.uuid);
            await deleteSubuser(uuid, u.uuid);
            removeSubuser(u.uuid);
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusyUuid(null);
        }
    };

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Users</div>
                    <div className={'page-sub'}>
                        Sub-users with access to this server. Permissions are scoped per-server.
                    </div>
                </div>
                <div className={'spacer'} />
                <button className={'btn btn-primary'} onClick={() => setCreating(true)}>
                    <Icon name={'plus'} size={13} />Invite user
                </button>
            </div>

            <div className={'strip'}>
                <div className={'stat'}>
                    <div className={'sl'}>Total users</div>
                    <div className={'sv'}>{subusers.length}</div>
                    <div className={'sd'}>{subusers.length === 1 ? '1 sub-user' : `${subusers.length} sub-users`}</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Admins</div>
                    <div className={'sv'}>{counts.admin}</div>
                    <div className={'sd'}>30+ permissions</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Mods</div>
                    <div className={'sv'}>{counts.mod}</div>
                    <div className={'sd'}>10–30 permissions</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>2FA enabled</div>
                    <div className={'sv'}>
                        {counts.twoFA}
                        <span style={{ fontSize: 14, color: 'var(--text-faint)', fontWeight: 400 }}>
                            {' '}/ {subusers.length}
                        </span>
                    </div>
                    <div className={'sd'}>
                        {subusers.length === 0
                            ? '—'
                            : `${Math.round((counts.twoFA / subusers.length) * 100)}%`}
                    </div>
                </div>
            </div>

            <div className={'row gap-8'} style={{ gap: 10 }}>
                <div className={'search-lg'}>
                    <Icon name={'search'} size={14} />
                    <input
                        placeholder={'Search by name or email…'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className={'row gap-6'} style={{ gap: 6 }}>
                    {([
                        ['all', 'All'],
                        ['admin', 'Admin'],
                        ['mod', 'Mod'],
                        ['viewer', 'Viewer'],
                    ] as const).map(([key, label]) => (
                        <span
                            key={key}
                            className={`chip ${filter === key ? 'active' : ''}`}
                            onClick={() => setFilter(key)}
                        >
                            {label}
                        </span>
                    ))}
                </div>
            </div>

            {loadError && (
                <div className={'notice warn'}>
                    <Icon name={'zap'} size={14} />
                    {loadError}
                </div>
            )}

            {loading ? (
                <div style={{ padding: 32, textAlign: 'center' }}>
                    <Spinner size={'large'} />
                </div>
            ) : subusers.length === 0 ? (
                <div
                    style={{
                        padding: 40, textAlign: 'center',
                        color: 'var(--text-faint)', fontSize: 13,
                        border: '1px dashed var(--line)', borderRadius: 12,
                    }}
                >
                    No sub-users yet. Click <strong style={{ color: 'var(--text)' }}>Invite user</strong> above to share access.
                </div>
            ) : filtered.length === 0 ? (
                <div
                    style={{
                        padding: 24, textAlign: 'center',
                        color: 'var(--text-faint)', fontSize: 13,
                        border: '1px dashed var(--line)', borderRadius: 10,
                    }}
                >
                    No users match the current filter.
                </div>
            ) : (
                <div
                    className={'col gap-8'}
                    style={{ flex: 1, minHeight: 0, overflow: 'auto', gap: 8 }}
                >
                    {filtered.map((u) => {
                        const role = roleFor(u.permissions.length);
                        const busy = busyUuid === u.uuid;
                        return (
                            <div key={u.uuid} className={'user-row'}>
                                <div className={'user-avatar'}>{initials(u.username || u.email)}</div>
                                <div>
                                    <div
                                        style={{
                                            fontFamily: "'Space Grotesk',sans-serif",
                                            fontSize: 14, fontWeight: 600, color: 'white',
                                        }}
                                    >
                                        {u.username || u.email.split('@')[0]}
                                        {u.twoFactorEnabled && (
                                            <span
                                                style={{
                                                    marginLeft: 8, fontSize: 10,
                                                    padding: '2px 6px', borderRadius: 4,
                                                    background: 'rgba(52,211,153,0.12)',
                                                    color: '#6ee7b7',
                                                    border: '1px solid rgba(52,211,153,0.3)',
                                                }}
                                            >2FA</span>
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12, color: 'var(--text-faint)',
                                            fontFamily: "'JetBrains Mono',monospace", marginTop: 2,
                                        }}
                                    >
                                        {u.email}
                                    </div>
                                </div>
                                <span
                                    className={`role-badge role-${role.key}`}
                                    style={{ width: 'fit-content' }}
                                    title={`${u.permissions.length} permission${u.permissions.length === 1 ? '' : 's'}`}
                                >
                                    {role.key === 'admin' && <Icon name={'settings'} size={11} />}
                                    {role.label}
                                </span>
                                <div
                                    style={{
                                        fontSize: 12, color: 'var(--text-faint)',
                                        fontFamily: "'JetBrains Mono',monospace",
                                    }}
                                >
                                    {u.permissions.length} perm{u.permissions.length === 1 ? '' : 's'}
                                </div>
                                <div className={'row gap-4'} style={{ justifyContent: 'flex-end', gap: 4 }}>
                                    <button
                                        className={'icon-btn'}
                                        onClick={() => setEditing(u)}
                                        title={'Edit permissions'}
                                        disabled={busy}
                                    >
                                        <Icon name={'settings'} size={13} />
                                    </button>
                                    <button
                                        className={'icon-btn'}
                                        onClick={() => handleDelete(u)}
                                        title={'Remove user'}
                                        disabled={busy}
                                        style={{ color: 'var(--pink)' }}
                                    >
                                        <Icon name={'trash'} size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/*
              Reuse the legacy edit modal. Props are { visible,
              onModalDismissed, subuser? } — see AddSubuserButton +
              UserRow for the pattern. New invite = no subuser prop.
            */}
            <EditSubuserModal
                visible={creating}
                onModalDismissed={() => setCreating(false)}
            />
            {editing && (
                <EditSubuserModal
                    subuser={editing}
                    visible={!!editing}
                    onModalDismissed={() => setEditing(null)}
                />
            )}
        </div>
    );
};

export default UsersPage;
