/**
 * Heuristics for figuring out which install pages an egg supports.
 *
 * Pterodactyl doesn't surface "is this a Paper-style server" as first-class
 * metadata, but the egg's startup invocation almost always names the launcher
 * jar — that's enough to tell apart Bukkit-family (plugins) from mod-loader
 * family (mods/modpacks). Anything that doesn't match is treated as
 * unsupported and the related nav link is hidden.
 *
 * Hybrid platforms (Mohist / Arclight / Magma) run a Forge mod loader AND
 * accept Bukkit plugins, so they enable both sides.
 */

interface ServerLike {
    invocation?: string;
    dockerImage?: string;
}

export interface AddonCapabilities {
    plugins: boolean;
    mods: boolean;
    modpacks: boolean;
}

const PLUGIN_PATTERNS: RegExp[] = [
    /paper(?:[-_]\d|\.jar)/i,
    /spigot(?:[-_]\d|\.jar)/i,
    /craftbukkit(?:[-_]\d|\.jar)/i,
    /purpur(?:[-_]\d|\.jar)/i,
    /folia(?:[-_]\d|\.jar)/i,
    /pufferfish(?:[-_]\d|\.jar)/i,
];

const MOD_PATTERNS: RegExp[] = [
    /forge(?:[-_]\d|\.jar)/i,
    /\bfabric[-_]server[-_]launch/i,
    /\bquilt[-_]server[-_]launch/i,
    /neoforge/i,
    /unix_args\.txt/i,            // Forge >= 1.17 launcher arg file
    /@user_jvm_args/,             // The same Forge launcher pattern in invocation
    /libraries\/net\/minecraftforge/i,
];

const HYBRID_PATTERNS: RegExp[] = [
    /mohist(?:[-_]\d|\.jar)/i,
    /arclight(?:[-_]\d|\.jar)/i,
    /magma(?:[-_]\d|\.jar)/i,
    /catserver/i,
];

// Coarse signal that this is plausibly a Java-based Minecraft server even
// if we can't pin down the exact platform. Pterodactyl's default Paper egg
// uses SERVER_JARFILE=server.jar, so the specific PLUGIN_PATTERNS above
// don't match — fall back to this so we don't accidentally hide the
// install pages on a real MC server.
const JAVA_MC_PATTERNS: RegExp[] = [
    /\byolks?\b/i,            // Pterodactyl's standard Java image set
    /\bjava[-_]?\d/i,         // ghcr.io/.../yolks:java_17, java_21, etc.
    /minecraft/i,             // any image / invocation mentioning minecraft
    /server\.jar/i,           // common default jarfile name
];

export function getAddonCapabilities(server: ServerLike | null | undefined): AddonCapabilities {
    if (!server) return { plugins: false, mods: false, modpacks: false };

    const haystack = `${server.invocation ?? ''} ${server.dockerImage ?? ''}`;

    const isHybrid = HYBRID_PATTERNS.some((re) => re.test(haystack));
    const isPluginExact = PLUGIN_PATTERNS.some((re) => re.test(haystack));
    const isModExact = MOD_PATTERNS.some((re) => re.test(haystack));

    // If we can't identify a specific platform but it looks like a Java
    // Minecraft server, show all three addon pages. Better to show too
    // many than to hide a legit installer because the egg's SERVER_JARFILE
    // happens to be "server.jar".
    const looksJavaMc = JAVA_MC_PATTERNS.some((re) => re.test(haystack));
    const fallbackAll = looksJavaMc && !isPluginExact && !isModExact && !isHybrid;

    return {
        plugins: isHybrid || isPluginExact || fallbackAll,
        // Modpacks live in the same modded ecosystem as mods.
        mods: isHybrid || isModExact || fallbackAll,
        modpacks: isHybrid || isModExact || fallbackAll,
    };
}
