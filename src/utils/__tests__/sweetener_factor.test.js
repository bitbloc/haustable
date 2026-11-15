import { describe, it, expect } from 'vitest';
import { toSweetenerFactor } from '../../admin/components/OptionGroupList';

describe('Sweetness multiplier input', () => {
    it('blank means no effect on sweeteners', () => {
        expect(toSweetenerFactor('')).toBeNull();
        expect(toSweetenerFactor('  ')).toBeNull();
        expect(toSweetenerFactor(null)).toBeNull();
        expect(toSweetenerFactor(undefined)).toBeNull();
        expect(toSweetenerFactor('abc')).toBeNull();
    });
    it('keeps 0 (no sugar) as a real value', () => {
        expect(toSweetenerFactor('0')).toBe(0);
        expect(toSweetenerFactor(0)).toBe(0);
    });
    it('parses and clamps to 0-5', () => {
        expect(toSweetenerFactor('0.5')).toBe(0.5);
        expect(toSweetenerFactor('1.2')).toBe(1.2);
        expect(toSweetenerFactor('-1')).toBe(0);
        expect(toSweetenerFactor('9')).toBe(5);
    });
});
