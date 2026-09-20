import { describe, it, expect, vi, beforeEach } from 'vitest';
import { optimizeImageUrl, SUPABASE_STORAGE_HOST } from '../urlHelper';
import { optimizeImageUrl as optimizeMenuUrl } from '../menuHelper';
import { exportAuditLogsToCsv } from '../auditLogger';

describe('Supabase Pro Optimization Suite', () => {

    describe('Image Transformations (Strict Internal Only)', () => {
        it('transforms internal Supabase storage URLs to native /render/image/ with WebP', () => {
            const rawUrl = `https://${SUPABASE_STORAGE_HOST}/storage/v1/object/public/menu/dish1.jpg`;
            const optimized = optimizeImageUrl(rawUrl, 400, 80);

            expect(optimized).toContain(`https://${SUPABASE_STORAGE_HOST}/storage/v1/render/image/public/menu/dish1.jpg`);
            expect(optimized).toContain('width=400');
            expect(optimized).toContain('quality=80');
            expect(optimized).toContain('format=webp');
            expect(optimized).not.toContain('wsrv.nl');
        });

        it('routes external URLs through wsrv.nl proxy without touching Supabase', () => {
            const externalUrl = 'https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80';
            const optimized = optimizeImageUrl(externalUrl, 600, 75);

            expect(optimized).toContain('https://wsrv.nl/?url=');
            expect(optimized).toContain('w=600');
            expect(optimized).toContain('output=webp');
        });

        it('supports forceExternal flag to preserve public ad bandwidth quota', () => {
            const rawUrl = `https://${SUPABASE_STORAGE_HOST}/storage/v1/object/public/menu/promo.jpg`;
            const forcedExternal = optimizeImageUrl(rawUrl, 850, 75, true);

            expect(forcedExternal).toContain('https://wsrv.nl/?url=');
            expect(forcedExternal).not.toContain('/render/image/');
        });

        it('transforms menuHelper image URLs for internal items', () => {
            const menuRaw = `https://${SUPABASE_STORAGE_HOST}/storage/v1/object/public/menu/coffee.png`;
            const optimized = optimizeMenuUrl(menuRaw, 300);

            expect(optimized).toContain(`https://${SUPABASE_STORAGE_HOST}/storage/v1/render/image/public/menu/coffee.png`);
            expect(optimized).toContain('width=300');
            expect(optimized).toContain('format=webp');
        });
    });

    describe('Staff Activity & Audit Logs CSV Export', () => {
        beforeEach(() => {
            // Mock DOM URL and Blob for CSV export test
            global.Blob = vi.fn().mockImplementation(function (content, options) {
                this.content = content;
                this.options = options;
            });
            global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
            global.URL.revokeObjectURL = vi.fn();
        });

        it('generates UTF-8 BOM CSV with Thai headers and data', () => {
            const sampleLogs = [
                {
                    created_at: '2026-09-20T10:30:00.000Z',
                    staff_name: 'สมชาย',
                    module: 'pos',
                    action_type: 'move_table',
                    title: 'ย้ายโต๊ะ: โต๊ะ 04 → โต๊ะ 08',
                    description: 'ลูกค้าย้ายโต๊ะ (4 ท่าน)',
                    amount: 0,
                    metadata: { from_table: '04', to_table: '08' }
                },
                {
                    created_at: '2026-09-20T11:00:00.000Z',
                    staff_name: 'สมหญิง',
                    module: 'stock',
                    action_type: 'stock_audit',
                    title: 'ตรวจนับสต็อก: เมล็ดกาแฟ',
                    description: 'นับยอดจริง 10 กก.',
                    amount: 10,
                    metadata: { item_name: 'เมล็ดกาแฟ', unit: 'กก.' }
                }
            ];

            const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

            exportAuditLogsToCsv(sampleLogs, 'test_audit.csv');

            expect(global.Blob).toHaveBeenCalled();
            const [blobArgs] = global.Blob.mock.calls[0];
            const csvString = blobArgs[0];

            // Verify UTF-8 BOM is present for Thai Excel compatibility
            expect(csvString.startsWith('\uFEFF')).toBe(true);
            expect(csvString).toContain('วันที่-เวลา,พนักงาน,หมวดหมู่,การกระทำ,หัวข้อ,คำอธิบาย/เหตุผล,ยอดเงิน/จำนวน,Metadata');
            expect(csvString).toContain('สมชาย');
            expect(csvString).toContain('POS');
            expect(csvString).toContain('ย้ายโต๊ะ');
            expect(csvString).toContain('สมหญิง');
            expect(csvString).toContain('STOCK');

            appendChildSpy.mockRestore();
            removeChildSpy.mockRestore();
        });

        it('handles SOP recipes and Admin backoffice audit events properly in CSV', () => {
            const sampleLogs = [
                {
                    created_at: '2026-09-20T12:00:00.000Z',
                    staff_name: 'บาริสต้าต้อม',
                    module: 'sop',
                    action_type: 'sop_update',
                    title: 'แก้ไขสูตร SOP: มัทฉะลาเต้เย็น',
                    description: 'ปรับระดับความหวานและเวลาสกัด',
                    amount: 0,
                    metadata: { sop_id: 'sop_123', name: 'มัทฉะลาเต้เย็น' }
                },
                {
                    created_at: '2026-09-20T12:15:00.000Z',
                    staff_name: 'ผู้จัดการร้าน',
                    module: 'admin',
                    action_type: 'floorplan_save',
                    title: 'บันทึกผังร้านทั้งหมด (24 โต๊ะ)',
                    description: 'ปรับผังที่นั่งโซนริมน้ำ',
                    amount: 0,
                    metadata: { tables_count: 24 }
                }
            ];

            const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

            exportAuditLogsToCsv(sampleLogs, 'sop_audit.csv');

            expect(global.Blob).toHaveBeenCalled();
            const [blobArgs] = global.Blob.mock.calls[0];
            const csvString = blobArgs[0];

            expect(csvString).toContain('บาริสต้าต้อม');
            expect(csvString).toContain('SOP');
            expect(csvString).toContain('แก้ไขสูตร SOP: มัทฉะลาเต้เย็น');
            expect(csvString).toContain('ผู้จัดการร้าน');
            expect(csvString).toContain('ADMIN');
            expect(csvString).toContain('บันทึกผังร้านทั้งหมด (24 โต๊ะ)');

            appendChildSpy.mockRestore();
            removeChildSpy.mockRestore();
        });

        it('handles service toggle, calendar blocker, and table open/close audit events properly in CSV', () => {
            const toggleLogs = [
                {
                    created_at: '2026-09-20T12:20:00.000Z',
                    staff_name: 'Admin',
                    module: 'admin',
                    action_type: 'toggle_service_table',
                    title: 'ปรับโหมดรับจองโต๊ะ: ปิดรับจอง (Manual)',
                    description: 'ปิดรับจองโต๊ะทานที่ร้านชั่วคราว (Manual Close)',
                    amount: 0,
                    metadata: { setting_key: 'shop_mode_table', value: 'manual_close' }
                },
                {
                    created_at: '2026-09-20T12:22:00.000Z',
                    staff_name: 'Admin',
                    module: 'admin',
                    action_type: 'calendar_block_dates',
                    title: 'ปิดรับจองในปฏิทิน (2 วัน)',
                    description: 'ปิดรับจองในปฏิทิน (2 วัน): ปิดปรับปรุงร้าน',
                    amount: 0,
                    metadata: { dates: ['2026-09-25', '2026-09-26'], count: 2, reason: 'ปิดปรับปรุงร้าน' }
                },
                {
                    created_at: '2026-09-20T12:25:00.000Z',
                    staff_name: 'Cashier',
                    module: 'pos',
                    action_type: 'table_seat_walkin',
                    title: 'เปิดโต๊ะ Walk-in: โต๊ะ 01 (4 ท่าน)',
                    description: 'เปิดโต๊ะ Walk-in: โต๊ะ 01 (4 ท่าน)',
                    amount: 0,
                    metadata: { table_name: 'โต๊ะ 01', pax: 4 }
                }
            ];

            const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

            exportAuditLogsToCsv(toggleLogs, 'toggle_audit.csv');

            expect(global.Blob).toHaveBeenCalled();
            const [blobArgs] = global.Blob.mock.calls[0];
            const csvString = blobArgs[0];

            expect(csvString).toContain('ปรับโหมดรับจองโต๊ะ: ปิดรับจอง (Manual)');
            expect(csvString).toContain('ปิดรับจองในปฏิทิน (2 วัน)');
            expect(csvString).toContain('เปิดโต๊ะ Walk-in: โต๊ะ 01 (4 ท่าน)');

            appendChildSpy.mockRestore();
            removeChildSpy.mockRestore();
        });
    });

});

