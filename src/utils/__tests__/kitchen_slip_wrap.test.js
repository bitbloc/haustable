import { describe, it, expect } from 'vitest';
import {
    wrapTextByWords,
    splitKitchenSetName,
    getWeightedPrinterWidth,
    encodeReceiptData,
    KITCHEN_THAI_CELL_WEIGHT
} from '../printerHelper';

const SET_NAME = 'SET SIZE XL สำหรับ 4-6 ท่าน เซตสำรับในบ้าน : ต้มจิ๋ว - คั่วกลิ้งผักแนม - หมูหวานผัดกะปิใต้ - คอหมูย่างในบ้าน - ผัดใบเหลียง - ข้าวสวย 2 โถ';

// Decode the TIS-620 bytes of the double-size (GS ! 0x11) lines back into text
function doubleSizeLines(bytes) {
    const lines = [];
    let big = false;
    let current = '';
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === 0x1D && bytes[i + 1] === 0x21) { big = bytes[i + 2] === 0x11; i += 2; continue; }
        if (b === 0x1B && (bytes[i + 1] === 0x45 || bytes[i + 1] === 0x61 || bytes[i + 1] === 0x74 || bytes[i + 1] === 0x64)) { i += 2; continue; }
        if (b === 0x0A) { if (big) lines.push(current); current = ''; continue; }
        current += b >= 0xA1 ? String.fromCharCode(b - 0xA1 + 0x0E01) : String.fromCharCode(b);
    }
    return lines;
}

describe('kitchen slip: double-size item lines', () => {
    it('splits a set menu name into its title and dishes', () => {
        const { head, components } = splitKitchenSetName(SET_NAME);
        expect(head).toBe('SET SIZE XL สำหรับ 4-6 ท่าน เซตสำรับในบ้าน');
        expect(components).toEqual(['ต้มจิ๋ว', 'คั่วกลิ้งผักแนม', 'หมูหวานผัดกะปิใต้', 'คอหมูย่างในบ้าน', 'ผัดใบเหลียง', 'ข้าวสวย 2 โถ']);
    });

    it('leaves ordinary names alone', () => {
        expect(splitKitchenSetName('ชาไทย - เย็น')).toEqual({ head: 'ชาไทย - เย็น', components: [] });
        expect(splitKitchenSetName('ข้าวผัดกะเพรา')).toEqual({ head: 'ข้าวผัดกะเพรา', components: [] });
        expect(splitKitchenSetName('SET 4-6 ท่าน')).toEqual({ head: 'SET 4-6 ท่าน', components: [] });
    });

    it('never splits a number range across lines', () => {
        const lines = wrapTextByWords('SET SIZE XL สำหรับ 4-6 ท่าน เซตสำรับในบ้าน', 19, false, { thaiCellWeight: KITCHEN_THAI_CELL_WEIGHT });
        expect(lines.some(l => l.includes('4-6'))).toBe(true);
        lines.forEach(l => expect(getWeightedPrinterWidth(l, KITCHEN_THAI_CELL_WEIGHT)).toBeLessThanOrEqual(19));
    });

    it('keeps every printed item line inside the weighted width and one dish per line', () => {
        const booking = {
            id: 'abcd3ef2',
            booking_type: 'dine_in',
            pax: 4,
            tables_layout: { table_name: 'H8' },
            order_items: [{ quantity: 1, custom_name: SET_NAME, menu_items: { name: SET_NAME } }]
        };
        [{ kitchen_max_cols: 48 }, {}].forEach(config => {
            const bytes = encodeReceiptData(booking, 'kitchen', 'cash', {}, '80mm', config, 'sunmi');
            const lines = doubleSizeLines(bytes);
            const itemLines = lines.slice(lines.findIndex(l => l.includes('1x')));
            const dishLines = itemLines.filter(l => l.trim().startsWith('- '));
            expect(dishLines.map(l => l.trim())).toEqual(['- ต้มจิ๋ว', '- คั่วกลิ้งผักแนม', '- หมูหวานผัดกะปิใต้', '- คอหมูย่างในบ้าน', '- ผัดใบเหลียง', '- ข้าวสวย 2 โถ']);
            itemLines.forEach(l => {
                // Includes the centering margin. The 80mm head holds 24 double-width cells; the
                // lines that overran on the printed slip measured just over 24.
                expect(getWeightedPrinterWidth(l, KITCHEN_THAI_CELL_WEIGHT)).toBeLessThanOrEqual(23);
            });
        });
    });
});
