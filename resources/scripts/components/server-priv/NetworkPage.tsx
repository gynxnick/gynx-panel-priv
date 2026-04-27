import * as React from 'react';
import { useEffect, useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import { Allocation } from '@/api/server/getServer';
import {
    listSubdomains,
    SubdomainRecord,
    releaseSubdomain,
} from '@/api/server/subdomains';
import setPrimaryServerAllocation from '@/api/server/network/setPrimaryServerAllocation';
import deleteServerAllocation from '@/api/server/network/deleteServerAllocation';
import { httpErrorToHuman } from '@/api/http';
import { Icon } from './Icon';

// Network page — wireframe layout (port allocations + embedded subdomain
// preview) backed by real Pterodactyl data. Allocations come from the
// server context (already loaded). Subdomains are fetched via
// listSubdomains and we show the first 3 with a "Manage all" link to
// /server/<id>/domain (the legacy subdomain manager — wireframe-styled
// version comes in a follow-up commit).

const copyToClipboard = async (text: string) => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    } catch (e) {
        console.error('copy failed', e);
    }
};

export const NetworkPage = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const allocations = ServerContext.useStoreState((s) => s.server.data!.allocations);
    const allocationLimit = ServerContext.useStoreState((s) => s.server.data!.featureLimits.allocations);
    const setServerFromState = ServerContext.useStoreActions((a) => a.server.setServerFromState);

    const history = useHistory();
    const match = useRouteMatch<{ id: string }>();

    const [subdomains, setSubdomains] = useState<SubdomainRecord[] | null>(null);
    const [subdomainError, setSubdomainError] = useState<string | null>(null);
    const [busy, setBusy] = useState<number | null>(null);

    useEffect(() => {
        listSubdomains(uuid)
            .then(setSubdomains)
            .catch((e) => setSubdomainError(httpErrorToHuman(e)));
    }, [uuid]);

    const sortedAllocations = [...allocations].sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.port - b.port;
    });
    const primary = sortedAllocations.find((a) => a.isDefault);

    const handleSetPrimary = async (a: Allocation) => {
        try {
            setBusy(a.id);
            await setPrimaryServerAllocation(uuid, a.id);
            setServerFromState((s) => ({
                ...s,
                allocations: s.allocations.map((x) => ({ ...x, isDefault: x.id === a.id })),
            }));
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusy(null);
        }
    };

    const handleDeleteAllocation = async (a: Allocation) => {
        if (a.isDefault) {
            alert('Cannot delete the primary allocation. Set another as primary first.');
            return;
        }
        if (!confirm(`Delete allocation ${a.ip}:${a.port}?`)) return;
        try {
            setBusy(a.id);
            await deleteServerAllocation(uuid, a.id);
            setServerFromState((s) => ({
                ...s,
                allocations: s.allocations.filter((x) => x.id !== a.id),
            }));
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusy(null);
        }
    };

    const handleReleaseSubdomain = async (rec: SubdomainRecord) => {
        if (!confirm(`Release subdomain ${rec.fqdn}? DNS record will be removed.`)) return;
        try {
            await releaseSubdomain(uuid, rec.id);
            setSubdomains((prev) => (prev || []).filter((x) => x.id !== rec.id));
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        }
    };

    const subdomainPreview = (subdomains || []).slice(0, 3);
    const node = ServerContext.useStoreState((s) => s.server.data!.node);

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Network</div>
                    <div className={'page-sub'}>Allocations, ports, and subdomains pointing to this server.</div>
                </div>
                <div className={'spacer'} />
                <button
                    className={'btn'}
                    onClick={() => history.push(`/server/${match.params.id}/domain`)}
                >
                    <Icon name={'globe'} size={13} />Subdomains
                </button>
                <button
                    className={'btn btn-primary'}
                    onClick={() => history.push(`/server/${match.params.id}/domain`)}
                >
                    <Icon name={'plus'} size={13} />New subdomain
                </button>
            </div>

            <div className={'strip'}>
                <div className={'stat'}>
                    <div className={'sl'}>Subdomains</div>
                    <div className={'sv'}>
                        {subdomains === null ? '—' : subdomains.length}
                    </div>
                    <div className={'sd'}>
                        {subdomains === null ? 'loading…' : subdomains.length === 0 ? 'none claimed' : `${subdomains.length} active`}
                    </div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Allocations</div>
                    <div className={'sv'}>
                        {allocations.length}
                        {allocationLimit > 0 && (
                            <span style={{ fontSize: 14, color: 'var(--text-faint)', fontWeight: 400 }}>
                                {' '}/ {allocationLimit}
                            </span>
                        )}
                    </div>
                    <div className={'sd'}>
                        {primary ? `primary :${primary.port}` : 'no primary set'}
                    </div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Node</div>
                    <div className={'sv'} style={{ fontSize: 16 }}>{node || '—'}</div>
                    <div className={'sd'}>routing target</div>
                </div>
                <div className={'stat'}>
                    <div className={'sl'}>Inbound /min</div>
                    <div className={'sv'}>—</div>
                    <div className={'sd'}>see Console for live</div>
                </div>
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'globe'} size={14} color={'var(--blue)'} />
                    <div>
                        <h3>Port allocations</h3>
                        <span className={'desc'}>
                            Ports forwarded to your container{node && ` on node ${node}`}
                        </span>
                    </div>
                </div>
                <table className={'tbl'}>
                    <thead>
                        <tr>
                            <th>IP</th>
                            <th>Port</th>
                            <th>Alias</th>
                            <th>Notes</th>
                            <th style={{ width: 130 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAllocations.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)' }}>
                                    No allocations on this server.
                                </td>
                            </tr>
                        ) : (
                            sortedAllocations.map((a) => (
                                <tr key={a.id}>
                                    <td className={'mono'}>{a.ip}</td>
                                    <td className={'mono'} style={{ color: 'white' }}>
                                        {a.port}
                                        {a.isDefault && (
                                            <span className={'tag featured'} style={{ marginLeft: 8 }}>
                                                ★ primary
                                            </span>
                                        )}
                                    </td>
                                    <td className={'mono dim'}>{a.alias || '—'}</td>
                                    <td className={'dim'}>{a.notes || '—'}</td>
                                    <td>
                                        <div className={'row gap-4'} style={{ gap: 4, justifyContent: 'flex-end' }}>
                                            <button
                                                className={'icon-btn'}
                                                onClick={() => copyToClipboard(`${a.ip}:${a.port}`)}
                                                title={'Copy IP:port'}
                                            >
                                                <Icon name={'copy'} size={12} />
                                            </button>
                                            {!a.isDefault && (
                                                <button
                                                    className={'icon-btn'}
                                                    onClick={() => handleSetPrimary(a)}
                                                    disabled={busy === a.id}
                                                    title={'Make primary'}
                                                    style={{ color: '#fcd34d' }}
                                                >
                                                    <Icon name={'zap'} size={12} />
                                                </button>
                                            )}
                                            <button
                                                className={'icon-btn'}
                                                onClick={() => handleDeleteAllocation(a)}
                                                disabled={busy === a.id || a.isDefault}
                                                title={a.isDefault ? 'Cannot delete primary' : 'Delete allocation'}
                                                style={{ color: a.isDefault ? 'var(--text-faint)' : 'var(--pink)' }}
                                            >
                                                <Icon name={'trash'} size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'sparkles'} size={14} color={'var(--purple)'} />
                    <div>
                        <h3>Subdomains</h3>
                        <span className={'desc'}>
                            Friendly hostnames pointing at this server. Configured by your platform admin.
                        </span>
                    </div>
                    <div className={'spacer'} />
                    <button
                        className={'btn btn-sm'}
                        onClick={() => history.push(`/server/${match.params.id}/domain`)}
                    >
                        Manage all →
                    </button>
                </div>
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {subdomainError ? (
                        <div className={'notice warn'}>
                            <Icon name={'zap'} size={14} />
                            {subdomainError}
                        </div>
                    ) : subdomains === null ? (
                        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                            Loading subdomains…
                        </div>
                    ) : subdomains.length === 0 ? (
                        <div
                            style={{
                                padding: 18, textAlign: 'center',
                                color: 'var(--text-faint)', fontSize: 12.5,
                                border: '1px dashed var(--line)', borderRadius: 10,
                            }}
                        >
                            No subdomains claimed yet. Click <strong style={{ color: 'var(--text)' }}>Manage all</strong> to add one.
                        </div>
                    ) : (
                        subdomainPreview.map((rec) => (
                            <div key={rec.id} className={'sd-row'}>
                                <div>
                                    <div className={'sd-domain'}>
                                        <span className={'sub'}>{rec.hostname}</span>
                                        <span className={'root'}>.{rec.zone?.domain ?? ''}</span>
                                    </div>
                                    <div className={'sd-meta'}>
                                        type {rec.recordType}{rec.zone && ` · ${rec.zone.label}`}
                                        {rec.createdAt && ` · created ${new Date(rec.createdAt).toLocaleDateString()}`}
                                    </div>
                                </div>
                                <span
                                    style={{
                                        padding: '4px 10px', borderRadius: 999,
                                        background: rec.recordType === 'SRV' ? 'rgba(34,211,238,0.1)' : 'rgba(124,58,237,0.1)',
                                        border: `1px solid ${rec.recordType === 'SRV' ? 'rgba(34,211,238,0.3)' : 'rgba(124,58,237,0.3)'}`,
                                        color: rec.recordType === 'SRV' ? '#67e8f9' : '#c4b5fd',
                                        width: 'fit-content', fontSize: 11.5,
                                        fontFamily: "'JetBrains Mono',monospace",
                                    }}
                                >{rec.recordType}</span>
                                <span className={'sd-status'}>
                                    <span className={'dot'} />
                                    Active
                                </span>
                                <div className={'row gap-4'} style={{ justifyContent: 'flex-end', gap: 4 }}>
                                    <button
                                        className={'icon-btn'}
                                        onClick={() => copyToClipboard(rec.fqdn)}
                                        title={'Copy FQDN'}
                                    >
                                        <Icon name={'copy'} size={13} />
                                    </button>
                                    <button
                                        className={'icon-btn'}
                                        onClick={() => handleReleaseSubdomain(rec)}
                                        title={'Release subdomain'}
                                        style={{ color: 'var(--pink)' }}
                                    >
                                        <Icon name={'trash'} size={13} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                    {subdomains && subdomains.length > 3 && (
                        <div
                            style={{
                                padding: '10px 12px', textAlign: 'center',
                                color: 'var(--text-faint)', fontSize: 12.5,
                                border: '1px dashed var(--line)', borderRadius: 10,
                            }}
                        >
                            {subdomains.length - 3} more subdomain{subdomains.length - 3 === 1 ? '' : 's'} —{' '}
                            <span
                                style={{ color: 'var(--purple)', cursor: 'pointer' }}
                                onClick={() => history.push(`/server/${match.params.id}/domain`)}
                            >
                                Manage all →
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NetworkPage;
