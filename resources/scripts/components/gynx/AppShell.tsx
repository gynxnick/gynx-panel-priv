import * as React from 'react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import styled, { keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import Sidebar from '@/components/gynx/Sidebar';
import AlertBar from '@/components/gynx/AlertBar';
import AlertBell from '@/components/gynx/AlertBell';
import { useAlertPolling } from '@/components/gynx/useAlertPolling';
import DashboardBg from '@/assets/brand/gynx-dashboard-bg.svg';

/**
 * gynx.gg — app shell
 *
 * Two-column layout: the wide Sidebar (owns ALL navigation — global +
 * contextual server/account tabs) and a main content column. The sidebar
 * collapses to 64px on demand and hides entirely on narrow viewports.
 *
 * The main column hosts, from top to bottom:
 *   - AlertBar — panel/node announcements (renders nothing when empty)
 *   - TopStrip — page-header (rendered by the caller as `header` slot)
 *     with the AlertBell dropdown pinned to the right
 *   - children = the actual route content
 *
 * Alert polling is mounted here once, so every route inside AppShell
 * shares the same 60s cadence without duplicate timers.
 *
 * Background art is rendered as a position:fixed <img> behind the whole
 * viewport. svg-url-loader emits a data URL; an <img> handles it
 * cleaner than a CSS background-image (which can break on special
 * characters inside styled-components template literals).
 */

const Shell = styled.div`
    ${tw`flex min-h-screen w-full text-gynx-text`};
    position: relative;
    isolation: isolate;
`;

const BgArt = styled.img`
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    z-index: -1;
    pointer-events: none;
    user-select: none;
`;

const Main = styled.div`
    ${tw`flex-1 min-w-0 flex flex-col`};
    position: relative;
`;

const Stuck = styled.div`
    ${tw`sticky top-0 z-10`};
`;

/**
 * The strip uses two visual states. Idle (top of page): subtle, just a
 * neutral edge. Scrolled: stronger blur, a faint purple wash on the bottom
 * border, and a soft drop-shadow that hints depth without competing for
 * attention. The transition is slow enough to read as "settling".
 */
const TopStrip = styled.header<{ $scrolled: boolean }>`
    ${tw`flex items-center gap-3 flex-shrink-0 w-full`};
    background: ${({ $scrolled }) =>
        $scrolled
            ? 'linear-gradient(180deg, rgba(13, 14, 22, 0.92), rgba(11, 11, 15, 0.78))'
            : 'linear-gradient(180deg, rgba(15, 17, 26, 0.85), rgba(11, 11, 15, 0.5))'};
    border-bottom: 1px solid
        ${({ $scrolled }) => ($scrolled ? 'rgba(124, 58, 237, 0.22)' : 'var(--gynx-edge)')};
    box-shadow: ${({ $scrolled }) =>
        $scrolled ? '0 8px 24px -16px rgba(124, 58, 237, 0.45)' : 'none'};
    backdrop-filter: blur(${({ $scrolled }) => ($scrolled ? '22px' : '18px')}) saturate(140%);
    -webkit-backdrop-filter: blur(${({ $scrolled }) => ($scrolled ? '22px' : '18px')}) saturate(140%);
    transition:
        background     .25s ease,
        border-color   .25s ease,
        box-shadow     .25s ease,
        backdrop-filter .25s ease;
`;

const HeaderSlot = styled.div`
    ${tw`flex-1 min-w-0`};
`;

const BellSlot = styled.div`
    ${tw`flex-shrink-0 pr-4 md:pr-6`};
`;

const Content = styled.main`
    ${tw`flex-1 w-full min-w-0`};
`;

/**
 * Wrapper around routed children that re-mounts (via key) on every pathname
 * change so the fade-in keyframe re-fires. Children remount on URL change
 * regardless (react-router swaps the matched <Route>), so this adds no extra
 * remount cost — just a 200ms visual settle.
 */
const routeIn = keyframes`
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const RouteFader = styled.div`
    animation: ${routeIn} .22s cubic-bezier(0.4, 0, 0.2, 1) both;
`;

interface Props {
    header?: React.ReactNode;
    children: React.ReactNode;
}

export default ({ header, children }: Props) => {
    useAlertPolling();

    const location = useLocation();

    // Window scroll → boolean. 4px threshold keeps the strip from flickering
    // on tiny scroll-restoration jumps. Passive listener so it doesn't block
    // the main thread.
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 4);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <Shell>
            <BgArt src={DashboardBg} alt={''} aria-hidden />
            <Sidebar />
            <Main>
                <Stuck>
                    <AlertBar />
                    {header && (
                        <TopStrip $scrolled={scrolled}>
                            <HeaderSlot>{header}</HeaderSlot>
                            <BellSlot>
                                <AlertBell />
                            </BellSlot>
                        </TopStrip>
                    )}
                </Stuck>
                <Content>
                    <RouteFader key={location.pathname}>{children}</RouteFader>
                </Content>
            </Main>
        </Shell>
    );
};
