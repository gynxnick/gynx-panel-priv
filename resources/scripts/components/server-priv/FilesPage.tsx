import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useHistory, useLocation, useRouteMatch } from 'react-router-dom';
import axios from 'axios';
import { ServerContext } from '@/state/server';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import { hashToPath, encodePathSegments } from '@/helpers';
import { bytesToString } from '@/lib/formatters';
import { httpErrorToHuman } from '@/api/http';
import { FileObject } from '@/api/server/files/loadDirectory';
import deleteFiles from '@/api/server/files/deleteFiles';
import renameFiles from '@/api/server/files/renameFiles';
import createDirectory from '@/api/server/files/createDirectory';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl';
import Spinner from '@/components/elements/Spinner';
import { Icon, IconName } from './Icon';

// Files page — wireframe layout backed by real Pterodactyl files API.
// Click folder → navigate. Click file → legacy editor. Per-row rename
// (pencil) + delete (trash). Multi-select via checkboxes; mass-actions
// bar at the top of the table when ≥1 row is selected. New file / new
// folder via the toolbar buttons. Upload + search are still placeholders
// (uploads need a dropzone; search needs a recursive walk).

const sortFiles = (files: FileObject[]): FileObject[] => {
    return [...files]
        .sort((a, b) => a.name.localeCompare(b.name))
        .sort((a, b) => (a.isFile === b.isFile ? 0 : a.isFile ? 1 : -1));
};

const iconForFile = (f: FileObject): IconName => {
    const n = f.name.toLowerCase();
    if (n.endsWith('.json') && (n.includes('ops') || n.includes('whitelist'))) return 'users';
    if (n.includes('banned')) return 'skull';
    if (n.endsWith('.jar')) return 'play';
    if (n.endsWith('.properties') || n.endsWith('.yml') || n.endsWith('.yaml')) return 'settings';
    return 'settings';
};

const formatRelative = (date: Date): string => {
    const ms = Date.now() - date.getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
};

interface CrumbsProps {
    directory: string;
    baseUrl: string;
}

const Crumbs = ({ directory, baseUrl }: CrumbsProps) => {
    const segments = directory.split('/').filter(Boolean);
    return (
        <div className={'crumbs'}>
            <NavLink className={'seg-crumb'} to={`${baseUrl}#/`}>
                <Icon name={'folder'} size={12} />/
            </NavLink>
            {segments.map((seg, i) => {
                const path = '/' + segments.slice(0, i + 1).join('/');
                const isLast = i === segments.length - 1;
                return (
                    <React.Fragment key={i}>
                        <span className={'sep'}>/</span>
                        {isLast ? (
                            <span className={'seg-crumb'} style={{ color: 'white' }}>{seg}</span>
                        ) : (
                            <NavLink className={'seg-crumb'} to={`${baseUrl}#${encodePathSegments(path)}`}>
                                {seg}
                            </NavLink>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export const FilesPage = () => {
    const location = useLocation();
    const history = useHistory();
    const match = useRouteMatch<{ id: string }>();
    const baseUrl = `/server/${match.params.id}/files`;
    const editUrl = `/server/${match.params.id}/files/edit`;
    const newUrl = `/server/${match.params.id}/files/new`;

    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const directory = ServerContext.useStoreState((s) => s.files.directory);
    const setDirectory = ServerContext.useStoreActions((a) => a.files.setDirectory);
    const setSelectedFiles = ServerContext.useStoreActions((a) => a.files.setSelectedFiles);

    useEffect(() => {
        setSelectedFiles([]);
        setDirectory(hashToPath(location.hash));
    }, [location.hash]);

    const { data: files, error, mutate } = useFileManagerSwr();

    useEffect(() => {
        mutate();
    }, [directory]);

    const sortedFiles = useMemo(() => (files ? sortFiles(files) : []), [files]);
    const folders = sortedFiles.filter((f) => !f.isFile);

    // Local selection set keyed by file name (server uses name + dir for ops).
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);

    // Filter input — toggled by the "Search files" button. Filters
    // current-directory entries client-side; recursive walks are out of
    // scope (would need a backend search endpoint).
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterText, setFilterText] = useState('');
    const filterInputRef = useRef<HTMLInputElement>(null);

    // Upload state — file input is hidden, button triggers click().
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);

    // Reset selection + filter when directory changes.
    useEffect(() => {
        setSelected(new Set());
        setFilterText('');
    }, [directory]);

    // Focus the filter input when it opens.
    useEffect(() => {
        if (filterOpen) filterInputRef.current?.focus();
    }, [filterOpen]);

    const toggleSelect = (name: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };
    const toggleSelectAll = () => {
        setSelected((prev) => {
            // Operate on the currently-visible list so a filter narrows what
            // "select all" actually selects.
            const visibleNames = new Set(visibleFiles.map((f) => f.name));
            const allVisibleSelected = visibleFiles.every((f) => prev.has(f.name));
            if (allVisibleSelected && visibleFiles.length > 0) {
                const next = new Set(prev);
                visibleFiles.forEach((f) => next.delete(f.name));
                return next;
            }
            const next = new Set(prev);
            visibleFiles.forEach((f) => next.add(f.name));
            return next;
        });
    };

    const linkForFile = (f: FileObject): string => {
        const targetDir = directory.replace(/\/+$/, '') + '/' + f.name;
        if (f.isFile) {
            return `${editUrl}#${encodePathSegments(targetDir)}`;
        }
        return `${baseUrl}#${encodePathSegments(targetDir)}`;
    };

    const handleNewFolder = async () => {
        const name = prompt('Folder name:', '');
        if (!name) return;
        try {
            setBusy(true);
            await createDirectory(uuid, directory, name);
            await mutate();
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusy(false);
        }
    };

    const handleNewFile = () => {
        // The legacy /files/new screen has the full editor + filename input.
        // Better UX than spawning an empty file inline and re-navigating.
        history.push(newUrl);
    };

    const handleRename = async (f: FileObject) => {
        const next = prompt(`Rename "${f.name}" to:`, f.name);
        if (!next || next === f.name) return;
        try {
            setBusy(true);
            await renameFiles(uuid, directory, [{ from: f.name, to: next }]);
            await mutate();
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteOne = async (f: FileObject) => {
        if (!confirm(`Delete "${f.name}"? This cannot be undone.`)) return;
        try {
            setBusy(true);
            await deleteFiles(uuid, directory, [f.name]);
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(f.name);
                return next;
            });
            await mutate();
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusy(false);
        }
    };

    const handleUpload = async (filesList: FileList) => {
        if (!filesList.length) return;
        try {
            setBusy(true);
            const uploadUrl = await getFileUploadUrl(uuid);
            for (let i = 0; i < filesList.length; i++) {
                const file = filesList[i];
                setUploading({ name: file.name, pct: 0 });
                const form = new FormData();
                form.append('files', file, file.name);
                await axios.post(uploadUrl, form, {
                    params: { directory },
                    onUploadProgress: (e) => {
                        const total = e.total ?? file.size;
                        if (total > 0) {
                            const pct = Math.round((e.loaded / total) * 100);
                            setUploading({ name: file.name, pct });
                        }
                    },
                });
            }
            setUploading(null);
            await mutate();
        } catch (e) {
            setUploading(null);
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selected.size === 0) return;
        if (!confirm(
            `Delete ${selected.size} item${selected.size === 1 ? '' : 's'}? This cannot be undone.`,
        )) return;
        try {
            setBusy(true);
            await deleteFiles(uuid, directory, Array.from(selected));
            setSelected(new Set());
            await mutate();
        } catch (e) {
            alert(httpErrorToHuman(e as Error));
        } finally {
            setBusy(false);
        }
    };

    // Apply the filter text to the rendered list. Empty filter passes all.
    const visibleFiles = useMemo(() => {
        const q = filterText.trim().toLowerCase();
        if (!q) return sortedFiles;
        return sortedFiles.filter((f) => f.name.toLowerCase().includes(q));
    }, [sortedFiles, filterText]);

    const allSelected = visibleFiles.length > 0 && visibleFiles.every((f) => selected.has(f.name));
    const someSelected = selected.size > 0;

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Files</div>
                    <div className={'page-sub'}>Browse, edit, and upload files in your server directory.</div>
                </div>
                <div className={'spacer'} />
                <div className={'row gap-6'}>
                    <button
                        className={`btn ${filterOpen ? 'btn-primary' : ''}`}
                        onClick={() => setFilterOpen((v) => !v)}
                        title={'Filter the current directory'}
                    >
                        <Icon name={'search'} size={13} />Search files
                    </button>
                    <button className={'btn'} onClick={handleNewFolder} disabled={busy}>
                        <Icon name={'folder'} size={13} />New folder
                    </button>
                    <button
                        className={'btn'}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={busy}
                    >
                        <Icon name={'download'} size={13} />Upload
                    </button>
                    <button className={'btn btn-primary'} onClick={handleNewFile} disabled={busy}>
                        <Icon name={'plus'} size={13} />New file
                    </button>
                </div>
            </div>

            {/*
              Hidden multi-file input. Triggered by the Upload button.
              `getFileUploadUrl` returns a one-shot wings URL we POST to
              with FormData; the daemon writes into the current directory.
            */}
            <input
                ref={fileInputRef}
                type={'file'}
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        handleUpload(e.target.files);
                    }
                    e.target.value = '';
                }}
            />

            {filterOpen && (
                <div className={'search-lg'} style={{ flex: 0, height: 36 }}>
                    <Icon name={'search'} size={13} />
                    <input
                        ref={filterInputRef}
                        placeholder={'Filter files in this directory…'}
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setFilterText('');
                                setFilterOpen(false);
                            }
                        }}
                    />
                    {filterText && (
                        <button
                            className={'icon-btn'}
                            onClick={() => setFilterText('')}
                            title={'Clear filter'}
                            style={{ width: 22, height: 22 }}
                        >
                            <Icon name={'plus'} size={11} style={{ transform: 'rotate(45deg)' }} />
                        </button>
                    )}
                </div>
            )}

            {uploading && (
                <div className={'notice purple'}>
                    <Icon name={'download'} size={14} />
                    <div style={{ flex: 1 }}>
                        Uploading <strong style={{ color: 'white' }}>{uploading.name}</strong>…
                    </div>
                    <span
                        style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: 12, color: 'var(--purple)',
                        }}
                    >{uploading.pct}%</span>
                </div>
            )}

            <div className={'row gap-8'} style={{ alignItems: 'center' }}>
                <Crumbs directory={directory} baseUrl={baseUrl} />
                <div className={'spacer'} />
                <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono',monospace" }}>
                    {files ? <><span style={{ color: 'var(--text)' }}>{sortedFiles.length}</span> entries in this dir</> : null}
                </span>
            </div>

            {someSelected && (
                <div
                    className={'notice purple'}
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                    <Icon name={'archive'} size={14} />
                    <strong style={{ color: 'white' }}>{selected.size}</strong> selected
                    <div className={'spacer'} />
                    <button
                        className={'btn btn-sm'}
                        onClick={() => setSelected(new Set())}
                    >
                        Clear
                    </button>
                    <button
                        className={'btn btn-sm btn-danger'}
                        onClick={handleDeleteSelected}
                        disabled={busy}
                    >
                        <Icon name={'trash'} size={11} />
                        Delete {selected.size}
                    </button>
                </div>
            )}

            <div className={'files-layout'}>
                <div className={'panel'} style={{ padding: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className={'side-label'} style={{ padding: '8px 10px 4px' }}>
                        Folders here
                    </div>
                    <div className={'file-tree'}>
                        {directory !== '/' && (
                            <NavLink
                                className={'tree-node'}
                                to={`${baseUrl}#${encodePathSegments(directory.replace(/\/[^/]*\/?$/, '') || '/')}`}
                                style={{ color: 'var(--text-faint)' }}
                            >
                                <Icon name={'chevron-right'} size={11} style={{ transform: 'rotate(180deg)' }} color={'var(--text-faint)'} />
                                <Icon name={'folder'} size={13} color={'var(--text-faint)'} />
                                ..
                            </NavLink>
                        )}
                        {folders.length === 0 && files !== undefined ? (
                            <div style={{ padding: '12px 10px', fontSize: 11, color: 'var(--text-faint)' }}>
                                No folders here.
                            </div>
                        ) : (
                            folders.map((f) => (
                                <NavLink key={f.key} className={'tree-node'} to={linkForFile(f)}>
                                    <Icon name={'chevron-down'} size={11} color={'var(--text-faint)'} />
                                    <Icon name={'folder'} size={13} color={'#fbbf24'} />
                                    {f.name}
                                </NavLink>
                            ))
                        )}
                    </div>
                </div>

                <div className={'col'} style={{ gap: 12, minHeight: 0 }}>
                    <div
                        className={'panel'}
                        style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
                    >
                        <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
                            {error ? (
                                <div style={{ padding: 24, textAlign: 'center', color: 'var(--pink)', fontSize: 13 }}>
                                    {httpErrorToHuman(error)}
                                </div>
                            ) : !files ? (
                                <div style={{ padding: 32, textAlign: 'center' }}>
                                    <Spinner size={'large'} />
                                </div>
                            ) : sortedFiles.length === 0 ? (
                                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                                    This folder is empty.
                                </div>
                            ) : visibleFiles.length === 0 ? (
                                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                                    No files match <code>{filterText}</code> in this directory.
                                </div>
                            ) : (
                                <table className={'tbl'}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 36, paddingRight: 0 }}>
                                                <input
                                                    type={'checkbox'}
                                                    checked={allSelected}
                                                    onChange={toggleSelectAll}
                                                    aria-label={'Select all'}
                                                    style={{ accentColor: 'var(--purple)', cursor: 'pointer' }}
                                                />
                                            </th>
                                            <th style={{ width: '40%' }}>Name</th>
                                            <th>Size</th>
                                            <th>Modified</th>
                                            <th>Permissions</th>
                                            <th style={{ width: 88 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleFiles.map((f) => {
                                            const isSelected = selected.has(f.name);
                                            return (
                                                <tr
                                                    key={f.key}
                                                    className={`file-row ${f.isFile ? '' : 'dir'} ${isSelected ? 'selected' : ''}`}
                                                >
                                                    <td
                                                        style={{ width: 36, paddingRight: 0 }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <input
                                                            type={'checkbox'}
                                                            checked={isSelected}
                                                            onChange={() => toggleSelect(f.name)}
                                                            aria-label={`Select ${f.name}`}
                                                            style={{ accentColor: 'var(--purple)', cursor: 'pointer' }}
                                                        />
                                                    </td>
                                                    <td
                                                        onClick={() => {
                                                            if (f.isFile) {
                                                                window.location.href = linkForFile(f);
                                                            } else {
                                                                window.location.hash = encodePathSegments(
                                                                    directory.replace(/\/+$/, '') + '/' + f.name,
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <span className={'fname'}>
                                                            {f.isFile
                                                                ? <Icon name={iconForFile(f)} size={14} />
                                                                : <Icon name={'folder'} size={14} />}
                                                            {f.name}
                                                        </span>
                                                    </td>
                                                    <td className={'mono'}>{f.isFile ? bytesToString(f.size) : '—'}</td>
                                                    <td className={'dim'}>{formatRelative(f.modifiedAt)}</td>
                                                    <td className={'mono dim'}>{f.modeBits}</td>
                                                    <td>
                                                        <div
                                                            className={'row gap-4'}
                                                            style={{ gap: 4, justifyContent: 'flex-end' }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                className={'icon-btn'}
                                                                onClick={() => handleRename(f)}
                                                                disabled={busy}
                                                                title={'Rename'}
                                                                style={{ width: 26, height: 26 }}
                                                            >
                                                                <Icon name={'settings'} size={11} />
                                                            </button>
                                                            <button
                                                                className={'icon-btn'}
                                                                onClick={() => handleDeleteOne(f)}
                                                                disabled={busy}
                                                                title={'Delete'}
                                                                style={{ width: 26, height: 26, color: 'var(--pink)' }}
                                                            >
                                                                <Icon name={'trash'} size={11} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FilesPage;
