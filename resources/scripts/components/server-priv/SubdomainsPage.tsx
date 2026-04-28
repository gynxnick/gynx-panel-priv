import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ServerContext } from '@/state/server';
import {
    claimSubdomain,
    listSubdomains,
    listSubdomainZones,
    releaseSubdomain,
    SubdomainRecord,
    SubdomainZone,
} from '@/api/server/subdomains';
import { httpErrorToHuman } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import { Icon } from './Icon';

// Subdomains page — wireframe layout backed by the real subdomain API.
// Two-column: records list + inline-create form on the left, right
// rail has the Available domains picker (real listSubdomainZones data),
// a basic DNS-health card (counts only — no live resolution), and an
// AI placeholder.

type RecordType = 'SRV' | 'CNAME' | 'A';

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

export const SubdomainsPage = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);

    const [zones, setZones] = useState<SubdomainZone[] | null>(null);
    const [records, setRecords] = useState<SubdomainRecord[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [activeDomain, setActiveDomain] = useState<string | null>(null);

    const [showAdd, setShowAdd] = useState(false);
    const [newHostname, setNewHostname] = useState('');
    const [newZoneId, setNewZoneId] = useState<number | null>(null);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        Promise.all([listSubdomainZones(uuid), listSubdomains(uuid)])
            .then(([z, r]) => {
                if (!alive) return;
                setZones(z);
                setRecords(r);
                if (z.length > 0 && activeDomain === null) {
                    setActiveDomain(z[0].domain);
                    setNewZoneId(z[0].id);
                }
            })
            .catch((e) => alive && setLoadError(httpErrorToHuman(e)));
        return () => {
            alive = false;
        };
    }, [uuid]);

    const visibleRecords = useMemo(() => {
        if (!records) return [];
        if (!activeDomain) return records;
        return records.filter((r) => r.zone?.domain === activeDomain);
    }, [records, activeDomain]);

    const counts = useMemo(() => {
        const out = new Map<string, number>();
        (records || []).forEach((r) => {
            const d = r.zone?.domain;
            if (!d) return;
            out.set(d, (out.get(d) ?? 0) + 1);
        });
        return out;
    }, [records]);

    const handleCreate = async () => {
        if (!newZoneId || !newHostname.trim()) {
            setCreateError('Hostname and zone are required.');
            return;
        }
        setCreateError(null);
        setCreating(true);
        try {
            const updated = await claimSubdomain(uuid, {
                zone_id: newZoneId,
                hostname: newHostname.trim(),
            });
            setRecords(updated);
            setShowAdd(false);
            setNewHostname('');
        } catch (e) {
            setCreateError(httpErrorToHuman(e as Error));
        } finally {
            setCreating(false);
        }
    };

    const handleRelease = async (rec: SubdomainRecord) => {
        if (!confirm(`Release ${rec.fqdn}? DNS record will be removed.`)) return;
        try {
            await releaseSubdomain(uuid, rec.id);
            setRecords((prev) => (prev || []).filter((x) => x.id !== rec.id));
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        }
    };

    const primaryRecord = (records || []).find((r) => r.recordType === 'SRV');
    const totalCount = records?.length ?? 0;

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Subdomains</div>
                    <div className={'page-sub'}>
                        Friendly hostnames pointing to this server. Records propagate in seconds.
                    </div>
                </div>
                <div className={'spacer'} />
                <button
                    className={'btn btn-primary'}
                    onClick={() => setShowAdd((v) => !v)}
                    disabled={!zones || zones.length === 0}
                >
                    <Icon name={'plus'} size={13} />
                    {showAdd ? 'Cancel' : 'New subdomain'}
                </button>
            </div>

            {loadError && (
                <div className={'notice warn'}>
                    <Icon name={'zap'} size={14} />
                    {loadError}
                </div>
            )}

            <div className={'sd-grid'}>
                <div className={'sd-list'}>
                    {primaryRecord && (
                        <div className={'notice purple'}>
                            <Icon name={'sparkles'} size={14} />
                            <div style={{ flex: 1 }}>
                                Players connect with{' '}
                                <span style={{ color: 'white', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5 }}>
                                    {primaryRecord.fqdn}
                                </span>
                                {' '}— no IP, no port.
                            </div>
                            <button className={'btn btn-sm'} onClick={() => copyToClipboard(primaryRecord.fqdn)}>
                                <Icon name={'copy'} size={12} />Copy
                            </button>
                        </div>
                    )}

                    {records === null ? (
                        <div style={{ padding: 32, textAlign: 'center' }}>
                            <Spinner size={'large'} />
                        </div>
                    ) : visibleRecords.length === 0 ? (
                        <div
                            style={{
                                padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13,
                                border: '1px dashed var(--line)', borderRadius: 10,
                            }}
                        >
                            {records.length === 0
                                ? 'No subdomains claimed yet. Click "New subdomain" to add one.'
                                : `No subdomains for ${activeDomain}. Try another zone or click "All" to see everything.`}
                        </div>
                    ) : (
                        visibleRecords.map((rec) => {
                            const isPrimary = primaryRecord?.id === rec.id;
                            return (
                                <div key={rec.id} className={`sd-row ${isPrimary ? 'primary' : ''}`}>
                                    <div>
                                        <div className={'sd-domain'}>
                                            <span className={'sub'}>{rec.hostname}</span>
                                            <span className={'root'}>.{rec.zone?.domain ?? ''}</span>
                                            {isPrimary && (
                                                <span className={'tag featured'} style={{ marginLeft: 8 }}>primary</span>
                                            )}
                                        </div>
                                        <div className={'sd-meta'}>
                                            type {rec.recordType}
                                            {rec.zone && ` · ${rec.zone.label}`}
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
                                    >{rec.recordType} record</span>
                                    <span className={'sd-status'}>
                                        <span className={'dot'} />Active
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
                                            onClick={() => handleRelease(rec)}
                                            title={'Release'}
                                            style={{ color: 'var(--pink)' }}
                                        >
                                            <Icon name={'trash'} size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {showAdd && zones && zones.length > 0 && (
                        <div
                            className={'sd-row'}
                            style={{
                                gridTemplateColumns: '1fr 1fr auto',
                                borderColor: 'rgba(124,58,237,0.5)',
                                background: 'rgba(40,30,60,0.4)',
                            }}
                        >
                            <div className={'cfg-row'} style={{ margin: 0 }}>
                                <label>Hostname</label>
                                <input
                                    placeholder={'survival'}
                                    value={newHostname}
                                    onChange={(e) => setNewHostname(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className={'cfg-row'} style={{ margin: 0 }}>
                                <label>Root domain</label>
                                <select
                                    value={newZoneId ?? ''}
                                    onChange={(e) => setNewZoneId(Number(e.target.value))}
                                >
                                    {zones.map((z) => (
                                        <option key={z.id} value={z.id}>{z.domain}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={'row gap-6'} style={{ alignSelf: 'end', gap: 6 }}>
                                <button
                                    className={'btn btn-sm'}
                                    onClick={() => { setShowAdd(false); setNewHostname(''); setCreateError(null); }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={'btn btn-primary btn-sm'}
                                    onClick={handleCreate}
                                    disabled={creating || !newHostname.trim() || !newZoneId}
                                >
                                    {creating ? 'Creating…' : 'Create'}
                                </button>
                            </div>
                            {createError && (
                                <div
                                    className={'notice warn'}
                                    style={{ gridColumn: '1 / -1', marginTop: 8 }}
                                >
                                    <Icon name={'zap'} size={14} />
                                    {createError}
                                </div>
                            )}
                        </div>
                    )}

                    {records && records.length > 0 && (
                        <div
                            style={{
                                border: '1px dashed rgba(255,255,255,0.12)',
                                borderRadius: 10,
                                padding: 14,
                                textAlign: 'center',
                                color: 'var(--text-faint)',
                                fontSize: 12.5,
                            }}
                        >
                            <span style={{ color: 'white', fontFamily: "'JetBrains Mono',monospace" }}>
                                {totalCount}
                            </span>{' '}
                            subdomain{totalCount === 1 ? '' : 's'} in use across all zones.
                        </div>
                    )}
                </div>

                <div className={'col'} style={{ gap: 12, minHeight: 0 }}>
                    <div className={'panel rail-card'}>
                        <div className={'rail-title'}>Available domains</div>
                        <div className={'dom-picker'}>
                            <div
                                className={`dom-item ${activeDomain === null ? 'active' : ''}`}
                                onClick={() => setActiveDomain(null)}
                            >
                                <Icon
                                    name={'globe'}
                                    size={13}
                                    color={activeDomain === null ? 'var(--purple)' : 'var(--text-faint)'}
                                />
                                All zones
                                <span className={'ct'}>{totalCount}</span>
                            </div>
                            {zones === null ? (
                                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-faint)' }}>
                                    Loading…
                                </div>
                            ) : zones.length === 0 ? (
                                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-faint)' }}>
                                    No zones available. Ask your admin to add a root domain.
                                </div>
                            ) : (
                                zones.map((z) => (
                                    <div
                                        key={z.id}
                                        className={`dom-item ${activeDomain === z.domain ? 'active' : ''}`}
                                        onClick={() => setActiveDomain(z.domain)}
                                    >
                                        <Icon
                                            name={'globe'}
                                            size={13}
                                            color={activeDomain === z.domain ? 'var(--purple)' : 'var(--text-faint)'}
                                        />
                                        {z.domain}
                                        <span className={'ct'}>{counts.get(z.domain) ?? 0}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div
                            style={{
                                fontSize: 11, color: 'var(--text-faint)',
                                marginTop: 4, lineHeight: 1.5,
                            }}
                        >
                            Roots are managed by your platform admin.
                        </div>
                    </div>

                    <div className={'panel rail-card'}>
                        <div className={'rail-title'}>Records summary</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <li className={'row gap-8'} style={{ fontSize: 12.5, gap: 8 }}>
                                <span className={'sd-status'}><span className={'dot'} /></span>
                                <span style={{ color: 'var(--text)' }}>Total records</span>
                                <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                                    {totalCount}
                                </span>
                            </li>
                            <li className={'row gap-8'} style={{ fontSize: 12.5, gap: 8 }}>
                                <span className={'sd-status'}><span className={'dot'} /></span>
                                <span style={{ color: 'var(--text)' }}>SRV records</span>
                                <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                                    {(records || []).filter((r) => r.recordType === 'SRV').length}
                                </span>
                            </li>
                            <li className={'row gap-8'} style={{ fontSize: 12.5, gap: 8 }}>
                                <span className={'sd-status'}><span className={'dot'} /></span>
                                <span style={{ color: 'var(--text)' }}>CNAME records</span>
                                <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                                    {(records || []).filter((r) => r.recordType === 'CNAME').length}
                                </span>
                            </li>
                            <li className={'row gap-8'} style={{ fontSize: 12.5, gap: 8 }}>
                                <span className={'sd-status'}><span className={'dot'} /></span>
                                <span style={{ color: 'var(--text)' }}>Available zones</span>
                                <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                                    {zones?.length ?? 0}
                                </span>
                            </li>
                        </ul>
                    </div>

                    <div className={'panel ai-card'}>
                        <div className={'ai-card-bg'} />
                        <div className={'ai-card-inner'}>
                            <span className={'ai-badge'}>gynx ai</span>
                            <p className={'ai-msg'} style={{ fontSize: 13 }}>
                                Coming soon: vanity short links and Discord integration that route users to{' '}
                                <span className={'hl'}>
                                    {primaryRecord?.fqdn ?? 'your subdomain'}
                                </span>
                                {' '}automatically.
                            </p>
                            <div className={'ai-actions'}>
                                <button className={'btn btn-sm'} disabled>Notify me</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubdomainsPage;
