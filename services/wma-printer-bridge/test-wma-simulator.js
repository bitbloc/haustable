/**
 * Test Simulator: Sends mock ESC/POS Thai LINE MAN receipt data from WMA to localhost:9100
 */

import net from 'net';

// Helper to convert Unicode Thai text to TIS-620 byte buffer
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

// Build authentic ESC/POS byte sequence
function buildMockWmaSlip() {
    const parts = [];

    // ESC @ (Init)
    parts.push(Buffer.from([0x1B, 0x40]));
    // ESC t 21 (CP874 / TIS-620)
    parts.push(Buffer.from([0x1B, 0x74, 21]));
    // ESC a 1 (Center)
    parts.push(Buffer.from([0x1B, 0x61, 1]));
    // GS ! 0x11 (Double height & width)
    parts.push(Buffer.from([0x1D, 0x21, 0x11]));
    parts.push(encodeThaiTis620("LINE MAN DELIVERY\n"));
    
    // Normal size
    parts.push(Buffer.from([0x1D, 0x21, 0x00]));
    parts.push(Buffer.from([0x1B, 0x45, 1])); // Bold
    parts.push(encodeThaiTis620("รหัสออเดอร์: #LM-9821\n"));
    parts.push(Buffer.from([0x1B, 0x45, 0])); // Normal
    parts.push(encodeThaiTis620("--------------------------------\n"));

    // ESC a 0 (Left align)
    parts.push(Buffer.from([0x1B, 0x61, 0]));
    parts.push(encodeThaiTis620("เวลาสั่ง: 16/08/2026 09:15\n"));
    parts.push(encodeThaiTis620("ลูกค้า: K. Somchai\n"));
    parts.push(encodeThaiTis620("โทร: 089-123-4567\n"));
    parts.push(encodeThaiTis620("ไรเดอร์: นเรศ ปานทอง (081-999-8877)\n"));
    parts.push(encodeThaiTis620("หมายเหตุ: แยกน้ำแข็ง ช้อนส้อม ขอหวานน้อยครับ\n"));
    parts.push(encodeThaiTis620("================================\n"));

    // Item 1
    parts.push(encodeThaiTis620("1x อเมริกาโน่เย็น               65.00\n"));
    parts.push(encodeThaiTis620("   - คั่วกลาง\n"));
    parts.push(encodeThaiTis620("   - หวาน 25%\n"));

    // Item 2
    parts.push(encodeThaiTis620("2x ชาไทยเย็น                  120.00\n"));
    parts.push(encodeThaiTis620("   - หวานปกติ 100%\n"));

    // Item 3
    parts.push(encodeThaiTis620("1x ครัวซองต์เนยสด               85.00\n"));
    parts.push(encodeThaiTis620("   - อุ่นร้อน\n"));

    parts.push(encodeThaiTis620("================================\n"));
    // ESC a 2 (Right align)
    parts.push(Buffer.from([0x1B, 0x61, 2]));
    parts.push(Buffer.from([0x1B, 0x45, 1])); // Bold
    parts.push(encodeThaiTis620("รวมทั้งสิ้น: 270.00 บาท\n"));
    parts.push(Buffer.from([0x1B, 0x45, 0]));
    parts.push(encodeThaiTis620("สถานะ: ชำระเงินแล้ว (LINE MAN Pay)\n"));

    // Feed and Cut (GS V 66 0)
    parts.push(Buffer.from([0x1B, 0x64, 3]));
    parts.push(Buffer.from([0x1D, 0x56, 66, 0]));

    return Buffer.concat(parts);
}

const client = new net.Socket();
const PORT = 9100;
const HOST = '127.0.0.1';

console.log(`📡 Connecting to WMA Bridge at ${HOST}:${PORT}...`);

client.connect(PORT, HOST, () => {
    console.log(`✅ Connected! Sending mock LINE MAN print stream...`);
    const slipData = buildMockWmaSlip();
    client.write(slipData, () => {
        console.log(`📤 Mock WMA receipt sent (${slipData.length} bytes).`);
        setTimeout(() => {
            client.end();
            console.log(`🏁 Connection finished.`);
            process.exit(0);
        }, 800);
    });
});

client.on('error', (err) => {
    console.error(`❌ Connection failed:`, err.message);
    console.log(`💡 Make sure the bridge server is running: 'node services/wma-printer-bridge/wma-bridge-server.js'`);
    process.exit(1);
});
