import React, { useCallback, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons';

const Row = styled.div`
    ${tw`flex items-center justify-between gap-4 py-1.5`};
    font-size: 13px;
`;

const Label = styled.span`
    color: var(--gynx-text-dim);
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.01em;
`;

const Value = styled.span`
    ${tw`inline-flex items-center gap-2 min-w-0`};
    color: var(--gynx-text);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const CopyBtn = styled.button`
    ${tw`p-1 rounded-md cursor-pointer opacity-0`};
    background: transparent;
    border: 0;
    color: var(--gynx-text-dim);
    transition: opacity .15s ease, color .15s ease, background .15s ease;

    ${Row}:hover & {
        opacity: 1;
    }

    &:hover {
        color: var(--gynx-text);
        background: rgba(255, 255, 255, 0.05);
    }
`;

export type KeyValueProps = {
    label: React.ReactNode;
    value: React.ReactNode;
    /** If set, a copy button appears on row-hover and copies this string. */
    copyable?: string;
};

export const KeyValue: React.FC<KeyValueProps> = ({ label, value, copyable }) => {
    const [copied, setCopied] = useState(false);
    const onCopy = useCallback(async () => {
        if (!copyable) return;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(copyable);
            } else {
                const ta = document.createElement('textarea');
                ta.value = copyable;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        } catch {
            /* swallow — copy failure is not worth surfacing */
        }
    }, [copyable]);

    return (
        <Row>
            <Label>{label}</Label>
            <Value>
                {value}
                {copyable && (
                    <CopyBtn type={'button'} onClick={onCopy} aria-label={'copy'}>
                        <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                    </CopyBtn>
                )}
            </Value>
        </Row>
    );
};
