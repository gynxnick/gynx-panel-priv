import * as React from 'react';
import { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { ServerEggVariable } from '@/api/server/types';
import getServerStartup from '@/api/swr/getServerStartup';
import setSelectedDockerImage from '@/api/server/setSelectedDockerImage';
import updateStartupVariable from '@/api/server/updateStartupVariable';
import { httpErrorToHuman } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import { Icon } from './Icon';

// Startup page — wireframe translation of startup.jsx, backed by the
// real /startup endpoint. Three section cards: command preview with
// styled $-prompt + token highlighting + copy, docker image picker
// (kv-grid layout), and a 2-col variables grid that saves on blur.

const COMMAND_TOKEN_PATTERNS: Array<[RegExp, string]> = [
    // env-style variables — {{X}} or ${X}
    [/^(\{\{[^}]+\}\}|\$\{?[A-Z_][A-Z0-9_]*\}?)/, '#6ee7b7'],
    // jar / archive paths
    [/^(\S+\.(jar|zip|tar|gz))/, '#22d3ee'],
    // long-form flags
    [/^(--?[a-zA-Z][a-zA-Z0-9-]*(?:=\S+)?)/, '#fcd34d'],
    // -X jvm flags / -D system props
    [/^(-[XD][A-Z][^\s]*)/, '#fcd34d'],
    // common keywords
    [/^(java|node|python|python3|dotnet|exec|sh|bash)\b/, '#c4b5fd'],
];

const tokenizeCommand = (cmd: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let rest = cmd;
    let key = 0;
    while (rest.length > 0) {
        const ws = rest.match(/^\s+/);
        if (ws) {
            out.push(ws[0]);
            rest = rest.slice(ws[0].length);
            continue;
        }
        let matched = false;
        for (const [re, color] of COMMAND_TOKEN_PATTERNS) {
            const m = rest.match(re);
            if (m) {
                out.push(<span key={key++} style={{ color }}>{m[1]}</span>);
                rest = rest.slice(m[1].length);
                matched = true;
                break;
            }
        }
        if (!matched) {
            const word = rest.match(/^\S+/)?.[0] ?? rest[0];
            out.push(<span key={key++} style={{ color: 'var(--text-soft)' }}>{word}</span>);
            rest = rest.slice(word.length);
        }
    }
    return out;
};

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

const VariableCard = ({
    variable, onSave,
}: {
    variable: ServerEggVariable;
    onSave: (value: string) => Promise<void>;
}) => {
    const [value, setValue] = useState(variable.serverValue ?? variable.defaultValue ?? '');
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setValue(variable.serverValue ?? variable.defaultValue ?? '');
    }, [variable.serverValue]);

    const isOptions = variable.rules.some((r) => r.startsWith('in:'));
    const options = isOptions
        ? (variable.rules.find((r) => r.startsWith('in:')) ?? '').replace(/^in:/, '').split(',')
        : null;
    const isNumeric = !isOptions && variable.rules.some((r) => /^(numeric|integer|min:\d|max:\d)/.test(r));

    const inputStyle: React.CSSProperties = {
        width: '100%', height: 32,
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid var(--line)',
        borderRadius: 6, padding: '0 8px',
        color: 'var(--text)',
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 12, outline: 'none',
    };

    const commit = async () => {
        if (!variable.isEditable) return;
        if (value === (variable.serverValue ?? variable.defaultValue ?? '')) return;
        setSaving(true);
        setError(null);
        try {
            await onSave(value);
            setSavedAt(Date.now());
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={'var-card'}>
            <div className={'vk'}>{variable.envVariable}</div>
            <div
                style={{
                    fontSize: 13, color: 'white',
                    fontFamily: "'Space Grotesk',sans-serif",
                    marginBottom: 6,
                }}
            >
                {variable.name}
                {!variable.isEditable && (
                    <span
                        style={{
                            marginLeft: 8, fontSize: 10, padding: '1px 6px',
                            borderRadius: 4, background: 'rgba(255,255,255,0.05)',
                            color: 'var(--text-faint)', border: '1px solid var(--line)',
                            fontFamily: "'Inter',sans-serif", fontWeight: 500,
                        }}
                    >read-only</span>
                )}
            </div>
            {options ? (
                <select
                    value={value}
                    disabled={!variable.isEditable || saving}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    style={inputStyle}
                >
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input
                    type={isNumeric ? 'number' : 'text'}
                    value={value}
                    disabled={!variable.isEditable || saving}
                    placeholder={variable.defaultValue ?? ''}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                    style={inputStyle}
                />
            )}
            <div className={'vh'}>
                {variable.description}
                {error && (
                    <span style={{ display: 'block', color: 'var(--pink)', marginTop: 4 }}>
                        {error}
                    </span>
                )}
                {saving && (
                    <span style={{ display: 'block', color: 'var(--text-faint)', marginTop: 4 }}>
                        Saving…
                    </span>
                )}
                {savedAt && !saving && !error && Date.now() - savedAt < 4000 && (
                    <span style={{ display: 'block', color: 'var(--green)', marginTop: 4 }}>
                        Saved.
                    </span>
                )}
            </div>
        </div>
    );
};

export const StartupPage = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const initialInvocation = ServerContext.useStoreState((s) => s.server.data!.invocation);
    const initialDockerImage = ServerContext.useStoreState((s) => s.server.data!.dockerImage);
    const initialVariables = ServerContext.useStoreState((s) => s.server.data!.variables);
    const setServerFromState = ServerContext.useStoreActions((a) => a.server.setServerFromState);
    const status = ServerContext.useStoreState((s) => s.status.value);
    const instance = ServerContext.useStoreState((s) => s.socket.instance);

    const { data, error, mutate } = getServerStartup(uuid, {
        invocation: initialInvocation,
        variables: initialVariables,
        dockerImages: { [initialDockerImage]: initialDockerImage },
    });

    useEffect(() => {
        mutate();
    }, []);

    const [imageBusy, setImageBusy] = useState(false);
    const [imageError, setImageError] = useState<string | null>(null);

    const handleDockerImage = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const image = e.currentTarget.value;
        setImageBusy(true);
        setImageError(null);
        try {
            await setSelectedDockerImage(uuid, image);
            setServerFromState((s) => ({ ...s, dockerImage: image }));
        } catch (err) {
            setImageError(httpErrorToHuman(err as Error));
        } finally {
            setImageBusy(false);
        }
    };

    const handleSaveVariable = async (key: string, value: string) => {
        const [updated, newCommand] = await updateStartupVariable(uuid, key, value);
        if (data) {
            const newVars = data.variables.map((v) => (v.envVariable === key ? updated : v));
            await mutate({ ...data, variables: newVars, invocation: newCommand }, false);
        }
        setServerFromState((s) => ({
            ...s,
            invocation: newCommand,
            variables: s.variables.map((v) => (v.envVariable === key ? updated : v)),
        }));
    };

    const handleApplyRestart = () => {
        if (!instance) return;
        if (!confirm('Restart the server now to apply startup changes?')) return;
        instance.send('set state', status === 'offline' ? 'start' : 'restart');
    };

    if (!data) {
        return (
            <div className={'sub-main'}>
                <div className={'page-header'}>
                    <div>
                        <div className={'page-title'}>Startup</div>
                        <div className={'page-sub'}>Loading startup configuration…</div>
                    </div>
                </div>
                {error ? (
                    <div className={'notice warn'}>
                        <Icon name={'zap'} size={14} />
                        {httpErrorToHuman(error)}
                    </div>
                ) : (
                    <div style={{ padding: 32, textAlign: 'center' }}>
                        <Spinner size={'large'} />
                    </div>
                )}
            </div>
        );
    }

    const dockerImageEntries = Object.entries(data.dockerImages);
    const dockerImage = initialDockerImage;
    const isCustomImage = !dockerImageEntries.some(
        ([, v]) => v.toLowerCase() === dockerImage.toLowerCase(),
    );

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Startup</div>
                    <div className={'page-sub'}>
                        Boot configuration. Changes apply on next restart.
                    </div>
                </div>
                <div className={'spacer'} />
                <button
                    className={'btn'}
                    onClick={handleApplyRestart}
                    disabled={!instance}
                    title={'Restart the server now to apply changes'}
                >
                    <Icon name={'restart'} size={13} />Apply & restart
                </button>
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'console'} size={14} color={'var(--blue)'} />
                    <div>
                        <h3>Startup command</h3>
                        <span className={'desc'}>
                            Resolved from your variables — read-only preview.
                        </span>
                    </div>
                    <div className={'spacer'} />
                    <span className={'tag compat'}>✓ valid</span>
                </div>
                <div style={{ padding: 14 }}>
                    <div
                        className={'conn-string'}
                        style={{
                            fontSize: 12.5, padding: 14, lineHeight: 1.7,
                            alignItems: 'flex-start',
                        }}
                    >
                        <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>$</span>
                        <span
                            className={'v'}
                            style={{
                                flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                color: 'var(--text)', overflow: 'visible',
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                        >
                            {tokenizeCommand(data.invocation)}
                        </span>
                        <button
                            className={'icon-btn'}
                            onClick={() => copyToClipboard(data.invocation)}
                            title={'Copy command'}
                            style={{ flexShrink: 0 }}
                        >
                            <Icon name={'copy'} size={12} />
                        </button>
                    </div>
                    <div
                        style={{
                            fontSize: 11.5, color: 'var(--text-faint)',
                            marginTop: 8,
                            fontFamily: "'JetBrains Mono',monospace",
                        }}
                    >
                        ⓘ Variables wrapped in{' '}
                        <span style={{ color: 'var(--purple)' }}>{`{{...}}`}</span> or{' '}
                        <span style={{ color: 'var(--purple)' }}>{`\${...}`}</span>{' '}
                        resolve from your config below.
                    </div>
                </div>
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'archive'} size={14} color={'var(--purple)'} />
                    <div>
                        <h3>Docker image</h3>
                        <span className={'desc'}>Container that wraps your server process.</span>
                    </div>
                </div>
                <div className={'kv-grid'}>
                    <label>
                        Image
                        <span className={'hint'}>
                            {isCustomImage
                                ? 'Set by an admin — cannot be changed from here.'
                                : 'Maintained by gynx — updated weekly.'}
                        </span>
                    </label>
                    {!isCustomImage && dockerImageEntries.length > 1 ? (
                        <select
                            value={dockerImage}
                            disabled={imageBusy}
                            onChange={handleDockerImage}
                        >
                            {dockerImageEntries.map(([label, value]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    ) : (
                        <input value={dockerImage} disabled readOnly />
                    )}
                </div>
                {imageBusy && (
                    <div
                        style={{
                            fontSize: 11, color: 'var(--text-faint)',
                            padding: '0 16px 12px',
                        }}
                    >
                        Saving image…
                    </div>
                )}
                {imageError && (
                    <div style={{ padding: '0 14px 14px' }}>
                        <div className={'notice warn'}>
                            <Icon name={'zap'} size={14} />
                            {imageError}
                        </div>
                    </div>
                )}
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'settings'} size={14} color={'var(--purple)'} />
                    <div>
                        <h3>Variables</h3>
                        <span className={'desc'}>
                            Inputs your startup command interpolates from. Save on blur.
                        </span>
                    </div>
                </div>
                <div
                    style={{
                        padding: 14,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 12,
                    }}
                >
                    {data.variables.length === 0 ? (
                        <div
                            style={{
                                gridColumn: '1 / -1',
                                padding: 24, textAlign: 'center',
                                color: 'var(--text-faint)', fontSize: 13,
                            }}
                        >
                            No editable variables for this egg.
                        </div>
                    ) : (
                        data.variables.map((v) => (
                            <VariableCard
                                key={v.envVariable}
                                variable={v}
                                onSave={(value) => handleSaveVariable(v.envVariable, value)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default StartupPage;
