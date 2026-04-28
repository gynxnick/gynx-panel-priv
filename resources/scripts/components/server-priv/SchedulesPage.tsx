import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ServerContext } from '@/state/server';
import getServerSchedules from '@/api/server/schedules/getServerSchedules';
import createOrUpdateSchedule from '@/api/server/schedules/createOrUpdateSchedule';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import { httpErrorToHuman } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import { Icon } from './Icon';

// Schedules page — wireframe layout backed by the real schedule API.
//
// Schedules with a fixed numeric cron-hour ("0 4 ...", "0 ...", etc.) get
// a colored event block on the 24h timeline. Wildcards in the hour field
// render as repeating events across all hours; step expressions (the
// star-slash-N form) and comma lists also parse. Anything more exotic
// (ranges, mixed) gets a single block at midnight plus a "custom cron"
// hint — exact parsing of every cron variant is out of scope here, the
// legacy edit page handles authoring.
//
// Below the timeline a real tasks table renders one row per schedule
// with toggle (isActive) + edit (jumps to the legacy schedule editor).
// Delete / new schedule actions defer to the existing pages.

const COLORS = ['#7c3aed', '#22d3ee', '#ec4899', '#34d399', '#f59e0b'];
const colorFor = (i: number) => COLORS[i % COLORS.length];

interface ParsedHours {
    hours: number[];      // 0..23 hours this schedule fires at
    indeterminate: boolean; // true when we couldn't fully parse the hour expression
}

const parseHours = (hourExpr: string): ParsedHours => {
    const e = (hourExpr || '*').trim();
    if (e === '*') {
        return { hours: Array.from({ length: 24 }, (_, h) => h), indeterminate: false };
    }
    if (/^\d+$/.test(e)) {
        const h = Number(e);
        if (h >= 0 && h <= 23) return { hours: [h], indeterminate: false };
    }
    if (/^\*\/\d+$/.test(e)) {
        const step = Number(e.slice(2));
        if (step > 0 && step <= 24) {
            const out: number[] = [];
            for (let h = 0; h < 24; h += step) out.push(h);
            return { hours: out, indeterminate: false };
        }
    }
    if (/^[\d,]+$/.test(e)) {
        const out = e.split(',').map((s) => Number(s)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 23);
        if (out.length > 0) return { hours: out, indeterminate: false };
    }
    return { hours: [0], indeterminate: true };
};

const cronStr = (cron: Schedule['cron']) =>
    `${cron.minute} ${cron.hour} ${cron.dayOfMonth} ${cron.month} ${cron.dayOfWeek}`;

export const SchedulesPage = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const schedules = ServerContext.useStoreState((s) => s.schedules.data);
    const setSchedules = ServerContext.useStoreActions((a) => a.schedules.setSchedules);
    const appendSchedule = ServerContext.useStoreActions((a) => a.schedules.appendSchedule);

    const history = useHistory();
    const match = useRouteMatch<{ id: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setError(null);
        getServerSchedules(uuid)
            .then(setSchedules)
            .catch((err) => setError(httpErrorToHuman(err)))
            .finally(() => setLoading(false));
    }, [uuid]);

    const now = useMemo(() => new Date(), []);
    const nowHour = now.getHours() + now.getMinutes() / 60;

    const active = schedules.filter((s) => s.isActive);
    const nextRun = active
        .map((s) => s.nextRunAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0];

    const handleNew = async () => {
        const name = prompt('New schedule name:', '');
        if (!name) return;
        try {
            const created = await createOrUpdateSchedule(uuid, {
                name,
                cron: { minute: '0', hour: '*', dayOfWeek: '*', dayOfMonth: '*', month: '*' },
                onlyWhenOnline: true,
                isActive: false,
            } as any);
            appendSchedule(created);
            history.push(`/server/${match.params.id}/schedules/${created.id}`);
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        }
    };

    const handleToggle = async (s: Schedule) => {
        try {
            const updated = await createOrUpdateSchedule(uuid, {
                id: s.id,
                name: s.name,
                cron: s.cron,
                onlyWhenOnline: s.onlyWhenOnline,
                isActive: !s.isActive,
            } as any);
            setSchedules(schedules.map((x) => (x.id === s.id ? { ...updated, tasks: s.tasks } : x)));
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        }
    };

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Schedules</div>
                    <div className={'page-sub'}>
                        Automated tasks that run on cron expressions. Keep your server fresh.
                    </div>
                </div>
                <div className={'spacer'} />
                <button className={'btn'} disabled title={'Coming soon'}>
                    <Icon name={'sparkles'} size={13} />Suggest with ai
                </button>
                <button className={'btn btn-primary'} onClick={handleNew}>
                    <Icon name={'plus'} size={13} />New schedule
                </button>
            </div>

            <div className={'strip'}>
                <div className={'stat'}>
                    <div className={'sl'}>Active</div>
                    <div className={'sv'}>{active.length}</div>
                    <div className={'sd'}>of {schedules.length} total</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Next run</div>
                    <div className={'sv'}>
                        {nextRun ? formatDistanceToNow(nextRun) : '—'}
                    </div>
                    <div className={'sd'}>{nextRun ? `at ${nextRun.toLocaleTimeString()}` : 'no active schedules'}</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Processing</div>
                    <div className={'sv'}>{schedules.filter((s) => s.isProcessing).length}</div>
                    <div className={'sd'}>currently running</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Total tasks</div>
                    <div className={'sv'}>{schedules.reduce((sum, s) => sum + s.tasks.length, 0)}</div>
                    <div className={'sd'}>across all schedules</div>
                </div>
            </div>

            {error && (
                <div className={'notice warn'}>
                    <Icon name={'zap'} size={14} />
                    {error}
                </div>
            )}

            <div
                className={'panel'}
                style={{
                    padding: 0, flex: 1, minHeight: 0,
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
            >
                <div className={'console-header'}>
                    <div className={'console-title'}>
                        <Icon name={'clock'} size={13} color={'var(--purple)'} />
                        Today · {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className={'console-meta'}>
                        local · {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} now
                    </div>
                </div>

                <div
                    className={'tl-grid'}
                    style={{ borderBottom: '1px solid var(--line)', background: 'rgba(0,0,0,0.15)' }}
                >
                    <div
                        style={{
                            padding: '8px 14px', fontSize: 11, color: 'var(--text-faint)',
                            textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
                        }}
                    >
                        Schedule
                    </div>
                    {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className={'tl-hour'}>{String(h).padStart(2, '0')}</div>
                    ))}
                </div>

                <div className={'timeline'}>
                    {loading ? (
                        <div style={{ padding: 32, textAlign: 'center' }}>
                            <Spinner size={'large'} />
                        </div>
                    ) : schedules.length === 0 ? (
                        <div
                            style={{
                                padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13,
                            }}
                        >
                            No schedules yet. Click <strong style={{ color: 'var(--text)' }}>New schedule</strong> above to start.
                        </div>
                    ) : (
                        schedules.map((s, i) => {
                            const color = colorFor(i);
                            const parsed = parseHours(s.cron.hour);
                            const dense = parsed.hours.length > 6;
                            return (
                                <div key={s.id} className={'tl-row'}>
                                    <div className={'tl-name'}>
                                        <h5>
                                            <span
                                                style={{
                                                    display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                                                    background: color, marginRight: 8, boxShadow: `0 0 6px ${color}`,
                                                }}
                                            />
                                            {s.name}
                                        </h5>
                                        <span>{cronStr(s.cron)}{!s.isActive && ' · paused'}</span>
                                    </div>
                                    <div className={'tl-track'}>
                                        <div className={'tl-bg'} />
                                        {/* now marker only on first row, sketches the 24h cursor */}
                                        {i === 0 && (
                                            <div
                                                className={'tl-marker'}
                                                style={{ left: `${(nowHour / 24) * 100}%` }}
                                            />
                                        )}
                                        {parsed.hours.map((h, j) => {
                                            const isPast = h < nowHour;
                                            const isNext = !isPast && h === Math.min(...parsed.hours.filter((x) => x >= nowHour));
                                            return (
                                                <div
                                                    key={j}
                                                    className={`tl-event ${isNext ? 'next' : ''}`}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${(h / 24) * 100}%`,
                                                        width: `${(1 / 24) * 100 - 0.5}%`,
                                                        background: `linear-gradient(180deg, ${color}, ${color}cc)`,
                                                        opacity: !s.isActive ? 0.3 : isPast ? 0.4 : 1,
                                                    }}
                                                    title={`${String(h).padStart(2, '0')}:${s.cron.minute.padStart(2, '0')} — ${s.name}`}
                                                >
                                                    {!dense && `${String(h).padStart(2, '0')}:00`}
                                                </div>
                                            );
                                        })}
                                        {parsed.indeterminate && (
                                            <span
                                                style={{
                                                    position: 'absolute', right: 8,
                                                    fontSize: 10, color: 'var(--text-faint)',
                                                    fontFamily: "'JetBrains Mono',monospace",
                                                }}
                                                title={'Custom cron expression — open the schedule to inspect'}
                                            >custom cron</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {schedules.length > 0 && (
                <div className={'panel'} style={{ padding: 0, overflow: 'hidden' }}>
                    <table className={'tbl'}>
                        <thead>
                            <tr>
                                <th>Schedule</th>
                                <th>Cron</th>
                                <th>Next run</th>
                                <th>Last run</th>
                                <th>Status</th>
                                <th style={{ width: 100 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {schedules.map((s, i) => {
                                const color = colorFor(i);
                                return (
                                    <tr key={s.id}>
                                        <td>
                                            <div
                                                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                                                onClick={() => history.push(`/server/${match.params.id}/schedules/${s.id}`)}
                                            >
                                                <span
                                                    style={{
                                                        width: 8, height: 8, borderRadius: 2,
                                                        background: color, boxShadow: `0 0 6px ${color}`,
                                                    }}
                                                />
                                                <div>
                                                    <div style={{ color: 'white', fontWeight: 500 }}>{s.name}</div>
                                                    <div
                                                        style={{
                                                            fontSize: 11, color: 'var(--text-faint)', marginTop: 2,
                                                        }}
                                                    >
                                                        {s.tasks.length} task{s.tasks.length === 1 ? '' : 's'}
                                                        {s.onlyWhenOnline && ' · only when online'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={'mono'}>{cronStr(s.cron)}</td>
                                        <td className={'mono'}>
                                            {s.nextRunAt ? formatDistanceToNow(s.nextRunAt, { addSuffix: true }) : '—'}
                                        </td>
                                        <td className={'dim mono'}>
                                            {s.lastRunAt ? formatDistanceToNow(s.lastRunAt, { addSuffix: true }) : 'never'}
                                        </td>
                                        <td>
                                            <span className={'sd-status'}>
                                                <span
                                                    className={'dot'}
                                                    style={{
                                                        background: s.isActive ? 'var(--green)' : 'var(--text-faint)',
                                                        boxShadow: s.isActive ? '0 0 6px var(--green)' : 'none',
                                                    }}
                                                />
                                                {s.isProcessing ? 'Running' : s.isActive ? 'Active' : 'Paused'}
                                            </span>
                                        </td>
                                        <td>
                                            <div
                                                className={'row gap-4'}
                                                style={{ justifyContent: 'flex-end', gap: 4 }}
                                            >
                                                <div
                                                    className={`switch ${s.isActive ? 'on' : ''}`}
                                                    onClick={() => handleToggle(s)}
                                                    title={s.isActive ? 'Pause' : 'Activate'}
                                                />
                                                <button
                                                    className={'icon-btn'}
                                                    onClick={() => history.push(`/server/${match.params.id}/schedules/${s.id}`)}
                                                    title={'Edit tasks'}
                                                >
                                                    <Icon name={'settings'} size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SchedulesPage;
