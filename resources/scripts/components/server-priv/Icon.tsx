import * as React from 'react';

/**
 * Hand-rolled lucide-style icons used by the new gynx server panel. Single
 * component instead of pulling another icon library — wireframe is opinionated
 * about line weight (1.75) and the tiny set we actually need.
 */
export type IconName =
    | 'console' | 'folder' | 'db' | 'clock' | 'users' | 'archive' | 'globe'
    | 'play' | 'settings' | 'pause' | 'restart' | 'zap' | 'search' | 'bell'
    | 'expand' | 'filter' | 'copy' | 'trash' | 'chevron-down' | 'chevron-right'
    | 'plus' | 'send' | 'wand' | 'sparkles' | 'broadcast' | 'save' | 'download'
    | 'skull' | 'trend-down' | 'user-x' | 'gavel' | 'crown' | 'shield' | 'refresh'
    | 'check' | 'gamepad';

interface Props {
    name: IconName;
    size?: number;
    color?: string;
    style?: React.CSSProperties;
    className?: string;
}

export const Icon = ({ name, size = 16, color = 'currentColor', style, className }: Props) => {
    const props = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: color,
        strokeWidth: 1.75,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        style,
        className,
    };
    switch (name) {
        case 'console':       return <svg {...props}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>;
        case 'folder':        return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>;
        case 'db':            return <svg {...props}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>;
        case 'clock':         return <svg {...props}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
        case 'users':         return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
        case 'archive':       return <svg {...props}><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><line x1="10" y1="13" x2="14" y2="13"/></svg>;
        case 'globe':         return <svg {...props}><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
        case 'play':          return <svg {...props}><polygon points="6 4 20 12 6 20 6 4"/></svg>;
        case 'settings':      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.71.4 1 .68"/></svg>;
        case 'pause':         return <svg {...props}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
        case 'restart':       return <svg {...props}><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/></svg>;
        case 'zap':           return <svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
        case 'search':        return <svg {...props}><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>;
        case 'bell':          return <svg {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>;
        case 'expand':        return <svg {...props}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
        case 'filter':        return <svg {...props}><polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/></svg>;
        case 'copy':          return <svg {...props}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
        case 'trash':         return <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>;
        case 'chevron-down':  return <svg {...props}><polyline points="6 9 12 15 18 9"/></svg>;
        case 'chevron-right': return <svg {...props}><polyline points="9 6 15 12 9 18"/></svg>;
        case 'plus':          return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
        case 'send':          return <svg {...props}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
        case 'wand':          return <svg {...props}><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h0M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/></svg>;
        case 'sparkles':      return <svg {...props}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 15l.8 2.4L22 18l-2.2.6L19 21l-.8-2.4L16 18l2.2-.6L19 15z"/></svg>;
        case 'broadcast':     return <svg {...props}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
        case 'save':          return <svg {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
        case 'download':      return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
        case 'skull':         return <svg {...props}><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><path d="M8 20v-2H6a2 2 0 0 1-2-2v-4a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2v2"/><path d="M10 20h4"/></svg>;
        case 'trend-down':    return <svg {...props}><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>;
        case 'user-x':        return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>;
        case 'gavel':         return <svg {...props}><path d="M14 13l-7.5 7.5a2.121 2.121 0 0 1-3-3L11 10"/><path d="M16 16l6-6"/><path d="M8 8l6-6"/><path d="M9 7l8 8"/><path d="M21 11l-8-8"/></svg>;
        case 'crown':         return <svg {...props}><path d="M2 17l4-10 6 7 6-7 4 10z"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
        case 'shield':        return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
        case 'refresh':       return <svg {...props}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
        case 'check':         return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
        case 'gamepad':       return <svg {...props}><line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>;
        default:              return null;
    }
};
