export type ConfigFormat = 'yaml' | 'json' | 'properties' | 'toml' | 'plain';

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

/**
 * Curated catalog of config files we know how to highlight + validate.
 * Not every server will have every file — the UI only surfaces ones
 * that exist on disk.
 */
export const KNOWN_CONFIGS: ConfigEntry[] = [
    // Core — everyone has these
    { path: '/server.properties', label: 'server.properties', description: 'Core Minecraft server settings', format: 'properties', mime: 'text/x-properties', group: 'core' },
    { path: '/eula.txt',          label: 'eula.txt',          description: 'Mojang EULA acknowledgement', format: 'properties', mime: 'text/x-properties', group: 'core' },

    // Platform-specific
    { path: '/bukkit.yml',                label: 'bukkit.yml',                description: 'Bukkit legacy settings (Spigot / Paper compatible)',   format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/spigot.yml',                label: 'spigot.yml',                description: 'Spigot-specific tuning',                                format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/paper-global.yml',          label: 'paper-global.yml',          description: 'Paper global settings (1.19+)',                          format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/paper-world-defaults.yml',  label: 'paper-world-defaults.yml',  description: 'Paper world defaults (1.19+)',                           format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/config/paper-global.yml',   label: 'config/paper-global.yml',   description: 'Paper global (newer layout)',                            format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/pufferfish.yml',            label: 'pufferfish.yml',            description: 'Pufferfish performance tuning',                          format: 'yaml', mime: 'text/x-yaml', group: 'platform' },
    { path: '/purpur.yml',                label: 'purpur.yml',                description: 'Purpur gameplay tweaks',                                 format: 'yaml', mime: 'text/x-yaml', group: 'platform' },

    // Proxy / network
    { path: '/velocity.toml',             label: 'velocity.toml',             description: 'Velocity proxy config',                                  format: 'toml', mime: 'text/x-toml', group: 'platform' },
    { path: '/config.yml',                label: 'config.yml',                description: 'BungeeCord / Waterfall proxy config',                    format: 'yaml', mime: 'text/x-yaml', group: 'platform' },

    // Access-control JSON
    { path: '/ops.json',                  label: 'ops.json',                  description: 'Server operators',                                       format: 'json', mime: 'application/json', group: 'access' },
    { path: '/whitelist.json',            label: 'whitelist.json',            description: 'Whitelisted players',                                    format: 'json', mime: 'application/json', group: 'access' },
    { path: '/banned-players.json',       label: 'banned-players.json',       description: 'Banned players',                                         format: 'json', mime: 'application/json', group: 'access' },
    { path: '/banned-ips.json',           label: 'banned-ips.json',           description: 'Banned IPs',                                             format: 'json', mime: 'application/json', group: 'access' },
];

export const GROUP_ORDER: ConfigEntry['group'][] = ['core', 'platform', 'access', 'other'];

export const GROUP_LABELS: Record<ConfigEntry['group'], string> = {
    core: 'core',
    platform: 'platform',
    access: 'access control',
    other: 'other',
};
