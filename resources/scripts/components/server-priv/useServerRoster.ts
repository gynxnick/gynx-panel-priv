import { useEffect, useMemo, useState, useCallback } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import { detectGameCommands, GameCommandSet } from '@/helpers/gameCommands';

/**
 * Live roster of players online, derived from console output. Subscribes
 * to the same join/leave/list events PlayerManager listens for, so a
 * single source of truth feeds both the player-manager rail card and
 * the Players stat tile on the console page.
 *
 * Caller passes nothing — the hook reads the server context directly to
 * pick up the socket instance + game.
 */

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

const parseMinecraftList = (line: string): string[] => {
    const m = stripAnsi(line).match(/players online:\s*(.+)$/i);
    if (!m) return [];
    return m[1]
        .split(/[,\s]+/)
        .map((n) => n.trim())
        .filter((n) => /^[A-Za-z0-9_]{2,16}$/.test(n));
};

export interface ServerRoster {
    /** Current set of online player names. Stable identity per render. */
    players: Set<string>;
    /** Detected game (returns null when the server's egg can't be matched). */
    game: GameCommandSet | null;
    /** Re-issue the game's listPlayers command to seed/refresh the roster. */
    refresh: () => void;
}

export const useServerRoster = (): ServerRoster => {
    const server = ServerContext.useStoreState((s) => s.server.data);
    const { connected, instance } = ServerContext.useStoreState((s) => s.socket);
    const game = useMemo<GameCommandSet | null>(() => detectGameCommands(server || undefined), [server]);

    const [players, setPlayers] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!instance || !connected || !game) return;

        const onLine = (raw: string) => {
            const line = stripAnsi(raw);

            if (game.label === 'minecraft') {
                const names = parseMinecraftList(line);
                if (names.length > 0) {
                    setPlayers(new Set(names));
                    return;
                }
                if (/players online:\s*$/i.test(line)) {
                    setPlayers(new Set());
                    return;
                }
            }

            const join = game.joinPattern && line.match(game.joinPattern);
            if (join && join[1]) {
                const name = join[1];
                setPlayers((prev) => {
                    if (prev.has(name)) return prev;
                    const next = new Set(prev);
                    next.add(name);
                    return next;
                });
                return;
            }
            const leave = game.leavePattern && line.match(game.leavePattern);
            if (leave && leave[1]) {
                const name = leave[1];
                setPlayers((prev) => {
                    if (!prev.has(name)) return prev;
                    const next = new Set(prev);
                    next.delete(name);
                    return next;
                });
            }
        };

        instance.addListener(SocketEvent.CONSOLE_OUTPUT, onLine);
        instance.addListener(SocketEvent.DAEMON_MESSAGE, onLine);

        if (game.listPlayers) {
            instance.send('send command', game.listPlayers);
        }

        return () => {
            instance.removeListener(SocketEvent.CONSOLE_OUTPUT, onLine);
            instance.removeListener(SocketEvent.DAEMON_MESSAGE, onLine);
        };
    }, [instance, connected, game?.label]);

    const refresh = useCallback(() => {
        if (!instance || !connected || !game?.listPlayers) return;
        instance.send('send command', game.listPlayers);
    }, [instance, connected, game?.label]);

    return { players, game, refresh };
};
