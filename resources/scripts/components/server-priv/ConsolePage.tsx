import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { bytesToString, mbToBytes } from '@/lib/formatters';
import LegacyConsole from '@/components/server/console/Console';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';
import { PlayerManager } from './PlayerManager';
import { useServerRoster } from './useServerRoster';
import { useTps } from './useTps';
import { CrashLogsPanel } from './CrashLogsPanel';
import { DiscordCta } from './DiscordCta';

/**
 * Console page — wireframe layout backed by real WebSocket data.
 *
 * Stat row (CPU / Memory / Network / TPS / Players) subscribes to the
 * SocketEvent.STATS stream; sparklines render the rolling 14-point
 * history. The actual console body embeds the legacy Console component
 * (xterm.js, ANSI handling, command input + history) inside the
 * wireframe-styled console-panel.
 *
 * TPS + Players are still placeholders — TPS would need /tps command
 * parsing (Minecraft-only) and Players is best derived from the same
 * roster the PlayerManager tracks. Both are follow-up work.
 */

const PURPLE = '#7c3aed';
const NEON = '#22d3ee';
const SAMPLE_WINDOW = 14;

interface StatsValues {
    cpu_absolute: number;
    memory_bytes: number;
    network: { rx_bytes: number; tx_bytes: number };
    uptime?: number;
}

interface UseStatsReturn {
    cpuPct: number;
    memBytes: number;
    netRate: number; // bytes per stat-tick (rx + tx delta)
    cpuHistory: number[];
    memHistory: number[];
    netHistory: number[];
}

const useStats = (): UseStatsReturn => {
    const [cpuPct, setCpuPct] = useState(0);
    const [memBytes, setMemBytes] = useState(0);
    const [netRate, setNetRate] = useState(0);
    const [cpuHistory, setCpuHistory] = useState<number[]>([]);
    const [memHistory, setMemHistory] = useState<number[]>([]);
    const [netHistory, setNetHistory] = useState<number[]>([]);
    const previous = useRef({ rx: -1, tx: -1 });

    useWebsocketEvent(SocketEvent.STATS, (data: string) => {
        let v: StatsValues;
        try {
            v = JSON.parse(data) as StatsValues;
        } catch {
            return;
        }

        const cpu = v.cpu_absolute ?? 0;
        const mem = v.memory_bytes ?? 0;
        const rx = v.network?.rx_bytes ?? 0;
        const tx = v.network?.tx_bytes ?? 0;

        const dRx = previous.current.rx < 0 ? 0 : Math.max(0, rx - previous.current.rx);
        const dTx = previous.current.tx < 0 ? 0 : Math.max(0, tx - previous.current.tx);
        const net = dRx + dTx;
        previous.current = { rx, tx };

        setCpuPct(cpu);
        setMemBytes(mem);
        setNetRate(net);
        setCpuHistory((prev) => [...prev, cpu].slice(-SAMPLE_WINDOW));
        setMemHistory((prev) => [...prev, mem].slice(-SAMPLE_WINDOW));
        setNetHistory((prev) => [...prev, net].slice(-SAMPLE_WINDOW));
    });

    return { cpuPct, memBytes, netRate, cpuHistory, memHistory, netHistory };
};

interface StatProps {
    label: string;
    value: React.ReactNode;
    unit?: string;
    icon: React.ComponentProps<typeof Icon>['name'];
    color?: string;
    spark: number[];
}

const Stat = ({ label, value, unit, icon, color = PURPLE, spark }: StatProps) => (
    <div className={'panel stat'}>
        <div className={'stat-info'}>
            <div className={'stat-label'}>
                <Icon name={icon} size={11} color={'var(--text-faint)'} />
                {label}
            </div>
            <div className={'stat-value'}>
                {value}
                {unit && <span className={'unit'}>{unit}</span>}
            </div>
        </div>
        <div className={'stat-spark'}>
            {spark.length > 1 ? (
                <Sparkline color={color} points={spark} />
            ) : (
                <div style={{ width: '100%', height: '100%' }} />
            )}
        </div>
    </div>
);

const StatRow = () => {
    const { cpuPct, memBytes, netRate, cpuHistory, memHistory, netHistory } = useStats();
    const limits = ServerContext.useStoreState((s) => s.server.data!.limits);
    const status = ServerContext.useStoreState((s) => s.status.value);
    const { players, game } = useServerRoster();
    const { tps, history: tpsHistory, active: tpsActive } = useTps();

    // Track player count over time for the sparkline. Pushes a new sample
    // whenever the roster size actually changes — rather than on a fixed
    // interval, since join/leave is the only meaningful change driver.
    const [playerHistory, setPlayerHistory] = useState<number[]>([]);
    useEffect(() => {
        setPlayerHistory((prev) => [...prev, players.size].slice(-SAMPLE_WINDOW));
    }, [players.size]);

    const isOffline = status === 'offline' || !status;
    const memLimitBytes = mbToBytes(limits.memory);
    const memDisplay = isOffline ? '—' : (memBytes > 0 ? bytesToString(memBytes) : '0 B');
    const memUnit = limits.memory ? ` / ${bytesToString(memLimitBytes)}` : '';
    const netDisplay = isOffline ? '—' : (netRate >= 1024 ? bytesToString(netRate) : `${netRate} B`);

    // Players is only meaningful when we can detect the game and the server is
    // running. Display "—" otherwise so we don't show 0 for unknown game types
    // (e.g. servers we don't have join/leave patterns for).
    const playersDisplay = (!game || isOffline) ? '—' : String(players.size);

    return (
        <div className={'stat-row'}>
            <Stat
                label={'CPU'} value={isOffline ? '—' : cpuPct.toFixed(1)} unit={isOffline ? undefined : '%'}
                icon={'zap'} color={PURPLE} spark={cpuHistory}
            />
            <Stat
                label={'Memory'} value={memDisplay} unit={isOffline ? undefined : memUnit}
                icon={'db'} color={NEON} spark={memHistory}
            />
            <Stat
                label={'Network'} value={netDisplay} unit={isOffline ? undefined : '/s'}
                icon={'globe'} color={PURPLE} spark={netHistory}
            />
            <Stat
                label={'TPS'}
                value={tpsActive && tps !== null ? tps.toFixed(1) : '—'}
                unit={tpsActive && tps !== null ? ' / 20' : undefined}
                icon={'trend-down'} color={NEON}
                spark={tpsActive ? tpsHistory : []}
            />
            <Stat
                label={'Players'} value={playersDisplay} icon={'users'} color={PURPLE}
                spark={(!game || isOffline) ? [] : playerHistory}
            />
        </div>
    );
};

const ConsolePanel = () => {
    /**
     * Wraps the legacy Console (xterm.js + WebSocket subscription + command
     * input) inside the wireframe-styled .console-panel chrome. The legacy
     * component renders its own input row + toolbar; we pass through and
     * style above with the wireframe header strip.
     */
    const status = ServerContext.useStoreState((s) => s.status.value);
    return (
        <div className={'panel console-panel'}>
            <div className={'console-header'}>
                <div className={'console-title'}>
                    <span
                        className={'live-dot'}
                        style={{
                            background: status === 'running' ? '#34d399' : status === 'offline' ? '#6b7280' : '#f59e0b',
                            boxShadow: status === 'running' ? '0 0 8px #34d399' : 'none',
                            animation: status === 'running' ? undefined : 'none',
                        }}
                    />
                    Live Console
                </div>
                <div className={'console-meta'}>
                    {status === 'running' ? 'streaming · stdout' : status === 'offline' ? 'offline' : status ?? 'connecting…'}
                </div>
            </div>
            <div style={{ flex: 1, minHeight: 360, padding: 0, position: 'relative' }}>
                <LegacyConsole />
            </div>
        </div>
    );
};

const AiCard = () => (
    <div className={'panel ai-card'}>
        <div className={'ai-card-bg'} />
        <div className={'ai-card-inner'}>
            <div className={'row'} style={{ justifyContent: 'space-between' }}>
                <span className={'ai-badge'}>gynx ai
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono',monospace" }}>
                    coming soon
                </span>
            </div>
            <p className={'ai-msg'}>
                gynx ai will keep an eye on TPS, lag spikes, and crash patterns — and suggest fixes you can apply with one click.
            </p>
            <div className={'ai-actions'}>
                <button className={'btn btn-sm'} disabled>Notify me</button>
            </div>
        </div>
    </div>
);

const QuickActions = () => {
    const history = useHistory();
    const match = useRouteMatch<{ id: string }>();
    const base = `/server/${match.params.id}`;
    return (
        <div className={'panel rail-card'}>
            <div className={'rail-title'}>Quick actions</div>
            <div className={'quick-grid'}>
                <button className={'quick-btn'} onClick={() => history.push(`${base}/install`)}>
                    <Icon name={'sparkles'} size={13} color={'var(--purple)'} style={{ flexShrink: 0 }} />
                    <span>Mod installer</span>
                </button>
                <button className={'quick-btn'} onClick={() => history.push(`${base}/backups`)}>
                    <Icon name={'archive'} size={13} color={'var(--text-faint)'} style={{ flexShrink: 0 }} />
                    <span>Backups</span>
                </button>
                <button className={'quick-btn'} onClick={() => history.push(`${base}/domain`)}>
                    <Icon name={'globe'} size={13} color={'var(--text-faint)'} style={{ flexShrink: 0 }} />
                    <span>Subdomains</span>
                </button>
                <button className={'quick-btn'} onClick={() => history.push(`${base}/files`)}>
                    <Icon name={'folder'} size={13} color={'var(--text-faint)'} style={{ flexShrink: 0 }} />
                    <span>Files</span>
                </button>
            </div>
        </div>
    );
};

export const ConsolePage = () => (
    <div className={'main'}>
        <div className={'col'}>
            <StatRow />
            <ConsolePanel />
            <DiscordCta />
            <CrashLogsPanel />
        </div>
        <div className={'col'}>
            <AiCard />
            <PlayerManager />
            <QuickActions />
        </div>
    </div>
);

export default ConsolePage;
