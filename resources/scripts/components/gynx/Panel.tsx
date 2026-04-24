import React from 'react';
import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

export type PanelVariant = 'flat' | 'elevated' | 'accent';

export type PanelProps = {
    variant?: PanelVariant;
    /** Accent color used when variant = 'accent'. Defaults to Cyber Purple. */
    accentColor?: string;
    /** Render as a different element (e.g. 'div', 'article'). */
    as?: React.ElementType;
    className?: string;
};

const Wrap = styled.section<{ $variant: PanelVariant; $accent: string }>`
    ${tw`relative rounded-xl`};
    background: var(--gynx-surface);
    border: 1px solid var(--gynx-edge);
    transition: border-color .25s ease, box-shadow .25s ease;

    ${({ $variant }) =>
        $variant === 'elevated' &&
        css`
            box-shadow: 0 10px 28px -14px rgba(0, 0, 0, 0.55);
        `}

    ${({ $variant, $accent }) =>
        $variant === 'accent' &&
        css`
            border-left: 3px solid ${$accent};
        `}

    &:hover {
        border-color: rgba(124, 58, 237, 0.35);
    }
`;

export const Panel: React.FC<React.PropsWithChildren<PanelProps>> = ({
    variant = 'flat',
    accentColor = '#7C3AED',
    children,
    className,
    as,
}) => (
    <Wrap as={as as any} $variant={variant} $accent={accentColor} className={className}>
        {children}
    </Wrap>
);
