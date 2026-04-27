import * as React from 'react';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';

/**
 * Console page — translated from the wireframe (~/Desktop/Gynx/wireframe/console.jsx).
 * Visual recreation only: all stats / console lines / activity feed are mock data
 * for now. Wiring sparklines to real CPU/RAM/Net stats and the console body to the
 * live WebSocket stream is a separate pass — this lands the visual layer first.
 */

const PURPLE = '#7c3aed';
const NEON = '#22d3ee';

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
            <Sparkline color={color} points={spark} />
        </div>
    </div>
);

const StatRow = () => (
    <div className={'stat-row'}>
        <Stat
            label={'CPU'} value={'42'} unit={'%'} icon={'zap'} color={PURPLE}
            spark={[28, 32, 30, 36, 34, 38, 42, 40, 36, 44, 38, 42, 40, 42]}
        />
        <Stat
            label={'Memory'} value={'5.2'} unit={' / 8 GB'} icon={'db'} color={NEON}
            spark={[40, 42, 45, 48, 50, 52, 55, 58, 60, 62, 64, 65, 65, 65]}
        />
        <Stat
            label={'Network'} value={'1.2'} unit={' MB/s'} icon={'globe'} color={PURPLE}
            spark={[12, 18, 14, 22, 28, 24, 32, 28, 36, 30, 38, 34, 32, 36]}
        />
        <Stat
            label={'TPS'} value={'19.8'} unit={' / 20'} icon={'trend-down'} color={NEON}
            spark={[20, 20, 19.9, 20, 20, 19.8, 18.5, 17.2, 18.8, 19.5, 19.8, 19.8, 19.8, 19.8]}
        />
        <Stat
            label={'Players'} value={'14'} unit={' / 60'} icon={'users'} color={PURPLE}
            spark={[8, 9, 11, 10, 12, 11, 13, 12, 13, 14, 14, 14, 14, 14]}
        />
    </div>
);

interface LogLine {
    t: string;
    l: 'INFO' | 'OK' | 'WARN' | 'ERR' | 'JOIN' | 'DIE' | 'CMD';
    who?: string;
    txt: string;
}

const CONSOLE_LINES: LogLine[] = [
    { t: '14:02:11', l: 'INFO', txt: 'Starting minecraft server version 1.21' },
    { t: '14:02:13', l: 'INFO', txt: 'Loading properties from server.properties' },
    { t: '14:02:14', l: 'INFO', txt: 'Default game type: SURVIVAL' },
    { t: '14:02:15', l: 'INFO', txt: 'Generating keypair' },
    { t: '14:02:16', l: 'INFO', txt: 'Starting Minecraft server on *:25565' },
    { t: '14:02:18', l: 'OK',   txt: 'Done (5.234s)! For help, type "help"' },
    { t: '14:02:18', l: 'INFO', txt: 'Timings Reset' },
    { t: '14:14:02', l: 'JOIN', who: 'Notch',      txt: ' joined the game' },
    { t: '14:14:48', l: 'JOIN', who: 'Dinnerbone', txt: ' joined the game' },
    { t: '14:15:12', l: 'JOIN', who: 'jeb_',       txt: ' joined the game' },
    { t: '14:18:33', l: 'WARN', txt: "Can't keep up! Is the server overloaded? Running 2150ms or 43 ticks behind" },
    { t: '14:22:01', l: 'INFO', txt: "Saving chunks for level 'world'" },
    { t: '14:22:04', l: 'INFO', txt: "Saving chunks for level 'world_nether'" },
    { t: '14:22:05', l: 'INFO', txt: "Saving chunks for level 'world_the_end'" },
    { t: '14:33:18', l: 'INFO', who: 'jeb_',       txt: ' has made the advancement [Taking Inventory]' },
    { t: '14:35:01', l: 'DIE',  who: 'Dinnerbone', txt: ' fell from a high place' },
    { t: '14:42:09', l: 'CMD',  who: 'Notch',      txt: ' issued server command: /weather clear' },
    { t: '14:42:09', l: 'OK',   txt: 'Set the weather to clear' },
];

const lvlClass = (l: LogLine['l']) =>
    ({ INFO: 'lvl-info', OK: 'lvl-ok', WARN: 'lvl-warn', ERR: 'lvl-err', JOIN: 'lvl-info', DIE: 'lvl-info', CMD: 'lvl-info' })[l] || 'lvl-info';

const ConsolePanel = () => (
    <div className={'panel console-panel'}>
        <div className={'console-header'}>
            <div className={'console-title'}>
                <span className={'live-dot'} />
                Live Console
            </div>
            <div className={'console-meta'}>stdout · 384 lines · paper-1.21.jar</div>
            <div className={'console-actions'}>
                <div className={'console-action'} title={'Filter'}>
                    <Icon name={'filter'} size={14} />
                </div>
                <div className={'console-action toggle on'} title={'Auto-scroll'}>
                    <Icon name={'chevron-down'} size={14} />
                </div>
                <div className={'console-action'} title={'Copy'}>
                    <Icon name={'copy'} size={14} />
                </div>
                <div className={'console-action'} title={'Fullscreen'}>
                    <Icon name={'expand'} size={14} />
                </div>
            </div>
        </div>
        <div className={'console-body'}>
            {CONSOLE_LINES.map((ln, i) => (
                <div className={'line'} key={i}>
                    <span className={'ts'}>[{ln.t}] </span>
                    <span className={lvlClass(ln.l)}>
                        [{ln.l === 'JOIN' || ln.l === 'DIE' || ln.l === 'CMD' ? 'INFO' : ln.l}]{' '}
                    </span>
                    {ln.who && <span className={'player'}>{ln.who}</span>}
                    <span className={'ev'}>{ln.txt}</span>
                </div>
            ))}
        </div>
        <div className={'console-input'}>
            <span className={'prompt'}>{'>'}</span>
            <input
                className={'console-input-field'}
                placeholder={'Type a command, or / to ask gynx ai…'}
                defaultValue={''}
            />
            <span className={'cursor'} />
            <span className={'hint'}>
                <span className={'kbd'}>↑↓</span> history
                <span className={'kbd'}>/</span> ai
            </span>
        </div>
    </div>
);

const AiCard = () => (
    <div className={'panel ai-card'}>
        <div className={'ai-card-bg'} />
        <div className={'ai-card-inner'}>
            <div className={'row'} style={{ justifyContent: 'space-between' }}>
                <span className={'ai-badge'}>
                    <Icon name={'sparkles'} size={11} color={'var(--purple)'} />
                    gynx ai
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono',monospace" }}>
                    just now
                </span>
            </div>
            <p className={'ai-msg'}>
                TPS dropped to <span className={'hl'}>17.2</span> at 14:18 — looks like chunk loading near spawn. Want me to install <span className={'hl'}>Chunky</span> and pre-generate?
            </p>
            <div className={'ai-actions'}>
                <button className={'btn btn-primary btn-sm'}>
                    <Icon name={'wand'} size={12} />
                    Diagnose & fix
                </button>
                <button className={'btn btn-sm'}>Dismiss</button>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <div
                    className={'row gap-8'}
                    style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid var(--line)',
                    }}
                >
                    <Icon name={'send'} size={13} color={'var(--text-faint)'} />
                    <span style={{ fontSize: 12.5, color: 'var(--text-faint)', flex: 1 }}>Ask anything…</span>
                    <span
                        className={'kbd'}
                        style={{
                            fontSize: 10,
                            padding: '2px 5px',
                            borderRadius: 3,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--line-2)',
                            fontFamily: "'JetBrains Mono',monospace",
                            color: 'var(--text-faint)',
                        }}
                    >
                        ⌘/
                    </span>
                </div>
            </div>
        </div>
    </div>
);

interface ActivityItem {
    who: string;
    verb: string;
    evt: 'evt-join' | 'evt-leave' | 'evt-die' | 'evt-cmd';
    t: string;
}

const ACTIVITY: ActivityItem[] = [
    { who: 'Notch',      verb: 'joined',         evt: 'evt-join',  t: '2m' },
    { who: 'Dinnerbone', verb: 'joined',         evt: 'evt-join',  t: '1m' },
    { who: 'jeb_',       verb: 'joined',         evt: 'evt-join',  t: '47s' },
    { who: 'Dinnerbone', verb: 'fell to death',  evt: 'evt-die',   t: '32s' },
    { who: 'Notch',      verb: 'ran /weather',   evt: 'evt-cmd',   t: '20s' },
    { who: 'herobrine',  verb: 'left',           evt: 'evt-leave', t: 'now' },
];

const ActivityFeed = () => (
    <div className={'panel rail-card'} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div className={'rail-title'}>
            Player activity
            <span className={'more'}>View all →</span>
        </div>
        <div className={'activity-list'} style={{ overflow: 'hidden' }}>
            {ACTIVITY.map((a, i) => (
                <div className={'activity-item'} key={i}>
                    <div className={'head-avatar'}>{a.who[0].toUpperCase()}</div>
                    <div className={`activity-text ${a.evt}`}>
                        <span className={'name'}>{a.who}</span>
                        <span className={'verb'}>{a.verb}</span>
                    </div>
                    <span className={'activity-time'}>{a.t}</span>
                </div>
            ))}
        </div>
    </div>
);

const QuickActions = () => (
    <div className={'panel rail-card'}>
        <div className={'rail-title'}>Quick actions</div>
        <div className={'quick-grid'}>
            <button className={'quick-btn'}>
                <Icon name={'sparkles'} size={13} color={'var(--purple)'} style={{ flexShrink: 0 }} />
                <span>Install plugin</span>
            </button>
            <button className={'quick-btn'}>
                <Icon name={'save'} size={13} color={'var(--text-faint)'} style={{ flexShrink: 0 }} />
                <span>Backup now</span>
            </button>
            <button className={'quick-btn'}>
                <Icon name={'broadcast'} size={13} color={'var(--text-faint)'} style={{ flexShrink: 0 }} />
                <span>Broadcast</span>
            </button>
            <button className={'quick-btn'}>
                <Icon name={'download'} size={13} color={'var(--text-faint)'} style={{ flexShrink: 0 }} />
                <span>Save world</span>
            </button>
        </div>
    </div>
);

export const ConsolePage = () => (
    <div className={'main'}>
        <div className={'col'}>
            <StatRow />
            <ConsolePanel />
        </div>
        <div className={'col'}>
            <AiCard />
            <ActivityFeed />
            <QuickActions />
        </div>
    </div>
);

export default ConsolePage;
