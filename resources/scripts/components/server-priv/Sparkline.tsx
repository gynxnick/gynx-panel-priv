import * as React from 'react';

interface Props {
    points: number[];
    color?: string;
    fill?: boolean;
    glow?: boolean;
}

/**
 * Tiny sparkline used inside StatCard. Translated from the wireframe Spark
 * component — same SVG path math, drop-shadow filter for the accent glow.
 */
export const Sparkline = ({ points, color = '#7c3aed', fill = true, glow = false }: Props) => {
    const w = 100;
    const h = 40;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const step = w / (points.length - 1);
    const path = points
        .map((y, i) => {
            const py = h - ((y - min) / range) * (h - 6) - 3;
            return `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${py.toFixed(1)}`;
        })
        .join(' ');
    // useId() is React 18+ — priv's react types are still on 17, so generate
    // a stable per-instance id with useState's lazy initializer instead.
    const [id] = React.useState(() => Math.random().toString(36).slice(2, 10));
    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio={'none'}
            style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
        >
            {fill && (
                <>
                    <defs>
                        <linearGradient id={`fill-${id}`} x1={'0'} x2={'0'} y1={'0'} y2={'1'}>
                            <stop offset={'0%'} stopColor={color} stopOpacity={'0.35'} />
                            <stop offset={'100%'} stopColor={color} stopOpacity={'0'} />
                        </linearGradient>
                    </defs>
                    <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`url(#fill-${id})`} />
                </>
            )}
            <path
                d={path}
                stroke={color}
                strokeWidth={'1.6'}
                fill={'none'}
                strokeLinecap={'round'}
                strokeLinejoin={'round'}
                style={{ filter: glow ? `drop-shadow(0 0 4px ${color})` : 'none' }}
            />
        </svg>
    );
};
