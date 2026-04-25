import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes, css } from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTh, faChartLine } from '@fortawesome/free-solid-svg-icons';

import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { bytesToString } from '@/lib/formatters';
import { LineChart, useSeries } from '@/components/gynx/chart';

/**
 * gynx — server stat panel.
 *
 * Two view modes the user can toggle between (persisted in localStorage):
 *   - 'grid': three side-by-side metric panels (CPU / RAM / Network),
 *             at-a-glance dashboard feel. No Compare overlay.
 *   - 'tabs': single tabbed panel, taller chart, supports the
 *             Compare CPU↔RAM overlay. Activity pulse rings the panel
 *             when the active metric jumps >25% of its hard limit.
 *
 * Series collection runs once and feeds both modes.
 */

const VIEW_KEY = 'gynx.statgraphs.view';
type ViewMode = 'grid' | 'tabs';

// ---- shared styled atoms ----------------------------------------------------

const ToggleStrip = styled.div`
    ${tw`flex items-center justify-end gap-2 mb-3`};
`;

const ViewToggle = styled.button<{ $active: boolean }>`
    ${tw`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer`};
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
    background: ${({ $active }) => ($active ? 'rgba(124, 58, 237, 0.18)' : 'transparent')};
    color: ${({ $active }) => ($active ? '#C4B5FD' : 'var(--gynx-text-dim)')};
    border: 1px solid ${({ $active }) => ($active ? 'rgba(124, 58, 237, 0.55)' : 'var(--gynx-edge-2)')};
    transition: color .15s ease, background .15s ease, border-color .15s ease;

    &:hover {
        color: ${({ $active }) => ($active ? '#DDD6FE' : 'var(--gynx-text)')};
        border-color: rgba(124, 58, 237, 0.45);
    }
`;

const pulse = keyframes`
    0%   { box-shadow: 0 0 0 1px var(--gynx-accent), 0 0 0 0 rgba(var(--gynx-accent-rgb), 0.45); }
    60%  { box-shadow: 0 0 0 1px var(--gynx-accent), 0 0 0 14px rgba(var(--gynx-accent-rgb), 0); }
    100% { box-shadow: 0 0 0 1px transparent, 0 0 0 0 transparent; }
`;

// ---- tabs-mode panel --------------------------------------------------------

const TabbedPanel = styled.section<{ $pulsing: boolean; $accent: string; $accentRgb: string }>`
    ${tw`relative rounded-xl overflow-hidden`};
    background: var(--gynx-surface);
    border: 1px solid var(--gynx-edge);
    transition: border-color .25s ease, box-shadow .25s ease;
    --gynx-accent: ${({ $accent }) => $accent};
    --gynx-accent-rgb: ${({ $accentRgb }) => $accentRgb};

    &:hover {
        border-color: rgba(124, 58, 237, 0.35);
        box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.35), 0 10px 28px -12px rgba(124, 58, 237, 0.4);
    }

    ${({ $pulsing }) =>
        $pulsing &&
        css`
            animation: ${pulse} .9s ease-out;
        `}
`;

const TabsHeader = styled.header`
    ${tw`flex items-center justify-between px-4 pt-3 pb-2 gap-3`};
    border-bottom: 1px solid var(--gynx-edge);
`;

const TabsHeaderLeft = styled.div`
    ${tw`flex items-center gap-3`};
`;

const TabGroup = styled.div`
    ${tw`inline-flex items-center gap-1 p-1 rounded-lg`};
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--gynx-edge);
`;

const Tab = styled.button<{ $active: boolean; $accent: string }>`
    ${tw`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border-0 cursor-pointer`};
    letter-spacing: 0.02em;
    font-family: 'Inter', sans-serif;
    transition: background .2s ease, color .2s ease;
    background: ${({ $active, $accent }) => ($active ? `${$accent}22` : 'transparent')};
    color: ${({ $active, $accent }) => ($active ? $accent : 'var(--gynx-text-dim)')};

    &:hover {
        color: ${({ $active, $accent }) => ($active ? $accent : 'var(--gynx-text)')};
        background: ${({ $active }) => ($active ? undefined : 'rgba(34, 211, 238, 0.08)')};
    }
`;

const TabDot = styled.span<{ $color: string }>`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    display: inline-block;
`;

const CompareButton = styled.button<{ $active: boolean }>`
    ${tw`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer`};
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
    border: 1px solid ${({ $active }) => ($active ? 'rgba(124, 58, 237, 0.55)' : 'var(--gynx-edge-2)')};
    background: ${({ $active }) => ($active ? 'rgba(124, 58, 237, 0.18)' : 'transparent')};
    color: ${({ $active }) => ($active ? '#C4B5FD' : 'var(--gynx-text-dim)')};
    transition: color .18s ease, background .18s ease, border-color .18s ease;

    &:hover {
        color: ${({ $active }) => ($active ? '#DDD6FE' : 'var(--gynx-text)')};
        border-color: rgba(124, 58, 237, 0.55);
    }
`;

const TabsBody = styled.div`
    ${tw`px-3 pb-3 pt-3 relative`};
    height: 380px;
`;

const Legend = styled.div`
    ${tw`text-xs flex items-center gap-4`};
    color: var(--gynx-text-dim);
`;

const LegendItem = styled.span`
    ${tw`inline-flex items-center gap-1.5`};
`;

// ---- grid-mode panels --------------------------------------------------------

const Grid = styled.div`
    ${tw`grid gap-3`};
    grid-template-columns: repeat(3, minmax(0, 1fr));

    @media (max-width: 1100px) {
        grid-template-columns: 1fr;
    }
`;

const GridPanel = styled.section<{ $accent: string }>`
    ${tw`relative rounded-xl overflow-hidden`};
    background: var(--gynx-surface);
    border: 1px solid var(--gynx-edge);
    transition: border-color .25s ease, box-shadow .25s ease;

    &:hover {
        border-color: ${({ $accent }) => $accent}55;
        box-shadow: 0 0 0 1px ${({ $accent }) => $accent}33, 0 10px 24px -14px ${({ $accent }) => $accent}66;
    }
`;

const GridPanelHeader = styled.header`
    ${tw`flex items-center justify-between px-4 pt-3 pb-2`};
    border-bottom: 1px solid var(--gynx-edge);
`;

const GridPanelTitle = styled.span<{ $accent: string }>`
    ${tw`inline-flex items-center gap-2 text-xs font-medium uppercase`};
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.08em;
    color: ${({ $accent }) => $accent};
`;

const GridPanelBody = styled.div`
    ${tw`px-2 pb-2 pt-2 relative`};
    height: 200px;
`;

// ---- metric metadata --------------------------------------------------------

const metricAccents = {
    cpu: '#60A5FA',
    memory: '#C4B5FD',
    network: '#22D3EE',
} as const;

const metricRgb = {
    cpu: '96, 165, 250',
    memory: '196, 181, 253',
    network: '34, 211, 238',
} as const;

type ChartTab = keyof typeof metricAccents;

const SAMPLE_CAPACITY = 60;

const cpuFormat = (v: number) => `${v.toFixed(1)}%`;
const memFormat = (v: number) => `${v.toFixed(0)} MiB`;
const netFormat = (v: number) => bytesToString(v);

// ---- component --------------------------------------------------------------

export default () => {
    const [view, setView] = useState<ViewMode>(() => {
        try {
            return (localStorage.getItem(VIEW_KEY) as ViewMode) || 'grid';
        } catch {
            return 'grid';
        }
    });

    const [tab, setTab] = useState<ChartTab>('cpu');
    const [compare, setCompare] = useState(false);
    const [pulsing, setPulsing] = useState(false);
    const pulseTimer = useRef<number | undefined>(undefined);

    const status = ServerContext.useStoreState((state) => state.status.value);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);
    const previous = useRef<Record<'tx' | 'rx', number>>({ tx: -1, rx: -1 });

    const cpu = useSeries({ capacity: SAMPLE_CAPACITY });
    const memory = useSeries({ capacity: SAMPLE_CAPACITY });
    const netIn = useSeries({ capacity: SAMPLE_CAPACITY });
    const netOut = useSeries({ capacity: SAMPLE_CAPACITY });

    useEffect(() => {
        try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ }
    }, [view]);

    useEffect(() => {
        if (status === 'offline') {
            cpu.clear();
            memory.clear();
            netIn.clear();
            netOut.clear();
        }
    }, [status]);

    useWebsocketEvent(SocketEvent.STATS, (data: string) => {
        let values: any = {};
        try {
            values = JSON.parse(data);
        } catch (e) {
            return;
        }

        const cpuVal = values.cpu_absolute as number;
        const memVal = Math.floor(values.memory_bytes / 1024 / 1024);
        const inVal = previous.current.rx < 0
            ? 0
            : Math.max(0, values.network.rx_bytes - previous.current.rx);
        const outVal = previous.current.tx < 0
            ? 0
            : Math.max(0, values.network.tx_bytes - previous.current.tx);

        cpu.push(cpuVal);
        memory.push(memVal);
        netIn.push(inVal);
        netOut.push(outVal);

        previous.current = { tx: values.network.tx_bytes, rx: values.network.rx_bytes };

        // Activity pulse only fires when in tabs view (single-panel framing).
        if (view !== 'tabs') return;
        let delta = 0;
        let threshold = 0;
        if (tab === 'cpu') {
            delta = Math.abs(cpu.delta);
            threshold = limits?.cpu ? limits.cpu * 0.25 : 25;
        } else if (tab === 'memory') {
            delta = Math.abs(memory.delta);
            threshold = limits?.memory ? limits.memory * 0.25 : 256;
        }
        if (threshold > 0 && delta > threshold && !pulsing) {
            setPulsing(true);
            window.clearTimeout(pulseTimer.current);
            pulseTimer.current = window.setTimeout(() => setPulsing(false), 900);
        }
    });

    useEffect(() => {
        setPulsing(false);
        if (tab === 'network') setCompare(false);
        return () => window.clearTimeout(pulseTimer.current);
    }, [tab]);

    // ---- shared chart factories used in both views ------------------------

    const renderCpuChart = (compareEnabled: boolean) => (
        <LineChart
            data={cpu.data}
            color={metricAccents.cpu}
            label={'CPU'}
            unit={'%'}
            domain={limits?.cpu ? [0, limits.cpu] : undefined}
            yFormat={cpuFormat}
            compare={
                compareEnabled
                    ? { data: memory.data, color: metricAccents.memory, label: 'Memory', format: memFormat }
                    : undefined
            }
        />
    );

    const renderMemoryChart = (compareEnabled: boolean) => (
        <LineChart
            data={memory.data}
            color={metricAccents.memory}
            label={'Memory'}
            domain={limits?.memory ? [0, limits.memory] : undefined}
            yFormat={memFormat}
            compare={
                compareEnabled
                    ? { data: cpu.data, color: metricAccents.cpu, label: 'CPU', format: cpuFormat }
                    : undefined
            }
        />
    );

    const renderNetworkChart = () => (
        <LineChart
            data={netIn.data}
            color={metricAccents.network}
            label={'Network In'}
            yFormat={netFormat}
            compare={{ data: netOut.data, color: '#67E8F9', label: 'Network Out', format: netFormat }}
        />
    );

    // ---- render ------------------------------------------------------------

    const toggle = (
        <ToggleStrip role={'tablist'} aria-label={'view layout'}>
            <ViewToggle
                type={'button'}
                $active={view === 'grid'}
                onClick={() => setView('grid')}
                title={'Side-by-side grid'}
                aria-pressed={view === 'grid'}
            >
                <FontAwesomeIcon icon={faTh} /> grid
            </ViewToggle>
            <ViewToggle
                type={'button'}
                $active={view === 'tabs'}
                onClick={() => setView('tabs')}
                title={'Tabbed panel with compare overlay'}
                aria-pressed={view === 'tabs'}
            >
                <FontAwesomeIcon icon={faChartLine} /> tabs
            </ViewToggle>
        </ToggleStrip>
    );

    if (view === 'grid') {
        return (
            <>
                {toggle}
                <Grid>
                    <GridPanel $accent={metricAccents.cpu}>
                        <GridPanelHeader>
                            <GridPanelTitle $accent={metricAccents.cpu}>
                                <TabDot $color={metricAccents.cpu} /> CPU
                            </GridPanelTitle>
                        </GridPanelHeader>
                        <GridPanelBody>{renderCpuChart(false)}</GridPanelBody>
                    </GridPanel>
                    <GridPanel $accent={metricAccents.memory}>
                        <GridPanelHeader>
                            <GridPanelTitle $accent={metricAccents.memory}>
                                <TabDot $color={metricAccents.memory} /> RAM
                            </GridPanelTitle>
                        </GridPanelHeader>
                        <GridPanelBody>{renderMemoryChart(false)}</GridPanelBody>
                    </GridPanel>
                    <GridPanel $accent={metricAccents.network}>
                        <GridPanelHeader>
                            <GridPanelTitle $accent={metricAccents.network}>
                                <TabDot $color={metricAccents.network} /> Network
                            </GridPanelTitle>
                            <Legend>
                                <LegendItem><TabDot $color={'#22D3EE'} /> in</LegendItem>
                                <LegendItem><TabDot $color={'#67E8F9'} /> out</LegendItem>
                            </Legend>
                        </GridPanelHeader>
                        <GridPanelBody>{renderNetworkChart()}</GridPanelBody>
                    </GridPanel>
                </Grid>
            </>
        );
    }

    // ---- tabs view --------------------------------------------------------

    const chart = (() => {
        switch (tab) {
            case 'cpu':     return renderCpuChart(compare);
            case 'memory':  return renderMemoryChart(compare);
            case 'network': return renderNetworkChart();
        }
    })();

    return (
        <>
            {toggle}
            <TabbedPanel $pulsing={pulsing} $accent={metricAccents[tab]} $accentRgb={metricRgb[tab]}>
                <TabsHeader>
                    <TabsHeaderLeft>
                        <TabGroup role={'tablist'} aria-label={'metric'}>
                            <Tab
                                role={'tab'} aria-selected={tab === 'cpu'}
                                $active={tab === 'cpu'} $accent={metricAccents.cpu}
                                onClick={() => setTab('cpu')}
                            >
                                <TabDot $color={metricAccents.cpu} /> CPU
                            </Tab>
                            <Tab
                                role={'tab'} aria-selected={tab === 'memory'}
                                $active={tab === 'memory'} $accent={metricAccents.memory}
                                onClick={() => setTab('memory')}
                            >
                                <TabDot $color={metricAccents.memory} /> RAM
                            </Tab>
                            <Tab
                                role={'tab'} aria-selected={tab === 'network'}
                                $active={tab === 'network'} $accent={metricAccents.network}
                                onClick={() => setTab('network')}
                            >
                                <TabDot $color={metricAccents.network} /> Network
                            </Tab>
                        </TabGroup>

                        {tab !== 'network' && (
                            <CompareButton
                                $active={compare}
                                onClick={() => setCompare((v) => !v)}
                                title={'Overlay the other metric for comparison'}
                            >
                                Compare {tab === 'cpu' ? 'RAM' : 'CPU'}
                            </CompareButton>
                        )}
                    </TabsHeaderLeft>

                    {tab === 'network' && (
                        <Legend>
                            <LegendItem><TabDot $color={'#22D3EE'} /> in</LegendItem>
                            <LegendItem><TabDot $color={'#67E8F9'} /> out</LegendItem>
                        </Legend>
                    )}
                </TabsHeader>
                <TabsBody>{chart}</TabsBody>
            </TabbedPanel>
        </>
    );
};
