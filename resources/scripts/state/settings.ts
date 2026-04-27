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
