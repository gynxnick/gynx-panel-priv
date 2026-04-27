import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import { detectGameCommands, GameCommandSet } from '@/helpers/gameCommands';
import { Icon } from './Icon';

/**
 * Right-rail player manager — wireframe-styled (panel + rail-card + rail-title)
 * with real roster + game-aware kick/ban/op/deop actions. Replaces the mock
 * activity feed on the new console page.
 *
 * Logic mirrors the legacy components/server/console/PlayerManagerPanel.tsx
 * but with the gynx-server-priv visual classes instead of styled-components +
 * twin.macro, so this card sits cleanly inside the new console rail.
 */

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

/** "There are X of a max of Y players online: A, B, C" → ["A","B","C"] */
const parseMinecraftList = (line: string): string[] => {
    const m = stripAnsi(line).match(/players online:\s*(.+)$/i);
    if (!m) return [];
    return m[1]
        .split(/[,\s]+/)
        .map((n) => n.trim())
        .filter((n) => /^[A-Za-z0-9_]{2,16}$/.test(n));
};

export const PlayerManager: React.FC = () => {
    const server = ServerContext.useStoreState((s) => s.server.data);
    const { connected, instance } = ServerContext.useStoreState((s) => s.socket);

    const game = useMemo<GameCommandSet | null>(() => detectGameCommands(server || undefined), [server]);

    const [players, setPlayers] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<string | null>(null);

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

    const sendCommand = useCallback(
        (cmd: string, key: string) => {
            if (!instance || !connected) return;
            setBusy(key);
            instance.send('send command', cmd);
            // Visual hint only — server's response will reach us via the
            // console listener regardless.
            setTimeout(() => setBusy((b) => (b === key ? null : b)), 800);
        },
        [instance, connected],
    );

    if (!game) {
        // Game not detectable from server data — render nothing rather than
        // an empty manager. (Users will still see the console + AI card.)
        return null;
    }

    const sortedPlayers = Array.from(players).sort((a, b) => a.localeCompare(b));

    return (
        <div className={'panel rail-card'} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div className={'rail-title'}>
                <span>
                    Player manager
                    <span className={'game-tag'}>{game.label}</span>
                </span>
                <button
                    type={'button'}
                    className={'player-action'}
                    title={'Refresh roster'}
                    disabled={!connected || !game.listPlayers}
                    onClick={refresh}
                    style={{ width: 24, height: 24 }}
                >
                    <span className={busy === '__refresh__' ? 'spin' : undefined}>
                        <Icon name={'refresh'} size={12} />
                    </span>
                </button>
            </div>

            <div
                style={{
                    fontSize: 11,
                    color: 'var(--text-faint)',
                    fontFamily: "'JetBrains Mono', monospace",
                    marginTop: -4,
                }}
            >
                {sortedPlayers.length} online
            </div>

            {sortedPlayers.length === 0 ? (
                <div className={'empty-roster'}>
                    No players online. Joins and leaves appear here in real time.
                </div>
            ) : (
                <div className={'player-list'} style={{ overflow: 'auto' }}>
                    {sortedPlayers.map((name) => {
                        const kickKey = `${name}:kick`;
                        const banKey = `${name}:ban`;
                        const opKey = `${name}:op`;
                        const deopKey = `${name}:deop`;
                        return (
                            <div className={'player-row'} key={name}>
                                <div className={'player-avatar'} aria-hidden>
                                    {name.slice(0, 2)}
                                </div>
                                <div className={'player-name'} title={name}>
                                    {name}
                                </div>
                                <div className={'player-actions'}>
                                    {game.op && (
                                        <button
                                            type={'button'}
                                            className={'player-action admin'}
                                            title={'Grant OP / admin'}
                                            disabled={busy === opKey || !connected}
                                            onClick={() => {
                                                if (!confirm(`Grant operator to ${name}?`)) return;
                                                sendCommand(game.op!(name), opKey);
                                            }}
                                        >
                                            <span className={busy === opKey ? 'spin' : undefined}>
                                                <Icon name={busy === opKey ? 'refresh' : 'crown'} size={12} />
                                            </span>
                                        </button>
                                    )}
                                    {game.deop && (
                                        <button
                                            type={'button'}
                                            className={'player-action'}
                                            title={'Revoke OP / admin'}
                                            disabled={busy === deopKey || !connected}
                                            onClick={() => sendCommand(game.deop!(name), deopKey)}
                                        >
                                            <span className={busy === deopKey ? 'spin' : undefined}>
                                                <Icon name={busy === deopKey ? 'refresh' : 'shield'} size={12} />
                                            </span>
                                        </button>
                                    )}
                                    <button
                                        type={'button'}
                                        className={'player-action'}
                                        title={'Kick'}
                                        disabled={busy === kickKey || !connected}
                                        onClick={() => {
                                            const reason = prompt(`Kick ${name}? Optional reason:`, '');
                                            if (reason === null) return;
                                            sendCommand(game.kick(name, reason || undefined), kickKey);
                                        }}
                                    >
                                        <span className={busy === kickKey ? 'spin' : undefined}>
                                            <Icon name={busy === kickKey ? 'refresh' : 'user-x'} size={12} />
                                        </span>
                                    </button>
                                    <button
                                        type={'button'}
                                        className={'player-action danger'}
                                        title={'Ban'}
                                        disabled={busy === banKey || !connected}
                                        onClick={() => {
                                            const reason = prompt(
                                                `Ban ${name}? Optional reason (this is permanent on most games):`,
                                                '',
                                            );
                                            if (reason === null) return;
                                            if (!confirm(`Confirm ban for ${name}?`)) return;
                                            sendCommand(game.ban(name, reason || undefined), banKey);
                                        }}
                                    >
                                        <span className={busy === banKey ? 'spin' : undefined}>
                                            <Icon name={busy === banKey ? 'refresh' : 'gavel'} size={12} />
                                        </span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PlayerManager;
