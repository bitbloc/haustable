import { describe, it, expect } from 'vitest';
import { nextChunkReload, isChunkLoadError, RELOAD_DELAYS_MS } from '../chunkReload';

describe('nextChunkReload', () => {
    it('reloads at once, then after 2 s and 5 s, then stops', () => {
        let state = null;
        const delays = [];
        for (let i = 0; i < 5; i++) {
            const step = nextChunkReload(state, 1000 + i * 100);
            if (step.reload) delays.push(step.delay);
            state = step.next;
        }
        expect(delays).toEqual(RELOAD_DELAYS_MS);
        expect(nextChunkReload(state, 2000).reload).toBe(false);
    });

    it('starts over after a quiet minute', () => {
        const spent = { count: 3, firstAt: 1000 };
        expect(nextChunkReload(spent, 30000).reload).toBe(false);
        expect(nextChunkReload(spent, 62000)).toEqual({ reload: true, delay: 0, next: { count: 1, firstAt: 62000 } });
    });

    it('treats unreadable saved state as none', () => {
        expect(nextChunkReload({ count: 'x' }, 5000).reload).toBe(true);
    });
});

describe('isChunkLoadError', () => {
    it('knows the errors of a missing app file', () => {
        expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/A-1.js'))).toBe(true);
        expect(isChunkLoadError('Importing a module script failed.')).toBe(true); // Safari
        expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/index-1.css'))).toBe(true);
    });

    it('leaves real bugs alone', () => {
        expect(isChunkLoadError(new TypeError("Cannot read properties of null (reading 'useState')"))).toBe(false);
        expect(isChunkLoadError(null)).toBe(false);
    });
});
