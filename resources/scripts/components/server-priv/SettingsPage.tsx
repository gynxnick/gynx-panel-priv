import * as React from 'react';
import { useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import { ServerContext } from '@/state/server';
import { ApplicationStore } from '@/state';
import renameServer from '@/api/server/renameServer';
import reinstallServer from '@/api/server/reinstallServer';
import { ip } from '@/lib/formatters';
import { httpErrorToHuman } from '@/api/http';
import { Icon } from './Icon';

// Settings page — wireframe layout (identity / connection / gameplay
// notice / danger zone) backed by the real client API set:
//   - renameServer for identity
//   - SFTP details + node + uuid (read-only display)
//   - reinstallServer in danger zone
//
// Sections from the wireframe that map to admin-only or file-edit
// territory (MOTD, region select, gameplay toggles, telemetry, server
// icon, reset world, transfer ownership, delete server) are either
// dropped or replaced with an honest pointer — gameplay flags get a
// "open Files to edit server.properties" callout instead of fake
// toggles that wouldn't do anything.

const copyToClipboard = async (text: string) => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    } catch (e) {
        console.error('copy failed', e);
    }
};

export const SettingsPage = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const id = ServerContext.useStoreState((s) => s.server.data!.id);
    const node = ServerContext.useStoreState((s) => s.server.data!.node);
    const sftpDetails = ServerContext.useStoreState((s) => s.server.data!.sftpDetails);
    const description = ServerContext.useStoreState((s) => s.server.data!.description);
    const initialName = ServerContext.useStoreState((s) => s.server.data!.name);
    const setServerFromState = ServerContext.useStoreActions((a) => a.server.setServerFromState);
    const username = useStoreState((state: ApplicationStore) => state.user.data!.username);

    const history = useHistory();
    const match = useRouteMatch<{ id: string }>();

    const [name, setName] = useState(initialName);
    const [desc, setDesc] = useState(description);
    const [savingIdentity, setSavingIdentity] = useState(false);
    const [identityError, setIdentityError] = useState<string | null>(null);
    const [identitySavedAt, setIdentitySavedAt] = useState<number | null>(null);

    const [reinstalling, setReinstalling] = useState(false);
    const [reinstallError, setReinstallError] = useState<string | null>(null);

    const sftpAddress = `sftp://${ip(sftpDetails.ip)}:${sftpDetails.port}`;
    const sftpUser = `${username}.${id}`;
    const sftpLaunch = `sftp://${sftpUser}@${ip(sftpDetails.ip)}:${sftpDetails.port}`;

    const handleSaveIdentity = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setIdentityError('Server name cannot be empty.');
            return;
        }
        if (trimmed === initialName && desc === description) {
            return;
        }
        setSavingIdentity(true);
        setIdentityError(null);
        try {
            await renameServer(uuid, trimmed, desc);
            setServerFromState((s) => ({ ...s, name: trimmed, description: desc }));
            setIdentitySavedAt(Date.now());
        } catch (e) {
            setIdentityError(httpErrorToHuman(e as Error));
        } finally {
            setSavingIdentity(false);
        }
    };

    const handleReinstall = async () => {
        if (!confirm(
            'Reinstall this server?\n\n' +
            'Container files are wiped and the egg is re-applied. World ' +
            'data is preserved. The server will be unavailable while ' +
            'this runs.',
        )) return;
        setReinstalling(true);
        setReinstallError(null);
        try {
            await reinstallServer(uuid);
            // success: the panel will switch to "installing" state via
            // the WebSocket — nothing to do client-side beyond signaling.
        } catch (e) {
            setReinstallError(httpErrorToHuman(e as Error));
        } finally {
            setReinstalling(false);
        }
    };

    const identityDirty = name.trim() !== initialName || desc !== description;

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Settings</div>
                    <div className={'page-sub'}>
                        Server identity, connection details, and the danger zone.
                    </div>
                </div>
                <div className={'spacer'} />
                <button
                    className={'btn btn-primary'}
                    onClick={handleSaveIdentity}
                    disabled={!identityDirty || savingIdentity}
                >
                    <Icon name={'save'} size={13} />
                    {savingIdentity ? 'Saving…' : 'Save changes'}
                </button>
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'zap'} size={14} color={'var(--blue)'} />
                    <div>
                        <h3>Identity</h3>
                        <span className={'desc'}>How this server appears in the panel.</span>
                    </div>
                    {identitySavedAt && Date.now() - identitySavedAt < 4000 && (
                        <>
                            <div className={'spacer'} />
                            <span className={'tag compat'}>saved</span>
                        </>
                    )}
                </div>
                <div className={'kv-grid'}>
                    <label>
                        Server name
                        <span className={'hint'}>Internal name in the panel.</span>
                    </label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={'survival-smp'}
                    />

                    <label>
                        Description
                        <span className={'hint'}>Short note about the server. Optional.</span>
                    </label>
                    <textarea
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        placeholder={'A friendly survival server.'}
                    />

                    <label>
                        Region
                        <span className={'hint'}>Datacenter the server runs in. Move with care — incurs migration time.</span>
                    </label>
                    <input value={node || '—'} disabled readOnly />
                </div>
                {identityError && (
                    <div style={{ padding: '0 14px 14px' }}>
                        <div className={'notice warn'}>
                            <Icon name={'zap'} size={14} />
                            {identityError}
                        </div>
                    </div>
                )}
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'globe'} size={14} color={'var(--blue)'} />
                    <div>
                        <h3>Connection &amp; SFTP</h3>
                        <span className={'desc'}>For file access via your SFTP client.</span>
                    </div>
                </div>
                <div className={'kv-grid'}>
                    <label>
                        SFTP address
                        <span className={'hint'}>Server hostname + port for sftp connections.</span>
                    </label>
                    <div className={'row gap-8'} style={{ gap: 8 }}>
                        <input value={sftpAddress} readOnly disabled style={{ flex: 1 }} />
                        <button className={'btn btn-sm'} onClick={() => copyToClipboard(sftpAddress)}>
                            <Icon name={'copy'} size={11} />Copy
                        </button>
                    </div>

                    <label>
                        SFTP username
                        <span className={'hint'}>Your panel username + this server's ID.</span>
                    </label>
                    <div className={'row gap-8'} style={{ gap: 8 }}>
                        <input value={sftpUser} readOnly disabled style={{ flex: 1 }} />
                        <button className={'btn btn-sm'} onClick={() => copyToClipboard(sftpUser)}>
                            <Icon name={'copy'} size={11} />Copy
                        </button>
                    </div>

                    <label>
                        SFTP password
                        <span className={'hint'}>Tied to your account password — change it from your account page.</span>
                    </label>
                    <input value={'••••••••••••••••'} readOnly disabled />

                    <label>
                        Server ID
                        <span className={'hint'}>UUID — useful when reporting issues.</span>
                    </label>
                    <div className={'row gap-8'} style={{ gap: 8 }}>
                        <input value={uuid} readOnly disabled style={{ flex: 1 }} />
                        <button className={'btn btn-sm'} onClick={() => copyToClipboard(uuid)}>
                            <Icon name={'copy'} size={11} />Copy
                        </button>
                    </div>
                </div>
                <div style={{ padding: '0 16px 16px' }}>
                    <a href={sftpLaunch}>
                        <button className={'btn btn-primary btn-sm'}>
                            <Icon name={'play'} size={11} />Launch SFTP client
                        </button>
                    </a>
                </div>
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'play'} size={14} color={'var(--purple)'} />
                    <div>
                        <h3>Gameplay</h3>
                        <span className={'desc'}>
                            PvP, whitelist, max players, view distance, etc.
                        </span>
                    </div>
                </div>
                <div style={{ padding: 16 }}>
                    <div className={'notice'}>
                        <Icon name={'sparkles'} size={14} />
                        <div style={{ flex: 1 }}>
                            Gameplay flags live in <span style={{ color: 'white', fontFamily: "'JetBrains Mono',monospace" }}>server.properties</span>.
                            Open the file from <strong style={{ color: 'var(--text)' }}>Files</strong> and edit it directly — the
                            wrapper picks up changes on the next restart.
                        </div>
                        <button
                            className={'btn btn-sm'}
                            onClick={() =>
                                history.push(
                                    `/server/${match.params.id}/files/edit#/server.properties`,
                                )
                            }
                        >
                            <Icon name={'folder'} size={11} />Open server.properties
                        </button>
                    </div>
                </div>
            </div>

            <div className={'section-card'} style={{ borderColor: 'rgba(236,72,153,0.3)' }}>
                <div className={'section-head'} style={{ background: 'rgba(236,72,153,0.06)' }}>
                    <Icon name={'skull'} size={14} color={'var(--pink)'} />
                    <div>
                        <h3 style={{ color: '#fbcfe8' }}>Danger zone</h3>
                        <span className={'desc'}>
                            These actions cannot be undone. Take a backup first.
                        </span>
                    </div>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div
                        className={'row gap-8'}
                        style={{ padding: '10px 4px', gap: 12 }}
                    >
                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    fontSize: 13.5, color: 'white',
                                    fontFamily: "'Space Grotesk',sans-serif", fontWeight: 500,
                                }}
                            >
                                Reinstall server
                            </div>
                            <div
                                style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}
                            >
                                Wipes container files and re-applies the egg. World data is preserved.
                            </div>
                        </div>
                        <button
                            className={'btn btn-danger btn-sm'}
                            onClick={handleReinstall}
                            disabled={reinstalling}
                        >
                            {reinstalling ? 'Reinstalling…' : 'Reinstall'}
                        </button>
                    </div>

                    <div
                        className={'row gap-8'}
                        style={{ padding: '10px 4px', gap: 12, borderTop: '1px solid var(--line)' }}
                    >
                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    fontSize: 13.5, color: 'var(--text)',
                                    fontFamily: "'Space Grotesk',sans-serif", fontWeight: 500,
                                }}
                            >
                                Transfer ownership / Delete server
                            </div>
                            <div
                                style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}
                            >
                                Admin-only operations — contact gynx support to request a transfer or delete.
                            </div>
                        </div>
                        <button className={'btn btn-sm'} disabled>Contact support</button>
                    </div>
                </div>
                {reinstallError && (
                    <div style={{ padding: '0 16px 16px' }}>
                        <div className={'notice warn'}>
                            <Icon name={'zap'} size={14} />
                            {reinstallError}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
