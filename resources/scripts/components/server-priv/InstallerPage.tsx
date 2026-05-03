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

// Inline SVG path data per registry, drawn against a 24×24 viewBox.
// Rendered as a monochrome glyph inside the colored square — replaces
// the bare letter initial when present, falls back otherwise.
// SOURCE_LOGO_SVG (below) takes precedence when present.
const SOURCE_ICON_PATH: Record<string, string> = {
    modrinth:
        'M3.5 12.5a8.5 8.5 0 0 1 15-5.5l-1.4 1.4A6.6 6.6 0 0 0 12 5.5a6.6 6.6 0 0 0-6.5 6.5h2c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5h2A8.5 8.5 0 0 1 12 20.5l-1.4-1.4a6.6 6.6 0 0 0 5-2.6 6.6 6.6 0 0 0 1.4-4 4.5 4.5 0 0 0-9-.4 8.5 8.5 0 0 1-4.5 0z',
    curseforge:
        'M5 19l3-3-2-2 2-2-3-3 4-4 3 3 2-2 2 2 3-3 3 3-3 3 2 2-2 2 3 3-4 4-3-3-2 2-2-2-3 3z',
    hangar: 'M3 11 12 4l9 7v9h-6v-6h-6v6H3z',
    spigot:
        'M4 6h7V4h6v8h-2v-2h-3v3H8v3l-2 2-2-2v-7h2zM12 18a3 3 0 0 0 6 0c0-1.5-3-5-3-5s-3 3.5-3 5z',
    thunderstore: 'M13 2 4 14h6l-2 8 9-13h-6l2-7z',
    umod:
        'M14.7 6.3a4 4 0 0 0-5.4 5.4l-6.3 6.3 1.6 1.6 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-1.6-1.6 2.3-2.3z',
};

// Official brand-logo SVGs (Simple Icons, CC0). Take precedence over
// SOURCE_ICON_PATH when present so the registry's actual mark renders
// instead of our hand-drawn substitute. Each uses fill="currentColor"
// so the path picks up the white text color from the colored tile.
// Sources: github.com/simple-icons/simple-icons/blob/develop/icons/{slug}.svg
//          gcdn.thunderstore.io/static/ts/thunderstore-logomark-white.svg
const SOURCE_LOGO_SVG: Record<string, string> = {
    modrinth:
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12.252.004a11.78 11.768 0 0 0-8.92 3.73 11 10.999 0 0 0-2.17 3.11 11.37 11.359 0 0 0-1.16 5.169c0 1.42.17 2.5.6 3.77.24.759.77 1.899 1.17 2.529a12.3 12.298 0 0 0 8.85 5.639c.44.05 2.54.07 2.76.02.2-.04.22.1-.26-1.7l-.36-1.37-1.01-.06a8.5 8.489 0 0 1-5.18-1.8 5.34 5.34 0 0 1-1.3-1.26c0-.05.34-.28.74-.5a37.572 37.545 0 0 1 2.88-1.629c.03 0 .5.45 1.06.98l1 .97 2.07-.43 2.06-.43 1.47-1.47c.8-.8 1.48-1.5 1.48-1.52 0-.09-.42-1.63-.46-1.7-.04-.06-.2-.03-1.02.18-.53.13-1.2.3-1.45.4l-.48.15-.53.53-.53.53-.93.1-.93.07-.52-.5a2.7 2.7 0 0 1-.96-1.7l-.13-.6.43-.57c.68-.9.68-.9 1.46-1.1.4-.1.65-.2.83-.33.13-.099.65-.579 1.14-1.069l.9-.9-.7-.7-.7-.7-1.95.54c-1.07.3-1.96.53-1.97.53-.03 0-2.23 2.48-2.63 2.97l-.29.35.28 1.03c.16.56.3 1.16.31 1.34l.03.3-.34.23c-.37.23-2.22 1.3-2.84 1.63-.36.2-.37.2-.44.1-.08-.1-.23-.6-.32-1.03-.18-.86-.17-2.75.02-3.73a8.84 8.839 0 0 1 7.9-6.93c.43-.03.77-.08.78-.1.06-.17.5-2.999.47-3.039-.01-.02-.1-.02-.2-.03Zm3.68.67c-.2 0-.3.1-.37.38-.06.23-.46 2.42-.46 2.52 0 .04.1.11.22.16a8.51 8.499 0 0 1 2.99 2 8.38 8.379 0 0 1 2.16 3.449 6.9 6.9 0 0 1 .4 2.8c0 1.07 0 1.27-.1 1.73a9.37 9.369 0 0 1-1.76 3.769c-.32.4-.98 1.06-1.37 1.38-.38.32-1.54 1.1-1.7 1.14-.1.03-.1.06-.07.26.03.18.64 2.56.7 2.78l.06.06a12.07 12.058 0 0 0 7.27-9.4c.13-.77.13-2.58 0-3.4a11.96 11.948 0 0 0-5.73-8.578c-.7-.42-2.05-1.06-2.25-1.06Z"/></svg>',
    curseforge:
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M18.326 9.2145S23.2261 8.4418 24 6.1882h-7.5066V4.4H0l2.0318 2.3576V9.173s5.1267-.2665 7.1098 1.2372c2.7146 2.516-3.053 5.917-3.053 5.917L5.0995 19.6c1.5465-1.4726 4.494-3.3775 9.8983-3.2857-2.0565.65-4.1245 1.6651-5.7344 3.2857h10.9248l-1.0288-3.2726s-7.918-4.6688-.8336-7.1127z"/></svg>',
    spigot:
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12.644 2.44c-.179.033-.456.182-.603.331-.245.2-.588.232-2.023.133l-1.713-.116.049.713.049.713h.652c.36-.016 1.207-.05 1.876-.083l1.224-.083v3.317l-.44.05c-.425.05-.457.1-.457.862 0 .713-.05.813-.36.863-.26.033-.39.182-.44.464-.016.232-.114.448-.18.497-.08.05-.228.597-.326 1.211-.228 1.526-.375 1.708-1.37 1.84-1.436.167-2.056.134-2.056-.148 0-.2-.244-.25-1.158-.25-1.012 0-1.158-.032-1.24-.33-.065-.25-.228-.333-.62-.333s-.555.083-.62.332c-.082.299-.228.332-1.224.332-1.011 0-1.158.033-1.256.332-.049.182-.18.331-.26.331-.082 0-.148.863-.148 1.99 0 1.609.05 1.99.229 1.99.13 0 .293.15.342.332.082.282.245.332 1.175.332.914 0 1.077.05 1.142.331.13.465 1.11.465 1.24 0 .065-.282.228-.331 1.158-.331.849 0 1.077-.05 1.077-.25 0-.397 2.121-.33 3.426.117 1.583.53 5.14.53 6.82 0 .653-.199 1.256-.332 1.338-.282.359.232.163.896-.343 1.178-.587.298-.587.563 0 1.956l.343.797 1.599-.067c1.73-.083 2.822-.48 3.915-1.41l.539-.464-.31-.912c-.327-.962-.734-1.327-1.518-1.327-.342 0-.473-.149-.766-.796-.506-1.144-1.224-1.758-2.758-2.355-.799-.315-1.582-.746-1.99-1.127-.604-.548-.685-.73-.832-1.775-.098-.63-.245-1.194-.326-1.244-.066-.05-.164-.265-.18-.497-.049-.282-.18-.431-.424-.464-.326-.05-.375-.15-.375-.863 0-.763-.033-.812-.44-.862-.458-.05-.458-.05-.507-1.526-.032-.929.017-1.542.13-1.658.115-.116.93-.183 2.09-.183h1.908l.05-.564c.032-.298-.017-.63-.099-.713-.098-.1-.816-.083-1.909.05-1.256.15-1.778.15-1.86.017-.146-.25-.848-.481-1.24-.398z"/></svg>',
    thunderstore:
        '<svg viewBox="0 0 1000 896" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M13.4223 496.845L209.485 838.17L300 650.202L200.99 477.966C189.992 458.897 189.992 436.945 200.99 417.779L324.555 202.755C335.561 183.611 354.447 172.666 376.421 172.675H442.857L314.286 462.366H473.143L257.143 881.384L690.941 361.014H557.588L648.593 172.675H808.03H900.762L1000 0H715.868H526.836H298.96C263.138 0.0084323 232.393 17.8324 214.461 48.9346L13.4223 398.9C-4.46781 430.078 -4.48036 465.827 13.4223 496.845ZM313.959 895.833H701.066C736.813 895.833 767.63 878.005 785.612 846.819L986.655 496.836C1004.44 465.827 1004.44 430.078 986.655 398.892L906.26 258.947H707.808L799.079 417.779C809.985 436.961 809.984 458.91 799.049 477.974L675.531 693.049C664.454 712.222 645.555 723.15 623.555 723.15H533.795L471.429 722.446L313.959 895.833Z"/></svg>',
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

// Tab id ↔ backend addon type. Used to filter the in-page Plugins/
// Mods/Modpacks tab strip down to types this server's game actually
// supports (Rust shouldn't see Plugins / Modpacks).
const TAB_TO_ADDON_TYPE: Record<Tab, 'plugin' | 'mod' | 'modpack'> = {
    plugins: 'plugin',
    mods: 'mod',
    modpacks: 'modpack',
};

const ALL_TAB_DEFS: ReadonlyArray<readonly [Tab, string, 'sparkles' | 'wand' | 'archive']> = [
    ['plugins', 'Plugins', 'sparkles'],
    ['mods', 'Mods', 'wand'],
    ['modpacks', 'Modpacks', 'archive'],
] as const;

export const InstallerPage = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const supportedTypes = ServerContext.useStoreState((s) => s.server.data?.supportedAddonTypes);
    const visibleTabDefs = useMemo(() => {
        // No backend hint? Show all three (back-compat with older API).
        if (!supportedTypes || supportedTypes.length === 0) return ALL_TAB_DEFS;
        return ALL_TAB_DEFS.filter(([id]) => supportedTypes.includes(TAB_TO_ADDON_TYPE[id]));
    }, [supportedTypes]);
    const initialTab: Tab = visibleTabDefs[0]?.[0] ?? 'plugins';
    const [tab, setTab] = useState<Tab>(initialTab);

    // If the server's supported types load AFTER first render and the
    // current tab isn't in the filtered set, snap to the first visible.
    useEffect(() => {
        if (!visibleTabDefs.some(([id]) => id === tab)) {
            const next = visibleTabDefs[0]?.[0];
            if (next) setTab(next);
        }
    }, [visibleTabDefs, tab]);
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
                    {visibleTabDefs.map(([id, lbl, ic]) => (
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
                                            fontSize: 9, fontWeight: 700, color: '#fff',
                                            fontFamily: "'Space Grotesk',sans-serif",
                                        }}
                                        aria-hidden='true'
                                    >
                                        {SOURCE_LOGO_SVG[s.slug] ? (
                                            <span
                                                style={{ width: 11, height: 11, display: 'inline-flex', color: 'currentColor' }}
                                                dangerouslySetInnerHTML={{ __html: SOURCE_LOGO_SVG[s.slug] }}
                                            />
                                        ) : SOURCE_ICON_PATH[s.slug] ? (
                                            <svg viewBox='0 0 24 24' width='11' height='11' fill='currentColor' aria-hidden='true'>
                                                <path d={SOURCE_ICON_PATH[s.slug]} />
                                            </svg>
                                        ) : (
                                            SOURCE_INITIAL[s.slug] ?? s.slug[0].toUpperCase()
                                        )}
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
