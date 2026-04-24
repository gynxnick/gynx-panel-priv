import React, { useMemo } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faInfoCircle,
    faExclamationTriangle,
    faWrench,
    faExclamationCircle,
    faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { useStoreState, useStoreActions } from '@/state/hooks';
import { AlertSeverity, PanelAlert } from '@/state/alerts';
import { dismissAlert } from '@/api/client/alerts';
import { persistDismissal } from './useAlertPolling';

const SEVERITY_RANK: Record<AlertSeverity, number> = {
    critical: 0,
    maint: 1,
    warn: 2,
    info: 3,
};

const SEVERITY_STYLE: Record<AlertSeverity, { fg: string; bg: string; border: string; icon: any }> = {
    critical: {
        fg: '#F87171',
        bg: 'rgba(248, 113, 113, 0.10)',
        border: 'rgba(248, 113, 113, 0.35)',
        icon: faExclamationCircle,
    },
    warn: {
        fg: '#FCD34D',
        bg: 'rgba(252, 211, 77, 0.08)',
        border: 'rgba(252, 211, 77, 0.32)',
        icon: faExclamationTriangle,
    },
    maint: {
        fg: '#C4B5FD',
        bg: 'rgba(196, 181, 253, 0.08)',
        border: 'rgba(196, 181, 253, 0.32)',
        icon: faWrench,
    },
    info: {
        fg: '#22D3EE',
        bg: 'rgba(34, 211, 238, 0.08)',
        border: 'rgba(34, 211, 238, 0.32)',
        icon: faInfoCircle,
    },
};

const Wrap = styled.div<{ $severity: AlertSeverity }>`
    ${tw`flex items-center gap-3 px-4 py-2`};
    color: ${({ $severity }) => SEVERITY_STYLE[$severity].fg};
    background: ${({ $severity }) => SEVERITY_STYLE[$severity].bg};
    border-bottom: 1px solid ${({ $severity }) => SEVERITY_STYLE[$severity].border};
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    line-height: 1.4;
`;

const Icon = styled.div`
    ${tw`flex-shrink-0`};
    width: 16px;
    text-align: center;
`;

const Body = styled.div`
    ${tw`flex-1 min-w-0 flex items-center gap-2 flex-wrap`};
    color: var(--gynx-text);
`;

const Title = styled.strong`
    color: var(--gynx-text);
    font-weight: 600;
`;

const Detail = styled.span`
    color: var(--gynx-text-dim);
`;

const LearnMore = styled.a<{ $fg: string }>`
    ${tw`ml-auto text-xs`};
    color: ${({ $fg }) => $fg};
    text-decoration: none;
    white-space: nowrap;
    &:hover { text-decoration: underline; }
`;

const Dismiss = styled.button`
    ${tw`flex-shrink-0 inline-flex items-center justify-center rounded-md cursor-pointer`};
    width: 24px;
    height: 24px;
    background: transparent;
    border: 0;
    color: var(--gynx-text-dim);
    transition: color .15s ease, background .15s ease;

    &:hover {
        color: var(--gynx-text);
        background: rgba(255, 255, 255, 0.06);
    }
`;

export const AlertBar: React.FC = () => {
    const items = useStoreState((s) => s.alerts.items);
    const dismissed = useStoreState((s) => s.alerts.dismissed);
    const userUuid = useStoreState((s) => s.user.data?.uuid);
    const addDismissed = useStoreActions((a) => a.alerts.addDismissed);

    const top = useMemo<PanelAlert | null>(() => {
        const visible = items.filter((a) => !dismissed.includes(a.id));
        if (visible.length === 0) return null;
        return [...visible].sort(
            (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];
    }, [items, dismissed]);

    if (!top) return null;

    const s = SEVERITY_STYLE[top.severity];

    const onDismiss = () => {
        addDismissed(top.id);
        if (userUuid) persistDismissal(userUuid, top.id);
        dismissAlert(top.id);
    };

    return (
        <Wrap $severity={top.severity} role={'status'} aria-live={'polite'}>
            <Icon><FontAwesomeIcon icon={s.icon} /></Icon>
            <Body>
                <Title>{top.title}</Title>
                {top.body && <Detail>— {top.body}</Detail>}
            </Body>
            {top.linkUrl && (
                <LearnMore $fg={s.fg} href={top.linkUrl} target={'_blank'} rel={'noreferrer'}>
                    Learn more
                </LearnMore>
            )}
            {top.dismissible && (
                <Dismiss type={'button'} onClick={onDismiss} aria-label={'Dismiss alert'}>
                    <FontAwesomeIcon icon={faTimes} />
                </Dismiss>
            )}
        </Wrap>
    );
};

export default AlertBar;
