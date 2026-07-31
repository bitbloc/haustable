import { logger } from './logger';
import { supabase } from '../lib/supabaseClient';

let cachedPrinterConfig = null;
let printerConfigChannel = null;

export const getPrinterConfig = () => {
    if (cachedPrinterConfig) return cachedPrinterConfig;
    try {
        const stored = localStorage.getItem('onhaus_printer_config');
        if (stored) {
            cachedPrinterConfig = {
                printer_type: 'sunmi',
                cashier_printer_type: 'sunmi',
                kitchen_printer_type: 'sunmi',
                paper_width: '80mm',
                cashier_paper_size: '80mm',
                kitchen_paper_size: '80mm',
                ...JSON.parse(stored)
            };
            return cachedPrinterConfig;
        }
    } catch (e) {}
    return {
        printer_type: 'sunmi',
        cashier_printer_type: 'sunmi',
        kitchen_printer_type: 'sunmi',
        paper_width: '80mm',
        cashier_paper_size: '80mm',
        kitchen_paper_size: '80mm'
    };
};

export const fetchPrinterConfigOnline = async () => {
    try {
        const { data } = await supabase
            .from('app_settings')
            .select('key, value');

        if (data && data.length > 0) {
            const settingsMap = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
            
            let config = {};
            if (settingsMap.printer_config) {
                try {
                    config = JSON.parse(settingsMap.printer_config);
                } catch(e) {}
            }

            if (settingsMap.receipt_shop_footer) {
                config.shop_footer_text = settingsMap.receipt_shop_footer;
                localStorage.setItem('receipt_shop_footer', settingsMap.receipt_shop_footer);
            }
            if (settingsMap.receipt_shop_name) {
                config.shop_name = settingsMap.receipt_shop_name;
                localStorage.setItem('receipt_shop_name', settingsMap.receipt_shop_name);
            }
            if (settingsMap.receipt_shop_address) {
                config.shop_address = settingsMap.receipt_shop_address;
                localStorage.setItem('receipt_shop_address', settingsMap.receipt_shop_address);
            }
            if (settingsMap.receipt_shop_phone) {
                config.shop_phone = settingsMap.receipt_shop_phone;
                localStorage.setItem('receipt_shop_phone', settingsMap.receipt_shop_phone);
            }
            if (settingsMap.receipt_shop_vat) {
                config.shop_vat = settingsMap.receipt_shop_vat;
                localStorage.setItem('receipt_shop_vat', settingsMap.receipt_shop_vat);
            }
            if (settingsMap.receipt_shop_logo_url) {
                config.shop_logo_url = settingsMap.receipt_shop_logo_url;
                localStorage.setItem('receipt_shop_logo_url', settingsMap.receipt_shop_logo_url);
            }

            cachedPrinterConfig = config;
            localStorage.setItem('onhaus_printer_config', JSON.stringify(config));
            return config;
        }
    } catch (e) {
        console.error("Failed to fetch printer config online:", e);
    }
    return getPrinterConfig();
};

export const initPrinterConfigSync = (onUpdate) => {
    fetchPrinterConfigOnline().then(cfg => {
        if (onUpdate && cfg) onUpdate(cfg);
    });

    if (printerConfigChannel) {
        return () => {};
    }

    try {
        printerConfigChannel = supabase
            .channel('global_printer_config_sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_settings' },
                () => {
                    fetchPrinterConfigOnline().then(updated => {
                        if (onUpdate && updated) onUpdate(updated);
                    });
                }
            )
            .subscribe();
    } catch (err) {
        console.error("Failed to subscribe printer config sync:", err);
    }

    return () => {
        if (printerConfigChannel) {
            supabase.removeChannel(printerConfigChannel);
            printerConfigChannel = null;
        }
    };
};

// ESC/POS Command Constants
const ESC = 0x1B;
const GS = 0x1D;

function normalizePrinterText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(v => normalizePrinterText(v)).join('\n');
    return String(value);
}

class EscPosEncoder {
    constructor(isUtf8 = false) {
        this.buffer = [];
        this.isUtf8 = isUtf8;
    }

    initialize() {
        this.buffer.push(ESC, 0x40); // Initialize printer
        if (this.isUtf8) {
            // Exit Chinese mode and set character encoding to UTF-8 for Sunmi built-in
            this.buffer.push(0x1C, 0x2E); // Exit Chinese mode (FS .)
            this.buffer.push(0x1C, 0x43, 0xFF); // Set character encoding to UTF-8 (FS C \xff)
        } else {
            this.buffer.push(0x1C, 0x2E); // Exit Chinese mode (FS .)
            this.buffer.push(ESC, 0x74, 21); // Set Thai code page CP874 (TIS-620)
        }
        return this;
    }

    text(txt) {
        const textStr = normalizePrinterText(txt);
        const bytes = this.isUtf8 ? encodeUTF8(textStr) : encodeThaiTIS620(textStr);
        this.buffer.push(...bytes);
        return this;
    }

    line(txt = '') {
        if (Array.isArray(txt)) {
            txt.forEach(l => this.line(l));
            return this;
        }
        this.text(normalizePrinterText(txt) + '\n');
        return this;
    }

    lines(values = []) {
        return this.line(values);
    }

    align(type) {
        // 0: Left, 1: Center, 2: Right
        let val = 0;
        if (type === 'center') val = 1;
        if (type === 'right') val = 2;
        this.buffer.push(ESC, 0x61, val);
        return this;
    }

    size(width, height) {
        // width/height: 0 (normal) to 7 (double/triple etc.)
        const sizeByte = (width << 4) | height;
        this.buffer.push(GS, 0x21, sizeByte);
        return this;
    }

    bold(enable) {
        this.buffer.push(ESC, 0x45, enable ? 1 : 0);
        return this;
    }

    underline(enable) {
        this.buffer.push(ESC, 0x2D, enable ? 1 : 0);
        return this;
    }

    cut(full = false) {
        if (full) {
            this.buffer.push(GS, 0x56, 0); // Full cut
        } else {
            this.buffer.push(GS, 0x56, 66, 0); // Feed and cut
        }
        return this;
    }

    feed(lines = 3) {
        this.buffer.push(ESC, 0x64, lines);
        return this;
    }

    raw(bytes) {
        this.buffer.push(...bytes);
        return this;
    }

    kickDrawer() {
        // Sunmi/ESC/POS cash drawer kick command DLE DC4 m t1 t2 (10 14 00 3c ff)
        this.buffer.push(0x10, 0x14, 0x00, 0x3C, 0xFF);
        return this;
    }

    encode() {
        return new Uint8Array(this.buffer);
    }
}

// Thai TIS-620 Encoder (Thai POS printers use TIS-620 / Code Page 17 or 21)
function encodeThaiTIS620(str) {
    const bytes = [];
    const textStr = String(str ?? '');
    for (let i = 0; i < textStr.length; i++) {
        const code = textStr.charCodeAt(i);
        if (code >= 0x0E01 && code <= 0x0E5B) {
            // Map Unicode Thai to TIS-620 (Unicode Thai is 0x0E01 - 0x0E5B, TIS-620 is 0xA1 - 0xFB)
            bytes.push(code - 0x0E00 + 0xA0);
        } else if (code < 128) {
            bytes.push(code);
        } else {
            // Map common non-TIS620 symbols to TIS620 / ASCII safe equivalents
            if (code === 0x2605 || code === 0x2B50) bytes.push(42); // ★ / ⭐ -> *
            else if (code === 0x25B6 || code === 0x25B7) bytes.push(62); // ▶ -> >
            else if (code === 0x2022 || code === 0x2023) bytes.push(45); // • -> -
            else bytes.push(32); // Space for unknown characters
        }
    }
    return bytes;
}

// UTF-8 Encoder fallback
function encodeUTF8(str) {
    const textStr = String(str ?? '');
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(textStr);
    }
    const bytes = [];
    for (let i = 0; i < textStr.length; i++) {
        let code = textStr.charCodeAt(i);
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
        } else if (code < 0x10000) {
            bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
        } else {
            bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
        }
    }
    return bytes;
}

// Clean auto-generated system remarks (e.g. 'Walk-in Guest', '[CALL_STAFF]')
export function getCleanStaffRemark(remark) {
    if (!remark) return '';
    const r = String(remark).trim();
    if (!r) return '';
    const lower = r.toLowerCase();
    
    if (
        lower === 'walk-in guest' ||
        lower === 'qr walk-in guest' ||
        lower === 'offline walk-in' ||
        lower.includes('walk-in guest (offline') ||
        lower === 'walk-in pick-up (offline sync)' ||
        lower === '[call_staff]' ||
        lower === '[call_bill]' ||
        lower.startsWith('merged into table') ||
        lower.startsWith('split paid by')
    ) {
        return '';
    }

    const cleaned = r.replace('[CALL_STAFF]', '').replace('[CALL_BILL]', '').trim();
    return cleaned;
}

// Generate customizable divider lines (dashed, dotted, solid, double, star, wave)
export function generateDivider(style = 'dashed', maxCols = 48) {
    const targetWidth = maxCols || 48;
    if (style === 'dotted') {
        const p = '. ';
        return p.repeat(Math.ceil(targetWidth / 2)).slice(0, targetWidth);
    }
    if (style === 'dashed') {
        const p = '- ';
        return p.repeat(Math.ceil(targetWidth / 2)).slice(0, targetWidth);
    }
    if (style === 'solid') {
        return '-'.repeat(targetWidth);
    }
    if (style === 'double') {
        return '='.repeat(targetWidth);
    }
    if (style === 'star') {
        const p = '* ';
        return p.repeat(Math.ceil(targetWidth / 2)).slice(0, targetWidth);
    }
    if (style === 'wave') {
        const p = '~ ';
        return p.repeat(Math.ceil(targetWidth / 2)).slice(0, targetWidth);
    }
    const p = '- ';
    return p.repeat(Math.ceil(targetWidth / 2)).slice(0, targetWidth);
}

// Resolve printer column width cleanly from configuration or fallback
function resolveMaxCols(paperSize = '80mm', configuredMaxCols) {
    const configured = Number(configuredMaxCols);
    if (Number.isFinite(configured) && configured > 0) {
        return Math.max(20, Math.min(64, Math.floor(configured)));
    }
    const normalized = String(paperSize ?? '').toLowerCase().replace(/\s+/g, '');
    const is58mm = (
        normalized === '58mm' ||
        normalized === '58' ||
        Number(paperSize) === 58
    );
    return is58mm ? 26 : 36;
}

// Classifier helper to categorize menu items into kitchen, bar, or other
export const classifyItem = (item, receiptConfig = {}) => {
    const getItemCatId = (i) => i.menu_items?.category_id || i.category_id || i.category || '';
    const catId = getItemCatId(item);

    let kitchenCatIds = receiptConfig.kitchen_categories || [];
    let barCatIds = receiptConfig.bar_categories || [];
    let otherCatIds = receiptConfig.other_categories || [];

    try {
        const config = getPrinterConfig();
        if (config) {
            if (kitchenCatIds.length === 0) kitchenCatIds = config.kitchen_categories || [];
            if (barCatIds.length === 0) barCatIds = config.bar_categories || [];
            if (otherCatIds.length === 0) otherCatIds = config.other_categories || [];
        }
    } catch (e) {}

    if (otherCatIds.length > 0 && otherCatIds.includes(catId)) return 'other';
    if (barCatIds.length > 0 && barCatIds.includes(catId)) return 'bar';
    if (kitchenCatIds.length > 0 && kitchenCatIds.includes(catId)) return 'kitchen';

    const DEFAULT_BAR_CATS = [
        '7524bb8a-4698-45c6-aa17-d8ccc296f667', // Coffee
        '912683ef-fdc3-40a3-8dd8-b09507791240', // Soft Drink
        'b441665e-2f23-4df3-a11d-63485e1690dc', // Beer
        'a2c783fc-975b-4779-b9eb-67391eeafd1f', // Alcohol
        '1983955d-5787-4351-b729-51b95761f125', // Mocktail & Cocktail
        '1407d869-4eed-489e-aeeb-ba7ef19f57bd', // Bottled
        '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'  // PRO Beer
    ];
    if (DEFAULT_BAR_CATS.includes(catId)) return 'bar';

    const cachedCategories = (() => {
        try { return JSON.parse(localStorage.getItem('pos_cache_menu_categories')) || []; } catch (e) { return []; }
    })();
    const categoryMap = cachedCategories.reduce((acc, cat) => { if (cat.id) acc[cat.id] = cat; return acc; }, {});

    const catObj = categoryMap[catId];
    const catName = (catObj?.name || item.menu_items?.categories?.name || item.menu_items?.menu_categories?.name || item.category_name || item.category || '').toLowerCase();
    
    const BAR_KEYWORDS = [
        'บาร์', 'บาร์น้ำ', 'เครื่องดื่ม', 'น้ำ', 'กาแฟ', 'ชา', 'เหล้า', 'เบียร์', 'ค็อกเทล', 
        'ม็อกเทล', 'โซดา', 'ไวน์', 'ชง', 'ปั่น', 'ดริ้ง', 'น้ำอัดลม',
        'bar', 'drink', 'beverage', 'coffee', 'tea', 'beer', 'wine', 'cocktail', 'mocktail', 'alcohol', 'soda', 'smoothie'
    ];

    if (BAR_KEYWORDS.some(kw => catName.includes(kw))) return 'bar';

    return 'kitchen';
};

export function resolveStaffDisplayName(booking = {}, shiftObj = null) {
    let raw = '';
    if (booking.staff_name) raw = booking.staff_name;
    else if (booking.staff?.display_name) raw = booking.staff.display_name;
    else if (booking.staff && typeof booking.staff === 'string') raw = booking.staff;
    else if (booking.profiles?.display_name) raw = booking.profiles.display_name;

    if (!raw) {
        let shift = shiftObj;
        if (!shift) {
            try { shift = JSON.parse(localStorage.getItem('pos_current_shift')); } catch (e) {}
        }
        if (shift && shift.staffName) raw = shift.staffName;
    }

    if (!raw) {
        try {
            const activeStaff = localStorage.getItem('pos_active_staff') || localStorage.getItem('pos_staff_user');
            if (activeStaff) {
                const p = JSON.parse(activeStaff);
                if (p.display_name || p.name) raw = p.display_name || p.name;
            }
        } catch (e) {}
    }

    if (!raw) return '';

    const isUuidOrId = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(raw) || /^[0-9a-f]{16,}$/i.test(raw) || /^usr_/i.test(raw) || /^default_/i.test(raw);
    if (isUuidOrId) {
        try {
            const cachedStaff = JSON.parse(localStorage.getItem('pos_cache_staff_list')) || [];
            const found = cachedStaff.find(s => s.id === raw || s.user_id === raw);
            if (found && found.display_name) return found.display_name;
        } catch (e) {}

        if (booking.profiles?.display_name) return booking.profiles.display_name;
    }

    return raw;
}

export const selectItemsForTab = (orderItems = [], activeTab = 'receipt', receiptConfig = {}) => {
    let items = orderItems || [];
    if (activeTab === 'receipt') {
        // Filter out void / cancelled items for receipt printing
        items = items.filter(item => item.status !== 'void' && item.status !== 'cancelled');
    }

    if (activeTab === 'kitchen_all' || activeTab === 'receipt') {
        return items;
    }

    if (activeTab === 'bar') {
        return items.filter(item => classifyItem(item, receiptConfig) === 'bar');
    }

    if (activeTab === 'kitchen') {
        // Kitchen receives all non-bar items (food and other) so no 3rd slip is needed
        return items.filter(item => classifyItem(item, receiptConfig) !== 'bar');
    }

    return items.filter(item => classifyItem(item, receiptConfig) === activeTab);
};

export const groupReceiptItems = (itemsToRender = [], receiptConfig = {}) => {
    const kitchenItems = [];
    const barItems = [];
    const otherItems = [];

    itemsToRender.forEach(item => {
        const cls = classifyItem(item, receiptConfig);
        if (cls === 'bar') barItems.push(item);
        else if (cls === 'other') otherItems.push(item);
        else kitchenItems.push(item);
    });

    const groups = [];
    if (kitchenItems.length > 0) groups.push({ type: 'kitchen', label: 'รายการอาหาร (Food)', items: kitchenItems });
    if (barItems.length > 0) groups.push({ type: 'bar', label: 'รายการเครื่องดื่ม (Drinks)', items: barItems });
    if (otherItems.length > 0) groups.push({ type: 'other', label: 'รายการอื่นๆ (Others)', items: otherItems });

    return groups;
};

export function resolveReceiptTotals(booking, receiptConfig = {}, itemsToRender = []) {
    const validItems = (itemsToRender.length > 0 ? itemsToRender : (booking.order_items || []))
        .filter(item => item.status !== 'void' && item.status !== 'cancelled');

    let subtotalCents = 0;
    validItems.forEach(item => {
        const qty = Number(item.quantity) || 1;
        const lineTotal = item.line_total ?? item.extended_price ?? item.total_price;
        if (lineTotal !== undefined && lineTotal !== null && Number.isFinite(Number(lineTotal))) {
            subtotalCents += Math.round(Number(lineTotal) * 100);
        } else {
            const unitPrice = Number(item.price_at_time ?? item.price ?? 0);
            subtotalCents += Math.round(unitPrice * qty * 100);
        }
    });

    const discountCents = Math.round(Number(booking.discount_amount || 0) * 100);
    const netAfterDiscountCents = Math.max(0, subtotalCents - discountCents);

    const vatMode = (receiptConfig.vat_mode || 'none').toLowerCase(); // 'none' | 'inclusive' | 'exclusive'
    let vatCents = 0;
    let totalCents = netAfterDiscountCents;

    if (vatMode === 'inclusive') {
        vatCents = Math.round((netAfterDiscountCents * 7) / 107);
        totalCents = netAfterDiscountCents;
    } else if (vatMode === 'exclusive') {
        vatCents = Math.round(netAfterDiscountCents * 0.07);
        totalCents = netAfterDiscountCents + vatCents;
    } else {
        if (booking.total_amount != null && Number.isFinite(Number(booking.total_amount))) {
            const bookedCents = Math.round(Number(booking.total_amount) * 100);
            const diffWithExclusive = Math.abs(bookedCents - Math.round(netAfterDiscountCents * 1.07));
            if (diffWithExclusive <= 1) {
                vatCents = Math.round(netAfterDiscountCents * 0.07);
                totalCents = netAfterDiscountCents + vatCents;
            }
        }
    }

    const bookedTotalCents = (booking.total_amount != null && Number.isFinite(Number(booking.total_amount)))
        ? Math.round(Number(booking.total_amount) * 100)
        : totalCents;

    const adjustmentCents = bookedTotalCents - totalCents;

    return {
        subtotal: subtotalCents / 100,
        discount: discountCents / 100,
        netAfterDiscount: netAfterDiscountCents / 100,
        vat: vatCents / 100,
        total: bookedTotalCents / 100,
        calculatedTotal: totalCents / 100,
        adjustmentCents,
        hasAdjustment: adjustmentCents !== 0,
        vatMode
    };
}

export function buildReceiptTotalRows(booking, receiptConfig = {}, itemsToRender = []) {
    const totals = resolveReceiptTotals(booking, receiptConfig, itemsToRender);
    const validItems = (itemsToRender.length > 0 ? itemsToRender : (booking.order_items || []))
        .filter(item => item.status !== 'void' && item.status !== 'cancelled');
    const totalQty = validItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

    const rows = [];
    rows.push({ type: 'qty', label: 'จำนวนชิ้น', value: `${totalQty} ชิ้น` });
    rows.push({ type: 'subtotal', label: 'ยอดรวมก่อนหัก', value: formatReceiptMoney(totals.subtotal) });

    if (totals.discount > 0) {
        rows.push({ type: 'discount', label: 'ส่วนลด', value: `-${formatReceiptMoney(totals.discount)}` });
    }

    if (totals.vat > 0) {
        const vatLabel = totals.vatMode === 'inclusive' ? 'ภาษีมูลค่าเพิ่ม 7% (รวมในยอด)' : 'ภาษีมูลค่าเพิ่ม (7%)';
        rows.push({ type: 'vat', label: vatLabel, value: formatReceiptMoney(totals.vat) });
    }

    if (totals.hasAdjustment) {
        const adjVal = totals.adjustmentCents > 0 
            ? `+${formatReceiptMoney(totals.adjustmentCents / 100)}` 
            : formatReceiptMoney(totals.adjustmentCents / 100);
        rows.push({ type: 'adjustment', label: 'รายการปรับยอด', value: adjVal });
    }

    rows.push({ type: 'total', label: 'ยอดรวมสุทธิ', value: formatReceiptMoney(totals.total) });

    return { totals, rows };
}

// Convert receipt/ticket details to ESC/POS binary format
export function encodeReceiptData(booking, activeTab, paymentMethod, optionMap = {}, paperSize = '80mm', receiptConfig = {}, printerType = 'universal') {
    let itemsToRender = selectItemsForTab(booking.order_items || [], activeTab, receiptConfig);
    const isKitchenTab = activeTab === 'kitchen' || activeTab === 'bar' || activeTab === 'other' || activeTab === 'kitchen_all';

    try {
        const config = getPrinterConfig();
        if (config && (!paperSize || paperSize === '58mm')) {
            paperSize = isKitchenTab
                ? (config.kitchen_paper_size || config.paper_width || '80mm')
                : (config.cashier_paper_size || config.paper_width || '80mm');
        }
    } catch (e) {}

    if (isKitchenTab && itemsToRender.length === 0) {
        return null;
    }

    // Sort items for kitchen / bar / other by category first, then name
    if (isKitchenTab) {
        itemsToRender = [...itemsToRender].sort((a, b) => {
            const catA = a.menu_items?.category_id || a.category_id || a.category || '';
            const catB = b.menu_items?.category_id || b.category_id || b.category || '';
            if (catA !== catB) return catA.localeCompare(catB);
            const nameA = a.menu_items?.name || a.name || '';
            const nameB = b.menu_items?.name || b.name || '';
            return nameA.localeCompare(nameB);
        });
    }

    const encoder = new EscPosEncoder(false); // ALWAYS use TIS-620 for Thai POS printers
    encoder.initialize();

    if (activeTab === 'receipt' && paymentMethod === 'cash') {
        encoder.kickDrawer();
    }

    const queueNo = (booking.tracking_token && booking.tracking_token.length <= 8) 
        ? booking.tracking_token 
        : (booking.id ? String(booking.id).slice(0, 4) : '0000');
    const dateStr = booking.booking_time ? new Date(booking.booking_time).toLocaleString('th-TH') : new Date().toLocaleString('th-TH');

    const maxCols = resolveMaxCols(paperSize, receiptConfig.maxCols);

    let cfg = {};
    try {
        cfg = getPrinterConfig() || {};
    } catch (e) {}

    const selectedDividerStyle = receiptConfig.divider_style || cfg.divider_style || 'dashed';

    const divider = generateDivider(selectedDividerStyle, maxCols);
    const doubleDivider = generateDivider(selectedDividerStyle === 'double' ? 'double' : (selectedDividerStyle === 'star' ? 'star' : (selectedDividerStyle === 'wave' ? 'wave' : selectedDividerStyle)), maxCols);

    const shopName = (receiptConfig.shopName || cfg.shop_name || 'IN THE HAUS').toUpperCase();
    const shopAddress = receiptConfig.shopAddress || cfg.shop_address || '';
    const shopPhone = receiptConfig.shopPhone || cfg.shop_phone || '';
    const shopVat = receiptConfig.shopVat || cfg.shop_vat || '';
    const shopFooter = receiptConfig.shopFooter || cfg.shop_footer_text || '';

    let staffName = resolveStaffDisplayName(booking);

    // Determine Order Category & Source for Banner & Slip Proof
    const remarkLower = (booking.staff_remark || '').toLowerCase();
    const noteLower = (booking.customer_note || '').toLowerCase();
    const sourceLower = (booking.source || '').toLowerCase();
    
    // Check category: Online Pickup vs Online Table Booking vs Walk-in Pickup vs IN HAUS Dine-In
    const isOnlineSource = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('online') || noteLower.includes('online');
    const isPickupOrder = booking.booking_type === 'pickup' || remarkLower.includes('pickup') || remarkLower.includes('takeaway') || remarkLower.includes('รับกลับ') || noteLower.includes('pickup') || (!booking.tables_layout && sourceLower !== 'qr');
    
    const isOnlinePickup = isOnlineSource && isPickupOrder;
    const isOnlineBooking = isOnlineSource && !isPickupOrder && sourceLower !== 'qr';

    let orderBannerTitle = '';
    let orderBannerSub = '';

    if (isOnlinePickup) {
        orderBannerTitle = 'ONLINE PICKUP ORDER';
        orderBannerSub = '(รับกลับออนไลน์ - PICKUP)';
    } else if (isOnlineBooking) {
        orderBannerTitle = 'ONLINE TABLE BOOKING';
        orderBannerSub = '(จองโต๊ะออนไลน์ - มีมัดจำ)';
    } else if (isPickupOrder) {
        orderBannerTitle = 'IN HAUS PICKUP';
        orderBannerSub = '(หน้าร้าน - สั่งกลับบ้าน)';
    } else {
        // Any Table Dine-In (QR ordering or POS table open)
        orderBannerTitle = 'IN HAUS DINE-IN';
        orderBannerSub = '(หน้าร้าน - ทานที่ร้าน)';
    }

    // Header
    if (!isKitchenTab) {
        encoder.align('center')
               .line(doubleDivider)
               .size(1, 1)
               .bold(true)
               .line(shopName)
               .size(0, 0)
               .bold(false);

        if (shopAddress) {
            encoder.line(shopAddress.toUpperCase());
        }
        if (shopPhone) {
            encoder.line(`TEL: ${shopPhone}`);
        }
        if (shopVat) {
            encoder.line(`TAX ID: ${shopVat}`);
        }
        encoder.line(doubleDivider)
               .align('center')
               .bold(true)
               .size(1, 1)
               .line(orderBannerTitle)
               .size(0, 0)
               .bold(true)
               .line(orderBannerSub)
               .bold(false)
               .line(doubleDivider);
    } else if (activeTab === 'kitchen' || activeTab === 'kitchen_all') {
        encoder.align('center')
               .line(doubleDivider)
               .bold(true)
               .size(1, 1)
               .line('KITCHEN ORDER')
               .line(orderBannerTitle)
               .size(0, 0)
               .bold(true)
               .line('(ใบออเดอร์ครัว)')
               .line(orderBannerSub)
               .bold(false)
               .line(doubleDivider);
    } else if (activeTab === 'bar') {
        encoder.align('center')
               .line(doubleDivider)
               .bold(true)
               .size(1, 1)
               .line('BAR ORDER')
               .line(orderBannerTitle)
               .size(0, 0)
               .bold(true)
               .line('(ใบออเดอร์บาร์)')
               .line(orderBannerSub)
               .bold(false)
               .line(doubleDivider);
    } else if (activeTab === 'other') {
        encoder.align('center')
               .line(doubleDivider)
               .bold(true)
               .size(1, 1)
               .line('OTHER ORDER')
               .line(orderBannerTitle)
               .size(0, 0)
               .bold(true)
               .line('(ใบออเดอร์ทั่วไป)')
               .line(orderBannerSub)
               .bold(false)
               .line(doubleDivider);
    }

    // Table Name & Queue Number
    const tableName = (booking.tables_layout?.table_name || (isPickupOrder ? 'PICKUP' : 'WALK-IN')).toUpperCase();
    const customerName = booking.profiles?.display_name || booking.pickup_contact_name || booking.customer_name || 'ลูกค้าทั่วไป (Walk-in)';
    const customerPhone = booking.profiles?.phone_number || booking.pickup_contact_phone || booking.customer_phone || '';
    const depositAmt = Number(booking.deposit_amount) || 0;
    const totalAmt = Number(booking.total_amount) || 0;
    const balanceDue = Math.max(0, totalAmt - depositAmt);
    const formattedBookingTimeStr = new Date(booking.booking_time || Date.now()).toLocaleString('th-TH', { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    if (isKitchenTab) {
        let serviceType = 'IN HAUS DINE-IN (ทานที่ร้าน)';
        if (isOnlinePickup) {
            serviceType = 'ONLINE PICKUP (รับกลับออนไลน์)';
        } else if (isOnlineBooking) {
            serviceType = 'ONLINE BOOKING (จองโต๊ะออนไลน์)';
        } else if (isPickupOrder) {
            serviceType = 'WALK-IN PICKUP (รับกลับหน้าร้าน)';
        }

        const totalItemsCount = itemsToRender.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

        encoder.align('center')
               .bold(true)
               .size(1, 1)
               .line(isPickupOrder ? `รหัส: #${queueNo}` : `โต๊ะ ${tableName}`)
               .size(0, 0)
               .line(divider)
               .align('left')
               .bold(true)
               .line(`บริการ: ${serviceType}`)
               .line(`ลูกค้า: ${customerName}`)
               .line(`พนักงานรับ: ${staffName ? staffName.toUpperCase() : 'SYSTEM'}`)
               .line(`เวลาสั่ง: ${dateStr}`);

        if (isOnlineSource) {
            encoder.line(`เวลานัดหมาย: ${formattedBookingTimeStr}`);
        }

        encoder.line(`จำนวนคน: ${booking.pax || booking.guest_count || 1} ท่าน`)
               .line(`จำนวนรายการ: ${totalItemsCount} ชิ้น`)
               .bold(false)
               .line(divider);
    } else {
        encoder.align('center')
               .bold(true)
               .size(1, 1)
               .line(isPickupOrder ? `รหัส: #${queueNo}` : `โต๊ะ ${tableName}`)
               .size(0, 0)
               .bold(false)
               .line(divider);
    }

    // Meta info (Proof / Evidence details)
    if (!isKitchenTab) {
        let channelText = 'IN HAUS (หน้าร้าน)';
        if (isOnlinePickup || isOnlineBooking) {
            channelText = 'ONLINE (ออนไลน์)';
        } else if (isPickupOrder) {
            channelText = 'IN-HAUS (หน้าร้าน)';
        }

        encoder.align('left')
               .bold(true)
               .line(`ช่องทาง: ${channelText}`)
               .line(`ประเภทบริการ: ${isPickupOrder ? 'รับกลับบ้าน (TAKEAWAY)' : (isOnlineBooking ? 'จองโต๊ะออนไลน์ (RESERVATION)' : 'ทานที่ร้าน (DINE-IN)')}`)
               .bold(false)
               .line(`วันที่-เวลา: ${dateStr}`);

        if (isOnlineSource) {
            encoder.line(`เวลานัดหมาย: ${formattedBookingTimeStr}`);
        }

        encoder.line(`ลูกค้า: ${customerName}`);

        if (customerPhone) {
            encoder.line(`เบอร์โทร: ${customerPhone}`);
        }
        if (booking.pax || booking.guest_count) {
            encoder.line(`จำนวนคน (PAX): ${booking.pax || booking.guest_count} ท่าน`);
        }
        if (staffName) {
            encoder.line(`พนักงาน: ${staffName.toUpperCase()}`);
        }
        
        // Print deposit & remaining balance details if deposit exists
        if (depositAmt > 0) {
            encoder.line(divider)
                   .bold(true)
                   .line(`ยอดโอนมัดจำแล้ว: ฿${depositAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}`)
                   .line(`ยอดคงเหลือชำระเพิ่ม: ฿${balanceDue.toLocaleString(undefined, {minimumFractionDigits: 2})}`)
                   .bold(false);
        }
        encoder.line(divider);
    }

    // Items Header
    encoder.align('left')
           .size(0, 0)
           .bold(true)
           .line(
               activeTab === 'bar' ? 'รายการเครื่องดื่ม (บาร์)' : 
               activeTab === 'other' ? 'รายการอื่นๆ (ทั่วไป)' : 
               (activeTab === 'kitchen' || activeTab === 'kitchen_all') ? 'รายการอาหาร (ครัว)' : 
               'รายการ'
           )
           .bold(false)
           .line(divider);

    // Items List
    if (isKitchenTab) {
        const renderKitchenGroup = (groupItems) => {
            groupItems.forEach((item) => {
                const qtyColWidth = 4;
                const qtyStr = padStartPrinter(`${item.quantity}x`, qtyColWidth);
                const name = (item.menu_items?.name || item.name || 'Item').toUpperCase();
                
                const maxDoubleCols = Math.max(12, Math.floor(maxCols / 2));
                const nameColWidth = Math.max(1, maxDoubleCols - qtyColWidth - 1);
                
                const nameLines = wrapTextByWords(name, nameColWidth);
                if (nameLines.length === 0) nameLines.push('');
                
                const kitchenItemLines = [`${qtyStr} ${nameLines[0]}`];
                for (let i = 1; i < nameLines.length; i++) {
                    kitchenItemLines.push(`${' '.repeat(qtyColWidth + 1)}${nameLines[i]}`);
                }
                
                encoder.bold(true).size(1, 1);
                kitchenItemLines.forEach(l => encoder.line(l));
                encoder.size(0, 0).bold(false);
                
                if (item.selected_options || item.item_note) {
                    let optionsList = [];
                    if (Array.isArray(item.selected_options)) {
                        optionsList = item.selected_options.map(opt => {
                            if (typeof opt === 'object' && opt !== null) {
                                if (opt.group_name && opt.name) {
                                    return `${opt.group_name}: ${opt.name}`;
                                }
                                if (opt.name) {
                                    return `${opt.name}`;
                                }
                                return JSON.stringify(opt);
                            }
                            return optionMap[opt] || String(opt);
                        });
                    } else if (typeof item.selected_options === 'object' && item.selected_options !== null) {
                        optionsList = Object.entries(item.selected_options).flatMap(([key, val]) => {
                            if (Array.isArray(val)) {
                                return val.map(id => optionMap[id] || (typeof id === 'object' ? id.name : id));
                            }
                            return [`${key}: ${val}`];
                        });
                    }

                    if (item.item_note && !optionsList.some(o => String(o).includes(item.item_note))) {
                        optionsList.push(`หมายเหตุ: ${item.item_note}`);
                    }

                    optionsList.forEach(opt => {
                        const optLine = `> ${String(opt).toUpperCase()}`;
                        wrapTextByWords(optLine, maxCols - 4).forEach(l => {
                            encoder.bold(true).line(`    ${l}`).bold(false);
                        });
                    });
                }
                encoder.line(divider);
            });
        };

        renderKitchenGroup(itemsToRender);
    } else {
        const renderReceiptGroup = (groupItems) => {
            groupItems.forEach(item => {
                const name = (item.menu_items?.name || item.name || 'Item').toUpperCase();
                const unitPriceNum = Number(item.price_at_time ?? item.price ?? 0);
                const qtyNum = Number(item.quantity) || 1;
                const unitPriceStr = formatReceiptMoney(unitPriceNum);
                const lineTotalNum = item.line_total ?? item.extended_price ?? item.total_price ?? (unitPriceNum * qtyNum);
                const priceStr = formatReceiptMoney(lineTotalNum);
                const calculationText = `${qtyNum} x ${unitPriceStr}`;

                // Fix P0 newline bug by calling encoder.line() instead of encoder.text()
                encoder.line(formatItemLine(calculationText, name, priceStr, maxCols));

                if (item.selected_options || item.item_note) {
                    let optionsList = [];
                    if (Array.isArray(item.selected_options)) {
                        optionsList = item.selected_options.map(opt => {
                            if (typeof opt === 'object' && opt !== null) {
                                if (opt.group_name && opt.name) {
                                    return `${opt.group_name}: ${opt.name}`;
                                }
                                if (opt.name) {
                                    return `${opt.name}`;
                                }
                                return JSON.stringify(opt);
                            }
                            return optionMap[opt] || String(opt);
                        });
                    } else if (typeof item.selected_options === 'object' && item.selected_options !== null) {
                        optionsList = Object.entries(item.selected_options).flatMap(([key, val]) => {
                            if (Array.isArray(val)) {
                                return val.map(id => optionMap[id] || (typeof id === 'object' ? id.name : id));
                            }
                            return [`${key}: ${val}`];
                        });
                    }

                    if (item.item_note && !optionsList.some(o => String(o).includes(item.item_note))) {
                        optionsList.push(`หมายเหตุ: ${item.item_note}`);
                    }

                    optionsList.forEach(opt => {
                        const optionText = `+ ${String(opt)}`;
                        wrapTextByWords(optionText, maxCols - 4)
                            .forEach(l => encoder.line(`    ${l}`));
                    });
                }
            });
        };

        const groups = groupReceiptItems(itemsToRender, receiptConfig);
        groups.forEach((group, index) => {
            if (groups.length > 1) {
                encoder.bold(true).line(`--- ${group.label} ---`).bold(false);
            }
            renderReceiptGroup(group.items);
            if (index < groups.length - 1) {
                encoder.line(divider);
            }
        });
        encoder.line(divider);
    }

    // Totals Section
    if (!isKitchenTab) {
        const { rows } = buildReceiptTotalRows(booking, receiptConfig, itemsToRender);

        encoder.align('left').size(0, 0);
        rows.forEach(row => {
            if (row.type === 'total') {
                encoder.line(divider).bold(true);
            }
            encoder.line(formatTwoCols(row.label, row.value, maxCols));
            if (row.type === 'total') {
                encoder.bold(false);
            }
        });
        encoder.line(doubleDivider);
    }

    // Payment details
    if (activeTab === 'receipt') {
        const methodLabel = paymentMethod === 'cash' ? 'เงินสด' : (paymentMethod === 'credit' ? 'บัตรเครดิต' : 'โอนเงินผ่าน QR');
        encoder.align('center')
               .line(`ช่องทางชำระเงิน: ${methodLabel}`);
               
        if (paymentMethod === 'cash') {
            encoder.align('left').size(0, 0);
            const storedRecv = localStorage.getItem('last_cash_received');
            const storedChange = localStorage.getItem('last_cash_change');
            if (storedRecv !== null) {
                const cashRecvVal = formatReceiptMoney(parseFloat(storedRecv));
                encoder.line(formatTwoCols('รับเงินสดมา', cashRecvVal, maxCols));
            }
            if (storedChange !== null) {
                const cashChangeVal = formatReceiptMoney(parseFloat(storedChange));
                encoder.line(formatTwoCols('เงินทอน', cashChangeVal, maxCols));
            }
        }
        
        encoder.align('center')
               .line('')
               .bold(true)
               .line('[ ชำระเงินแล้ว ]')
               .bold(false)
               .line(doubleDivider);
    }

    // Notes
    const cleanStaffNote = getCleanStaffRemark(booking.staff_remark);
    const combinedNotes = [];
    if (booking.customer_note?.trim()) combinedNotes.push(`ลูกค้า: ${booking.customer_note.trim()}`);
    if (cleanStaffNote) combinedNotes.push(`พนักงาน: ${cleanStaffNote}`);

    if (combinedNotes.length > 0) {
        encoder.align('left')
               .bold(true)
               .line('หมายเหตุ:')
               .bold(false);
        combinedNotes.forEach(noteLine => {
            const lines = wrapTextByWords(noteLine, maxCols - 2);
            lines.forEach(l => encoder.line(l));
        });
        encoder.line(divider);
    }

    // Footer
    if (!isKitchenTab) {
        let asciiArt = receiptConfig.footer_ascii_art || cfg.footer_ascii_art || '';
        if (!asciiArt) {
            try {
                const config = getPrinterConfig();
                asciiArt = config?.footer_ascii_art || '';
            } catch(e) {}
        }

        const shopFooterText = receiptConfig.shopFooter 
            || cfg.shop_footer_text 
            || cfg.receipt_shop_footer 
            || localStorage.getItem('receipt_shop_footer') 
            || '';

        encoder.align('center');
        if (asciiArt) {
            asciiArt.split('\n').forEach(aLine => {
                encoder.line(aLine);
            });
        }
        if (shopFooterText) {
            encoder.line(shopFooterText);
        }
        encoder.feed(2)
               .cut();
    } else {
        encoder.feed(2)
               .cut();
    }

    return encoder.encode();
}

// Formatter Helpers for shift reports
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} - ${hours}:${minutes}`;
}

function isThaiCombiningCode(code) {
    return (
        code === 0x0E31 ||
        (code >= 0x0E34 && code <= 0x0E3A) ||
        (code >= 0x0E47 && code <= 0x0E4E)
    );
}

// Split a string into printer grapheme clusters so combining Thai vowels/tones stay with base character
function splitPrinterGraphemes(str) {
    const clusters = [];
    for (const char of Array.from(String(str ?? ''))) {
        const code = char.codePointAt(0);
        if (isThaiCombiningCode(code) && clusters.length > 0) {
            clusters[clusters.length - 1] += char;
        } else {
            clusters.push(char);
        }
    }
    return clusters;
}

// Measure string cell width for ESC/POS printing (TIS-620 grapheme cluster width)
export function getPrinterCellWidth(str) {
    if (str === null || str === undefined) return 0;
    const clusters = splitPrinterGraphemes(str);
    return clusters.length;
}

export function padEndPrinter(str, targetWidth, padChar = ' ') {
    const value = String(str ?? '');
    const neededPadding = targetWidth - getPrinterCellWidth(value);
    if (neededPadding <= 0) return value;
    return value + padChar.repeat(neededPadding);
}

export function padStartPrinter(str, targetWidth, padChar = ' ') {
    const value = String(str ?? '');
    const neededPadding = targetWidth - getPrinterCellWidth(value);
    if (neededPadding <= 0) return value;
    return padChar.repeat(neededPadding) + value;
}

// Slice by printer-byte width without orphaning Thai combining marks
export function sliceThai(str, maxPrinterWidth) {
    const clusters = splitPrinterGraphemes(str);
    let currentWidth = 0;
    let result = '';

    for (const cluster of clusters) {
        const clusterWidth = getPrinterCellWidth(cluster);
        if (result && currentWidth + clusterWidth > maxPrinterWidth) break;
        if (!result && clusterWidth > maxPrinterWidth) return cluster;
        result += cluster;
        currentWidth += clusterWidth;
    }

    return result;
}

// Word/phrase-aware text wrapping using actual TIS-620 grapheme cell width
export function wrapTextByWords(str, maxColWidth) {
    if (!str) return [];
    const width = Math.max(1, Number(maxColWidth) || 1);
    const paragraphs = String(str).replace(/\r/g, '').split('\n');
    const output = [];

    paragraphs.forEach((paragraph, paragraphIndex) => {
        if (!paragraph) {
            output.push('');
            return;
        }
        if (getPrinterCellWidth(paragraph) <= width) {
            output.push(paragraph);
            return;
        }

        const match = paragraph.match(/^(\s+)/);
        const leadingSpace = match ? match[1] : '';
        const words = paragraph.split(/\s+/).filter(Boolean);
        let currentLine = '';

        const flushLongWord = (word) => {
            let remaining = word;
            while (remaining.length > 0) {
                const chunk = sliceThai(remaining, width);
                if (!chunk) break;
                output.push(chunk);
                remaining = remaining.slice(chunk.length);
            }
        };

        words.forEach(word => {
            if (!currentLine) {
                currentLine = leadingSpace;
                if (getPrinterCellWidth(currentLine + word) <= width) {
                    currentLine += word;
                } else {
                    flushLongWord(currentLine + word);
                    currentLine = '';
                }
                return;
            }

            const candidate = `${currentLine} ${word}`;
            if (getPrinterCellWidth(candidate) <= width) {
                currentLine = candidate;
                return;
            }

            output.push(currentLine);
            currentLine = leadingSpace;
            if (getPrinterCellWidth(currentLine + word) <= width) {
                currentLine += word;
            } else {
                flushLongWord(currentLine + word);
                currentLine = '';
            }
        });

        if (currentLine) output.push(currentLine);
        if (paragraphIndex < paragraphs.length - 1 && output[output.length - 1] !== '') {
            output.push('');
        }
    });

    return output;
}

function formatReceiptMoney(value) {
    const amount = Number(value || 0);
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatItemLine(calculationText, name, priceStr, maxCols) {
    const totalWidth = Math.max(20, Number(maxCols) || 48);
    const nameLines = wrapTextByWords(String(name ?? ''), totalWidth);
    if (nameLines.length === 0) nameLines.push('');

    const left = String(calculationText ?? '');
    const right = String(priceStr ?? '');
    const priceColWidth = Math.max(totalWidth <= 28 ? 9 : 12, getPrinterCellWidth(right));
    const leftWidth = Math.max(1, totalWidth - priceColWidth - 1);

    let numericRow;
    if (getPrinterCellWidth(left) <= leftWidth) {
        numericRow = padEndPrinter(left, leftWidth) + ' ' + padStartPrinter(right, priceColWidth);
    } else {
        numericRow = padStartPrinter(right, totalWidth);
    }

    return [...nameLines, numericRow].join('\n');
}

function formatThreeCols(left, mid, right, maxCols) {
    const totalWidth = Math.max(20, Number(maxCols) || 48);
    const isSmall = totalWidth <= 28;
    const midStr = String(mid ?? '');
    const rightStr = String(right ?? '');
    const midWidth = Math.max(getPrinterCellWidth(midStr), isSmall ? 5 : 7);
    const rightWidth = Math.max(getPrinterCellWidth(rightStr), isSmall ? 9 : 12);
    const minLeftWidth = isSmall ? 6 : 8;

    if (midWidth + rightWidth + 2 + minLeftWidth > totalWidth) {
        const leftLines = wrapTextByWords(String(left ?? ''), totalWidth);
        const numericLine = formatTwoCols(midStr, rightStr, totalWidth);
        return [...leftLines, numericLine].join('\n');
    }

    const leftWidth = totalWidth - midWidth - rightWidth - 2;
    const leftLines = wrapTextByWords(String(left ?? ''), leftWidth);
    if (leftLines.length === 0) leftLines.push('');

    const output = [
        padEndPrinter(leftLines[0], leftWidth) +
        ' ' + padStartPrinter(midStr, midWidth) +
        ' ' + padStartPrinter(rightStr, rightWidth)
    ];

    for (let i = 1; i < leftLines.length; i++) {
        output.push(leftLines[i]);
    }
    return output.join('\n');
}

function formatTwoCols(left, right, maxCols) {
    const totalWidth = Math.max(20, Number(maxCols) || 48);
    const isSmall = totalWidth <= 28;
    const leftStr = String(left ?? '');
    const rightStr = String(right ?? '');
    const rightWidth = Math.max(getPrinterCellWidth(rightStr), isSmall ? 9 : 12);
    const minLeftWidth = isSmall ? 6 : 8;

    if (rightWidth + 1 + minLeftWidth > totalWidth) {
        const leftLines = wrapTextByWords(leftStr, totalWidth);
        return [...leftLines, padStartPrinter(rightStr, totalWidth)].join('\n');
    }

    const leftWidth = totalWidth - rightWidth - 1;
    const leftLines = wrapTextByWords(leftStr, leftWidth);
    if (leftLines.length === 0) leftLines.push('');

    const output = [
        padEndPrinter(leftLines[0], leftWidth) +
        ' ' + padStartPrinter(rightStr, rightWidth)
    ];

    for (let i = 1; i < leftLines.length; i++) {
        output.push(leftLines[i]);
    }
    return output.join('\n');
}

// Compile raw bookings into rich structured shift report details
export function compileShiftReportData(shift = {}, bookingsData = [], categoriesData = []) {
    const categoryMap = {};
    categoriesData.forEach(cat => {
        if (cat?.id) categoryMap[cat.id] = cat.name;
    });

    const isSaleItem = (item) => item && item.status !== 'void' && item.status !== 'cancelled';

    const completedBookings = bookingsData.filter(b => b && b.status === 'completed');
    const voidBookings = bookingsData.filter(b => b && b.status === 'void');
    const cancelledBookings = bookingsData.filter(b => b && b.status === 'cancelled');

    // 1. Category & Top Items Sales
    const categorySalesMap = {};
    const itemSalesMap = {};
    let totalItemsCount = 0;
    let totalItemsAmount = 0;

    completedBookings.forEach(b => {
        (b.order_items || []).filter(isSaleItem).forEach(item => {
            const catId = item.menu_items?.category_id || item.category_id || 'other';
            const catName = categoryMap[catId] || 'อื่นๆ / Uncategorized';
            const itemName = (item.menu_items?.name || item.name || 'Unknown Item').toUpperCase();
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price_at_time ?? item.price ?? 0);
            const amt = qty * price;

            totalItemsCount += qty;
            totalItemsAmount += amt;

            if (!categorySalesMap[catId]) {
                categorySalesMap[catId] = { name: catName, quantity: 0, amount: 0 };
            }
            categorySalesMap[catId].quantity += qty;
            categorySalesMap[catId].amount += amt;

            if (!itemSalesMap[itemName]) {
                itemSalesMap[itemName] = { name: itemName, quantity: 0, amount: 0 };
            }
            itemSalesMap[itemName].quantity += qty;
            itemSalesMap[itemName].amount += amt;
        });
    });

    const categorySales = Object.values(categorySalesMap).sort((a, b) => b.amount - a.amount);
    const topSellingItems = Object.values(itemSalesMap)
        .sort((a, b) => b.quantity - a.quantity || b.amount - a.amount)
        .slice(0, 3);

    // 2. Payments
    let cashCount = 0;
    let cashAmount = 0;
    let qrCount = 0;
    let qrAmount = 0;
    let creditCount = 0;
    let creditAmount = 0;
    let otherCount = 0;
    let otherAmount = 0;

    let linemanCashCount = 0;
    let linemanCashAmount = 0;
    
    const otherDetailsMap = {};

    completedBookings.forEach(b => {
        const remark = (b.staff_remark || '').toLowerCase();
        const note = (b.customer_note || '').toLowerCase();
        const amt = Number(b.total_amount) || 0;
        const isLineman = remark.includes('lineman') || remark.includes('line man') || note.includes('lineman') || note.includes('line man');
        
        let isCash = true;
        let isCredit = false;
        let isQr = false;
        
        if (remark.includes('credit') || remark.includes('บัตรเครดิต')) {
            isCash = false;
            isCredit = true;
        } else if (b.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน')) {
            isCash = false;
            isQr = true;
        }
        
        if (isCash) {
            cashCount++;
            cashAmount += amt;
            if (isLineman) {
                linemanCashCount++;
                linemanCashAmount += amt;
            }
        } else if (isCredit) {
            creditCount++;
            creditAmount += amt;
        } else {
            let parsedBank = '';
            if (remark.includes('scb') || remark.includes('ไทยพาณิชย์')) {
                parsedBank = 'ไทยพาณิชย์ พลัส';
            } else if (remark.includes('kbank') || remark.includes('กสิกร')) {
                parsedBank = 'กสิกรไทย';
            } else if (remark.includes('bbl') || remark.includes('กรุงเทพ')) {
                parsedBank = 'กรุงเทพ';
            } else if (remark.includes('ktb') || remark.includes('กรุงไทย')) {
                parsedBank = 'กรุงไทย';
            }

            if (parsedBank) {
                otherCount++;
                otherAmount += amt;
                if (!otherDetailsMap[parsedBank]) {
                    otherDetailsMap[parsedBank] = { name: parsedBank, count: 0, amount: 0 };
                }
                otherDetailsMap[parsedBank].count++;
                otherDetailsMap[parsedBank].amount += amt;
            } else {
                qrCount++;
                qrAmount += amt;
            }
        }
    });

    const otherDetails = Object.values(otherDetailsMap);

    // 3. Order Types
    let dineInCount = 0;
    let dineInAmount = 0;
    let pickupCount = 0;
    let pickupAmount = 0;

    completedBookings.forEach(b => {
        const amt = Number(b.total_amount) || 0;
        if (b.booking_type === 'pickup') {
            pickupCount++;
            pickupAmount += amt;
        } else {
            dineInCount++;
            dineInAmount += amt;
        }
    });

    // 4. Sales Channels
    let linemanCount = 0;
    let linemanAmount = 0;
    let walkinCount = 0;
    let walkinAmount = 0;

    completedBookings.forEach(b => {
        const amt = Number(b.total_amount) || 0;
        const remark = (b.staff_remark || '').toLowerCase();
        const note = (b.customer_note || '').toLowerCase();
        
        if (remark.includes('lineman') || remark.includes('line man') || note.includes('lineman') || note.includes('line man')) {
            linemanCount++;
            linemanAmount += amt;
        } else {
            walkinCount++;
            walkinAmount += amt;
        }
    });

    // 5. Voids & Cancels
    let voidBillCount = voidBookings.length;
    let voidBillAmount = voidBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
    
    let voidItemCount = 0;
    let voidItemAmount = 0;
    let cancelItemCount = 0;
    let cancelItemAmount = 0;

    bookingsData.forEach(b => {
        (b.order_items || []).forEach(item => {
            if (item.status === 'void') {
                const q = Number(item.quantity) || 0;
                voidItemCount += q;
                voidItemAmount += q * (Number(item.price_at_time ?? item.price ?? 0));
            } else if (item.status === 'cancelled') {
                const q = Number(item.quantity) || 0;
                cancelItemCount += q;
                cancelItemAmount += q * (Number(item.price_at_time ?? item.price ?? 0));
            }
        });
    });

    let cancelBillCount = cancelledBookings.length;
    let cancelBillAmount = cancelledBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

    // 6. General metrics
    const totalDiscounts = completedBookings.reduce((sum, b) => sum + (Number(b.discount_amount) || 0), 0);
    const totalGuests = completedBookings.reduce((sum, b) => sum + (Number(b.pax) || 0), 0);
    
    // Total net sales (booking.total_amount is ALREADY net after discount!)
    const netSales = completedBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
    const avgSalesPerBill = completedBookings.length > 0 ? (netSales / completedBookings.length) : 0;
    const avgSalesPerGuest = totalGuests > 0 ? (netSales / totalGuests) : 0;

    // Deduct adjustments
    const adjustments = shift.adjustments || [];
    const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    return {
        staffName: shift.staffName || '',
        openedAt: shift.openedAt,
        closedAt: shift.closedAt || new Date().toISOString(),
        openingFloat: shift.openingFloat ?? 0,
        cashSales: shift.cashSales ?? cashAmount,
        qrSales: shift.qrSales ?? qrAmount,
        creditSales: shift.creditSales ?? creditAmount,
        totalSales: netSales,
        netSales,
        totalIn,
        totalOut,
        expectedCash: shift.expectedCash,
        actualCash: shift.closedCash,
        difference: shift.difference,
        
        shiftId: shift.id ? String(shift.id).replace('shift_', '') : '',
        totalBookings: completedBookings.length,
        totalItemsCount,
        totalItemsAmount,
        categorySales,
        topSellingItems,
        
        paymentSales: {
            cash: { count: cashCount, amount: cashAmount },
            qrPromptPay: { count: qrCount, amount: qrAmount },
            linemanCash: { count: linemanCashCount, amount: linemanCashAmount },
            creditCard: { count: creditCount, amount: creditAmount },
            other: { count: otherCount, amount: otherAmount, subItems: otherDetails }
        },
        
        orderTypeSales: {
            dineIn: { count: dineInCount, amount: dineInAmount },
            pickup: { count: pickupCount, amount: pickupAmount }
        },
        
        channelSales: {
            linemanDelivery: { count: linemanCount, amount: linemanAmount },
            walkin: { count: walkinCount, amount: walkinAmount }
        },
        
        voidData: {
            wholeBill: { count: voidBillCount, amount: voidBillAmount },
            itemLevel: { count: voidItemCount, amount: voidItemAmount },
            paidBillVoidCount: 0
        },
        
        cancelData: {
            wholeBill: { count: cancelBillCount, amount: cancelBillAmount },
            itemLevel: { count: cancelItemCount, amount: cancelItemAmount }
        },
        
        totalDiscounts,
        totalVat: 0,
        totalGuests,
        averageSalesPerBill: avgSalesPerBill,
        averageSalesPerGuest: avgSalesPerGuest,
        paymentReconciliationDifference: netSales - (cashAmount + qrAmount + creditAmount + otherAmount),
        adjustments
    };
}

// Convert shift report data to ESC/POS binary format
export function encodeShiftReportData(reportData, paperSize = '80mm', printerType = 'sunmi') {
    return encodeShiftClosureReportData(reportData, paperSize, printerType);
}

// Convert shift closure report data to ESC/POS binary format for SUNMI / RawBT
export function encodeShiftClosureReportData(reportData = {}, paperSize = '80mm', printerType = 'sunmi') {
    paperSize = '80mm';

    const encoder = new EscPosEncoder(false); // ALWAYS use TIS-620 for Thai POS printers
    encoder.initialize();

    const maxCols = resolveMaxCols(paperSize, reportData?.maxCols);
    
    let selectedDividerStyle = null;
    try {
        const stored = localStorage.getItem('onhaus_printer_config');
        if (stored) {
            const cfg = JSON.parse(stored);
            if (cfg.divider_style) {
                selectedDividerStyle = cfg.divider_style;
            }
        }
    } catch (e) {}
    if (!selectedDividerStyle) {
        selectedDividerStyle = reportData?.divider_style || 'dashed';
    }

    const divider = generateDivider(selectedDividerStyle, maxCols);

    // Header info
    const shopName = reportData.shopName || 'ร้านในบ้าน นครพนม';
    const shopAddress = reportData.shopAddress || 'นครพนม';

    encoder.align('center')
           .bold(true)
           .size(1, 1)
           .line('ONHAUS')
           .size(0, 0)
           .line('POS SYSTEM')
           .line(divider)
           .bold(true)
           .size(0, 1)
           .line('รายงานยอดการขาย')
           .size(0, 0)
           .bold(false)
           .line(wrapTextByWords(`รหัส: ${reportData.shiftId || reportData.staffName || ''}`, maxCols))
           .line(wrapTextByWords(shopName, maxCols))
           .line(wrapTextByWords(shopAddress, maxCols))
           .line('')
           .align('left')
           .line(wrapTextByWords(`เปิดรอบ: ${formatDateTime(reportData.openedAt)} (${reportData.staffName || 'STAFF'})`, maxCols))
           .line(wrapTextByWords(`ปิดรอบ: ${reportData.closedAt ? formatDateTime(reportData.closedAt) : 'ยังไม่ปิดรอบ'} (${reportData.staffName || 'STAFF'})`, maxCols))
           .line(divider);

    // Section 1: ยอดขายตามหมวดหมู่
    const netSales = Number(reportData.netSales ?? reportData.totalSales ?? 0);
    const discountVal = Number(reportData.totalDiscounts || 0);

    if (reportData.categorySales && reportData.categorySales.length > 0) {
        encoder.bold(true).line('ยอดขายตามหมวดหมู่').bold(false);
        encoder.line(formatThreeCols('รายการ', 'จำนวน', 'ยอดเงิน', maxCols));
        let totalQty = 0;
        let totalAmt = 0;
        reportData.categorySales.forEach(cat => {
            if (cat.quantity > 0 || cat.amount > 0) {
                totalQty += cat.quantity || 0;
                totalAmt += cat.amount || 0;
                encoder.line(formatThreeCols(cat.name, cat.quantity, formatReceiptMoney(cat.amount), maxCols));
            }
        });
        
        encoder.line(formatThreeCols('รวม', totalQty, formatReceiptMoney(totalAmt), maxCols));
        
        const vatVal = Number(reportData.totalVat || 0);
        const preVatVal = netSales - vatVal;

        if (discountVal > 0) {
            encoder.line(formatTwoCols('ส่วนลด', formatReceiptMoney(discountVal), maxCols));
        }
        if (vatVal > 0) {
            encoder.line(formatTwoCols('ยอดก่อนภาษี (VAT)', formatReceiptMoney(preVatVal), maxCols));
            encoder.line(formatTwoCols('ภาษี (VAT)', formatReceiptMoney(vatVal), maxCols));
        }
        encoder.line(formatTwoCols('ยอดขายสุทธิ', formatReceiptMoney(netSales), maxCols));
        encoder.line(formatTwoCols('จำนวนลูกค้า (Pax)', (reportData.totalGuests || 0).toString(), maxCols));
        encoder.line(formatTwoCols('ยอดขายเฉลี่ยต่อบิล', formatReceiptMoney(reportData.averageSalesPerBill), maxCols));
        encoder.line(formatTwoCols('ยอดขายเฉลี่ยต่อหัว', formatReceiptMoney(reportData.averageSalesPerGuest), maxCols));
    } else {
        // Fallback backward compatibility
        encoder.bold(true).line('SALES SUMMARY').bold(false);
        encoder.line(formatTwoCols('Total Bookings', (reportData.totalBookings || 0).toString(), maxCols));
        encoder.line(formatTwoCols('Gross Revenue', formatReceiptMoney(reportData.grossRevenue || netSales), maxCols));
        if (discountVal > 0) {
            encoder.line(formatTwoCols('Discounts', formatReceiptMoney(discountVal), maxCols));
        }
        encoder.line(formatTwoCols('Net Sales', formatReceiptMoney(netSales), maxCols));
        encoder.line(divider);
    }

    // Section Top 3 Selling Items
    if (reportData.topSellingItems && reportData.topSellingItems.length > 0) {
        encoder.line(divider);
        encoder.bold(true).line('* เมนูขายดี 3 อันดับ (Top 3 Selling Items)').bold(false);
        encoder.line(formatThreeCols('เมนู', 'จำนวน', 'ยอดเงิน', maxCols));
        reportData.topSellingItems.forEach((item, index) => {
            const rankLabel = `${index + 1}. ${item.name}`;
            encoder.line(formatThreeCols(rankLabel, item.quantity, formatReceiptMoney(item.amount), maxCols));
        });
    }

    // Section 2: ยอดขายตามการชำระเงิน
    if (reportData.paymentSales) {
        encoder.line(divider);
        encoder.bold(true).line('ยอดขายตามการชำระเงิน').bold(false);
        encoder.line(formatThreeCols('รายการ', 'จำนวน', 'ยอดเงิน', maxCols));
        
        const cash = reportData.paymentSales.cash || { count: 0, amount: 0 };
        const credit = reportData.paymentSales.creditCard || { count: 0, amount: 0 };
        const qr = reportData.paymentSales.qrPromptPay || { count: 0, amount: 0 };
        const other = reportData.paymentSales.other || { count: 0, amount: 0, subItems: [] };
        
        if (cash.count > 0 || cash.amount > 0) {
            encoder.line(formatThreeCols('เงินสด', cash.count, formatReceiptMoney(cash.amount), maxCols));
        }
        if (qr.count > 0 || qr.amount > 0) {
            encoder.line(formatThreeCols('QR PromptPay', qr.count, formatReceiptMoney(qr.amount), maxCols));
        }
        if (credit.count > 0 || credit.amount > 0) {
            encoder.line(formatThreeCols('บัตรเครดิต', credit.count, formatReceiptMoney(credit.amount), maxCols));
        }

        if (other.count > 0 || other.amount > 0) {
            encoder.line(formatThreeCols('การชำระเงินแบบอื่นๆ', other.count, formatReceiptMoney(other.amount), maxCols));
            if (other.subItems && other.subItems.length > 0) {
                other.subItems.forEach(sub => {
                    encoder.line(formatThreeCols(`- ${sub.name}`, sub.count, formatReceiptMoney(sub.amount), maxCols));
                });
            }
        }
        
        encoder.line(formatTwoCols('ยอดขายสุทธิ', formatReceiptMoney(netSales), maxCols));
    } else {
        // Fallback
        encoder.bold(true).line('REVENUE BY METHOD').bold(false);
        encoder.line(formatTwoCols('Cash Payments', formatReceiptMoney(reportData.cashRevenue || reportData.cashSales), maxCols));
        encoder.line(formatTwoCols('QR Payments', formatReceiptMoney(reportData.qrRevenue || reportData.qrSales), maxCols));
    }

    // Section 3: ยอดขายตามประเภทออเดอร์
    if (reportData.orderTypeSales) {
        encoder.line(divider);
        encoder.bold(true).line('ยอดขายตามประเภทออเดอร์').bold(false);
        encoder.line(formatThreeCols('รายการ', 'จำนวน', 'ยอดเงิน', maxCols));
        
        const dineIn = reportData.orderTypeSales.dineIn || { count: 0, amount: 0 };
        const pickup = reportData.orderTypeSales.pickup || { count: 0, amount: 0 };
        
        if (dineIn.count > 0 || pickup.count === 0) {
            encoder.line(formatThreeCols('กินที่ร้าน', dineIn.count, formatReceiptMoney(dineIn.amount), maxCols));
        }
        if (pickup.count > 0) {
            encoder.line(formatThreeCols('กลับบ้าน / รับเอง', pickup.count, formatReceiptMoney(pickup.amount), maxCols));
        }
    }

    // Section 4: ยอดขายตามช่องทางการขาย
    if (reportData.channelSales) {
        encoder.line(divider);
        encoder.bold(true).line('ยอดขายตามช่องทางการขาย').bold(false);
        encoder.line(formatThreeCols('รายการ', 'จำนวน', 'ยอดเงิน', maxCols));
        
        const linemanDelivery = reportData.channelSales.linemanDelivery || { count: 0, amount: 0 };
        const walkin = reportData.channelSales.walkin || { count: 0, amount: 0 };
        
        if (linemanDelivery.count > 0) {
            encoder.line(formatThreeCols('LINE MAN Delivery', linemanDelivery.count, formatReceiptMoney(linemanDelivery.amount), maxCols));
        }
        if (walkin.count > 0 || linemanDelivery.count === 0) {
            encoder.line(formatThreeCols('หน้าร้าน / Direct', walkin.count, formatReceiptMoney(walkin.amount), maxCols));
        }
    }

    // Section 5: รอบการขาย
    encoder.line(divider);
    encoder.bold(true).line('รอบการขาย').bold(false);
    encoder.line(formatTwoCols('เงินสดเริ่มต้น', formatReceiptMoney(reportData.openingFloat), maxCols));
    encoder.line(formatTwoCols('ยอดขายเงินสด', formatReceiptMoney(reportData.cashSales), maxCols));

    const netCashFlow = (reportData.totalIn || 0) - (reportData.totalOut || 0);
    if (netCashFlow !== 0) {
        encoder.line(formatTwoCols('เงินเข้า/เงินออก', formatReceiptMoney(netCashFlow), maxCols));
    }
    
    encoder.line(formatTwoCols('เงินที่ควรมีในลิ้นชัก', formatReceiptMoney(reportData.expectedCash), maxCols));
    
    if (reportData.closedAt) {
        encoder.line(formatTwoCols('จำนวนจริงในลิ้นชัก', formatReceiptMoney(reportData.actualCash), maxCols));
        encoder.line(formatTwoCols('ส่วนต่าง', formatReceiptMoney(reportData.difference), maxCols));
    }
    
    encoder.line(formatTwoCols('บิลทั้งหมด', (reportData.totalBookings || 0).toString(), maxCols));

    // Detailed adjustments list on receipt
    if (reportData.adjustments && reportData.adjustments.length > 0) {
        reportData.adjustments.forEach(adj => {
            const prefix = adj.type === 'in' ? 'นำเข้า' : 'นำออก';
            const sign = adj.type === 'in' ? '+' : '-';
            const label = `  - [${prefix}] ${adj.note || ''}`;
            const amountStr = `${sign}${formatReceiptMoney(adj.amount)}`;
            encoder.line(formatTwoCols(label, amountStr, maxCols));
        });
    }

    // Section 6: ทำลายบิล (Void)
    const voidData = reportData.voidData || { wholeBill: { count: 0, amount: 0 }, itemLevel: { count: 0, amount: 0 }, paidBillVoidCount: 0 };
    if (voidData.wholeBill.count > 0 || voidData.itemLevel.count > 0 || voidData.paidBillVoidCount > 0) {
        encoder.line(divider);
        encoder.bold(true).line('ทำลายบิล (Void)').bold(false);
        encoder.line(formatThreeCols('รายการ', 'จำนวน', 'ยอดเงิน', maxCols));
        if (voidData.wholeBill.count > 0) encoder.line(formatThreeCols('ทำลายทั้งบิล', voidData.wholeBill.count, formatReceiptMoney(voidData.wholeBill.amount), maxCols));
        if (voidData.itemLevel.count > 0) encoder.line(formatThreeCols('ทำลายรายเมนู', voidData.itemLevel.count, formatReceiptMoney(voidData.itemLevel.amount), maxCols));
        if (voidData.paidBillVoidCount > 0) encoder.line(formatTwoCols('ทำลายบิลที่ชำระเงินแล้ว', (voidData.paidBillVoidCount || 0).toString(), maxCols));
    }

    // Section 7: ยกเลิกเมนู (Cancel)
    const cancelData = reportData.cancelData || { wholeBill: { count: 0, amount: 0 }, itemLevel: { count: 0, amount: 0 } };
    if (cancelData.wholeBill.count > 0 || cancelData.itemLevel.count > 0) {
        encoder.line(divider);
        encoder.bold(true).line('ยกเลิกเมนู (Cancel)').bold(false);
        encoder.line(formatThreeCols('รายการ', 'จำนวน', 'ยอดเงิน', maxCols));
        if (cancelData.wholeBill.count > 0) encoder.line(formatThreeCols('ยกเลิกบิล', cancelData.wholeBill.count, formatReceiptMoney(cancelData.wholeBill.amount), maxCols));
        if (cancelData.itemLevel.count > 0) encoder.line(formatThreeCols('ยกเลิกรายเมนู', cancelData.itemLevel.count, formatReceiptMoney(cancelData.itemLevel.amount), maxCols));
    }

    encoder.line(divider)
           .feed(2)
           .cut();

    return encoder.encode();
}

// Connect and write raw bytes via Web Bluetooth directly
export async function printToBluetoothDirect(targetDeviceName, rawData) {
    if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth API is not supported on this platform/browser.");
    }

    logger.logNativeStart('print_bluetooth_direct', { targetDeviceName, bytesLength: rawData ? rawData.length : 0 });
    let device;
    try {
        if (navigator.bluetooth.getDevices) {
            const paired = await navigator.bluetooth.getDevices();
            device = paired.find(d => d.name === targetDeviceName || d.id === targetDeviceName);
        }

        if (!device) {
            device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    '00001101-0000-1000-8000-00805f9b34fb', // Standard SPP / Bluetooth Serial
                    '0000fee7-0000-1000-8000-00805f9b34fb', // Generic print service (Goojprt/Zjiang)
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
                    '0000e7e7-0000-1000-8000-00805f9b34fb'  // generic custom e7e7
                ]
            });
        }

        if (!device) {
            throw new Error("No Bluetooth device selected.");
        }

        const server = await device.gatt.connect();
        
        const commonServices = [
            '00001101-0000-1000-8000-00805f9b34fb',
            '0000fee7-0000-1000-8000-00805f9b34fb',
            '49535343-fe7d-4ae5-8fa9-9fafd205e455',
            '0000e7e7-0000-1000-8000-00805f9b34fb'
        ];
        
        let service;
        for (const uuid of commonServices) {
            try {
                service = await server.getPrimaryService(uuid);
                if (service) break;
            } catch (e) {}
        }

        if (!service) {
            try {
                const services = await server.getPrimaryServices();
                if (services && services.length > 0) {
                    service = services.find(s => !s.uuid.startsWith('000018')) || services[0];
                }
            } catch (e) {}
        }

        if (!service) {
            throw new Error("Could not find any supported print service on this device.");
        }

        const characteristics = await service.getCharacteristics();
        const characteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
        if (!characteristic) {
            throw new Error("No writeable Bluetooth characteristic found.");
        }

        const chunkSize = 20;
        for (let i = 0; i < rawData.length; i += chunkSize) {
            const chunk = rawData.slice(i, i + chunkSize);
            if (characteristic.properties.writeWithoutResponse) {
                await characteristic.writeValueWithoutResponse(chunk);
            } else {
                await characteristic.writeValue(chunk);
            }
        }

        device.gatt.disconnect();
        logger.logNativeEnd('print_bluetooth_direct');
        return true;
    } catch (err) {
        logger.error("Direct Bluetooth print failed", err);
        logger.logNativeEnd('print_bluetooth_direct');
        console.error("Direct Bluetooth print failed:", err);
        throw err;
    }
}

// Print via RawBT Android Intent
export async function printToRawBTWebSocket(rawData) {
    logger.logNativeStart('print_rawbt_intent', { bytesLength: rawData ? rawData.length : 0 });
    try {
        let binary = '';
        const len = rawData.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(rawData[i]);
        }
        
        const base64Data = window.btoa(binary);
        const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        
        window.location.href = intentUrl;
        logger.logNativeEnd('print_rawbt_intent');
        return true;
    } catch (e) {
        logger.error("RawBT Intent print failed", e);
        logger.logNativeEnd('print_rawbt_intent');
        console.error("RawBT Intent print failed:", e);
        throw new Error("เกิดข้อผิดพลาดในการเรียกใช้แอป RawBT: " + e.message);
    }
}

let sunmiPrintQueue = Promise.resolve();
const imageBase64Cache = {};

async function downloadAndResizeLogoToBase64(logoUrl, targetWidth = 200) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = logoUrl;
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const scale = targetWidth / img.width;
                canvas.width = targetWidth;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
                resolve(base64Data);
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => {
            reject(new Error("Failed to load image url: " + logoUrl));
        };
    });
}

async function getCachedResizedImage(url, targetWidth) {
    if (!url) return null;
    const cacheKey = `img_cache_${url}_w${targetWidth}`;
    
    if (imageBase64Cache[cacheKey]) {
        return imageBase64Cache[cacheKey];
    }
    
    try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
            imageBase64Cache[cacheKey] = stored;
            return stored;
        }
    } catch (e) {}
    
    const base64 = await downloadAndResizeLogoToBase64(url, targetWidth);
    
    imageBase64Cache[cacheKey] = base64;
    try {
        localStorage.setItem(cacheKey, base64);
    } catch (e) {}
    
    return base64;
}

// Strip trailing ESC/POS cut bytes so paper isn't cut before QR code is printed
function stripTrailingEscPosCut(bytes) {
    if (!bytes || bytes.length < 3) return bytes;
    let end = bytes.length;
    while (end > 0) {
        if (end >= 4 && bytes[end-4] === 0x1D && bytes[end-3] === 0x56 && bytes[end-2] === 0x42 && bytes[end-1] === 0x00) {
            end -= 4;
        } else if (end >= 3 && bytes[end-3] === 0x1D && bytes[end-2] === 0x56 && bytes[end-1] === 0x00) {
            end -= 3;
        } else if (end >= 3 && bytes[end-3] === 0x1B && bytes[end-2] === 0x64) {
            end -= 3;
        } else {
            break;
        }
    }
    return bytes.slice(0, end);
}

// Print directly to SUNMI Built-in Thermal Printer with FIFO Queue
export async function printToSunmiBuiltIn(rawData, logoUrl = null, qrUrl = null) {
    logger.logNativeStart('print_sunmi_built_in', { bytesLength: rawData ? rawData.length : 0, hasLogo: !!logoUrl, hasQr: !!qrUrl });
    return new Promise((resolve, reject) => {
        sunmiPrintQueue = sunmiPrintQueue.then(async () => {
            try {
                logger.info("SUNMI: loading @kduma-autoid/capacitor-sunmi-printer");
                const { SunmiPrinter } = await import('@kduma-autoid/capacitor-sunmi-printer');
                logger.info("SUNMI: calling bindService");
                try {
                    await SunmiPrinter.bindService();
                } catch (bindErr) {
                    console.warn("SUNMI bindService warning (may already be bound):", bindErr);
                    logger.warn("SUNMI: bindService warning (non-fatal)", bindErr);
                }

                // 1. Logo printing
                if (logoUrl) {
                    try {
                        logger.info("SUNMI: getting Logo from cache or loading: " + logoUrl);
                        const base64Logo = await getCachedResizedImage(logoUrl, 384);
                        if (base64Logo) {
                            logger.info("SUNMI: printing Logo bitmap");
                            await SunmiPrinter.setAlignment({ alignment: "center" });
                            await SunmiPrinter.printBitmap({ bitmap: base64Logo });
                            await SunmiPrinter.lineWrap({ lines: 1 });
                            await SunmiPrinter.setAlignment({ alignment: "left" });
                        }
                    } catch (logoErr) {
                        console.warn("SUNMI print Logo warning (non-fatal):", logoErr);
                        logger.warn("SUNMI: print Logo warning (non-fatal)", logoErr);
                    }
                }

                // 2. Body raw bytes (strip trailing cut if QR URL is present)
                logger.info("SUNMI: converting rawData to base64 string");
                const bodyBytes = qrUrl ? stripTrailingEscPosCut(rawData) : rawData;
                let binary = '';
                const len = bodyBytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bodyBytes[i]);
                }
                const base64Data = window.btoa(binary);

                logger.info("SUNMI: calling sendRAWBase64Data");
                await SunmiPrinter.sendRAWBase64Data({ data: base64Data });
                logger.info("SUNMI: sendRAWBase64Data completed successfully");
                
                // 3. QR printing
                let didPrintQr = false;
                if (qrUrl) {
                    try {
                        logger.info("SUNMI: getting QR from cache or loading: " + qrUrl);
                        const base64Qr = await getCachedResizedImage(qrUrl, 360);
                        if (base64Qr) {
                            logger.info("SUNMI: printing QR code bitmap");
                            await SunmiPrinter.setAlignment({ alignment: "center" });
                            await SunmiPrinter.printBitmap({ bitmap: base64Qr });
                            await SunmiPrinter.lineWrap({ lines: 1 });
                            await SunmiPrinter.setAlignment({ alignment: "left" });
                            didPrintQr = true;
                        }
                    } catch (qrErr) {
                        console.warn("SUNMI print QR warning (non-fatal):", qrErr);
                        logger.warn("SUNMI: print QR warning (non-fatal)", qrErr);
                    }
                }

                // 4. Cut paper after QR
                if (didPrintQr) {
                    try {
                        await SunmiPrinter.cutPaper();
                    } catch (cutErr) {}
                }

                await new Promise(r => setTimeout(r, 200));
                
                logger.logNativeEnd('print_sunmi_built_in');
                resolve(true);
            } catch (e) {
                logger.error("SUNMI Built-in print failed inside queue", e);
                logger.logNativeEnd('print_sunmi_built_in');
                console.error("SUNMI Built-in print failed inside queue:", e);
                reject(new Error("ไม่สามารถพิมพ์ผ่านเครื่องพิมพ์ในตัว SUNMI ได้: " + e.message));
            }
        }).catch(err => {
            logger.error("SUNMI Print Queue error", err);
            logger.logNativeEnd('print_sunmi_built_in');
            console.error("SUNMI Print Queue error:", err);
            reject(err);
        });
    });
}

/**
 * Auto print slips (kitchen/bar/other) for incoming QR code orders.
 */
export async function autoPrintQROrder(booking, optionMap = {}) {
    if (!booking) return false;
    try {
        const config = getPrinterConfig() || {};
        const printerType = config.printer_type || 'sunmi';
        let activePaperSize = config.kitchen_paper_size || config.paper_width || '80mm';

        const orderItems = booking.order_items || [];
        if (orderItems.length === 0) return false;

        const paymentMethod = booking.payment_method || 'qr';

        if (printerType === 'sunmi') {
            let printed = false;
            const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, optionMap, activePaperSize, config, 'sunmi');
            if (kitchenBytes) {
                await printToSunmiBuiltIn(kitchenBytes);
                printed = true;
            }
            const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, optionMap, activePaperSize, config, 'sunmi');
            if (barBytes) {
                await printToSunmiBuiltIn(barBytes);
                printed = true;
            }
            return printed;
        } else if (printerType === 'rawbt') {
            let isSeparateBarPrinterEnabled = !!(config.separate_bar_printer || config.bar_printer_ip);
            let targetTab = isSeparateBarPrinterEnabled ? 'kitchen' : 'kitchen_all';
            const rawBytes = encodeReceiptData(booking, targetTab, paymentMethod, optionMap, activePaperSize, config, 'rawbt');
            if (rawBytes) {
                await printToRawBTWebSocket(rawBytes);
            }
            if (isSeparateBarPrinterEnabled) {
                const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, optionMap, activePaperSize, config, 'rawbt');
                if (barBytes) await printToRawBTWebSocket(barBytes);
            }
            return true;
        } else if (printerType === 'bluetooth') {
            const btDeviceName = config.bluetooth_device_name;
            let targetTab = 'kitchen_all';
            const rawBytes = encodeReceiptData(booking, targetTab, paymentMethod, optionMap, activePaperSize, config, 'bluetooth');
            if (rawBytes) {
                await printToBluetoothDirect(btDeviceName, rawBytes);
            }
            return true;
        }
    } catch (err) {
        console.error("autoPrintQROrder failed:", err);
    }
    return false;
}

