import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpcMock = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({
    supabase: { rpc: (...args) => rpcMock(...args) }
}));

import { logOrderItemRemoval, cancelOrderItemRemoval, REMOVAL_REASONS } from '../orderItemRemoval';

describe('logOrderItemRemoval', () => {
    beforeEach(() => rpcMock.mockReset());

    it('sends the cleaned id, new quantity and reason', async () => {
        rpcMock.mockResolvedValue({ data: { success: true, removal_id: 42 }, error: null });
        const res = await logOrderItemRemoval({ orderItemId: 'db_815', newQuantity: 1, reason: 'made_wasted', removedBy: 'ก้อง', note: 'ทำหก' });
        expect(rpcMock).toHaveBeenCalledWith('log_order_item_removal', {
            p_order_item_id: 815, p_new_quantity: 1, p_reason: 'made_wasted', p_removed_by: 'ก้อง', p_note: 'ทำหก'
        });
        expect(res).toMatchObject({ ok: true, removalId: 42 });
    });

    it('rejects an unknown reason or a draft id without calling the database', async () => {
        expect((await logOrderItemRemoval({ orderItemId: 5, newQuantity: 0, reason: 'oops' })).ok).toBe(false);
        expect((await logOrderItemRemoval({ orderItemId: 'local_123', newQuantity: 0, reason: 'not_made' })).ok).toBe(false);
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('reports a database without the function so the POS carries on', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
        const res = await logOrderItemRemoval({ orderItemId: 5, newQuantity: 0, reason: 'not_made' });
        expect(res).toMatchObject({ ok: false, rpcMissing: true });
    });

    it('never throws on a network failure', async () => {
        rpcMock.mockResolvedValue({ data: null, error: new Error('offline') });
        const res = await logOrderItemRemoval({ orderItemId: 5, newQuantity: 0, reason: 'not_made' });
        expect(res.ok).toBe(false);
    });

    it('offers exactly the two reasons the database accepts', () => {
        expect(REMOVAL_REASONS.map(r => r.key)).toEqual(['not_made', 'made_wasted']);
    });
});

describe('cancelOrderItemRemoval', () => {
    beforeEach(() => rpcMock.mockReset());

    it('cancels by id and ignores an empty id', async () => {
        rpcMock.mockResolvedValue({ data: { success: true }, error: null });
        expect(await cancelOrderItemRemoval(42)).toBe(true);
        expect(rpcMock).toHaveBeenCalledWith('cancel_order_item_removal', { p_removal_id: 42 });
        expect(await cancelOrderItemRemoval(null)).toBe(false);
        expect(rpcMock).toHaveBeenCalledTimes(1);
    });
});
