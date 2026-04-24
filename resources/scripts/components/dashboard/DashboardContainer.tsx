import React, { useEffect, useState } from 'react';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';
import ServerCard from '@/components/dashboard/ServerCard';
import Spinner from '@/components/elements/Spinner';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';
import Switch from '@/components/elements/Switch';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import Pagination from '@/components/elements/Pagination';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer } from '@fortawesome/free-solid-svg-icons';
import { EmptyState } from '@/components/gynx';

const Grid = styled.div`
    ${tw`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`};
`;

const AdminToggle = styled.div`
    ${tw`mb-4 flex justify-end items-center gap-3`};
    color: var(--gynx-text-dim);
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-family: 'Inter', sans-serif;
`;

export default () => {
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');

    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const uuid = useStoreState((state) => state.user.data!.uuid);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [showOnlyAdmin, setShowOnlyAdmin] = usePersistedState(`${uuid}:show_all_servers`, false);

    const { data: servers, error } = useSWR<PaginatedResult<Server>>(
        ['/api/client/servers', showOnlyAdmin && rootAdmin, page],
        () => getServers({ page, type: showOnlyAdmin && rootAdmin ? 'admin' : undefined })
    );

    useEffect(() => {
        if (!servers) return;
        if (servers.pagination.currentPage > 1 && !servers.items.length) {
            setPage(1);
        }
    }, [servers?.pagination.currentPage]);

    useEffect(() => {
        window.history.replaceState(null, document.title, `/${page <= 1 ? '' : `?page=${page}`}`);
    }, [page]);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'dashboard', error });
        if (!error) clearFlashes('dashboard');
    }, [error]);

    return (
        <PageContentBlock title={'Dashboard'} showFlashKey={'dashboard'}>
            {rootAdmin && (
                <AdminToggle>
                    <span>{showOnlyAdmin ? "showing others' servers" : 'showing your servers'}</span>
                    <Switch
                        name={'show_all_servers'}
                        defaultChecked={showOnlyAdmin}
                        onChange={() => setShowOnlyAdmin((s) => !s)}
                    />
                </AdminToggle>
            )}
            {!servers ? (
                <Spinner centered size={'large'} />
            ) : (
                <Pagination data={servers} onPageSelect={setPage}>
                    {({ items }) =>
                        items.length > 0 ? (
                            <Grid>
                                {items.map((server) => (
                                    <ServerCard key={server.uuid} server={server} />
                                ))}
                            </Grid>
                        ) : (
                            <EmptyState
                                size={'page'}
                                icon={<FontAwesomeIcon icon={faServer} />}
                                title={showOnlyAdmin ? 'No other servers' : 'No servers yet'}
                                body={
                                    showOnlyAdmin
                                        ? 'No other users have deployed servers on this panel.'
                                        : 'Ask your admin for a deployment, or contact support if you expected to see one here.'
                                }
                            />
                        )
                    }
                </Pagination>
            )}
        </PageContentBlock>
    );
};
