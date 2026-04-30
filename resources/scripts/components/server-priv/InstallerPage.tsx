import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ServerContext } from '@/state/server';
import {
    PluginSourceInfo,
    PluginSourceSlug,
    PluginSearchHit,
    listPluginSources,
    searchPlugins,
    listInstalledPlugins,
    installPlugin,
    InstalledPlugin,
} from '@/api/server/plugins';
import {
    listModSources,
    searchMods,
    listInstalledMods,
    installMod,
    InstalledMod,
    ModSearchHit,
} from '@/api/server/mods';
import {
    listModpackSources,
    searchModpacks,
    listInstalledModpacks,
    installModpack,
    InstalledModpack,
    ModpackSearchHit,
} from '@/api/server/modpacks';
import { httpErrorToHuman } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import { Icon } from './Icon';

// Unified installer — plugins / mods / modpacks. Same API shape across
// all three (listSources / search / listInstalled / install / remove)
// so we collapse the per-tab branching into a single fetch driver
// keyed on the tab. Real catalog data, real install action.

type Tab = 'plugins' | 'mods' | 'modpacks';

type AnyHit = PluginSearchHit | ModSearchHit | ModpackSearchHit;
type AnyInstalled = InstalledPlugin | InstalledMod | InstalledModpack;

// Toned-down source palette — the wireframe ran the brand colors at full
// saturation which read as "rainbow squares". These are muted by ~30%
// luma so they still color-code the source without competing for
// attention with content.
const SOURCE_BG: Record<string, string> = {
    modrinth: '#21a35a',
    curseforge: '#c25638',
    hangar: '#2c6a96',
    spigot: '#b87a26',
    thunderstore: '#5b6794',
    umod: '#7a4ec2',
};
const SOURCE_LABEL: Record<string, string> = {
    modrinth: 'Modrinth',
    curseforge: 'CurseForge',
    hangar: 'Hangar',
    spigot: 'SpigotMC',
    thunderstore: 'Thunderstore',
    umod: 'uMod',
};
const SOURCE_INITIAL: Record<string, string> = {
    modrinth: 'M',
    curseforge: 'C',
    hangar: 'H',
    spigot: 'S',
    thunderstore: 'T',
    umod: 'U',
};

const ICON_GRADIENT = (i: number): string =>
    i % 3 === 0 ? 'linear-gradient(135deg, #4c1d95, #1e3a8a)'
    : i % 3 === 1 ? 'linear-gradient(135deg, #831843, #4c1d95)'
    : 'linear-gradient(135deg, #0e7490, #1e3a8a)';

const fmtCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

interface ApiSet {
    listSources: (uuid: string) => Promise<PluginSourceInfo[]>;
    search: (
        uuid: string,
        source: PluginSourceSlug,
        q: string,
        mc?: string,
        page?: number,
    ) => Promise<AnyHit[]>;
    listInstalled: (uuid: string) => Promise<AnyInstalled[]>;
    install: (
        uuid: string,
        body: { source: PluginSourceSlug; external_id: string; version_id?: string; game_version?: string },
    ) => Promise<unknown>;
}

const APIS: Record<Tab, ApiSet> = {
    plugins: {
        listSources: listPluginSources,
        search: (uuid, source, q, mc, page) => searchPlugins(uuid, source, q, mc, page),
        listInstalled: listInstalledPlugins as (uuid: string) => Promise<AnyInstalled[]>,
        install: installPlugin,
    },
    mods: {
        listSources: listModSources,
        search: (uuid, source, q, mc, page) => searchMods(uuid, source, q, mc, page),
        listInstalled: listInstalledMods as (uuid: string) => Promise<AnyInstalled[]>,
        install: installMod,
    },
    modpacks: {
        listSources: listModpackSources,
        search: (uuid, source, q, mc, page) => searchModpacks(uuid, source, q, mc, page),
        listInstalled: listInstalledModpacks as (uuid: string) => Promise<AnyInstalled[]>,
        install: installModpack,
    },
};

export const InstallerPage = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const [tab, setTab] = useState<Tab>('plugins');
    const [sources, setSources] = useState<PluginSourceInfo[]>([]);
    const [sourcesLoaded, setSourcesLoaded] = useState(false);
    const [activeSource, setActiveSource] = useState<PluginSourceSlug | null>(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<AnyHit[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [installing, setInstalling] = useState<string | null>(null);
    const [installError, setInstallError] = useState<string | null>(null);
    const [justInstalledIds, setJustInstalledIds] = useState<Set<string>>(new Set());

    const api = APIS[tab];

    // Fetch the source list whenever the tab changes; pick the first
    // available source as the active one.
    useEffect(() => {
        let alive = true;
        setSourcesLoaded(false);
        api.listSources(uuid)
            .then((s) => {
                if (!alive) return;
                setSources(s);
                const firstAvailable = s.find((x) => x.available) ?? s[0];
                setActiveSource(firstAvailable ? firstAvailable.slug : null);
                setSelectedIdx(0);
                setJustInstalledIds(new Set());
            })
            .catch((e) => alive && setError(httpErrorToHuman(e as Error)))
            .finally(() => alive && setSourcesLoaded(true));
        return () => {
            alive = false;
        };
    }, [tab, uuid]);

    // Search whenever activeSource or query changes (debounced). The backend
    // returns up to 60 hits per source per query — there's no real
    // pagination, so this is the full result set the user sees.
    useEffect(() => {
        if (!activeSource) {
            setResults([]);
            return;
        }
        let alive = true;
        const id = window.setTimeout(() => {
            setLoading(true);
            setError(null);
            api.search(uuid, activeSource, query)
                .then((hits) => {
                    if (!alive) return;
                    setResults(hits);
                    setSelectedIdx(0);
                })
                .catch((e) => alive && setError(httpErrorToHuman(e as Error)))
                .finally(() => alive && setLoading(false));
        }, query ? 350 : 0);
        return () => {
            alive = false;
            window.clearTimeout(id);
        };
    }, [tab, activeSource, query, uuid]);

    const sel = results[Math.min(selectedIdx, Math.max(results.length - 1, 0))];

    const isInstalledHit = (h: AnyHit): boolean =>
        h.installed || justInstalledIds.has(h.external_id);

    const handleInstall = async () => {
        if (!sel || !activeSource) return;
        setInstalling(sel.name);
        setInstallError(null);
        try {
            await api.install(uuid, {
                source: activeSource,
                external_id: sel.external_id,
            });
            setJustInstalledIds((prev) => {
                const next = new Set(prev);
                next.add(sel.external_id);
                return next;
            });
        } catch (e) {
            setInstallError(httpErrorToHuman(e as Error));
        } finally {
            setInstalling(null);
        }
    };

    const visibleSources = sources.filter((s) => s.available);

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Install content</div>
                    <div className={'page-sub'}>
                        Plugins, mods, and modpacks from supported registries — installed straight to this server.
                    </div>
                </div>
                <div className={'spacer'} />
                <div className={'seg'}>
                    {([['plugins', 'Plugins', 'sparkles'], ['mods', 'Mods', 'wand'], ['modpacks', 'Modpacks', 'archive']] as const).map(([id, lbl, ic]) => (
                        <button
                            key={id}
                            className={`seg-btn ${tab === id ? 'active' : ''}`}
                            onClick={() => { setTab(id); setSelectedIdx(0); }}
                        >
                            <Icon name={ic} size={13} />{lbl}
                        </button>
                    ))}
                </div>
            </div>

            <div className={'row gap-8'} style={{ gap: 10 }}>
                <div className={'search-lg'}>
                    <Icon name={'search'} size={15} />
                    <input
                        placeholder={`Search ${tab}…`}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                        <button
                            className={'icon-btn'}
                            onClick={() => setQuery('')}
                            title={'Clear'}
                            style={{ width: 22, height: 22 }}
                        >
                            <Icon name={'plus'} size={11} style={{ transform: 'rotate(45deg)' }} />
                        </button>
                    )}
                </div>
            </div>

            <div className={'install-layout'}>
                <div className={'install-side'}>
                    <div className={'side-section'}>
                        <div className={'side-label'}>Source</div>
                        {!sourcesLoaded ? (
                            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-faint)' }}>
                                Loading…
                            </div>
                        ) : sources.length === 0 ? (
                            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.4 }}>
                                No registries match this server&apos;s game. Add one in <code>AddonGameRegistry</code> or use a supported egg.
                            </div>
                        ) : (
                            sources.map((s) => (
                                <div
                                    key={s.slug}
                                    className={`side-item ${activeSource === s.slug ? 'active' : ''}`}
                                    onClick={() => s.available && setActiveSource(s.slug)}
                                    style={!s.available ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                                    title={!s.available ? 'Source unavailable on this server' : undefined}
                                >
                                    <span
                                        style={{
                                            width: 18, height: 18, borderRadius: 4,
                                            background: SOURCE_BG[s.slug] ?? '#666',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 9, fontWeight: 700, color: '#0b0b0f',
                                            fontFamily: "'Space Grotesk',sans-serif",
                                        }}
                                    >
                                        {SOURCE_INITIAL[s.slug] ?? s.slug[0].toUpperCase()}
                                    </span>
                                    {SOURCE_LABEL[s.slug] ?? s.slug}
                                    {!s.available && (
                                        <span className={'ct'} style={{ fontSize: 9 }}>off</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    {visibleSources.length > 0 && (
                        <div
                            style={{
                                marginTop: 8, padding: '8px 10px',
                                fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5,
                            }}
                        >
                            {tab === 'modpacks'
                                ? 'Installing a modpack stops the server, swaps the jar, and may overwrite the world.'
                                : 'Installs land in the appropriate folder and load on the next restart.'}
                        </div>
                    )}
                </div>

                <div className={'item-grid'}>
                    {error ? (
                        <div
                            style={{
                                gridColumn: '1 / -1', padding: 24,
                                color: 'var(--pink)', fontSize: 13, textAlign: 'center',
                            }}
                        >
                            {error}
                        </div>
                    ) : loading ? (
                        <div
                            style={{
                                gridColumn: '1 / -1', padding: 32, textAlign: 'center',
                            }}
                        >
                            <Spinner size={'large'} />
                        </div>
                    ) : !activeSource ? (
                        <div
                            style={{
                                gridColumn: '1 / -1', padding: 24, textAlign: 'center',
                                color: 'var(--text-faint)', fontSize: 13,
                            }}
                        >
                            No registries are enabled for this server.
                        </div>
                    ) : results.length === 0 ? (
                        <div
                            style={{
                                gridColumn: '1 / -1', padding: 24, textAlign: 'center',
                                color: 'var(--text-faint)', fontSize: 13,
                            }}
                        >
                            {query
                                ? `No ${tab} match "${query}" on ${SOURCE_LABEL[activeSource]}.`
                                : `Type a query to search ${SOURCE_LABEL[activeSource]} for ${tab}.`}
                        </div>
                    ) : (
                        results.map((it, i) => {
                            const installed = isInstalledHit(it);
                            return (
                                <div
                                    key={`${it.source}-${it.external_id}`}
                                    className={`item-card ${i === selectedIdx ? 'selected' : ''}`}
                                    onClick={() => setSelectedIdx(i)}
                                >
                                    <div className={'item-head'}>
                                        <div
                                            className={'item-icon'}
                                            style={
                                                it.icon_url
                                                    ? {
                                                          background: `url(${it.icon_url}) center/cover, ${ICON_GRADIENT(i)}`,
                                                      }
                                                    : { background: ICON_GRADIENT(i) }
                                            }
                                        >
                                            {!it.icon_url && it.name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className={'item-name'}>{it.name}</div>
                                            <div className={'item-author'}>by {it.author}</div>
                                        </div>
                                        <span
                                            title={SOURCE_LABEL[it.source]}
                                            style={{
                                                width: 22, height: 22, borderRadius: 4,
                                                background: SOURCE_BG[it.source] ?? '#666',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 10, fontWeight: 700, color: '#0b0b0f',
                                                fontFamily: "'Space Grotesk',sans-serif", flexShrink: 0,
                                            }}
                                        >
                                            {SOURCE_INITIAL[it.source] ?? it.source[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <div className={'item-desc'}>{it.description}</div>
                                    <div className={'item-tags'}>
                                        {installed && (
                                            <span className={'tag compat'}>installed</span>
                                        )}
                                        {it.latest_version && (
                                            <span className={'tag'}>v{it.latest_version}</span>
                                        )}
                                    </div>
                                    <div className={'item-meta'}>
                                        <span className={'m'}>
                                            <Icon name={'download'} size={11} />
                                            {fmtCount(it.downloads)}
                                        </span>
                                        {it.latest_version && (
                                            <span className={'m'}>
                                                <Icon name={'clock'} size={11} />
                                                {it.latest_version}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className={'detail-panel'}>
                    {!sel ? (
                        <div
                            style={{
                                padding: 24, textAlign: 'center',
                                color: 'var(--text-faint)', fontSize: 13,
                            }}
                        >
                            {results.length === 0
                                ? 'Search a registry to see results.'
                                : 'Select a result to see details.'}
                        </div>
                    ) : (
                        <>
                            <div className={'detail-hero'}>
                                <div
                                    className={'row gap-8'}
                                    style={{ alignItems: 'flex-start', gap: 10 }}
                                >
                                    <div
                                        className={'item-icon'}
                                        style={{
                                            width: 56, height: 56, fontSize: 22,
                                            background: sel.icon_url
                                                ? `url(${sel.icon_url}) center/cover, linear-gradient(135deg, #7c3aed, #22d3ee)`
                                                : 'linear-gradient(135deg, #7c3aed, #22d3ee)',
                                        }}
                                    >
                                        {!sel.icon_url && sel.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className={'item-name'} style={{ fontSize: 17 }}>
                                            {sel.name}
                                        </div>
                                        <div className={'item-author'}>by {sel.author}</div>
                                        <div
                                            className={'row gap-6'}
                                            style={{ marginTop: 8, gap: 6 }}
                                        >
                                            {isInstalledHit(sel) && (
                                                <span className={'tag compat'}>installed</span>
                                            )}
                                            <span
                                                className={'tag'}
                                                style={{
                                                    background: SOURCE_BG[sel.source]
                                                        ? `${SOURCE_BG[sel.source]}20`
                                                        : 'transparent',
                                                }}
                                            >
                                                {SOURCE_LABEL[sel.source] ?? sel.source}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={'detail-body'}>
                                <h4>About</h4>
                                <p>{sel.description}</p>
                                <h4>Details</h4>
                                <ul>
                                    {sel.latest_version && (
                                        <li>
                                            <span className={'k'}>Latest version</span>
                                            <span className={'v'}>{sel.latest_version}</span>
                                        </li>
                                    )}
                                    <li>
                                        <span className={'k'}>Downloads</span>
                                        <span className={'v'}>{sel.downloads.toLocaleString()}</span>
                                    </li>
                                    <li>
                                        <span className={'k'}>Source</span>
                                        <span className={'v'}>{SOURCE_LABEL[sel.source] ?? sel.source}</span>
                                    </li>
                                    <li>
                                        <span className={'k'}>External ID</span>
                                        <span className={'v'}>{sel.external_id}</span>
                                    </li>
                                </ul>
                                {tab === 'modpacks' && (
                                    <>
                                        <h4>Heads up</h4>
                                        <p>
                                            Modpack installs replace the server jar and overwrite world data.
                                            Take a backup before continuing.
                                        </p>
                                    </>
                                )}
                                {installError && (
                                    <div className={'notice warn'}>
                                        <Icon name={'zap'} size={14} />
                                        {installError}
                                    </div>
                                )}
                            </div>
                            <div className={'detail-foot'}>
                                {installing === sel.name ? (
                                    <div
                                        style={{
                                            flex: 1, display: 'flex',
                                            flexDirection: 'column', gap: 6,
                                        }}
                                    >
                                        <div
                                            className={'row gap-8'}
                                            style={{ fontSize: 12, gap: 8 }}
                                        >
                                            <Icon name={'restart'} size={12} color={'var(--purple)'} className={'spin'} />
                                            <span style={{ color: 'var(--text)' }}>
                                                Installing…
                                            </span>
                                            <div className={'spacer'} />
                                        </div>
                                        <div className={'progress'}>
                                            <div style={{ width: '100%' }} />
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        className={'btn btn-primary'}
                                        style={{ flex: 1 }}
                                        onClick={handleInstall}
                                        disabled={isInstalledHit(sel) || !activeSource}
                                    >
                                        <Icon name={'download'} size={13} />
                                        {isInstalledHit(sel)
                                            ? `Already installed`
                                            : `Install ${tab === 'modpacks' ? 'modpack' : tab.slice(0, -1)}`}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InstallerPage;
