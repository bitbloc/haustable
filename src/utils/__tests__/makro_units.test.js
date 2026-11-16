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

import { makroPickPatch, unitsLookUnset } from '../makroUnits';

describe('Applying a makro pick to a stock form', () => {
    const syrup = { title: 'มิตรผล น้ําเชื่อม 1.8 ล.', unitSize: '1 ชิ้น', price: 85, image: 'https://img/x.jpg' };
    it('new or unconfigured item: price, units and photo', () => {
        const r = makroPickPatch(syrup, { usage_unit: 'unit', conversion_factor: 1 });
        expect(r.patch).toEqual({ cost_price: 85, image_url: 'https://img/x.jpg', pack_size: 1, pack_unit: 'bottle', usage_unit: 'ml', conversion_factor: 1800 });
    });
    it('item already in ml: pack size updates, usage unit stays ml', () => {
        const r = makroPickPatch(syrup, { usage_unit: 'ml', conversion_factor: 750, image_url: 'mine.jpg' });
        expect(r.appliedUnits).toBe(true);
        expect(r.patch.usage_unit).toBe('ml');
        expect(r.patch.conversion_factor).toBe(1800);
        expect(r.patch.image_url).toBeUndefined();
    });
    it('item used in litres: units are left alone, price only', () => {
        const r = makroPickPatch(syrup, { usage_unit: 'l', conversion_factor: 6, image_url: 'mine.jpg' });
        expect(r.appliedUnits).toBe(false);
        expect(r.patch).toEqual({ cost_price: 85 });
    });
    it('knows an unconfigured item', () => {
        expect(unitsLookUnset({ usage_unit: 'pack', conversion_factor: 1 })).toBe(true);
        expect(unitsLookUnset({ usage_unit: 'g', conversion_factor: 1000 })).toBe(false);
    });
});

// Real makro.pro titles (searched 2026-11-16) that the first parser read wrongly or that guard the rewrite:
// sizes on bags and foil read as counts, counts inside counts, "ก" without a dot, the container word.
const REAL_TITLES = [
['อโรม่า ผงโกโก้สีน้ําตาล 400 ก','1 ชิ้น','1 ถุง = 400 ก.'],
['เอโร่ หลอดหักงอห่อฟิล์ม 5 มม. 21 ซม. สีขาว 100 ชิ้น 5 ห่อ','5 ชิ้น','1 แพ็ค = 500 ชิ้น'],
['เอโร่ หลอดกาแฟสั้น 215 ชิ้น x 10','10 ชิ้น','1 แพ็ค = 2,150 ชิ้น'],
['เอโร่ หลอดงอ 8 มม. 24 ซม. สีน้ําตาล 100 ชิ้น x 10','10 ชิ้น','1 แพ็ค = 1,000 ชิ้น'],
['เอโร่ หลอดหักงอห่อกระดาษสีขาว 21 ซม. 100 เส้น x 10','10 ชิ้น','1 แพ็ค = 1,000 ชิ้น'],
['ถุงซิปใสใส่ซอส ขนาด 5x7 ซม. แพ็ค 1000 ใบ','1 ชิ้น','1 แพ็ค = 1,000 ชิ้น'],
['ARO ถุงซิปใส 12X17 ซม. 0.5กก.','1 ชิ้น','1 ถุง = 500 ก.'],
['ถุงซิปใสใส่ซอส ขนาด 8x12 ซม. แพ็ค 400 ใบ','400 ชิ้น','1 แพ็ค = 400 ชิ้น'],
['เอโร่ ถุงซิปใส 20x30 ซม. 0.5 กก.','1 ชิ้น','1 ถุง = 500 ก.'],
['เอโร่ ไข่ไก่ เบอร์ 0 มีฝา 30 ฟอง','30 ชิ้น','1 แพ็ค = 30 ชิ้น'],
['เอโร่ ไข่ไก่ เบอร์ 3 ไม่มีฝา 30 ฟอง x 5','5 ชิ้น','1 แพ็ค = 150 ชิ้น'],
['ซิลค์ ซอฟท์บ๊อกซ์ กระดาษเช็ดหน้า 115 แผ่น 5 ชิ้น','5 ชิ้น','1 แพ็ค = 5 ชิ้น'],
['เซพแพ็ค กระดาษเช็ดหน้า 150 แผ่น x 5+1','6 ชิ้น','1 แพ็ค = 6 ชิ้น'],
['โจลี่ กระดาษเช็ดหน้า 150 แผ่น 5+1 แพ็ค','6 ชิ้น','1 แพ็ค = 6 ชิ้น'],
['ฮีโร่ ถุงขยะม้วนสีดํา รุ่นรักษ์โลก 24x28 นิ้ว 50 ถุง','50 ชิ้น','1 แพ็ค = 50 ชิ้น'],
['ฮีโร่ ถุงขยะม้วนสีดํา รุ่นรักษ์โลก 30x40 นิ้ว x 25','25 ชิ้น','1 แพ็ค = 25 ชิ้น'],
['ไดมอนด์ อะลูมิเนียมฟอยล์ ขนาด 18 นิ้ว x 37.5 ตรฟ.','1 ชิ้น',null],
['ไดมอนด์ อะลูมิเนียมฟอยล์ 12 นิ้ว x 200 ตารางฟุต','1 ชิ้น',null],
['เอโร่ อลูมิเนียมฟอยล์ พร้อมที่ตัด 30 ซม. 90 ม.','1 ชิ้น',null],
['ทีอีเอ น้ําผึ้งแท้ จากเกสรดอกไม้ป่า แบบแกลลอน 4 กิโลกรัม','1 gallon(s)','1 ขวด = 4,000 ก.'],
['เฟร้นช์ส มัสตาร์ด ขวดบีบ 226 ก.','1 ชิ้น','1 ขวด = 226 ก.'],
['ชาตรามือยกลัง ชาไทย สูตรต้นตํารับ กระป๋องเล็ก 200 กรัม (1x24)','24 ชิ้น','1 แพ็ค = 4,800 ก.'],
['เอโร่ วาซาบิญี่ปุ่น (2.5 ก. x 50 ซอง)','1 ชิ้น','1 แพ็ค = 125 ก.'],
['เชฟคานิ เอ็กซ์เพรส วาซาบิบดสด 2.5 ก. 40 ซอง','1 ชิ้น','1 แพ็ค = 100 ก.'],
['โบนัส น้ํามันปาล์ม 1 ล. 12 ขวด','12 ชิ้น','1 แพ็ค = 12,000 มล.'],
['โบนัส น้ํามันปาล์ม ถุงเติม 1 ล. 12 ถุง','12 ชิ้น','1 แพ็ค = 12,000 มล.'],
['ภูเขาทอง ซอสปรุงรส ฝาเขียว 200 มล. x 6','6 ชิ้น','1 แพ็ค = 1,200 มล.'],
['ชาวเกาะ กะทิ 250 มล. X 6','6 ชิ้น','1 แพ็ค = 1,500 มล.'],
['รสดี ผงปรุง รสหมู 800ก. X 1','1 ชิ้น','1 ถุง = 800 ก.'],
['รสดี ผงปรุง รสหมู 20ก. X 12','12 ชิ้น','1 แพ็ค = 240 ก.'],
['ทิพรส น้ําปลาแท้ ขวดเพ็ท 700 มล.','1 ชิ้น','1 ขวด = 700 มล.'],
['เอโร่ ซอสโชยุสําหรับซูชิ 7 มล. x 50','50 ชิ้น','1 แพ็ค = 350 มล.'],
['มะลิ นมข้นหวาน 355 ก. x 6','6 ชิ้น','1 แพ็ค = 2,130 ก.'],
['ทีพอท นมข้นหวาน สูตรนมสด ชนิดหลอดบีบ 180 ก. x 8','8 ชิ้น','1 แพ็ค = 1,440 ก.'],
['เอโร่ น้ําส้มสายชูกลั่น 5% 4.5 ล.','1 ชิ้น','1 ขวด = 4,500 มล.'],
['เอโร่ แก้วพีพี 10 ออนซ์ 100 ชิ้น','100 ชิ้น','1 แพ็ค = 100 ชิ้น'],
['เอโร่ แก้วน้ําพลาสติก GPPS ใส 16 ออนซ์ x 50','50 ชิ้น','1 แพ็ค = 50 ชิ้น'],
['เทราโอกะ ยูกิ โจโซ ซอสเถั่วเกลือง เหยาะรสอูมามิ 150 มล X1','1 ชิ้น','1 ขวด = 150 มล.'],
['มิตรผล น้ําเชื่อม 1.8 ล.','1 ชิ้น','1 ขวด = 1,800 มล.'],
['ไข่ไก่ เบอร์ 2','1 ชิ้น',null],
['Iceland Spring ขนาด 1,000 ml. (3 ลัง l 45 ขวด) น้ําแร่ด่างธรรมชาติ pH8.88','3 piece(s)','1 แพ็ค = 45,000 มล.'],
['เฟสท์ กล่องกระดาษ 725 มล. x 50','50 ชิ้น','1 แพ็ค = 50 ชิ้น'],
['เซพแพ็ค x อีซี่ กล่องอาหารพร้อมฝา พีพี ใส 640 มล. 25 ชุด','1 ชิ้น','1 แพ็ค = 25 ชิ้น'],
['เอโร่ ถุงร้อน ขนาด 10X15 (บรรจุ 1 ก.ก.)','1 ชิ้น','1 ถุง = 1,000 ก.'],
['เอโร่ ถุงร้อน ขนาด 12"X18" (บรรจุ 1 ก.ก.)','1 ชิ้น','1 ถุง = 1,000 ก.'],
['เนื้อแดงวัว กก.ละ','1 kg','1 ถุง = 1,000 ก.'],
['กุ้งขาว ไซส์ S (61-65 ตัว/กก.)','1 kg','1 ถุง = 1,000 ก.'],
['กุ้งขาวจัมโบ้ 1 กก. (21-25 ตัว/กก.)','1 kg','1 ถุง = 1,000 ก.'],
['เอโร่ ชุดช้อนส้อมยาว พีเอส ใส 100 ชิ้น 50 คู่','50 pair(s)','1 แพ็ค = 100 ชิ้น'],
['เอโร่ ช้อนส้อม 2 มม. x 6 คู่','6 pair(s)','1 แพ็ค = 6 ชิ้น'],
['เอโร่ ถุงมือพลาสติกอเนกประสงค์ 24 ชิ้น x 12','12 ชิ้น','1 แพ็ค = 288 ชิ้น'],
['กระดาษความร้อน ITCAN ขนาด 80X80MM หนา 65แกรม มีแกน 2ม้วน','1 ชิ้น','1 แพ็ค = 2 ชิ้น'],
['เซพแพ็ค กระดาษชําระแบบหนา 2 ชั้น x 40 ม้วน','40 ชิ้น','1 แพ็ค = 40 ชิ้น'],
['วอลล์ คลาสสิก ไอศกรีมกล่องรวมมิตร 420 ก.','1 ชิ้น','1 กล่อง = 420 ก.'],
['สิงห์ โซดา 325 มล. x 24','24 ชิ้น','1 แพ็ค = 7,800 มล.'],
['เอโร่ แก้วจัมโบ้ PP ใส พร้อมฝา ขนาด 32 ออนซ์ x 25','25 ชิ้น','1 แพ็ค = 25 ชิ้น'],
]

describe('Units from real makro titles', () => {
    it.each(REAL_TITLES)('%s', (title, unitSize, summary) => {
        const units = parseMakroUnits(title, unitSize);
        expect(units ? units.summary : null).toBe(summary);
    });
});
