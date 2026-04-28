import * as React from 'react';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/server-priv/Icon';
import { useActivityLogs, ActivityLogFilters } from '@/api/account/activity';
import { httpErrorToHuman } from '@/api/http';
import { format, formatDistanceToNowStrict } from 'date-fns';
import Spinner from '@/components/elements/Spinner';
import useLocationHash from '@/plugins/useLocationHash';

// /account/activity — priv-styled activity log. Each row condenses to:
// who · event · ip · how-long-ago, with the raw timestamp tooltipped on
// hover. Filter by event or IP via the location hash, same convention as
// the legacy log so deep links keep working.

const ActivityRow = ({
    actorName, actorEmail, event, ip, timestamp, isApi,
}: {
    actorName: string;
    actorEmail: string;
    event: string;
    ip: string | null;
    timestamp: Date;
    isApi: boolean;
}) => (
    <div
        style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(120px, max-content) minmax(0, 1fr) minmax(0, max-content) minmax(0, max-content)',
            gap: 16, alignItems: 'center',
            padding: '10px 18px', borderBottom: '1px solid var(--line)',
        }}
    >
        <div
            style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={actorEmail || actorName}
        >
            {actorName}
        </div>
        <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            color: 'var(--purple-soft, #c4b5fd)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
        }} title={event}>
            {event}
            {isApi && (
                <span className={'tag'} style={{ fontSize: 9, padding: '0 5px' }} title={'Made via API key'}>
                    api
                </span>
            )}
        </div>
        <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            color: 'var(--text-faint)', whiteSpace: 'nowrap',
        }}>
            {ip ?? '—'}
        </div>
        <div
            style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}
            title={format(timestamp, 'MMM do, yyyy HH:mm:ss')}
        >
            {formatDistanceToNowStrict(timestamp, { addSuffix: true })}
        </div>
    </div>
);

export const ActivityPage = () => {
    const { hash } = useLocationHash();
    const [filters, setFilters] = useState<ActivityLogFilters>({
        page: 1,
        sorts: { timestamp: -1 },
    });
    const { data, isValidating, error } = useActivityLogs(filters, {
        revalidateOnMount: true,
        revalidateOnFocus: false,
    });

    useEffect(() => {
        setFilters((value) => ({
            ...value,
            page: 1,
            filters: { ip: hash.ip, event: hash.event },
        }));
    }, [hash]);

    const httpError = error ? httpErrorToHuman(error) : null;
    const hasFilters = !!(filters.filters?.ip || filters.filters?.event);
    const loading = !data && isValidating;

    return (
        <div className={'sub-main'} style={{ padding: '20px 24px 32px' }}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Activity</div>
                    <div className={'page-sub'}>
                        Every action taken on your account, including sign-ins, key changes, and server power events.
                    </div>
                </div>
                {hasFilters && (
                    <div style={{ marginLeft: 'auto' }}>
                        <button
                            className={'btn'}
                            onClick={() => {
                                window.location.hash = '';
                                setFilters((v) => ({ ...v, page: 1, filters: {} }));
                            }}
                        >
                            <Icon name={'plus'} size={13} style={{ transform: 'rotate(45deg)' }} />
                            Clear filters
                        </button>
                    </div>
                )}
            </div>

            {hasFilters && (
                <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap',
                    marginBottom: 12, fontSize: 12, color: 'var(--text-soft)',
                }}>
                    {filters.filters?.event && (
                        <span className={'tag'} style={{ background: 'var(--surface-2)' }}>
                            event: <code style={{ fontFamily: "'JetBrains Mono', monospace", marginLeft: 4 }}>
                                {filters.filters.event}
                            </code>
                        </span>
                    )}
                    {filters.filters?.ip && (
                        <span className={'tag'} style={{ background: 'var(--surface-2)' }}>
                            ip: <code style={{ fontFamily: "'JetBrains Mono', monospace", marginLeft: 4 }}>
                                {filters.filters.ip}
                            </code>
                        </span>
                    )}
                </div>
            )}

            {httpError && (
                <div className={'notice warn'} style={{ marginBottom: 12 }}>
                    <Icon name={'zap'} size={14} />{httpError}
                </div>
            )}

            <div className={'panel'} style={{ padding: 0 }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px, max-content) minmax(0, 1fr) minmax(0, max-content) minmax(0, max-content)',
                    gap: 16,
                    padding: '10px 18px',
                    borderBottom: '1px solid var(--line)',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'var(--text-faint)',
                }}>
                    <span>actor</span>
                    <span>event</span>
                    <span>ip</span>
                    <span>when</span>
                </div>
                {loading ? (
                    <div style={{ padding: 32, textAlign: 'center' }}>
                        <Spinner size={'small'} />
                    </div>
                ) : !data || data.items.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                        No activity in this slice of the log.
                    </div>
                ) : (
                    data.items.map((a) => (
                        <ActivityRow
                            key={a.id}
                            actorName={a.relationships.actor?.username ?? 'system'}
                            actorEmail={a.relationships.actor?.email ?? ''}
                            event={a.event}
                            ip={a.ip}
                            timestamp={a.timestamp}
                            isApi={a.isApi}
                        />
                    ))
                )}
            </div>

            {data && data.pagination.totalPages > 1 && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 12, fontSize: 12, color: 'var(--text-faint)',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    <span>
                        page {data.pagination.currentPage} of {data.pagination.totalPages}
                        {' · '}
                        {data.pagination.total} total
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            className={'btn btn-sm'}
                            disabled={data.pagination.currentPage <= 1}
                            onClick={() => setFilters((v) => ({ ...v, page: Math.max(1, (v.page ?? 1) - 1) }))}
                        >
                            <Icon name={'chevron-right'} size={11} style={{ transform: 'rotate(180deg)' }} />
                            Prev
                        </button>
                        <button
                            className={'btn btn-sm'}
                            disabled={data.pagination.currentPage >= data.pagination.totalPages}
                            onClick={() => setFilters((v) => ({ ...v, page: (v.page ?? 1) + 1 }))}
                        >
                            Next
                            <Icon name={'chevron-right'} size={11} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityPage;
