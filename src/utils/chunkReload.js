/**
 * What to do when a file of the app fails to load (a chunk or stylesheet that 404s).
 *
 * Right after a deploy the page and its files can be out of step for a few seconds: the page in
 * the tab names files of the build before, or the new page is served a moment before its files
 * are. One reload usually fixes it, but a reload made inside that window lands on the same miss.
 * So: reload at once, then again after 2 s, then after 5 s, and only then give up and let the
 * error screen ask the person to reload by hand. The count starts over after a quiet minute.
 */
export const RELOAD_DELAYS_MS = [0, 2000, 5000];
export const RELOAD_WINDOW_MS = 60000;

/** state: { count, firstAt } or null -> { reload: bool, delay, next } */
export const nextChunkReload = (state, now = Date.now()) => {
    const fresh = !state || !Number.isFinite(state.firstAt) || now - state.firstAt > RELOAD_WINDOW_MS;
    const count = fresh ? 0 : Number(state.count) || 0;
    const firstAt = fresh ? now : state.firstAt;
    if (count >= RELOAD_DELAYS_MS.length) return { reload: false, delay: 0, next: { count, firstAt } };
    return { reload: true, delay: RELOAD_DELAYS_MS[count], next: { count: count + 1, firstAt } };
};

const CHUNK_ERROR = /text\/html|is not a valid JavaScript MIME type|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

/** True for the errors a missing or stale app file produces. */
export const isChunkLoadError = (err) => CHUNK_ERROR.test(typeof err === 'string' ? err : `${err?.name || ''} ${err?.message || ''}`);
