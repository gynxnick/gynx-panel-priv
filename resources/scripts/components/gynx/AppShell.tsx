import * as React from 'react';
import styled from 'styled-components/macro';
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

const TopStrip = styled.header`
    ${tw`flex items-center gap-3 flex-shrink-0 w-full`};
    background: linear-gradient(180deg, rgba(15, 17, 26, 0.85), rgba(11, 11, 15, 0.5));
    border-bottom: 1px solid var(--gynx-edge);
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
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

interface Props {
    header?: React.ReactNode;
    children: React.ReactNode;
}

export default ({ header, children }: Props) => {
    useAlertPolling();

    return (
        <Shell>
            <BgArt src={DashboardBg} alt={''} aria-hidden />
            <Sidebar />
            <Main>
                <Stuck>
                    <AlertBar />
                    {header && (
                        <TopStrip>
                            <HeaderSlot>{header}</HeaderSlot>
                            <BellSlot>
                                <AlertBell />
                            </BellSlot>
                        </TopStrip>
                    )}
                </Stuck>
                <Content>{children}</Content>
            </Main>
        </Shell>
    );
};
