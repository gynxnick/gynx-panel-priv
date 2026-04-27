import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faGlobe,
    faTrashAlt,
    faCircleNotch,
    faPlus,
    faCopy,
    faCheck,
} from '@fortawesome/free-solid-svg-icons';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import { EmptyState, Card as GynxCard, Pill } from '@/components/gynx';
import {
    claimSubdomain,
    listSubdomainZones,
    listSubdomains,
    releaseSubdomain,
    SubdomainRecord,
    SubdomainZone,
} from '@/api/server/subdomains';

// ---- scaffolding ----------------------------------------------------------

const Toolbar = styled.div`
    ${tw`flex flex-col md:flex-row gap-3 mb-4`};
`;

const HostInput = styled.div`
    ${tw`relative flex-1`};

    input {
        width: 100%;
        min-height: 42px;
        padding: 10px 12px 10px 14px;
        background: rgba(15, 17, 26, 0.95);
        border: 1px solid var(--gynx-edge);
        border-radius: 10px;
        color: var(--gynx-text);
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 14px;
        transition: border-color .15s ease, box-shadow .15s ease;
    }

    input::placeholder { color: var(--gynx-text-mute); }

    input:focus {
        border-color: rgba(124, 58, 237, 0.55);
        box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.22);
        outline: none;
    }
`;

const ZoneSuffix = styled.div`
    ${tw`flex items-center gap-2 px-3`};
    background: rgba(15, 17, 26, 0.6);
    border: 1px solid var(--gynx-edge);
    border-radius: 10px;
    color: var(--gynx-text-dim);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 13px;

    select {
        background: transparent;
        border: 0;
        color: var(--gynx-text);
        font-family: inherit;
        font-size: inherit;
        cursor: pointer;
        padding: 8px 4px;
    }

    select:focus { outline: none; }
`;

const ClaimButton = styled.button`
    ${tw`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-medium cursor-pointer flex-shrink-0`};
    min-width: 120px;
    background: linear-gradient(135deg, #7C3AED 0%, #9B5BFF 100%);
    color: #fff;
    border: 0;
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
    transition: box-shadow .15s ease, transform .15s ease;

    &:hover:not(:disabled) {
        box-shadow: 0 8px 20px -8px rgba(124, 58, 237, 0.55);
        transform: translateY(-1px);
    }

    &:disabled { opacity: .55; cursor: not-allowed; }
`;

const Hint = styled.p`
    ${tw`text-xs m-0 mt-1`};
    color: var(--gynx-text-mute);
    font-family: 'Inter', sans-serif;
`;

const ClaimRow = styled.div`
    ${tw`flex items-center gap-3 px-3 py-3`};
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    &:last-child { border-bottom: 0; }
`;

const Fqdn = styled.code`
    ${tw`flex-1 truncate`};
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 14px;
    color: var(--gynx-text);
`;

const TypePill = styled.span<{ $type: string }>`
    ${tw`inline-flex items-center px-2 py-0.5 rounded-md`};
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ $type }) => ($type === 'SRV' ? '#FCD34D' : '#34D399')};
    background: ${({ $type }) =>
        $type === 'SRV' ? 'rgba(252, 211, 77, 0.12)' : 'rgba(52, 211, 153, 0.12)'};
    border: 1px solid ${({ $type }) =>
        $type === 'SRV' ? 'rgba(252, 211, 77, 0.35)' : 'rgba(52, 211, 153, 0.35)'};
`;

const IconButton = styled.button<{ $danger?: boolean }>`
    ${tw`inline-flex items-center justify-center cursor-pointer flex-shrink-0`};
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid var(--gynx-edge-2);
    border-radius: 8px;
    color: ${({ $danger }) => ($danger ? '#F87171' : 'var(--gynx-text-dim)')};
    transition: color .15s ease, border-color .15s ease, background .15s ease;

    &:hover:not(:disabled) {
        color: ${({ $danger }) => ($danger ? '#FCA5A5' : 'var(--gynx-text)')};
        background: ${({ $danger }) => ($danger ? 'rgba(248, 113, 113, 0.1)' : 'rgba(124, 58, 237, 0.08)')};
        border-color: ${({ $danger }) =>
            $danger ? 'rgba(248, 113, 113, 0.4)' : 'rgba(124, 58, 237, 0.35)'};
    }

    &:disabled { opacity: .5; cursor: not-allowed; }
`;

// ---- component ------------------------------------------------------------

export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { clearFlashes, clearAndAddHttpError, addFlash } = useFlash();

    const [loading, setLoading] = useState(true);
    const [zones, setZones] = useState<SubdomainZone[]>([]);
    const [records, setRecords] = useState<SubdomainRecord[]>([]);

    const [hostname, setHostname] = useState('');
    const [zoneId, setZoneId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [releasing, setReleasing] = useState<number | null>(null);
    const [copied, setCopied] = useState<number | null>(null);

    useEffect(() => {
        clearFlashes('subdomains');
        Promise.all([listSubdomainZones(uuid), listSubdomains(uuid)])
            .then(([z, r]) => {
                setZones(z);
                setRecords(r);
                if (z[0]) setZoneId(z[0].id);
            })
            .catch((e) => clearAndAddHttpError({ key: 'subdomains', error: e }))
            .then(() => setLoading(false));
    }, [uuid]);

    const selectedZone = useMemo(
        () => zones.find((z) => z.id === zoneId) || null,
        [zones, zoneId],
    );

    // Existing claims grouped so multiple records under the same hostname
    // (A + SRV pair for Minecraft) render as one row with both type pills.
    const grouped = useMemo(() => {
        const map = new Map<string, SubdomainRecord[]>();
        for (const r of records) {
            const key = (r.zone?.id ?? 0) + ':' + r.hostname.replace(/^_minecraft\._tcp\./, '');
            const arr = map.get(key) ?? [];
            arr.push(r);
            map.set(key, arr);
        }
        return Array.from(map.values());
    }, [records]);

    const onClaim = useCallback(async () => {
        if (!zoneId || !hostname.trim()) return;
        setSubmitting(true);
        clearFlashes('subdomains');
        try {
            await claimSubdomain(uuid, { zone_id: zoneId, hostname: hostname.trim() });
            const fresh = await listSubdomains(uuid);
            setRecords(fresh);
            setHostname('');
            addFlash({
                key: 'subdomains',
                type: 'success',
                message: `Claimed ${hostname.trim()}.${selectedZone?.domain}. DNS propagation usually < 1 minute.`,
            });
        } catch (e) {
            clearAndAddHttpError({ key: 'subdomains', error: e });
        } finally {
            setSubmitting(false);
        }
    }, [uuid, zoneId, hostname, selectedZone?.domain]);

    const onRelease = useCallback(async (record: SubdomainRecord) => {
        if (!window.confirm(`Release ${record.fqdn}? This deletes the DNS record from Cloudflare.`)) return;
        setReleasing(record.id);
        clearFlashes('subdomains');
        try {
            await releaseSubdomain(uuid, record.id);
            setRecords((prev) => prev.filter((x) => x.id !== record.id));
            addFlash({
                key: 'subdomains',
                type: 'success',
                message: `Released ${record.fqdn}.`,
            });
        } catch (e) {
            clearAndAddHttpError({ key: 'subdomains', error: e });
        } finally {
            setReleasing(null);
        }
    }, [uuid]);

    const onCopy = (record: SubdomainRecord) => {
        const text = record.recordType === 'SRV'
            ? record.hostname.replace(/^_minecraft\._tcp\./, '') + '.' + (record.zone?.domain ?? '')
            : record.fqdn;
        navigator.clipboard?.writeText(text).then(() => {
            setCopied(record.id);
            window.setTimeout(() => setCopied((c) => (c === record.id ? null : c)), 1500);
        });
    };

    if (loading) {
        return (
            <ServerContentBlock title={'Domain'}>
                <Spinner size={'large'} centered />
            </ServerContentBlock>
        );
    }

    return (
        <ServerContentBlock title={'Domain'}>
            <FlashMessageRender byKey={'subdomains'} css={tw`mb-4`} />

            {zones.length === 0 ? (
                <EmptyState
                    size={'page'}
                    icon={<FontAwesomeIcon icon={faGlobe} />}
                    title={'No domains available'}
                    body={'Your panel admin hasn\'t registered any subdomain zones yet. Ask them to add one in Admin → Subdomains.'}
                />
            ) : (
                <>
                    <Toolbar>
                        <HostInput>
                            <input
                                type={'text'}
                                placeholder={'choose a hostname — e.g. myserver, smp, creative'}
                                value={hostname}
                                onChange={(e) => setHostname(e.currentTarget.value)}
                                maxLength={63}
                                onKeyDown={(e) => { if (e.key === 'Enter') onClaim(); }}
                            />
                        </HostInput>
                        <ZoneSuffix>
                            <span>.</span>
                            <select value={zoneId ?? ''} onChange={(e) => setZoneId(Number(e.currentTarget.value))}>
                                {zones.map((z) => (
                                    <option key={z.id} value={z.id}>{z.domain}</option>
                                ))}
                            </select>
                        </ZoneSuffix>
                        <ClaimButton
                            type={'button'}
                            disabled={submitting || !hostname.trim() || !zoneId}
                            onClick={onClaim}
                        >
                            {submitting ? <FontAwesomeIcon icon={faCircleNotch} spin /> : <FontAwesomeIcon icon={faPlus} />}
                            {submitting ? 'claiming…' : 'claim'}
                        </ClaimButton>
                    </Toolbar>
                    <Hint>
                        Letters, numbers, and hyphens. 1–63 characters. The panel will create an A record pointing at this server's IP.
                        Minecraft servers also get an SRV record so players can connect without a port.
                    </Hint>

                    <div css={tw`mt-6`}>
                        {records.length === 0 ? (
                            <EmptyState
                                size={'section'}
                                icon={<FontAwesomeIcon icon={faGlobe} />}
                                title={'No claims yet'}
                                body={'Pick a hostname above and click claim. Anything you claim shows up here.'}
                            />
                        ) : (
                            <GynxCard>
                                {grouped.map((group) => {
                                    const primary = group.find((r) => r.recordType === 'A') ?? group[0];
                                    return (
                                        <ClaimRow key={primary.id}>
                                            <FontAwesomeIcon icon={faGlobe} style={{ color: '#C4B5FD', width: 18 }} />
                                            <Fqdn title={primary.fqdn}>
                                                {primary.recordType === 'SRV'
                                                    ? primary.hostname.replace(/^_minecraft\._tcp\./, '') + '.' + (primary.zone?.domain ?? '')
                                                    : primary.fqdn}
                                            </Fqdn>
                                            <div css={tw`flex items-center gap-1.5 flex-shrink-0`}>
                                                {group.map((r) => (
                                                    <TypePill key={r.id} $type={r.recordType}>{r.recordType}</TypePill>
                                                ))}
                                            </div>
                                            <IconButton
                                                type={'button'}
                                                title={'Copy address'}
                                                onClick={() => onCopy(primary)}
                                            >
                                                <FontAwesomeIcon icon={copied === primary.id ? faCheck : faCopy} />
                                            </IconButton>
                                            <IconButton
                                                type={'button'}
                                                $danger
                                                title={'Release'}
                                                disabled={releasing === primary.id}
                                                onClick={() => {
                                                    // Release every record in the group so SRV + A are torn down together.
                                                    group.forEach((r) => onRelease(r));
                                                }}
                                            >
                                                <FontAwesomeIcon icon={releasing === primary.id ? faCircleNotch : faTrashAlt} spin={releasing === primary.id} />
                                            </IconButton>
                                            {group.some((r) => r.recordType === 'SRV') && (
                                                <Pill variant={'live'}>portless</Pill>
                                            )}
                                        </ClaimRow>
                                    );
                                })}
                            </GynxCard>
                        )}
                    </div>
                </>
            )}
        </ServerContentBlock>
    );
};
