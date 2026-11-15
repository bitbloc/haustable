import { describe, it, expect } from 'vitest';
import { parseMakroUnits } from '../makroUnits';

describe('Units from a makro.pro product', () => {
    it('liquid in litres becomes ml per bottle', () => {
        expect(parseMakroUnits('มิตรผล น้ําเชื่อม 1.8 ล.', '1 ชิ้น')).toMatchObject({ packUnit: 'bottle', usageUnit: 'ml', conversionFactor: 1800 });
        expect(parseMakroUnits('เมจิ นมสดพาสเจอร์ไรซ์ รสจืด 5 ล.', '1 ชิ้น')).toMatchObject({ usageUnit: 'ml', conversionFactor: 5000 });
        expect(parseMakroUnits('มิตรผล น้ําเชื่อมสําเร็จรูป 800 มล.', '1 ชิ้น')).toMatchObject({ usageUnit: 'ml', conversionFactor: 800 });
    });
    it('weight in kg becomes grams; "x 5" makes it a pack', () => {
        expect(parseMakroUnits('มิตรผล น้ําตาลทรายขาวบริสุทธิ์ 5 กก.', '1 ชิ้น')).toMatchObject({ packUnit: 'bag', usageUnit: 'g', conversionFactor: 5000 });
        expect(parseMakroUnits('มิตรผล น้ําตาลทรายขาวบริสุทธิ์ 1 กก. x 5', '5 ชิ้น')).toMatchObject({ packUnit: 'pack', usageUnit: 'g', conversionFactor: 5000 });
        expect(parseMakroUnits('ผงโกโก้ 500 กรัม', '1 ชิ้น')).toMatchObject({ usageUnit: 'g', conversionFactor: 500 });
    });
    it('countable packs (cups, straws) become pieces; ounces on cups are a size, not content', () => {
        expect(parseMakroUnits('เอโร่ แก้วน้ําพลาสติก GPPS ใส 16 ออนซ์ x 50', '50 ชิ้น')).toMatchObject({ packUnit: 'pack', usageUnit: 'pcs', conversionFactor: 50 });
        expect(parseMakroUnits('เอโร่ แก้วพีพี 16 ออนซ์ 100 ชิ้น', '100 ชิ้น')).toMatchObject({ usageUnit: 'pcs', conversionFactor: 100 });
    });
    it('summary says what one pack holds', () => {
        expect(parseMakroUnits('มิตรผล น้ําเชื่อม 1.8 ล.', '1 ชิ้น').summary).toBe('1 ขวด = 1,800 มล.');
        expect(parseMakroUnits('ถ้วย x 50', '50 ชิ้น').summary).toBe('1 แพ็ค = 50 ชิ้น');
    });
    it('returns null when nothing usable is in the title', () => {
        expect(parseMakroUnits('ไข่ไก่ เบอร์ 2', '1 ชิ้น')).toBeNull();
        expect(parseMakroUnits('', '')).toBeNull();
    });
});
