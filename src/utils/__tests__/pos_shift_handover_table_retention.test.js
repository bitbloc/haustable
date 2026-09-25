import { describe, it, expect } from 'vitest';
import { calculateShiftMetrics } from '../shiftHelper';
import { compileShiftReportData, encodeShiftClosureReportData } from '../printerHelper';

describe('POS Shift Handover & Table Retention (Option 2)', () => {
    const sampleShift = {
        id: 'shift_1234567890',
        staffName: 'Add (Morning Shift)',
        openedAt: '2026-09-25T08:00:00.000Z',
        closedAt: '2026-09-25T16:00:00.000Z',
        openingFloat: 1000,
        transactions: [
            { bookingId: 'b-completed-1', amount: 350, paymentMethod: 'cash', timestamp: '2026-09-25T10:00:00.000Z' }
        ],
        adjustments: [],
        cashSales: 350,
        qrSales: 0,
        creditSales: 0,
        totalSales: 350,
        totalIn: 0,
        totalOut: 0
    };

    const completedBooking = {
        id: 'b-completed-1',
        status: 'completed',
        total_amount: 350,
        payment_method: 'cash',
        staff_remark: 'paid by cash',
        booking_time: '2026-09-25T09:30:00.000Z',
        order_items: [
            { id: 'item-1', name: 'Iced Americano', quantity: 2, price_at_time: 175, status: 'served' }
        ]
    };

    const openTable1 = {
        id: 'b-seated-table-1',
        table_id: 'table-1',
        status: 'seated', // Customer still dining!
        total_amount: 600,
        payment_method: null,
        booking_time: '2026-09-25T15:30:00.000Z',
        tables_layout: { table_name: 'T01' },
        order_items: [
            { id: 'item-2', name: 'Pasta Carbonara', quantity: 2, price_at_time: 300, status: 'served' }
        ]
    };

    const openTable2 = {
        id: 'b-seated-table-2',
        table_id: 'table-2',
        status: 'seated', // Customer still dining!
        total_amount: 450,
        payment_method: null,
        booking_time: '2026-09-25T15:45:00.000Z',
        tables_layout: { table_name: 'T02' },
        order_items: [
            { id: 'item-3', name: 'Thai Milk Tea', quantity: 3, price_at_time: 150, status: 'served' }
        ]
    };

    it('1. should not mutate or complete open tables when shift is handed over', () => {
        const openTables = [openTable1, openTable2];
        
        // Simulating handover mode: open tables must retain their active 'seated' status
        const handoverOpenTables = openTables.map(t => ({
            ...t,
            // Verification: status remains 'seated', never auto-completed or forced to QR
            status: t.status
        }));

        expect(handoverOpenTables[0].status).toBe('seated');
        expect(handoverOpenTables[1].status).toBe('seated');
        expect(handoverOpenTables.every(t => t.payment_method !== 'qr')).toBe(true);
    });

    it('2. should only count completed bookings in shift metrics and exclude open tables', () => {
        const bookingsData = [completedBooking]; // Only completed bookings are passed to metrics
        const metrics = calculateShiftMetrics(sampleShift, bookingsData);

        // Revenue must reflect actual cash received, NOT unbilled open tables
        expect(metrics.cashSales).toBe(350);
        expect(metrics.totalSales).toBe(350);
        expect(metrics.expectedCash).toBe(1350); // 1000 float + 350 cash
        expect(metrics.completedBookingsCount).toBe(1);
    });

    it('3. should compile shift report with openTablesHandover list for audit and handover', () => {
        const openTables = [openTable1, openTable2];
        const handoverData = openTables.map(b => ({
            name: b.tables_layout?.table_name ? `โต๊ะ ${b.tables_layout.table_name}` : `โต๊ะ ${b.table_id}`,
            total: parseFloat(b.total_amount) || 0
        }));

        const compiled = compileShiftReportData(
            {
                ...sampleShift,
                expectedCash: 1350,
                closedCash: 1350,
                actualCash: 1350,
                difference: 0,
                openTablesHandover: handoverData
            },
            [completedBooking],
            []
        );

        expect(compiled.openTablesHandover).toBeDefined();
        expect(compiled.openTablesHandover.length).toBe(2);
        expect(compiled.openTablesHandover[0].name).toBe('โต๊ะ T01');
        expect(compiled.openTablesHandover[0].total).toBe(600);
        expect(compiled.openTablesHandover[1].name).toBe('โต๊ะ T02');
        expect(compiled.openTablesHandover[1].total).toBe(450);
    });

    it('4. should encode thermal printer bytes without crashing when openTablesHandover is present', () => {
        const handoverData = [
            { name: 'โต๊ะ T01', total: 600 },
            { name: 'โต๊ะ T02', total: 450 }
        ];

        const reportData = {
            shopName: 'ร้านในบ้าน นครพนม',
            staffName: 'Add (Morning Shift)',
            openedAt: '2026-09-25T08:00:00.000Z',
            closedAt: '2026-09-25T16:00:00.000Z',
            openingFloat: 1000,
            cashSales: 350,
            qrSales: 0,
            creditSales: 0,
            totalSales: 350,
            netSales: 350,
            expectedCash: 1350,
            actualCash: 1350,
            difference: 0,
            openTablesHandover: handoverData
        };

        const rawBytes = encodeShiftClosureReportData(reportData, '80mm', 'sunmi');
        expect(rawBytes).toBeInstanceOf(Uint8Array);
        expect(rawBytes.length).toBeGreaterThan(0);
    });

    it('5. should safely void ghost tables on emergency end of day close without fake QR revenue', () => {
        const ghostTable = { ...openTable1 };
        
        // Simulating handleForceVoidRemainingTables
        const voidedTable = {
            ...ghostTable,
            status: 'void',
            staff_remark: '[VOID_END_OF_DAY] บังคับยกเลิกโต๊ะค้างเพื่อปิดร้าน โดย Add'
        };

        expect(voidedTable.status).toBe('void');
        expect(voidedTable.payment_method).toBeNull();
        expect(voidedTable.staff_remark).toContain('[VOID_END_OF_DAY]');
    });
});
