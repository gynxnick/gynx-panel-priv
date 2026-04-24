import React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { Panel, PanelProps } from './Panel';

const Header = styled.header`
    ${tw`flex items-center justify-between gap-3 px-4 pt-3 pb-2`};
    border-bottom: 1px solid var(--gynx-edge);
`;

const Title = styled.h3`
    ${tw`text-sm font-medium`};
    color: var(--gynx-text);
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
    margin: 0;
`;

const Body = styled.div<{ $density: 'compact' | 'loose' }>`
    ${({ $density }) => ($density === 'loose' ? tw`p-5` : tw`p-4`)};
`;

const Footer = styled.footer`
    ${tw`flex items-center justify-end gap-2 px-4 py-3`};
    border-top: 1px solid var(--gynx-edge);
`;

export type CardProps = PanelProps & {
    title?: React.ReactNode;
    actions?: React.ReactNode;
    footer?: React.ReactNode;
    density?: 'compact' | 'loose';
};

export const Card: React.FC<React.PropsWithChildren<CardProps>> = ({
    title,
    actions,
    footer,
    density = 'compact',
    children,
    ...panelProps
}) => (
    <Panel {...panelProps}>
        {(title || actions) && (
            <Header>
                {title ? <Title>{title}</Title> : <span />}
                {actions ?? null}
            </Header>
        )}
        <Body $density={density}>{children}</Body>
        {footer && <Footer>{footer}</Footer>}
    </Panel>
);
