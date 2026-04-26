import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCog,
    faCheck,
    faExclamationTriangle,
    faFileAlt,
    faSave,
    faSyncAlt,
} from '@fortawesome/free-solid-svg-icons';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import { ServerContext } from '@/state/server';
import { EmptyState } from '@/components/gynx';
import CodemirrorEditor from '@/components/elements/CodemirrorEditor';
import getFileContents from '@/api/server/files/getFileContents';
import saveFileContents from '@/api/server/files/saveFileContents';
import loadDirectory from '@/api/server/files/loadDirectory';
import {
    ConfigEntry,
    GROUP_LABELS,
    GROUP_ORDER,
    KNOWN_CONFIGS,
} from './known-configs';
import { validate, ValidationError } from './validators';

// ---- scaffolding ---------------------------------------------------------

const Layout = styled.div`
    ${tw`grid gap-4`};
    /* Slim the rail to 240px on standard widths; expand it back on huge
       monitors where there's room for both. The editor pane gets the
       remaining space (1fr). */
    grid-template-columns: 240px minmax(0, 1fr);

    @media (min-width: 1600px) {
        grid-template-columns: 280px minmax(0, 1fr);
    }
    @media (max-width: 900px) {
        grid-template-columns: 1fr;
    }
`;

const Rail = styled.aside`
    ${tw`rounded-xl overflow-hidden`};
    background: var(--gynx-surface);
    border: 1px solid var(--gynx-edge);
    max-height: calc(100vh - 10rem);
    overflow-y: auto;
    position: sticky;
    top: 5rem;
`;

const GroupHeader = styled.div`
    ${tw`px-4 pt-4 pb-1 text-xs uppercase`};
    color: var(--gynx-text-mute);
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.08em;
`;

const RailButton = styled.button<{ $active: boolean; $disabled: boolean }>`
    ${tw`w-full flex items-center gap-3 px-4 py-2.5 cursor-pointer`};
    background: ${({ $active }) => ($active ? 'rgba(124, 58, 237, 0.12)' : 'transparent')};
    border: 0;
    border-left: 3px solid ${({ $active }) => ($active ? '#C4B5FD' : 'transparent')};
    color: ${({ $active, $disabled }) =>
        $disabled ? 'var(--gynx-text-mute)' : $active ? 'var(--gynx-text)' : 'var(--gynx-text-dim)'};
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    opacity: ${({ $disabled }) => ($disabled ? 0.55 : 1)};
    pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};
    transition: background .15s ease, color .15s ease;
    text-align: left;

    &:hover {
        background: ${({ $active }) => ($active ? 'rgba(124, 58, 237, 0.16)' : 'rgba(255, 255, 255, 0.03)')};
        color: var(--gynx-text);
    }
`;

const RailIcon = styled.div<{ $exists: boolean }>`
    ${tw`flex-shrink-0 flex items-center justify-center`};
    width: 20px;
    color: ${({ $exists }) => ($exists ? '#C4B5FD' : 'var(--gynx-text-mute)')};
`;

const RailBody = styled.div`
    ${tw`flex-1 min-w-0`};

    strong {
        display: block;
        font-weight: 500;
        color: inherit;
    }
    span {
        display: block;
        font-size: 11px;
        color: var(--gynx-text-mute);
        margin-top: 2px;
    }
`;

const Panel = styled.section`
    ${tw`rounded-xl`};
    background: var(--gynx-surface);
    border: 1px solid var(--gynx-edge);
    display: flex;
    flex-direction: column;
    /* Use most of the viewport height — config editing wants vertical room
       more than anything else. min-w:0 on the grid track lets the editor
       shrink properly inside flex without overflow on narrow viewports. */
    min-height: calc(100vh - 10rem);
    min-width: 0;
`;

const PanelHeader = styled.header`
    ${tw`flex items-center gap-3 px-4 py-3`};
    border-bottom: 1px solid var(--gynx-edge);
`;

const Breadcrumb = styled.code`
    ${tw`flex-1 text-sm truncate`};
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    color: var(--gynx-text);
`;

const Pill = styled.span<{ $ok: boolean; $dirty: boolean }>`
    ${tw`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full`};
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    color: ${({ $ok, $dirty }) => ($dirty ? '#FCD34D' : $ok ? '#34D399' : '#F87171')};
    background: ${({ $ok, $dirty }) =>
        $dirty
            ? 'rgba(252, 211, 77, 0.1)'
            : $ok
            ? 'rgba(52, 211, 153, 0.1)'
            : 'rgba(248, 113, 113, 0.1)'};
    border: 1px solid ${({ $ok, $dirty }) =>
        $dirty
            ? 'rgba(252, 211, 77, 0.35)'
            : $ok
            ? 'rgba(52, 211, 153, 0.35)'
            : 'rgba(248, 113, 113, 0.35)'};
`;

const ActionButton = styled.button<{ $primary?: boolean; $disabled?: boolean }>`
    ${tw`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer`};
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
    border: 1px solid ${({ $primary }) => ($primary ? 'transparent' : 'var(--gynx-edge-2)')};
    background: ${({ $primary }) =>
        $primary ? 'linear-gradient(135deg, #7C3AED 0%, #9B5BFF 100%)' : 'transparent'};
    color: ${({ $primary }) => ($primary ? '#fff' : 'var(--gynx-text-dim)')};
    opacity: ${({ $disabled }) => ($disabled ? 0.55 : 1)};
    pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};
    transition: box-shadow .15s ease, transform .15s ease, color .15s ease, border-color .15s ease;

    &:hover {
        color: ${({ $primary }) => ($primary ? '#fff' : 'var(--gynx-text)')};
        box-shadow: ${({ $primary }) =>
            $primary ? '0 8px 20px -8px rgba(124, 58, 237, 0.55)' : 'none'};
        border-color: ${({ $primary }) => ($primary ? 'transparent' : 'rgba(124, 58, 237, 0.4)')};
        transform: ${({ $primary }) => ($primary ? 'translateY(-1px)' : 'none')};
    }
`;

const EditorSlot = styled.div`
    flex: 1 1 auto;
    padding: 12px;
    min-width: 0;
    min-height: 0;
    display: flex;

    > div {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
    }

    /* CodeMirror needs an explicit height to fill the slot — without it
       the editor renders at a default ~300px and the rest of the slot
       paints as empty space. */
    .CodeMirror {
        height: 100% !important;
        flex: 1 1 auto;
        font-size: 14px;
        line-height: 1.55;
    }
    .CodeMirror-scroll {
        height: 100%;
    }
`;

const Diagnostics = styled.div<{ $empty: boolean }>`
    ${tw`px-4 py-2 text-xs`};
    border-top: 1px solid var(--gynx-edge);
    background: ${({ $empty }) =>
        $empty ? 'rgba(52, 211, 153, 0.04)' : 'rgba(248, 113, 113, 0.04)'};
    color: ${({ $empty }) => ($empty ? 'var(--gynx-text-dim)' : 'var(--gynx-text)')};
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    max-height: 150px;
    overflow-y: auto;
`;

const ErrorRow = styled.div<{ $severity: 'error' | 'warn' }>`
    ${tw`py-1 flex items-start gap-2`};
    color: ${({ $severity }) => ($severity === 'error' ? '#F87171' : '#FCD34D')};
`;

// ---- component ------------------------------------------------------------

export default () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const { clearFlashes, clearAndAddHttpError, addFlash } = useFlash();

    const [loading, setLoading] = useState(true);
    const [existing, setExisting] = useState<Set<string>>(new Set());

    const [active, setActive] = useState<ConfigEntry | null>(null);
    const [initialContent, setInitialContent] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [mode, setMode] = useState<string>('text/plain');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    // `fetchContent` callback registered by CodemirrorEditor — we call it
    // to pull the current buffer out of the editor at save time.
    let getEditorValue: null | (() => Promise<string>) = null;

    // ---- discover which known configs actually exist -----------------------
    // We probe three places: /, /config/, and /plugins/ (for plugin YAMLs a
    // user might want to tweak). For MVP we only look at the root + /config/.

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        clearFlashes('configs');

        const dirs = Array.from(new Set(
            KNOWN_CONFIGS.map((c) => c.path.substring(0, c.path.lastIndexOf('/')) || '/'),
        ));

        Promise.all(
            dirs.map((dir) =>
                loadDirectory(uuid, dir === '' ? '/' : dir)
                    .then((entries) => ({ dir, names: entries.filter((e) => e.isFile).map((e) => e.name) }))
                    .catch(() => ({ dir, names: [] })),
            ),
        ).then((results) => {
            if (!mounted) return;
            const found = new Set<string>();
            for (const r of results) {
                const prefix = r.dir === '/' ? '' : r.dir;
                for (const n of r.names) {
                    found.add(`${prefix}/${n}`);
                }
            }
            setExisting(found);
            setLoading(false);
        });

        return () => { mounted = false; };
    }, [uuid]);

    // ---- grouped rail --------------------------------------------------------

    const grouped = useMemo(() => {
        const map: Record<string, ConfigEntry[]> = {};
        for (const e of KNOWN_CONFIGS) {
            map[e.group] = map[e.group] || [];
            map[e.group].push(e);
        }
        return map;
    }, []);

    // ---- load a file into the editor ----------------------------------------

    const open = useCallback(async (entry: ConfigEntry) => {
        if (!existing.has(entry.path)) return;
        clearFlashes('configs');
        setActive(entry);
        setEditing(true);
        setContent('');
        setInitialContent('');
        setMode(entry.mime);
        try {
            const text = await getFileContents(uuid, entry.path);
            setInitialContent(text);
            setContent(text);
        } catch (e) {
            clearAndAddHttpError({ key: 'configs', error: e });
            setActive(null);
        } finally {
            setEditing(false);
        }
    }, [uuid, existing]);

    const onSave = useCallback(async () => {
        if (!active) return;
        try {
            const value = getEditorValue ? await getEditorValue() : content;
            setSaving(true);
            clearFlashes('configs');
            await saveFileContents(uuid, active.path, value);
            setInitialContent(value);
            setContent(value);
            addFlash({
                key: 'configs',
                type: 'success',
                message: `Saved ${active.label}. Restart the server to apply.`,
            });
        } catch (e) {
            clearAndAddHttpError({ key: 'configs', error: e });
        } finally {
            setSaving(false);
        }
    }, [active, uuid, content]);

    const onRevert = useCallback(() => {
        if (!active) return;
        setContent(initialContent);
        // Trigger a re-initialization of the editor by nudging state.
        setActive({ ...active });
    }, [active, initialContent]);

    const errors = useMemo<ValidationError[]>(
        () => (active ? validate(content, active.format) : []),
        [content, active],
    );
    const isDirty = content !== initialContent;

    // ---- render --------------------------------------------------------------

    if (loading) {
        return (
            <ServerContentBlock title={'Configs'}>
                <Spinner size={'large'} centered />
            </ServerContentBlock>
        );
    }

    const anyFound = existing.size > 0;

    return (
        <ServerContentBlock title={'Configs'} wide>
            <FlashMessageRender byKey={'configs'} css={tw`mb-4`} />

            {!anyFound ? (
                <EmptyState
                    size={'page'}
                    icon={<FontAwesomeIcon icon={faCog} />}
                    title={'No known config files found'}
                    body={
                        'None of the well-known Minecraft config files were detected in / or /config. ' +
                        'Use the File Manager to edit custom configs.'
                    }
                />
            ) : (
                <Layout>
                    <Rail>
                        {GROUP_ORDER.map((group) => {
                            const items = (grouped[group] || []).filter((e) => existing.has(e.path));
                            if (items.length === 0) return null;
                            return (
                                <div key={group}>
                                    <GroupHeader>{GROUP_LABELS[group]}</GroupHeader>
                                    {items.map((e) => {
                                        const exists = existing.has(e.path);
                                        const isActive = active?.path === e.path;
                                        return (
                                            <RailButton
                                                key={e.path}
                                                type={'button'}
                                                $active={isActive}
                                                $disabled={!exists}
                                                onClick={() => open(e)}
                                            >
                                                <RailIcon $exists={exists}>
                                                    <FontAwesomeIcon icon={faFileAlt} />
                                                </RailIcon>
                                                <RailBody>
                                                    <strong>{e.label}</strong>
                                                    <span>{e.description}</span>
                                                </RailBody>
                                            </RailButton>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </Rail>

                    <Panel>
                        {!active ? (
                            <EmptyState
                                size={'page'}
                                icon={<FontAwesomeIcon icon={faCog} />}
                                title={'Pick a config'}
                                body={'Choose a file from the left to start editing. Errors are highlighted as you type.'}
                            />
                        ) : (
                            <>
                                <PanelHeader>
                                    <Breadcrumb>{active.path}</Breadcrumb>
                                    <Pill $ok={errors.filter((e) => e.severity === 'error').length === 0} $dirty={isDirty}>
                                        {isDirty ? (
                                            <><FontAwesomeIcon icon={faExclamationTriangle} /> unsaved</>
                                        ) : errors.some((e) => e.severity === 'error') ? (
                                            <><FontAwesomeIcon icon={faExclamationTriangle} /> {errors.length} issue{errors.length > 1 ? 's' : ''}</>
                                        ) : (
                                            <><FontAwesomeIcon icon={faCheck} /> valid</>
                                        )}
                                    </Pill>
                                    <ActionButton type={'button'} onClick={onRevert} $disabled={!isDirty || saving}>
                                        <FontAwesomeIcon icon={faSyncAlt} /> revert
                                    </ActionButton>
                                    <ActionButton type={'button'} onClick={onSave} $primary $disabled={!isDirty || saving}>
                                        <FontAwesomeIcon icon={faSave} /> {saving ? 'saving…' : 'save'}
                                    </ActionButton>
                                </PanelHeader>

                                {editing ? (
                                    <div css={tw`py-12`}><Spinner centered /></div>
                                ) : (
                                    <EditorSlot>
                                        <CodemirrorEditor
                                            key={active.path}
                                            mode={mode}
                                            initialContent={initialContent}
                                            onModeChanged={setMode}
                                            fetchContent={(cb) => { getEditorValue = cb; }}
                                            onContentSaved={() => onSave()}
                                            onChange={setContent}
                                        />
                                    </EditorSlot>
                                )}

                                <Diagnostics $empty={errors.length === 0}>
                                    {errors.length === 0 ? (
                                        <span>no issues · {active.format} · ctrl+s to save</span>
                                    ) : (
                                        errors.slice(0, 20).map((err, i) => (
                                            <ErrorRow key={i} $severity={err.severity}>
                                                <span style={{ width: 44, flexShrink: 0 }}>line {err.line}</span>
                                                <span style={{ flex: 1 }}>{err.message}</span>
                                            </ErrorRow>
                                        ))
                                    )}
                                </Diagnostics>
                            </>
                        )}
                    </Panel>
                </Layout>
            )}
        </ServerContentBlock>
    );
};
