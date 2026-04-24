import React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

export type EmptyStateSize = 'page' | 'section' | 'table';

const Wrap = styled.div<{ $size: EmptyStateSize }>`
    ${tw`flex flex-col items-center justify-center text-center`};
    ${({ $size }) =>
        $size === 'page'
            ? tw`py-24 gap-4`
            : $size === 'section'
            ? tw`py-12 gap-3`
            : tw`py-8 gap-2`};
    color: var(--gynx-text-dim);
`;

const Icon = styled.div`
    ${tw`flex items-center justify-center rounded-full`};
    width: 48px;
    height: 48px;
    background: rgba(124, 58, 237, 0.08);
    border: 1px solid rgba(124, 58, 237, 0.18);
    color: #c4b5fd;
    font-size: 18px;
`;

const Title = styled.h4`
    ${tw`text-sm font-medium`};
    color: var(--gynx-text);
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
    margin: 0;
`;

const Body = styled.p`
    ${tw`text-sm max-w-sm`};
    color: var(--gynx-text-dim);
    line-height: 1.55;
    margin: 0;
`;

const Action = styled.div`
    ${tw`mt-1`};
`;

export type EmptyStateProps = {
    size?: EmptyStateSize;
    icon?: React.ReactNode;
    title: React.ReactNode;
    body?: React.ReactNode;
    action?: React.ReactNode;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
    size = 'section',
    icon,
    title,
    body,
    action,
}) => (
    <Wrap $size={size}>
        {icon && <Icon>{icon}</Icon>}
        <Title>{title}</Title>
        {body && <Body>{body}</Body>}
        {action && <Action>{action}</Action>}
    </Wrap>
);
