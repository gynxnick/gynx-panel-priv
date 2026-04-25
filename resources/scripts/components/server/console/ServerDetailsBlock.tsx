import React, { useEffect, useMemo, useState } from 'react';
import {
    faClock,
    faHdd,
    faWifi,
} from '@fortawesome/free-solid-svg-icons';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import UptimeDuration from '@/components/server/UptimeDuration';
import StatBlock from '@/components/server/console/StatBlock';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import classNames from 'classnames';
import { capitalize } from '@/lib/strings';

/**
 * Compact server-state strip rendered BELOW the console.
 *
 * CPU / RAM / Net In / Net Out used to live here; they're now in the
 * StatGraphs panel underneath, so this component shows only the data
 * that ISN'T duplicated by graphs:
 *   - Server status (running / offline / starting / uptime)
 *   - Primary connection (IP:port, copy-on-click)
 *   - Disk usage (no graph, slowly-changing)
 *
 * Layout: 3 tiles in a horizontal grid. Container is responsible for
 * placement and wrapping — this component just emits the cells.
 */

type Stats = Record<'memory' | 'cpu' | 'disk' | 'uptime' | 'rx' | 'tx', number>;

const severityFor = (value: number, limit: number | null): string | undefined => {
    if (!limit || limit <= 0) return undefined;
    const ratio = value / limit;
    if (ratio > 0.9) return 'bg-red-500';
    if (ratio > 0.75) return 'bg-yellow-500';
    return undefined;
};

const Limit = ({ limit, children }: { limit: string | null; children: React.ReactNode }) => (
    <>
        {children}
        <span className={'ml-1 text-gynx-text-mute text-[70%] select-none'}>/ {limit || <>&infin;</>}</span>
    </>
);

const ServerDetailsBlock = ({ className }: { className?: string }) => {
    const [stats, setStats] = useState<Stats>({ memory: 0, cpu: 0, disk: 0, uptime: 0, tx: 0, rx: 0 });

    const status = ServerContext.useStoreState((state) => state.status.value);
    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);

    const textLimits = useMemo(
        () => ({
            disk: limits?.disk ? bytesToString(mbToBytes(limits.disk)) : null,
        }),
        [limits],
    );

    const allocation = ServerContext.useStoreState((state) => {
        const match = state.server.data!.allocations.find((a) => a.isDefault);
        return !match ? 'n/a' : `${match.alias || ip(match.ip)}:${match.port}`;
    });

    useEffect(() => {
        if (!connected || !instance) return;
        instance.send(SocketRequest.SEND_STATS);
    }, [instance, connected]);

    useWebsocketEvent(SocketEvent.STATS, (data) => {
        let parsed: any = {};
        try {
            parsed = JSON.parse(data);
        } catch (e) {
            return;
        }

        setStats({
            memory: parsed.memory_bytes,
            cpu: parsed.cpu_absolute,
            disk: parsed.disk_bytes,
            tx: parsed.network.tx_bytes,
            rx: parsed.network.rx_bytes,
            uptime: parsed.uptime || 0,
        });
    });

    const diskPct = limits?.disk ? stats.disk / mbToBytes(limits.disk) : undefined;

    return (
        <div className={classNames('grid grid-cols-1 sm:grid-cols-3 gap-3', className)}>
            {/* Server status — uptime when running, label otherwise */}
            <StatBlock icon={faClock} title={'status'} metric={'status'}>
                {status === null ? (
                    'Offline'
                ) : stats.uptime > 0 ? (
                    <UptimeDuration uptime={stats.uptime / 1000} />
                ) : (
                    capitalize(status)
                )}
            </StatBlock>

            {/* Primary connection */}
            <StatBlock icon={faWifi} title={'connection'} metric={'net'} copyOnClick={allocation}>
                <span className={'font-mono'}>{allocation}</span>
            </StatBlock>

            {/* Disk — no graph for this metric */}
            <StatBlock
                icon={faHdd}
                title={'disk'}
                metric={'disk'}
                color={severityFor(stats.disk, limits?.disk ? mbToBytes(limits.disk) : null)}
                progress={diskPct}
            >
                <Limit limit={textLimits.disk}>{bytesToString(stats.disk)}</Limit>
            </StatBlock>
        </div>
    );
};

export default ServerDetailsBlock;
