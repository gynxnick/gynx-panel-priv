import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useHistory, useRouteMatch } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import getServers from '@/api/getServers';
import { Server as ServerData } from '@/api/server/getServer';
import { httpErrorToHuman } from '@/api/http';
import LogoMark from '@/components/gynx/LogoMark';
import AlertBar from '@/components/gynx/AlertBar';
import AlertBell from '@/components/gynx/AlertBell';
import { useAlertPolling } from '@/components/gynx/useAlertPolling';
import GynxServerStyles from './styles';
import { Icon, IconName } from './Icon';

/**
 * Shell for the gynx-priv per-server view: topbar + server header (title /
 * status / power buttons / tabs). The layout is the same on every per-server
 * route — only the content under the tab strip swaps.
 *
 * Replaces the legacy AppShell + left-sidebar pattern for the per-server
 * route group only. Other top-level routes (account / dashboard) keep using
 * the existing AppShell.
 */

interface TabSpec {
    id: string;
    label: string;
    icon: IconName;
    /** path relative to /server/<id>/ — empty string === console */
    path: string;
    badge?: string;
    /** "new" badge gets the purple-tint variant */
    newBadge?: boolean;
}

const TABS: TabSpec[] = [
    { id: 'console',   label: 'Console',   icon: 'console',  path: '' },
    { id: 'install',   label: 'Install',   icon: 'sparkles', path: 'install', newBadge: true, badge: 'new' },
    { id: 'files',     label: 'Files',     icon: 'folder',   path: 'files' },
    { id: 'databases', label: 'Databases', icon: 'db',       path: 'databases' },
    { id: 'schedules', label: 'Schedules', icon: 'clock',    path: 'schedules' },
    { id: 'users',     label: 'Users',     icon: 'users',    path: 'users' },
    { id: 'backups',   label: 'Backups',   icon: 'archive',  path: 'backups' },
    { id: 'network',   label: 'Network',   icon: 'globe',    path: 'network' },
    { id: 'startup',   label: 'Startup',   icon: 'play',     path: 'startup' },
    { id: 'game',      label: 'Game',      icon: 'gamepad',  path: 'game' },
    { id: 'settings',  label: 'Settings',  icon: 'settings', path: 'settings' },
];

const ServerPicker = ({
    currentId, currentName, open, onOpenChange,
}: {
    currentId: string | undefined;
    currentName: string;
    open: boolean;
    onOpenChange: (next: boolean) => void;
}) => {
    const history = useHistory();
    const setOpen = onOpenChange;
    const [servers, setServers] = useState<ServerData[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Lazy-fetch server list on first open. Keep it cached afterwards.
    useEffect(() => {
        if (!open || servers !== null) return;
        getServers({ page: 1 })
            .then(({ items }) => setServers(items))
            .catch((e) => setError(httpErrorToHuman(e as Error)));
    }, [open, servers]);

    // Close on outside click + Esc.
    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
        if (!open) setQ('');
    }, [open]);

    const filtered = (servers ?? []).filter((s) =>
        !q || s.name.toLowerCase().includes(q.toLowerCase())
            || s.id.toLowerCase().includes(q.toLowerCase())
            || (s.node ?? '').toLowerCase().includes(q.toLowerCase()),
    );

    const navigateTo = (s: ServerData) => {
        if (s.id === currentId) {
            setOpen(false);
            return;
        }
        setOpen(false);
        history.push(`/server/${s.id}`);
    };

    return (
        <div ref={wrapRef} style={{ position: 'relative' }}>
            <div
                className={'server-pill'}
                title={'Switch server'}
                onClick={() => setOpen(!open)}
                style={{ userSelect: 'none' }}
            >
                <span className={'status-pill running'} style={{ padding: '2px 6px 2px 5px' }}>
                    <span className={'pulse'} />
                </span>
                <span>{currentName}</span>
                <Icon
                    name={'chevron-down'}
                    size={14}
                    color={'var(--text-faint)'}
                    style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s ease' }}
                />
            </div>
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 320,
                        zIndex: 50,
                        background: 'linear-gradient(180deg, rgba(31,41,55,0.95) 0%, rgba(22,27,36,0.95) 100%)',
                        border: '1px solid var(--line-2)',
                        borderRadius: 12,
                        boxShadow: '0 18px 48px -16px rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(12px)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            padding: 10,
                            borderBottom: '1px solid var(--line)',
                            background: 'rgba(0,0,0,0.2)',
                        }}
                    >
                        <div className={'search-lg'} style={{ height: 32, fontSize: 12 }}>
                            <Icon name={'search'} size={12} />
                            <input
                                ref={inputRef}
                                placeholder={'Find a server…'}
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ maxHeight: 360, overflow: 'auto', padding: 6 }}>
                        {error ? (
                            <div style={{ padding: 18, textAlign: 'center', color: 'var(--pink)', fontSize: 12.5 }}>
                                {error}
                            </div>
                        ) : servers === null ? (
                            <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5 }}>
                                Loading…
                            </div>
                        ) : filtered.length === 0 ? (
                            <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5 }}>
                                {servers.length === 0 ? 'No servers on this account.' : `No servers match "${q}".`}
                            </div>
                        ) : (
                            filtered.map((s) => {
                                const isCurrent = s.id === currentId;
                                return (
                                    <div
                                        key={s.uuid}
                                        onClick={() => navigateTo(s)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                            background: isCurrent ? 'rgba(124,58,237,0.12)' : 'transparent',
                                            transition: 'background .12s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isCurrent) {
                                                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isCurrent) {
                                                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                                            }
                                        }}
                                    >
                                        <span
                                            className={`status-pill ${
                                                s.status === 'installing' || s.status === 'restoring_backup'
                                                    ? 'starting'
                                                    : s.status === 'install_failed' || s.status === 'reinstall_failed'
                                                    ? 'offline'
                                                    : s.status === 'suspended'
                                                    ? 'offline'
                                                    : 'running'
                                            }`}
                                            style={{ padding: '2px 6px 2px 5px', flexShrink: 0 }}
                                        >
                                            <span className={'pulse'} />
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: isCurrent ? 'white' : 'var(--text)',
                                                    fontWeight: 500,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {s.name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: 'var(--text-faint)',
                                                    fontFamily: "'JetBrains Mono', monospace",
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {s.node ? `node-${s.node.toLowerCase().replace(/\s+/g, '-')}` : '—'} · #{s.id}
                                            </div>
                                        </div>
                                        {isCurrent && (
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    color: 'var(--purple-light)',
                                                    fontFamily: "'JetBrains Mono',monospace",
                                                    flexShrink: 0,
                                                }}
                                            >current</span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const Topbar = ({ serverName, currentId }: { serverName: string; currentId: string | undefined }) => {
    const userInitial = useStoreState((s: ApplicationStore) => {
        const e = s.user.data?.email ?? '';
        return e ? e[0].toUpperCase() : '?';
    });
    const history = useHistory();

    // Picker open state lives here so both the pill (inside ServerPicker)
    // and the topbar's search box can toggle it.
    const [pickerOpen, setPickerOpen] = useState(false);

    // ⌘K / ctrl-K keyboard shortcut → open the picker. The picker's
    // input auto-focuses on open so users can start typing immediately.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPickerOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Logo target: the current server's console. Linking to "/" here would
    // bounce through DashboardRouter → RootRedirect → /server/<id>, and the
    // legacy AppShell flashes for the duration of the getServers call. Going
    // straight to the current server avoids that round-trip entirely.
    const logoHref = currentId ? `/server/${currentId}` : '/';
    return (
        <div className={'topbar'}>
            <Link to={logoHref} className={'logo'} aria-label={'gynx.gg home'}>
                <LogoMark size={26} alt={'gynx.gg'} />
            </Link>
            <div className={'divider-v'} />
            <ServerPicker
                currentId={currentId}
                currentName={serverName}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
            />
            <div className={'spacer'} />
            <div
                className={'search'}
                role={'button'}
                onClick={() => setPickerOpen(true)}
                style={{ cursor: 'pointer' }}
                title={'Open server switcher (⌘K)'}
            >
                <Icon name={'search'} size={14} />
                <span>Switch server, find files…</span>
                <span className={'kbd'}>⌘K</span>
            </div>
            <AlertBell />
            <button
                type={'button'}
                className={'avatar'}
                onClick={() => history.push('/account')}
                title={'Account settings'}
                style={{ border: 'none', cursor: 'pointer', padding: 0 }}
            >
                {userInitial}
            </button>
        </div>
    );
};

interface ServerHeaderProps {
    name: string;
    statusLabel: string;
    statusClass: string;
    metaParts: string[];
    canStop: boolean;
    onStop?: () => void;
    onRestart?: () => void;
    onKill?: () => void;
    killable: boolean;
}

const ServerHeader = ({
    name, statusLabel, statusClass, metaParts, canStop, onStop, onRestart, onKill, killable,
}: ServerHeaderProps) => {
    const match = useRouteMatch<{ id: string }>();
    return (
        <div className={'server-header'}>
            <div className={'server-title-row'}>
                <h1 className={'server-title'}>{name}</h1>
                <span className={`status-pill ${statusClass}`}>
                    <span className={'pulse'} />
                    {statusLabel}
                </span>
                <span className={'meta-text'}>
                    {metaParts.map((part, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <span className={'sep'}>·</span>}
                            {part}
                        </React.Fragment>
                    ))}
                </span>
                <div className={'spacer'} />
                <button className={'btn'} onClick={onStop} disabled={!canStop}>
                    <Icon name={'pause'} size={13} />{killable ? 'Stop' : 'Stop'}
                </button>
                <button className={'btn'} onClick={onRestart}>
                    <Icon name={'restart'} size={13} />Restart
                </button>
                <button className={'btn btn-danger'} onClick={onKill}>
                    <Icon name={'zap'} size={13} />Kill
                </button>
            </div>

            <div className={'tabs'}>
                {TABS.map((t) => {
                    const to = `${match.url.replace(/\/+$/, '')}${t.path ? '/' + t.path : ''}`;
                    return (
                        <NavLink
                            key={t.id}
                            to={to}
                            exact={t.path === ''}
                            className={'tab'}
                            activeClassName={'active'}
                        >
                            <Icon name={t.icon} size={13} />
                            {t.label}
                            {t.badge && <span className={`badge ${t.newBadge ? 'new' : ''}`}>{t.badge}</span>}
                        </NavLink>
                    );
                })}
            </div>
        </div>
    );
};

interface Props {
    children: React.ReactNode;
    /** When false, hides the right rail container around children (no-op here — pages
     *  decide their own grid layout). Kept for parity with the wireframe. */
    fullWidth?: boolean;
}

/**
 * Track when the server entered the running state so we can render
 * "up 4h 12m" in the meta line. Reset whenever status leaves running.
 */
const useUptime = (status: string | null | undefined): string => {
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [, tick] = useState(0);

    useEffect(() => {
        if (status === 'running') {
            setStartedAt((prev) => prev ?? Date.now());
        } else {
            setStartedAt(null);
        }
    }, [status]);

    useEffect(() => {
        if (!startedAt) return;
        const id = window.setInterval(() => tick((n) => n + 1), 30_000);
        return () => window.clearInterval(id);
    }, [startedAt]);

    if (!startedAt) return status === 'offline' ? 'offline' : status === 'starting' ? 'starting…' : '—';
    const ms = Date.now() - startedAt;
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `up ${d}d ${h}h`;
    if (h > 0) return `up ${h}h ${m}m`;
    if (m > 0) return `up ${m}m`;
    return `up ${s}s`;
};

export const ServerShell = ({ children }: Props) => {
    // Alerts: poll once per shell mount. Same hook the legacy AppShell uses;
    // updates state.alerts which AlertBar + AlertBell read from.
    useAlertPolling();

    const server = ServerContext.useStoreState((s) => s.server.data);
    const status = ServerContext.useStoreState((s) => s.status.value);
    const instance = ServerContext.useStoreState((s) => s.socket.instance);
    const connected = ServerContext.useStoreState((s) => s.socket.connected);

    const name = server?.name ?? 'unknown';
    const serverId = server?.id;
    const eggName = server?.eggFeatures?.[0] ?? '';
    const node = server?.node ?? '';
    const uptime = useUptime(status);

    const metaParts = [
        eggName || 'paper 1.21',
        node ? `node-${node.toLowerCase().replace(/\s+/g, '-')}` : 'node-fr-03',
        uptime,
    ];

    const statusLabel = status === 'running' ? 'Running'
        : status === 'starting' ? 'Starting'
        : status === 'stopping' ? 'Stopping'
        : status === 'offline' ? 'Offline'
        : '—';
    const statusClass = status === 'running' ? 'running'
        : status === 'starting' ? 'starting'
        : status === 'stopping' ? 'stopping'
        : status === 'offline' ? 'offline'
        : '';

    const killable = status === 'stopping';
    const canStop = !!status && status !== 'offline';

    const send = (action: 'start' | 'restart' | 'stop' | 'kill') => {
        if (!instance || !connected) return;
        instance.send('set state', action);
    };
    const onStop = () => send(killable ? 'kill' : 'stop');
    const onRestart = () => send('restart');
    const onKill = () => {
        if (!confirm('Forcibly stop the server? This can corrupt data.')) return;
        send('kill');
    };

    return (
        <>
            <GynxServerStyles />
            <div className={'gynx-server-priv'}>
                <div className={'app'}>
                    <div className={'layer'} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                        <Topbar serverName={name} currentId={serverId} />
                        <AlertBar />
                        <ServerHeader
                            name={name}
                            statusLabel={statusLabel}
                            statusClass={statusClass}
                            metaParts={metaParts}
                            canStop={canStop}
                            onStop={onStop}
                            onRestart={onRestart}
                            onKill={onKill}
                            killable={killable}
                        />
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ServerShell;
