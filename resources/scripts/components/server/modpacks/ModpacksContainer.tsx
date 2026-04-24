import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch,
    faBoxes,
    faTrashAlt,
    faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { debounce } from 'debounce';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import { EmptyState, Card as GynxCard, Pill } from '@/components/gynx';
import SourceFilter from '@/components/server/plugins/SourceFilter';
import PluginCard from '@/components/server/plugins/PluginCard';
import { PluginSearchHit, PluginSourceInfo, PluginSourceSlug } from '@/api/server/plugins';
import {
    installModpack,
    InstalledModpack,
    listInstalledModpacks,
    listModpackSources,
    ModpackSearchHit,
    removeInstalledModpack,
    searchModpacks,
} from '@/api/server/modpacks';

// --- one reused scaffold (~identical to Plugins/Mods) ---

const Banner = styled.div`
    ${tw`flex items-start gap-3 rounded-md p-3 mb-4 text-xs`};
    background: rgba(252, 211, 77, 0.06);
    border: 1px solid rgba(252, 211, 77, 0.32);
    color: #FCD34D;
    font-family: 'Inter', sans-serif;
    line-height: 1.55;
`;

const BannerIcon = styled(FontAwesomeIcon)`
    ${tw`flex-shrink-0 mt-0.5`};
    color: #FCD34D;
`;

const Toolbar = styled.div`
    ${tw`flex flex-col gap-3 mb-4`};
`;

const SearchBox = styled.div`
    ${tw`relative`};

    input {
        width: 100%;
        min-height: 42px;
        padding: 10px 12px 10px 38px;
        background: rgba(15, 17, 26, 0.95);
        border: 1px solid var(--gynx-edge);
        border-radius: 10px;
        color: var(--gynx-text);
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        transition: border-color .15s ease, box-shadow .15s ease;
    }

    input::placeholder { color: var(--gynx-text-mute); }

    input:focus {
        border-color: rgba(124, 58, 237, 0.55);
        box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.18);
        outline: none;
    }
`;

const SearchIcon = styled(FontAwesomeIcon)`
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--gynx-text-mute);
    font-size: 13px;
    pointer-events: none;
`;

const Tabs = styled.div`
    ${tw`flex items-center gap-1 p-1 rounded-lg mb-4`};
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--gynx-edge);
    width: fit-content;
`;

const Tab = styled.button<{ $active: boolean }>`
    ${tw`px-3 py-1.5 rounded-md text-xs font-medium border-0 cursor-pointer`};
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
    background: ${({ $active }) => ($active ? 'rgba(124, 58, 237, 0.18)' : 'transparent')};
    color: ${({ $active }) => ($active ? '#C4B5FD' : 'var(--gynx-text-dim)')};
    transition: color .15s ease, background .15s ease;
    &:hover { color: var(--gynx-text); }
`;

const Grid = styled.div`
    ${tw`grid grid-cols-1 lg:grid-cols-2 gap-3`};
`;

const Hint = styled.p`
    ${tw`text-xs m-0 mt-2`};
    color: var(--gynx-text-mute);
    font-family: 'Inter', sans-serif;
`;

const InstalledRow = styled.div`
    ${tw`flex items-center gap-3 px-3 py-2.5 rounded-md`};
    &:hover { background: rgba(255, 255, 255, 0.03); }
`;

const FileName = styled.code`
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    color: var(--gynx-text-mute);
    display: block;
    margin-top: 2px;
`;

const IconButton = styled.button<{ $danger?: boolean }>`
    ${tw`inline-flex items-center justify-center rounded-md cursor-pointer flex-shrink-0`};
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid var(--gynx-edge-2);
    color: ${({ $danger }) => ($danger ? '#F87171' : 'var(--gynx-text-dim)')};
    transition: color .15s ease, border-color .15s ease, background .15s ease;

    &:hover {
        color: ${({ $danger }) => ($danger ? '#F87171' : 'var(--gynx-text)')};
        background: ${({ $danger }) => ($danger ? 'rgba(248, 113, 113, 0.1)' : 'rgba(255, 255, 255, 0.04)')};
        border-color: ${({ $danger }) => ($danger ? 'rgba(248, 113, 113, 0.35)' : 'rgba(124, 58, 237, 0.35)')};
    }
`;

type TabKind = 'browse' | 'installed';

export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { clearFlashes, clearAndAddHttpError, addFlash } = useFlash();

    const [tab, setTab] = useState<TabKind>('browse');
    const [sources, setSources] = useState<PluginSourceInfo[]>([]);
    const [source, setSource] = useState<PluginSourceSlug>('modrinth');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ModpackSearchHit[]>([]);
    const [searching, setSearching] = useState(false);
    const [installing, setInstalling] = useState<string | null>(null);

    const [installed, setInstalled] = useState<InstalledModpack[]>([]);
    const [loadingInstalled, setLoadingInstalled] = useState(true);

    useEffect(() => {
        clearFlashes('modpacks');
        listModpackSources(uuid)
            .then(setSources)
            .catch((e) => clearAndAddHttpError({ key: 'modpacks', error: e }));
        listInstalledModpacks(uuid)
            .then(setInstalled)
            .catch((e) => clearAndAddHttpError({ key: 'modpacks', error: e }))
            .then(() => setLoadingInstalled(false));
    }, [uuid]);

    const installedIds = useMemo(
        () => new Set(installed.map((p) => `${p.source}:${p.externalId}`)),
        [installed],
    );

    const annotated = useMemo<PluginSearchHit[]>(
        () => results.map((r) => ({ ...r, installed: installedIds.has(`${r.source}:${r.external_id}`) })),
        [results, installedIds],
    );

    const runSearch = useRef(
        debounce((q: string, src: PluginSourceSlug) => {
            setSearching(true);
            searchModpacks(uuid, src, q)
                .then((hits) => setResults(hits))
                .catch((e) => clearAndAddHttpError({ key: 'modpacks', error: e }))
                .then(() => setSearching(false));
        }, 400),
    ).current;

    const onQueryChange = (q: string) => {
        setQuery(q);
        if (q.trim().length < 2) { setResults([]); return; }
        runSearch(q.trim(), source);
    };

    useEffect(() => {
        if (query.trim().length >= 2) runSearch(query.trim(), source);
    }, [source]);

    const onInstall = useCallback(async (hit: PluginSearchHit) => {
        const ok = window.confirm(
            `Download "${hit.name}" into /modpacks/?\n\n` +
            `This only downloads the archive. It does NOT extract it or overwrite your current files. ` +
            `Create a backup first if you plan to swap in the modpack's mods/configs manually.`,
        );
        if (!ok) return;

        setInstalling(`${hit.source}:${hit.external_id}`);
        clearFlashes('modpacks');
        try {
            await installModpack(uuid, { source: hit.source, external_id: hit.external_id });
            const fresh = await listInstalledModpacks(uuid);
            setInstalled(fresh);
            addFlash({
                key: 'modpacks',
                type: 'success',
                message: `Downloaded ${hit.name} to /modpacks/. Extract via the File Manager to proceed.`,
            });
        } catch (e) {
            clearAndAddHttpError({ key: 'modpacks', error: e });
        } finally {
            setInstalling(null);
        }
    }, [uuid]);

    const onRemove = useCallback(async (p: InstalledModpack) => {
        if (!window.confirm(`Delete the archive ${p.fileName}? Already-extracted files are NOT removed.`)) return;
        clearFlashes('modpacks');
        try {
            await removeInstalledModpack(uuid, p.id);
            setInstalled((prev) => prev.filter((x) => x.id !== p.id));
            addFlash({
                key: 'modpacks',
                type: 'success',
                message: `Removed modpack archive ${p.name}.`,
            });
        } catch (e) {
            clearAndAddHttpError({ key: 'modpacks', error: e });
        }
    }, [uuid]);

    const renderBrowse = () => (
        <>
            <Banner>
                <BannerIcon icon={faExclamationTriangle} />
                <div>
                    <strong>Heads up — modpacks download, they don’t auto-install.</strong>{' '}
                    Clicking install pulls the modpack archive (usually <code>.mrpack</code>) into <code>/modpacks/</code>.
                    You still need to back up, then extract it and copy its <code>overrides/</code> + mods into place via
                    the File Manager. Full auto-extract is coming in a later phase.
                </div>
            </Banner>

            <Toolbar>
                <SearchBox>
                    <SearchIcon icon={faSearch} />
                    <input
                        type={'text'}
                        placeholder={'Search modpacks — e.g. "fabulously optimized", "create above and beyond"'}
                        value={query}
                        onChange={(e) => onQueryChange(e.currentTarget.value)}
                        autoFocus
                    />
                </SearchBox>
                <SourceFilter sources={sources} selected={source} onSelect={setSource} />
            </Toolbar>

            {searching ? (
                <Spinner centered />
            ) : annotated.length === 0 && query.trim().length >= 2 ? (
                <EmptyState
                    size={'section'}
                    icon={<FontAwesomeIcon icon={faSearch} />}
                    title={'No matches'}
                    body={`Nothing on ${source} for "${query}".`}
                />
            ) : annotated.length > 0 ? (
                <Grid>
                    {annotated.map((hit) => (
                        <PluginCard
                            key={`${hit.source}:${hit.external_id}`}
                            hit={hit}
                            loading={installing === `${hit.source}:${hit.external_id}`}
                            onInstall={onInstall}
                        />
                    ))}
                </Grid>
            ) : (
                <Hint>Type at least 2 characters to search {source}.</Hint>
            )}
        </>
    );

    const renderInstalled = () => {
        if (loadingInstalled) return <Spinner centered />;
        if (installed.length === 0) {
            return (
                <EmptyState
                    size={'page'}
                    icon={<FontAwesomeIcon icon={faBoxes} />}
                    title={'No modpack archives'}
                    body={'Download a modpack from the Browse tab. Archives land in /modpacks/.'}
                />
            );
        }

        return (
            <GynxCard>
                {installed.map((p) => (
                    <InstalledRow key={p.id}>
                        <div style={{ color: '#C4B5FD', width: 20, textAlign: 'center' }}>
                            <FontAwesomeIcon icon={faBoxes} />
                        </div>
                        <div css={tw`flex-1 min-w-0`}>
                            <div css={tw`flex items-center gap-2 flex-wrap`}>
                                <strong css={tw`text-sm`}>{p.name}</strong>
                                {p.version && <Pill variant={'idle'}>{p.version}</Pill>}
                                <Pill variant={p.status === 'extracted' ? 'live' : p.status === 'failed' ? 'err' : 'warn'}>
                                    {p.status}
                                </Pill>
                            </div>
                            <FileName title={p.fileName}>/modpacks/{p.fileName}</FileName>
                        </div>
                        <IconButton $danger type={'button'} onClick={() => onRemove(p)} title={`Remove archive`}>
                            <FontAwesomeIcon icon={faTrashAlt} />
                        </IconButton>
                    </InstalledRow>
                ))}
            </GynxCard>
        );
    };

    return (
        <ServerContentBlock title={'Modpacks'}>
            <FlashMessageRender byKey={'modpacks'} css={tw`mb-4`} />

            <Tabs role={'tablist'} aria-label={'modpacks tabs'}>
                <Tab role={'tab'} aria-selected={tab === 'browse'} $active={tab === 'browse'} onClick={() => setTab('browse')}>
                    Browse
                </Tab>
                <Tab role={'tab'} aria-selected={tab === 'installed'} $active={tab === 'installed'} onClick={() => setTab('installed')}>
                    Downloaded{installed.length > 0 && ` · ${installed.length}`}
                </Tab>
            </Tabs>

            {tab === 'browse' ? renderBrowse() : renderInstalled()}
        </ServerContentBlock>
    );
};
