import React, { useEffect, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faHome } from '@fortawesome/free-solid-svg-icons';
import { NavLink, useLocation } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import { encodePathSegments, hashToPath } from '@/helpers';

interface Props {
    renderLeft?: JSX.Element;
    withinFileEditor?: boolean;
    isNewFile?: boolean;
}

const Wrap = styled.nav`
    ${tw`flex flex-grow-0 items-center gap-0.5 text-sm overflow-x-auto py-1`};
    color: var(--gynx-text-dim);
    font-family: 'Inter', sans-serif;
    min-width: 0;
`;

const Sep = styled(FontAwesomeIcon)`
    font-size: 9px;
    color: var(--gynx-text-mute);
    margin: 0 2px;
    flex: 0 0 auto;
`;

const Crumb = styled(NavLink)`
    ${tw`px-2 py-1 rounded-md no-underline whitespace-nowrap`};
    color: var(--gynx-text-dim);
    transition: color .15s ease, background .15s ease;
    flex: 0 0 auto;

    &:hover {
        color: var(--gynx-text);
        background: rgba(255, 255, 255, 0.04);
    }
`;

const Current = styled.span`
    ${tw`px-2 py-1 whitespace-nowrap`};
    color: var(--gynx-text);
    font-weight: 500;
    flex: 0 0 auto;
`;

export default ({ renderLeft, withinFileEditor, isNewFile }: Props) => {
    const [file, setFile] = useState<string | null>(null);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const { hash } = useLocation();

    useEffect(() => {
        const path = hashToPath(hash);
        if (withinFileEditor && !isNewFile) {
            setFile(path.split('/').pop() || null);
        }
    }, [withinFileEditor, isNewFile, hash]);

    const crumbs = directory
        .split('/')
        .filter(Boolean)
        .map((name, index, all) => {
            const isLastDir = !withinFileEditor && index === all.length - 1;
            return {
                name,
                path: isLastDir ? undefined : `/${all.slice(0, index + 1).join('/')}`,
            };
        });

    return (
        <Wrap aria-label={'file path'}>
            {renderLeft}
            <Crumb to={`/server/${id}/files`} title={'container root'}>
                <FontAwesomeIcon icon={faHome} />
            </Crumb>
            {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                    <Sep icon={faChevronRight} />
                    {c.path ? (
                        <Crumb to={`/server/${id}/files#${encodePathSegments(c.path)}`}>{c.name}</Crumb>
                    ) : (
                        <Current>{c.name}</Current>
                    )}
                </React.Fragment>
            ))}
            {file && (
                <>
                    <Sep icon={faChevronRight} />
                    <Current>{file}</Current>
                </>
            )}
        </Wrap>
    );
};
