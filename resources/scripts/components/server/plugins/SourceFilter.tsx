import React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { PluginSourceInfo, PluginSourceSlug } from '@/api/server/plugins';

const Row = styled.div`
    ${tw`flex flex-wrap items-center gap-2`};
`;

const Chip = styled.button<{ $active: boolean; $disabled: boolean }>`
    ${tw`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer`};
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
    background: ${({ $active }) => ($active ? 'rgba(124, 58, 237, 0.18)' : 'transparent')};
    color: ${({ $active, $disabled }) =>
        $disabled ? 'var(--gynx-text-mute)' : $active ? '#C4B5FD' : 'var(--gynx-text-dim)'};
    border: 1px solid ${({ $active }) => ($active ? 'rgba(124, 58, 237, 0.55)' : 'var(--gynx-edge-2)')};
    opacity: ${({ $disabled }) => ($disabled ? 0.45 : 1)};
    pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};
    transition: color .15s ease, background .15s ease, border-color .15s ease;

    &:hover {
        color: ${({ $active }) => ($active ? '#DDD6FE' : 'var(--gynx-text)')};
        border-color: rgba(124, 58, 237, 0.45);
    }
`;

const LABEL: Record<PluginSourceSlug, string> = {
    modrinth: 'modrinth',
    hangar: 'hangar',
    spigot: 'spigotmc',
    curseforge: 'curseforge',
};

type Props = {
    sources: PluginSourceInfo[];
    selected: PluginSourceSlug;
    onSelect: (slug: PluginSourceSlug) => void;
};

export const SourceFilter: React.FC<Props> = ({ sources, selected, onSelect }) => (
    <Row role={'tablist'} aria-label={'plugin source'}>
        {sources.map((s) => (
            <Chip
                key={s.slug}
                type={'button'}
                role={'tab'}
                aria-selected={selected === s.slug}
                $active={selected === s.slug}
                $disabled={!s.available}
                title={s.available ? `Search ${LABEL[s.slug]}` : `${LABEL[s.slug]} — admin must add an API key in the panel .env`}
                onClick={() => s.available && onSelect(s.slug)}
            >
                {LABEL[s.slug]}
                {!s.available && <span style={{ opacity: 0.8 }}>· setup needed</span>}
            </Chip>
        ))}
    </Row>
);

export default SourceFilter;
