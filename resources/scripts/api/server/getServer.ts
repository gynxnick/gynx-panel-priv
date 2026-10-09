import http, { FractalResponseData, FractalResponseList } from '@/api/http';
import { rawDataToServerAllocation, rawDataToServerEggVariable } from '@/api/transformers';
import { ServerEggVariable, ServerStatus } from '@/api/server/types';
import { Identifier } from '@/api/definitions';

export interface Allocation {
    id: number;
    ip: string;
    alias: string | null;
    port: number;
    notes: string | null;
    isDefault: boolean;
}

/**
 * Admin "view as user" context. Populated by the backend (in ServerController::index)
 * only when the caller is a root admin viewing a server they don't own and aren't a
 * subuser of. The frontend uses this to render the ImpersonationBanner.
 */
export interface ImpersonationContext {
    ownerUsername: string;
    ownerEmail: string;
}

export interface Server {
    /**
     * This value is determined by the presence of the `PTERODACTYL_USE_SERVER_IDENTIFIERS` environment
     * variable which changes what the API can respond with. It will eventually be removed and referenced
     * as the "identifier" key, but this allows users to slowly opt-in to these new URLs and trial it
     * as they wish.
     *
     * @deprecated this is the "uuid_short" which will be removed in 2.0, prefer use of "identifier"
     */
    id: string | Identifier<'serv'>;
    identifier: Identifier<'serv'>; // Set from "server_identifier" and should be used moving forward to reference a server.
    internalId: number | string;
    /**
     * Exists only to maintain support in cases where the short-uuid is necessary for server reference
     * and cannot be easily replaced with "identifier".
     *
     * @deprecated
     */
    __deprecatedUuidShort: string;
    uuid: string;
    name: string;
    node: string;
    isNodeUnderMaintenance: boolean;
    status: ServerStatus;
    sftpDetails: {
        ip: string;
        port: number;
    };
    invocation: string;
    dockerImage: string;
    description: string;
    limits: {
        memory: number;
        swap: number;
        disk: number;
        io: number;
        cpu: number;
        threads: string;
    };
    eggFeatures: string[];
    featureLimits: {
        databases: number;
        allocations: number;
        backups: number;
    };
    /** Backend-resolved flag for whether the Install tab should show.
     *  Computed from AddonGameRegistry::isInstallable($server) — admin
     *  per-egg overrides take precedence over pattern matching. */
    addonCapable?: boolean;
    /** Tab IDs the priv shell should HIDE for this server. Admin sets
     *  per-egg via Admin → Settings → Addon Games. */
    hiddenTabs?: string[];
    /** Addon types ('plugin' | 'mod' | 'modpack') this server's game
     *  supports. Filters the Plugins / Mods / Modpacks tabs inside
     *  the install page. */
    supportedAddonTypes?: string[];
    isTransferring: boolean;
    skipScripts: boolean;
    variables: ServerEggVariable[];
    allocations: Allocation[];
    /** Present only when the current viewer is a root admin viewing a
     *  server they don't own. Drives ImpersonationBanner. */
    impersonation?: ImpersonationContext;
}

export const rawDataToServerObject = ({ attributes: data }: FractalResponseData): Server => ({
    id: data.identifier,
    identifier: data.server_identifier,
    internalId: data.internal_id,
    __deprecatedUuidShort: data.__deprecated_uuid_short,
    uuid: data.uuid,
    name: data.name,
    node: data.node,
    isNodeUnderMaintenance: data.is_node_under_maintenance,
    status: data.status,
    invocation: data.invocation,
    dockerImage: data.docker_image,
    sftpDetails: {
        ip: data.sftp_details.ip,
        port: data.sftp_details.port,
    },
    description: data.description ? (data.description.length > 0 ? data.description : null) : null,
    limits: { ...data.limits },
    eggFeatures: data.egg_features || [],
    featureLimits: { ...data.feature_limits },
    addonCapable: typeof data.addon_capable === 'boolean' ? data.addon_capable : undefined,
    hiddenTabs: Array.isArray(data.hidden_tabs) ? data.hidden_tabs.map((t: unknown) => String(t)) : undefined,
    supportedAddonTypes: Array.isArray(data.supported_addon_types)
        ? data.supported_addon_types.map((t: unknown) => String(t))
        : undefined,
    isTransferring: data.is_transferring,
    skipScripts: data.skip_scripts,
    variables: ((data.relationships?.variables as FractalResponseList | undefined)?.data || []).map(
        rawDataToServerEggVariable
    ),
    allocations: ((data.relationships?.allocations as FractalResponseList | undefined)?.data || []).map(
        rawDataToServerAllocation
    ),
});

export default (uuid: string): Promise<[Server, string[]]> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${uuid}`)
            .then(({ data }) => {
                const server = rawDataToServerObject(data);
                // eslint-disable-next-line camelcase
                if (data.meta?.is_impersonating_owner) {
                    server.impersonation = {
                        ownerUsername: String(data.meta.owner_username ?? ''),
                        ownerEmail: String(data.meta.owner_email ?? ''),
                    };
                }
                resolve([
                    server,
                    // eslint-disable-next-line camelcase
                    data.meta?.is_server_owner ? ['*'] : data.meta?.user_permissions || [],
                ]);
            })
            .catch(reject);
    });
};
