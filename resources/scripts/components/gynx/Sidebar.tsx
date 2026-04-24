import * as React from 'react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCogs, faHome, faSignOutAlt, faUser } from '@fortawesome/free-solid-svg-icons';
import { ApplicationStore } from '@/state';
import http from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import SearchContainer from '@/components/dashboard/search/SearchContainer';
import LogoMark from '@/components/gynx/LogoMark';

/**
 * gynx.gg — left-rail sidebar
 *
 * A persistent 72px icon-rail that replaces the stock top-nav NavigationBar.
 * Context-agnostic: shows the same global actions (dashboard / admin / account /
 * sign-out) everywhere. Sub-navigation (server tabs, account tabs) lives in the
 * TopBar tab strip, not here.
 */

const Rail = styled.aside`
    ${tw`flex-shrink-0 flex flex-col items-center py-4 z-20`};
    width: 72px;
    background: var(--gynx-surface-2);
    border-right: 1px solid var(--gynx-edge);
`;

const NavItem = styled(NavLink)`
    ${tw`flex items-center justify-center w-10 h-10 mb-2 rounded-lg text-gynx-text-dim relative`};
    transition: color .2s ease, background .2s ease;

    /* Hover on inactive: soft neutral so cyan-for-active reads cleanly */
    &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.04);
    }

    /* Active = cyan pill. Purple is reserved for actions (buttons);
       state uses blue. */
    &.active {
        color: #fff;
        background: rgba(34, 211, 238, 0.16);
        box-shadow: inset 0 0 0 1px rgba(34, 211, 238, 0.45);
    }

    /* Left accent — only when active. Cyan, solid, no outer glow. */
    &.active::before {
        content: '';
        position: absolute;
        left: -12px;
        top: 10px;
        bottom: 10px;
        width: 2px;
        border-radius: 2px;
        background: var(--gynx-blue);
    }
`;

const NavAction = styled.button`
    ${tw`flex items-center justify-center w-10 h-10 mb-2 rounded-lg text-gynx-text-dim bg-transparent border-0 cursor-pointer`};
    transition: color .2s ease, background .2s ease;

    &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.04);
    }
`;

const NavExternalLink = styled.a`
    ${tw`flex items-center justify-center w-10 h-10 mb-2 rounded-lg text-gynx-text-dim no-underline`};
    transition: color .2s ease, background .2s ease;

    &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.04);
    }
`;

const Divider = styled.div`
    ${tw`w-8 my-3`};
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
`;

const BrandLink = styled(Link)`
    ${tw`mb-4 block no-underline`};
    transition: transform .2s ease, filter .25s ease;

    &:hover {
        transform: scale(1.04);
        /* Glow is a reward — only reveals on hover */
        filter: drop-shadow(0 0 10px rgba(124, 58, 237, 0.5));
    }
`;

export default () => {
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data!.rootAdmin);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const onLogout = () => {
        setIsLoggingOut(true);
        http.post('/auth/logout').finally(() => {
            // @ts-expect-error — location assignment is valid here
            window.location = '/';
        });
    };

    return (
        <Rail aria-label="primary navigation">
            <SpinnerOverlay visible={isLoggingOut} />

            <Tooltip placement="right" content="gynx.gg">
                <BrandLink to="/">
                    <LogoMark size={40} />
                </BrandLink>
            </Tooltip>

            <Divider />

            <Tooltip placement="right" content="Dashboard">
                <NavItem to="/" exact activeClassName="active">
                    <FontAwesomeIcon icon={faHome} />
                </NavItem>
            </Tooltip>

            {/* SearchContainer renders its own trigger + modal. */}
            <SearchContainer />

            {rootAdmin && (
                <Tooltip placement="right" content="Admin">
                    <NavExternalLink href="/admin" rel="noreferrer">
                        <FontAwesomeIcon icon={faCogs} />
                    </NavExternalLink>
                </Tooltip>
            )}

            {/* flex spacer pushes the lower cluster to the bottom of the rail */}
            <div style={{ flex: 1 }} />

            <Divider />

            <Tooltip placement="right" content="Account">
                <NavItem to="/account" activeClassName="active">
                    <FontAwesomeIcon icon={faUser} />
                </NavItem>
            </Tooltip>

            <Tooltip placement="right" content="Sign out">
                <NavAction onClick={onLogout} aria-label="sign out">
                    <FontAwesomeIcon icon={faSignOutAlt} />
                </NavAction>
            </Tooltip>
        </Rail>
    );
};
