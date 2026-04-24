import { useCallback, useState } from 'react';

export type Series = {
    data: number[];
    last: number | undefined;
    delta: number;
    push: (value: number) => void;
    clear: () => void;
};

type Options = {
    capacity?: number;
    initial?: number;
};

/**
 * Ring-buffer-backed time series for live metrics. Returns a fresh `data`
 * array reference on each push so memos/charts downstream invalidate
 * correctly. Capacity defaults to 60 samples.
 */
export const useSeries = ({ capacity = 60, initial }: Options = {}): Series => {
    const [data, setData] = useState<number[]>(
        initial !== undefined ? Array(capacity).fill(initial) : [],
    );

    const push = useCallback((value: number) => {
        setData((prev) => {
            const next = prev.length >= capacity
                ? prev.slice(1).concat(value)
                : prev.concat(value);
            return next;
        });
    }, [capacity]);

    const clear = useCallback(() => {
        setData(initial !== undefined ? Array(capacity).fill(initial) : []);
    }, [capacity, initial]);

    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const delta = last !== undefined && prev !== undefined ? last - prev : 0;

    return { data, last, delta, push, clear };
};
