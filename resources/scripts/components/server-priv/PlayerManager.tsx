import * as React from 'react';
import { useCallback, useState } from 'react';
import { ServerContext } from '@/state/server';
import { Icon } from './Icon';
import { useServerRoster } from './useServerRoster';

/**
 * Right-rail player manager — wireframe-styled with real roster + game-aware
 * kick/ban/op/deop actions. Roster tracking lives in useServerRoster so the
 * Players stat tile on ConsolePage shares the same source.
 */

export const PlayerManager: React.FC = () => {
    const { connected, instance } = ServerContext.useStoreState((s) => s.socket);
    const { players, game, refresh } = useServerRoster();
    const [busy, setBusy] = useState<string | null>(null);

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
