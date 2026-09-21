import { describe, it, expect } from 'vitest';
import { resolveMenuItemId } from '../menuHelper';

describe('POS Menu Key-In & Slip Printing Integrity', () => {
    describe('resolveMenuItemId', () => {
        it('resolves integer id properly', () => {
            expect(resolveMenuItemId({ id: 55, name: 'Espresso' })).toBe(55);
            expect(resolveMenuItemId({ menu_item_id: 102, name: 'Latte' })).toBe(102);
        });

        it('resolves numeric string id to integer', () => {
            expect(resolveMenuItemId({ id: '55', name: 'Espresso' })).toBe(55);
            expect(resolveMenuItemId({ menu_item_id: '102', name: 'Latte' })).toBe(102);
        });

        it('filters out draft, local, and custom temporary ids to null', () => {
            expect(resolveMenuItemId({ id: 'draft_172658_abc', name: 'Draft Item' })).toBeNull();
            expect(resolveMenuItemId({ id: 'local_item_172658_1', name: 'Local Item' })).toBeNull();
            expect(resolveMenuItemId({ id: 'custom_172658_xyz', name: 'Custom Item' })).toBeNull();
            expect(resolveMenuItemId({ id: 'cart_item_0', name: 'Cart Item' })).toBeNull();
            expect(resolveMenuItemId({ id: 'reward-stamp-10', name: 'Free Drink' })).toBeNull();
        });

        it('returns null for custom or emergency items', () => {
            expect(resolveMenuItemId({ id: 55, is_custom: true, name: 'Customized' })).toBeNull();
            expect(resolveMenuItemId({ id: 55, is_emergency: true, name: 'Emergency Item' })).toBeNull();
        });

        it('returns null for null, undefined, or empty item', () => {
            expect(resolveMenuItemId(null)).toBeNull();
            expect(resolveMenuItemId(undefined)).toBeNull();
            expect(resolveMenuItemId({})).toBeNull();
            expect(resolveMenuItemId({ id: '' })).toBeNull();
        });

        it('supports valid UUIDs if used by database', () => {
            const uuid = '7524bb8a-4698-45c6-aa17-d8ccc296f667';
            expect(resolveMenuItemId({ id: uuid })).toBe(uuid);
        });
    });

    describe('Open bills slip type determination', () => {
        it('assigns receipt for completed and paid orders, kitchen for active open orders', () => {
            const resolveSlipType = (order) => {
                return (order.status === 'completed' || order.status === 'paid' || order.status === 'success') 
                    ? 'receipt' 
                    : 'kitchen';
            };

            expect(resolveSlipType({ status: 'completed' })).toBe('receipt');
            expect(resolveSlipType({ status: 'paid' })).toBe('receipt');
            expect(resolveSlipType({ status: 'success' })).toBe('receipt');
            expect(resolveSlipType({ status: 'seated' })).toBe('kitchen');
            expect(resolveSlipType({ status: 'pending' })).toBe('kitchen');
            expect(resolveSlipType({ status: 'confirmed' })).toBe('kitchen');
        });
    });

    describe('Session preservation for pickup and walk-in orders', () => {
        it('correctly matches same session for both pickup orders (both null table)', () => {
            const prev = { table: null, items: [{ id: 'draft_1', name: 'Latte' }] };
            const latestBooking = { table_id: null, id: 'b_123' };
            const activeBooking = { id: 'b_123' };

            const isSameBooking = activeBooking?.id && latestBooking?.id && String(activeBooking.id) === String(latestBooking.id);
            const isSameTable = (prev?.table?.id && latestBooking.table_id && String(prev.table.id) === String(latestBooking.table_id));
            const isBothPickup = (!prev?.table?.id && !latestBooking.table_id);
            const isSameSession = isSameBooking || isSameTable || isBothPickup;

            expect(isSameSession).toBe(true);
            const localDraftItems = isSameSession ? prev.items.filter(i => !i.db_id) : [];
            expect(localDraftItems).toHaveLength(1);
            expect(localDraftItems[0].name).toBe('Latte');
        });
    });

    describe('Pickup Date & Time Slip Formatting', () => {
        it('resolves pickup appointment date and time for pickup slip', () => {
            const booking = {
                id: 'pickup-test-1',
                booking_type: 'pickup',
                created_at: '2026-09-21T04:02:00.000Z', // 11:02 Thai time
                booking_time: '2026-09-21T05:30:00.000Z', // 12:30 Thai time
            };

            const isPickupOrder = booking.booking_type === 'pickup';
            const pickupAppointmentRaw = booking.booking_time || booking.pickup_time || booking.service_time;
            const resolvedAppointmentDate = pickupAppointmentRaw ? new Date(pickupAppointmentRaw) : null;
            const pickupDisplayStr = resolvedAppointmentDate ? resolvedAppointmentDate.toLocaleString('th-TH', {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            }) : null;

            expect(isPickupOrder).toBe(true);
            expect(pickupDisplayStr).toContain('2569');
            expect(pickupDisplayStr).toContain('12:30');
        });

        it('extracts pickup time from customer note if booking_time is not set', () => {
            const booking = {
                id: 'pickup-test-2',
                booking_type: 'pickup',
                created_at: '2026-09-21T04:02:00.000Z',
                customer_note: 'เวลานัดรับ: 13:45 ขอเผ็ดน้อย',
            };

            const combinedNotes = `${booking.customer_note || ''} ${booking.staff_remark || ''}`;
            const match = combinedNotes.match(/(?:เวลานัดรับ|เวลารับ|รับเวลา|pickup time)[:\s]*([0-9]{1,2}[:.][0-9]{2})/i);
            const pickupDisplayStr = match && match[1] ? `${match[1].replace('.', ':')} น.` : null;

            expect(pickupDisplayStr).toBe('13:45 น.');
        });
    });
});

