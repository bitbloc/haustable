import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({ supabase: { rpc: (...args) => rpc(...args) } }));

import { recomputeWindows, recomputeRefusal, recomputeMenuShadow, recomputeAllShadow } from '../stockShadowRecompute';

const NOW = Date.parse('2026-11-24T06:00:00.000Z');

describe('recomputeWindows', () => {
    it('covers the period day by day, oldest first, with no gap and an open end', () => {
        const w = recomputeWindows(3, NOW);
        expect(w).toEqual([
            { from: '2026-11-21T06:00:00.000Z', to: '2026-11-22T06:00:00.000Z' },
            { from: '2026-11-22T06:00:00.000Z', to: '2026-11-23T06:00:00.000Z' },
            { from: '2026-11-23T06:00:00.000Z', to: null }
        ]);
    });
});

describe('recomputeRefusal', () => {
    it('says why the database refused', () => {
        expect(recomputeRefusal({ code: 'NOT_SHADOW', mode: 'live' })).toMatch(/ตัดสต๊อกจริง/);
        expect(recomputeRefusal({ code: 'NOT_SHADOW', mode: 'off' })).toMatch(/ปิดอยู่/);
        expect(recomputeRefusal({ code: 'NO_PERIOD' })).toMatch(/ช่วงเวลา/);
    });
});

describe('recomputeMenuShadow', () => {
    beforeEach(() => { rpc.mockReset(); });

    it('asks for one menu over the last 30 days', async () => {
        rpc.mockResolvedValue({ data: { success: true, lines: 26, errors: 0 }, error: null });
        const res = await recomputeMenuShadow(13, 30, NOW);
        expect(rpc).toHaveBeenCalledWith('recompute_sale_stock_shadow', {
            p_from: '2026-10-25T06:00:00.000Z',
            p_menu_item_id: 13
        });
        expect(res).toEqual({ ok: true, lines: 26, errors: 0, message: '' });
    });

    it('never throws: a refusal or a failed call comes back as a message', async () => {
        rpc.mockResolvedValue({ data: { success: false, code: 'NOT_SHADOW', mode: 'live' }, error: null });
        expect((await recomputeMenuShadow(13, 30, NOW)).ok).toBe(false);
        rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
        expect(await recomputeMenuShadow(13, 30, NOW)).toMatchObject({ ok: false, message: 'permission denied' });
    });

    it('a call that throws (offline) comes back as a message too', async () => {
        rpc.mockImplementation(async () => { throw new Error('offline'); });
        const res = await recomputeMenuShadow(13, 30, NOW);
        expect(res).toMatchObject({ ok: false, message: 'offline' });
    });
});

describe('recomputeAllShadow', () => {
    beforeEach(() => { rpc.mockReset(); });

    it('adds up the days and reports progress', async () => {
        rpc.mockResolvedValue({ data: { success: true, lines: 10, errors: 1 }, error: null });
        const seen = [];
        const res = await recomputeAllShadow(3, (done, total) => seen.push([done, total]), NOW);
        expect(rpc).toHaveBeenCalledTimes(3);
        expect(rpc.mock.calls[2][1]).toEqual({ p_from: '2026-11-23T06:00:00.000Z', p_to: null });
        expect(res).toMatchObject({ ok: true, lines: 30, errors: 3, daysDone: 3, days: 3 });
        expect(seen).toEqual([[0, 3], [1, 3], [2, 3], [3, 3]]);
    });

    it('stops at the first day that fails and says how far it got', async () => {
        rpc.mockResolvedValueOnce({ data: { success: true, lines: 10, errors: 0 }, error: null })
            .mockResolvedValueOnce({ data: null, error: { message: 'timeout' } });
        const res = await recomputeAllShadow(3, null, NOW);
        expect(rpc).toHaveBeenCalledTimes(2);
        expect(res).toMatchObject({ ok: false, lines: 10, daysDone: 1, days: 3, message: 'timeout' });
    });
});
