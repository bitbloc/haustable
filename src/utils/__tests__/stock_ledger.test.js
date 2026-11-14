import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpcMock = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({
    supabase: { rpc: (...args) => rpcMock(...args) }
}));

import { postStockMovement, STOCK_REASONS } from '../stockLedger';

describe('postStockMovement', () => {
    beforeEach(() => rpcMock.mockReset());

    it('sends a counted total as mode "set" with rounded quantity', async () => {
        rpcMock.mockResolvedValue({ data: { success: true, old_quantity: 12, new_quantity: 9.1235, quantity_change: -2.8765 }, error: null });

        const res = await postStockMovement({
            itemId: 'item-1', mode: 'set', quantity: 9.12345678,
            reason: STOCK_REASONS.COUNT_ADJUST, performedBy: 'ก้อง', note: 'นับปิดร้าน'
        });

        expect(res.ok).toBe(true);
        expect(res.data.quantity_change).toBe(-2.8765);
        expect(rpcMock).toHaveBeenCalledTimes(1);
        const [name, args] = rpcMock.mock.calls[0];
        expect(name).toBe('post_stock_movement');
        expect(args).toMatchObject({
            p_item_id: 'item-1', p_mode: 'set', p_quantity: 9.1235,
            p_reason: 'count_adjust', p_performed_by: 'ก้อง', p_note: 'นับปิดร้าน',
            p_ref_type: null, p_ref_id: null
        });
    });

    it('passes a signed change and stringifies the reference id', async () => {
        rpcMock.mockResolvedValue({ data: { success: true }, error: null });

        await postStockMovement({
            itemId: 'item-2', mode: 'delta', quantity: -0.25,
            reason: STOCK_REASONS.SALE, refType: 'order_item', refId: 4821
        });

        expect(rpcMock.mock.calls[0][1]).toMatchObject({
            p_mode: 'delta', p_quantity: -0.25, p_reason: 'sale', p_ref_type: 'order_item', p_ref_id: '4821'
        });
    });

    it('rejects bad arguments without calling the database', async () => {
        for (const bad of [
            { itemId: null, mode: 'set', quantity: 1 },
            { itemId: 'x', mode: 'add', quantity: 1 },
            { itemId: 'x', mode: 'delta', quantity: 'abc' }
        ]) {
            const res = await postStockMovement(bad);
            expect(res.ok).toBe(false);
            expect(res.rpcMissing).toBe(false);
        }
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('flags a missing RPC so the caller can fall back', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.post_stock_movement' } });
        const res = await postStockMovement({ itemId: 'x', mode: 'delta', quantity: 1 });
        expect(res.ok).toBe(false);
        expect(res.rpcMissing).toBe(true);
    });

    it('does not treat a real database error as a missing RPC', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'post_stock_movement: unknown reason nonsense' } });
        const res = await postStockMovement({ itemId: 'x', mode: 'delta', quantity: 1, reason: 'nonsense' });
        expect(res.ok).toBe(false);
        expect(res.rpcMissing).toBe(false);
    });
});
