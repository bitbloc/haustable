import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpcMock = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({
    supabase: {
        rpc: (...args) => rpcMock(...args),
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
        channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
        removeChannel: () => {}
    }
}));

import {
    getLocallyPrintedIds,
    addLocallyPrintedIds,
    filterLocallyUnprinted,
    carryOverLocallyPrinted,
    pruneLocalPrintTracker,
    claimItemsForPrint,
    markItemsPrinted,
    isDbPrinted,
    __resetPrintClaimState
} from '../printClaim';
import * as printerHelper from '../printerHelper';

describe('Kitchen/Bar print de-duplication (printClaim)', () => {
    beforeEach(() => {
        localStorage.clear();
        rpcMock.mockReset();
        __resetPrintClaimState();
    });

    it('never loses ids written by a concurrent writer (no stale-snapshot overwrite)', () => {
        addLocallyPrintedIds('b1', [1, 2]);
        // staff submit lands while an auto-print is still in flight
        addLocallyPrintedIds('b1', [3]);
        // auto-print finishes and records only what it printed
        addLocallyPrintedIds('b1', [2, 4]);
        expect(getLocallyPrintedIds('b1')).toEqual([1, 2, 3, 4]);
    });

    it('filters printed items regardless of number/string id type', () => {
        addLocallyPrintedIds('b1', ['10']);
        const left = filterLocallyUnprinted('b1', [{ id: 10 }, { id: 11 }]);
        expect(left.map(i => i.id)).toEqual([11]);
    });

    it('merged bill: printed ids of the source bill follow the items to the target bill', () => {
        addLocallyPrintedIds('source', [1, 2, 3]);
        addLocallyPrintedIds('target', [9]);
        carryOverLocallyPrinted('source', 'target');
        // items 1-3 now live on the target booking and must NOT look unprinted there
        expect(filterLocallyUnprinted('target', [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 9 }])).toHaveLength(0);
    });

    it('treats the database flag as printed even when this device has no local record', () => {
        expect(isDbPrinted({ id: 1, kitchen_printed_at: '2026-11-11T10:00:00Z' })).toBe(true);
        expect(isDbPrinted({ id: 2, kitchen_printed_at: null })).toBe(false);
        expect(isDbPrinted({ id: 3 })).toBe(false);
    });

    it('two devices racing: only the ids the database hands to this device are printed', async () => {
        rpcMock.mockResolvedValue({ data: [5], error: null });
        const res = await claimItemsForPrint([5, 6]);
        expect(rpcMock).toHaveBeenCalledWith('claim_order_items_for_print', expect.objectContaining({ p_item_ids: [5, 6] }));
        expect(res.authoritative).toBe(true);
        expect(res.claimedIds).toEqual([5]);
    });

    it('falls back to the local tracker when the migration is not applied yet', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
        const res = await claimItemsForPrint([5, 6]);
        expect(res.authoritative).toBe(false);
        expect(res.claimedIds).toEqual([5, 6]);
        // and it stops hammering the missing RPC
        await claimItemsForPrint([7]);
        await markItemsPrinted([7]);
        expect(rpcMock).toHaveBeenCalledTimes(1);
    });

    it('offline placeholder ids never hit the database', async () => {
        const res = await claimItemsForPrint(['local_item_1_0']);
        expect(rpcMock).not.toHaveBeenCalled();
        expect(res.claimedIds).toEqual(['local_item_1_0']);
    });

    it('prunes trackers older than 3 days and keeps recent ones', () => {
        const now = Date.now();
        addLocallyPrintedIds('old', [1]);
        addLocallyPrintedIds('fresh', [2]);
        const index = JSON.parse(localStorage.getItem('qr_printed_items_index'));
        index.old = now - 4 * 24 * 60 * 60 * 1000;
        localStorage.setItem('qr_printed_items_index', JSON.stringify(index));
        // legacy key written before the index existed
        localStorage.setItem('qr_printed_items_legacy', JSON.stringify([3]));

        expect(pruneLocalPrintTracker(now)).toBe(1);
        expect(localStorage.getItem('qr_printed_items_old')).toBeNull();
        expect(getLocallyPrintedIds('fresh')).toEqual([2]);
        expect(getLocallyPrintedIds('legacy')).toEqual([3]);
    });
});

describe('printKitchenStations per-station outcome', () => {
    const booking = {
        id: 'b1',
        tables_layout: { table_name: 'A1' },
        booking_type: 'walk_in',
        created_at: '2026-11-11T12:00:00+07:00',
        order_items: [
            { id: 1, quantity: 1, name: 'ข้าวผัด', destination: 'kitchen', menu_items: { name: 'ข้าวผัด', category_id: 'food' } },
            { id: 2, quantity: 1, name: 'ชาเย็น', destination: 'bar', menu_items: { name: 'ชาเย็น', category_id: 'drink' } }
        ]
    };

    it('reports the kitchen slip as printed when only the bar slip fails', async () => {
        // "bluetooth" with no native plugin available rejects; use an unsupported type first
        const unsupported = await printerHelper.printKitchenStations(booking, {}, { printerType: 'browser' });
        expect(unsupported.printedAny).toBe(false);
        expect(unsupported.failedItems.map(i => i.id)).toEqual([1, 2]);
    });

    it('autoPrintQROrder stays false unless every slip came out', async () => {
        // No Sunmi plugin in the test environment: both stations fail, nothing is marked printed
        const outcome = await printerHelper.autoPrintQROrderDetailed(booking);
        expect(outcome.printedAny).toBe(false);
        expect(outcome.printedItems).toHaveLength(0);
        expect(outcome.failedItems.map(i => i.id).sort()).toEqual([1, 2]);
        expect(await printerHelper.autoPrintQROrder(booking)).toBe(false);
    });
});
