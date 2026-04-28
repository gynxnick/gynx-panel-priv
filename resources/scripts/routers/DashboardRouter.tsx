import React, { useEffect, useState } from 'react';
import { Route, Switch, useHistory } from 'react-router-dom';
import { NotFound } from '@/components/elements/ScreenBlock';
import TransitionRouter from '@/TransitionRouter';
import { useLocation } from 'react-router';
import Spinner from '@/components/elements/Spinner';
import getServers from '@/api/getServers';
import { httpErrorToHuman } from '@/api/http';
import routes from '@/routers/routes';
import AppShell from '@/components/gynx/AppShell';
import TopBar from '@/components/gynx/TopBar';

// Root index — auto-redirect to the user's first server. Keeps no
// dashboard server-list page in the new shell (gynx.gg users mostly
// have one server; the picker in the per-server topbar is the
// switcher for the rest). If the user has no servers we fall back to
// a single-line message.
const RootRedirect = () => {
    const history = useHistory();
    const [error, setError] = useState<string | null>(null);
    const [empty, setEmpty] = useState(false);

    useEffect(() => {
        let alive = true;
        getServers({ page: 1 })
            .then(({ items }) => {
                if (!alive) return;
                if (items.length > 0) {
                    history.replace(`/server/${items[0].id}`);
                } else {
                    setEmpty(true);
                }
            })
            .catch((e) => alive && setError(httpErrorToHuman(e as Error)));
        return () => {
            alive = false;
        };
    }, [history]);

    if (error) {
        return (
            <div style={{ padding: 32, textAlign: 'center', color: '#F87171', fontSize: 14 }}>
                {error}
            </div>
        );
    }
    if (empty) {
        return (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--gynx-text-dim)', fontSize: 14 }}>
                You don&apos;t have any servers on this account yet. Contact gynx.gg support.
            </div>
        );
    }
    return <Spinner centered />;
};

export default () => {
    const location = useLocation();
    const inAccount = location.pathname.startsWith('/account');

    const header = (
        <TopBar.Dashboard eyebrow={'you'} title={'account'} />
    );

    return (
        <AppShell header={inAccount ? header : undefined}>
            <TransitionRouter>
                <React.Suspense fallback={<Spinner centered />}>
                    <Switch location={location}>
                        <Route path={'/'} exact>
                            <RootRedirect />
                        </Route>
                        {routes.account.map(({ path, component: Component }) => (
                            <Route key={path} path={`/account/${path}`.replace('//', '/')} exact>
                                <Component />
                            </Route>
                        ))}
                        <Route path={'*'}>
                            <NotFound />
                        </Route>
                    </Switch>
                </React.Suspense>
            </TransitionRouter>
        </AppShell>
    );
};
