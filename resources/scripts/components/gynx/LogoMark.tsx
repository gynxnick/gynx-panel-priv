import React from 'react';

// Bundled default logo. Webpack file-loader rewrites this to a hashed
// path under /assets/images/. When the admin sets Branding → Logo URL
// to a custom URL, that wins; otherwise this default ships.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DEFAULT_LOGO_URL: string = require('@/assets/brand/gynx-logo.png');

interface Props {
    size?: number;
    className?: string;
    /**
     * Optional hosted logo URL. When set, renders that image. Upstream
     * source is `state.settings.data.branding.logoUrl`, which is pushed
     * through window.SiteConfiguration from wrapper.blade.php. Fallback
     * is the bundled gynx logo below.
     */
    url?: string | null;
    alt?: string;
}

/**
 * gynx.gg wordmark / monogram. Admin-configurable URL overrides the
 * bundled default; everything else about placement + sizing stays the
 * same.
 */
export default ({ size = 36, className, url, alt = 'gynx.gg' }: Props) => {
    const src = url && url.trim() !== '' ? url : DEFAULT_LOGO_URL;

    return (
        <img
            src={src}
            alt={alt}
            height={size}
            className={className}
            style={{ display: 'block', objectFit: 'contain', maxHeight: size }}
        />
    );
};
