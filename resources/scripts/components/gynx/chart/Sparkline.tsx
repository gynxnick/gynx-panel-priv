import React, { useMemo, useRef } from 'react';
import styled from 'styled-components/macro';
import { hexToRgba } from '@/lib/helpers';
import { extent, linearScale, smoothPath } from './primitives';

const Svg = styled.svg`
    display: block;
`;

export type SparklineProps = {
    data: number[];
    color: string;
    width?: number;
    height?: number;
    /** Show a subtle filled area under the line. Default true. */
    filled?: boolean;
};

let counter = 0;

export const Sparkline: React.FC<SparklineProps> = ({
    data,
    color,
    width = 80,
    height = 24,
    filled = true,
}) => {
    const idRef = useRef<string>();
    if (!idRef.current) idRef.current = `gynx-spark-${++counter}`;

    const { linePath, areaPath } = useMemo(() => {
        if (data.length < 2) return { linePath: '', areaPath: '' };
        const [lo, hi] = extent(data);
        const pad = (hi - lo) * 0.1 || 1;
        const xs = linearScale([0, data.length - 1], [1, width - 1]);
        const ys = linearScale([lo - pad, hi + pad], [height - 1, 1]);
        const points = data.map((v, i): [number, number] => [xs(i), ys(v)]);
        const line = smoothPath(points);
        const area = `${line} L${width - 1},${height - 1} L1,${height - 1} Z`;
        return { linePath: line, areaPath: area };
    }, [data, width, height]);

    if (!linePath) return <Svg width={width} height={height} />;

    return (
        <Svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
            <defs>
                <linearGradient id={idRef.current} x1={'0'} y1={'0'} x2={'0'} y2={'1'}>
                    <stop offset={'0%'} stopColor={hexToRgba(color, 0.35)} />
                    <stop offset={'100%'} stopColor={hexToRgba(color, 0)} />
                </linearGradient>
            </defs>
            {filled && <path d={areaPath} fill={`url(#${idRef.current})`} />}
            <path d={linePath} fill={'none'} stroke={color} strokeWidth={1.5} strokeLinejoin={'round'} />
        </Svg>
    );
};
