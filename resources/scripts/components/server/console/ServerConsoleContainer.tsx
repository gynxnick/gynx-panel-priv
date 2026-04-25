import React, { memo } from 'react';
import { ServerContext } from '@/state/server';
import Can from '@/components/elements/Can';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import isEqual from 'react-fast-compare';
import Spinner from '@/components/elements/Spinner';
import Features from '@feature/Features';
import Console from '@/components/server/console/Console';
import StatGraphs from '@/components/server/console/StatGraphs';
import PowerButtons from '@/components/server/console/PowerButtons';
import ServerDetailsBlock from '@/components/server/console/ServerDetailsBlock';
import { Alert } from '@/components/elements/alert';

export type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

/**
 * gynx — Console page (console-first layout).
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │                                                            │
 *   │                  TERMINAL (full width)                     │
 *   │                                                            │
 *   └────────────────────────────────────────────────────────────┘
 *   ┌──────┬─────────────┬──────┐ ┌────────────────────┐
 *   │ stat │ connection  │ disk │ │   POWER ACTIONS    │
 *   └──────┴─────────────┴──────┘ └────────────────────┘
 *   ┌──────────┬──────────┬──────────┐
 *   │ CPU      │ MEMORY   │ NETWORK  │   (grid view default)
 *   │ chart    │ chart    │ chart    │   (toggle to tabs in StatGraphs)
 *   └──────────┴──────────┴──────────┘
 *
 * CPU / RAM / Net In / Net Out tiles were removed from the right rail —
 * the StatGraphs panel underneath shows the same data as live curves,
 * so the duplicate tiles were noise. Disk stays as a tile because there
 * is no disk graph (it changes too slowly to plot meaningfully).
 */
const ServerConsoleContainer = () => {
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data!.eggFeatures, isEqual);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);

    const showBanner = isNodeUnderMaintenance || isInstalling || isTransferring;

    return (
        <ServerContentBlock title={'Console'}>
            {showBanner && (
                <Alert type={'warning'} className={'mb-6'}>
                    {isNodeUnderMaintenance
                        ? 'The node of this server is currently under maintenance and all actions are unavailable.'
                        : isInstalling
                        ? 'This server is currently running its installation process and most actions are unavailable.'
                        : 'This server is currently being transferred to another node and all actions are unavailable.'}
                </Alert>
            )}

            {/* 1. Terminal — full width, primary focus. */}
            <div className={'mb-4'}>
                <Spinner.Suspense>
                    <Console />
                </Spinner.Suspense>
            </div>

            {/* 2. Compact strip beneath the console: status / connection / disk + power. */}
            <div className={'grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6'}>
                <div className={'lg:col-span-3 min-w-0'}>
                    <ServerDetailsBlock />
                </div>
                <div className={'lg:col-span-1'}>
                    <Can action={['control.start', 'control.stop', 'control.restart']} matchAny>
                        <PowerButtons className={'grid grid-cols-3 gap-2'} />
                    </Can>
                </div>
            </div>

            {/* 3. Metrics — CPU / RAM / Network (grid or tabs, user toggle). */}
            <div className={'mb-6'}>
                <Spinner.Suspense>
                    <StatGraphs />
                </Spinner.Suspense>
            </div>

            <Features enabled={eggFeatures} />
        </ServerContentBlock>
    );
};

export default memo(ServerConsoleContainer, isEqual);
