import { logger } from './logger';
import { supabase } from '../lib/supabaseClient';
import { getBookingPaymentBreakdown } from './shiftHelper';
import { parseTableTransferInfo } from './tableTransferHelper';

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

export function getShortBookingId(booking) {
    if (!booking) return '0000';
    if (typeof booking === 'string') {
        const raw = booking.trim();
        if (raw.startsWith('local')) {
            const digits = raw.replace(/[^0-9]/g, '');
            return digits.length >= 4 ? digits.slice(-4) : (digits || '0000');
        }
        const clean = raw.replace(/[^a-zA-Z0-9]/g, '');
        return clean.length >= 4 ? clean.slice(-4).toUpperCase() : (clean.toUpperCase() || '0000');
    }
    if (booking.short_id) {
        return String(booking.short_id).toUpperCase();
    }
    const token = booking.tracking_token || booking.trackingToken;
    if (token) {
        return String(token).slice(-4).toUpperCase();
    }
    const rawId = String(booking.id || booking.booking_id || booking.order_id || '');
    if (rawId.startsWith('local')) {
        const digits = rawId.replace(/[^0-9]/g, '');
        return digits.length >= 4 ? digits.slice(-4) : (digits || '0000');
    }
    const cleanUuid = rawId.replace(/[^a-zA-Z0-9]/g, '');
    return cleanUuid ? cleanUuid.slice(-4).toUpperCase() : '0000';
}

export function getBookingPaymentMethod(booking) {
    if (!booking) return 'CASH';
    const remark = (booking.staff_remark || '').toLowerCase();
    if (remark.includes('credit') || remark.includes('บัตรเครดิต') || booking.payment_method === 'credit') return 'CREDIT';
    if (booking.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน') || booking.payment_method === 'qr') return 'QR';
    return booking.payment_method ? booking.payment_method.toUpperCase() : 'CASH';
}

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

// Clean auto-generated system customer notes (e.g. 'Walk-in Customer', 'Walk-in Pick-up')
export function getCleanCustomerNote(note) {
    if (!note) return '';
    const n = String(note).trim();
    if (!n) return '';
    const lower = n.toLowerCase();
    const defaultPlaceholders = [
        'walk-in guest',
        'walk-in pick-up',
        'walk-in pickup',
        'walk-in customer',
        'walk-in',
        'walk-in-customer',
        'walk-in customer (offline)',
        'walk-in pick-up (offline)',
        'walk-in pick-up (offline sync)',
        'walk-in pick-up (offline fallback)',
        'offline walk-in',
        'qr walk-in guest',
        'anonymous user',
        'ลูกค้าทั่วไป',
        'ลูกค้าทั่วไป (walk-in)',
        'internal block',
        'maintenance block'
    ];
    if (defaultPlaceholders.includes(lower) || lower.startsWith('walk-in')) {
        return '';
    }
    const cleaned = n.replace('[CUSTOMER_ARRIVED]', '').replace('[CALL_STAFF]', '').replace('[CALL_BILL]', '').trim();
    return cleaned;
}

// Clean auto-generated system remarks (e.g. 'Walk-in Guest', '[CALL_STAFF]')
export function getCleanStaffRemark(remark) {
    if (!remark) return '';
    const r = String(remark).trim();
    if (!r) return '';
    const lower = r.toLowerCase();
    const defaultPlaceholders = [
        'walk-in guest',
        'walk-in pick-up',
        'walk-in pickup',
        'walk-in customer',
        'walk-in',
        'walk-in-customer',
        'walk-in customer (offline)',
        'walk-in pick-up (offline)',
        'walk-in pick-up (offline sync)',
        'walk-in pick-up (offline fallback)',
        'offline walk-in',
        'qr walk-in guest',
        'anonymous user',
        'ลูกค้าทั่วไป',
        'ลูกค้าทั่วไป (walk-in)'
    ];
    
    if (
        defaultPlaceholders.includes(lower) ||
        lower.startsWith('walk-in') ||
        lower.startsWith('paid by cash') ||
        lower.startsWith('paid by qr') ||
        lower.startsWith('paid by credit') ||
        lower === '[call_staff]' ||
        lower === '[call_bill]' ||
        lower.startsWith('merged into table') ||
        lower.startsWith('split paid by')
    ) {
        return '';
    }

    const cleaned = r
        .replace(/\[CALL_STAFF\]/gi, '')
        .replace(/\[CALL_BILL\]/gi, '')
        .replace(/\[CASH:[^\]]+\]/gi, '')
        .replace(/\[SPLIT:[^\]]+\]/gi, '')
        .replace(/\[MERGED_TO:[^\]]+\]/gi, '')
        .replace(/\[MERGED_FROM:[^\]]+\]/gi, '')
        .replace(/\[MOVED:[^\]]+\]/gi, '')
        .replace(/\[ORIG_AMT:[^\]]+\]/gi, '')
        .replace(/Merged into Table\s+\w+/gi, '')
        .trim();
    return cleaned;
}

// Extract cash payment details (received and change) from booking object, remark tags, or localStorage
export function extractCashDetails(booking, fallbackTotal = 0) {
    if (!booking) {
        return { received: null, change: null };
    }
    
    // 1. Direct object properties
    if (booking.cash_received !== undefined && booking.cash_received !== null && Number(booking.cash_received) > 0) {
        const recv = Number(booking.cash_received);
        const chg = Number(booking.cash_change !== undefined && booking.cash_change !== null 
            ? booking.cash_change 
            : (booking.change_due !== undefined && booking.change_due !== null ? booking.change_due : Math.max(0, recv - (booking.total_amount || fallbackTotal))));
        return { received: recv, change: chg };
    }
    
    // 2. Metadata properties
    if (booking.metadata && typeof booking.metadata === 'object') {
        if (booking.metadata.cash_received) {
            const recv = Number(booking.metadata.cash_received);
            const chg = Number(booking.metadata.cash_change || booking.metadata.change_due || Math.max(0, recv - (booking.total_amount || fallbackTotal)));
            return { received: recv, change: chg };
        }
    }
    
    // 3. Staff remark parsing (e.g. [CASH: RECV=500, CHANGE=265] or รับเงินสด: 500 ทอน: 265)
    const remark = String(booking.staff_remark || '');
    if (remark) {
        const tagMatch = remark.match(/\[CASH:\s*RECV=([0-9.]+),\s*CHANGE=([0-9.]+)\]/i);
        if (tagMatch) {
            return { received: parseFloat(tagMatch[1]), change: parseFloat(tagMatch[2]) };
        }
        
        const recvMatch = remark.match(/(?:รับเงิน(?:สด)?|รับมา|received|recv)[\s:=]*฿?([0-9,]+(?:\.[0-9]+)?)/i);
        const chgMatch = remark.match(/(?:เงินทอน|ทอน|change(?:_due)?)[\s:=]*฿?([0-9,]+(?:\.[0-9]+)?)/i);
        if (recvMatch) {
            const recv = parseFloat(recvMatch[1].replace(/,/g, ''));
            const chg = chgMatch ? parseFloat(chgMatch[1].replace(/,/g, '')) : Math.max(0, recv - (Number(booking.total_amount) || fallbackTotal));
            return { received: recv, change: chg };
        }
    }
    
    // 4. LocalStorage fallback (if active session)
    if (typeof window !== 'undefined') {
        try {
            const storedRecv = localStorage.getItem('last_cash_received');
            const storedChange = localStorage.getItem('last_cash_change');
            if (storedRecv !== null && Number(storedRecv) > 0) {
                return {
                    received: parseFloat(storedRecv),
                    change: storedChange !== null ? parseFloat(storedChange) : Math.max(0, parseFloat(storedRecv) - (Number(booking.total_amount) || fallbackTotal))
                };
            }
        } catch (e) {}
    }
    
    // 5. Fallback for cash payment when no specific tender was recorded (exact cash)
    const methodStr = (booking.payment_method || '').toLowerCase();
    const remarkLower = (booking.staff_remark || '').toLowerCase();
    const isCash = methodStr === 'cash' || remarkLower.includes('cash') || (!remarkLower.includes('qr') && !remarkLower.includes('credit') && !booking.payment_slip_url);
    if (isCash) {
        const total = Number(booking.total_amount || fallbackTotal);
        if (total > 0) {
            return { received: total, change: 0 };
        }
    }
    
    return { received: null, change: null };
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
    // Safe Column Limits: 36 for 80mm thermal paper rolls and 26 for 58mm rolls per Rule 3
    return is58mm ? 26 : 36;
}

// Classifier helper to categorize menu items into kitchen, bar, or other
export const classifyItem = (item, receiptConfig = {}) => {
    if (!item) return 'kitchen';

    // 1. Check Category IDs (Catalog classification takes highest priority)
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

    // Standard UUIDs for Bar items (Coffee, Soft Drinks/Water/Ice/Soda, Beer, Alcohol, Cocktails)
    const DEFAULT_BAR_CATS = [
        '7524bb8a-4698-45c6-aa17-d8ccc296f667', // Coffee
        '912683ef-fdc3-40a3-8dd8-b09507791240', // Soft Drink (Soda, Water, Ice, Coke)
        'b441665e-2f23-4df3-a11d-63485e1690dc', // Beer
        'a2c783fc-975b-4779-b9eb-67391eeafd1f', // Alcohol
        '1983955d-5787-4351-b729-51b95761f125', // Mocktail & Cocktail
        '1407d869-4eed-489e-aeeb-ba7ef19f57bd', // Bottled
        '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'  // PRO Beer
    ];
    if (DEFAULT_BAR_CATS.includes(catId)) return 'bar';

    // 2. Check explicit Bar / Other destinations on custom or configured items
    const directDest = String(item.destination || '').toLowerCase().trim();
    if (directDest === 'bar' || directDest === 'drinks' || directDest === 'drink' || directDest === 'beverage') return 'bar';
    if (directDest === 'other') return 'other';

    // 3. Check selected_options array for destination objects, badges, and textual markers
    if (item.selected_options && Array.isArray(item.selected_options)) {
        for (const opt of item.selected_options) {
            if (typeof opt === 'object' && opt !== null) {
                const optDest = String(opt.destination || '').toLowerCase().trim();
                if (optDest === 'bar' || optDest === 'drinks' || optDest === 'drink') return 'bar';
                if (optDest === 'other') return 'other';

                const optName = String(opt.name || opt.custom_item_name || '');
                if (optName.includes('(บาร์)') || optName.includes('(Bar)') || optName.includes('เครื่องดื่ม')) return 'bar';
                if (optName.includes('(ทั่วไป)') || optName.includes('(Other)')) return 'other';
            } else if (typeof opt === 'string') {
                if (opt.includes('(บาร์)') || opt.includes('(Bar)') || opt.includes('เครื่องดื่ม')) return 'bar';
                if (opt.includes('(ทั่วไป)') || opt.includes('(Other)')) return 'other';
            }
        }
    }

    // 4. Category Name heuristic check (for custom items or catalog items)
    const catName = String(item.category_name || item.menu_items?.menu_categories?.name || item.menu_items?.category_name || '').toLowerCase();
    if (catName.includes('เครื่องดื่ม') || catName.includes('bar') || catName.includes('drink') || catName.includes('coffee') || catName.includes('beer') || catName.includes('alcohol')) {
        return 'bar';
    }

    // 5. Item Name heuristic check for common bar items (Soda, Ice, Mineral water, etc.)
    const itemName = String(item.name || item.custom_name || item.menu_items?.name || '').toLowerCase();
    if (itemName.includes('โซดา') || itemName.includes('น้ำแข็ง') || itemName.includes('น้ำแร่') || itemName.includes('น้ำเปล่า') || itemName.includes('soda') || itemName.includes('water') || itemName.includes('beer') || itemName.includes('เบียร์')) {
        return 'bar';
    }

    return 'kitchen';
};

export function resolveStaffDisplayName(booking = {}, shiftObj = null) {
    let raw = '';
    if (booking.staff_name) raw = booking.staff_name;
    else if (booking.staff?.display_name) raw = booking.staff.display_name;
    else if (booking.staff && typeof booking.staff === 'string') raw = booking.staff;

    if (!raw) {
        try {
            const activeStaff = localStorage.getItem('pos_active_staff') || localStorage.getItem('pos_staff_user');
            if (activeStaff) {
                const p = JSON.parse(activeStaff);
                if (p.display_name || p.name) raw = p.display_name || p.name;
            }
        } catch (e) {}
    }

    if (!raw) {
        let shift = shiftObj;
        if (!shift) {
            try { shift = JSON.parse(localStorage.getItem('pos_current_shift')); } catch (e) {}
        }
        if (shift && shift.staffName) raw = shift.staffName;
    }

    if (!raw) return '';

    const isUuidOrId = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(raw) || /^[0-9a-f]{16,}$/i.test(raw) || /^usr_/i.test(raw) || /^default_/i.test(raw);
    if (isUuidOrId) {
        try {
            const cachedStaff = JSON.parse(localStorage.getItem('pos_cache_staff_list')) || [];
            const found = cachedStaff.find(s => s.id === raw || s.user_id === raw);
            if (found && found.display_name) return found.display_name;
        } catch (e) {}
    }

    return raw;
}

export const selectItemsForTab = (orderItems = [], activeTab = 'receipt', receiptConfig = {}) => {
    let items = orderItems || [];
    if (activeTab === 'receipt') {
        // Filter out void / cancelled items for receipt printing
        items = items.filter(item => item.status !== 'void' && item.status !== 'cancelled');
    }

    if (activeTab === 'kitchen_all' || activeTab === 'receipt' || activeTab === 'billing') {
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

    let cfg = {};
    try {
        cfg = getPrinterConfig() || {};
    } catch (e) {}

    const vatMode = (receiptConfig.vat_mode || cfg.vat_mode || 'none').toLowerCase(); // 'none' | 'inclusive' | 'exclusive'
    let vatCents = 0;
    let totalCents = netAfterDiscountCents;

    if (vatMode === 'inclusive') {
        vatCents = Math.round((netAfterDiscountCents * 7) / 107);
        totalCents = netAfterDiscountCents;
    } else if (vatMode === 'exclusive') {
        vatCents = Math.round(netAfterDiscountCents * 0.07);
        totalCents = netAfterDiscountCents + vatCents;
    } else {
        // When VAT 7% is disabled ('none'), vatCents remains 0
        vatCents = 0;
        totalCents = netAfterDiscountCents;
    }

    const bookedTotalCents = (booking.total_amount != null && Number.isFinite(Number(booking.total_amount)) && Number(booking.total_amount) > 0)
        ? Math.round(Number(booking.total_amount) * 100)
        : totalCents;

    // If discount was applied (discountCents > 0) and bookedTotalCents was still at the pre-discount subtotal level,
    // ensure bookedTotalCents reflects the discounted net total!
    let finalBookedTotalCents = bookedTotalCents;
    if (discountCents > 0 && Math.abs(bookedTotalCents - subtotalCents) < 50) {
        finalBookedTotalCents = totalCents;
    }

    const adjustmentCents = finalBookedTotalCents - totalCents;

    return {
        subtotal: subtotalCents / 100,
        discount: discountCents / 100,
        netAfterDiscount: netAfterDiscountCents / 100,
        vat: vatCents / 100,
        total: finalBookedTotalCents / 100,
        calculatedTotal: totalCents / 100,
        adjustmentCents,
        hasAdjustment: Math.abs(adjustmentCents) >= 50,
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

    if (booking.xhaus_discount > 0) {
        rows.push({ type: 'xhaus_discount', label: 'ส่วนลด xhaus', value: `-${formatReceiptMoney(booking.xhaus_discount)}` });
    }
    if (totals.discount > 0) {
        const otherDiscount = Math.max(0, totals.discount - (booking.xhaus_discount || 0));
        if (otherDiscount > 0 || !booking.xhaus_discount) {
            rows.push({ type: 'discount', label: booking.xhaus_discount ? 'ส่วนลดอื่นๆ' : 'ส่วนลด', value: `-${formatReceiptMoney(booking.xhaus_discount ? otherDiscount : totals.discount)}` });
        }
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
            const nameA = a.custom_name || a.menu_items?.name || a.name || '';
            const nameB = b.custom_name || b.menu_items?.name || b.name || '';
            return nameA.localeCompare(nameB);
        });
    }

    const encoder = new EscPosEncoder(false); // ALWAYS use TIS-620 for Thai POS printers
    encoder.initialize();

    const maxCols = resolveMaxCols(paperSize, receiptConfig.maxCols);

    // CRITICAL TIS-620 CENTERING INTERCEPTOR:
    // To ensure headers and body align perfectly, we intercept align() and size() calls.
    // Instead of using hardware centering (which centers based on 48 columns),
    // we manually pad spaces to center within the software 'maxCols' (e.g. 42 columns).
    // This makes the entire receipt block perfectly unified and left-aligned on the paper.
    let currentAlign = 'left';
    let currentSizeW = 0;

    const originalAlign = encoder.align.bind(encoder);
    encoder.align = function(type) {
        currentAlign = type;
        originalAlign('left'); // Force hardware to always be left-aligned
        return this;
    };

    const originalSize = encoder.size.bind(encoder);
    encoder.size = function(width, height) {
        currentSizeW = width;
        originalSize(width, height);
        return this;
    };

    const is80mm = String(paperSize ?? '').toLowerCase().includes('80');
    // If maxCols is 36 and hardware is 48, offset is 6 spaces to physically center the block
    const hardwareCols = is80mm ? 48 : 32;
    const paddingCols = Math.max(0, hardwareCols - maxCols);
    const offset = Math.floor(paddingCols / 2);
    const globalLeftMargin = ' '.repeat(offset);

    const originalLine = encoder.line.bind(encoder);
    encoder.line = function(value) {
        let str = String(value ?? '');
        
        // Handle multiline strings (e.g. from formatItemLine)
        const lines = str.split('\n');
        const processedLines = lines.map(line => {
            let processedLine = line;
            const width = getPrinterCellWidth(processedLine, true);
            if (currentSizeW === 1) {
                const targetCols = Math.floor(maxCols / 2);
                const halfOffset = Math.floor(offset / 2);
                const margin = ' '.repeat(halfOffset);
                if (currentAlign === 'center' && width < targetCols) {
                    const padding = Math.floor((targetCols - width) / 2);
                    processedLine = ' '.repeat(padding) + processedLine;
                } else if (currentAlign === 'right' && width < targetCols) {
                    const padding = targetCols - width;
                    processedLine = ' '.repeat(padding) + processedLine;
                }
                return margin + processedLine;
            } else {
                const targetCols = maxCols;
                if (currentAlign === 'center' && width < targetCols) {
                    const padding = Math.floor((targetCols - width) / 2);
                    processedLine = ' '.repeat(padding) + processedLine;
                } else if (currentAlign === 'right' && width < targetCols) {
                    const padding = targetCols - width;
                    processedLine = ' '.repeat(padding) + processedLine;
                }
                return globalLeftMargin + processedLine;
            }
        });

        originalLine(processedLines.join('\n'));
        return this;
    };

    if (activeTab === 'receipt' && paymentMethod === 'cash') {
        encoder.kickDrawer();
    }

    const queueNo = getShortBookingId(booking);
    
    // Order Created/Placed timestamp (when the customer/staff submitted the order)
    const orderPlacedAtRaw = booking.created_at || booking.order_time || (booking.booking_type !== 'dine_in' && booking.booking_type !== 'pickup' ? booking.booking_time : null) || new Date().toISOString();
    const orderPlacedDate = new Date(orderPlacedAtRaw);
    const orderPlacedStr = orderPlacedDate.toLocaleString('th-TH', { 
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
    });

    // Scheduled Booking / Pickup appointment timestamp (when customer arrives/picks up)
    const bookingAppointmentDate = booking.booking_time ? new Date(booking.booking_time) : orderPlacedDate;
    const formattedBookingTimeStr = bookingAppointmentDate.toLocaleString('th-TH', { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

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
    
    // Check category: LINE MAN Delivery vs Online Pickup vs Online Table Booking vs Walk-in Pickup vs IN HAUS Dine-In vs Split Payment
    const isLineman = sourceLower === 'lineman' || remarkLower.includes('lineman') || remarkLower.includes('line man') || noteLower.includes('lineman') || (booking.customer_name || '').toLowerCase().includes('line man');
    const isSplitOrder = remarkLower.includes('split');
    const isOnlineSource = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('online') || noteLower.includes('online') || isLineman;
    const isPickupOrder = booking.booking_type === 'pickup' || remarkLower.includes('pickup') || remarkLower.includes('takeaway') || remarkLower.includes('รับกลับ') || noteLower.includes('pickup') || (!booking.tables_layout && sourceLower !== 'qr') || isLineman;
    
    const isOnlinePickup = isOnlineSource && isPickupOrder && !isLineman;
    const isOnlineBooking = isOnlineSource && !isPickupOrder && sourceLower !== 'qr' && !isLineman;

    let orderBannerTitle = '';
    let orderBannerSub = '';

    if (isLineman) {
        orderBannerTitle = 'LINE MAN DELIVERY';
        orderBannerSub = '(ออเดอร์เดลิเวอรี LINE MAN)';
    } else if (isSplitOrder) {
        orderBannerTitle = 'SPLIT PAYMENT RECEIPT';
        orderBannerSub = '(ใบเสร็จแบ่งชำระเงิน)';
    } else if (isOnlinePickup) {
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
               .bold(true)
               .size(1, 1)
               .line(orderBannerTitle)
               .size(0, 0)
               .bold(true)
               .line(orderBannerSub)
               .bold(false)
               .line(doubleDivider);

        if (shopAddress) {
            encoder.line(shopAddress.toUpperCase());
        }
        if (shopPhone) {
            encoder.line(`TEL: ${shopPhone}`);
        }
        if (shopVat) {
            encoder.line(`TAX ID: ${shopVat}`);
        }
        encoder.line(doubleDivider);
    }

    // Table Name & Queue Number
    const transfer = parseTableTransferInfo(booking);
    const tableName = (booking.tables_layout?.table_name || (isPickupOrder ? 'PICKUP' : 'WALK-IN')).toUpperCase();
    let tableDisplayTitle = isPickupOrder ? `รหัส: #${queueNo}` : `โต๊ะ ${tableName}`;
    if (!isPickupOrder) {
        if (transfer.isMergedSource) {
            tableDisplayTitle = `โต๊ะ ${tableName} (รวมเข้า ${transfer.mergedToTable})`;
        } else if (transfer.isMergedTarget) {
            tableDisplayTitle = `โต๊ะ ${tableName} (โต๊ะรวม +${transfer.mergedFromTables.join(',')})`;
        } else if (transfer.isMoved) {
            tableDisplayTitle = `โต๊ะ ${tableName} (ย้ายจาก ${transfer.movedFromTable})`;
        }
    }

    const customerName = booking.profiles?.display_name || booking.pickup_contact_name || booking.customer_name || 'ลูกค้าทั่วไป (Walk-in)';
    const customerPhone = booking.profiles?.phone_number || booking.pickup_contact_phone || booking.customer_phone || '';
    const depositAmt = Number(booking.deposit_amount) || 0;
    const totalAmt = Number(booking.total_amount) || 0;
    const balanceDue = Math.max(0, totalAmt - depositAmt);

    if (isKitchenTab) {
        let serviceType = 'IN HAUS DINE-IN (ทานที่ร้าน)';
        if (isLineman) {
            serviceType = 'LINE MAN (เดลิเวอรี)';
        } else if (isOnlinePickup) {
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
               .line(tableDisplayTitle)
               .size(0, 0)
               .line(divider)
               .align('left')
               .bold(true)
               .line(`บริการ: ${serviceType}`)
               .line(`พนักงานรับ: ${staffName ? staffName.toUpperCase() : 'SYSTEM'}`);

        if (isPickupOrder) {
            encoder.line(`เวลาสั่ง: ${orderPlacedStr}`);
            if (isOnlinePickup || booking.booking_time) {
                encoder.line(`วันเวลามารับ: ${formattedBookingTimeStr}`);
            }
        } else if (isOnlineBooking) {
            encoder.line(`เวลาทำรายการ: ${orderPlacedStr}`)
                   .line(`วันเวลาที่จองโต๊ะ: ${formattedBookingTimeStr}`);
        } else {
            encoder.line(`เวลาสั่ง: ${orderPlacedStr}`);
        }

        encoder.line(`จำนวนคน: ${booking.pax || booking.guest_count || 1} ท่าน`)
               .line(`จำนวนรายการ: ${totalItemsCount} ชิ้น`)
               .bold(false)
               .line(divider);
    } else {
        encoder.align('center')
               .bold(true)
               .size(1, 1)
               .line(tableDisplayTitle)
               .size(0, 0)
               .bold(false)
               .line(divider);
    }

    // Meta info (Proof / Evidence details)
    if (!isKitchenTab) {
        let channelText = 'IN HAUS (หน้าร้าน)';
        if (isLineman) {
            channelText = 'LINE MAN (เดลิเวอรี)';
        } else if (isOnlinePickup || isOnlineBooking) {
            channelText = 'ONLINE (ออนไลน์)';
        } else if (isPickupOrder) {
            channelText = 'IN-HAUS (หน้าร้าน)';
        }

        encoder.align('left')
               .bold(true)
               .line(`ช่องทาง: ${channelText}`)
               .line(`ประเภทบริการ: ${isLineman ? 'เดลิเวอรี (LINE MAN)' : (isPickupOrder ? 'รับกลับบ้าน (TAKEAWAY)' : (isOnlineBooking ? 'จองโต๊ะออนไลน์ (RESERVATION)' : 'ทานที่ร้าน (DINE-IN)'))}`)
               .bold(false);

        if (isPickupOrder) {
            encoder.line(`เวลาทำรายการ: ${orderPlacedStr}`);
            if (isOnlinePickup || booking.booking_time) {
                encoder.line(`วันเวลามารับ: ${formattedBookingTimeStr}`);
            }
        } else if (isOnlineBooking) {
            encoder.line(`เวลาทำรายการ: ${orderPlacedStr}`)
                   .line(`วันเวลาที่จองโต๊ะ: ${formattedBookingTimeStr}`);
        } else {
            encoder.line(`วันที่-เวลา: ${orderPlacedStr}`);
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
                const qtyColWidth = 3;
                const qtyStr = padEndPrinter(`${item.quantity}x`, qtyColWidth);
                const name = (item.custom_name || item.menu_items?.name || item.name || 'Item').toUpperCase();
                
                const maxDoubleCols = Math.max(12, Math.floor(maxCols / 2));
                const nameColWidth = Math.max(1, maxDoubleCols - qtyColWidth);
                
                const nameLines = wrapTextByWords(name, nameColWidth);
                if (nameLines.length === 0) nameLines.push('');
                
                const kitchenItemLines = [`${qtyStr}${nameLines[0]}`];
                for (let i = 1; i < nameLines.length; i++) {
                    kitchenItemLines.push(`${' '.repeat(qtyColWidth)}${nameLines[i]}`);
                }
                
                encoder.bold(true).size(1, 1);
                kitchenItemLines.forEach(l => encoder.line(l));
                
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
                        wrapTextByWords(optLine, maxDoubleCols).forEach(l => {
                            encoder.line(l);
                        });
                    });
                }
                encoder.size(0, 0).bold(false);
                encoder.line(divider);
            });
        };

        renderKitchenGroup(itemsToRender);
    } else {
        const renderReceiptGroup = (groupItems) => {
            groupItems.forEach(item => {
                const name = (item.custom_name || item.menu_items?.name || item.name || 'Item').toUpperCase();
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

    // CRM Member details
    if (!isKitchenTab && activeTab === 'receipt' && booking.profiles) {
        encoder.align('center').bold(true).line('--- ข้อมูลสมาชิก (MEMBER) ---').bold(false).align('left');
        
        encoder.line(formatTwoCols('ชื่อสมาชิก:', booking.profiles.display_name || '-', maxCols));
        if (booking.profiles.phone_number) {
            encoder.line(formatTwoCols('เบอร์โทรศัพท์:', booking.profiles.phone_number, maxCols));
        }

        const tierName = booking.profiles.current_tier || booking.profiles.tier || 'Haus Common';
        const mult = booking.profiles.multiplier ? `${parseFloat(booking.profiles.multiplier).toFixed(2).replace(/\.00$/, '')}x` : (tierName === 'Inner Haus' ? '1.5x' : (tierName === 'Haus People' ? '1.25x' : '1.0x'));
        encoder.line(formatTwoCols('ระดับสมาชิก:', `${tierName} (แต้ม ${mult})`, maxCols));

        const earned = Number(booking.xhaus_earned) || 0;
        const redeemed = Number(booking.xhaus_redeemed) || 0;
        const xhausDisc = Number(booking.xhaus_discount) || 0;
        const balance = Number(booking.profiles.xhaus_balance) || 0;
        const stamps = Number(booking.profiles.drink_stamp_count) || 0;
        const freeQuota = Number(booking.profiles.free_drink_quota) || 0;

        encoder.line(divider);
        if (earned > 0) {
            encoder.line(formatTwoCols('ได้รับ xhaus ครั้งนี้:', `+${earned.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})} xhaus`, maxCols));
        }
        if (redeemed > 0) {
            const discStr = xhausDisc > 0 ? ` (-฿${xhausDisc.toLocaleString()})` : '';
            encoder.line(formatTwoCols('ตัดยอดแต้มที่ใช้ไป:', `-${redeemed.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})} xhaus${discStr}`, maxCols));
        }
        encoder.line(formatTwoCols('แต้มสะสมคงเหลือ:', `${balance.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})} xhaus`, maxCols));
        
        encoder.line(divider);
        encoder.line(formatTwoCols('แสตมป์เครื่องดื่ม:', `${stamps}/10 แก้ว`, maxCols));
        if (freeQuota > 0) {
            encoder.line(formatTwoCols('สิทธิ์เครื่องดื่มฟรี:', `${freeQuota} แก้ว`, maxCols));
        }
        encoder.line(doubleDivider);
    }

    // Payment details
    if (activeTab === 'receipt') {
        const isCashMethod = String(paymentMethod || '').toLowerCase() === 'cash';
        const isCreditMethod = String(paymentMethod || '').toLowerCase() === 'credit';
        const methodLabel = isCashMethod ? 'เงินสด' : (isCreditMethod ? 'บัตรเครดิต' : 'โอนเงินผ่าน QR');
        
        encoder.align('center')
               .line(`ช่องทางชำระเงิน: ${methodLabel}`);
               
        if (isCashMethod) {
            encoder.align('left').size(0, 0);
            const totalForCash = Number(booking.total_amount) || 0;
            const cashDetails = extractCashDetails(booking, totalForCash);
            if (cashDetails.received !== null && cashDetails.received > 0) {
                const cashRecvVal = formatReceiptMoney(cashDetails.received);
                const cashChangeVal = formatReceiptMoney(cashDetails.change || 0);
                encoder.line(formatTwoCols('รับเงินสดมา', cashRecvVal, maxCols));
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
    const cleanCustomerNote = getCleanCustomerNote(booking.customer_note);
    const cleanStaffNote = getCleanStaffRemark(booking.staff_remark);
    const combinedNotes = [];
    if (cleanCustomerNote) combinedNotes.push(`ลูกค้า: ${cleanCustomerNote}`);
    if (cleanStaffNote) combinedNotes.push(`พนักงาน: ${cleanStaffNote}`);

    if (combinedNotes.length > 0) {
        if (isKitchenTab) {
            encoder.align('left')
                   .bold(true)
                   .size(0, 0)
                   .line('หมายเหตุ:');
            combinedNotes.forEach(noteLine => {
                const lines = wrapTextByWords(noteLine, maxCols - 2);
                lines.forEach(l => encoder.line(`- ${l}`));
            });
            encoder.bold(false);
        } else {
            encoder.align('left')
                   .bold(true)
                   .line('หมายเหตุ:')
                   .bold(false);
            combinedNotes.forEach(noteLine => {
                const lines = wrapTextByWords(noteLine, maxCols - 2);
                lines.forEach(l => encoder.line(l));
            });
        }
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

// Measure string cell width for ESC/POS printing (TIS-620 byte length on thermal printhead per Rule 3)
export function getPrinterCellWidth(str, useByteLength = true) {
    if (str === null || str === undefined) return 0;
    if (useByteLength) return String(str).length;
    const clusters = splitPrinterGraphemes(str);
    return clusters.length;
}

export function padEndPrinter(str, targetWidth, padChar = ' ') {
    const value = String(str ?? '');
    const neededPadding = targetWidth - getPrinterCellWidth(value, true);
    if (neededPadding <= 0) return value;
    return value + padChar.repeat(neededPadding);
}

export function padStartPrinter(str, targetWidth, padChar = ' ') {
    const value = String(str ?? '');
    const neededPadding = targetWidth - getPrinterCellWidth(value, true);
    if (neededPadding <= 0) return value;
    return padChar.repeat(neededPadding) + value;
}

// Slice by printer-cell width without orphaning Thai combining marks
export function sliceThai(str, maxPrinterWidth) {
    const clusters = splitPrinterGraphemes(str);
    let currentWidth = 0;
    let result = '';

    for (const cluster of clusters) {
        const clusterWidth = 1; // Each grapheme cluster consumes exactly 1 printhead cell
        if (result && currentWidth + clusterWidth > maxPrinterWidth) break;
        if (!result && clusterWidth > maxPrinterWidth) return cluster;
        result += cluster;
        currentWidth += clusterWidth;
    }

    return result;
}

// Word/phrase-aware text wrapping using actual visual character cell width
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
        if (getPrinterCellWidth(paragraph, true) <= width) {
            output.push(paragraph);
            return;
        }

        const match = paragraph.match(/^(\s+)/);
        const leadingSpace = match ? match[1] : '';
        
        let rawTokens = [];
        try {
            const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
            rawTokens = Array.from(segmenter.segment(paragraph)).map(s => s.segment);
        } catch(e) {
            rawTokens = paragraph.split(/(\s+)/).filter(Boolean);
        }

        // Glue punctuation like '(' to next word and ')' to previous word to prevent orphaned parentheses
        const words = [];
        for (let i = 0; i < rawTokens.length; i++) {
            let t = rawTokens[i];
            if (t === '(' && i + 1 < rawTokens.length && rawTokens[i+1].trim() !== '') {
                words.push('(' + rawTokens[i+1]);
                i++;
            } else if (t === ')' && words.length > 0 && !words[words.length - 1].endsWith(')')) {
                words[words.length - 1] += ')';
            } else {
                words.push(t);
            }
        }

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

        for (let i = 0; i < words.length; i++) {
            const word = words[i];

            // If word starts with '(' and currentLine has content, check if parenthesized phrase fits
            if (word.startsWith('(') && currentLine.trim() !== '') {
                let parenPhrase = word;
                let j = i + 1;
                while (j < words.length && !parenPhrase.includes(')')) {
                    parenPhrase += words[j];
                    j++;
                }
                if (getPrinterCellWidth(currentLine + ' ' + parenPhrase, true) > width) {
                    output.push(currentLine.trimEnd());
                    currentLine = leadingSpace + word;
                    continue;
                }
            }

            if (!currentLine) {
                currentLine = leadingSpace;
                if (getPrinterCellWidth(currentLine + word, true) <= width) {
                    currentLine += word;
                } else {
                    flushLongWord(currentLine + word);
                    currentLine = '';
                }
                continue;
            }

            const candidate = currentLine + word;
            if (getPrinterCellWidth(candidate, true) <= width) {
                currentLine = candidate;
                continue;
            }

            if (word.trim() === '') continue;

            output.push(currentLine.trimEnd());
            currentLine = leadingSpace;
            if (getPrinterCellWidth(currentLine + word, true) <= width) {
                currentLine += word;
            } else {
                flushLongWord(currentLine + word);
                currentLine = '';
            }
        }

        if (currentLine) output.push(currentLine.trimEnd());
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
    const totalWidth = Math.max(20, Number(maxCols) || 36);
    const nameLines = wrapTextByWords(String(name ?? ''), totalWidth);
    if (nameLines.length === 0) nameLines.push('');

    const left = String(calculationText ?? '');
    const right = String(priceStr ?? '');
    const priceColWidth = Math.max(totalWidth <= 28 ? 8 : 10, getPrinterCellWidth(right, false));
    const leftWidth = Math.max(1, totalWidth - priceColWidth - 1);

    let numericRow;
    if (getPrinterCellWidth(left, false) <= leftWidth) {
        numericRow = padEndPrinter(left, leftWidth) + ' ' + padStartPrinter(right, priceColWidth);
    } else {
        numericRow = padStartPrinter(right, totalWidth);
    }

    return [...nameLines, numericRow].join('\n');
}

export function formatThreeCols(left, mid, right, maxCols, customMidWidth = null, customRightWidth = null) {
    const totalWidth = Math.max(20, Number(maxCols) || 36);
    const isSmall = totalWidth <= 28;
    const leftStr = String(left ?? '');
    const midStr = String(mid ?? '');
    const rightStr = String(right ?? '');

    // Standardized fixed column widths (Qty: 5, Amount: 10) to guarantee crisp grid alignment
    const defaultMidWidth = customMidWidth ?? (isSmall ? 4 : 5);
    const defaultRightWidth = customRightWidth ?? (isSmall ? 8 : 10);

    const midWidth = Math.max(getPrinterCellWidth(midStr, true), defaultMidWidth);
    const rightWidth = Math.max(getPrinterCellWidth(rightStr, true), defaultRightWidth);
    const minLeftWidth = isSmall ? 6 : 8;

    if (midWidth + rightWidth + 2 + minLeftWidth > totalWidth) {
        const leftLines = wrapTextByWords(leftStr, totalWidth);
        const numericLine = formatTwoCols(midStr, rightStr, totalWidth, rightWidth);
        return [...leftLines, numericLine].join('\n');
    }

    const leftWidth = totalWidth - midWidth - rightWidth - 2;
    const leftLines = wrapTextByWords(leftStr, leftWidth);
    if (leftLines.length === 0) leftLines.push('');

    if (leftLines.length === 1) {
        return padEndPrinter(leftLines[0], leftWidth) +
            ' ' + padStartPrinter(midStr, midWidth) +
            ' ' + padStartPrinter(rightStr, rightWidth);
    }

    // Multi-line: Print preceding name lines first, and attach quantity & price strictly to the last line
    const output = [];
    for (let i = 0; i < leftLines.length - 1; i++) {
        output.push(leftLines[i]);
    }
    const lastLine = leftLines[leftLines.length - 1];
    output.push(
        padEndPrinter(lastLine, leftWidth) +
        ' ' + padStartPrinter(midStr, midWidth) +
        ' ' + padStartPrinter(rightStr, rightWidth)
    );
    return output.join('\n');
}

export function formatTwoCols(left, right, maxCols, customRightWidth = null) {
    const totalWidth = Math.max(20, Number(maxCols) || 36);
    const isSmall = totalWidth <= 28;
    const leftStr = String(left ?? '');
    const rightStr = String(right ?? '');
    const rightWidth = Math.max(getPrinterCellWidth(rightStr, true), customRightWidth ?? (isSmall ? 8 : 10));
    const minLeftWidth = isSmall ? 6 : 8;

    if (rightWidth + 1 + minLeftWidth > totalWidth) {
        const leftLines = wrapTextByWords(leftStr, totalWidth);
        return [...leftLines, padStartPrinter(rightStr, totalWidth)].join('\n');
    }

    const leftWidth = totalWidth - rightWidth - 1;
    const leftLines = wrapTextByWords(leftStr, leftWidth);
    if (leftLines.length === 0) leftLines.push('');

    if (leftLines.length === 1) {
        return padEndPrinter(leftLines[0], leftWidth) +
            ' ' + padStartPrinter(rightStr, rightWidth);
    }

    const output = [];
    for (let i = 0; i < leftLines.length - 1; i++) {
        output.push(leftLines[i]);
    }
    const lastLine = leftLines[leftLines.length - 1];
    output.push(
        padEndPrinter(lastLine, leftWidth) +
        ' ' + padStartPrinter(rightStr, rightWidth)
    );
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
            const catName = categoryMap[catId] || (item.destination === 'bar' ? 'เครื่องดื่ม' : item.destination === 'kitchen' ? 'อาหาร' : 'อื่นๆ / Uncategorized');
            const itemName = (item.custom_name || item.menu_items?.name || item.name || 'Unknown Item').toUpperCase();
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
        const breakdown = getBookingPaymentBreakdown(b);
        const remark = (b.staff_remark || '').toLowerCase();
        const note = (b.customer_note || '').toLowerCase();
        const isLineman = remark.includes('lineman') || remark.includes('line man') || note.includes('lineman') || note.includes('line man');
        
        if (breakdown.cash > 0) {
            cashCount++;
            cashAmount += breakdown.cash;
            if (isLineman) {
                linemanCashCount++;
                linemanCashAmount += breakdown.cash;
            }
        }
        
        if (breakdown.credit > 0) {
            creditCount++;
            creditAmount += breakdown.credit;
        }

        if (breakdown.qr > 0) {
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
                otherAmount += breakdown.qr;
                if (!otherDetailsMap[parsedBank]) {
                    otherDetailsMap[parsedBank] = { name: parsedBank, count: 0, amount: 0 };
                }
                otherDetailsMap[parsedBank].count++;
                otherDetailsMap[parsedBank].amount += breakdown.qr;
            } else {
                qrCount++;
                qrAmount += breakdown.qr;
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

    // Deduct adjustments strictly from adjustments array when available
    const adjustments = Array.isArray(shift.adjustments) ? shift.adjustments : [];
    const totalIn = adjustments.length > 0 
        ? adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
        : Number(shift.totalIn || 0);
    const totalOut = adjustments.length > 0 
        ? adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
        : Number(shift.totalOut || 0);

    const openingFloat = Number(shift.openingFloat ?? 0);
    const finalCashSales = (bookingsData && bookingsData.length > 0) ? cashAmount : Number(shift.cashSales ?? cashAmount);
    const finalQrSales = (bookingsData && bookingsData.length > 0) ? qrAmount : Number(shift.qrSales ?? qrAmount);
    const finalCreditSales = (bookingsData && bookingsData.length > 0) ? creditAmount : Number(shift.creditSales ?? creditAmount);
    const finalNetSales = (bookingsData && bookingsData.length > 0) ? netSales : Number(shift.totalSales ?? shift.netSales ?? (finalCashSales + finalQrSales + finalCreditSales));

    const calculatedExpectedCash = openingFloat + finalCashSales + totalIn - totalOut;
    const actualCash = (shift.closedCash !== undefined && shift.closedCash !== null) ? Number(shift.closedCash) : (shift.actualCash !== undefined && shift.actualCash !== null) ? Number(shift.actualCash) : null;
    const difference = actualCash !== null ? (actualCash - calculatedExpectedCash) : (shift.difference !== undefined ? Number(shift.difference) : 0);

    return {
        staffName: shift.staffName || '',
        openedAt: shift.openedAt,
        closedAt: shift.closedAt || new Date().toISOString(),
        openingFloat,
        cashSales: finalCashSales,
        qrSales: finalQrSales,
        creditSales: finalCreditSales,
        totalSales: finalNetSales,
        netSales: finalNetSales,
        totalIn,
        totalOut,
        expectedCash: calculatedExpectedCash,
        actualCash,
        difference,
        
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

    // CRITICAL TIS-620 CENTERING INTERCEPTOR FOR REPORT SLIP:
    let currentAlign = 'left';
    let currentSizeW = 0;

    const originalAlign = encoder.align.bind(encoder);
    encoder.align = function(type) {
        currentAlign = type;
        originalAlign('left'); // Force hardware to always be left-aligned
        return this;
    };

    const originalSize = encoder.size.bind(encoder);
    encoder.size = function(width, height) {
        currentSizeW = width;
        originalSize(width, height);
        return this;
    };

    const is80mm = String(paperSize ?? '').toLowerCase().includes('80');
    const hardwareCols = is80mm ? 48 : 32;
    const paddingCols = Math.max(0, hardwareCols - maxCols);
    const offset = Math.floor(paddingCols / 2);
    const globalLeftMargin = ' '.repeat(offset);

    const originalLine = encoder.line.bind(encoder);
    encoder.line = function(value) {
        let str = String(value ?? '');
        const lines = str.split('\n');
        const processedLines = lines.map(line => {
            let processedLine = line;
            const width = getPrinterCellWidth(processedLine, true);
            if (currentSizeW === 1) {
                const targetCols = Math.floor(maxCols / 2);
                const halfOffset = Math.floor(offset / 2);
                const margin = ' '.repeat(halfOffset);
                if (currentAlign === 'center' && width < targetCols) {
                    const padding = Math.floor((targetCols - width) / 2);
                    processedLine = ' '.repeat(padding) + processedLine;
                } else if (currentAlign === 'right' && width < targetCols) {
                    const padding = targetCols - width;
                    processedLine = ' '.repeat(padding) + processedLine;
                }
                return margin + processedLine;
            } else {
                const targetCols = maxCols;
                if (currentAlign === 'center' && width < targetCols) {
                    const padding = Math.floor((targetCols - width) / 2);
                    processedLine = ' '.repeat(padding) + processedLine;
                } else if (currentAlign === 'right' && width < targetCols) {
                    const padding = targetCols - width;
                    processedLine = ' '.repeat(padding) + processedLine;
                }
                return globalLeftMargin + processedLine;
            }
        });

        originalLine(processedLines.join('\n'));
        return this;
    };
    
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
    const cleanStaff = String(reportData.staffName || 'STAFF').replace(/^[,\s]+|[,\s]+$/g, '').trim() || 'STAFF';

    encoder.align('center')
           .bold(true)
           .size(1, 1)
           .line('ONHAUS')
           .size(0, 0)
           .line('POS SYSTEM')
           .line(divider)
           .bold(true)
           .size(0, 1)
           .line('รายงานยอดขาย')
           .size(0, 0)
           .bold(false)
           .line(wrapTextByWords(`รหัส: ${reportData.shiftId || cleanStaff}`, maxCols))
           .line(wrapTextByWords(shopName, maxCols))
           .line(wrapTextByWords(shopAddress, maxCols))
           .line('')
           .align('left')
           .line(wrapTextByWords(`เปิดรอบ: ${formatDateTime(reportData.openedAt)} (${cleanStaff})`, maxCols))
           .line(wrapTextByWords(`ปิดรอบ: ${reportData.closedAt ? formatDateTime(reportData.closedAt) : 'ยังไม่ปิดรอบ'} (${cleanStaff})`, maxCols))
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
        
        encoder.line(divider);
        encoder.bold(true).line(formatThreeCols('รวม', totalQty, formatReceiptMoney(totalAmt), maxCols)).bold(false);
        
        const vatVal = Number(reportData.totalVat || 0);
        const preVatVal = netSales - vatVal;

        if (discountVal > 0) {
            encoder.line(formatTwoCols('ส่วนลด', `-${formatReceiptMoney(discountVal)}`, maxCols));
        }
        if (vatVal > 0) {
            encoder.line(formatTwoCols('ยอดก่อนภาษี (VAT)', formatReceiptMoney(preVatVal), maxCols));
            encoder.line(formatTwoCols('ภาษี (VAT)', formatReceiptMoney(vatVal), maxCols));
        }
        encoder.bold(true).line(formatTwoCols('ยอดขายสุทธิ', formatReceiptMoney(netSales), maxCols)).bold(false);
        encoder.line(formatTwoCols('จำนวนลูกค้า (Pax)', (reportData.totalGuests || 0).toString(), maxCols));
        encoder.line(formatTwoCols('ยอดขายเฉลี่ยต่อบิล', formatReceiptMoney(reportData.averageSalesPerBill), maxCols));
        encoder.line(formatTwoCols('ยอดขายเฉลี่ยต่อหัว', formatReceiptMoney(reportData.averageSalesPerGuest), maxCols));
    } else {
        // Fallback backward compatibility
        encoder.bold(true).line('SALES SUMMARY').bold(false);
        encoder.line(formatTwoCols('Total Bookings', (reportData.totalBookings || 0).toString(), maxCols));
        encoder.line(formatTwoCols('Gross Revenue', formatReceiptMoney(reportData.grossRevenue || netSales), maxCols));
        if (discountVal > 0) {
            encoder.line(formatTwoCols('Discounts', `-${formatReceiptMoney(discountVal)}`, maxCols));
        }
        encoder.line(formatTwoCols('Net Sales', formatReceiptMoney(netSales), maxCols));
        encoder.line(divider);
    }

    // Section Top 3 Selling Items (Clean title without decorative asterisks per Rule 3)
    if (reportData.topSellingItems && reportData.topSellingItems.length > 0) {
        encoder.line(divider);
        encoder.bold(true).line('TOP 3 SELLING ITEMS / เมนูขายดี 3 อันดับ').bold(false);
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
                    encoder.line(formatThreeCols(`  - ${sub.name}`, sub.count, formatReceiptMoney(sub.amount), maxCols));
                });
            }
        }
        
        encoder.line(divider);
        encoder.bold(true).line(formatTwoCols('ยอดขายสุทธิ', formatReceiptMoney(netSales), maxCols)).bold(false);
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
    encoder.line(formatTwoCols('ยอดขายเงินสด (+)', `+${formatReceiptMoney(reportData.cashSales)}`, maxCols));

    if (reportData.totalIn > 0) {
        encoder.line(formatTwoCols('เงินเข้าลิ้นชัก (+)', `+${formatReceiptMoney(reportData.totalIn)}`, maxCols));
    }
    if (reportData.totalOut > 0) {
        encoder.line(formatTwoCols('เงินออกลิ้นชัก (-)', `-${formatReceiptMoney(reportData.totalOut)}`, maxCols));
    }
    
    encoder.line(divider);
    encoder.bold(true).line(formatTwoCols('เงินที่ควรมีในลิ้นชัก', formatReceiptMoney(reportData.expectedCash), maxCols)).bold(false);
    
    if (reportData.closedAt || (reportData.actualCash !== null && reportData.actualCash !== undefined)) {
        encoder.bold(true).line(formatTwoCols('จำนวนจริงในลิ้นชัก', formatReceiptMoney(reportData.actualCash), maxCols)).bold(false);
        
        const diffVal = Number(reportData.difference || 0);
        const isDiff = Math.abs(diffVal) >= 0.01;
        if (isDiff) {
            const diffSign = diffVal > 0 ? '+' : '';
            encoder.bold(true);
            encoder.line(formatTwoCols('>> ส่วนต่าง (ขาด/เกิน)', `${diffSign}${formatReceiptMoney(diffVal)}`, maxCols));
            encoder.bold(false);
        } else {
            encoder.line(formatTwoCols('ส่วนต่าง (ยอดตรงพอดี)', '0.00', maxCols));
        }
    }
    
    encoder.line(formatTwoCols('บิลสำเร็จทั้งหมด', `${reportData.totalBookings || 0} บิล`, maxCols));

    // Detailed adjustments list on receipt
    if (reportData.adjustments && reportData.adjustments.length > 0) {
        encoder.line(divider);
        encoder.bold(true).line('รายการเงินเข้า-เงินออก').bold(false);
        reportData.adjustments.forEach(adj => {
            const prefix = adj.type === 'in' ? 'นำเข้า' : 'นำออก';
            const sign = adj.type === 'in' ? '+' : '-';
            const label = `  [${prefix}] ${adj.note || ''}`;
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

    // Section 8: Prominent Grand Total Net Revenue Figure at Bottom
    const doubleLine = generateDivider('double', maxCols);
    encoder.line(doubleLine)
           .align('center')
           .bold(true)
           .line('สรุปยอดขายสุทธิทั้งหมด')
           .line('(GRAND TOTAL NET REVENUE)')
           .line('')
           .size(1, 1)
           .line(`฿${formatReceiptMoney(netSales)}`)
           .size(0, 0)
           .line(doubleLine)
           .bold(false)
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
    
    const base64 = await downloadAndResizeLogoToBase64(url, targetWidth);
    if (base64) {
        imageBase64Cache[cacheKey] = base64;
    }
    
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
            // Always split kitchen and bar for SUNMI so they come out as 2 distinct slips
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
            if (!kitchenBytes && !barBytes) {
                // Fallback in case there are uncategorized items
                const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, optionMap, activePaperSize, config, 'sunmi');
                if (allBytes) {
                    await printToSunmiBuiltIn(allBytes);
                    printed = true;
                }
            }
            return printed;
        } else if (printerType === 'rawbt') {
            let printedAny = false;
            const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, optionMap, activePaperSize, config, 'rawbt');
            if (kitchenBytes) {
                await printToRawBTWebSocket(kitchenBytes);
                printedAny = true;
            }
            const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, optionMap, activePaperSize, config, 'rawbt');
            if (barBytes) {
                await printToRawBTWebSocket(barBytes);
                printedAny = true;
            }
            if (!printedAny) {
                const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, optionMap, activePaperSize, config, 'rawbt');
                if (allBytes) {
                    await printToRawBTWebSocket(allBytes);
                    printedAny = true;
                }
            }
            return printedAny;
        } else if (printerType === 'bluetooth') {
            const btDeviceName = config.bluetooth_device_name;
            let printedAny = false;
            const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, optionMap, activePaperSize, config, 'bluetooth');
            if (kitchenBytes) {
                await printToBluetoothDirect(btDeviceName, kitchenBytes);
                printedAny = true;
            }
            const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, optionMap, activePaperSize, config, 'bluetooth');
            if (barBytes) {
                await printToBluetoothDirect(btDeviceName, barBytes);
                printedAny = true;
            }
            if (!printedAny) {
                const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, optionMap, activePaperSize, config, 'bluetooth');
                if (allBytes) {
                    await printToBluetoothDirect(btDeviceName, allBytes);
                    printedAny = true;
                }
            }
            return printedAny;
        }
    } catch (err) {
        console.error("Auto print QR order failed:", err);
        return false;
    }
}

/**
 * Generic silent print for ANY slip type (kitchen, receipt, billing).
 */
/**
 * Clean & normalize Thai PromptPay identifier (Phone 10 digits, Tax/National ID 13 digits, e-Wallet 15 digits)
 */
export function normalizePromptPayId(rawId) {
    if (!rawId) return '0985284217';
    let clean = String(rawId).replace(/[^0-9]/g, '');
    if (clean.startsWith('66') && clean.length === 11) {
        clean = '0' + clean.slice(2);
    }
    return clean || '0985284217';
}

/**
 * Format PromptPay ID for user-friendly display (e.g. 098-528-4217 or 0-1055-60000-00-0)
 */
export function formatPromptpayDisplay(id) {
    if (!id) return '';
    const clean = String(id).replace(/\D/g, '');
    if (clean.length === 10) {
        return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    if (clean.length === 13) {
        return `${clean.slice(0, 1)}-${clean.slice(1, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean.slice(12)}`;
    }
    return id;
}

/**
 * Resolve store PromptPay ID from multiple setting sources in priority order:
 * 1. promptpay_id
 * 2. printerConfig.promptpay_id
 * 3. receipt_shop_phone
 * 4. contact_phone / admin_phone_contact / phone_number
 * 5. Default: '0985284217' (IN THE HAUS actual phone)
 */
export function getStorePromptpayId(settingsMap = {}, printerConfig = {}) {
    const raw = settingsMap.promptpay_id 
        || printerConfig.promptpay_id 
        || (typeof window !== 'undefined' ? localStorage.getItem('promptpay_id') : null)
        || settingsMap.receipt_shop_phone 
        || (typeof window !== 'undefined' ? localStorage.getItem('receipt_shop_phone') : null)
        || settingsMap.contact_phone 
        || settingsMap.admin_phone_contact 
        || settingsMap.phone_number 
        || '0985284217';
    return normalizePromptPayId(raw);
}

/**
 * Generic silent print for ANY slip type (kitchen, receipt, billing).
 * Returns true if successfully printed silently (so the caller doesn't need to show a modal).
 * Returns false if it fails or if the printer type doesn't support silent printing (e.g. browser).
 */
export async function resolveBillingQrCode(booking, config = {}) {
    if (!booking) return null;

    // Calculate exact outstanding bill balance (deduct deposit if already paid)
    const depositAmt = Number(booking.deposit_amount) || 0;
    const items = booking.order_items || booking.items || [];
    const subtotalAmt = items.reduce((sum, i) => sum + ((Number(i.price_at_time ?? i.price) || 0) * (Number(i.quantity) || 1)), 0);
    const discountAmt = Number(booking.discount_amount) || 0;

    let totalAmt = 0;
    if (booking.total_amount != null && Number.isFinite(Number(booking.total_amount)) && Number(booking.total_amount) > 0) {
        // If discount was applied but booking.total_amount is still at pre-discount subtotal level, deduct discountAmt
        if (discountAmt > 0 && Math.abs(Number(booking.total_amount) - subtotalAmt) < 1) {
            totalAmt = Math.max(0, subtotalAmt - discountAmt);
        } else {
            totalAmt = parseFloat(booking.total_amount);
        }
    } else {
        totalAmt = Math.max(0, subtotalAmt - discountAmt);
    }
    const balanceDue = Math.max(0, totalAmt - depositAmt);
    const amountToPay = balanceDue > 0 ? balanceDue : totalAmt;

    try {
        let promptpayId = '0985284217';
        
        // 1. If config already has promptpay_id or promptpayId
        if (config.promptpay_id || config.promptpayId) {
            promptpayId = normalizePromptPayId(config.promptpay_id || config.promptpayId);
        } else {
            // 2. Fetch fresh settings from DB to get the most accurate promptpay ID
            const { supabase } = await import('../lib/supabaseClient');
            const { data } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['promptpay_id', 'receipt_shop_phone', 'contact_phone', 'admin_phone_contact', 'phone_number', 'payment_qr_url']);
            
            const settingsMap = (data || []).reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
            promptpayId = getStorePromptpayId(settingsMap, config);
        }

        // 3. Generate dynamic EMVCo PromptPay payload with exact bill total
        const generatePayload = (await import('promptpay-qr')).default;
        const QRCode = (await import('qrcode')).default;

        const payload = generatePayload(promptpayId, { amount: amountToPay > 0 ? amountToPay : undefined });
        const dataUrl = await QRCode.toDataURL(payload, { width: 300, margin: 1 });
        return dataUrl;
    } catch (err) {
        console.error('[PrinterHelper] Failed to generate dynamic PromptPay QR code:', err);
        
        // Fallback to static uploaded image if dynamic generation fails
        let fallbackQr = config.payment_qr_url || config.paymentQrUrl;
        if (!fallbackQr && typeof window !== 'undefined') {
            fallbackQr = localStorage.getItem('payment_qr_url') || localStorage.getItem('receipt_payment_qr_url');
        }
        return fallbackQr || null;
    }
}

export async function silentPrintSlip(booking, slipType = 'receipt', optionMap = {}) {
    if (!booking) return false;
    try {
        if (Object.keys(optionMap).length === 0) {
            try {
                const { supabase } = await import('../lib/supabaseClient');
                const { data } = await supabase.from('option_choices').select('id, name');
                if (data) {
                    optionMap = data.reduce((acc, opt) => ({ ...acc, [opt.id]: opt.name }), {});
                }
            } catch(e) {}
        }
        
        const config = getPrinterConfig() || {};
        let printerType = 'sunmi';
        
        if (slipType === 'kitchen' || slipType === 'bar') {
            printerType = config.kitchen_printer_type || 'sunmi';
        } else {
            printerType = config.cashier_printer_type || 'sunmi';
        }
        
        if (printerType === 'browser' || printerType === 'none' || !printerType) {
            return false;
        }

        let activePaperSize = '80mm';
        if (slipType === 'kitchen' || slipType === 'bar' || slipType === 'kitchen_all') {
            activePaperSize = config.kitchen_paper_size || config.paper_width || '80mm';
        } else {
            activePaperSize = config.cashier_paper_size || config.paper_width || '80mm';
        }

        const rawMethod = getBookingPaymentMethod(booking) || booking.payment_method || 'cash';
        const paymentMethod = String(rawMethod).toLowerCase();
        let printed = false;

        if (printerType === 'sunmi') {
            if (slipType === 'kitchen') {
                // Split kitchen and bar for SUNMI
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
                if (!kitchenBytes && !barBytes) {
                    const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, optionMap, activePaperSize, config, 'sunmi');
                    if (allBytes) {
                        await printToSunmiBuiltIn(allBytes);
                        printed = true;
                    }
                }
            } else {
                const rawBytes = encodeReceiptData(booking, slipType, paymentMethod, optionMap, activePaperSize, config, 'sunmi');
                if (rawBytes) {
                    const qrToPrint = (slipType === 'billing') ? await resolveBillingQrCode(booking, config) : null;
                    const storedLogo = typeof window !== 'undefined' ? localStorage.getItem('receipt_shop_logo_url') : null;
                    const logoToPrint = (slipType !== 'kitchen' && slipType !== 'bar' && slipType !== 'kitchen_all') ? (config.shop_logo_url || storedLogo || `${window.location.origin}/logo.png`) : null;
                    await printToSunmiBuiltIn(rawBytes, logoToPrint, qrToPrint);
                    printed = true;
                }
            }
            return printed;
        } else if (printerType === 'rawbt') {
            if (slipType === 'kitchen') {
                let printedAny = false;
                const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, optionMap, activePaperSize, config, 'rawbt');
                if (kitchenBytes) {
                    await printToRawBTWebSocket(kitchenBytes);
                    printedAny = true;
                }
                const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, optionMap, activePaperSize, config, 'rawbt');
                if (barBytes) {
                    await printToRawBTWebSocket(barBytes);
                    printedAny = true;
                }
                if (!printedAny) {
                    const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, optionMap, activePaperSize, config, 'rawbt');
                    if (allBytes) {
                        await printToRawBTWebSocket(allBytes);
                        printedAny = true;
                    }
                }
                printed = printedAny;
            } else {
                const rawBytes = encodeReceiptData(booking, slipType, paymentMethod, optionMap, activePaperSize, config, 'rawbt');
                if (rawBytes) {
                    await printToRawBTWebSocket(rawBytes);
                    printed = true;
                }
            }
            return printed;
        } else if (printerType === 'bluetooth') {
            if (slipType === 'kitchen') {
                let printedAny = false;
                const btDeviceName = config.bluetooth_device_name || '';
                const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, optionMap, activePaperSize, config, 'bluetooth');
                if (kitchenBytes) {
                    await printToBluetoothDirect(btDeviceName, kitchenBytes);
                    printedAny = true;
                }
                const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, optionMap, activePaperSize, config, 'bluetooth');
                if (barBytes) {
                    await printToBluetoothDirect(btDeviceName, barBytes);
                    printedAny = true;
                }
                if (!printedAny) {
                    const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, optionMap, activePaperSize, config, 'bluetooth');
                    if (allBytes) {
                        await printToBluetoothDirect(btDeviceName, allBytes);
                        printedAny = true;
                    }
                }
                printed = printedAny;
            } else {
                const rawBytes = encodeReceiptData(booking, slipType, paymentMethod, optionMap, activePaperSize, config, 'bluetooth');
                if (rawBytes) {
                    await printToBluetoothDirect(config.bluetooth_device_name || '', rawBytes);
                    printed = true;
                }
            }
            return printed;
        }
        
        return false;
    } catch (err) {
        console.error("Silent print failed:", err);
        return false;
    }
}
