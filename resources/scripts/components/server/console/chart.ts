import {
    Chart as ChartJS,
    ChartData,
    ChartDataset,
    ChartOptions,
    Filler,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js';
import { DeepPartial } from 'ts-essentials';
import { useState } from 'react';
import { deepmerge, deepmergeCustom } from 'deepmerge-ts';

ChartJS.register(LineElement, PointElement, Filler, LinearScale, Tooltip);

/**
 * gynx — chart defaults.
 *
 * Visual changes from stock Pterodactyl:
 *   - tension bumped (0.15 → 0.4) for smooth curved lines
 *   - tooltips enabled with brand-aligned styling (purple edge, glass bg)
 *   - hover point becomes visible (radius 4); resting still hidden
 *   - y-axis grid color is neutral edge, not slate
 *
 * Per-metric colors are applied at the call site (StatGraphs.tsx) so the
 * chart core stays palette-agnostic.
 */

const options: ChartOptions<'line'> = {
    responsive: true,
    animation: false,
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
            enabled: true,
            backgroundColor: 'rgba(11, 11, 15, 0.96)',
            borderColor: 'rgba(124, 58, 237, 0.45)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            displayColors: false,
            titleColor: '#E5E7EB',
            titleFont: { family: 'Inter', size: 11, weight: '500' },
            bodyColor: '#E5E7EB',
            bodyFont: { family: 'JetBrains Mono, ui-monospace, monospace', size: 12, weight: '500' },
            // x-axis is just an index (0..19), so swallow the title.
            callbacks: {
                title: () => '',
            },
        },
    },
    layout: {
        padding: 0,
    },
    scales: {
        x: {
            min: 0,
            max: 19,
            type: 'linear',
            grid: {
                display: false,
                drawBorder: false,
            },
            ticks: {
                display: false,
            },
        },
        y: {
            min: 0,
            type: 'linear',
            grid: {
                display: true,
                color: 'rgba(255, 255, 255, 0.04)',
                drawBorder: false,
            },
            ticks: {
                display: true,
                count: 4,
                color: '#9CA3AF',
                font: {
                    family: 'Inter, system-ui, sans-serif',
                    size: 11,
                    weight: '400',
                },
            },
        },
    },
    elements: {
        point: {
            radius: 0,
            hoverRadius: 4,
            hoverBorderWidth: 2,
            hoverBackgroundColor: '#0B0B0F',
            // hoverBorderColor is set per-dataset at the call site so it picks
            // up the metric accent (CPU=blue, RAM=lavender, Net=cyan).
        },
        line: {
            tension: 0.4,
            borderWidth: 2,
        },
    },
};

function getOptions(opts?: DeepPartial<ChartOptions<'line'>> | undefined): ChartOptions<'line'> {
    return deepmerge(options, opts || {});
}

type ChartDatasetCallback = (value: ChartDataset<'line'>, index: number) => ChartDataset<'line'>;

function getEmptyData(label: string, sets = 1, callback?: ChartDatasetCallback | undefined): ChartData<'line'> {
    const next = callback || ((value) => value);

    return {
        labels: Array(20)
            .fill(0)
            .map((_, index) => index),
        datasets: Array(sets)
            .fill(0)
            .map((_, index) =>
                next(
                    {
                        fill: true,
                        label,
                        data: Array(20).fill(-5),
                        borderColor: '#22D3EE',
                        backgroundColor: 'rgba(34, 211, 238, 0.16)',
                    },
                    index
                )
            ),
    };
}

const merge = deepmergeCustom({ mergeArrays: false });

interface UseChartOptions {
    sets: number;
    options?: DeepPartial<ChartOptions<'line'>> | number | undefined;
    callback?: ChartDatasetCallback | undefined;
}

function useChart(label: string, opts?: UseChartOptions) {
    const options = getOptions(
        typeof opts?.options === 'number' ? { scales: { y: { min: 0, suggestedMax: opts.options } } } : opts?.options
    );
    const [data, setData] = useState(getEmptyData(label, opts?.sets || 1, opts?.callback));

    const push = (items: number | null | (number | null)[]) =>
        setData((state) =>
            merge(state, {
                datasets: (Array.isArray(items) ? items : [items]).map((item, index) => ({
                    ...state.datasets[index],
                    data: state.datasets[index].data
                        .slice(1)
                        .concat(typeof item === 'number' ? Number(item.toFixed(2)) : item),
                })),
            })
        );

    const clear = () =>
        setData((state) =>
            merge(state, {
                datasets: state.datasets.map((value) => ({
                    ...value,
                    data: Array(20).fill(-5),
                })),
            })
        );

    return { props: { data, options }, push, clear };
}

function useChartTickLabel(label: string, max: number, tickLabel: string, roundTo?: number) {
    return useChart(label, {
        sets: 1,
        options: {
            scales: {
                y: {
                    suggestedMax: max,
                    ticks: {
                        callback(value) {
                            return `${roundTo ? Number(value).toFixed(roundTo) : value}${tickLabel}`;
                        },
                    },
                },
            },
        },
    });
}

export { useChart, useChartTickLabel, getOptions, getEmptyData };
