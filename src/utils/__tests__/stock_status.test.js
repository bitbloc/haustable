import { describe, it, expect } from 'vitest';
import { stockStatus } from '../stockUtils';

describe('Stock status for cards and the summary', () => {
    it('only zero (or below) is out', () => {
        expect(stockStatus({ current_quantity: 0, min_stock_threshold: 3 })).toBe('out');
        expect(stockStatus({ current_quantity: -1 })).toBe('out');
        expect(stockStatus({ current_quantity: 2, min_stock_threshold: 3 })).toBe('low');
    });
    it('reorder point sits above the minimum', () => {
        expect(stockStatus({ current_quantity: 4, min_stock_threshold: 3, reorder_point: 5 })).toBe('reorder');
        expect(stockStatus({ current_quantity: 6, min_stock_threshold: 3, reorder_point: 5 })).toBe('ok');
    });
    it('no thresholds set: anything above zero is ok', () => {
        expect(stockStatus({ current_quantity: 0.2 })).toBe('ok');
    });
});
