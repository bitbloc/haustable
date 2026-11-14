import { describe, it, expect } from 'vitest';
import {
    normalizeBarcode, parseShopLabel, shopLabelFor, buildBarcodeIndex, resolveScan, createScanGate, addScanToCount
} from '../stockBarcode';

const ID = '2c2c49d6-8765-464f-94d4-4cdf924006f2';

describe('normalizeBarcode', () => {
    it('treats the 13-digit form of a UPC-A code as the 12-digit code', () => {
        expect(normalizeBarcode('0012345678905')).toBe('012345678905');
        expect(normalizeBarcode(' 8851234567890 ')).toBe('8851234567890');
        expect(normalizeBarcode('885 1234 567890')).toBe('8851234567890');
        expect(normalizeBarcode(null)).toBe('');
    });
});

describe('shop labels', () => {
    it('round-trips an item id and rejects anything else', () => {
        expect(parseShopLabel(shopLabelFor(ID))).toBe(ID);
        expect(parseShopLabel('inhaus:stock:' + ID.toUpperCase())).toBe(ID);
        expect(parseShopLabel('INHAUS:STOCK:not-an-id')).toBeNull();
        expect(parseShopLabel('8851234567890')).toBeNull();
    });
});

describe('buildBarcodeIndex / resolveScan', () => {
    const items = [{ id: 'soda', barcode: '8850999320014' }, { id: 'milk', barcode: null }];
    const extra = [
        { barcode: '8850999320991', stock_item_id: 'soda', units_per_scan: 24 },
        { barcode: '8850999320014', stock_item_id: 'milk', units_per_scan: 1 },
        { barcode: '8851111111111', stock_item_id: 'milk', units_per_scan: 0 }
    ];
    const index = buildBarcodeIndex(items, extra);

    it('finds items by their own code, extra codes and case codes', () => {
        expect(resolveScan(index, '8850999320014')).toMatchObject({ itemId: 'soda', perScan: 1 });
        expect(resolveScan(index, '8850999320991')).toMatchObject({ itemId: 'soda', perScan: 24 });
        expect(resolveScan(index, '8851111111111')).toMatchObject({ itemId: 'milk', perScan: 1 });
    });

    it('reports unknown codes with the normalized code', () => {
        expect(resolveScan(index, '0012345678905')).toEqual({ itemId: null, perScan: 1, code: '012345678905', isLabel: false });
    });

    it('resolves shop labels only for items on the list', () => {
        expect(resolveScan(index, shopLabelFor(ID), new Set([ID]))).toMatchObject({ itemId: ID, isLabel: true });
        expect(resolveScan(index, shopLabelFor(ID), new Set(['other']))).toMatchObject({ itemId: null, isLabel: true });
    });
});

describe('createScanGate', () => {
    it('counts a held code once and again after it left the view', () => {
        let t = 0;
        const gate = createScanGate(1000, () => t);
        expect(gate.accept('A')).toBe(true);
        t = 300; expect(gate.accept('A')).toBe(false);
        t = 900; expect(gate.accept('A')).toBe(false); // still in view, wait restarts
        t = 2000; expect(gate.accept('A')).toBe(true);
        t = 2100; expect(gate.accept('B')).toBe(true);
        t = 2200; expect(gate.accept('A')).toBe(true);
    });
});

describe('addScanToCount', () => {
    it('adds to the typed count', () => {
        expect(addScanToCount('', 1)).toBe('1');
        expect(addScanToCount('2.5', 1)).toBe('3.5');
        expect(addScanToCount('3', 24)).toBe('27');
        expect(addScanToCount('abc', 1)).toBe('1');
    });
});
