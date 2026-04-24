import React from 'react';
import styled, { css, keyframes } from 'styled-components/macro';
import tw from 'twin.macro';

export type PillVariant = 'live' | 'idle' | 'warn' | 'err' | 'info';

const PALETTE: Record<PillVariant, { fg: string; bg: string; border: string }> = {
    live: { fg: '#34D399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.35)' },
    idle: { fg: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.10)', border: 'var(--gynx-edge-2)' },
    warn: { fg: '#FCD34D', bg: 'rgba(252, 211, 77, 0.12)', border: 'rgba(252, 211, 77, 0.35)' },
    err:  { fg: '#F87171', bg: 'rgba(248, 113, 113, 0.12)', border: 'rgba(248, 113, 113, 0.35)' },
    info: { fg: '#22D3EE', bg: 'rgba(34, 211, 238, 0.12)', border: 'rgba(34, 211, 238, 0.35)' },
};

const pulse = keyframes`
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.55; transform: scale(0.8); }
`;

const Wrap = styled.span<{ $variant: PillVariant }>`
    ${tw`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium`};
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
    color: ${({ $variant }) => PALETTE[$variant].fg};
    background: ${({ $variant }) => PALETTE[$variant].bg};
    border: 1px solid ${({ $variant }) => PALETTE[$variant].border};
`;

const Dot = styled.span<{ $variant: PillVariant }>`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $variant }) => PALETTE[$variant].fg};
    ${({ $variant }) =>
        $variant === 'live' &&
        css`
            animation: ${pulse} 1.8s ease-in-out infinite;
        `}
`;

export type PillProps = {
    variant?: PillVariant;
    children: React.ReactNode;
};

export const Pill: React.FC<PillProps> = ({ variant = 'idle', children }) => (
    <Wrap $variant={variant}>
        <Dot $variant={variant} />
        {children}
    </Wrap>
);
