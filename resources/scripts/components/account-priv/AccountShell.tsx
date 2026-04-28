import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link, useHistory, NavLink } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import LogoMark from '@/components/gynx/LogoMark';
import GynxServerStyles from '@/components/server-priv/styles';
import { Icon } from '@/components/server-priv/Icon';
import { ApplicationStore } from '@/state';
import getServers from '@/api/getServers';
import http from '@/api/http';

// Account-side equivalent of ServerShell. Renders the same gynx-server-priv
// dark chrome (topbar + tab strip + content area) instead of the legacy
// gynx AppShell so /account stops flashing the old gray sidebar when users
// land here from the avatar button.

// Tab list intentionally has just Profile & Security for now — the API
// Keys / SSH Keys / Activity Log routes still fall back to the legacy
// PageContentBlock chrome that doesn't match this shell. Re-add the tabs
// once those three pages have priv-styled equivalents.
const ACCOUNT_TABS = [
    { id: 'account',  label: 'Profile & Security', icon: 'shield' as const, path: '' },
];

const AccountTopbar = () => {
    const history = useHistory();
    const userInitial = useStoreState((s: ApplicationStore) => {
        const e = s.user.data?.email ?? '';
        return e ? e[0].toUpperCase() : '?';
    });

    // First-server lookup so the logo links straight to the user's server
    // rather than bouncing through DashboardRouter's RootRedirect (which is
    // exactly the AppShell flash we're trying to avoid).
    const [firstServerId, setFirstServerId] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        getServers({ page: 1 })
            .then(({ items }) => {
                if (!alive) return;
                if (items.length > 0) setFirstServerId(items[0].id);
            })
            .catch(() => undefined);
        return () => { alive = false; };
    }, []);

    const logoHref = firstServerId ? `/server/${firstServerId}` : '/';

    const onSignOut = async () => {
        try {
            await http.post('/auth/logout');
        } catch {
            // POST may 419 in dev; we still want to redirect either way.
        }
        window.location.href = '/auth/login';
    };

    return (
        <div className={'topbar'}>
            <Link to={logoHref} className={'logo'} aria-label={'gynx.gg home'}>
                <LogoMark size={26} alt={'gynx.gg'} />
            </Link>
            <div className={'divider-v'} />
            <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 14, fontWeight: 600, color: 'var(--text)',
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                <span style={{
                    fontSize: 11, color: 'var(--text-faint)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    you /
                </span>
                Account
            </div>
            <div className={'spacer'} />
            <button
                type={'button'}
                className={'btn'}
                onClick={() => firstServerId && history.push(`/server/${firstServerId}`)}
                disabled={!firstServerId}
                title={'Back to your server'}
            >
                <Icon name={'console'} size={13} />
                Server
            </button>
            <button
                type={'button'}
                className={'btn'}
                onClick={onSignOut}
                title={'Sign out'}
            >
                <Icon name={'zap'} size={13} />
                Sign out
            </button>
            <button
                type={'button'}
                className={'avatar'}
                onClick={() => history.push('/account')}
                title={'Account'}
                style={{ border: 'none', cursor: 'pointer', padding: 0 }}
            >
                {userInitial}
            </button>
        </div>
    );
};

const AccountTabs = () => (
    <div className={'server-header'}>
        <div className={'server-title-row'}>
            <h1 className={'server-title'}>Account</h1>
            <span className={'meta-text'}>
                <span>your sign-in, security, and credentials</span>
            </span>
            <div className={'spacer'} />
        </div>
        <div className={'tabs'}>
            {ACCOUNT_TABS.map((t) => {
                const to = t.path ? `/account/${t.path}` : '/account';
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
                    </NavLink>
                );
            })}
        </div>
    </div>
);

interface Props {
    children: React.ReactNode;
}

export const AccountShell = ({ children }: Props) => (
    <>
        <GynxServerStyles />
        <div className={'gynx-server-priv'}>
            <div className={'app'}>
                <div className={'layer'} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                    <AccountTopbar />
                    <AccountTabs />
                    {children}
                </div>
            </div>
        </div>
    </>
);

export default AccountShell;
