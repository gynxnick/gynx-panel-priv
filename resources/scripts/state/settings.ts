import { action, Action } from 'easy-peasy';

/**
 * Editable branding / panel text. All fields are optional on the wire
 * (admin may not have opened Branding yet), and the helpers below fall
 * back to a default string in one place. Every consumer should go
 * through `brand()` instead of reading these raw.
 */
export interface BrandingSettings {
    siteName?: string;
    tagline?: string;
    logoUrl?: string;
    authLede?: string;
    authTaglines?: string[];
    footerCopy?: string;
    dashboardEmptyTitle?: string;
    dashboardEmptyBody?: string;
    modpackInstallWarning?: string;
}

export type LicenseStatus = 'valid' | 'invalid' | 'unreachable' | 'unlicensed';

export interface LicenseSnapshot {
    status: LicenseStatus;
    plan?: string | null;
    expiresAt?: string | null;
    message?: string | null;
    reason?: string | null;
}

/**
 * Editable Discord copy. Mirrors backend DiscordTextController::KEYS.
 * Webhook URL is intentionally NOT exposed — only a boolean flag — so
 * the credential never reaches the browser.
 */
export interface DiscordSettings {
    ctaEnabled?: boolean;
    ctaTitle?: string;
    ctaSubtitle?: string;
    ctaButtonLabel?: string;
    inviteUrl?: string;
    webhookConfigured?: boolean;
    noticeTemplate?: string;
}

export interface SiteSettings {
    name: string;
    locale: string;
    recaptcha: {
        enabled: boolean;
        siteKey: string;
    };
    /** Legacy top-level logo URL — still honored if present for back-compat. */
    logoUrl?: string;
    /** Editable panel text / branding (admin-configured). */
    branding?: BrandingSettings;
    /** Editable Discord copy (admin-configured). */
    discord?: DiscordSettings;
    /** Cached gynx.gg license check result — drives the lockdown banner. */
    license?: LicenseSnapshot;
}

export interface SettingsStore {
    data?: SiteSettings;
    setSettings: Action<SettingsStore, SiteSettings>;
}

const settings: SettingsStore = {
    data: undefined,

    setSettings: action((state, payload) => {
        state.data = payload;
    }),
};

export default settings;

/** Defaults used when the admin hasn't overridden a branding field. */
const DEFAULTS: Required<BrandingSettings> = {
    siteName: 'gynx.gg',
    tagline: 'host smarter. play harder.',
    logoUrl: '',
    authLede: 'manage your game servers with speed and control.',
    authTaglines: [
        'host smarter. play harder.',
        'your server, fully unleashed.',
        'performance without compromise.',
        'where your world runs better.',
        'powering your worlds — instantly, reliably.',
    ],
    footerCopy: '',
    dashboardEmptyTitle: 'No servers yet',
    dashboardEmptyBody: 'Ask your admin for a deployment, or contact support.',
    modpackInstallWarning:
        'Install runs the full pipeline: download → extract → mod fan-out. The .mrpack lands in /modpacks/, ' +
        'server-side mods go to /mods/, and overrides/ contents lift into the server root. Stop the server ' +
        'and back up your world / configs first — extract WILL overwrite matching files.',
};

export const brand = (s?: SiteSettings) => {
    const b = s?.branding ?? {};
    return {
        siteName: b.siteName || DEFAULTS.siteName,
        tagline: b.tagline || DEFAULTS.tagline,
        logoUrl: b.logoUrl || s?.logoUrl || DEFAULTS.logoUrl,
        authLede: b.authLede || DEFAULTS.authLede,
        authTaglines: (b.authTaglines && b.authTaglines.length > 0) ? b.authTaglines : DEFAULTS.authTaglines,
        footerCopy: b.footerCopy || DEFAULTS.footerCopy,
        dashboardEmptyTitle: b.dashboardEmptyTitle || DEFAULTS.dashboardEmptyTitle,
        dashboardEmptyBody: b.dashboardEmptyBody || DEFAULTS.dashboardEmptyBody,
        modpackInstallWarning: b.modpackInstallWarning || DEFAULTS.modpackInstallWarning,
    };
};

/** Discord-text defaults — match DiscordTextController::KEYS server-side. */
const DISCORD_DEFAULTS: Required<Omit<DiscordSettings, 'noticeTemplate' | 'webhookConfigured'>> & {
    noticeTemplate: string;
    webhookConfigured: boolean;
} = {
    ctaEnabled: true,
    ctaTitle: 'Join the gynx Discord',
    ctaSubtitle: 'Live support, mod recommendations, and the place we drop status updates first.',
    ctaButtonLabel: 'Join',
    inviteUrl: 'https://discord.gg/gynx',
    webhookConfigured: false,
    noticeTemplate: '',
};

/**
 * Resolve Discord text with admin-set overrides layered on top of the
 * built-in defaults. Mirrors brand(): one place to read so every
 * consumer falls back uniformly when the admin hasn't customized.
 */
export const disc = (s?: SiteSettings) => {
    const d = s?.discord ?? {};
    return {
        ctaEnabled: d.ctaEnabled ?? DISCORD_DEFAULTS.ctaEnabled,
        ctaTitle: d.ctaTitle || DISCORD_DEFAULTS.ctaTitle,
        ctaSubtitle: d.ctaSubtitle || DISCORD_DEFAULTS.ctaSubtitle,
        ctaButtonLabel: d.ctaButtonLabel || DISCORD_DEFAULTS.ctaButtonLabel,
        inviteUrl: d.inviteUrl || DISCORD_DEFAULTS.inviteUrl,
        webhookConfigured: d.webhookConfigured ?? DISCORD_DEFAULTS.webhookConfigured,
        noticeTemplate: d.noticeTemplate || DISCORD_DEFAULTS.noticeTemplate,
    };
};
