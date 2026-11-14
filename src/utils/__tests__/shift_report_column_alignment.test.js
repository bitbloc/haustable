import { describe, it, expect } from 'vitest';
import { encodeShiftClosureReportData, splitPrinterGraphemes } from '../printerHelper';

// Decode the TIS-620 payload back into text lines (ESC/POS command bytes are dropped)
const decodeLines = (bytes) => {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === 0x1b) { i += bytes[i + 1] === 0x40 ? 1 : 2; continue; }
        if (b === 0x1d) { i += bytes[i + 1] === 0x56 && bytes[i + 2] >= 65 ? 3 : 2; continue; }
        if (b === 0x0a) out += '\n';
        else if (b >= 0xa1 && b <= 0xfb) out += String.fromCharCode(0x0e01 + (b - 0xa1));
        else if (b >= 0x20 && b < 0x7f) out += String.fromCharCode(b);
    }
    return out.split('\n');
};

// Printed cell where the line's last character lands (Thai marks stack at zero width)
const rightEdge = (line) => splitPrinterGraphemes(line).length;
const hasThai = (line) => /[฀-๿]/.test(line);

const report = {
    shiftId: '123', staffName: 'A', openedAt: '2026-11-14T04:00:00Z', closedAt: '2026-11-14T10:00:00Z',
    openingFloat: 2950, cashSales: 1759, expectedCash: 4709, actualCash: 4709, difference: 0,
    totalBookings: 8, netSales: 7449, totalIn: 0, totalOut: 0,
    topSellingItems: [
        { name: 'ข้าวสวย', quantity: 7, amount: 105 },
        { name: 'น้ำแร่ FLOW', quantity: 5, amount: 100 },
        { name: 'สะตอผัดกุ้งจริตจัด', quantity: 3, amount: 897 }
    ],
    paymentSales: { cash: { count: 2, amount: 1759 }, qrPromptPay: { count: 6, amount: 5690 } },
    orderTypeSales: { dineIn: { count: 8, amount: 7449 } },
    channelSales: { walkin: { count: 8, amount: 7449 } }
};

describe('shift report slip: amount column stays straight', () => {
    for (const cols of [36, 42, 48]) {
        it(`every amount ends on the same printed cell at ${cols} columns`, () => {
            const lines = decodeLines(encodeShiftClosureReportData({ ...report, maxCols: cols }));
            const amountLines = lines.filter(l => /\d\.\d\d$/.test(l) && !l.includes('฿'));
            expect(amountLines.length).toBeGreaterThan(10);

            const edges = new Set(amountLines.map(rightEdge));
            if (edges.size !== 1) {
                console.log(lines.map(l => `${String(rightEdge(l)).padStart(2)}/${String(l.length).padStart(2)}|${l}|`).join('\n'));
            }
            expect([...edges]).toHaveLength(1);
        });

        it(`no Thai line exceeds the 46-byte hardware buffer at ${cols} columns`, () => {
            const lines = decodeLines(encodeShiftClosureReportData({ ...report, maxCols: cols }));
            lines.filter(hasThai).forEach(l => {
                expect(l.length).toBeLessThanOrEqual(46);
            });
        });
    }
});
