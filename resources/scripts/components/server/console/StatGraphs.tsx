import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes, css } from 'styled-components/macro';
import tw from 'twin.macro';
import { Line } from 'react-chartjs-2';
import { ScriptableContext } from 'chart.js';

import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { useChart, useChartTickLabel } from '@/components/server/console/chart';
import { hexToRgba } from '@/lib/helpers';
import { bytesToString } from '@/lib/formatters';

/**
 * gynx — unified chart panel.
 *
 * One large panel with three tabs (CPU / RAM / Network). Active series gets
 * its accent color applied to both line + gradient fill. Inactive series keep
 * collecting data in the background so tab switches preserve history.
 *
 * Visual rules:
 *   - Flat #1F2937 panel, neutral edge at rest.
 *   - Tabs: active = metric-accent pill; inactive hover = blue tint.
 *   - Smooth curves (tension 0.4 baked in chart.ts).
 *   - Gradient fill from accent → transparent.
 *   - Hover surfaces a precise-value tooltip (built into chart.ts defaults).
 *   - Activity pulse: when a value jumps >25% of its limit between samples,
 *     the panel border briefly pulses in the accent color.
 */

// ----- styled scaffolding ---------------------------------------------------

const pulse = keyframes`
    0%   { box-shadow: 0 0 0 1px var(--gynx-accent), 0 0 0 0 rgba(var(--gynx-accent-rgb), 0.45); }
    60%  { box-shadow: 0 0 0 1px var(--gynx-accent), 0 0 0 14px rgba(var(--gynx-accent-rgb), 0); }
    100% { box-shadow: 0 0 0 1px transparent, 0 0 0 0 transparent; }
`;

const Panel = styled.section<{ $pulsing: boolean; $accent: string; $accentRgb: string }>`
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

const Header = styled.header`
    ${tw`flex items-center justify-between px-4 pt-3 pb-2`};
    border-bottom: 1px solid var(--gynx-edge);
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

const Body = styled.div`
    ${tw`px-3 pb-3 pt-3 relative`};
    /* Larger than session 2 (was 280px) — readability over compactness. */
    height: 380px;
`;

const Legend = styled.div`
    ${tw`text-[11px] text-gynx-text-dim flex items-center gap-4`};
`;

// ----- metric metadata ------------------------------------------------------

const metricAccents = {
    cpu:     '#60A5FA', // blue
    memory:  '#C4B5FD', // lavender
    network: '#22D3EE', // cyan
} as const;

const metricRgb = {
    cpu:     '96, 165, 250',
    memory:  '196, 181, 253',
    network: '34, 211, 238',
} as const;

type ChartTab = keyof typeof metricAccents;

const respectContainerHeight = { maintainAspectRatio: false, responsive: true } as const;

/**
 * Build a Chart.js scriptable backgroundColor that paints a vertical
 * gradient from the metric accent at the top → transparent at the bottom.
 * Returns a plain rgba fallback while the canvas isn't ready yet.
 */
const gradientFill = (color: string) => (ctx: ScriptableContext<'line'>) => {
    const { chart } = ctx;
    const { ctx: c, chartArea } = chart;
    if (!chartArea) {
        return hexToRgba(color, 0.12);
    }
    const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    g.addColorStop(0, hexToRgba(color, 0.42));
    g.addColorStop(0.7, hexToRgba(color, 0.08));
    g.addColorStop(1, hexToRgba(color, 0));
    return g;
};

export default () => {
    const [tab, setTab] = useState<ChartTab>('cpu');
    const [pulsing, setPulsing] = useState(false);
    const lastValue = useRef<Record<ChartTab, number | undefined>>({
        cpu: undefined,
        memory: undefined,
        network: undefined,
    });
    const pulseTimer = useRef<number | undefined>(undefined);

    const status = ServerContext.useStoreState((state) => state.status.value);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);
    const previous = useRef<Record<'tx' | 'rx', number>>({ tx: -1, rx: -1 });

    const cpu = useChartTickLabel('CPU', limits.cpu, '%', 2);
    const memory = useChartTickLabel('Memory', limits.memory, 'MiB');
    const network = useChart('Network', {
        sets: 2,
        options: {
            scales: {
                y: {
                    ticks: {
                        callback(value) {
                            return bytesToString(typeof value === 'string' ? parseInt(value, 10) : value);
                        },
                    },
                },
            },
        },
        callback(opts, index) {
            // Index 0 = inbound, index 1 = outbound.
            return {
                ...opts,
                label: !index ? 'Network In' : 'Network Out',
                borderColor: !index ? '#22D3EE' : '#67E8F9',
                backgroundColor: hexToRgba(!index ? '#22D3EE' : '#67E8F9', 0.18),
            };
        },
    });

    useEffect(() => {
        if (status === 'offline') {
            cpu.clear();
            memory.clear();
            network.clear();
            lastValue.current = { cpu: undefined, memory: undefined, network: undefined };
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

        cpu.push(cpuVal);
        memory.push(memVal);
        network.push([
            previous.current.tx < 0 ? 0 : Math.max(0, values.network.tx_bytes - previous.current.tx),
            previous.current.rx < 0 ? 0 : Math.max(0, values.network.rx_bytes - previous.current.rx),
        ]);

        previous.current = { tx: values.network.tx_bytes, rx: values.network.rx_bytes };

        // Activity pulse — fire when the *currently visible* metric jumps by
        // > 25% of its hard limit since the previous sample. Network falls
        // back to absolute-byte threshold (1 MiB delta) since limits.network
        // doesn't exist.
        let delta: number | undefined;
        let threshold: number | undefined;
        if (tab === 'cpu') {
            delta = lastValue.current.cpu === undefined ? 0 : Math.abs(cpuVal - lastValue.current.cpu);
            threshold = limits?.cpu ? limits.cpu * 0.25 : 25;
            lastValue.current.cpu = cpuVal;
        } else if (tab === 'memory') {
            delta = lastValue.current.memory === undefined ? 0 : Math.abs(memVal - (lastValue.current.memory || 0));
            threshold = limits?.memory ? limits.memory * 0.25 : 256;
            lastValue.current.memory = memVal;
        }
        if (delta !== undefined && threshold !== undefined && delta > threshold && !pulsing) {
            setPulsing(true);
            window.clearTimeout(pulseTimer.current);
            pulseTimer.current = window.setTimeout(() => setPulsing(false), 900);
        }
    });

    // Reset pulse when switching tabs so old animation doesn't bleed.
    useEffect(() => {
        setPulsing(false);
        return () => window.clearTimeout(pulseTimer.current);
    }, [tab]);

    // Build the active dataset's props with metric-tinted line + gradient fill.
    const activeProps = (() => {
        const accent = metricAccents[tab];
        switch (tab) {
            case 'cpu':
                return {
                    ...cpu.props,
                    options: { ...cpu.props.options, ...respectContainerHeight },
                    data: {
                        ...cpu.props.data,
                        datasets: cpu.props.data.datasets.map((ds: any) => ({
                            ...ds,
                            borderColor: accent,
                            backgroundColor: gradientFill(accent),
                            pointHoverBorderColor: accent,
                        })),
                    },
                };
            case 'memory':
                return {
                    ...memory.props,
                    options: { ...memory.props.options, ...respectContainerHeight },
                    data: {
                        ...memory.props.data,
                        datasets: memory.props.data.datasets.map((ds: any) => ({
                            ...ds,
                            borderColor: accent,
                            backgroundColor: gradientFill(accent),
                            pointHoverBorderColor: accent,
                        })),
                    },
                };
            case 'network':
                return {
                    ...network.props,
                    options: { ...network.props.options, ...respectContainerHeight },
                    data: {
                        ...network.props.data,
                        datasets: network.props.data.datasets.map((ds: any, i: number) => {
                            const c = i === 0 ? '#22D3EE' : '#67E8F9';
                            return {
                                ...ds,
                                backgroundColor: gradientFill(c),
                                pointHoverBorderColor: c,
                            };
                        }),
                    },
                };
        }
    })();

    return (
        <Panel $pulsing={pulsing} $accent={metricAccents[tab]} $accentRgb={metricRgb[tab]}>
            <Header>
                <TabGroup role={'tablist'} aria-label={'metric'}>
                    <Tab
                        role={'tab'}
                        aria-selected={tab === 'cpu'}
                        $active={tab === 'cpu'}
                        $accent={metricAccents.cpu}
                        onClick={() => setTab('cpu')}
                    >
                        <TabDot $color={metricAccents.cpu} /> CPU
                    </Tab>
                    <Tab
                        role={'tab'}
                        aria-selected={tab === 'memory'}
                        $active={tab === 'memory'}
                        $accent={metricAccents.memory}
                        onClick={() => setTab('memory')}
                    >
                        <TabDot $color={metricAccents.memory} /> RAM
                    </Tab>
                    <Tab
                        role={'tab'}
                        aria-selected={tab === 'network'}
                        $active={tab === 'network'}
                        $accent={metricAccents.network}
                        onClick={() => setTab('network')}
                    >
                        <TabDot $color={metricAccents.network} /> Network
                    </Tab>
                </TabGroup>

                {tab === 'network' && (
                    <Legend>
                        <span>
                            <TabDot $color={'#22D3EE'} /> in
                        </span>
                        <span>
                            <TabDot $color={'#67E8F9'} /> out
                        </span>
                    </Legend>
                )}
            </Header>
            <Body>
                <Line {...activeProps} />
            </Body>
        </Panel>
    );
};
