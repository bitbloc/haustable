import { logger } from './logger';

// ESC/POS Command Constants
const ESC = 0x1B;
const GS = 0x1D;

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
        const bytes = this.isUtf8 ? encodeUTF8(txt) : encodeThaiTIS620(txt);
        this.buffer.push(...bytes);
        return this;
    }

    line(txt = '') {
        this.text(txt + '\n');
        return this;
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

// Simple Thai TIS-620 Encoder (Thai POS printers use TIS-620 / Code Page 17)
function encodeThaiTIS620(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code >= 0x0E01 && code <= 0x0E5B) {
            // Map Unicode Thai to TIS-620 (Unicode Thai is 0x0E01 - 0x0E5B, TIS-620 is 0xA1 - 0xFB)
            bytes.push(code - 0x0E00 + 0xA0);
        } else if (code < 128) {
            bytes.push(code);
        } else {
            bytes.push(32); // Space for unknown characters
        }
    }
    return bytes;
}

// UTF-8 Encoder fallback
function encodeUTF8(str) {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(str);
    }
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
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
        const p = '★ ';
        return p.repeat(Math.ceil(targetWidth / 2)).slice(0, targetWidth);
    }
    if (style === 'wave') {
        const p = '~ ';
        return p.repeat(Math.ceil(targetWidth / 2)).slice(0, targetWidth);
    }
    const p = '- ';
    return p.repeat(Math.ceil(targetWidth / 2)).slice(0, targetWidth);
}

// Resolve a conservative printable column width.
// 80 mm printers are commonly 512/576 dots wide, but Thai glyph bytes and
// driver margins vary. 32 columns keeps a reliable right safety margin for
// both 80 mm rolls and drivers whose custom page size is named 80 x 80 mm.
// Override with receiptConfig.maxCols after a real print test.
function resolveMaxCols(paperSize = '80mm', configuredMaxCols) {
    const normalized = String(paperSize ?? '').toLowerCase().replace(/\s+/g, '');
    const is80mm = (
        normalized === '80mm' ||
        normalized === '80' ||
        Number(paperSize) === 80 ||
        /^80(?:mm)?(?:x|\*|×)80(?:mm)?$/.test(normalized)
    );
    const fallback = is80mm ? 42 : 30;
    const configured = Number(configuredMaxCols);

    if (!Number.isFinite(configured)) return fallback;

    const min = is80mm ? 32 : 20;
    const max = is80mm ? 48 : 34;
    return Math.max(min, Math.min(max, Math.floor(configured)));
}

// Convert receipt/ticket details to ESC/POS binary format
export function encodeReceiptData(booking, activeTab, paymentMethod, optionMap = {}, paperSize = '80mm', receiptConfig = {}, printerType = 'universal') {
    // Filter items based on activeTab (Kitchen vs Bar vs Others) using printer configuration
    let itemsToRender = booking.order_items || [];
    
    const isKitchenTab = activeTab === 'kitchen' || activeTab === 'bar' || activeTab === 'other' || activeTab === 'kitchen_all';

    let kitchenCatIds = receiptConfig.kitchen_categories || [];
    let barCatIds = receiptConfig.bar_categories || [];
    let isSeparateBarPrinter = false;
    try {
        const stored = localStorage.getItem('onhaus_printer_config');
        if (stored) {
            const config = JSON.parse(stored);
            isSeparateBarPrinter = !!(config.separate_bar_printer || config.bar_printer_ip);
            if (kitchenCatIds.length === 0 && barCatIds.length === 0) {
                kitchenCatIds = config.kitchen_categories || [];
                barCatIds = config.bar_categories || [];
            }
            if (!paperSize || paperSize === '58mm') {
                paperSize = isKitchenTab
                    ? (config.kitchen_paper_size || config.paper_width || '80mm')
                    : (config.cashier_paper_size || config.paper_width || '80mm');
            }
        }
    } catch (e) {
        // ignore
    }

    const getItemCatId = (item) => item.menu_items?.category_id || item.category_id || item.category || '';

    // Smart Bar item classification (Config -> Default UUIDs -> Category Name / Type Keywords)
    const cachedCategories = (() => {
        try {
            return JSON.parse(localStorage.getItem('pos_cache_menu_categories')) || [];
        } catch (e) {
            return [];
        }
    })();

    const categoryMap = cachedCategories.reduce((acc, cat) => {
        if (cat.id) acc[cat.id] = cat;
        return acc;
    }, {});

    const isBarItem = (item) => {
        const catId = getItemCatId(item);
        if (barCatIds.length > 0 && barCatIds.includes(catId)) return true;
        if (kitchenCatIds.length > 0 && kitchenCatIds.includes(catId)) return false;

        const DEFAULT_BAR_CATS = [
            '7524bb8a-4698-45c6-aa17-d8ccc296f667', // Coffee
            '912683ef-fdc3-40a3-8dd8-b09507791240', // Soft Drink
            'b441665e-2f23-4df3-a11d-63485e1690dc', // Beer
            'a2c783fc-975b-4779-b9eb-67391eeafd1f', // Alcohol
            '1983955d-5787-4351-b729-51b95761f125', // Mocktail & Cocktail
            '1407d869-4eed-489e-aeeb-ba7ef19f57bd', // Bottled
            '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'  // PRO Beer
        ];
        if (DEFAULT_BAR_CATS.includes(catId)) return true;

        const catObj = categoryMap[catId];
        const catName = (catObj?.name || item.menu_items?.categories?.name || item.menu_items?.menu_categories?.name || item.category_name || item.category || '').toLowerCase();
        
        const BAR_KEYWORDS = [
            'บาร์', 'บาร์น้ำ', 'เครื่องดื่ม', 'น้ำ', 'กาแฟ', 'ชา', 'เหล้า', 'เบียร์', 'ค็อกเทล', 
            'ม็อกเทล', 'โซดา', 'ไวน์', 'ชง', 'ปั่น', 'ดริ้ง', 'น้ำอัดลม',
            'bar', 'drink', 'beverage', 'coffee', 'tea', 'beer', 'wine', 'cocktail', 'mocktail', 'alcohol', 'soda', 'smoothie'
        ];

        return BAR_KEYWORDS.some(kw => catName.includes(kw));
    };

    if (activeTab === 'kitchen_all') {
        itemsToRender = booking.order_items || [];
    } else if (activeTab === 'kitchen') {
        itemsToRender = (booking.order_items || []).filter(item => !isBarItem(item));
    } else if (activeTab === 'bar') {
        itemsToRender = (booking.order_items || []).filter(item => isBarItem(item));
    } else if (activeTab === 'other') {
        itemsToRender = [];
    }

    // Return null if there are no items to print for this specific tab
    if (isKitchenTab && itemsToRender.length === 0) {
        return null;
    }

    // Sort items for kitchen, bar, and other to group by category first, then alphabetically by name
    if (isKitchenTab) {
        itemsToRender = [...itemsToRender].sort((a, b) => {
            const catA = getItemCatId(a);
            const catB = getItemCatId(b);
            if (catA !== catB) return catA.localeCompare(catB);
            const nameA = a.menu_items?.name || a.name || '';
            const nameB = b.menu_items?.name || b.name || '';
            return nameA.localeCompare(nameB);
        });
    }

    const encoder = new EscPosEncoder(false); // ALWAYS use TIS-620 for Thai POS printers
    encoder.initialize();

    // Auto kick cash drawer if this is a cash receipt printout
    if (activeTab === 'receipt' && paymentMethod === 'cash') {
        encoder.kickDrawer();
    }

    const queueNo = (booking.tracking_token && booking.tracking_token.length <= 8) 
        ? booking.tracking_token 
        : String(booking.id).slice(0, 4);
    const dateStr = new Date(booking.booking_time).toLocaleString('th-TH');

    const maxCols = resolveMaxCols(paperSize, receiptConfig.maxCols); // 34 cols by default on 80 mm: keeps a real right safety margin

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
        selectedDividerStyle = receiptConfig.divider_style || 'dashed';
    }

    const divider = generateDivider(selectedDividerStyle, maxCols);
    const doubleDivider = generateDivider(selectedDividerStyle === 'double' ? 'double' : (selectedDividerStyle === 'star' ? 'star' : (selectedDividerStyle === 'wave' ? 'wave' : selectedDividerStyle)), maxCols);

    // Load receipt configuration details
    const shopName = (receiptConfig.shopName || 'IN THE HAUS').toUpperCase();
    const shopAddress = receiptConfig.shopAddress || '';
    const shopPhone = receiptConfig.shopPhone || '';
    const shopVat = receiptConfig.shopVat || '';
    const shopFooter = receiptConfig.shopFooter || 'THANK YOU FOR YOUR VISIT';

    // Get current logged-in staff member
    let staffName = '';
    try {
        const shift = JSON.parse(localStorage.getItem('pos_current_shift'));
        if (shift && shift.staffName) {
            staffName = shift.staffName;
        }
    } catch (e) {
        // ignore
    }

    // 1. Header (Omit for kitchen and bar)
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
        encoder.line(doubleDivider);
    } else if (activeTab === 'kitchen' || activeTab === 'kitchen_all') {
        encoder.align('center')
               .line(doubleDivider)
               .bold(true)
               .size(1, 1) // Double size header for kitchen!
               .line('KITCHEN ORDER')
               .size(0, 0)
               .bold(true)
               .line('(ใบออเดอร์ครัว)')
               .bold(false)
               .line(doubleDivider);
    } else if (activeTab === 'bar') {
        encoder.align('center')
               .line(doubleDivider)
               .bold(true)
               .size(1, 1) // Double size header for bar!
               .line('BAR ORDER')
               .size(0, 0)
               .bold(true)
               .line('(ใบออเดอร์บาร์)')
               .bold(false)
               .line(doubleDivider);
    } else if (activeTab === 'other') {
        encoder.align('center')
               .line(doubleDivider)
               .bold(true)
               .size(1, 1) // Double size header for other!
               .line('OTHER ORDER')
               .size(0, 0)
               .bold(true)
               .line('(ใบออเดอร์ทั่วไป)')
               .bold(false)
               .line(doubleDivider);
    }

    // 2. Table Name & Queue Number (Highly visible / double size)
    const tableName = (booking.tables_layout?.table_name || 'PICKUP').toUpperCase();
    
    // For kitchen/bar: Make Table Name and Queue ID even bigger and print order time prominently
    if (isKitchenTab) {
        let serviceType = 'กินที่ร้าน (DINE-IN)';
        const remark = (booking.staff_remark || '').toLowerCase();
        const note = (booking.customer_note || '').toLowerCase();
        if (remark.includes('lineman') || remark.includes('line man') || note.includes('lineman') || note.includes('line man')) {
            serviceType = 'LINE MAN DELIVERY';
        } else if (booking.booking_type === 'pickup' || remark.includes('pickup') || remark.includes('takeaway') || remark.includes('รับกลับ') || remark.includes('กลับบ้าน') || !booking.tables_layout) {
            serviceType = 'รับกลับ (TAKEAWAY / PICKUP)';
        }

        const totalItemsCount = itemsToRender.reduce((sum, item) => sum + item.quantity, 0);

        encoder.align('center')
               .bold(true)
               .size(1, 1)
               .line(`โต๊ะ ${tableName}`)
               .line(`คิว: #${queueNo}`)
               .size(0, 0)
               .line(divider)
               .align('left')
               .bold(true)
               .line(`บริการ: ${serviceType}`)
               .line(`พนักงานสั่ง: ${staffName.toUpperCase() || 'SYSTEM'}`)
               .line(`เวลาสั่ง: ${new Date(booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
               .line(`จำนวนคน: ${booking.pax || 1} คน`)
               .line(`จำนวนรายการ: ${totalItemsCount} ชิ้น`)
               .bold(false)
               .line(divider);
    } else {
        encoder.align('center')
               .bold(true)
               .size(1, 1)
               .line(`โต๊ะ ${tableName}`)
               .line(`คิว: #${queueNo}`)
               .size(0, 0)
               .bold(false)
               .line(divider);
    }

    // 3. Meta info
    if (!isKitchenTab) {
        encoder.align('left')
               .line(`วันที่-เวลา: ${dateStr}`)
               .line(`ลูกค้า: ${booking.profiles?.display_name || booking.pickup_contact_name || 'ลูกค้าทั่วไป (Walk-in)'}`);

        const phone = booking.profiles?.phone_number || booking.pickup_contact_phone;
        if (phone) {
            encoder.line(`เบอร์โทร: ${phone}`);
        }
        if (staffName) {
            encoder.line(`พนักงาน: ${staffName.toUpperCase()}`);
        }
        encoder.line(divider);
    }

    // 4. Items Header
    // Always reset alignment/font size before fixed-width columns.
    encoder.align('left')
           .size(0, 0)
           .bold(true)
           .line(activeTab === 'bar' ? 'รายการเครื่องดื่ม (บาร์)' : activeTab === 'other' ? 'รายการอื่นๆ (ทั่วไป)' : (activeTab === 'kitchen' || activeTab === 'kitchen_all') ? 'รายการอาหาร (ครัว)' : 'รายการอาหารและเครื่องดื่ม')
           .bold(false)
           .line(divider);

    // 5. Items List
    // 5. Items List Grouped by Kitchen vs Bar
    const isKitchenItem = (item) => !isBarItem(item);

    if (isKitchenTab) {
        const renderKitchenGroup = (groupItems) => {
            groupItems.forEach((item) => {
                const qtyStr = `${item.quantity}x`;
                const name = (item.menu_items?.name || item.name || 'Item').toUpperCase();
                
                // Double-width text has only about half the normal columns.
                // Wrap first so long Thai menu names never run past the paper edge.
                const kitchenItemLines = wrapTextByWords(`${qtyStr} ${name}`, Math.max(12, Math.floor(maxCols / 2)));
                encoder.bold(true).size(1, 1);
                kitchenItemLines.forEach(line => encoder.line(line));
                encoder.size(0, 0).bold(false);
                
                if (item.selected_options || item.item_note) {
                    let optionsList = [];
                    if (Array.isArray(item.selected_options)) {
                        optionsList = item.selected_options.map(opt => {
                            if (typeof opt === 'object' && opt !== null) {
                                if (opt.group_name && opt.name) {
                                    const priceStr = (opt.price && Number(opt.price) > 0) ? ` (+฿${opt.price})` : '';
                                    return `${opt.group_name}: ${opt.name}${priceStr}`;
                                }
                                if (opt.name) {
                                    const priceStr = (opt.price && Number(opt.price) > 0) ? ` (+฿${opt.price})` : '';
                                    return `${opt.name}${priceStr}`;
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
                        const optLine = `▶ ${String(opt).toUpperCase()}`;
                        wrapTextByWords(optLine, maxCols - 4).forEach(line => {
                            encoder.bold(true)
                                   .line(`    ${line}`)
                                   .bold(false);
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
                const unitPrice = formatReceiptMoney(item.price_at_time || item.price || 0);
                const priceStr = formatReceiptMoney((item.price_at_time || item.price || 0) * item.quantity);
                const calculationText = `${item.quantity} x ${unitPrice}`;

                encoder.text(formatItemLine(calculationText, name, priceStr, maxCols));

                if (item.selected_options || item.item_note) {
                    let optionsList = [];
                    if (Array.isArray(item.selected_options)) {
                        optionsList = item.selected_options.map(opt => {
                            if (typeof opt === 'object' && opt !== null) {
                                if (opt.group_name && opt.name) {
                                    const pStr = (opt.price && Number(opt.price) > 0) ? ` (+฿${opt.price})` : '';
                                    return `${opt.group_name}: ${opt.name}${pStr}`;
                                }
                                if (opt.name) {
                                    const pStr = (opt.price && Number(opt.price) > 0) ? ` (+฿${opt.price})` : '';
                                    return `${opt.name}${pStr}`;
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
                            .forEach(line => encoder.line(`    ${line}`));
                    });
                }
            });
        };

        const kitchenGroup = itemsToRender.filter(isKitchenItem);
        const barGroup = itemsToRender.filter(isBarItem);
        const otherGroup = itemsToRender.filter(item => !isKitchenItem(item) && !isBarItem(item));

        if (kitchenGroup.length > 0 && barGroup.length > 0) {
            encoder.bold(true).line('--- รายการอาหาร (Food) ---').bold(false);
            renderReceiptGroup(kitchenGroup);
            encoder.line(divider);
            encoder.bold(true).line('--- รายการเครื่องดื่ม (Drinks) ---').bold(false);
            renderReceiptGroup(barGroup);
            if (otherGroup.length > 0) {
                encoder.line(divider);
                encoder.bold(true).line('--- รายการอื่นๆ (Others) ---').bold(false);
                renderReceiptGroup(otherGroup);
            }
        } else {
            renderReceiptGroup(itemsToRender);
        }
        encoder.line(divider);
    }

    // 6. Totals
    if (!isKitchenTab) {
        const subtotal = booking.order_items?.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0) || 0;
        const discount = booking.discount_amount || 0;
        const netAfterDiscount = subtotal - discount;
        const vatVal = (booking.total_amount && Math.abs(booking.total_amount - (netAfterDiscount * 1.07)) < 1) 
            ? (netAfterDiscount * 0.07) 
            : 0;

        const totalQty = itemsToRender.reduce((sum, item) => sum + item.quantity, 0);
        encoder.align('left').size(0, 0);
        encoder.text(formatTwoCols('จำนวนชิ้น', `${totalQty} ชิ้น`, maxCols) + '\n');
        encoder.text(formatTwoCols('ยอดรวมก่อนหัก', formatReceiptMoney(subtotal), maxCols) + '\n');
        if (discount > 0) {
            encoder.text(formatTwoCols('ส่วนลด', `-${formatReceiptMoney(discount)}`, maxCols) + '\n');
        }
        if (vatVal > 0) {
            encoder.text(formatTwoCols('ภาษีมูลค่าเพิ่ม (7%)', formatReceiptMoney(vatVal), maxCols) + '\n');
        }
        encoder.line(divider)
               .bold(true)
               .size(0, 0)
               .text(formatTwoCols('ยอดรวมสุทธิ', formatReceiptMoney(booking.total_amount), maxCols) + '\n')
               .bold(false)
               .line(doubleDivider);
    }

    // 7. Payment details (Omit for kitchen)
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
                encoder.text(formatTwoCols('รับเงินสดมา', cashRecvVal, maxCols) + '\n');
            }
            if (storedChange !== null) {
                const cashChangeVal = formatReceiptMoney(parseFloat(storedChange));
                encoder.text(formatTwoCols('เงินทอน', cashChangeVal, maxCols) + '\n');
            }
        }
        
        encoder.align('center')
               .line('')
               .bold(true)
               .line('[ ชำระเงินแล้ว ]')
               .bold(false)
               .line(doubleDivider);
    }

    // 8. Note
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

    // 9. Footer
    if (!isKitchenTab) {
        let asciiArt = receiptConfig.footer_ascii_art || '';
        if (!asciiArt) {
            try {
                const stored = localStorage.getItem('onhaus_printer_config');
                if (stored) {
                    const cfg = JSON.parse(stored);
                    asciiArt = cfg.footer_ascii_art || '';
                }
            } catch(e) {}
        }

        encoder.align('center');
        if (asciiArt) {
            asciiArt.split('\n').forEach(aLine => {
                encoder.line(aLine);
            });
        }
        encoder.line(shopFooter)
               .feed(2)
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

// Measure visible printer cells, not encoded byte count.
// Thai upper/lower vowels and tone marks are combining glyphs: the printer draws
// them over the base consonant and normally does not advance a full text cell.
// Counting those bytes as full cells makes the amount column move left/right
// depending on the Thai spelling of each menu name.
function getPrinterCellWidth(str) {
    let width = 0;
    for (const char of Array.from(String(str ?? ''))) {
        const code = char.codePointAt(0);
        if (!isThaiCombiningCode(code)) width += 1;
    }
    return width;
}

function isThaiCombiningCode(code) {
    return (
        (code >= 0x0E31 && code <= 0x0E3A) ||
        (code >= 0x0E47 && code <= 0x0E4E)
    );
}

// Keep a Thai base character together with its vowels/tone marks when slicing.
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

function padEndPrinter(str, targetWidth, padChar = ' ') {
    const value = String(str ?? '');
    const neededPadding = targetWidth - getPrinterCellWidth(value);
    if (neededPadding <= 0) return value;
    return value + padChar.repeat(neededPadding);
}

function padStartPrinter(str, targetWidth, padChar = ' ') {
    const value = String(str ?? '');
    const neededPadding = targetWidth - getPrinterCellWidth(value);
    if (neededPadding <= 0) return value;
    return padChar.repeat(neededPadding) + value;
}

// Slice by printer-byte width without orphaning Thai combining marks.
function sliceThai(str, maxPrinterWidth) {
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

// Word/phrase-aware text wrapping using the actual TIS-620 byte width.
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
                if (getPrinterCellWidth(word) <= width) {
                    currentLine = word;
                } else {
                    flushLongWord(word);
                }
                return;
            }

            const candidate = `${currentLine} ${word}`;
            if (getPrinterCellWidth(candidate) <= width) {
                currentLine = candidate;
                return;
            }

            output.push(currentLine);
            currentLine = '';
            if (getPrinterCellWidth(word) <= width) {
                currentLine = word;
            } else {
                flushLongWord(word);
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

// Receipt item row for Thai ESC/POS printers.
// Keep Thai menu text on its own line(s), then print a numeric-only calculation
// row. This guarantees every total ends at the exact same right edge regardless
// of Thai combining marks or printer firmware.
function formatItemLine(calculationText, name, priceStr, maxCols) {
    const totalWidth = Math.max(20, Number(maxCols) || 42);
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

    return [...nameLines, numericRow].join('\n') + '\n';
}

function formatThreeCols(left, mid, right, maxCols) {
    const totalWidth = Math.max(20, Number(maxCols) || 42);
    const isSmall = totalWidth <= 28;
    const midStr = String(mid ?? '');
    const rightStr = String(right ?? '');
    const midWidth = Math.max(getPrinterCellWidth(midStr), isSmall ? 3 : 4);
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
    const totalWidth = Math.max(20, Number(maxCols) || 42);
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
export function compileShiftReportData(shift, bookingsData, categoriesData = []) {
    const categoryMap = {};
    categoriesData.forEach(cat => {
        categoryMap[cat.id] = cat.name;
    });

    const completedBookings = bookingsData.filter(b => b.status === 'completed');
    const voidBookings = bookingsData.filter(b => b.status === 'void');
    const cancelledBookings = bookingsData.filter(b => b.status === 'cancelled');

    // 1. Category & Top Items Sales
    const categorySalesMap = {};
    const itemSalesMap = {};
    let totalItemsCount = 0;
    let totalItemsAmount = 0;

    completedBookings.forEach(b => {
        b.order_items?.forEach(item => {
            const catId = item.menu_items?.category_id || 'other';
            const catName = categoryMap[catId] || 'อื่นๆ / Uncategorized';
            const itemName = (item.menu_items?.name || item.name || 'Unknown Item').toUpperCase();
            const qty = item.quantity || 0;
            const price = item.price_at_time || 0;
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
        const amt = b.total_amount || 0;
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
        const amt = b.total_amount || 0;
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
        const amt = b.total_amount || 0;
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
    let voidBillAmount = voidBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    
    let voidItemCount = 0;
    let voidItemAmount = 0;
    let cancelItemCount = 0;
    let cancelItemAmount = 0;

    bookingsData.forEach(b => {
        b.order_items?.forEach(item => {
            if (item.status === 'void') {
                voidItemCount += item.quantity || 0;
                voidItemAmount += (item.quantity || 0) * (item.price_at_time || 0);
            } else if (item.status === 'cancelled') {
                cancelItemCount += item.quantity || 0;
                cancelItemAmount += (item.quantity || 0) * (item.price_at_time || 0);
            }
        });
    });

    let cancelBillCount = cancelledBookings.length;
    let cancelBillAmount = cancelledBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

    // 6. General metrics
    const totalDiscounts = completedBookings.reduce((sum, b) => sum + (b.discount_amount || 0), 0);
    const totalGuests = completedBookings.reduce((sum, b) => sum + (b.pax || 0), 0);
    
    let totalVat = 0;
    completedBookings.forEach(b => {
        const sub = b.order_items?.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0) || 0;
        const disc = b.discount_amount || 0;
        const net = sub - disc;
        if (b.total_amount && Math.abs(b.total_amount - (net * 1.07)) < 1) {
            totalVat += net * 0.07;
        }
    });

    const netSales = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const avgSalesPerBill = completedBookings.length > 0 ? (netSales / completedBookings.length) : 0;
    const avgSalesPerGuest = totalGuests > 0 ? (netSales / totalGuests) : 0;

    // Deduct adjustments
    const adjustments = shift.adjustments || [];
    const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
    const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);

    return {
        staffName: shift.staffName,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt || new Date().toISOString(),
        openingFloat: shift.openingFloat,
        cashSales: shift.cashSales || cashAmount,
        qrSales: shift.qrSales || qrAmount,
        creditSales: shift.creditSales || creditAmount,
        totalSales: shift.totalSales || (cashAmount + qrAmount + creditAmount),
        totalIn,
        totalOut,
        expectedCash: shift.expectedCash,
        actualCash: shift.closedCash,
        difference: shift.difference,
        
        shiftId: shift.id ? shift.id.replace('shift_', '') : '',
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
        totalVat,
        totalGuests,
        averageSalesPerBill: avgSalesPerBill,
        adjustments
    };
}

// Convert shift report data to ESC/POS binary format
export function encodeShiftReportData(reportData, paperSize = '58mm', printerType = 'universal') {
    return encodeShiftClosureReportData(reportData, paperSize, printerType);
}

// Convert shift closure report data to ESC/POS binary format for SUNMI / RawBT
export function encodeShiftClosureReportData(reportData, paperSize = '80mm', printerType = 'universal') {
    if (!paperSize) {
        try {
            const stored = localStorage.getItem('onhaus_printer_config');
            if (stored) {
                const cfg = JSON.parse(stored);
                if (cfg.cashier_paper_size || cfg.paper_width) {
                    paperSize = cfg.cashier_paper_size || cfg.paper_width;
                }
            }
        } catch (e) {}
    }
    paperSize = paperSize || '80mm';

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
           .size(0, 1) // Double height
           .line('รายงานยอดการขาย')
           .size(0, 0)
           .bold(false)
           .line(`รหัส: ${reportData.shiftId || reportData.staffName || ''}`)
           .line(shopName)
           .line(shopAddress)
           .line('')
           .align('left')
           .line(`เวลาเปิดรอบ: ${formatDateTime(reportData.openedAt)}`)
           .line(`โดย: ${reportData.staffName}`)
           .line('')
           .line(`เวลาปิดรอบ: ${formatDateTime(reportData.closedAt)}`)
           .line(`โดย: ${reportData.staffName}`)
           .line(divider);

    // Section 1: ยอดขายตามหมวดหมู่
    if (reportData.categorySales && reportData.categorySales.length > 0) {
        encoder.bold(true).line('ยอดขายตามหมวดหมู่').bold(false);
        let totalQty = 0;
        let totalAmt = 0;
        reportData.categorySales.forEach(cat => {
            totalQty += cat.quantity || 0;
            totalAmt += cat.amount || 0;
            encoder.line(formatThreeCols(cat.name, cat.quantity, formatReceiptMoney(cat.amount), maxCols));
        });
        
        encoder.line(formatThreeCols('รวม', totalQty, formatReceiptMoney(totalAmt), maxCols));
        
        const discountVal = reportData.totalDiscounts || 0;
        const vatVal = reportData.totalVat || 0;
        const netSales = reportData.totalSales - discountVal;
        const preVatVal = netSales - vatVal;

        encoder.line(formatTwoCols('ส่วนลด', formatReceiptMoney(discountVal), maxCols));
        encoder.line(formatTwoCols('ค่าบริการ', '0.00', maxCols));
        encoder.line(formatTwoCols('ยอดก่อนภาษี (VAT)', formatReceiptMoney(preVatVal), maxCols));
        encoder.line(formatTwoCols('ภาษี (VAT)', formatReceiptMoney(vatVal), maxCols));
        encoder.line(formatTwoCols('ปัดเศษ', '0.00', maxCols));
        encoder.line(formatTwoCols('ส่วนลดท้ายบิล', '0.00', maxCols));
        encoder.line(formatTwoCols('ยอดขายสุทธิ', formatReceiptMoney(netSales), maxCols));
        encoder.line(formatTwoCols('จำนวนลูกค้า (Pax)', (reportData.totalGuests || 0).toString(), maxCols));
        encoder.line(formatTwoCols('ยอดขายเฉลี่ยต่อบิล', formatReceiptMoney(reportData.averageSalesPerBill), maxCols));
        encoder.line(formatTwoCols('ยอดขายเฉลี่ยต่อหัว', formatReceiptMoney(reportData.averageSalesPerGuest), maxCols));
    } else {
        // Fallback backward compatibility
        encoder.bold(true).line('SALES SUMMARY').bold(false);
        encoder.line(formatTwoCols('Total Bookings', (reportData.totalBookings || 0).toString(), maxCols));
        encoder.line(formatTwoCols('Gross Revenue', formatReceiptMoney(reportData.grossRevenue || reportData.totalSales), maxCols));
        encoder.line(formatTwoCols('Discounts', formatReceiptMoney(reportData.discounts || reportData.totalDiscounts), maxCols));
        encoder.line(divider);
    }

    // Section Top 3 Selling Items
    if (reportData.topSellingItems && reportData.topSellingItems.length > 0) {
        encoder.line(divider);
        encoder.bold(true).line('★ เมนูขายดี 3 อันดับ (Top 3 Selling Items)').bold(false);
        reportData.topSellingItems.forEach((item, index) => {
            const rankLabel = `${index + 1}. ${item.name}`;
            encoder.line(formatThreeCols(rankLabel, `${item.quantity} ชิ้น`, formatReceiptMoney(item.amount), maxCols));
        });
    }

    // Section 2: ยอดขายตามการชำระเงิน
    if (reportData.paymentSales) {
        encoder.line(divider);
        encoder.bold(true).line('ยอดขายตามการชำระเงิน').bold(false);
        
        const cash = reportData.paymentSales.cash || { count: 0, amount: 0 };
        const credit = reportData.paymentSales.creditCard || { count: 0, amount: 0 };
        const qr = reportData.paymentSales.qrPromptPay || { count: 0, amount: 0 };
        const other = reportData.paymentSales.other || { count: 0, amount: 0, subItems: [] };
        
        encoder.line(formatThreeCols('เงินสด', cash.count, formatReceiptMoney(cash.amount), maxCols));
        encoder.line(formatThreeCols('QR PromptPay', qr.count, formatReceiptMoney(qr.amount), maxCols));

        if (credit.count > 0 || credit.amount > 0) {
            encoder.line(formatThreeCols('บัตรเครดิต', credit.count, formatReceiptMoney(credit.amount), maxCols));
        }

        if (other.count > 0 || other.amount > 0) {
            encoder.line(formatThreeCols('การชำระเงินแบบอื่นๆ', other.count, formatReceiptMoney(other.amount), maxCols));
            if (other.subItems && other.subItems.length > 0) {
                other.subItems.forEach(sub => {
                    encoder.line(formatThreeCols(`• ${sub.name}`, sub.count, formatReceiptMoney(sub.amount), maxCols));
                });
            }
        }
        
        const netSales = reportData.totalSales - (reportData.totalDiscounts || 0);
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
    encoder.line(formatTwoCols('คืนเงิน', '0.00', maxCols));
    encoder.line(formatTwoCols('เงินเข้า/เงินออก', formatReceiptMoney((reportData.totalIn || 0) - (reportData.totalOut || 0)), maxCols));
    encoder.line(formatTwoCols('จำนวนเงินที่ควรมี', formatReceiptMoney(reportData.expectedCash), maxCols));
    encoder.line(formatTwoCols('จำนวนจริงในลิ้นชัก', formatReceiptMoney(reportData.actualCash), maxCols));
    encoder.line(formatTwoCols('ส่วนต่าง', formatReceiptMoney(reportData.difference), maxCols));
    encoder.line(formatTwoCols('บิลทั้งหมด', (reportData.totalBookings || 0).toString(), maxCols));

    // Detailed adjustments list on receipt
    if (reportData.adjustments && reportData.adjustments.length > 0) {
        reportData.adjustments.forEach(adj => {
            const prefix = adj.type === 'in' ? 'นำเข้า' : 'นำออก';
            const sign = adj.type === 'in' ? '+' : '-';
            const label = `  • [${prefix}] ${adj.note || ''}`;
            const amountStr = `${sign}${formatReceiptMoney(adj.amount)}`;
            encoder.line(formatTwoCols(label, amountStr, maxCols));
        });
    }

    // Section 6: ทำลายบิล (Void)
    const voidData = reportData.voidData || { wholeBill: { count: 0, amount: 0 }, itemLevel: { count: 0, amount: 0 }, paidBillVoidCount: 0 };
    encoder.line(divider);
    encoder.bold(true).line('ทำลายบิล (Void)').bold(false);
    encoder.line(formatThreeCols('ทำลายทั้งบิล', voidData.wholeBill.count, formatReceiptMoney(voidData.wholeBill.amount), maxCols));
    encoder.line(formatThreeCols('ทำลายรายเมนู', voidData.itemLevel.count, formatReceiptMoney(voidData.itemLevel.amount), maxCols));
    encoder.line(formatTwoCols('ทำลายบิลที่ชำระเงินแล้ว', (voidData.paidBillVoidCount || 0).toString(), maxCols));

    // Section 7: ยกเลิกเมนู (Cancel)
    const cancelData = reportData.cancelData || { wholeBill: { count: 0, amount: 0 }, itemLevel: { count: 0, amount: 0 } };
    encoder.line(divider);
    encoder.bold(true).line('ยกเลิกเมนู (Cancel)').bold(false);
    encoder.line(formatThreeCols('ยกเลิกบิล', cancelData.wholeBill.count, formatReceiptMoney(cancelData.wholeBill.amount), maxCols));
    encoder.line(formatThreeCols('ยกเลิกรายเมนู', cancelData.itemLevel.count, formatReceiptMoney(cancelData.itemLevel.amount), maxCols));

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
        // Try getting previously paired devices first
        if (navigator.bluetooth.getDevices) {
            const paired = await navigator.bluetooth.getDevices();
            device = paired.find(d => d.name === targetDeviceName || d.id === targetDeviceName);
        }

        // If not in the paired list, we must prompt the device chooser (must be inside a user gesture handler)
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

        // Connect to GATT
        const server = await device.gatt.connect();
        
        // Find standard SPP or custom print service
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
            } catch (e) {
                // Try next service
            }
        }

        if (!service) {
            // Fallback: try getting all services and take the first non-generic one
            try {
                const services = await server.getPrimaryServices();
                if (services && services.length > 0) {
                    service = services.find(s => !s.uuid.startsWith('000018')) || services[0];
                }
            } catch (e) {
                // Fallback failed
            }
        }

        if (!service) {
            throw new Error("Could not find any supported print service on this device.");
        }

        const characteristics = await service.getCharacteristics();
        // Find writable characteristic
        const characteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
        if (!characteristic) {
            throw new Error("No writeable Bluetooth characteristic found.");
        }

        // Send data in chunks of 20 bytes (standard BLE/SPP MTU constraint)
        const chunkSize = 20;
        for (let i = 0; i < rawData.length; i += chunkSize) {
            const chunk = rawData.slice(i, i + chunkSize);
            if (characteristic.properties.writeWithoutResponse) {
                await characteristic.writeValueWithoutResponse(chunk);
            } else {
                await characteristic.writeValue(chunk);
            }
        }

        // Disconnect gracefully
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

// Print via RawBT Android Intent (Directly calls the main RawBT App)
export async function printToRawBTWebSocket(rawData) {
    logger.logNativeStart('print_rawbt_intent', { bytesLength: rawData ? rawData.length : 0 });
    try {
        // Convert raw Uint8Array bytes to binary string
        let binary = '';
        const len = rawData.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(rawData[i]);
        }
        
        // Encode binary string to Base64
        const base64Data = window.btoa(binary);
        
        // Build the Android Intent URL targeting the RawBT main application package
        const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        
        // Redirect the WebView to trigger the intent
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

// Download and resize image url to base64 JPEG format for thermal printers
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
                // Fill with white background to handle PNG transparency gracefully
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
                resolve(base64Data);
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = (err) => {
            reject(new Error("Failed to load image url: " + logoUrl));
        };
    });
}

// Get cached or download/resize remote image to base64 JPEG
async function getCachedResizedImage(url, targetWidth) {
    if (!url) return null;
    const cacheKey = `img_cache_${url}_w${targetWidth}`;
    
    // 1. In-memory check
    if (imageBase64Cache[cacheKey]) {
        return imageBase64Cache[cacheKey];
    }
    
    // 2. LocalStorage check
    try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
            imageBase64Cache[cacheKey] = stored;
            return stored;
        }
    } catch (e) {
        // ignore
    }
    
    // 3. Download and resize
    const base64 = await downloadAndResizeLogoToBase64(url, targetWidth);
    
    // 4. Update cache
    imageBase64Cache[cacheKey] = base64;
    try {
        localStorage.setItem(cacheKey, base64);
    } catch (e) {
        // ignore quota errors
    }
    
    return base64;
}

// Print directly to SUNMI Built-in Thermal Printer (via Capacitor SUNMI Plugin / AIDL Service) with FIFO Queue
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

                // 1. If logo URL is provided, print logo bitmap at the top of the receipt
                if (logoUrl) {
                    try {
                        logger.info("SUNMI: getting Logo from cache or loading: " + logoUrl);
                        const base64Logo = await getCachedResizedImage(logoUrl, 384); // 384px width for 80mm logo
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

                // 2. Convert raw ESC/POS byte array directly to base64 string
                logger.info("SUNMI: converting rawData to base64 string");
                let binary = '';
                const len = rawData.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(rawData[i]);
                }
                const base64Data = window.btoa(binary);

                logger.info("SUNMI: calling sendRAWBase64Data");
                await SunmiPrinter.sendRAWBase64Data({ data: base64Data });
                logger.info("SUNMI: sendRAWBase64Data completed successfully");
                
                // 3. If QR URL is provided, print it at the bottom (enlarged to 360px for easy scanning)
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

                // 4. Trigger cutter ONLY if QR was printed after rawData (rawData already contains ESC/POS cut command)
                if (didPrintQr) {
                    try {
                        await SunmiPrinter.cutPaper();
                    } catch (cutErr) {
                        // non-fatal if built-in printer has manual tear bar instead of auto cutter
                    }
                }

                // Buffer delay (200ms) for physical motor, paper feed, and cutter completion
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
