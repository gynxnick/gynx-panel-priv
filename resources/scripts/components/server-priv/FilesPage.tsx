import * as React from 'react';
import { useState } from 'react';
import { Icon, IconName } from './Icon';

/**
 * Files page — wireframe translation. Visual recreation only:
 * tree, file table, and code-editor preview are all hardcoded mock content.
 * Real data wiring (FileManager API, syntax highlighting, edit/save/upload)
 * will replace this in a follow-up pass.
 */

type TreeNode = { name: string; type: 'dir' | 'file'; open?: boolean; children?: TreeNode[] };

const TREE: TreeNode[] = [
    {
        name: 'world', type: 'dir', open: true, children: [
            { name: 'playerdata', type: 'dir' },
            { name: 'region', type: 'dir' },
            { name: 'level.dat', type: 'file' },
        ],
    },
    { name: 'world_nether', type: 'dir' },
    { name: 'world_the_end', type: 'dir' },
    {
        name: 'plugins', type: 'dir', open: true, children: [
            { name: 'EssentialsX', type: 'dir' },
            { name: 'LuckPerms', type: 'dir' },
            { name: 'WorldEdit', type: 'dir' },
            { name: 'PlaceholderAPI', type: 'dir' },
        ],
    },
    { name: 'logs', type: 'dir' },
    { name: 'cache', type: 'dir' },
    { name: 'config', type: 'dir' },
    { name: 'libraries', type: 'dir' },
    { name: 'versions', type: 'dir' },
];

interface FileEntry {
    name: string;
    type: 'dir' | 'file';
    size: string;
    time: string;
    perm: string;
    icon?: IconName;
}

const FILES: FileEntry[] = [
    { name: 'world',           type: 'dir',  size: '8.4 GB',  time: '2m ago',  perm: 'drwxr-xr-x' },
    { name: 'world_nether',    type: 'dir',  size: '1.2 GB',  time: '2m ago',  perm: 'drwxr-xr-x' },
    { name: 'world_the_end',   type: 'dir',  size: '640 MB',  time: '2m ago',  perm: 'drwxr-xr-x' },
    { name: 'plugins',         type: 'dir',  size: '184 MB',  time: '12d ago', perm: 'drwxr-xr-x' },
    { name: 'logs',            type: 'dir',  size: '42 MB',   time: '1m ago',  perm: 'drwxr-xr-x' },
    { name: 'config',          type: 'dir',  size: '8.1 MB',  time: '12d ago', perm: 'drwxr-xr-x' },
    { name: 'server.properties', type: 'file', size: '2.1 KB', time: '12d ago', perm: '-rw-r--r--', icon: 'settings' },
    { name: 'ops.json',        type: 'file', size: '412 B',   time: '3d ago',  perm: '-rw-r--r--', icon: 'users' },
    { name: 'whitelist.json',  type: 'file', size: '1.4 KB',  time: '8d ago',  perm: '-rw-r--r--', icon: 'users' },
    { name: 'banned-players.json', type: 'file', size: '284 B', time: '5d ago', perm: '-rw-r--r--', icon: 'skull' },
    { name: 'paper-1.21.jar',  type: 'file', size: '48.2 MB', time: '12d ago', perm: '-rw-r--r--', icon: 'play' },
    { name: 'eula.txt',        type: 'file', size: '164 B',   time: '12d ago', perm: '-rw-r--r--', icon: 'settings' },
];

type Token = ['key' | 'str' | 'num' | 'com' | 'pun', string];
type CodeLine = [number, Token[]];

const CODE: CodeLine[] = [
    [1,  [['com', '#Minecraft server properties']]],
    [2,  [['com', '#Wed Jan 15 14:02:11 GMT 2025']]],
    [3,  [['key', 'level-name'], ['pun', '='], ['str', 'world']]],
    [4,  [['key', 'gamemode'], ['pun', '='], ['str', 'survival']]],
    [5,  [['key', 'difficulty'], ['pun', '='], ['str', 'normal']]],
    [6,  [['key', 'max-players'], ['pun', '='], ['num', '60']]],
    [7,  [['key', 'view-distance'], ['pun', '='], ['num', '10']]],
    [8,  [['key', 'simulation-distance'], ['pun', '='], ['num', '8']]],
    [9,  [['key', 'spawn-protection'], ['pun', '='], ['num', '16']]],
    [10, [['key', 'online-mode'], ['pun', '='], ['str', 'true']]],
    [11, [['key', 'white-list'], ['pun', '='], ['str', 'false']]],
    [12, [['key', 'enforce-whitelist'], ['pun', '='], ['str', 'false']]],
    [13, [['key', 'pvp'], ['pun', '='], ['str', 'true']]],
    [14, [['key', 'allow-flight'], ['pun', '='], ['str', 'false']]],
    [15, [['key', 'spawn-monsters'], ['pun', '='], ['str', 'true']]],
    [16, [['key', 'generate-structures'], ['pun', '='], ['str', 'true']]],
    [17, [['key', 'level-seed'], ['pun', '='], ['num', '-4286725196458123456']]],
    [18, [['key', 'motd'], ['pun', '='], ['str', '§6survival-smp §7| §fseason 4']]],
    [19, [['key', 'rcon.password'], ['pun', '='], ['str', '••••••••••']]],
    [20, [['key', 'rcon.port'], ['pun', '='], ['num', '25575']]],
    [21, [['key', 'enable-rcon'], ['pun', '='], ['str', 'true']]],
    [22, [['key', 'query.port'], ['pun', '='], ['num', '25565']]],
    [23, [['key', 'enable-query'], ['pun', '='], ['str', 'false']]],
];

const renderTree = (nodes: TreeNode[], depth = 0): React.ReactNode =>
    nodes.map((n, i) => (
        <React.Fragment key={i}>
            <div className={'tree-node'} style={{ paddingLeft: 8 + depth * 14 }}>
                {n.type === 'dir' && <Icon name={'chevron-down'} size={11} color={'var(--text-faint)'} />}
                {n.type === 'dir'
                    ? <Icon name={'folder'} size={13} color={'#fbbf24'} />
                    : <Icon name={'settings'} size={13} color={'var(--text-faint)'} />}
                {n.name}
            </div>
            {n.open && n.children && renderTree(n.children, depth + 1)}
        </React.Fragment>
    ));

export const FilesPage = () => {
    const [selected, setSelected] = useState('server.properties');

    return (
        <div className={'sub-main'}>
            <div className={'page-header'}>
                <div>
                    <div className={'page-title'}>Files</div>
                    <div className={'page-sub'}>Browse, edit, and upload files in your server directory.</div>
                </div>
                <div className={'spacer'} />
                <div className={'row gap-6'}>
                    <button className={'btn'}><Icon name={'search'} size={13} />Search files</button>
                    <button className={'btn'}><Icon name={'folder'} size={13} />New folder</button>
                    <button className={'btn'}><Icon name={'download'} size={13} />Upload</button>
                    <button className={'btn btn-primary'}><Icon name={'plus'} size={13} />New file</button>
                </div>
            </div>

            <div className={'row gap-8'} style={{ alignItems: 'center' }}>
                <div className={'crumbs'}>
                    <span className={'seg-crumb'}><Icon name={'folder'} size={12} />/</span>
                    <span className={'sep'}>/</span>
                    <span className={'seg-crumb'}>home</span>
                    <span className={'sep'}>/</span>
                    <span className={'seg-crumb'}>container</span>
                    <span className={'sep'}>/</span>
                </div>
                <div className={'spacer'} />
                <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono',monospace" }}>
                    <span style={{ color: 'var(--text)' }}>10.6 GB</span> used ·{' '}
                    <span style={{ color: 'var(--text)' }}>50 GB</span> quota
                </span>
            </div>

            <div className={'files-layout'}>
                <div className={'panel'} style={{ padding: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className={'search-lg'} style={{ height: 32, fontSize: 12, margin: 4, flex: '0 0 auto' }}>
                        <Icon name={'search'} size={12} />
                        <input placeholder={'Find file…'} />
                    </div>
                    <div className={'file-tree'}>
                        {renderTree(TREE)}
                    </div>
                </div>

                <div className={'col'} style={{ gap: 12, minHeight: 0 }}>
                    <div className={'panel'} style={{ padding: 0, overflow: 'hidden', flex: 0, maxHeight: 320 }}>
                        <div style={{ overflow: 'auto', maxHeight: 320 }}>
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
                                    {FILES.map((f, i) => (
                                        <tr
                                            key={i}
                                            className={`file-row ${f.type === 'dir' ? 'dir' : ''} ${f.name === selected ? 'selected' : ''}`}
                                            onClick={() => setSelected(f.name)}
                                        >
                                            <td>
                                                <span className={'fname'}>
                                                    {f.type === 'dir'
                                                        ? <Icon name={'folder'} size={14} />
                                                        : <Icon name={f.icon || 'settings'} size={14} />}
                                                    {f.name}
                                                </span>
                                            </td>
                                            <td className={'mono'}>{f.size}</td>
                                            <td className={'dim'}>{f.time}</td>
                                            <td className={'mono dim'}>{f.perm}</td>
                                            <td>
                                                <div className={'icon-btn'} style={{ width: 22, height: 22 }}>
                                                    <Icon name={'chevron-right'} size={12} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div
                        className={'panel'}
                        style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
                    >
                        <div className={'console-header'} style={{ borderBottom: '1px solid var(--line)' }}>
                            <div
                                className={'console-title'}
                                style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}
                            >
                                <Icon name={'settings'} size={13} color={'var(--purple)'} />
                                /home/container/<span style={{ color: 'white' }}>{selected}</span>
                            </div>
                            <div className={'console-meta'}>.properties · 23 lines · 2.1 KB · saved 12d ago</div>
                            <div className={'console-actions'}>
                                <div className={'console-action'} title={'Search'}>
                                    <Icon name={'search'} size={13} />
                                </div>
                                <div className={'console-action'} title={'Copy'}>
                                    <Icon name={'copy'} size={13} />
                                </div>
                                <button className={'btn btn-sm btn-primary'}>
                                    <Icon name={'save'} size={11} />Save
                                </button>
                            </div>
                        </div>
                        <div className={'code-pane'}>
                            <div className={'ln-col'}>
                                {CODE.map(([n]) => <span key={n}>{n}</span>)}
                            </div>
                            <div className={'code-col'}>
                                {CODE.map(([n, toks]) => (
                                    <div key={n}>
                                        {toks.map((t, i) => (
                                            <React.Fragment key={i}>
                                                {i > 0 && <span className={'tk-pun'}> </span>}
                                                <span className={`tk-${t[0]}`}>{t[1]}</span>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FilesPage;
