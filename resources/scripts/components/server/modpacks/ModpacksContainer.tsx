import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch,
    faBoxes,
    faTrashAlt,
    faExclamationTriangle,
    faBoxOpen,
} from '@fortawesome/free-solid-svg-icons';
import { debounce } from 'debounce';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import { useStoreState } from 'easy-peasy';
import useFlash from '@/plugins/useFlash';
import { ApplicationStore } from '@/state';
import { brand } from '@/state/settings';
import { ServerContext } from '@/state/server';
import { EmptyState, Card as GynxCard, Pill } from '@/components/gynx';
import SourceFilter from '@/components/server/plugins/SourceFilter';
import PluginCard from '@/components/server/plugins/PluginCard';
import { PluginSearchHit, PluginSourceInfo, PluginSourceSlug } from '@/api/server/plugins';
import {
    extractInstalledModpack,
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

    &:hover:not(:disabled) {
        color: ${({ $danger }) => ($danger ? '#F87171' : 'var(--gynx-text)')};
        background: ${({ $danger }) => ($danger ? 'rgba(248, 113, 113, 0.1)' : 'rgba(255, 255, 255, 0.04)')};
        border-color: ${({ $danger }) => ($danger ? 'rgba(248, 113, 113, 0.35)' : 'rgba(124, 58, 237, 0.35)')};
    }

    &:disabled { opacity: .55; cursor: not-allowed; }
`;

type TabKind = 'browse' | 'installed';

export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const brandCfg = useStoreState((state: ApplicationStore) => brand(state.settings.data));
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
    const [extracting, setExtracting] = useState<number | null>(null);
    // When true, extract calls pass keep_existing=1: skip the /mods/ wipe
    // and skip overrides that would clobber existing root entries. Default
    // off — first-time installs want a clean slate, the merge mode is for
    // updating an in-place pack while preserving the user's worlds, configs,
    // and hand-added mods.
    const [keepExistingFiles, setKeepExistingFiles] = useState(false);

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
        runSearch(q.trim(), source);
    };

    useEffect(() => {
        runSearch(query.trim(), source);
    }, [source, uuid]);

    const onInstall = useCallback(async (hit: PluginSearchHit, versionId?: string) => {
        const ok = window.confirm(
            `Install "${hit.name}"?\n\n` +
            `This will:\n` +
            `  1. Download the .mrpack to /modpacks/\n` +
            `  2. Pull every server-side mod into /mods/\n` +
            `  3. Lift overrides (configs, scripts, resources) into the server root\n\n` +
            `Stop the server first and back up your world / configs if there's anything you can't afford to lose.`,
        );
        if (!ok) return;

        setInstalling(`${hit.source}:${hit.external_id}`);
        clearFlashes('modpacks');
        try {
            const created = await installModpack(uuid, {
                source: hit.source,
                external_id: hit.external_id,
                ...(versionId ? { version_id: versionId } : {}),
            });

            // Refresh so the new "downloaded" row appears immediately even
            // if extract takes a minute. We chain extract straight after.
            const afterDownload = await listInstalledModpacks(uuid);
            setInstalled(afterDownload);

            const newId = created?.id as number | undefined;
            if (!newId) {
                addFlash({
                    key: 'modpacks',
                    type: 'success',
                    message: `Downloaded ${hit.name} to /modpacks/. Extract from the Downloaded tab to finish.`,
                });
                return;
            }

            try {
                const extracted = await extractInstalledModpack(uuid, newId, { keepExisting: keepExistingFiles });
                setInstalled((prev) => prev.map((x) => (x.id === newId ? { ...x, status: extracted.status } : x)));
                addFlash({
                    key: 'modpacks',
                    type: 'success',
                    message: `Installed ${hit.name}. Mod downloads are queued in Wings — check /mods/ in a minute.`,
                });
            } catch (extractErr) {
                clearAndAddHttpError({ key: 'modpacks', error: extractErr });
                // Keep the row visible; user can retry extract from the Downloaded tab.
                try { setInstalled(await listInstalledModpacks(uuid)); } catch { /* ignore */ }
            }
        } catch (e) {
            clearAndAddHttpError({ key: 'modpacks', error: e });
        } finally {
            setInstalling(null);
        }
    }, [uuid, keepExistingFiles]);

    const onExtract = useCallback(async (p: InstalledModpack) => {
        const merge = keepExistingFiles;
        const lines = merge ? [
            `Extract "${p.name}" in MERGE mode?`,
            ``,
            `This will:`,
            `  • Download every mod listed in the .mrpack manifest into /mods/`,
            `  • Copy overrides into the server root, SKIPPING any top-level entry that already exists`,
            `  • PRESERVE your existing /mods/ contents, /world, /configs, etc.`,
            ``,
            `Use this for in-place pack updates. Stop the server first.`,
        ] : [
            `Extract "${p.name}" with a CLEAN install?`,
            ``,
            `This will:`,
            `  • Wipe /mods/ first, then download every mod listed in the .mrpack manifest`,
            `  • Copy overrides into the server root, OVERWRITING any conflicting top-level entries`,
            ``,
            `Stop the server first and back up your current world / configs if you have anything you can't afford to lose.`,
        ];
        const ok = window.confirm(lines.join('\n'));
        if (!ok) return;

        setExtracting(p.id);
        clearFlashes('modpacks');
        try {
            const updated = await extractInstalledModpack(uuid, p.id, { keepExisting: merge });
            setInstalled((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: updated.status } : x)));
            addFlash({
                key: 'modpacks',
                type: 'success',
                message: `Extracted ${p.name}. Mod downloads are queued in Wings — check /mods/ in a minute.`,
            });
        } catch (e) {
            clearAndAddHttpError({ key: 'modpacks', error: e });
            // Server may still have flipped status to failed; refresh.
            try {
                const fresh = await listInstalledModpacks(uuid);
                setInstalled(fresh);
            } catch { /* ignore */ }
        } finally {
            setExtracting(null);
        }
    }, [uuid, keepExistingFiles]);

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
                {/* Plain-text from the Branding admin page so ops can edit
                    without a redeploy. <code>/<em>/<strong> aren't honored
                    when the copy is admin-supplied — keep it readable as
                    one prose line. */}
                <div>{brandCfg.modpackInstallWarning}</div>
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

            {!searching && query.trim() === '' && annotated.length > 0 && (
                <Hint>Popular on {source} — type to search for something specific.</Hint>
            )}

            {searching ? (
                <Spinner centered />
            ) : annotated.length === 0 && query.trim() !== '' ? (
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
                            addonType={'modpack'}
                            serverUuid={uuid}
                            onInstall={onInstall}
                        />
                    ))}
                </Grid>
            ) : (
                <Hint>No results from {source} right now.</Hint>
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
            <>
                <label
                    css={tw`flex items-start gap-3 p-3 mb-3 rounded-md cursor-pointer select-none`}
                    style={{
                        background: keepExistingFiles ? 'rgba(124, 58, 237, 0.10)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${keepExistingFiles ? 'rgba(124, 58, 237, 0.35)' : 'var(--gynx-edge)'}`,
                    }}
                >
                    <input
                        type={'checkbox'}
                        checked={keepExistingFiles}
                        onChange={(e) => setKeepExistingFiles(e.currentTarget.checked)}
                        css={tw`mt-0.5`}
                    />
                    <div css={tw`flex-1`}>
                        <div css={tw`text-sm font-medium`} style={{ color: 'var(--gynx-text)' }}>
                            Keep existing files (merge install)
                        </div>
                        <div css={tw`text-xs mt-1`} style={{ color: 'var(--gynx-text-dim)', lineHeight: 1.5 }}>
                            Skip the <code>/mods/</code> wipe and don&apos;t overwrite top-level entries that already exist
                            (worlds, configs, mods you added by hand). Default is a clean install — newer pack files
                            replace existing ones, removed pack files vanish.
                        </div>
                    </div>
                </label>
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
                        {p.status === 'downloaded' && (
                            <IconButton
                                type={'button'}
                                onClick={() => onExtract(p)}
                                title={'Extract this modpack into the server'}
                                disabled={extracting === p.id}
                            >
                                {extracting === p.id ? <Spinner size={'small'} /> : <FontAwesomeIcon icon={faBoxOpen} />}
                            </IconButton>
                        )}
                        <IconButton $danger type={'button'} onClick={() => onRemove(p)} title={`Remove archive`}>
                            <FontAwesomeIcon icon={faTrashAlt} />
                        </IconButton>
                    </InstalledRow>
                ))}
                </GynxCard>
            </>
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
