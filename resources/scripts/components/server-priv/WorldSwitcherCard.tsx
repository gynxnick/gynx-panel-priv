import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ServerContext } from '@/state/server';
import { Icon } from './Icon';
import getServerStartup from '@/api/swr/getServerStartup';
import updateStartupVariable from '@/api/server/updateStartupVariable';
import loadDirectory from '@/api/server/files/loadDirectory';
import { ServerEggVariable } from '@/api/server/types';
import { httpErrorToHuman } from '@/api/http';

// World switcher for Minecraft servers. Lets the player point the
// LEVEL / level-name startup var at any directory at the server root
// that looks like a world (contains level.dat). The change takes
// effect on the next restart — Wings rewrites server.properties from
// env vars at boot.
//
// We don't do FS moves: just changing the active level-name swaps
// which world the server boots into without mutating any save data,
// which is the safer pattern for users who keep multiple worlds in
// parallel (creative + survival, vanilla + modded, etc.).

const LEVEL_ENV_VARS = ['LEVEL', 'LEVEL_NAME', 'WORLD', 'WORLD_NAME'];

const findLevelVariable = (vars: ServerEggVariable[]): ServerEggVariable | null => {
    for (const env of LEVEL_ENV_VARS) {
        const m = vars.find((v) => v.envVariable.toUpperCase() === env);
        if (m) return m;
    }
    return vars.find((v) => /level\s*name|world\s*name/i.test(v.name)) ?? null;
};

interface WorldDir {
    name: string;
    /** Loosely classifies the world. We treat presence of level.dat as
     *  the canonical signal; we still surface dirs that *look* like
     *  worlds (named the same as the active level) even if probing
     *  them errored out, so a probe failure doesn't hide the right
     *  answer. */
    confidence: 'level.dat' | 'name-match' | 'guessed';
}

export const WorldSwitcherCard = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);
    const status = ServerContext.useStoreState((s) => s.status.value);
    const { data, mutate } = getServerStartup(uuid);

    const levelVar = useMemo(() => (data ? findLevelVariable(data.variables) : null), [data]);
    const activeLevel = levelVar?.serverValue ?? levelVar?.defaultValue ?? null;

    const [worlds, setWorlds] = useState<WorldDir[] | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [target, setTarget] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);

    // Probe the server root for world directories. Discovery: list /,
    // filter to directories, then for each — in parallel — try to load
    // its contents looking for level.dat. Anything matching by content
    // is confidence: level.dat. The active level's name dir is included
    // even if probing fails (network blip, permissions edge case).
    useEffect(() => {
        if (!levelVar) return;
        let alive = true;

        const scan = async () => {
            try {
                const root = await loadDirectory(uuid, '/');
                const dirs = root.filter((f) => !f.isFile);

                const probes = await Promise.all(
                    dirs.map(async (d): Promise<WorldDir | null> => {
                        try {
                            const inside = await loadDirectory(uuid, '/' + d.name);
                            const hasLevel = inside.some((f) => f.isFile && f.name === 'level.dat');
                            if (hasLevel) return { name: d.name, confidence: 'level.dat' };
                        } catch {
                            // Probe error — fall through. We'll still surface
                            // the dir if it matches the active level by name.
                        }
                        if (activeLevel && d.name === activeLevel) {
                            return { name: d.name, confidence: 'name-match' };
                        }
                        return null;
                    }),
                );

                if (!alive) return;
                const found = probes.filter((w): w is WorldDir => w !== null);
                // Sort: active first, then alphabetical.
                found.sort((a, b) => {
                    if (a.name === activeLevel) return -1;
                    if (b.name === activeLevel) return 1;
                    return a.name.localeCompare(b.name);
                });
                setWorlds(found);
                setTarget(activeLevel ?? found[0]?.name ?? '');
            } catch (e) {
                if (!alive) return;
                setScanError(httpErrorToHuman(e as Error));
            }
        };

        scan();
        return () => { alive = false; };
    }, [uuid, levelVar?.envVariable, activeLevel]);

    if (!levelVar) {
        // No level var on this egg — the rail card hides itself rather
        // than render a confusing "no worlds" state for non-MC games.
        return null;
    }

    const onCommit = async () => {
        if (!target || target === activeLevel) return;
        setSaving(true);
        setError(null);
        try {
            await updateStartupVariable(uuid, levelVar.envVariable, target);
            await mutate();
            setSavedAt(Date.now());
            window.setTimeout(() => setSavedAt((t) => (Date.now() - (t ?? 0) > 2000 ? null : t)), 2200);
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setSaving(false);
        }
    };

    const dirty = !!target && target !== activeLevel;
    const editable = levelVar.isEditable;
    const restartHint = status === 'running' || status === 'starting' || status === 'stopping';

    return (
        <div className={'panel rail-card'}>
            <div className={'rail-title'}>
                <span>World</span>
            </div>
            <div style={{
                fontSize: 11, color: 'var(--text-faint)',
                fontFamily: "'JetBrains Mono', monospace", marginTop: -4,
            }}>
                {levelVar.envVariable}
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                margin: '10px 0',
            }}>
                <Icon name={'globe'} size={14} color={'var(--purple-soft, #c4b5fd)'} />
                <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5,
                    color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, minWidth: 0,
                }} title={activeLevel ?? '—'}>
                    {activeLevel ?? '—'}
                </span>
                <span className={'tag compat'} style={{ fontSize: 9 }}>active</span>
            </div>

            {worlds === null ? (
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    {scanError ? scanError : 'scanning…'}
                </div>
            ) : worlds.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    No worlds found at the server root. Upload one to a folder containing <code>level.dat</code>.
                </div>
            ) : (
                <select
                    value={target}
                    disabled={!editable || saving}
                    onChange={(e) => setTarget(e.currentTarget.value)}
                    style={{
                        width: '100%',
                        background: 'var(--surface-2)', border: '1px solid var(--line-2)',
                        color: 'var(--text)', borderRadius: 6, padding: '6px 8px',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5,
                    }}
                >
                    {worlds.map((w) => (
                        <option key={w.name} value={w.name}>
                            {w.name}{w.name === activeLevel ? '  (active)' : ''}
                        </option>
                    ))}
                    {/* Allow custom values: typing into the input would be
                        ideal but a select keeps the UI tight. Users who
                        want to point at a world the scan missed can use
                        the Startup page directly. */}
                </select>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{
                    fontSize: 10, color: 'var(--text-faint)',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    {restartHint ? 'restart to apply' : 'applies on next start'}
                </span>
                <div style={{ flex: 1 }} />
                <button
                    type={'button'}
                    className={dirty ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                    onClick={onCommit}
                    disabled={!editable || !dirty || saving}
                >
                    {saving
                        ? <><Icon name={'restart'} size={11} className={'spin'} />Saving</>
                        : savedAt && Date.now() - savedAt < 2200
                            ? <><Icon name={'check'} size={11} />Saved</>
                            : <><Icon name={'save'} size={11} />Switch</>}
                </button>
            </div>

            {!editable && (
                <div style={{
                    fontSize: 10, color: 'var(--text-faint)', marginTop: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    locked by panel admin
                </div>
            )}

            {error && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 8 }}>
                    {error}
                </div>
            )}
        </div>
    );
};

export default WorldSwitcherCard;
