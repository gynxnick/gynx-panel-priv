import * as React from 'react';
import { NavLink, useRouteMatch } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
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
    { id: 'settings',  label: 'Settings',  icon: 'settings', path: 'settings' },
];

const Topbar = ({ serverName }: { serverName: string }) => {
    const userInitial = useStoreState((s: ApplicationStore) => {
        const e = s.user.data?.email ?? '';
        return e ? e[0].toUpperCase() : '?';
    });
    return (
        <div className={'topbar'}>
            <div className={'logo'}>
                gynx<span className={'logo-dot'} />gg
            </div>
            <div className={'divider-v'} />
            <div className={'server-pill'} title={'Switch server'}>
                <span className={'status-pill running'} style={{ padding: '2px 6px 2px 5px' }}>
                    <span className={'pulse'} />
                </span>
                <span>{serverName}</span>
                <Icon name={'chevron-down'} size={14} color={'var(--text-faint)'} />
            </div>
            <div className={'spacer'} />
            <div className={'search'}>
                <Icon name={'search'} size={14} />
                <span>Search servers, files, commands…</span>
                <span className={'kbd'}>⌘K</span>
            </div>
            <div className={'icon-btn'} title={'Notifications'}>
                <Icon name={'bell'} size={15} />
            </div>
            <div className={'avatar'}>{userInitial}</div>
        </div>
    );
};

interface ServerHeaderProps {
    name: string;
    statusLabel: string;
    metaParts: string[];
    onStop?: () => void;
    onRestart?: () => void;
    onKill?: () => void;
}

const ServerHeader = ({ name, statusLabel, metaParts, onStop, onRestart, onKill }: ServerHeaderProps) => {
    const match = useRouteMatch<{ id: string }>();
    return (
        <div className={'server-header'}>
            <div className={'server-title-row'}>
                <h1 className={'server-title'}>{name}</h1>
                <span className={'status-pill running'}>
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
                <button className={'btn'} onClick={onStop}>
                    <Icon name={'pause'} size={13} />Stop
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

export const ServerShell = ({ children }: Props) => {
    const server = ServerContext.useStoreState((s) => s.server.data);
    const status = ServerContext.useStoreState((s) => s.status.value);

    const name = server?.name ?? 'unknown';
    const eggName = server?.eggFeatures?.[0] ?? '';
    const node = server?.node ?? '';

    // wireframe uses "paper 1.21" / "node-fr-03" / "up 18d 4h" — pull from
    // server context where we can; fall back to placeholders so the layout
    // doesn't shift when data is loading.
    const metaParts = [
        eggName || 'paper 1.21',
        node ? `node-${node.toLowerCase().replace(/\s+/g, '-')}` : 'node-fr-03',
        'up 18d 4h',
    ];

    const statusLabel = status === 'running' ? 'Running'
        : status === 'starting' ? 'Starting'
        : status === 'stopping' ? 'Stopping'
        : status === 'offline' ? 'Offline'
        : 'Unknown';

    return (
        <>
            <GynxServerStyles />
            <div className={'gynx-server-priv'}>
                <div className={'app'}>
                    <div className={'layer'} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                        <Topbar serverName={name} />
                        <ServerHeader name={name} statusLabel={statusLabel} metaParts={metaParts} />
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ServerShell;
