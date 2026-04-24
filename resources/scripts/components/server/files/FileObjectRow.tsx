import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileAlt,
    faFileArchive,
    faFileCode,
    faFileImport,
    faFileVideo,
    faFolder,
    faImage,
    faMusic,
} from '@fortawesome/free-solid-svg-icons';
import { encodePathSegments } from '@/helpers';
import { differenceInHours, format, formatDistanceToNow } from 'date-fns';
import React, { memo } from 'react';
import { FileObject } from '@/api/server/files/loadDirectory';
import FileDropdownMenu from '@/components/server/files/FileDropdownMenu';
import { ServerContext } from '@/state/server';
import { NavLink, useRouteMatch } from 'react-router-dom';
import isEqual from 'react-fast-compare';
import SelectFileCheckbox from '@/components/server/files/SelectFileCheckbox';
import { usePermissions } from '@/plugins/usePermissions';
import { join } from 'path';
import { bytesToString } from '@/lib/formatters';
import styles from './style.module.css';

// Extension → (icon, color) mapping. Falls back to plain file icon.
const CODE_EXT = new Set([
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'xml', 'html', 'htm',
    'css', 'scss', 'sass', 'less', 'php', 'py', 'go', 'rs', 'rb', 'java',
    'kt', 'swift', 'sh', 'bash', 'zsh', 'yml', 'yaml', 'toml', 'md', 'sql',
    'lua', 'c', 'cpp', 'h', 'hpp', 'cs', 'vb', 'properties', 'conf', 'ini',
    'env', 'dockerfile',
]);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp']);
const AUDIO_EXT = new Set(['mp3', 'ogg', 'wav', 'flac', 'opus', 'm4a']);
const VIDEO_EXT = new Set(['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv']);

const iconFor = (file: FileObject): { icon: any; color: string } => {
    if (!file.isFile) return { icon: faFolder, color: '#C4B5FD' };
    if (file.isSymlink) return { icon: faFileImport, color: '#9CA3AF' };
    if (file.isArchiveType()) return { icon: faFileArchive, color: '#F59E0B' };

    const dot = file.name.lastIndexOf('.');
    const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : '';
    if (CODE_EXT.has(ext)) return { icon: faFileCode, color: '#22D3EE' };
    if (IMAGE_EXT.has(ext)) return { icon: faImage, color: '#34D399' };
    if (AUDIO_EXT.has(ext)) return { icon: faMusic, color: '#EC4899' };
    if (VIDEO_EXT.has(ext)) return { icon: faFileVideo, color: '#F87171' };
    return { icon: faFileAlt, color: '#9CA3AF' };
};

const Clickable: React.FC<{ file: FileObject }> = memo(({ file, children }) => {
    const [canRead] = usePermissions(['file.read']);
    const [canReadContents] = usePermissions(['file.read-content']);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const match = useRouteMatch();

    const disabled =
        (file.isFile && (!file.isEditable() || !canReadContents)) ||
        (!file.isFile && !canRead);

    return disabled ? (
        <div className={styles.details}>{children}</div>
    ) : (
        <NavLink
            className={styles.details}
            to={`${match.url}${file.isFile ? '/edit' : ''}#${encodePathSegments(join(directory, file.name))}`}
        >
            {children}
        </NavLink>
    );
}, isEqual);

const FileObjectRow = ({ file }: { file: FileObject }) => {
    const { icon, color } = iconFor(file);
    const stale = Math.abs(differenceInHours(file.modifiedAt, new Date())) > 48;

    return (
        <div
            className={styles.file_row}
            key={file.name}
            onContextMenu={(e) => {
                e.preventDefault();
                window.dispatchEvent(
                    new CustomEvent(`pterodactyl:files:ctx:${file.key}`, { detail: e.clientX }),
                );
            }}
        >
            <SelectFileCheckbox name={file.name} />
            <Clickable file={file}>
                <div className={styles.file_icon} style={{ color }}>
                    <FontAwesomeIcon icon={icon} />
                </div>
                <div className={styles.file_name}>{file.name}</div>
                {file.isFile && (
                    <div className={styles.file_size}>{bytesToString(file.size)}</div>
                )}
                <div className={styles.file_modified} title={file.modifiedAt.toString()}>
                    {stale
                        ? format(file.modifiedAt, 'MMM d, yyyy')
                        : formatDistanceToNow(file.modifiedAt, { addSuffix: true })}
                </div>
            </Clickable>
            <FileDropdownMenu file={file} />
        </div>
    );
};

export default memo(FileObjectRow, (prevProps, nextProps) => {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const { isArchiveType, isEditable, ...prevFile } = prevProps.file;
    const { isArchiveType: nextIsArchiveType, isEditable: nextIsEditable, ...nextFile } = nextProps.file;
    /* eslint-enable @typescript-eslint/no-unused-vars */

    return isEqual(prevFile, nextFile);
});
