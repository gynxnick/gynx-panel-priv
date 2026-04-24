import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faCubes, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
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
    installMod,
    InstalledMod,
    listInstalledMods,
    listModSources,
    ModSearchHit,
    removeInstalledMod,
    searchMods,
} from '@/api/server/mods';

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
    const [results, setResults] = useState<ModSearchHit[]>([]);
    const [searching, setSearching] = useState(false);
    const [installing, setInstalling] = useState<string | null>(null);

    const [installed, setInstalled] = useState<InstalledMod[]>([]);
    const [loadingInstalled, setLoadingInstalled] = useState(true);

    useEffect(() => {
        clearFlashes('mods');
        listModSources(uuid)
            .then(setSources)
            .catch((e) => clearAndAddHttpError({ key: 'mods', error: e }));
        listInstalledMods(uuid)
            .then(setInstalled)
            .catch((e) => clearAndAddHttpError({ key: 'mods', error: e }))
            .then(() => setLoadingInstalled(false));
    }, [uuid]);

    const installedIds = useMemo(
        () => new Set(installed.map((m) => `${m.source}:${m.externalId}`)),
        [installed],
    );

    const annotated = useMemo<PluginSearchHit[]>(
        () => results.map((r) => ({ ...r, installed: installedIds.has(`${r.source}:${r.external_id}`) })),
        [results, installedIds],
    );

    const runSearch = useRef(
        debounce((q: string, src: PluginSourceSlug) => {
            setSearching(true);
            searchMods(uuid, src, q)
                .then((hits) => setResults(hits))
                .catch((e) => clearAndAddHttpError({ key: 'mods', error: e }))
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
        setInstalling(`${hit.source}:${hit.external_id}`);
        clearFlashes('mods');
        try {
            await installMod(uuid, { source: hit.source, external_id: hit.external_id });
            const fresh = await listInstalledMods(uuid);
            setInstalled(fresh);
            addFlash({
                key: 'mods',
                type: 'success',
                message: `Installed ${hit.name}. Restart the server for it to load.`,
            });
        } catch (e) {
            clearAndAddHttpError({ key: 'mods', error: e });
        } finally {
            setInstalling(null);
        }
    }, [uuid]);

    const onRemove = useCallback(async (m: InstalledMod) => {
        if (!window.confirm(`Remove ${m.name}? The jar will be deleted from /mods/.`)) return;
        clearFlashes('mods');
        try {
            await removeInstalledMod(uuid, m.id);
            setInstalled((prev) => prev.filter((x) => x.id !== m.id));
            addFlash({
                key: 'mods',
                type: 'success',
                message: `Removed ${m.name}. Restart the server to unload it from memory.`,
            });
        } catch (e) {
            clearAndAddHttpError({ key: 'mods', error: e });
        }
    }, [uuid]);

    const renderBrowse = () => (
        <>
            <Toolbar>
                <SearchBox>
                    <SearchIcon icon={faSearch} />
                    <input
                        type={'text'}
                        placeholder={'Search mods — e.g. "jei", "sodium", "create"'}
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
                    body={`Nothing on ${source} for "${query}". Check your game version or try a different search.`}
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
                    icon={<FontAwesomeIcon icon={faCubes} />}
                    title={'No mods installed'}
                    body={'Browse Modrinth and install your first mod from the Browse tab.'}
                />
            );
        }

        return (
            <GynxCard>
                {installed.map((m) => (
                    <InstalledRow key={m.id}>
                        <div style={{ color: '#C4B5FD', width: 20, textAlign: 'center' }}>
                            <FontAwesomeIcon icon={faCubes} />
                        </div>
                        <div css={tw`flex-1 min-w-0`}>
                            <div css={tw`flex items-center gap-2 flex-wrap`}>
                                <strong css={tw`text-sm`}>{m.name}</strong>
                                {m.version && <Pill variant={'idle'}>{m.version}</Pill>}
                                {m.loader && <Pill variant={'info'}>{m.loader}</Pill>}
                            </div>
                            <FileName title={m.fileName}>{m.fileName}</FileName>
                        </div>
                        <IconButton $danger type={'button'} onClick={() => onRemove(m)} title={`Remove ${m.name}`}>
                            <FontAwesomeIcon icon={faTrashAlt} />
                        </IconButton>
                    </InstalledRow>
                ))}
            </GynxCard>
        );
    };

    return (
        <ServerContentBlock title={'Mods'}>
            <FlashMessageRender byKey={'mods'} css={tw`mb-4`} />

            <Tabs role={'tablist'} aria-label={'mods tabs'}>
                <Tab role={'tab'} aria-selected={tab === 'browse'} $active={tab === 'browse'} onClick={() => setTab('browse')}>
                    Browse
                </Tab>
                <Tab role={'tab'} aria-selected={tab === 'installed'} $active={tab === 'installed'} onClick={() => setTab('installed')}>
                    Installed{installed.length > 0 && ` · ${installed.length}`}
                </Tab>
            </Tabs>

            {tab === 'browse' ? renderBrowse() : renderInstalled()}
        </ServerContentBlock>
    );
};
