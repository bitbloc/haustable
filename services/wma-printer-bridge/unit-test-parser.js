import { decodeAndParseWmaBuffer, parseWmaOrderText } from './wma-parser.js';

function encodeThaiTis620(str) {
    const bytes = [];
    const textStr = String(str ?? '');
    for (let i = 0; i < textStr.length; i++) {
        const code = textStr.charCodeAt(i);
        if (code >= 0x0E01 && code <= 0x0E5B) {
            bytes.push(code - 0x0E00 + 0xA0);
        } else if (code < 128) {
            bytes.push(code);
        } else {
            bytes.push(32);
        }
    }
    return Buffer.from(bytes);
}

const mockText = `
LINE MAN DELIVERY
รหัสออเดอร์: #LM-9821
--------------------------------
เวลาสั่ง: 16/08/2026 09:15
ลูกค้า: K. Somchai
โทร: 089-123-4567
ไรเดอร์: นเรศ ปานทอง (081-999-8877)
หมายเหตุ: แยกน้ำแข็ง ช้อนส้อม ขอหวานน้อยครับ
================================
1x อเมริกาโน่เย็น               65.00
   - คั่วกลาง
   - หวาน 25%
2x ชาไทยเย็น                  120.00
   - หวานปกติ 100%
1x ครัวซองต์เนยสด               85.00
   - อุ่นร้อน
================================
รวมทั้งสิ้น: 270.00 บาท
สถานะ: ชำระเงินแล้ว (LINE MAN Pay)
`;

const rawBuffer = encodeThaiTis620(mockText);
const parsed = decodeAndParseWmaBuffer(rawBuffer);

console.log('=== TEST RESULT ===');
console.log(JSON.stringify(parsed, null, 2));

if (parsed.order_id === '#LM-9821' && parsed.items.length === 3 && parsed.total_amount === 270 && parsed.customer_phone === '089-123-4567') {
    console.log('\n✅ ALL PARSER ASSERTIONS PASSED!');
    process.exit(0);
} else {
    console.error('\n❌ PARSER ASSERTION FAILED!');
    process.exit(1);
}
