import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { hexToRgba } from '@/lib/helpers';
import { extent, linearScale, niceTicks, smoothPath } from './primitives';

const Container = styled.div`
    ${tw`relative w-full h-full`};
`;

const Svg = styled.svg`
    ${tw`block w-full h-full`};
    overflow: visible;
`;

const Tooltip = styled.div`
    position: absolute;
    pointer-events: none;
    background: rgba(11, 11, 15, 0.96);
    border: 1px solid rgba(124, 58, 237, 0.45);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    color: #e5e7eb;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    transform: translate(-50%, -100%);
    margin-top: -12px;
    white-space: nowrap;
    backdrop-filter: blur(8px);
    z-index: 50;
    line-height: 1.5;
`;

const TooltipRow = styled.div<{ $color: string }>`
    display: flex;
    align-items: center;
    gap: 6px;
    &::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${({ $color }) => $color};
    }
`;

type Formatter = (value: number) => string;

type Overlay = {
    data: number[];
    color: string;
    label: string;
    format?: Formatter;
};

export type LineChartProps = {
    data: number[];
    color: string;
    label: string;
    unit?: string;
    /** Explicit y-domain. If omitted, auto-fits with 10% padding. */
    domain?: [number, number];
    yFormat?: Formatter;
    /**
     * Optional second series. Rendered dashed. Gets its own y-scale so it
     * can be shown alongside a different-unit series (CPU + RAM).
     */
    compare?: Overlay;
};

const PAD = { top: 10, right: 12, bottom: 10, left: 48 };

let gradientCounter = 0;

export const LineChart: React.FC<LineChartProps> = ({
    data,
    color,
    label,
    unit = '',
    domain,
    yFormat,
    compare,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [hover, setHover] = useState<{ index: number } | null>(null);
    const gradientIdRef = useRef<string>();
    if (!gradientIdRef.current) gradientIdRef.current = `gynx-grad-${++gradientCounter}`;

    useEffect(() => {
        if (!containerRef.current) return;
        const obs = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setSize({ w: Math.floor(width), h: Math.floor(height) });
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const { w, h } = size;
    const innerW = Math.max(0, w - PAD.left - PAD.right);
    const innerH = Math.max(0, h - PAD.top - PAD.bottom);

    const [dMin, dMax] = useMemo<[number, number]>(() => {
        if (domain) return domain;
        const [lo, hi] = extent(data);
        const pad = (hi - lo) * 0.1 || 1;
        return [Math.max(0, lo - pad), hi + pad];
    }, [data, domain]);

    const xs = useMemo(
        () => linearScale([0, Math.max(data.length - 1, 1)], [PAD.left, PAD.left + innerW]),
        [data.length, innerW],
    );
    const ys = useMemo(
        () => linearScale([dMin, dMax], [PAD.top + innerH, PAD.top]),
        [dMin, dMax, innerH],
    );

    const mainPoints = useMemo<[number, number][]>(
        () => (innerW > 0 ? data.map((v, i) => [xs(i), ys(v)]) : []),
        [data, xs, ys, innerW],
    );

    // Compare gets its own y-scale so different-unit series can coexist.
    const compareYs = useMemo(() => {
        if (!compare) return null;
        const [lo, hi] = extent(compare.data);
        const pad = (hi - lo) * 0.1 || 1;
        return linearScale([Math.max(0, lo - pad), hi + pad], [PAD.top + innerH, PAD.top]);
    }, [compare, innerH]);

    const comparePoints = useMemo<[number, number][]>(() => {
        if (!compare || !compareYs || innerW === 0) return [];
        const cxs = linearScale([0, Math.max(compare.data.length - 1, 1)], [PAD.left, PAD.left + innerW]);
        return compare.data.map((v, i) => [cxs(i), compareYs(v)]);
    }, [compare, compareYs, innerW]);

    const linePath = useMemo(() => smoothPath(mainPoints), [mainPoints]);
    const areaPath = useMemo(() => {
        if (mainPoints.length < 2) return '';
        const first = mainPoints[0][0];
        const last = mainPoints[mainPoints.length - 1][0];
        const bottom = PAD.top + innerH;
        return `${smoothPath(mainPoints)} L${last},${bottom} L${first},${bottom} Z`;
    }, [mainPoints, innerH]);
    const comparePath = useMemo(() => smoothPath(comparePoints), [comparePoints]);

    const fmt = yFormat ?? ((v: number) => `${v.toFixed(0)}${unit}`);
    const fmtCompare = compare?.format ?? fmt;

    // niceTicks gives us raw numeric tick values; the formatter then maps
    // them to display strings. When the data range is tight (CPU jittering
    // in a 0.1% window) the formatter rounds adjacent ticks to the same
    // string. Dedupe by formatted string before rendering so the y-axis
    // never shows "4.7%, 4.7%, 4.6%" stacked.
    const ticks = useMemo(() => {
        const raw = niceTicks(dMin, dMax, 4);
        const seen = new Set<string>();
        const out: number[] = [];
        for (const t of raw) {
            const label = fmt(t);
            if (seen.has(label)) continue;
            seen.add(label);
            out.push(t);
        }
        return out;
    }, [dMin, dMax, fmt]);

    const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (data.length === 0 || innerW === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const xPx = e.clientX - rect.left;
        const rel = (xPx - PAD.left) / innerW;
        const idx = Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1))));
        setHover({ index: idx });
    }, [data.length, innerW]);

    const onLeave = useCallback(() => setHover(null), []);

    if (w === 0 || h === 0) {
        return <Container ref={containerRef} />;
    }

    const hoverPoint = hover ? mainPoints[hover.index] : null;
    const hoverCompare = hover && comparePoints.length ? comparePoints[hover.index] : null;
    const gradientId = gradientIdRef.current!;

    return (
        <Container ref={containerRef}>
            <Svg
                viewBox={`0 0 ${w} ${h}`}
                preserveAspectRatio={'none'}
                onMouseMove={onMouseMove}
                onMouseLeave={onLeave}
            >
                <defs>
                    <linearGradient id={gradientId} x1={'0'} y1={'0'} x2={'0'} y2={'1'}>
                        <stop offset={'0%'} stopColor={hexToRgba(color, 0.42)} />
                        <stop offset={'70%'} stopColor={hexToRgba(color, 0.08)} />
                        <stop offset={'100%'} stopColor={hexToRgba(color, 0)} />
                    </linearGradient>
                </defs>

                {ticks.map((t) => {
                    const y = ys(t);
                    if (y < PAD.top - 1 || y > PAD.top + innerH + 1) return null;
                    return (
                        <g key={t}>
                            <line
                                x1={PAD.left}
                                x2={PAD.left + innerW}
                                y1={y}
                                y2={y}
                                stroke={'rgba(255,255,255,0.04)'}
                                strokeWidth={1}
                            />
                            <text
                                x={PAD.left - 8}
                                y={y + 4}
                                fill={'#9CA3AF'}
                                fontSize={11}
                                textAnchor={'end'}
                                fontFamily={'Inter, system-ui, sans-serif'}
                            >
                                {fmt(t)}
                            </text>
                        </g>
                    );
                })}

                {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

                {comparePath && (
                    <path
                        d={comparePath}
                        fill={'none'}
                        stroke={compare!.color}
                        strokeWidth={1.5}
                        strokeDasharray={'4 3'}
                        strokeOpacity={0.85}
                    />
                )}

                {linePath && <path d={linePath} fill={'none'} stroke={color} strokeWidth={2} strokeLinejoin={'round'} />}

                {hoverPoint && (
                    <g pointerEvents={'none'}>
                        <line
                            x1={hoverPoint[0]}
                            x2={hoverPoint[0]}
                            y1={PAD.top}
                            y2={PAD.top + innerH}
                            stroke={color}
                            strokeOpacity={0.3}
                            strokeWidth={1}
                        />
                        {hoverCompare && (
                            <circle
                                cx={hoverCompare[0]}
                                cy={hoverCompare[1]}
                                r={3}
                                fill={'#0B0B0F'}
                                stroke={compare!.color}
                                strokeWidth={2}
                            />
                        )}
                        <circle
                            cx={hoverPoint[0]}
                            cy={hoverPoint[1]}
                            r={4}
                            fill={'#0B0B0F'}
                            stroke={color}
                            strokeWidth={2}
                        />
                    </g>
                )}
            </Svg>

            {hover && hoverPoint && data[hover.index] !== undefined && (
                <Tooltip
                    style={{
                        left: hoverPoint[0],
                        top: Math.min(hoverPoint[1], (hoverCompare?.[1] ?? hoverPoint[1])),
                    }}
                >
                    <TooltipRow $color={color}>
                        <span style={{ color: '#9CA3AF' }}>{label}</span>
                        <strong>{fmt(data[hover.index])}</strong>
                    </TooltipRow>
                    {compare && compare.data[hover.index] !== undefined && (
                        <TooltipRow $color={compare.color}>
                            <span style={{ color: '#9CA3AF' }}>{compare.label}</span>
                            <strong>{fmtCompare(compare.data[hover.index])}</strong>
                        </TooltipRow>
                    )}
                </Tooltip>
            )}
        </Container>
    );
};
