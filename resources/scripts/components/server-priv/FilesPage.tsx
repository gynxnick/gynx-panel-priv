import * as React from 'react';
import { useEffect, useMemo } from 'react';
import { NavLink, useLocation, useRouteMatch } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import { hashToPath, encodePathSegments } from '@/helpers';
import { bytesToString } from '@/lib/formatters';
import { httpErrorToHuman } from '@/api/http';
import { FileObject } from '@/api/server/files/loadDirectory';
import Spinner from '@/components/elements/Spinner';
import { Icon, IconName } from './Icon';

/**
 * Files page — wireframe layout backed by real Pterodactyl files API.
 *
 * Reads the current directory from the URL hash (legacy convention),
 * fetches via useFileManagerSwr, and renders the standard tree-by-folder
 * + file table layout. Click a folder → navigate into it. Click a file →
 * jump to the legacy edit screen at /files/edit#<path>.
 *
 * The code-preview pane stays as a dim placeholder for now; a real preview
 * needs a getFileContents call + a syntax highlighter, follow-up work.
 */

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
    const match = useRouteMatch<{ id: string }>();
    const baseUrl = `/server/${match.params.id}/files`;
    const editUrl = `/server/${match.params.id}/files/edit`;

    const directory = ServerContext.useStoreState((s) => s.files.directory);
    const setDirectory = ServerContext.useStoreActions((a) => a.files.setDirectory);
    const setSelectedFiles = ServerContext.useStoreActions((a) => a.files.setSelectedFiles);

    useEffect(() => {
        setSelectedFiles([]);
        setDirectory(hashToPath(location.hash));
    }, [location.hash]);

    const { data: files, error, isValidating, mutate } = useFileManagerSwr();

    // useFileManagerSwr is configured `revalidateOnMount: false`, so the
    // hook never fetches automatically on first mount. Trigger it manually
    // every time the directory state changes (matches the legacy page).
    useEffect(() => {
        mutate();
    }, [directory]);

    const sortedFiles = useMemo(() => (files ? sortFiles(files) : []), [files]);
    const folders = sortedFiles.filter((f) => !f.isFile);

    const linkForFile = (f: FileObject): string => {
        const targetDir = directory.replace(/\/+$/, '') + '/' + f.name;
        if (f.isFile) {
            return `${editUrl}#${encodePathSegments(targetDir)}`;
        }
        return `${baseUrl}#${encodePathSegments(targetDir)}`;
    };

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Files</div>
                    <div className={'page-sub'}>Browse, edit, and upload files in your server directory.</div>
                </div>
                <div className={'spacer'} />
                <div className={'row gap-6'}>
                    <button className={'btn'} disabled><Icon name={'search'} size={13} />Search files</button>
                    <button className={'btn'} disabled><Icon name={'folder'} size={13} />New folder</button>
                    <button className={'btn'} disabled><Icon name={'download'} size={13} />Upload</button>
                    <button className={'btn btn-primary'} disabled><Icon name={'plus'} size={13} />New file</button>
                </div>
            </div>

            <div className={'row gap-8'} style={{ alignItems: 'center' }}>
                <Crumbs directory={directory} baseUrl={baseUrl} />
                <div className={'spacer'} />
                <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono',monospace" }}>
                    {files ? <><span style={{ color: 'var(--text)' }}>{sortedFiles.length}</span> entries in this dir</> : null}
                </span>
            </div>

            <div className={'files-layout'}>
                {/* sidebar — folders in current directory */}
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

                {/* file list + preview */}
                <div className={'col'} style={{ gap: 12, minHeight: 0 }}>
                    <div className={'panel'} style={{ padding: 0, overflow: 'hidden', flex: 0, maxHeight: 420 }}>
                        <div style={{ overflow: 'auto', maxHeight: 420 }}>
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
                            ) : (
                                <table className={'tbl'}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '45%' }}>Name</th>
                                            <th>Size</th>
                                            <th>Modified</th>
                                            <th>Permissions</th>
                                            <th style={{ width: 50 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedFiles.map((f) => (
                                            <tr
                                                key={f.key}
                                                className={`file-row ${f.isFile ? '' : 'dir'}`}
                                                onClick={() => {
                                                    // Navigate via the NavLink would be more idiomatic — but the
                                                    // tr is the click target so we set window.location.hash
                                                    // (location-based routing). For files, change to edit URL.
                                                    if (f.isFile) {
                                                        window.location.href = linkForFile(f);
                                                    } else {
                                                        window.location.hash = encodePathSegments(
                                                            directory.replace(/\/+$/, '') + '/' + f.name,
                                                        );
                                                    }
                                                }}
                                            >
                                                <td>
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
                                                    <div className={'icon-btn'} style={{ width: 22, height: 22 }}>
                                                        <Icon name={'chevron-right'} size={12} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* preview placeholder — real preview needs getFileContents + syntax highlighter, follow-up */}
                    <div
                        className={'panel'}
                        style={{
                            flex: 1,
                            padding: 0,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 200,
                        }}
                    >
                        <div className={'console-header'} style={{ borderBottom: '1px solid var(--line)' }}>
                            <div className={'console-title'} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>
                                <Icon name={'settings'} size={13} color={'var(--text-faint)'} />
                                <span style={{ color: 'var(--text-faint)' }}>preview</span>
                            </div>
                            <div className={'console-meta'}>
                                {isValidating ? 'loading…' : files ? `${directory}` : ''}
                            </div>
                        </div>
                        <div
                            className={'code-pane'}
                            style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}
                        >
                            <span style={{ fontSize: 12.5, fontFamily: "'JetBrains Mono',monospace" }}>
                                Click a file in the table to open it in the editor.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FilesPage;
