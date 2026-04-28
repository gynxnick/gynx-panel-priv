import { useCallback, useEffect, useRef, useState } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import { detectGameCommands } from '@/helpers/gameCommands';

// Live TPS reader. The hook listens for "TPS from last 1m, 5m, 15m: …"
// lines on the console output stream. The auto-poll was removed
// because issuing `tps` every 60s spammed the console scrollback —
// each response is a server-side broadcast that lands in xterm.
//
// Now: returns a `refresh` callback the caller fires manually (e.g.
// from a refresh button on the TPS stat tile). Plus, it still parses
// any natural `tps` output the user types themselves — so typing
// `tps` in the console still updates the stat.

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

const TPS_LINE = /TPS from last\s+1m[^:]*:\s*\*?(\d+(?:\.\d+)?)/i;

interface UseTpsReturn {
    tps: number | null;
    history: number[];
    /** True when TPS sampling is possible (Minecraft + running). */
    active: boolean;
    /** Manually issue the `tps` command. No-op when not active. */
    refresh: () => void;
}

const SAMPLE_WINDOW = 14;

export const useTps = (): UseTpsReturn => {
    const server = ServerContext.useStoreState((s) => s.server.data);
    const status = ServerContext.useStoreState((s) => s.status.value);
    const { connected, instance } = ServerContext.useStoreState((s) => s.socket);

    const game = detectGameCommands(server || undefined);
    const isMinecraft = game?.label === 'minecraft';
    const active = isMinecraft && connected && status === 'running' && !!instance;
    const initialPoll = useRef(false);

    const [tps, setTps] = useState<number | null>(null);
    const [history, setHistory] = useState<number[]>([]);

    // Listener: parses any `tps` response that lands in the console,
    // whether we sent the command or the user typed it.
    useEffect(() => {
        if (!active || !instance) {
            setTps(null);
            setHistory([]);
            initialPoll.current = false;
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

        // One-shot poll on first activation per server-running session,
        // so the tile shows a value without waiting for the user to
        // click refresh. After this, no more auto-polls.
        if (!initialPoll.current) {
            instance.send('send command', 'tps');
            initialPoll.current = true;
        }

        return () => {
            instance.removeListener(SocketEvent.CONSOLE_OUTPUT, onLine);
            instance.removeListener(SocketEvent.DAEMON_MESSAGE, onLine);
        };
    }, [active, instance]);

    const refresh = useCallback(() => {
        if (!active || !instance) return;
        instance.send('send command', 'tps');
    }, [active, instance]);

    return { tps, history, active, refresh };
};
