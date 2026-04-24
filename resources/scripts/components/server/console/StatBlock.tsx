import React from 'react';
import Icon from '@/components/elements/Icon';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import useFitText from 'use-fit-text';
import CopyOnClick from '@/components/elements/CopyOnClick';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

/**
 * gynx — stat tile, realigned to the strict color rule.
 *
 * Default state is flat: #1F2937 surface, 1px neutral edge, no glow, no
 * gradient. Glow only appears on hover. The icon badge is tinted per metric
 * (CPU=blue, RAM=purple, Disk=yellow, Network=cyan, Status=green) and an
 * optional progress bar shares that color. When a value crosses its soft/hard
 * threshold, the icon badge and progress fill flip to yellow/red.
 */

export type Metric = 'cpu' | 'ram' | 'disk' | 'net' | 'status' | 'info';
export type Severity = 'ok' | 'warn' | 'crit';

/* RAM deliberately uses a desaturated violet-lavender (#C4B5FD = Tailwind
 * violet-300) instead of the full-saturation brand purple. Keeps passive
 * metric accents from competing with active-state pills and primary action
 * buttons, which own the true purple. */
const metricColor: Record<Metric, string> = {
    cpu:    '#60A5FA', // blue
    ram:    '#C4B5FD', // lavender (was brand-purple #A78BFA in session 2)
    disk:   '#FBBF24', // yellow
    net:    '#22D3EE', // cyan
    status: '#34D399', // green
    info:   '#9CA3AF', // neutral
};

const severityColor: Record<Severity, string> = {
    ok:   '',
    warn: '#FBBF24',
    crit: '#EF4444',
};

const Tile = styled.div<{ $accent: string; $severity: Severity }>`
    ${tw`relative flex items-stretch gap-3 px-3 py-3 rounded-xl`};
    background: var(--gynx-surface);
    border: 1px solid var(--gynx-edge);
    transition: transform .2s ease, border-color .25s ease, box-shadow .25s ease;
    overflow: hidden;

    &:hover {
        transform: translateY(-2px);
        border-color: rgba(124, 58, 237, 0.35);
        box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.35), 0 10px 28px -12px rgba(124, 58, 237, 0.4);
    }

    /* Left accent bar — the only default color on the tile. 2px, metric-tinted,
       flips to severity when warn/crit. */
    &::before {
        content: '';
        position: absolute;
        left: 0; top: 8px; bottom: 8px;
        width: 2px;
        border-radius: 2px;
        background: ${({ $accent, $severity }) =>
            $severity === 'ok' ? $accent : severityColor[$severity]};
        opacity: ${({ $severity }) => ($severity === 'ok' ? 0.55 : 0.9)};
    }
`;

const IconBadge = styled.div<{ $accent: string }>`
    ${tw`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg`};
    background: ${({ $accent }) => `${$accent}18`}; /* ~9% of the metric color */
    color: ${({ $accent }) => $accent};

    & > svg {
        width: 15px; height: 15px;
    }
`;

const Body = styled.div`
    ${tw`flex flex-col justify-center overflow-hidden min-w-0 w-full gap-1`};
`;

const Label = styled.p`
    ${tw`m-0`};
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: lowercase;
    color: var(--gynx-text-dim);
    font-weight: 500;
`;

const Value = styled.div`
    ${tw`w-full truncate text-gynx-text`};
    font-weight: 600;
    letter-spacing: -0.01em;
    height: 1.5rem;
    line-height: 1.5rem;
`;

const ProgressTrack = styled.div`
    height: 3px;
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
    overflow: hidden;
`;

const ProgressFill = styled.div<{ $color: string; $pct: number }>`
    height: 100%;
    width: ${({ $pct }) => Math.max(0, Math.min(1, $pct)) * 100}%;
    background: ${({ $color }) => $color};
    border-radius: 2px;
    transition: width .4s cubic-bezier(0.4, 0, 0.2, 1), background-color .2s ease;
`;

interface StatBlockProps {
    title: string;
    copyOnClick?: string;
    color?: string | undefined;  // legacy: upstream call sites pass a Tailwind class
    icon: IconDefinition;
    children: React.ReactNode;
    className?: string;
    metric?: Metric;
    progress?: number;           // 0..1
}

const severityFrom = (color?: string): Severity => {
    if (!color) return 'ok';
    if (color.includes('red')) return 'crit';
    if (color.includes('yellow') || color.includes('amber')) return 'warn';
    return 'ok';
};

export default ({
    title,
    copyOnClick,
    icon,
    color,
    className,
    children,
    metric = 'info',
    progress,
}: StatBlockProps) => {
    const { fontSize, ref } = useFitText({ minFontSize: 8, maxFontSize: 220 });
    const severity = severityFrom(color);
    const accent = metricColor[metric];
    const fillColor = severity === 'ok' ? accent : severityColor[severity];

    return (
        <CopyOnClick text={copyOnClick}>
            <Tile className={classNames(className)} $accent={accent} $severity={severity}>
                <IconBadge $accent={accent}>
                    <Icon icon={icon} />
                </IconBadge>
                <Body>
                    <Label>{title}</Label>
                    <Value ref={ref} style={{ fontSize }}>
                        {children}
                    </Value>
                    {typeof progress === 'number' && (
                        <ProgressTrack>
                            <ProgressFill $color={fillColor} $pct={progress} />
                        </ProgressTrack>
                    )}
                </Body>
            </Tile>
        </CopyOnClick>
    );
};
