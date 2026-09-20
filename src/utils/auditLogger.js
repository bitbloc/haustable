import { supabase } from '../lib/supabaseClient';
import { getCurrentShift } from './shiftHelper';

/**
 * Centrally records staff & system activity across POS, Stock, Shifts, and Backoffice Admin.
 *
 * @param {string} module - 'pos' | 'stock' | 'shift' | 'admin' | 'crm' | 'tax'
 * @param {string} actionType - e.g. 'move_table', 'stock_adjust', 'merge_bills', 'void_bill', 'menu_update'
 * @param {object} options
 * @param {string} [options.staffName] - Operator/staff name
 * @param {string} [options.staffId] - Operator UUID
 * @param {string} [options.bookingId] - Associated booking or order ID
 * @param {number} [options.amount] - Transaction or financial value (0 if non-financial)
 * @param {string} [options.reason] - Human-readable reason or note
 * @param {object} [options.metadata] - Structured delta/context details
 * @returns {Promise<object|null>}
 */
export async function logStaffActivity(module, actionType, {
    staffName = null,
    staffId = null,
    bookingId = null,
    amount = 0,
    reason = '',
    metadata = {}
} = {}) {
    try {
        let resolvedStaff = staffName;
        if (!resolvedStaff) {
            try {
                const shift = typeof getCurrentShift === 'function' ? getCurrentShift() : null;
                resolvedStaff = shift?.staffName;
            } catch {}
        }
        if (!resolvedStaff) {
            try {
                const saved = localStorage.getItem('pos_active_staff');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    resolvedStaff = parsed?.display_name || parsed?.name;
                }
            } catch {}
        }
        if (!resolvedStaff) {
            try {
                const userObj = localStorage.getItem('supabase.auth.token');
                if (userObj) {
                    const parsed = JSON.parse(userObj);
                    resolvedStaff = parsed?.currentSession?.user?.user_metadata?.full_name || parsed?.currentSession?.user?.email;
                }
            } catch {}
        }
        if (!resolvedStaff) {
            resolvedStaff = localStorage.getItem('staff_name') || 'Staff';
        }

        let shiftId = null;
        try {
            const shift = typeof getCurrentShift === 'function' ? getCurrentShift() : null;
            if (shift?.id) shiftId = String(shift.id);
        } catch {}

        const cleanModule = module || 'pos';
        const enrichedMetadata = {
            module: cleanModule,
            ...metadata,
            client_time: new Date().toISOString()
        };

        // Try direct insert first
        const payload = {
            shift_id: shiftId,
            staff_name: resolvedStaff,
            action_type: actionType,
            booking_id: bookingId,
            amount: Number(amount) || 0,
            reason: reason || null,
            metadata: enrichedMetadata,
            staff_id: staffId || null,
            module: cleanModule
        };

        const { data, error } = await supabase
            .from('pos_audit_logs')
            .insert(payload)
            .select()
            .maybeSingle();

        if (error) {
            // Fallback to SECURITY DEFINER RPC
            await supabase.rpc('log_pos_audit_event', {
                p_shift_id: shiftId,
                p_staff_name: resolvedStaff,
                p_action_type: actionType,
                p_booking_id: bookingId,
                p_amount: Number(amount) || 0,
                p_reason: reason || null,
                p_metadata: enrichedMetadata,
                p_staff_id: staffId || null,
                p_module: cleanModule
            });
        }

        return data;
    } catch (err) {
        console.warn('[AuditLogger] Could not record activity:', err);
        return null;
    }
}

/**
 * Fetches and combines audit logs from both pos_audit_logs and stock_transactions into a unified, chronological feed.
 */
export async function fetchUnifiedStaffAuditLogs({
    startDate = null,
    endDate = null,
    module = 'all',
    staffName = 'all',
    search = '',
    limit = 150
} = {}) {
    try {
        const fetchPosLogs = async () => {
            if (module === 'stock') return [];
            let q = supabase
                .from('pos_audit_logs')
                .select('*, bookings(table_id, tables_layout(table_name), total_amount, status)')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (startDate) q = q.gte('created_at', startDate);
            if (endDate) q = q.lte('created_at', endDate);
            if (module && module !== 'all') {
                if (module === 'sop') {
                    q = q.or('module.eq.sop,action_type.ilike.%sop%,action_type.ilike.%recipe%');
                } else if (module === 'admin') {
                    q = q.or('module.eq.admin,module.eq.tax,action_type.ilike.%menu%,action_type.ilike.%setting%,action_type.ilike.%table%,action_type.ilike.%promo%,action_type.ilike.%stamp%,action_type.ilike.%toggle%,action_type.ilike.%calendar%');
                } else {
                    q = q.eq('module', module);
                }
            }
            if (staffName && staffName !== 'all') {
                q = q.ilike('staff_name', `%${staffName}%`);
            }

            const { data, error } = await q;
            if (error) {
                console.warn('[AuditLogger] Error fetching pos_audit_logs:', error);
                return [];
            }
            const mapped = (data || []).map(row => {
                const mod = row.module || row.metadata?.module || (
                    row.action_type.includes('shift') || row.action_type.includes('cash') ? 'shift' :
                    row.action_type.includes('sop') || row.action_type.includes('recipe') ? 'sop' :
                    row.action_type.includes('tax') ? 'tax' :
                    row.action_type.includes('menu') || row.action_type.includes('admin') || row.action_type.includes('setting') || row.action_type.includes('table') || row.action_type.includes('promo') || row.action_type.includes('stamp') || row.action_type.includes('hausmade') || row.action_type.includes('toggle') || row.action_type.includes('calendar') ? 'admin' :
                    row.action_type.includes('stock') ? 'stock' : 'pos'
                );

                return {
                    id: row.id,
                    source: 'pos_audit_logs',
                    created_at: row.created_at,
                    module: mod,
                    staff_name: row.staff_name || 'Staff',
                    action_type: row.action_type,
                    amount: row.amount,
                    reason: row.reason,
                    metadata: row.metadata || {},
                    booking: row.bookings,
                    title: formatAuditTitle(row.action_type, row.metadata, row.bookings),
                    description: row.reason || formatAuditDescription(row.action_type, row.metadata, row.bookings)
                };
            });

            if (module && module !== 'all') {
                return mapped.filter(item => item.module === module || (module === 'admin' && item.module === 'tax'));
            }
            return mapped;
        };

        const fetchStockTx = async () => {
            if (module && module !== 'all' && module !== 'stock') return [];
            let q = supabase
                .from('stock_transactions')
                .select('*, stock_items(name, unit)')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (startDate) q = q.gte('created_at', startDate);
            if (endDate) q = q.lte('created_at', endDate);
            if (staffName && staffName !== 'all') {
                q = q.ilike('performed_by', `%${staffName}%`);
            }

            const { data, error } = await q;
            if (error) {
                console.warn('[AuditLogger] Error fetching stock_transactions:', error);
                return [];
            }
            return (data || []).map(row => {
                const itemName = row.stock_items?.name || 'วัตถุดิบ';
                const unit = row.stock_items?.unit || 'หน่วย';
                const change = Number(row.quantity_change) || 0;
                let actionType = 'stock_adjust';
                if (row.transaction_type === 'set' || row.transaction_type === 'audit') actionType = 'stock_audit';
                else if (row.transaction_type === 'in' || change > 0) actionType = 'stock_in';
                else if (row.transaction_type === 'out' || change < 0) actionType = 'stock_out';

                const title = actionType === 'stock_audit' 
                    ? `ตรวจนับสต็อก: ${itemName}`
                    : (actionType === 'stock_in' ? `รับเข้าสต็อก: ${itemName}` : `เบิกใช้/ตัดสต็อก: ${itemName}`);

                return {
                    id: `stock_${row.id}`,
                    source: 'stock_transactions',
                    created_at: row.created_at,
                    module: 'stock',
                    staff_name: row.performed_by || 'Staff',
                    action_type: actionType,
                    amount: Math.abs(change),
                    reason: row.note,
                    metadata: {
                        stock_item_name: itemName,
                        unit,
                        quantity_change: change,
                        transaction_type: row.transaction_type,
                        raw_note: row.note
                    },
                    title,
                    description: row.note ? `${row.note} (${change >= 0 ? '+' : ''}${change} ${unit})` : `${change >= 0 ? '+' : ''}${change} ${unit}`
                };
            });
        };

        const [posList, stockList] = await Promise.all([fetchPosLogs(), fetchStockTx()]);
        let combined = [...posList, ...stockList];

        // Client-side search query filtering
        if (search && search.trim() !== '') {
            const term = search.trim().toLowerCase();
            combined = combined.filter(item => {
                const text = `${item.staff_name} ${item.title} ${item.description} ${item.action_type} ${JSON.stringify(item.metadata)}`.toLowerCase();
                return text.includes(term);
            });
        }

        // Sort descending
        combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return combined.slice(0, limit);
    } catch (err) {
        console.error('[AuditLogger] Error in fetchUnifiedStaffAuditLogs:', err);
        return [];
    }
}

function formatAuditTitle(actionType, metadata = {}, booking = null) {
    switch (actionType) {
        case 'move_table':
            return `ย้ายโต๊ะ: ${metadata.from_table_name || 'เดิม'} → ${metadata.to_table_name || 'ใหม่'}`;
        case 'merge_bills':
            return `รวมบิล: ${metadata.source_table_name || 'โต๊ะเดิม'} → ${metadata.target_table_name || 'โต๊ะหลัก'}`;
        case 'void_bill':
            return `ยกเลิกบิล (Void): ${metadata.table_name || booking?.tables_layout?.table_name || 'โต๊ะ'}`;
        case 'void_item':
            return `ยกเลิกรายการอาหาร: ${metadata.item_name || 'เมนู'}`;
        case 'manual_discount':
            return `ให้ส่วนลดพิเศษ: ฿${metadata.amount || metadata.discount_amount || 0}`;
        case 'update_pax':
            return `แก้ไขจำนวนลูกค้า: ${metadata.pax || 0} ท่าน`;
        case 'open_shift':
            return `เปิดกะการขาย (เงินทอน ฿${metadata.amount || 0})`;
        case 'close_shift':
            return `ปิดกะการขาย (สรุปยอดเงินสด)`;
        case 'cash_adjustment':
            return `ปรับยอดเงินสดในเก๊ะ (${metadata.type === 'in' ? 'นำเงินเข้า' : 'นำเงินออก'})`;
        case 'sop_create':
            return `สร้างสูตร SOP ใหม่: ${metadata.name || ''}`;
        case 'sop_update':
            return `แก้ไขสูตร SOP: ${metadata.name || ''}`;
        case 'sop_delete':
            return `ลบสูตร SOP: ${metadata.name || ''}`;
        case 'sop_duplicate':
            return `คัดลอกสูตร SOP: ${metadata.name || ''}`;
        case 'sop_category_save':
            return `บันทึกหมวดหมู่ SOP: ${metadata.label || ''}`;
        case 'sop_category_delete':
            return `ลบหมวดหมู่ SOP: ${metadata.id || ''}`;
        case 'recipe_save':
            return `ปรับแต่งส่วนผสมสูตร: ${metadata.name || 'สูตร'}`;
        case 'recipe_formula_create':
            return `สร้างสูตรกลาง (Recipe Lab): ${metadata.name || ''}`;
        case 'recipe_formula_delete':
            return `ลบสูตรกลาง (Recipe Lab): ${metadata.id || ''}`;
        case 'recipe_formula_rename':
            return `เปลี่ยนชื่อสูตรกลาง: ${metadata.new_name || ''}`;
        case 'recipe_folder_move':
            return `ย้ายโฟลเดอร์สูตร: ${metadata.folder || ''}`;
        case 'table_create':
            return `เพิ่มโต๊ะใหม่: ${metadata.table_name || ''}`;
        case 'table_update':
            return `แก้ไขข้อมูลโต๊ะ: ${metadata.table_name || ''}`;
        case 'table_delete':
            return `ลบโต๊ะออกจากผัง: ${metadata.table_name || ''}`;
        case 'table_duplicate':
            return `คัดลอกโต๊ะ: ${metadata.new_name || ''}`;
        case 'floorplan_save':
            return `บันทึกผังร้านทั้งหมด (${metadata.tables_count || 0} โต๊ะ)`;
        case 'menu_update':
            return `แก้ไขเมนูอาหาร: ${metadata.menu_name || 'เมนู'}`;
        case 'menu_create':
            return `สร้างเมนูอาหารใหม่: ${metadata.menu_name || 'เมนู'}`;
        case 'menu_delete':
            return `ลบเมนูอาหาร: ${metadata.menu_name || 'เมนู'}`;
        case 'menu_archive':
            return `ย้ายเมนูลงถังขยะ: ${metadata.menu_name || 'เมนู'}`;
        case 'menu_toggle_stock':
            return `${metadata.is_in_stock ? 'เปิดขายเมนู' : 'ปิดสถานะของหมด'}: ${metadata.menu_name || 'เมนู'}`;
        case 'menu_toggle_pickup':
            return `${metadata.is_pickup_available ? 'เปิดสั่งกลับบ้าน' : 'ปิดสั่งกลับบ้าน'}: ${metadata.menu_name || 'เมนู'}`;
        case 'settings_update':
            return `แก้ไขการตั้งค่าระบบหลังบ้าน`;
        case 'promo_create':
            return `สร้างโค้ดโปรโมชั่น: ${metadata.code || ''}`;
        case 'promo_update':
            return `แก้ไขโค้ดโปรโมชั่น: ${metadata.code || ''}`;
        case 'promo_delete':
            return `ลบโค้ดโปรโมชั่น: ${metadata.code || ''}`;
        case 'stamp_settings_update':
            return `ปรับตั้งค่าสะสมแต้มเครื่องดื่ม`;
        case 'hausmade_order_status':
            return `อัปเดตสถานะออเดอร์ HAUSMADE (#${metadata.booking_id || ''})`;
        case 'hausmade_settings_update':
            return `แก้ไขการตั้งค่าร้าน HAUSMADE`;
        case 'tax_invoice_void':
            return `ยกเลิกใบกำกับภาษีเต็มรูป: ${metadata.invoice_number || ''}`;
        case 'tax_invoice_create':
            return `ออกใบกำกับภาษีเต็มรูป: ${metadata.invoice_number || ''}`;
        case 'toggle_service_table':
            return `ปรับโหมดรับจองโต๊ะ: ${metadata.value === 'manual_open' ? 'เปิดรับจอง (Manual)' : metadata.value === 'manual_close' ? 'ปิดรับจอง (Manual)' : 'เปิด-ปิดตามเวลา (Auto)'}`;
        case 'toggle_service_pickup':
            return `${metadata.value === 'manual_open' || metadata.enabled ? 'เปิดรับออเดอร์กลับบ้าน (Pickup)' : (metadata.value === 'manual_close' ? 'ปิดรับออเดอร์กลับบ้าน (Pickup)' : 'เปิด-ปิดกลับบ้านตามเวลา (Auto)')}`;
        case 'toggle_service_hausmade':
            return `${metadata.mode === 'manual_open' || metadata.value === 'manual_open' || metadata.enabled ? 'เปิดร้านออนไลน์ HAUSMADE' : (metadata.mode === 'manual_close' || metadata.value === 'manual_close' ? 'ปิดร้านออนไลน์ HAUSMADE' : 'เปิด-ปิดร้านตามเวลา (Auto)')}`;
        case 'toggle_qr_ordering':
            return `${String(metadata.value) === 'true' || metadata.enabled ? 'เปิดระบบสั่งอาหาร QR' : 'ปิดระบบสั่งอาหาร QR'}`;
        case 'toggle_song_request':
            return `${String(metadata.value) === 'true' || metadata.enabled ? 'เปิดระบบขอเพลงหน้าโต๊ะ' : 'ปิดระบบขอเพลงหน้าโต๊ะ'}`;
        case 'toggle_menu_system':
            return `${String(metadata.value) === 'true' || metadata.enabled ? 'เปิดระบบเมนูอาหาร' : 'ปิดระบบเมนูอาหาร'}`;
        case 'toggle_kitchen_cutoff':
            return `${String(metadata.value) === 'true' || metadata.enabled ? 'เปิดระบบตัดรอบเวลาปิดครัว' : 'ปิดระบบตัดรอบเวลาปิดครัว'}`;
        case 'toggle_easyslip_booking':
            return `${String(metadata.value) === 'true' || metadata.enabled ? 'เปิดตรวจสลิปโต๊ะอัตโนมัติ (EasySlip)' : 'ปิดตรวจสลิปโต๊ะอัตโนมัติ (EasySlip)'}`;
        case 'toggle_easyslip_pickup':
            return `${String(metadata.value) === 'true' || metadata.enabled ? 'เปิดตรวจสลิปกลับบ้านอัตโนมัติ (EasySlip)' : 'ปิดตรวจสลิปกลับบ้านอัตโนมัติ (EasySlip)'}`;
        case 'toggle_vat_mode':
            return `${String(metadata.value) === 'true' || metadata.enabled ? 'เปิดคิดคำนวณ VAT 7% หน้าร้าน' : 'ปิดคิดคำนวณ VAT 7% หน้าร้าน'}`;
        case 'toggle_qr_gps':
            return `${String(metadata.value) === 'true' || metadata.enabled ? 'เปิดตรวจ GPS หน้าร้าน (QR)' : 'ปิดตรวจ GPS หน้าร้าน (QR)'}`;
        case 'calendar_block_dates':
            return `ปิดรับจองในปฏิทิน (${metadata.count || metadata.dates?.length || 1} วัน)`;
        case 'calendar_unblock_date':
            return `ปลดล็อกเปิดรับจองในปฏิทิน: ${metadata.date || ''}`;
        case 'table_seat_walkin':
            return `เปิดโต๊ะ Walk-in: ${metadata.table_name || 'โต๊ะ'} (${metadata.pax || 2} ท่าน)`;
        case 'table_block_maintenance':
            return `ปิดปรับปรุงโต๊ะ (Maintenance): ${metadata.table_name || 'โต๊ะ'}`;
        case 'table_release':
            return `เคลียร์/ปิดโต๊ะ: ${metadata.table_name || 'โต๊ะ'}`;
        case 'table_unblock_maintenance':
            return `เปิดใช้งานโต๊ะตามปกติ: ${metadata.table_name || 'โต๊ะ'}`;
        case 'table_extend_time':
            return `ต่อเวลาโต๊ะ: ${metadata.table_name || 'โต๊ะ'} (+${metadata.add_minutes || 30} นาที)`;
        case 'promo_deactivate':
            return `ปิดใช้งานโค้ดโปรโมชั่น: ${metadata.code || ''}`;
        default:
            return actionType.replace(/_/g, ' ').toUpperCase();
    }
}

function formatAuditDescription(actionType, metadata = {}, booking = null) {
    if (metadata.reason) return metadata.reason;
    if (actionType === 'move_table') {
        return `ลูกค้าย้ายโต๊ะ (${metadata.pax || 0} ท่าน)`;
    }
    if (actionType === 'merge_bills') {
        return `รวมยอดเงิน ฿${metadata.source_total || 0} เข้าบิลปลายทาง`;
    }
    return '';
}

/**
 * Exports audit logs into a CSV file with UTF-8 BOM encoding for seamless Excel viewing.
 */
export function exportAuditLogsToCsv(logs, filename = 'staff_audit_report.csv') {
    if (!logs || logs.length === 0) return;

    const headers = ['วันที่-เวลา', 'พนักงาน', 'หมวดหมู่', 'การกระทำ', 'หัวข้อ', 'คำอธิบาย/เหตุผล', 'ยอดเงิน/จำนวน', 'Metadata'];
    const rows = logs.map(l => [
        new Date(l.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
        `"${(l.staff_name || '').replace(/"/g, '""')}"`,
        `"${(l.module || '').toUpperCase()}"`,
        `"${(l.action_type || '').replace(/"/g, '""')}"`,
        `"${(l.title || '').replace(/"/g, '""')}"`,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        l.amount ? Number(l.amount) : '',
        `"${JSON.stringify(l.metadata || {}).replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
