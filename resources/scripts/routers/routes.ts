import React, { lazy } from 'react';
import {
    faTerminal,
    faFolder,
    faDatabase,
    faClock,
    faUsers,
    faArchive,
    faNetworkWired,
    faSlidersH,
    faCog,
    faHistory,
    faGamepad,
    faPuzzlePiece,
    faCubes,
    faBoxes,
    faWrench,
    faGlobe,
    IconDefinition,
} from '@fortawesome/free-solid-svg-icons';

import { Server } from '@/api/server/getServer';
import { getAddonCapabilities } from '@/helpers/serverKind';
import ServerConsole from '@/components/server-priv/ConsolePage';
import DatabasesContainer from '@/components/server-priv/DatabasesPage';
import ScheduleContainer from '@/components/server-priv/SchedulesPage';
import UsersContainer from '@/components/server-priv/UsersPage';
import BackupContainer from '@/components/server-priv/BackupsPage';
import NetworkContainer from '@/components/server-priv/NetworkPage';
import StartupContainer from '@/components/server-priv/StartupPage';
import FileManagerContainer from '@/components/server-priv/FilesPage';
import SettingsContainer from '@/components/server-priv/SettingsPage';
import EggSwitcherContainer from '@/components/server-priv/GamePage';
import PluginsContainer from '@/components/server/plugins/PluginsContainer';
import InstallerPage from '@/components/server-priv/InstallerPage';
import ModsContainer from '@/components/server/mods/ModsContainer';
import ModpacksContainer from '@/components/server/modpacks/ModpacksContainer';
import SubdomainsContainer from '@/components/server-priv/SubdomainsPage';
import ConfigEditorContainer from '@/components/server/configs/ConfigEditorContainer';
import AccountOverviewContainer from '@/components/account-priv/AccountPage';
import AccountApiContainer from '@/components/account-priv/ApiKeysPage';
import AccountSSHContainer from '@/components/account-priv/SshKeysPage';
import ActivityLogContainer from '@/components/account-priv/ActivityPage';
import ServerActivityLogContainer from '@/components/server/ServerActivityLogContainer';

const FileEditContainer = lazy(() => import('@/components/server-priv/FileEditPage'));
const ScheduleEditContainer = lazy(() => import('@/components/server/schedules/ScheduleEditContainer'));

/**
 * Server-nav tab grouping — new in gynx.
 *
 * Management  → the day-to-day actions customers take on a server.
 * Config      → infrequent but important (boot config, ownership / identity).
 * Monitoring  → read-only observability surfaces.
 *
 * The group labels render as small eyebrows between clusters in the nav strip;
 * ungrouped routes (legacy) fall back to flat rendering.
 */
export type ServerNavGroup = 'management' | 'config' | 'monitoring';

interface RouteDefinition {
    path: string;
    name: string | undefined;
    component: React.ComponentType;
    exact?: boolean;
    icon?: IconDefinition;
}

interface ServerRouteDefinition extends RouteDefinition {
    permission: string | string[] | null;
    group?: ServerNavGroup;
    /**
     * Optional egg-compat gate. If present and returns false for the current
     * server, the route is hidden from the sidebar. Hitting the URL directly
     * still resolves to the component — gate at the page level if you also
     * want to block direct access.
     */
    compatible?: (server: Server) => boolean;
}

interface Routes {
    account: RouteDefinition[];
    server: ServerRouteDefinition[];
}

export default {
    account: [
        { path: '/', name: 'Overview', component: AccountOverviewContainer, exact: true },
        { path: '/api', name: 'API Keys', component: AccountApiContainer },
        { path: '/ssh', name: 'SSH Keys', component: AccountSSHContainer },
        { path: '/activity', name: 'Activity', component: ActivityLogContainer },
    ],
    server: [
        // Management
        { path: '/',          permission: null,         name: 'Console',   icon: faTerminal,     group: 'management', component: ServerConsole, exact: true },
        { path: '/files',     permission: 'file.*',     name: 'Files',     icon: faFolder,       group: 'management', component: FileManagerContainer },
        { path: '/files/:action(edit|new)', permission: 'file.*', name: undefined, component: FileEditContainer },
        { path: '/databases', permission: 'database.*', name: 'Databases', icon: faDatabase,     group: 'management', component: DatabasesContainer },
        { path: '/install',   permission: null,             name: 'Install',  icon: faPuzzlePiece, group: 'management', component: InstallerPage },
        { path: '/plugins',   permission: 'addon.plugin.*', name: 'Plugins', icon: faPuzzlePiece, group: 'management', component: PluginsContainer,
          compatible: (s) => getAddonCapabilities(s).plugins },
        { path: '/mods',      permission: 'addon.mod.*',    name: 'Mods',    icon: faCubes,       group: 'management', component: ModsContainer,
          compatible: (s) => getAddonCapabilities(s).mods },
        { path: '/modpacks',  permission: 'addon.modpack.*', name: 'Modpacks', icon: faBoxes, group: 'management', component: ModpacksContainer,
          compatible: (s) => getAddonCapabilities(s).modpacks },
        { path: '/configs',   permission: 'file.*',          name: 'Configs',  icon: faWrench, group: 'management', component: ConfigEditorContainer },
        { path: '/domain',    permission: 'subdomain.*',     name: 'Domain',   icon: faGlobe, group: 'management', component: SubdomainsContainer },

        // Monitoring
        { path: '/schedules', permission: 'schedule.*', name: 'Schedules', icon: faClock,        group: 'monitoring', component: ScheduleContainer },
        { path: '/schedules/:id', permission: 'schedule.*', name: undefined, component: ScheduleEditContainer },
        { path: '/backups',   permission: 'backup.*',   name: 'Backups',   icon: faArchive,      group: 'monitoring', component: BackupContainer },
        { path: '/activity',  permission: 'activity.*', name: 'Activity',  icon: faHistory,      group: 'monitoring', component: ServerActivityLogContainer },

        // Config
        { path: '/game',      permission: 'control.egg-switch', name: 'Game', icon: faGamepad, group: 'config', component: EggSwitcherContainer },
        { path: '/users',     permission: 'user.*',     name: 'Users',     icon: faUsers,        group: 'config',     component: UsersContainer },
        { path: '/network',   permission: 'allocation.*', name: 'Network', icon: faNetworkWired, group: 'config',     component: NetworkContainer },
        { path: '/startup',   permission: 'startup.*',  name: 'Startup',   icon: faSlidersH,     group: 'config',     component: StartupContainer },
        { path: '/settings',  permission: ['settings.*', 'file.sftp'], name: 'Settings', icon: faCog, group: 'config', component: SettingsContainer },
    ],
} as Routes;
