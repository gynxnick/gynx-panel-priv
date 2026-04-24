import React, { useEffect } from 'react';
import { httpErrorToHuman } from '@/api/http';
import { CSSTransition } from 'react-transition-group';
import Spinner from '@/components/elements/Spinner';
import FileObjectRow from '@/components/server/files/FileObjectRow';
import FileManagerBreadcrumbs from '@/components/server/files/FileManagerBreadcrumbs';
import { FileObject } from '@/api/server/files/loadDirectory';
import NewDirectoryButton from '@/components/server/files/NewDirectoryButton';
import { NavLink, useLocation } from 'react-router-dom';
import Can from '@/components/elements/Can';
import { ServerError } from '@/components/elements/ScreenBlock';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import { ServerContext } from '@/state/server';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import FileManagerStatus from '@/components/server/files/FileManagerStatus';
import MassActionsBar from '@/components/server/files/MassActionsBar';
import UploadButton from '@/components/server/files/UploadButton';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { useStoreActions } from '@/state/hooks';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { FileActionCheckbox } from '@/components/server/files/SelectFileCheckbox';
import { hashToPath } from '@/helpers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { EmptyState, Panel } from '@/components/gynx';
import style from './style.module.css';

const sortFiles = (files: FileObject[]): FileObject[] => {
    const sortedFiles: FileObject[] = files
        .sort((a, b) => a.name.localeCompare(b.name))
        .sort((a, b) => (a.isFile === b.isFile ? 0 : a.isFile ? 1 : -1));
    return sortedFiles.filter((file, index) => index === 0 || file.name !== sortedFiles[index - 1].name);
};

const Toolbar = styled.div`
    ${tw`flex flex-col md:flex-row md:items-center gap-3 mb-4`};
`;

const ListHeader = styled.div`
    ${tw`hidden md:flex items-center px-3 py-2 text-xs uppercase`};
    color: var(--gynx-text-mute);
    border-bottom: 1px solid var(--gynx-edge);
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.08em;
`;

const HeaderName = styled.div`
    ${tw`flex-1`};
    padding-left: 88px;
`;

const HeaderSize = styled.div`
    ${tw`text-right mr-4 hidden sm:block`};
    width: 16%;
`;

const HeaderModified = styled.div`
    ${tw`text-right mr-4 hidden md:block`};
    width: 20%;
`;

const HeaderActions = styled.div`
    width: 40px;
`;

const TruncatedNotice = styled.div`
    ${tw`rounded-md px-3 py-2 text-xs mb-2`};
    background: rgba(252, 211, 77, 0.08);
    border: 1px solid rgba(252, 211, 77, 0.3);
    color: #FCD34D;
    font-family: 'Inter', sans-serif;
`;

const ListBody = styled.div`
    ${tw`p-2`};
`;

export default () => {
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const { hash } = useLocation();
    const { data: files, error, mutate } = useFileManagerSwr();
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const clearFlashes = useStoreActions((actions) => actions.flashes.clearFlashes);
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);

    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);
    const selectedFilesLength = ServerContext.useStoreState((state) => state.files.selectedFiles.length);

    useEffect(() => {
        clearFlashes('files');
        setSelectedFiles([]);
        setDirectory(hashToPath(hash));
    }, [hash]);

    useEffect(() => {
        mutate();
    }, [directory]);

    const onSelectAllClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedFiles(e.currentTarget.checked ? files?.map((file) => file.name) || [] : []);
    };

    if (error) {
        return <ServerError message={httpErrorToHuman(error)} onRetry={() => mutate()} />;
    }

    return (
        <ServerContentBlock title={'File Manager'} showFlashKey={'files'}>
            <ErrorBoundary>
                <Toolbar>
                    <FileManagerBreadcrumbs
                        renderLeft={
                            <FileActionCheckbox
                                type={'checkbox'}
                                css={tw`mx-3`}
                                checked={selectedFilesLength === (files?.length === 0 ? -1 : files?.length)}
                                onChange={onSelectAllClick}
                            />
                        }
                    />
                    <Can action={'file.create'}>
                        <div className={`${style.manager_actions} md:ml-auto`}>
                            <FileManagerStatus />
                            <NewDirectoryButton />
                            <UploadButton />
                            <NavLink to={`/server/${id}/files/new${window.location.hash}`}>
                                <Button>New File</Button>
                            </NavLink>
                        </div>
                    </Can>
                </Toolbar>
            </ErrorBoundary>
            {!files ? (
                <Spinner size={'large'} centered />
            ) : !files.length ? (
                <Panel>
                    <EmptyState
                        size={'section'}
                        icon={<FontAwesomeIcon icon={faFolderOpen} />}
                        title={'Empty directory'}
                        body={'Nothing here yet. Use the toolbar above to upload, create a new file, or make a folder.'}
                    />
                </Panel>
            ) : (
                <CSSTransition classNames={'fade'} timeout={150} appear in>
                    <div>
                        {files.length > 250 && (
                            <TruncatedNotice>
                                Directory too large to fully list — showing the first 250 entries.
                            </TruncatedNotice>
                        )}
                        <Panel>
                            <ListHeader>
                                <HeaderName>Name</HeaderName>
                                <HeaderSize>Size</HeaderSize>
                                <HeaderModified>Modified</HeaderModified>
                                <HeaderActions />
                            </ListHeader>
                            <ListBody>
                                {sortFiles(files.slice(0, 250)).map((file) => (
                                    <FileObjectRow key={file.key} file={file} />
                                ))}
                            </ListBody>
                        </Panel>
                        <MassActionsBar />
                    </div>
                </CSSTransition>
            )}
        </ServerContentBlock>
    );
};
