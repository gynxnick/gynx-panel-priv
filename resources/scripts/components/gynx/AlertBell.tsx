import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBell,
    faInfoCircle,
    faExclamationTriangle,
    faWrench,
    faExclamationCircle,
    faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { formatDistanceToNow } from 'date-fns';
import { useStoreState, useStoreActions } from '@/state/hooks';
import { AlertSeverity } from '@/state/alerts';
import { dismissAlert } from '@/api/client/alerts';
import { persistDismissal } from './useAlertPolling';

const SEV_COLOR: Record<AlertSeverity, string> = {
    critical: '#F87171',
    warn: '#FCD34D',
    maint: '#C4B5FD',
    info: '#22D3EE',
};

const SEV_ICON: Record<AlertSeverity, any> = {
    critical: faExclamationCircle,
    warn: faExclamationTriangle,
    maint: faWrench,
    info: faInfoCircle,
};

const pulse = keyframes`
    0%, 100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(0.8); opacity: 0.7; }
`;

const Wrap = styled.div`
    ${tw`relative flex-shrink-0`};
`;

const BellBtn = styled.button`
    ${tw`inline-flex items-center justify-center rounded-md cursor-pointer`};
    width: 36px;
    height: 36px;
    background: transparent;
    border: 1px solid var(--gynx-edge);
    color: var(--gynx-text-dim);
    transition: color .15s ease, background .15s ease, border-color .15s ease;

    &:hover {
        color: var(--gynx-text);
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(124, 58, 237, 0.35);
    }
`;

const Badge = styled.span<{ $color: string }>`
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: ${({ $color }) => $color};
    color: #0B0B0F;
    font-family: 'Inter', sans-serif;
    font-size: 10px;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
    animation: ${pulse} 2.2s ease-in-out infinite;
    box-shadow: 0 0 0 2px var(--gynx-void);
`;

const Sheet = styled.div`
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 60;
    width: 360px;
    max-height: 420px;
    overflow-y: auto;
    background: var(--gynx-surface);
    border: 1px solid var(--gynx-edge);
    border-radius: 12px;
    box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.6);
`;

const SheetHeader = styled.header`
    ${tw`flex items-center justify-between px-4 py-3`};
    border-bottom: 1px solid var(--gynx-edge);
`;

const SheetTitle = styled.span`
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--gynx-text);
    letter-spacing: 0.02em;
`;

const Empty = styled.div`
    ${tw`px-4 py-8 text-center`};
    color: var(--gynx-text-mute);
    font-family: 'Inter', sans-serif;
    font-size: 12px;
`;

const Row = styled.div`
    ${tw`flex items-start gap-3 px-4 py-3`};
    border-bottom: 1px solid var(--gynx-edge);
    &:last-child { border-bottom: 0; }
`;

const SevIcon = styled.span<{ $color: string }>`
    ${tw`flex-shrink-0 mt-0.5`};
    color: ${({ $color }) => $color};
    width: 14px;
    text-align: center;
`;

const RowBody = styled.div`
    ${tw`flex-1 min-w-0`};
`;

const RowTitle = styled.p`
    ${tw`m-0 text-sm font-medium`};
    color: var(--gynx-text);
    font-family: 'Inter', sans-serif;
`;

const RowDetail = styled.p`
    ${tw`m-0 mt-1 text-xs`};
    color: var(--gynx-text-dim);
    line-height: 1.5;
`;

const RowMeta = styled.p`
    ${tw`m-0 mt-1.5 text-xs`};
    color: var(--gynx-text-mute);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
`;

const RowDismiss = styled.button`
    ${tw`flex-shrink-0 inline-flex items-center justify-center rounded-md cursor-pointer`};
    width: 22px;
    height: 22px;
    background: transparent;
    border: 0;
    color: var(--gynx-text-mute);
    transition: color .15s ease, background .15s ease;

    &:hover {
        color: var(--gynx-text);
        background: rgba(255, 255, 255, 0.05);
    }
`;

export const AlertBell: React.FC = () => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    const items = useStoreState((s) => s.alerts.items);
    const dismissed = useStoreState((s) => s.alerts.dismissed);
    const userUuid = useStoreState((s) => s.user.data?.uuid);
    const addDismissed = useStoreActions((a) => a.alerts.addDismissed);

    const visible = useMemo(
        () => items.filter((a) => !dismissed.includes(a.id)),
        [items, dismissed],
    );
    const count = visible.length;
    const topSeverity = visible[0]?.severity ?? 'info';

    // Click-outside to close.
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onEsc);
        };
    }, [open]);

    const onDismiss = (id: string) => {
        addDismissed(id);
        if (userUuid) persistDismissal(userUuid, id);
        dismissAlert(id);
    };

    return (
        <Wrap ref={wrapRef}>
            <BellBtn
                type={'button'}
                onClick={() => setOpen((v) => !v)}
                aria-label={'Alerts'}
                aria-expanded={open}
                title={count > 0 ? `${count} active alert${count === 1 ? '' : 's'}` : 'No active alerts'}
            >
                <FontAwesomeIcon icon={faBell} />
                {count > 0 && <Badge $color={SEV_COLOR[topSeverity]}>{count}</Badge>}
            </BellBtn>
            {open && (
                <Sheet role={'menu'}>
                    <SheetHeader>
                        <SheetTitle>{count > 0 ? 'Active alerts' : 'All clear'}</SheetTitle>
                    </SheetHeader>
                    {count === 0 ? (
                        <Empty>No alerts right now. Check back later.</Empty>
                    ) : (
                        visible.map((a) => (
                            <Row key={a.id}>
                                <SevIcon $color={SEV_COLOR[a.severity]}>
                                    <FontAwesomeIcon icon={SEV_ICON[a.severity]} />
                                </SevIcon>
                                <RowBody>
                                    <RowTitle>{a.title}</RowTitle>
                                    {a.body && <RowDetail>{a.body}</RowDetail>}
                                    <RowMeta>{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</RowMeta>
                                </RowBody>
                                {a.dismissible && (
                                    <RowDismiss
                                        type={'button'}
                                        onClick={() => onDismiss(a.id)}
                                        aria-label={'Dismiss'}
                                    >
                                        <FontAwesomeIcon icon={faTimes} />
                                    </RowDismiss>
                                )}
                            </Row>
                        ))
                    )}
                </Sheet>
            )}
        </Wrap>
    );
};

export default AlertBell;
