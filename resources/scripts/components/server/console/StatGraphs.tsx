import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { Line } from 'react-chartjs-2';

import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { useChart, useChartTickLabel } from '@/components/server/console/chart';
import { hexToRgba } from '@/lib/helpers';
import { bytesToString } from '@/lib/formatters';

/**
 * gynx — unified chart panel.
 *
 * Three metric series (CPU / RAM / Network) feed the same scrolling line
 * chart. The user picks the active tab; the other two series keep collecting
 * data in the background so tab-switching is instant and preserves history.
 *
 * Visual rules:
 *   - Flat #1F2937 panel, neutral edge at rest.
 *   - Tabs = purple pill for active, blue hover for inactive.
 *   - Chart height is larger than session 1's sparklines — readability first.
 *   - Each series uses its own metric accent (CPU=blue, RAM=purple, Net=cyan).
 */

const Panel = styled.section`
    ${tw`relative rounded-xl overflow-hidden`};
    background: var(--gynx-surface);
    border: 1px solid var(--gynx-edge);
    transition: border-color .25s ease, box-shadow .25s ease;

    &:hover {
        border-color: rgba(124, 58, 237, 0.35);
        box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.35), 0 10px 28px -12px rgba(124, 58, 237, 0.4);
    }
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
        background: ${({ $active }) =>
            $active ? undefined : 'rgba(34, 211, 238, 0.08)'};
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
    ${tw`px-3 pb-3 pt-2 relative`};
    /* Fixed height so Chart.js has something to render against. Without this,
       a growable flex parent lets Chart.js's aspectRatio=2 stretch the canvas
       to ~400px. */
    height: 280px;
`;

/*
 * Chart.js defaults to maintainAspectRatio: true, which means it derives
 * height from width and ignores the container's height. That was giving us
 * a ~400px tall chart in the growable flex layout. This override lets the
 * Body's fixed height drive the canvas.
 */
const respectContainerHeight = { maintainAspectRatio: false, responsive: true } as const;

const Legend = styled.div`
    ${tw`text-[11px] text-gynx-text-dim flex items-center gap-4`};
`;

const metricAccents = {
    cpu:    '#60A5FA', // blue
    memory: '#A78BFA', // purple
    network: '#22D3EE', // cyan
} as const;

type ChartTab = keyof typeof metricAccents;

export default () => {
    const [tab, setTab] = useState<ChartTab>('cpu');

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
                backgroundColor: hexToRgba(!index ? '#22D3EE' : '#67E8F9', 0.28),
            };
        },
    });

    useEffect(() => {
        if (status === 'offline') {
            cpu.clear();
            memory.clear();
            network.clear();
        }
    }, [status]);

    useWebsocketEvent(SocketEvent.STATS, (data: string) => {
        let values: any = {};
        try {
            values = JSON.parse(data);
        } catch (e) {
            return;
        }
        cpu.push(values.cpu_absolute);
        memory.push(Math.floor(values.memory_bytes / 1024 / 1024));
        network.push([
            previous.current.tx < 0 ? 0 : Math.max(0, values.network.tx_bytes - previous.current.tx),
            previous.current.rx < 0 ? 0 : Math.max(0, values.network.rx_bytes - previous.current.rx),
        ]);

        previous.current = { tx: values.network.tx_bytes, rx: values.network.rx_bytes };
    });

    // Tint the active series' line/fill via the chart props object; also
    // override maintainAspectRatio so the canvas sizes to the Body's height.
    const activeProps = (() => {
        switch (tab) {
            case 'cpu':
                return {
                    ...cpu.props,
                    options: { ...cpu.props.options, ...respectContainerHeight },
                    data: {
                        ...cpu.props.data,
                        datasets: cpu.props.data.datasets.map((ds: any) => ({
                            ...ds,
                            borderColor: metricAccents.cpu,
                            backgroundColor: hexToRgba(metricAccents.cpu, 0.22),
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
                            borderColor: metricAccents.memory,
                            backgroundColor: hexToRgba(metricAccents.memory, 0.22),
                        })),
                    },
                };
            case 'network':
                return {
                    ...network.props,
                    options: { ...network.props.options, ...respectContainerHeight },
                };
        }
    })();

    return (
        <Panel>
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
                        <span><TabDot $color={'#22D3EE'} /> in</span>
                        <span><TabDot $color={'#67E8F9'} /> out</span>
                    </Legend>
                )}
            </Header>
            <Body>
                <Line {...activeProps} />
            </Body>
        </Panel>
    );
};
