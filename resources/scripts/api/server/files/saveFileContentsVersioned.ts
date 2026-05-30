import getFileContents from '@/api/server/files/getFileContents';
import saveFileContents from '@/api/server/files/saveFileContents';
import deleteFiles from '@/api/server/files/deleteFiles';
import loadDirectory from '@/api/server/files/loadDirectory';

/**
 * Snapshot-aware file save. Before writing the new bytes:
 *   1. Read the current bytes of the live file (best-effort).
 *   2. Write them to `.gynx-versions/<path>/<unix-ts>`.
 *   3. Write the new bytes to the live path.
 *   4. Prune the snapshot dir so only the most recent N copies remain.
 *
 * Snapshotting is best-effort: a failure on step 1 / 2 / 4 never blocks
 * the live save (step 3). The caller still gets the saveFileContents
 * promise, which only rejects if the live write itself fails. Steps that
 * fall over are logged via `console.warn` so a debug session can spot
 * them, but the user-facing save path is unaffected.
 *
 * Snapshot layout mirrors the original path inside `.gynx-versions/`:
 *   /server.properties              -> .gynx-versions/server.properties/<ts>
 *   /config/paper-global.yml        -> .gynx-versions/config/paper-global.yml/<ts>
 * Wings auto-creates intermediate directories on file write, so we never
 * need a separate mkdir call.
 */

export const SNAPSHOTS_ROOT = '/.gynx-versions';
export const DEFAULT_KEEP = 10;

export const snapshotDirFor = (filePath: string): string => {
    const clean = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return `${SNAPSHOTS_ROOT}${clean}`;
};

const snapshotPathFor = (filePath: string, ts: number): string =>
    `${snapshotDirFor(filePath)}/${ts}`;

const isSnapshotPath = (filePath: string): boolean =>
    filePath === SNAPSHOTS_ROOT
    || filePath.startsWith(`${SNAPSHOTS_ROOT}/`);

export interface SaveVersionedOptions {
    /** Max copies to retain. Older versions are deleted on save. */
    keep?: number;
}

/**
 * Same shape as saveFileContents — drop-in replacement at the call site.
 * Returns the live-save promise so caller flow doesn't change.
 */
export default async function saveFileContentsVersioned(
    uuid: string,
    file: string,
    content: string,
    options: SaveVersionedOptions = {},
): Promise<void> {
    // Don't snapshot the snapshot dir itself — would recurse infinitely
    // when a user restores or hand-edits a version file.
    if (isSnapshotPath(file)) {
        return saveFileContents(uuid, file, content);
    }

    const keep = Math.max(1, options.keep ?? DEFAULT_KEEP);

    // STEP 1: read current contents. Treat 404 (new file) as no-snapshot.
    let previous: string | null = null;
    try {
        previous = await getFileContents(uuid, file);
    } catch (e) {
        // First-time save / missing file is fine — nothing to snapshot.
        previous = null;
    }

    // STEP 2: write the snapshot if we have something to snapshot AND the
    // content actually changed. No-op saves don't get a snapshot row.
    if (previous !== null && previous !== content) {
        const ts = Date.now();
        try {
            await saveFileContents(uuid, snapshotPathFor(file, ts), previous);
        } catch (e) {
            console.warn('snapshot write failed', e);
        }
    }

    // STEP 3: the actual live save. This one is allowed to throw.
    await saveFileContents(uuid, file, content);

    // STEP 4: rotate. List the snapshot dir, keep the newest N, delete the rest.
    try {
        const dir = snapshotDirFor(file);
        const entries = await loadDirectory(uuid, dir);
        const versionFiles = entries
            .filter((e) => e.isFile && /^\d+$/.test(e.name))
            .sort((a, b) => Number(b.name) - Number(a.name)); // newest first
        const drop = versionFiles.slice(keep).map((e) => e.name);
        if (drop.length > 0) {
            await deleteFiles(uuid, dir, drop);
        }
    } catch (e) {
        // Empty dir / 404 / permission — rotation is best-effort.
        console.warn('snapshot rotation skipped', e);
    }
}
