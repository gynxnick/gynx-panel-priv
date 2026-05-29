export type ConfigFormat = 'yaml' | 'json' | 'properties' | 'toml' | 'ini' | 'xml' | 'plain';

export interface ConfigEntry {
    /** Absolute path on the server filesystem, rooted at /. */
    path: string;
    /** Shown in the left rail. */
    label: string;
    /** One-liner about what the file controls. */
    description: string;
    /** Used to pick validator + CodeMirror mode. */
    format: ConfigFormat;
    /** CodeMirror MIME for syntax highlighting. */
    mime: string;
    /** Grouping header in the rail. */
    group: 'core' | 'platform' | 'access' | 'other';
}

/** CodeMirror MIME for each format (all modes are bundled in CodemirrorEditor). */
export const MIME_FOR_FORMAT: Record<ConfigFormat, string> = {
    yaml: 'text/x-yaml',
    json: 'application/json',
    properties: 'text/x-properties',
    toml: 'text/x-toml',
    ini: 'text/x-properties', // ini ≈ properties; the properties mode highlights it well
    xml: 'application/xml',
    plain: 'text/plain',
};

/**
 * Curated catalog of config files we know how to highlight + validate,
 * across the games this panel hosts. Not every server has every file —
 * the UI only surfaces ones that exist on disk, so a Rust box never sees
 * Minecraft entries and vice-versa. Anything not listed here can still be
 * opened by path (see the editor's "open file" box).
 *
 * Paths are kept shallow/fixed where possible to keep the on-open
 * directory probe cheap; games with per-server variable paths (Rust
 * identity dirs, Project Zomboid server name, plugin configs) are handled
 * by open-by-path instead of guessed here.
 */
export const KNOWN_CONFIGS: ConfigEntry[] = [
    // ---- Minecraft: core ----
    { path: '/server.properties', label: 'server.properties', description: 'Core Minecraft server settings', format: 'properties', mime: 'text/x-properties', group: 'core' },
    { path: '/eula.txt',          label: 'eula.txt',          description: 'Mojang EULA acknowledgement',      format: 'properties', mime: 'text/x-properties', group: 'core' },

    // ---- Minecraft: platform ----
    { path: '/bukkit.yml',               label: 'bukkit.yml',               description: 'Bukkit legacy settings (Spigot / Paper)', format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/spigot.yml',               label: 'spigot.yml',               description: 'Spigot-specific tuning',                  format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/paper-global.yml',         label: 'paper-global.yml',         description: 'Paper global settings (1.19+)',           format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/paper-world-defaults.yml', label: 'paper-world-defaults.yml', description: 'Paper world defaults (1.19+)',            format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/config/paper-global.yml',  label: 'config/paper-global.yml',  description: 'Paper global (newer layout)',             format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/pufferfish.yml',           label: 'pufferfish.yml',           description: 'Pufferfish performance tuning',           format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/purpur.yml',               label: 'purpur.yml',               description: 'Purpur gameplay tweaks',                  format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/velocity.toml',            label: 'velocity.toml',            description: 'Velocity proxy config',                   format: 'toml', mime: 'text/x-toml', group: 'platform' },
    { path: '/config.yml',               label: 'config.yml',               description: 'BungeeCord / Waterfall proxy config',     format: 'yaml', mime: 'text/x-yaml', group: 'platform' },

    // ---- Minecraft: access control ----
    { path: '/ops.json',            label: 'ops.json',            description: 'Server operators',  format: 'json', mime: 'application/json', group: 'access' },
    { path: '/whitelist.json',      label: 'whitelist.json',      description: 'Whitelisted players', format: 'json', mime: 'application/json', group: 'access' },
    { path: '/banned-players.json', label: 'banned-players.json', description: 'Banned players',     format: 'json', mime: 'application/json', group: 'access' },
    { path: '/banned-ips.json',     label: 'banned-ips.json',     description: 'Banned IPs',         format: 'json', mime: 'application/json', group: 'access' },

    // ---- Other games: core ----
    { path: '/serverconfig.xml', label: 'serverconfig.xml', description: '7 Days to Die server config',            format: 'xml',        mime: 'application/xml',   group: 'core' },
    { path: '/serverconfig.txt', label: 'serverconfig.txt', description: 'Terraria (vanilla) server config',       format: 'properties', mime: 'text/x-properties', group: 'core' },
    { path: '/server.cfg',       label: 'server.cfg',       description: 'Source / CS2 / GMod / FiveM server cfg', format: 'plain',      mime: 'text/plain',        group: 'core' },
    { path: '/config/server-settings.json', label: 'server-settings.json', description: 'Factorio server settings', format: 'json',     mime: 'application/json',  group: 'core' },

    // ARK: Survival Evolved (Pterodactyl Linux layout)
    { path: '/ShooterGame/Saved/Config/LinuxServer/GameUserSettings.ini', label: 'GameUserSettings.ini', description: 'ARK main server settings',        format: 'ini', mime: 'text/x-properties', group: 'core' },
    { path: '/ShooterGame/Saved/Config/LinuxServer/Game.ini',             label: 'Game.ini',             description: 'ARK advanced rates / overrides', format: 'ini', mime: 'text/x-properties', group: 'other' },

    // Palworld
    { path: '/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini', label: 'PalWorldSettings.ini', description: 'Palworld world / gameplay settings', format: 'ini', mime: 'text/x-properties', group: 'core' },

    // ---- Other games: extras ----
    { path: '/tshock/config.json', label: 'tshock/config.json', description: 'TShock (Terraria) server config', format: 'json', mime: 'application/json', group: 'other' },
];

export const GROUP_ORDER: ConfigEntry['group'][] = ['core', 'platform', 'access', 'other'];

export const GROUP_LABELS: Record<ConfigEntry['group'], string> = {
    core: 'core',
    platform: 'platform',
    access: 'access control',
    other: 'other',
};

/** Map a filename/extension to the best-fit format for highlighting + validation. */
export const formatForPath = (path: string): ConfigFormat => {
    const name = path.split('/').pop()?.toLowerCase() ?? '';
    const ext = name.includes('.') ? name.substring(name.lastIndexOf('.') + 1) : '';
    switch (ext) {
        case 'yml':
        case 'yaml':
            return 'yaml';
        case 'json':
            return 'json';
        case 'toml':
            return 'toml';
        case 'xml':
            return 'xml';
        case 'ini':
            return 'ini';
        case 'properties':
            return 'properties';
        case 'cfg':
        case 'conf':
            return 'ini';
        case 'txt':
        case 'cnf':
            return 'properties';
        default:
            return 'plain';
    }
};

/**
 * Build an ad-hoc ConfigEntry for an arbitrary path the user opened that
 * isn't in the curated catalog — powers the "open any file" escape hatch
 * so the editor works on literally any server.
 */
export const adHocEntry = (path: string): ConfigEntry => {
    const clean = path.startsWith('/') ? path : `/${path}`;
    const format = formatForPath(clean);
    return {
        path: clean,
        label: clean.split('/').pop() || clean,
        description: 'Opened by path',
        format,
        mime: MIME_FOR_FORMAT[format],
        group: 'other',
    };
};
