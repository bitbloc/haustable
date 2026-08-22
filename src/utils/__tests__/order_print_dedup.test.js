import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Order Print Deduplication Logic', () => {
    let mockLocalStorage = {};

    beforeEach(() => {
        mockLocalStorage = {};
        global.localStorage = {
            getItem: vi.fn((key) => mockLocalStorage[key] || null),
            setItem: vi.fn((key, val) => { mockLocalStorage[key] = String(val); }),
            removeItem: vi.fn((key) => { delete mockLocalStorage[key]; }),
            clear: vi.fn(() => { mockLocalStorage = {}; })
        };
    });

    it('should filter out already printed items for a booking', () => {
        const bookingId = 'booking-123';
        const storageKey = `qr_printed_items_${bookingId}`;
        
        // Initial state: item 1 and item 2 already printed
        mockLocalStorage[storageKey] = JSON.stringify(['item-1', 'item-2']);

        const orderItems = [
            { id: 'item-1', name: 'Pad Thai', quantity: 1 },
            { id: 'item-2', name: 'Green Tea', quantity: 1 },
            { id: 'item-3', name: 'Mango Sticky Rice', quantity: 1 } // Newly added item
        ];

        const printedItems = JSON.parse(global.localStorage.getItem(storageKey) || '[]');
        const unprintedItems = orderItems.filter(item => item.id && !printedItems.includes(item.id));

        expect(unprintedItems).toHaveLength(1);
        expect(unprintedItems[0].id).toBe('item-3');
    });

    it('should record newly printed items into localStorage with unique set', () => {
        const bookingId = 'booking-456';
        const storageKey = `qr_printed_items_${bookingId}`;

        mockLocalStorage[storageKey] = JSON.stringify(['item-a']);

        const newItems = [{ id: 'item-b' }, { id: 'item-c' }, { id: 'item-a' }];
        const printedItems = JSON.parse(global.localStorage.getItem(storageKey) || '[]');
        const unprintedItems = newItems.filter(item => item.id && !printedItems.includes(item.id));

        const newPrinted = Array.from(new Set([...printedItems, ...unprintedItems.map(i => i.id).filter(Boolean)]));
        global.localStorage.setItem(storageKey, JSON.stringify(newPrinted));

        expect(newPrinted).toEqual(['item-a', 'item-b', 'item-c']);

        // Subsequent check should yield 0 unprinted items
        const updatedPrinted = JSON.parse(global.localStorage.getItem(storageKey) || '[]');
        const subsequentUnprinted = newItems.filter(item => item.id && !updatedPrinted.includes(item.id));
        expect(subsequentUnprinted).toHaveLength(0);
    });

    it('should return 0 unprinted items when staff accepts an already auto-printed QR order', () => {
        const bookingId = 'booking-qr-789';
        const storageKey = `qr_printed_items_${bookingId}`;

        // QR order auto-printed all items upon customer submission
        const initialBookingItems = [
            { id: 'qr-item-1', name: 'Americano', quantity: 2 },
            { id: 'qr-item-2', name: 'Croissant', quantity: 1 }
        ];

        mockLocalStorage[storageKey] = JSON.stringify(['qr-item-1', 'qr-item-2']);

        // Staff opens table and clicks "Accept Order"
        const printed = JSON.parse(global.localStorage.getItem(storageKey) || '[]');
        const unprinted = initialBookingItems.filter(i => i.id && !printed.includes(i.id));

        expect(unprinted).toHaveLength(0);
    });
});
