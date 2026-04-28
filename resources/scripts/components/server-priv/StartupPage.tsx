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

// Startup page — wireframe layout (command preview + docker image picker
// + variables grid) backed by the real /startup API. Variables save
// inline on blur; Docker image swap saves immediately on change.
//
// Token highlighter for the resolved command line: java keyword in
// purple, flags in amber, ${VARIABLES} in green, jar paths in cyan.
// Stripped to just regex-classification — no tokenizer dependency.

const COMMAND_TOKEN_PATTERNS: Array<[RegExp, string]> = [
    // env-style variables — {{X}} and ${X}
    [/^(\{\{[^}]+\}\}|\$\{?[A-Z_][A-Z0-9_]*\}?)/, '#6ee7b7'],
    // jar / archive paths
    [/^(\S+\.(jar|zip|tar|gz))/, '#22d3ee'],
    // long-form flags
    [/^(--?[a-zA-Z][a-zA-Z0-9-]*(?:=\S+)?)/, '#fcd34d'],
    // -X jvm flags
    [/^(-X[A-Z][^\s]*)/, '#fcd34d'],
    // common keywords
    [/^(java|node|python|python3|dotnet|exec|sh|bash)\b/, '#c4b5fd'],
];

const tokenizeCommand = (cmd: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let rest = cmd;
    let key = 0;
    while (rest.length > 0) {
        // skip whitespace verbatim
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
            // grab the next word so we don't re-loop forever on unmatched chars
            const word = rest.match(/^\S+/)?.[0] ?? rest[0];
            out.push(<span key={key++} style={{ color: 'var(--text-soft)' }}>{word}</span>);
            rest = rest.slice(word.length);
        }
    }
    return out;
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
            <label
                style={{
                    display: 'block', fontSize: 13, fontWeight: 500,
                    color: 'var(--text)', marginBottom: 8,
                }}
            >
                {variable.name}
                {!variable.isEditable && (
                    <span
                        style={{
                            marginLeft: 8, fontSize: 10, padding: '1px 6px',
                            borderRadius: 4, background: 'rgba(255,255,255,0.05)',
                            color: 'var(--text-faint)', border: '1px solid var(--line)',
                        }}
                    >read-only</span>
                )}
            </label>
            {options ? (
                <select
                    value={value}
                    disabled={!variable.isEditable || saving}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    style={{
                        height: 34, width: '100%',
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid var(--line)',
                        borderRadius: 7, padding: '0 10px',
                        color: 'var(--text)',
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5,
                        outline: 'none',
                    }}
                >
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input
                    type={'text'}
                    value={value}
                    disabled={!variable.isEditable || saving}
                    placeholder={variable.defaultValue ?? ''}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                    style={{
                        height: 34, width: '100%',
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid var(--line)',
                        borderRadius: 7, padding: '0 10px',
                        color: 'var(--text)',
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5,
                        outline: 'none',
                    }}
                />
            )}
            <div className={'vh'}>
                {variable.description}
                {error && (
                    <span style={{ display: 'block', color: 'var(--pink)', marginTop: 4 }}>{error}</span>
                )}
                {saving && <span style={{ display: 'block', color: 'var(--text-faint)', marginTop: 4 }}>Saving…</span>}
                {savedAt && !saving && !error && Date.now() - savedAt < 4000 && (
                    <span style={{ display: 'block', color: 'var(--green)', marginTop: 4 }}>Saved.</span>
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

    if (!data) {
        return (
            <div className={'sub-main'}>
                <div className={'page-header'}>
                    <div>
                        <div className={'page-title'}>Startup</div>
                        <div className={'page-sub'}>
                            Loading startup configuration…
                        </div>
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
                        Resolved startup command, docker image, and editable variables for this server.
                    </div>
                </div>
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'play'} size={14} color={'var(--purple)'} />
                    <div>
                        <h3>Startup command</h3>
                        <span className={'desc'}>Read-only preview — variables resolve into this on launch.</span>
                    </div>
                </div>
                <div style={{ padding: 14 }}>
                    <pre
                        style={{
                            margin: 0, padding: '12px 14px',
                            background: '#07070a', border: '1px solid var(--line)',
                            borderRadius: 8,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 12.5,
                            lineHeight: 1.6,
                            color: 'var(--text-soft)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {tokenizeCommand(data.invocation)}
                    </pre>
                </div>
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'db'} size={14} color={'var(--blue)'} />
                    <div>
                        <h3>Docker image</h3>
                        <span className={'desc'}>
                            {isCustomImage
                                ? 'Set by an admin — cannot be changed from here.'
                                : 'The container image used to run this server.'}
                        </span>
                    </div>
                </div>
                <div style={{ padding: 14 }}>
                    {!isCustomImage && dockerImageEntries.length > 1 ? (
                        <select
                            value={dockerImage}
                            disabled={imageBusy}
                            onChange={handleDockerImage}
                            style={{
                                height: 36, width: '100%',
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid var(--line)',
                                borderRadius: 7, padding: '0 12px',
                                color: 'var(--text)',
                                fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                                outline: 'none',
                            }}
                        >
                            {dockerImageEntries.map(([label, value]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    ) : (
                        <code
                            style={{
                                display: 'block', padding: '10px 12px',
                                background: '#07070a', border: '1px solid var(--line)',
                                borderRadius: 7, fontSize: 12.5, color: 'var(--text-soft)',
                            }}
                        >
                            {dockerImage}
                        </code>
                    )}
                    {imageBusy && (
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
                            Saving image…
                        </div>
                    )}
                    {imageError && (
                        <div className={'notice warn'} style={{ marginTop: 10 }}>
                            <Icon name={'zap'} size={14} />
                            {imageError}
                        </div>
                    )}
                </div>
            </div>

            <div className={'section-card'}>
                <div className={'section-head'}>
                    <Icon name={'settings'} size={14} color={'var(--purple)'} />
                    <div>
                        <h3>Variables</h3>
                        <span className={'desc'}>
                            Edit server-side egg values. Changes save on blur and rebuild the startup command.
                        </span>
                    </div>
                </div>
                <div style={{ padding: 14 }}>
                    {data.variables.length === 0 ? (
                        <div
                            style={{
                                padding: 24, textAlign: 'center',
                                color: 'var(--text-faint)', fontSize: 13,
                            }}
                        >
                            No editable variables for this egg.
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: 12,
                            }}
                        >
                            {data.variables.map((v) => (
                                <VariableCard
                                    key={v.envVariable}
                                    variable={v}
                                    onSave={(value) => handleSaveVariable(v.envVariable, value)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StartupPage;
