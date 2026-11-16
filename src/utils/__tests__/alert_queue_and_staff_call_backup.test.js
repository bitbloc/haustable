import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const fromMock = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({
    supabase: { from: (...args) => fromMock(...args) }
}));

import {
    playOrderAlert,
    playBillAlert,
    startStaffCallLoop,
    stopStaffCallLoop,
    isStaffCallActiveFor,
    setAudioMuted,
    setAudioVolume,
    __resetAlertScheduler
} from '../audioHelper';
import {
    recordTableStaffCall,
    fetchOpenTableStaffCalls,
    clearTableStaffCalls,
    __resetTableStaffCallsState
} from '../tableStaffCalls';

describe('Alert queue: alerts that collide are queued, not dropped', () => {
    let played;

    beforeEach(() => {
        vi.useFakeTimers();
        __resetAlertScheduler();
        stopStaffCallLoop(null, true);
        played = [];
        window.AndroidPosBridge = {
            playAlertSound: vi.fn((type) => { played.push({ type, at: Date.now() }); return true; })
        };
        setAudioVolume(80);
        setAudioMuted(false);
    });

    afterEach(() => {
        stopStaffCallLoop(null, true);
        delete window.AndroidPosBridge;
        vi.useRealTimers();
    });

    it('a bill call 400ms after a new order still rings (used to be silent)', () => {
        const t0 = Date.now();
        expect(playOrderAlert('order_a', 1200)).toBe(true);
        vi.advanceTimersByTime(400);
        expect(playBillAlert('bill_b')).toBe(true);
        expect(played.map(p => p.type)).toEqual(['noti1']); // queued, not yet started

        vi.advanceTimersByTime(800);
        expect(played.map(p => p.type)).toEqual(['noti1', 'notibill']);
        expect(played[1].at - t0).toBe(1200); // starts once the order chime has had its gap
    });

    it('a new order during the staff-call loop still rings', () => {
        startStaffCallLoop('T5');
        vi.advanceTimersByTime(600);
        expect(playOrderAlert('order_during_loop', 1200)).toBe(true);
        vi.advanceTimersByTime(700);
        expect(played.map(p => p.type)).toEqual(['notibill', 'noti1']);

        // and the loop keeps ringing afterwards
        vi.advanceTimersByTime(3500);
        expect(played.filter(p => p.type === 'notibill').length).toBeGreaterThanOrEqual(2);
    });

    it('two orders in the same moment still ring once', () => {
        expect(playOrderAlert('order_1', 1200)).toBe(true);
        vi.advanceTimersByTime(200);
        expect(playOrderAlert('order_2', 1200)).toBe(false);
        vi.advanceTimersByTime(3000);
        expect(played.filter(p => p.type === 'noti1')).toHaveLength(1);
    });

    it('three different alerts at once play one after another, 1200ms apart', () => {
        const t0 = Date.now();
        playOrderAlert('o', 1200);
        playBillAlert('b');
        vi.advanceTimersByTime(5000);
        expect(played.map(p => p.at - t0)).toEqual([0, 1200]);
    });

    it('a queued alert does not ring if the POS is muted before its turn', () => {
        playOrderAlert('o2', 1200);
        vi.advanceTimersByTime(300);
        playBillAlert('b2');
        setAudioMuted(true);
        vi.advanceTimersByTime(2000);
        expect(played.map(p => p.type)).toEqual(['noti1']);
    });

    it('reports which tables the staff-call loop is ringing for', () => {
        startStaffCallLoop(7);
        expect(isStaffCallActiveFor(7)).toBe(true);
        expect(isStaffCallActiveFor('7')).toBe(true);
        expect(isStaffCallActiveFor(8)).toBe(false);
        stopStaffCallLoop(7);
        expect(isStaffCallActiveFor(7)).toBe(false);
    });
});

describe('Free-table staff call backup (table_staff_calls)', () => {
    beforeEach(() => {
        fromMock.mockReset();
        __resetTableStaffCallsState();
    });

    it('records a call for a free table', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null });
        fromMock.mockReturnValue({ insert });
        expect(await recordTableStaffCall(5, 'H5')).toBe(true);
        expect(fromMock).toHaveBeenCalledWith('table_staff_calls');
        expect(insert).toHaveBeenCalledWith({ table_id: 5, table_name: 'H5' });
    });

    it('returns one open call per table, newest first', async () => {
        const rows = [
            { id: 3, table_id: 5, table_name: 'H5', created_at: '2026-11-16T10:02:00Z' },
            { id: 2, table_id: 5, table_name: 'H5', created_at: '2026-11-16T10:01:00Z' },
            { id: 1, table_id: 2, table_name: 'H4', created_at: '2026-11-16T10:00:00Z' }
        ];
        const chain = { select: () => chain, is: () => chain, gte: () => chain, order: () => Promise.resolve({ data: rows, error: null }) };
        fromMock.mockReturnValue(chain);
        const open = await fetchOpenTableStaffCalls();
        expect(open.map(r => r.id)).toEqual([3, 1]);
    });

    it('clears open calls for a table when staff acknowledge it', async () => {
        const is = vi.fn().mockResolvedValue({ error: null });
        const eq = vi.fn(() => ({ is }));
        const update = vi.fn(() => ({ eq }));
        fromMock.mockReturnValue({ update });
        expect(await clearTableStaffCalls(5)).toBe(true);
        expect(update.mock.calls[0][0]).toHaveProperty('cleared_at');
        expect(eq).toHaveBeenCalledWith('table_id', 5);
        expect(is).toHaveBeenCalledWith('cleared_at', null);
    });

    it('keeps working and stops asking when the migration is not applied yet', async () => {
        const insert = vi.fn().mockResolvedValue({ error: { code: 'PGRST205', message: "Could not find the table 'public.table_staff_calls'" } });
        fromMock.mockReturnValue({ insert });
        expect(await recordTableStaffCall(5, 'H5')).toBe(false);
        expect(await recordTableStaffCall(6, 'H6')).toBe(false);
        expect(await fetchOpenTableStaffCalls()).toEqual([]);
        expect(insert).toHaveBeenCalledTimes(1); // no repeated requests for a table that is not there
    });
});
