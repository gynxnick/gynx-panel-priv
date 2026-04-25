import React from 'react';
import GynxLogo from '@/assets/brand/gynx-logo.png';

interface Props {
    /**
     * Maximum height in px. The image keeps its natural aspect ratio
     * (the bundled lockup is ~3:1) and scales down to fit narrower
     * containers. Default 36.
     */
    size?: number;
    /**
     * When true, the image stretches to fill its container's width
     * (clamped by `size` on height). Use this in flex/grid cells where
     * you want the logo to feel proportional to the slot.
     */
    fill?: boolean;
    className?: string;
    /**
     * Optional hosted logo URL — admin override from
     * state.settings.data.branding.logoUrl. Falls back to the bundled
     * gynx lockup if absent.
     */
    url?: string | null;
    alt?: string;
}

export default ({ size = 36, fill = false, className, url, alt = 'gynx.gg' }: Props) => {
    const src = url && url.trim() !== '' ? url : (GynxLogo as unknown as string);

    const style: React.CSSProperties = fill
        ? {
              display: 'block',
              width: '100%',
              maxHeight: size,
              height: 'auto',
              objectFit: 'contain',
          }
        : {
              display: 'block',
              maxHeight: size,
              maxWidth: '100%',
              objectFit: 'contain',
          };

    return <img src={src} alt={alt} className={className} style={style} />;
};
