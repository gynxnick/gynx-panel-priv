import React, { useEffect, useRef, useState } from 'react';
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

// Module-level in-flight registry. Lives outside React entirely so it
// CAN'T be reset by remounts, StrictMode double-effects, or anything else
// that resets useRef. Without this, a remount loop in the dashboard tree
// floods the panel with /resources requests until the rate limiter trips.
const INFLIGHT: Set<string> = new Set();
// Per-UUID earliest-next-call gate. Belt-and-suspenders: even if multiple
// ServerCard instances coexist for the same UUID (shouldn't happen, but
// has happened in practice), they share this floor and can't drive the
// panel below the configured interval.
const NEXT_ALLOWED: Map<string, number> = new Map();

export const ServerCard: React.FC<Props> = ({ server }) => {
    const [stats, setStats] = useState<ServerStats | null>(null);
    const [isSuspended, setIsSuspended] = useState(server.status === 'suspended');
    const cpuSeries = useSeries({ capacity: SPARK_CAPACITY });
    const memSeries = useSeries({ capacity: SPARK_CAPACITY });

    // The previous useRef-based guard was useless when the dashboard subtree
    // remounted (which we've observed happening in the wild — likely an
    // upstream error boundary loop). useRef gets reset on every fresh mount,
    // so the guard reset every time the bug fired and the request flood
    // resumed instantly. Now both the in-flight check and the
    // earliest-next-call floor live in module-scoped Set/Map (see top of
    // file), so a thousand simultaneous remounts of ServerCard for the same
    // uuid still produce at most ONE request per POLL_INTERVAL_MS.
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (isSuspended) return;
        const uuid = server.uuid;

        const poll = async () => {
            if (!isMountedRef.current) return;
            if (INFLIGHT.has(uuid)) return;
            const now = Date.now();
            const allowedAt = NEXT_ALLOWED.get(uuid) ?? 0;
            if (now < allowedAt) return;

            INFLIGHT.add(uuid);
            // Reserve the next slot up front so even an immediate remount
            // can't slip in another request before we've sent this one.
            NEXT_ALLOWED.set(uuid, now + POLL_INTERVAL_MS);

            try {
                const data = await getServerResourceUsage(uuid);
                if (!isMountedRef.current) return;
                setStats(data);
                if (data.isSuspended !== isSuspended) setIsSuspended(data.isSuspended);
                cpuSeries.push(data.cpuUsagePercent);
                memSeries.push(Math.floor(data.memoryUsageInBytes / 1024 / 1024));
            } catch {
                /* surfaced at the dashboard level */
            } finally {
                INFLIGHT.delete(uuid);
            }
        };

        poll();
        const id = window.setInterval(poll, POLL_INTERVAL_MS);
        return () => window.clearInterval(id);
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
