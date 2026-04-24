/**
 * gynx chart primitives — pure math. No React, no DOM.
 */

export type Scale = (value: number) => number;

/** Linear scale from domain → range. */
export const linearScale = (
    [d0, d1]: [number, number],
    [r0, r1]: [number, number],
): Scale => {
    const span = d1 - d0 || 1;
    const m = (r1 - r0) / span;
    return (v) => r0 + (v - d0) * m;
};

/**
 * Build a smooth SVG path (`d` attribute) from a list of XY points using a
 * Catmull-Rom → cubic Bézier conversion. Tension 0 = jagged, 1 = heavily
 * rounded; 0.5 is a pleasant default.
 */
export const smoothPath = (points: [number, number][], tension = 0.5): string => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;

    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;

        const cp1x = p1[0] + ((p2[0] - p0[0]) * tension) / 6;
        const cp1y = p1[1] + ((p2[1] - p0[1]) * tension) / 6;
        const cp2x = p2[0] - ((p3[0] - p1[0]) * tension) / 6;
        const cp2y = p2[1] - ((p3[1] - p1[1]) * tension) / 6;

        d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
    }
    return d;
};

/** Human-readable tick values spanning [min, max]. Target `count` ticks. */
export const niceTicks = (min: number, max: number, count = 4): number[] => {
    const range = max - min;
    if (range <= 0 || !isFinite(range)) return [min];

    const rough = range / Math.max(count - 1, 1);
    const mag = 10 ** Math.floor(Math.log10(rough));
    const norm = rough / mag;
    const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    const step = nice * mag;
    const start = Math.ceil(min / step) * step;

    const ticks: number[] = [];
    for (let v = start; v <= max + step * 0.001; v += step) {
        ticks.push(Number(v.toFixed(10)));
    }
    return ticks;
};

/** min/max of a series. Returns [0, 1] for empty input. */
export const extent = (data: number[]): [number, number] => {
    if (data.length === 0) return [0, 1];
    let min = Infinity;
    let max = -Infinity;
    for (const v of data) {
        if (!isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
    }
    if (min === Infinity) return [0, 1];
    if (min === max) return [min, min + 1];
    return [min, max];
};
