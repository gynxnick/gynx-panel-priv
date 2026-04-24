import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useRouteMatch } from 'react-router-dom';
import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';
import { useStoreState } from 'easy-peasy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faAngleDoubleLeft,
    faAngleDoubleRight,
    faCogs,
    faHome,
    faSearch,
    faSignOutAlt,
    faUser,
    IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import Can from '@/components/elements/Can';

import { ApplicationStore } from '@/state';
import { brand } from '@/state/settings';
import http from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import SearchModal from '@/components/dashboard/search/SearchModal';
import useEventListener from '@/plugins/useEventListener';
import LogoMark from '@/components/gynx/LogoMark';
import routes, { ServerNavGroup } from '@/routers/routes';

/**
 * gynx.gg — left sidebar v3
 *
 * Wide (240px) / collapsed (64px) navigation rail. Owns ALL navigation —
 * global links (Home, Search, Admin, Account) at the top, contextual tabs
 * (server or account) in the middle, Sign Out at the bottom.
 *
 * Collapsed state is persisted to localStorage so navigation doesn't whiplash
 * between page loads. On narrow screens the whole sidebar hides until md+.
 *
 * Brand rules applied:
 *   - Active item = purple tint + purple left-accent bar.
 *   - Hover     = blue tint.
 *   - Inactive  = dim gray text, no background.
 *   - No default glow anywhere.
 */

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;
const STORAGE_KEY = 'gynx.sidebar.collapsed';

const GROUP_ORDER: ServerNavGroup[] = ['management', 'monitoring', 'config'];
const GROUP_LABELS: Record<ServerNavGroup, string> = {
    management: 'manage',
    monitoring: 'monitor',
    config: 'config',
};

// ----- styled scaffolding ---------------------------------------------------

const Rail = styled.aside<{ $collapsed: boolean }>`
    ${tw`hidden md:flex flex-shrink-0 flex-col z-20 h-screen sticky top-0`};
    width: ${({ $collapsed }) => ($collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH)}px;
    background: var(--gynx-surface-2);
    border-right: 1px solid var(--gynx-edge);
    transition: width .22s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
`;

const Scroll = styled.div`
    ${tw`flex-1 overflow-y-auto overflow-x-hidden`};
    &::-webkit-scrollbar { width: 6px; }
`;

const BrandRow = styled.div<{ $collapsed: boolean }>`
    ${tw`flex items-center px-4 py-4`};
    gap: 12px;
    min-height: 64px;
`;

const BrandWordmark = styled.span<{ $collapsed: boolean }>`
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 600;
    font-size: 16px;
    letter-spacing: -0.01em;
    color: var(--gynx-text);
    opacity: ${({ $collapsed }) => ($collapsed ? 0 : 1)};
    transform: ${({ $collapsed }) => ($collapsed ? 'translateX(-4px)' : 'translateX(0)')};
    transition: opacity .18s ease, transform .2s ease;
    white-space: nowrap;
    pointer-events: ${({ $collapsed }) => ($collapsed ? 'none' : 'auto')};
`;

const EyebrowRow = styled.div<{ $collapsed: boolean }>`
    ${tw`px-4 pt-5 pb-1`};
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: lowercase;
    color: var(--gynx-text-mute);
    font-weight: 500;
    opacity: ${({ $collapsed }) => ($collapsed ? 0 : 1)};
    height: ${({ $collapsed }) => ($collapsed ? 14 : 24)}px;
    transition: opacity .18s ease, height .2s ease;
    display: flex;
    align-items: center;
    overflow: hidden;
`;

const Divider = styled.div`
    margin: 8px 16px;
    height: 1px;
    background: rgba(255, 255, 255, 0.05);
`;

// ----- nav item primitive ---------------------------------------------------

const itemBase = css`
    ${tw`relative flex items-center no-underline mx-2 px-3 py-2 rounded-lg`};
    gap: 12px;
    min-height: 40px;
    color: var(--gynx-text-dim);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.01em;
    transition: color .18s ease, background .18s ease;
    cursor: pointer;
    border: 0;
    background: transparent;
    text-align: left;
    pointer-events: auto;

    /* Hover = blue tint (per brand rule: blue = secondary interaction) */
    &:hover {
        color: #fff;
        background: rgba(34, 211, 238, 0.08);
    }
`;

const activeCss = css`
    color: #fff;
    background: rgba(124, 58, 237, 0.16);

    &::before {
        content: '';
        position: absolute;
        left: -2px;
        top: 8px;
        bottom: 8px;
        width: 3px;
        border-radius: 3px;
        background: var(--gynx-purple);
    }
`;

const ItemLink = styled(NavLink)`
    ${itemBase}
    &.active {
        ${activeCss}
    }
`;

const ItemButton = styled.button`
    ${itemBase}
    width: calc(100% - 16px);
`;

const ItemExternal = styled.a`
    ${itemBase}
`;

const IconCell = styled.span`
    ${tw`flex items-center justify-center flex-shrink-0`};
    width: 20px;
    height: 20px;
    font-size: 14px;
`;

const LabelCell = styled.span<{ $collapsed: boolean }>`
    ${tw`flex-1 truncate`};
    opacity: ${({ $collapsed }) => ($collapsed ? 0 : 1)};
    transform: ${({ $collapsed }) => ($collapsed ? 'translateX(-4px)' : 'translateX(0)')};
    transition: opacity .18s ease, transform .2s ease;
    pointer-events: ${({ $collapsed }) => ($collapsed ? 'none' : 'auto')};
    white-space: nowrap;
`;

// ----- inner helpers --------------------------------------------------------

interface ItemProps {
    icon: IconDefinition;
    label: string;
    collapsed: boolean;
}

const wrapTip = (collapsed: boolean, label: string, node: React.ReactElement) =>
    collapsed ? (
        <Tooltip placement={'right'} content={label}>
            {node}
        </Tooltip>
    ) : node;

const InternalLink: React.FC<ItemProps & { to: string; exact?: boolean }> = ({
    icon,
    label,
    collapsed,
    to,
    exact,
}) =>
    wrapTip(
        collapsed,
        label,
        <ItemLink to={to} exact={exact} activeClassName={'active'}>
            <IconCell>
                <FontAwesomeIcon icon={icon} fixedWidth />
            </IconCell>
            <LabelCell $collapsed={collapsed}>{label}</LabelCell>
        </ItemLink>
    );

const ExternalLink: React.FC<ItemProps & { href: string }> = ({ icon, label, collapsed, href }) =>
    wrapTip(
        collapsed,
        label,
        <ItemExternal href={href} rel={'noreferrer'}>
            <IconCell>
                <FontAwesomeIcon icon={icon} fixedWidth />
            </IconCell>
            <LabelCell $collapsed={collapsed}>{label}</LabelCell>
        </ItemExternal>
    );

const ActionButton: React.FC<ItemProps & { onClick: () => void; ariaLabel?: string }> = ({
    icon,
    label,
    collapsed,
    onClick,
    ariaLabel,
}) =>
    wrapTip(
        collapsed,
        label,
        <ItemButton onClick={onClick} aria-label={ariaLabel || label}>
            <IconCell>
                <FontAwesomeIcon icon={icon} fixedWidth />
            </IconCell>
            <LabelCell $collapsed={collapsed}>{label}</LabelCell>
        </ItemButton>
    );

// ----- main component -------------------------------------------------------

export default () => {
    const location = useLocation();
    const serverMatch = useRouteMatch<{ id: string }>('/server/:id');
    const serverUrlBase = serverMatch?.url.replace(/\/$/, '');
    const inAccount = location.pathname.startsWith('/account');

    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data?.rootAdmin ?? false);
    const brandCfg = useStoreState((state: ApplicationStore) => brand(state.settings.data));
    const siteName = brandCfg.siteName;
    const logoUrl = brandCfg.logoUrl;

    const [collapsed, setCollapsed] = useState<boolean>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
        } catch {
            /* private mode / disabled storage — ignore */
        }
    }, [collapsed]);

    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const onLogout = () => {
        setIsLoggingOut(true);
        http.post('/auth/logout').finally(() => {
            // @ts-expect-error — location assignment is valid here
            window.location = '/';
        });
    };

    // Search modal — own the state here so the trigger matches sidebar item
    // styling (stock SearchContainer rendered its own top-nav chrome).
    const [searchOpen, setSearchOpen] = useState(false);
    useEventListener('keydown', (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (['input', 'textarea'].indexOf((target?.tagName || 'input').toLowerCase()) < 0) {
            if (!searchOpen && e.metaKey && e.key.toLowerCase() === '/') {
                setSearchOpen(true);
            }
        }
    });

    // Pre-filter the server tabs into their groups so we don't map the whole
    // array four times in the render.
    const serverGroupedItems = useMemo(() => {
        const result: Record<string, typeof routes.server> = {};
        for (const r of routes.server) {
            if (!r.name || !serverUrlBase) continue;
            const g = r.group || 'ungrouped';
            (result[g] = result[g] || []).push(r);
        }
        return result;
    }, [serverUrlBase]);

    return (
        <Rail $collapsed={collapsed} aria-label={'primary navigation'}>
            <SpinnerOverlay visible={isLoggingOut} />

            {/* brand */}
            <BrandRow $collapsed={collapsed}>
                <Link to={'/'} style={{ display: 'flex', alignItems: 'center' }}>
                    <LogoMark size={32} url={logoUrl} />
                </Link>
                <BrandWordmark $collapsed={collapsed}>{siteName}</BrandWordmark>
            </BrandRow>

            <Scroll>
                {/* global nav */}
                <div style={{ paddingTop: 4, paddingBottom: 4 }}>
                    <InternalLink icon={faHome} label={'Dashboard'} to={'/'} exact collapsed={collapsed} />
                    <ActionButton
                        icon={faSearch}
                        label={'Search'}
                        collapsed={collapsed}
                        onClick={() => setSearchOpen(true)}
                        ariaLabel={'search'}
                    />
                    {rootAdmin && <ExternalLink icon={faCogs} label={'Admin'} href={'/admin'} collapsed={collapsed} />}
                    <InternalLink icon={faUser} label={'Account'} to={'/account'} collapsed={collapsed} />
                </div>

                {/* Search modal portal — own it here so the trigger lives
                    in-line with the other sidebar items. */}
                {searchOpen && (
                    <SearchModal appear visible={searchOpen} onDismissed={() => setSearchOpen(false)} />
                )}

                {/* contextual: server tabs */}
                {serverMatch && (
                    <>
                        <Divider />
                        {GROUP_ORDER.map((group) => {
                            const items = serverGroupedItems[group];
                            if (!items || items.length === 0) return null;
                            return (
                                <React.Fragment key={group}>
                                    <EyebrowRow $collapsed={collapsed}>{GROUP_LABELS[group]}</EyebrowRow>
                                    {items.map((route) => {
                                        const node = (
                                            <InternalLink
                                                key={route.path}
                                                icon={route.icon!}
                                                label={route.name!}
                                                to={`${serverUrlBase}${route.path === '/' ? '' : route.path}`}
                                                exact={route.exact}
                                                collapsed={collapsed}
                                            />
                                        );
                                        return route.permission ? (
                                            <Can key={route.path} action={route.permission} matchAny>
                                                {node}
                                            </Can>
                                        ) : node;
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </>
                )}

                {/* contextual: account tabs */}
                {inAccount && (
                    <>
                        <Divider />
                        <EyebrowRow $collapsed={collapsed}>account</EyebrowRow>
                        {routes.account
                            .filter((r) => !!r.name)
                            .map((route) => (
                                <InternalLink
                                    key={route.path}
                                    icon={faUser}
                                    label={route.name!}
                                    to={`/account/${route.path}`.replace('//', '/')}
                                    exact={route.exact}
                                    collapsed={collapsed}
                                />
                            ))}
                    </>
                )}
            </Scroll>

            {/* footer: collapse toggle + sign out */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '8px 0' }}>
                <ActionButton
                    icon={collapsed ? faAngleDoubleRight : faAngleDoubleLeft}
                    label={collapsed ? 'Expand' : 'Collapse'}
                    collapsed={collapsed}
                    onClick={() => setCollapsed((c) => !c)}
                    ariaLabel={collapsed ? 'expand sidebar' : 'collapse sidebar'}
                />
                <ActionButton
                    icon={faSignOutAlt}
                    label={'Sign out'}
                    collapsed={collapsed}
                    onClick={onLogout}
                    ariaLabel={'sign out'}
                />
            </div>
        </Rail>
    );
};
