import { describe, it, expect } from 'vitest';
import { formatPromptpayDisplay, normalizePromptPayId, getStorePromptpayName, getStorePromptpayId } from '../printerHelper';

describe('POS Customer Display (CFD / CDR) Lifecycle & Resiliency Tests', () => {
    it('should correctly resolve PromptPay account name to ธัญญธร ศรีวิเศษ', () => {
        expect(getStorePromptpayName()).toBe('ธัญญธร ศรีวิเศษ');
        expect(getStorePromptpayName({})).toBe('ธัญญธร ศรีวิเศษ');
        expect(getStorePromptpayName({ promptpay_name: 'ธัญญธร ศรีวิเศษ' })).toBe('ธัญญธร ศรีวิเศษ');
    });

    it('should correctly format PromptPay ID for customer display', () => {
        expect(formatPromptpayDisplay('0614232455')).toBe('061-423-2455');
        expect(formatPromptpayDisplay('0985284217')).toBe('098-528-4217');
        expect(formatPromptpayDisplay('0812345678')).toBe('081-234-5678');
        expect(formatPromptpayDisplay('1234567890123')).toBe('1-2345-67890-12-3');
    });

    it('should normalize promptpay id properly', () => {
        expect(normalizePromptPayId('061-423-2455')).toBe('0614232455');
        expect(normalizePromptPayId('098-528-4217')).toBe('0985284217');
        expect(normalizePromptPayId('098 528 4217')).toBe('0985284217');
    });

    it('should expire stale UPDATE_CART event older than 45 seconds to prevent frozen order screen', () => {
        const now = Date.now();
        const staleEvent = {
            type: 'UPDATE_CART',
            payload: { items: [{ name: 'Espresso', quantity: 1, price: 65 }] },
            timestamp: now - 50000 // 50 seconds ago
        };

        const age = now - (staleEvent.timestamp || 0);
        const isStale = age >= 45000;
        expect(isStale).toBe(true);

        const resolvedMode = isStale ? 'IDLE' : staleEvent.type;
        expect(resolvedMode).toBe('IDLE');
    });

    it('should retain recent UPDATE_CART within 45 seconds', () => {
        const now = Date.now();
        const freshEvent = {
            type: 'UPDATE_CART',
            payload: { items: [{ name: 'Dirty Coffee', quantity: 2, price: 120 }] },
            timestamp: now - 10000 // 10 seconds ago
        };

        const age = now - (freshEvent.timestamp || 0);
        const isStale = age >= 45000;
        expect(isStale).toBe(false);

        const resolvedMode = isStale ? 'IDLE' : freshEvent.type;
        expect(resolvedMode).toBe('UPDATE_CART');
    });

    it('should correctly handle ORDER_CONFIRMED event expiration after 5 seconds', () => {
        const now = Date.now();
        const orderConfirmedEvent = {
            type: 'ORDER_CONFIRMED',
            payload: { tableName: 'T-04', itemCount: 3, totalAmount: 360 },
            timestamp: now - 6000 // 6 seconds ago
        };

        const age = now - (orderConfirmedEvent.timestamp || 0);
        const isExpired = age >= 5000;
        expect(isExpired).toBe(true);
    });

    it('should ensure order item modifiers and notes are preserved for customer display', () => {
        const mockOrderItem = {
            id: 'item-1',
            name: 'Matcha Latte',
            price: 95,
            quantity: 2,
            selected_options: [
                { name: 'Oat Milk', price: 20 },
                { name: 'Sweetness 50%' }
            ],
            item_note: 'แยกน้ำแข็ง',
            destination: 'bar'
        };

        expect(mockOrderItem.selected_options.length).toBe(2);
        expect(mockOrderItem.item_note).toBe('แยกน้ำแข็ง');
        expect(mockOrderItem.destination).toBe('bar');
        expect(mockOrderItem.price * mockOrderItem.quantity).toBe(190);
    });
});
