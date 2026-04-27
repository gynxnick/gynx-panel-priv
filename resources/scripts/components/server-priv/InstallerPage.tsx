import * as React from 'react';
import { useState } from 'react';
import { Icon } from './Icon';

/**
 * Unified Install browser — plugins / mods / modpacks. Wireframe says
 * this is the gynx-only headline feature; visual recreation here, with
 * mock catalog data. Real Modrinth / CurseForge / Hangar API integration
 * is a separate backend effort (registry choices need to be coordinated
 * with the gynx backend before wiring).
 */

type Tab = 'plugins' | 'mods' | 'modpacks';

interface Item {
    name: string;
    author: string;
    desc: string;
    icon: string;
    dl: string;
    v: string;
    mc: string;
    tags: string[];
    sourceLogo: 'M' | 'C' | 'H' | 'S';
    loader?: string;
    count?: string;
}

interface CatalogTab {
    categories: Array<[string, string, number]>;
    sources: Array<[string, string, number]>;
    items: Item[];
}

const CATALOG: Record<Tab, CatalogTab> = {
    plugins: {
        categories: [
            ['all', 'All', 482], ['admin', 'Admin tools', 84], ['chat', 'Chat', 61],
            ['economy', 'Economy', 47], ['world', 'World mgmt', 58], ['protection', 'Protection', 42],
            ['fun', 'Fun & games', 73], ['dev', 'Developer', 38],
        ],
        sources: [['modrinth', 'Modrinth', 182], ['hangar', 'Hangar', 147], ['spigot', 'SpigotMC', 153]],
        items: [
            { name: 'EssentialsX', author: 'EssentialsX Team', desc: 'The essential plugin suite for Minecraft servers, including over 130 commands and countless features.', icon: 'EX', dl: '12.4M', v: '2.20.1', mc: '1.21', tags: ['featured', 'compat', 'admin'], sourceLogo: 'M' },
            { name: 'LuckPerms', author: 'lucko', desc: 'A permissions plugin for Minecraft servers. Fast, reliable, and feature-rich.', icon: 'LP', dl: '8.1M', v: '5.4.140', mc: '1.21', tags: ['compat', 'admin'], sourceLogo: 'M' },
            { name: 'WorldEdit', author: 'EngineHub', desc: 'WorldEdit is an in-game map editor for Minecraft.', icon: 'WE', dl: '6.7M', v: '7.3.5', mc: '1.21', tags: ['compat', 'world'], sourceLogo: 'H' },
            { name: 'Vault', author: 'MilkBowl', desc: 'Vault is a Permissions, Chat, & Economy API.', icon: 'VA', dl: '4.9M', v: '1.7.3', mc: '1.21', tags: ['compat', 'dev'], sourceLogo: 'S' },
            { name: 'PlaceholderAPI', author: 'PlaceholderAPI', desc: 'Allows server administrators to use placeholders in plugins.', icon: 'PA', dl: '5.2M', v: '2.11.6', mc: '1.21', tags: ['compat', 'dev'], sourceLogo: 'M' },
            { name: 'Chunky', author: 'pop4959', desc: 'Pre-generates chunks, quickly, efficiently, and safely.', icon: 'CH', dl: '2.1M', v: '1.4.16', mc: '1.21', tags: ['featured', 'compat', 'world'], sourceLogo: 'M' },
            { name: 'Citizens', author: 'fullwall', desc: 'Powerful, modern NPC plugin with hundreds of features.', icon: 'CT', dl: '3.4M', v: '2.0.36', mc: '1.21', tags: ['compat', 'fun'], sourceLogo: 'S' },
            { name: 'GriefDefender', author: 'bloodmc', desc: 'Land claim & protection with extensive flag system.', icon: 'GD', dl: '1.2M', v: '2.4.6', mc: '1.21', tags: ['compat', 'protection'], sourceLogo: 'S' },
            { name: 'Dynmap', author: 'webbukkit', desc: 'Pan/zoom Google Maps-like view of your server, in real time.', icon: 'DM', dl: '3.8M', v: '3.7-beta-9', mc: '1.21', tags: ['compat', 'world'], sourceLogo: 'S' },
        ],
    },
    mods: {
        categories: [
            ['all', 'All', 2104], ['tech', 'Tech', 340], ['magic', 'Magic', 182],
            ['adventure', 'Adventure', 287], ['world', 'Worldgen', 214], ['qol', 'QoL', 612],
            ['perf', 'Performance', 94],
        ],
        sources: [['modrinth', 'Modrinth', 1640], ['curseforge', 'CurseForge', 1872]],
        items: [
            { name: 'Sodium', author: 'JellySquid', desc: 'A modern rendering engine for Minecraft which improves frame rates and reduces micro-stutter.', icon: 'SO', dl: '94M', v: '0.6.13', mc: '1.21', tags: ['featured', 'compat', 'perf'], sourceLogo: 'M', loader: 'fabric' },
            { name: 'Lithium', author: 'JellySquid', desc: 'No-compromises game logic & server optimization mod.', icon: 'LI', dl: '62M', v: '0.13.4', mc: '1.21', tags: ['compat', 'perf'], sourceLogo: 'M', loader: 'fabric' },
            { name: 'Create', author: 'simibubi', desc: 'Building Tools and Aesthetic Technology — kinetic contraptions galore.', icon: 'CR', dl: '82M', v: '6.0.4', mc: '1.21', tags: ['featured', 'compat', 'tech'], sourceLogo: 'C', loader: 'forge' },
            { name: 'Iris Shaders', author: 'coderbot', desc: 'A modern shader pack loader for Minecraft Java Edition.', icon: 'IR', dl: '44M', v: '1.8.1', mc: '1.21', tags: ['compat', 'perf'], sourceLogo: 'M', loader: 'fabric' },
            { name: 'Botania', author: 'Vazkii', desc: 'Tech mod themed around natural magic.', icon: 'BO', dl: '31M', v: '1.21-450', mc: '1.21', tags: ['compat', 'magic'], sourceLogo: 'C', loader: 'forge' },
            { name: 'JEI', author: 'mezz', desc: 'Just Enough Items — item & recipe viewing mod for Minecraft.', icon: 'JE', dl: '412M', v: '19.21.0', mc: '1.21', tags: ['compat', 'qol'], sourceLogo: 'C', loader: 'forge' },
        ],
    },
    modpacks: {
        categories: [
            ['all', 'All', 214], ['tech', 'Tech', 58], ['magic', 'Magic', 24],
            ['adventure', 'Adventure', 47], ['kitchen', 'Kitchen sink', 36], ['light', 'Lightweight', 18],
        ],
        sources: [['modrinth', 'Modrinth', 98], ['curseforge', 'CurseForge', 214]],
        items: [
            { name: 'All The Mods 9', author: 'ATMTeam', desc: 'Kitchen-sink modpack with over 400 mods. Tech, magic, exploration — everything.', icon: 'A9', dl: '8.4M', v: '0.3.10', mc: '1.20.1', tags: ['featured', 'kitchen'], sourceLogo: 'C', count: '412 mods' },
            { name: 'Better MC', author: 'Lunar Studio', desc: 'An adventure-focused enhancement modpack with quests, new biomes, and progression.', icon: 'BM', dl: '6.2M', v: 'v32', mc: '1.20.1', tags: ['featured', 'adventure'], sourceLogo: 'C', count: '286 mods' },
            { name: 'Create: Above and Beyond', author: 'simibubi', desc: 'A Create-focused modpack with custom progression and an end-game goal.', icon: 'CA', dl: '3.1M', v: '1.5', mc: '1.16.5', tags: ['tech'], sourceLogo: 'C', count: '94 mods' },
            { name: 'Prominence II RPG', author: 'ChoiceTheorem', desc: 'Adventure RPG modpack with classes, quests, and dungeons.', icon: 'PR', dl: '2.4M', v: '3.1.30', mc: '1.20.1', tags: ['adventure'], sourceLogo: 'M', count: '168 mods' },
            { name: 'Vault Hunters 3rd Edition', author: 'Iskall85', desc: 'Compete in procedurally-generated vault dungeons. Roguelike progression.', icon: 'VH', dl: '5.7M', v: 'Update 13', mc: '1.18.2', tags: ['featured', 'adventure'], sourceLogo: 'C', count: '210 mods' },
            { name: 'RLCraft', author: 'Shivaxi', desc: 'Brutally hard survival modpack. You will die.', icon: 'RL', dl: '12.1M', v: '2.9.4', mc: '1.12.2', tags: ['adventure'], sourceLogo: 'C', count: '148 mods' },
        ],
    },
};

const SOURCE_BG: Record<string, string> = {
    modrinth: '#1bd96a', curseforge: '#f16436', hangar: '#005c9c', spigot: '#ee8a18',
    M: '#1bd96a', C: '#f16436', H: '#005c9c', S: '#ee8a18',
};
const SOURCE_FULL: Record<string, string> = {
    M: 'Modrinth', C: 'CurseForge', H: 'Hangar', S: 'SpigotMC',
};
const TAB_LOADERS: Record<Tab, Array<[string, string]>> = {
    plugins: [['paper', 'Paper'], ['spigot', 'Spigot'], ['bukkit', 'Bukkit']],
    mods: [['fabric', 'Fabric'], ['forge', 'Forge'], ['neoforge', 'NeoForge'], ['quilt', 'Quilt']],
    modpacks: [['forge', 'Forge'], ['fabric', 'Fabric'], ['neoforge', 'NeoForge']],
};

const ICON_GRADIENT = (i: number): string =>
    i % 3 === 0 ? 'linear-gradient(135deg, #4c1d95, #1e3a8a)'
    : i % 3 === 1 ? 'linear-gradient(135deg, #831843, #4c1d95)'
    : 'linear-gradient(135deg, #0e7490, #1e3a8a)';

export const InstallerPage = () => {
    const [tab, setTab] = useState<Tab>('plugins');
    const [selected, setSelected] = useState(0);
    const [category, setCategory] = useState('all');
    const [installing, setInstalling] = useState<string | null>(null);

    const cur = CATALOG[tab];
    const items = cur.items;
    const sel = items[selected % items.length];

    const handleInstall = (item: Item) => {
        setInstalling(item.name);
        setTimeout(() => setInstalling(null), 2400);
    };

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Install content</div>
                    <div className={'page-sub'}>Browse plugins, mods, and modpacks from trusted registries — auto-configured for your server.</div>
                </div>
                <div className={'spacer'} />
                <div className={'seg'}>
                    {([['plugins', 'Plugins', 'sparkles'], ['mods', 'Mods', 'wand'], ['modpacks', 'Modpacks', 'archive']] as const).map(([id, lbl, ic]) => (
                        <button
                            key={id}
                            className={`seg-btn ${tab === id ? 'active' : ''}`}
                            onClick={() => { setTab(id); setSelected(0); setCategory('all'); }}
                        >
                            <Icon name={ic} size={13} />{lbl}
                            <span className={'count'}>{CATALOG[id].items.length}</span>
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'modpacks' ? (
                <div className={'notice warn'}>
                    <Icon name={'zap'} size={14} />
                    <span>
                        Installing a modpack <strong style={{ color: 'white', margin: '0 4px' }}>replaces your server jar and world</strong>.
                        We&apos;ll back up your current state automatically before switching.
                    </span>
                </div>
            ) : (
                <div className={'notice purple'}>
                    <Icon name={'sparkles'} size={14} />
                    <span>
                        gynx ai will check compatibility with your server (
                        <span style={{ color: 'white', fontFamily: "'JetBrains Mono',monospace" }}>paper 1.21</span>
                        ) and configure each install for you.
                    </span>
                </div>
            )}

            <div className={'row gap-8'} style={{ gap: 10 }}>
                <div className={'search-lg'}>
                    <Icon name={'search'} size={15} />
                    <input placeholder={`Search ${tab}…`} defaultValue={''} />
                    <span
                        className={'kbd'}
                        style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 4,
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line-2)',
                            fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-faint)',
                        }}
                    >/</span>
                </div>
                <div className={'row gap-6'} style={{ gap: 6 }}>
                    {['Featured', 'Most downloaded', 'Recently updated', 'A → Z'].map((s, i) => (
                        <span key={i} className={`chip ${i === 0 ? 'active' : ''}`}>{s}</span>
                    ))}
                </div>
            </div>

            <div className={'install-layout'}>
                <div className={'install-side'}>
                    <div className={'side-section'}>
                        <div className={'side-label'}>Category</div>
                        {cur.categories.map(([id, lbl, ct]) => (
                            <div
                                key={id}
                                className={`side-item ${category === id ? 'active' : ''}`}
                                onClick={() => setCategory(id)}
                            >
                                <span style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: category === id ? 'var(--purple)' : 'rgba(255,255,255,0.15)',
                                }} />
                                {lbl}
                                <span className={'ct'}>{ct}</span>
                            </div>
                        ))}
                    </div>
                    <div className={'side-section'} style={{ marginTop: 8 }}>
                        <div className={'side-label'}>Source</div>
                        {cur.sources.map(([id, lbl, ct]) => (
                            <div key={id} className={'side-item'}>
                                <span style={{
                                    width: 18, height: 18, borderRadius: 4,
                                    background: SOURCE_BG[id] || '#888',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, fontWeight: 700, color: '#0b0b0f',
                                    fontFamily: "'Space Grotesk',sans-serif",
                                }}>{lbl[0]}</span>
                                {lbl}
                                <span className={'ct'}>{ct}</span>
                            </div>
                        ))}
                    </div>
                    <div className={'side-section'} style={{ marginTop: 8 }}>
                        <div className={'side-label'}>Loader</div>
                        {TAB_LOADERS[tab].map(([id, lbl]) => (
                            <div key={id} className={'side-item'}>
                                <span style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.15)',
                                }} />
                                {lbl}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={'item-grid'}>
                    {items.map((it, i) => (
                        <div
                            key={i}
                            className={`item-card ${i === selected ? 'selected' : ''}`}
                            onClick={() => setSelected(i)}
                        >
                            <div className={'item-head'}>
                                <div className={'item-icon'} style={{ background: ICON_GRADIENT(i) }}>{it.icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className={'item-name'}>{it.name}</div>
                                    <div className={'item-author'}>by {it.author}</div>
                                </div>
                                <span
                                    title={SOURCE_FULL[it.sourceLogo]}
                                    style={{
                                        width: 22, height: 22, borderRadius: 4,
                                        background: SOURCE_BG[it.sourceLogo],
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 10, fontWeight: 700, color: '#0b0b0f',
                                        fontFamily: "'Space Grotesk',sans-serif",
                                        flexShrink: 0,
                                    }}
                                >{it.sourceLogo}</span>
                            </div>
                            <div className={'item-desc'}>{it.desc}</div>
                            <div className={'item-tags'}>
                                {it.tags.includes('featured') && <span className={'tag featured'}>★ featured</span>}
                                {it.tags.includes('compat') && <span className={'tag compat'}>✓ {it.mc}</span>}
                                {it.loader && <span className={'tag'}>{it.loader}</span>}
                                {it.count && <span className={'tag'}>{it.count}</span>}
                            </div>
                            <div className={'item-meta'}>
                                <span className={'m'}><Icon name={'download'} size={11} />{it.dl}</span>
                                <span className={'m'}><Icon name={'clock'} size={11} />{it.v}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className={'detail-panel'}>
                    <div className={'detail-hero'}>
                        <div className={'row gap-8'} style={{ alignItems: 'flex-start', gap: 10 }}>
                            <div
                                className={'item-icon'}
                                style={{ width: 56, height: 56, fontSize: 22, background: 'linear-gradient(135deg, #7c3aed, #22d3ee)' }}
                            >{sel.icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className={'item-name'} style={{ fontSize: 17 }}>{sel.name}</div>
                                <div className={'item-author'}>by {sel.author}</div>
                                <div className={'row gap-6'} style={{ marginTop: 8, gap: 6 }}>
                                    {sel.tags.includes('featured') && <span className={'tag featured'}>★ featured</span>}
                                    {sel.tags.includes('compat') && <span className={'tag compat'}>✓ compatible</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={'detail-body'}>
                        <h4>About</h4>
                        <p>
                            {sel.desc}{' '}
                            {tab === 'modpacks'
                                ? 'Selecting this modpack will provision a new world and switch your server software.'
                                : 'This package will be added to your /plugins directory and loaded on next restart.'}
                        </p>
                        <h4>Details</h4>
                        <ul>
                            <li><span className={'k'}>Latest version</span><span className={'v'}>{sel.v}</span></li>
                            <li><span className={'k'}>Minecraft</span><span className={'v'}>{sel.mc}</span></li>
                            <li><span className={'k'}>Downloads</span><span className={'v'}>{sel.dl}</span></li>
                            {sel.loader && <li><span className={'k'}>Loader</span><span className={'v'}>{sel.loader}</span></li>}
                            {sel.count && <li><span className={'k'}>Includes</span><span className={'v'}>{sel.count}</span></li>}
                            <li><span className={'k'}>License</span><span className={'v'}>MIT</span></li>
                        </ul>
                        {tab === 'plugins' && (
                            <>
                                <h4>Dependencies</h4>
                                <ul>
                                    <li>
                                        <span className={'k'}>
                                            Vault <span style={{ color: 'var(--green)' }}>· already installed</span>
                                        </span>
                                        <span className={'v'}>≥ 1.7</span>
                                    </li>
                                </ul>
                            </>
                        )}
                        <h4>Permissions</h4>
                        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5 }}>
                            essentials.* · essentials.list · essentials.tpa · essentials.home · …
                        </p>
                    </div>
                    <div className={'detail-foot'}>
                        {installing === sel.name ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div className={'row gap-8'} style={{ fontSize: 12 }}>
                                    <Icon name={'sparkles'} size={12} color={'var(--purple)'} />
                                    <span style={{ color: 'var(--text)' }}>Installing… resolving dependencies</span>
                                    <div className={'spacer'} />
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-faint)' }}>62%</span>
                                </div>
                                <div className={'progress'}><div style={{ width: '62%' }} /></div>
                            </div>
                        ) : (
                            <>
                                <button className={'btn btn-primary'} style={{ flex: 1 }} onClick={() => handleInstall(sel)}>
                                    <Icon name={'download'} size={13} />
                                    Install {tab === 'modpacks' ? 'modpack' : tab.slice(0, -1)}
                                </button>
                                <button className={'btn'}><Icon name={'settings'} size={13} /></button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstallerPage;
