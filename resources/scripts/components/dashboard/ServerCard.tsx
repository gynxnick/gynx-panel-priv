import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faEthernet } from '@fortawesome/free-solid-svg-icons';

import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerPowerState, ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { Card, Pill, PillVariant, Sparkline, useSeries } from '@/components/gynx';

type Props = {
    server: Server;
};

const metricColor = {
    cpu: '#60A5FA',      // blue
    memory: '#C4B5FD',   // lavender
    disk: '#F59E0B',     // amber — stays in the "warm" family, distinct from metrics
};

const statusVariant = (status: ServerPowerState | undefined, suspended: boolean): PillVariant => {
    if (suspended) return 'err';
    if (!status || status === 'offline') return 'idle';
    if (status === 'running') return 'live';
    return 'warn';
};

const CardLink = styled(Link)`
    display: block;
    color: inherit;
    text-decoration: none;
    transition: transform .2s ease;

    &:hover {
        transform: translateY(-1px);
    }
`;

const Header = styled.header`
    ${tw`flex items-start justify-between gap-3`};
`;

const TitleBlock = styled.div`
    ${tw`flex-1 min-w-0`};
`;

const Title = styled.h3`
    ${tw`text-base font-medium break-words`};
    color: var(--gynx-text);
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.01em;
    margin: 0;
    line-height: 1.3;
`;

const Description = styled.p`
    ${tw`text-sm mt-1 break-words`};
    color: var(--gynx-text-dim);
    line-height: 1.4;
    margin: 4px 0 0 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
`;

const MetricStrip = styled.div`
    ${tw`grid grid-cols-3 gap-3 mt-4`};
`;

const MetricCell = styled.div`
    ${tw`flex flex-col`};
    gap: 4px;
    min-width: 0;
`;

const MetricLabel = styled.div`
    ${tw`text-xs uppercase`};
    color: var(--gynx-text-mute);
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.08em;
`;

const SparkSlot = styled.div`
    height: 24px;
    display: flex;
    align-items: center;
`;

const MetricValue = styled.div<{ $alarm: boolean }>`
    ${tw`text-xs font-medium`};
    color: ${({ $alarm }) => ($alarm ? '#F87171' : 'var(--gynx-text)')};
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const DiskBar = styled.div`
    ${tw`w-full rounded-full`};
    height: 4px;
    background: rgba(255, 255, 255, 0.05);
    overflow: hidden;
    margin: 10px 0;
`;

const DiskFill = styled.div<{ $pct: number; $alarm: boolean }>`
    height: 100%;
    width: ${({ $pct }) => Math.min(100, Math.max(0, $pct))}%;
    background: ${({ $alarm }) => ($alarm ? '#F87171' : metricColor.disk)};
    transition: width .3s ease, background .2s ease;
`;

const AllocationRow = styled.div`
    ${tw`flex items-center gap-2 mt-4`};
    color: var(--gynx-text-dim);
    font-size: 12px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
`;

const Footer = styled.div`
    ${tw`flex items-center justify-between mt-4 pt-3`};
    border-top: 1px solid var(--gynx-edge);
`;

const OpenHint = styled.span`
    ${tw`inline-flex items-center text-xs font-medium`};
    gap: 6px;
    color: #c4b5fd;
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
    transition: color .15s ease, gap .15s ease;

    ${CardLink}:hover & {
        color: #ddd6fe;
        gap: 10px;
    }
`;

const Muted = styled.span`
    ${tw`text-xs`};
    color: var(--gynx-text-mute);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
`;

const POLL_INTERVAL_MS = 15000;
const SPARK_CAPACITY = 30; // ~5 min of history at 10s cadence

// ----- module-level polling pump --------------------------------------------
//
// Polling lives entirely outside React so the dashboard subtree's remount
// loop (root cause TBD, see TODO.md) can't kill it. ServerCards subscribe
// on mount; the pump fires `getServerResourceUsage` for each subscribed
// uuid on a steady cadence and broadcasts the result to every subscriber.
// Remounting a ServerCard re-subscribes (instantly seeded from the cache),
// it never resets the timer and never piles up a fetch.

type StatsListener = (stats: ServerStats) => void;
const SUBSCRIBERS: Map<string, Set<StatsListener>> = new Map();
const STATS_CACHE: Map<string, ServerStats> = new Map();
const INFLIGHT: Set<string> = new Set();

let pumpStarted = false;
const startPumpIfNeeded = () => {
    if (pumpStarted) return;
    pumpStarted = true;
    window.setInterval(() => {
        for (const uuid of SUBSCRIBERS.keys()) {
            if (INFLIGHT.has(uuid)) continue;
            INFLIGHT.add(uuid);
            getServerResourceUsage(uuid)
                .then((data) => {
                    STATS_CACHE.set(uuid, data);
                    const subs = SUBSCRIBERS.get(uuid);
                    if (subs) for (const fn of subs) fn(data);
                })
                .catch(() => { /* swallow — surfaced at dashboard level */ })
                .finally(() => { INFLIGHT.delete(uuid); });
        }
    }, POLL_INTERVAL_MS);
};

const subscribe = (uuid: string, fn: StatsListener): (() => void) => {
    let set = SUBSCRIBERS.get(uuid);
    if (!set) { set = new Set(); SUBSCRIBERS.set(uuid, set); }
    set.add(fn);
    startPumpIfNeeded();

    // Fire one immediate request for this uuid if we have no fresh data —
    // gives newly-mounted cards their first values without waiting a full
    // POLL_INTERVAL_MS for the next pump tick.
    if (!INFLIGHT.has(uuid) && !STATS_CACHE.has(uuid)) {
        INFLIGHT.add(uuid);
        getServerResourceUsage(uuid)
            .then((data) => {
                STATS_CACHE.set(uuid, data);
                const subs = SUBSCRIBERS.get(uuid);
                if (subs) for (const f of subs) f(data);
            })
            .catch(() => { /* ignore */ })
            .finally(() => { INFLIGHT.delete(uuid); });
    } else if (STATS_CACHE.has(uuid)) {
        // Seed the new subscriber synchronously from the cache.
        fn(STATS_CACHE.get(uuid)!);
    }

    return () => {
        const s = SUBSCRIBERS.get(uuid);
        if (!s) return;
        s.delete(fn);
        if (s.size === 0) SUBSCRIBERS.delete(uuid);
    };
};

export const ServerCard: React.FC<Props> = ({ server }) => {
    const [stats, setStats] = useState<ServerStats | null>(
        () => STATS_CACHE.get(server.uuid) ?? null,
    );
    const [isSuspended, setIsSuspended] = useState(server.status === 'suspended');
    const cpuSeries = useSeries({ capacity: SPARK_CAPACITY });
    const memSeries = useSeries({ capacity: SPARK_CAPACITY });

    // Subscribe to the module-level pump. The pump fires polls at a steady
    // cadence regardless of how many times this component remounts, so a
    // remount loop in the dashboard subtree no longer kills polling.
    useEffect(() => {
        if (isSuspended) return;
        const onStats = (data: ServerStats) => {
            setStats(data);
            if (data.isSuspended !== isSuspended) setIsSuspended(data.isSuspended);
            cpuSeries.push(data.cpuUsagePercent);
            memSeries.push(Math.floor(data.memoryUsageInBytes / 1024 / 1024));
        };
        return subscribe(server.uuid, onStats);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [server.uuid, isSuspended]);

    const limits = server.limits;
    const cpuPct = stats?.cpuUsagePercent ?? 0;
    const memBytes = stats?.memoryUsageInBytes ?? 0;
    const diskBytes = stats?.diskUsageInBytes ?? 0;

    const cpuAlarm = limits.cpu > 0 && cpuPct >= limits.cpu * 0.9;
    const memAlarm = limits.memory > 0 && memBytes >= mbToBytes(limits.memory) * 0.9;
    const diskAlarm = limits.disk > 0 && diskBytes >= mbToBytes(limits.disk) * 0.9;
    const diskPct = limits.disk > 0 ? (diskBytes / mbToBytes(limits.disk)) * 100 : 0;

    const statusText =
        isSuspended
            ? 'suspended'
            : server.isTransferring
            ? 'transferring'
            : server.status === 'installing'
            ? 'installing'
            : server.status === 'restoring_backup'
            ? 'restoring'
            : stats?.status ?? 'connecting';

    const allocation = server.allocations.find((a) => a.isDefault);
    const addr = allocation ? `${allocation.alias || ip(allocation.ip)}:${allocation.port}` : '';

    const memLabel = stats
        ? `${bytesToString(memBytes)} / ${limits.memory ? bytesToString(mbToBytes(limits.memory)) : '∞'}`
        : '—';
    const diskLabel = stats
        ? `${bytesToString(diskBytes)} / ${limits.disk ? bytesToString(mbToBytes(limits.disk)) : '∞'}`
        : '—';

    return (
        <CardLink to={`/server/${server.id}`}>
            <Card>
                <Header>
                    <TitleBlock>
                        <Title>{server.name}</Title>
                        {!!server.description && <Description>{server.description}</Description>}
                    </TitleBlock>
                    <Pill variant={statusVariant(stats?.status, isSuspended)}>{statusText}</Pill>
                </Header>

                <MetricStrip>
                    <MetricCell>
                        <MetricLabel>CPU</MetricLabel>
                        <SparkSlot>
                            <Sparkline data={cpuSeries.data} color={metricColor.cpu} width={130} height={24} />
                        </SparkSlot>
                        <MetricValue $alarm={cpuAlarm}>
                            {stats ? `${cpuPct.toFixed(1)}%` : '—'}
                        </MetricValue>
                    </MetricCell>

                    <MetricCell>
                        <MetricLabel>RAM</MetricLabel>
                        <SparkSlot>
                            <Sparkline data={memSeries.data} color={metricColor.memory} width={130} height={24} />
                        </SparkSlot>
                        <MetricValue $alarm={memAlarm}>{memLabel}</MetricValue>
                    </MetricCell>

                    <MetricCell>
                        <MetricLabel>DISK</MetricLabel>
                        <DiskBar>
                            <DiskFill $pct={diskPct} $alarm={diskAlarm} />
                        </DiskBar>
                        <MetricValue $alarm={diskAlarm}>{diskLabel}</MetricValue>
                    </MetricCell>
                </MetricStrip>

                {addr && (
                    <AllocationRow>
                        <FontAwesomeIcon icon={faEthernet} />
                        <span>{addr}</span>
                    </AllocationRow>
                )}

                <Footer>
                    <Muted>{server.node}</Muted>
                    <OpenHint>
                        open console
                        <FontAwesomeIcon icon={faArrowRight} />
                    </OpenHint>
                </Footer>
            </Card>
        </CardLink>
    );
};

export default ServerCard;
