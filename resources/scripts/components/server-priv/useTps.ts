import { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import { detectGameCommands } from '@/helpers/gameCommands';

// Live TPS stream. Polls the Minecraft `tps` command on a fixed
// interval and parses the response from console output. Returns null
// when the game isn't Minecraft (other games don't have a tps concept)
// or when the server is offline.
//
// The response from Paper / Spigot looks like:
//   TPS from last 1m, 5m, 15m: 20.00, 19.95, 19.50
// We grab the 1-minute reading.

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

const TPS_LINE = /TPS from last\s+1m[^:]*:\s*\*?(\d+(?:\.\d+)?)/i;

interface UseTpsReturn {
    tps: number | null;
    history: number[];
    /** True when TPS sampling is active (game is Minecraft + server is up). */
    active: boolean;
}

const SAMPLE_WINDOW = 14;
const POLL_MS = 60_000;

export const useTps = (): UseTpsReturn => {
    const server = ServerContext.useStoreState((s) => s.server.data);
    const status = ServerContext.useStoreState((s) => s.status.value);
    const { connected, instance } = ServerContext.useStoreState((s) => s.socket);

    const game = detectGameCommands(server || undefined);
    const isMinecraft = game?.label === 'minecraft';
    const isLive = isMinecraft && connected && status === 'running' && !!instance;

    const [tps, setTps] = useState<number | null>(null);
    const [history, setHistory] = useState<number[]>([]);

    useEffect(() => {
        if (!isLive || !instance) {
            // Reset when leaving live state so a stale value doesn't linger.
            setTps(null);
            setHistory([]);
            return;
        }

        const onLine = (raw: string) => {
            const m = stripAnsi(raw).match(TPS_LINE);
            if (!m) return;
            const v = parseFloat(m[1]);
            if (!Number.isFinite(v)) return;
            setTps(v);
            setHistory((prev) => [...prev, v].slice(-SAMPLE_WINDOW));
        };

        instance.addListener(SocketEvent.CONSOLE_OUTPUT, onLine);
        instance.addListener(SocketEvent.DAEMON_MESSAGE, onLine);

        // Send an initial poll so the first value appears within ~1 tick
        // rather than after POLL_MS.
        instance.send('send command', 'tps');
        const id = window.setInterval(() => {
            instance.send('send command', 'tps');
        }, POLL_MS);

        return () => {
            window.clearInterval(id);
            instance.removeListener(SocketEvent.CONSOLE_OUTPUT, onLine);
            instance.removeListener(SocketEvent.DAEMON_MESSAGE, onLine);
        };
    }, [isLive, instance]);

    return { tps, history, active: isLive };
};
