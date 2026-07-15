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
            // Sunmi defaults to UTF-8 parsing, no need to set standard single-byte TIS-620 code page
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

    cut() {
        this.buffer.push(GS, 0x56, 66, 0); // Cut paper
        return this;
    }

    feed(lines = 3) {
        this.buffer.push(ESC, 0x64, lines);
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

// Convert receipt/ticket details to ESC/POS binary format
export function encodeReceiptData(booking, activeTab, paymentMethod, optionMap = {}, paperSize = '58mm', receiptConfig = {}, printerType = 'universal') {
    const BAR_CATEGORIES = [
        '7524bb8a-4698-45c6-aa17-d8ccc296f667', // Coffee
        '912683ef-fdc3-40a3-8dd8-b09507791240', // Soft Drink
        'b441665e-2f23-4df3-a11d-63485e1690dc', // Beer
        'a2c783fc-975b-4779-b9eb-67391eeafd1f', // Alcohol
        '1983955d-5787-4351-b729-51b95761f125', // Mocktail & Cocktail
        '1407d869-4eed-489e-aeeb-ba7ef19f57bd', // Bottled
        '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'  // PRO Beer
    ];

    // Filter items based on activeTab
    let itemsToRender = booking.order_items || [];
    if (activeTab === 'kitchen') {
        itemsToRender = itemsToRender.filter(item => !BAR_CATEGORIES.includes(item.menu_items?.category_id));
    } else if (activeTab === 'bar') {
        itemsToRender = itemsToRender.filter(item => BAR_CATEGORIES.includes(item.menu_items?.category_id));
    }

    // Return null if there are no items to print for this specific tab
    if ((activeTab === 'kitchen' || activeTab === 'bar') && itemsToRender.length === 0) {
        return null;
    }

    // Sort items for kitchen and bar to group by category first, then alphabetically by name
    if (activeTab === 'kitchen' || activeTab === 'bar') {
        itemsToRender = [...itemsToRender].sort((a, b) => {
            const catA = a.menu_items?.category_id || '';
            const catB = b.menu_items?.category_id || '';
            if (catA !== catB) return catA.localeCompare(catB);
            const nameA = a.menu_items?.name || '';
            const nameB = b.menu_items?.name || '';
            return nameA.localeCompare(nameB);
        });
    }

    const encoder = new EscPosEncoder(printerType === 'sunmi');
    encoder.initialize();

    const queueNo = (booking.tracking_token && booking.tracking_token.length <= 8) 
        ? booking.tracking_token 
        : String(booking.id).slice(0, 4);
    const dateStr = new Date(booking.booking_time).toLocaleString('th-TH');

    const maxCols = paperSize === '80mm' ? 48 : 30; // 58mm usually supports 30 or 32 columns. 30 is safest to avoid wrapping.
    const divider = '-'.repeat(maxCols);
    const doubleDivider = '='.repeat(maxCols);

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
    if (activeTab !== 'kitchen' && activeTab !== 'bar') {
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
    } else if (activeTab === 'kitchen') {
        encoder.align('center')
               .line(doubleDivider)
               .bold(true)
               .size(1, 1) // Double size header for kitchen!
               .line('KITCHEN ORDER')
               .line('ใบสั่งอาหาร')
               .size(0, 0)
               .bold(false)
               .line(doubleDivider);
    } else if (activeTab === 'bar') {
        encoder.align('center')
               .line(doubleDivider)
               .bold(true)
               .size(1, 1) // Double size header for bar!
               .line('BAR ORDER')
               .line('ใบสั่งเครื่องดื่ม')
               .size(0, 0)
               .bold(false)
               .line(doubleDivider);
    }

    // 2. Table Name & Queue Number (Highly visible / double size)
    const tableName = (booking.tables_layout?.table_name || 'PICKUP').toUpperCase();
    
    // For kitchen/bar: Make Table Name and Queue ID even bigger and print order time prominently
    if (activeTab === 'kitchen' || activeTab === 'bar') {
        encoder.align('center')
               .bold(true)
               .size(1, 1)
               .line(`TABLE ${tableName}`)
               .line(`Q: #${queueNo}`)
               .size(0, 0)
               .line(divider)
               .align('left')
               .bold(true)
               .size(0, 1) // Double height order time
               .line(`TIME: ${new Date(booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
               .size(0, 0)
               .bold(false)
               .line(divider);
    } else {
        encoder.align('center')
               .bold(true)
               .size(1, 1)
               .line(`TABLE ${tableName}`)
               .line(`Q: #${queueNo}`)
               .size(0, 0)
               .bold(false)
               .line(divider);
    }

    // 3. Meta info
    if (activeTab !== 'kitchen' && activeTab !== 'bar') {
        encoder.align('left')
               .line(`DATE : ${dateStr}`)
               .line(`GUEST: ${booking.profiles?.display_name || booking.pickup_contact_name || 'Guest'}`);

        const phone = booking.profiles?.phone_number || booking.pickup_contact_phone;
        if (phone) {
            encoder.line(`PHONE: ${phone}`);
        }
        if (staffName) {
            encoder.line(`STAFF: ${staffName.toUpperCase()}`);
        }
        encoder.line(divider);
    }

    // 4. Items Header
    encoder.bold(true)
           .line(activeTab === 'kitchen' ? 'KITCHEN ITEMS' : activeTab === 'bar' ? 'BAR ITEMS' : 'ITEMS')
           .bold(false)
           .line(divider);

    // 5. Items List
    if (activeTab === 'kitchen' || activeTab === 'bar') {
        itemsToRender.forEach(item => {
            const qtyStr = `[ ${item.quantity} x ] `;
            const name = (item.menu_items?.name || 'Item').toUpperCase();
            
            // Print item line in double height font for extreme readability!
            encoder.bold(true)
                   .size(0, 1) // Double height
                   .line(`${qtyStr}${name}`)
                   .size(0, 0)
                   .bold(false);
            
            // Print options in normal bold
            if (item.selected_options) {
                let optionsList = [];
                if (Array.isArray(item.selected_options)) {
                    optionsList = item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt);
                } else if (typeof item.selected_options === 'object') {
                    optionsList = Object.values(item.selected_options).flat().map(id => optionMap[id] || id);
                }
                optionsList.forEach(opt => {
                    encoder.bold(true)
                           .line(`    ▶ ${opt.toUpperCase()}`)
                           .bold(false);
                });
            }
            // Add a clean dotted line separator between items
            encoder.line('. '.repeat(Math.floor(maxCols / 2)));
        });
    } else {
        itemsToRender.forEach(item => {
            const qty = `${item.quantity}x `.padEnd(4, ' ');
            const name = (item.menu_items?.name || 'Item').toUpperCase();
            
            let priceStr = '';
            priceStr = (item.price_at_time * item.quantity).toLocaleString();

            // Format name + price based on maxCols
            const leftSpace = maxCols - qty.length - priceStr.length;
            let displayName = name;
            if (name.length > leftSpace) {
                displayName = name.slice(0, leftSpace - 3) + '...';
            }
            
            encoder.text(qty + displayName.padEnd(leftSpace, ' ') + priceStr + '\n');

            // Print unit price details if quantity > 1
            if (item.quantity > 1) {
                encoder.line(`     (${item.quantity} x ฿${item.price_at_time.toLocaleString()})`);
            }

            // Render options (indented nicely)
            if (item.selected_options) {
                let optionsList = [];
                if (Array.isArray(item.selected_options)) {
                    optionsList = item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt);
                } else if (typeof item.selected_options === 'object') {
                    optionsList = Object.values(item.selected_options).flat().map(id => optionMap[id] || id);
                }
                optionsList.forEach(opt => {
                    encoder.line(`    + ${opt}`);
                });
            }
        });
        encoder.line(divider);
    }

    // 6. Totals
    if (activeTab !== 'kitchen' && activeTab !== 'bar') {
        const subtotal = booking.order_items?.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0) || 0;
        const discount = booking.discount_amount || 0;
        const netAfterDiscount = subtotal - discount;
        const vatVal = (booking.total_amount && Math.abs(booking.total_amount - (netAfterDiscount * 1.07)) < 1) 
            ? (netAfterDiscount * 0.07) 
            : 0;

        encoder.text(`SUBTOTAL`.padEnd(maxCols - 12, ' ') + subtotal.toLocaleString().padStart(12, ' ') + '\n');
        if (discount > 0) {
            encoder.text(`DISCOUNT`.padEnd(maxCols - 12, ' ') + `-${discount.toLocaleString()}`.padStart(12, ' ') + '\n');
        }
        if (vatVal > 0) {
            encoder.text(`VAT (7%)`.padEnd(maxCols - 12, ' ') + vatVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(12, ' ') + '\n');
        }
        encoder.line(divider)
               .bold(true)
               .size(0, 1)
               .text(`TOTAL`.padEnd(maxCols - 12, ' ') + `${booking.total_amount?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`.padStart(12, ' ') + '\n')
               .size(0, 0)
               .bold(false)
               .line(doubleDivider);
    }

    // 7. Payment details (Omit for kitchen)
    if (activeTab === 'receipt') {
        const methodLabel = paymentMethod === 'cash' ? 'CASH / เงินสด' : 'QR TRANSFER / โอนเงินผ่าน QR';
        encoder.align('center')
               .line(`Payment: ${methodLabel}`)
               .line('')
               .bold(true)
               .line('[ PAID / ชำระแล้ว ]')
               .bold(false)
               .line(doubleDivider);
    }

    // 8. Note
    if (booking.customer_note) {
        encoder.align('left')
               .bold(true)
               .line('NOTE FOR KITCHEN:')
               .bold(false)
               .line(booking.customer_note)
               .line(divider);
    }

    // 9. Footer
    if (activeTab !== 'kitchen' && activeTab !== 'bar') {
        encoder.align('center')
               .line(shopFooter)
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

function formatThreeCols(left, mid, right, maxCols) {
    const rightCol = 12;
    const midCol = 5;
    // two spaces separation
    const leftCol = maxCols - rightCol - midCol - 3;
    
    let leftStr = String(left);
    if (leftStr.length > leftCol) {
        leftStr = leftStr.slice(0, leftCol - 3) + '...';
    }
    
    return leftStr.padEnd(leftCol, ' ') + '  ' + String(mid).padStart(midCol, ' ') + ' ' + String(right).padStart(rightCol, ' ');
}

function formatTwoCols(left, right, maxCols) {
    const rightCol = 12;
    const leftCol = maxCols - rightCol - 1; // one space separation
    
    let leftStr = String(left);
    if (leftStr.length > leftCol) {
        leftStr = leftStr.slice(0, leftCol - 3) + '...';
    }
    
    return leftStr.padEnd(leftCol, ' ') + ' ' + String(right).padStart(rightCol, ' ');
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

    // 1. Category Sales
    const categorySalesMap = {};
    let totalItemsCount = 0;
    let totalItemsAmount = 0;

    completedBookings.forEach(b => {
        b.order_items?.forEach(item => {
            const catId = item.menu_items?.category_id || 'other';
            const catName = categoryMap[catId] || 'อื่นๆ / Uncategorized';
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
        });
    });

    const categorySales = Object.values(categorySalesMap).sort((a, b) => b.amount - a.amount);

    // 2. Payments
    let cashCount = 0;
    let cashAmount = 0;
    let qrCount = 0;
    let qrAmount = 0;
    let creditCount = 0;
    let creditAmount = 0;
    let otherCount = 0;
    let otherAmount = 0;
    
    const otherDetailsMap = {};

    completedBookings.forEach(b => {
        const remark = (b.staff_remark || '').toLowerCase();
        const amt = b.total_amount || 0;
        
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
        
        paymentSales: {
            cash: { count: cashCount, amount: cashAmount },
            qrPromptPay: { count: qrCount, amount: qrAmount },
            linemanCash: { count: 0, amount: 0 },
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
    const encoder = new EscPosEncoder(printerType === 'sunmi');
    encoder.initialize();

    const maxCols = paperSize === '80mm' ? 48 : 30;
    const divider = '-'.repeat(maxCols);

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
            encoder.line(formatThreeCols(cat.name, cat.quantity, (cat.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        });
        
        encoder.line(formatThreeCols('รวม', totalQty, totalAmt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        
        const discountVal = reportData.totalDiscounts || 0;
        const vatVal = reportData.totalVat || 0;
        const netSales = reportData.totalSales - discountVal;
        const preVatVal = netSales - vatVal;

        encoder.line(formatTwoCols('ส่วนลด', discountVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        encoder.line(formatTwoCols('ค่าบริการ', '0.00', maxCols));
        encoder.line(formatTwoCols('ยอดก่อนภาษี (VAT)', preVatVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        encoder.line(formatTwoCols('ภาษี (VAT)', vatVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        encoder.line(formatTwoCols('ปัดเศษ', '0.00', maxCols));
        encoder.line(formatTwoCols('ส่วนลดท้ายบิล', '0.00', maxCols));
        encoder.line(formatTwoCols('ยอดขายสุทธิ', netSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        encoder.line(formatTwoCols('จำนวนลูกค้า', (reportData.totalGuests || 0).toString(), maxCols));
        encoder.line(formatTwoCols('ยอดขายเฉลี่ยต่อบิล', (reportData.averageSalesPerBill || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    } else {
        // Fallback backward compatibility
        encoder.bold(true).line('SALES SUMMARY').bold(false);
        encoder.text(`Total Bookings`.padEnd(maxCols - 12, ' ') + `${reportData.totalBookings || 0}`.padStart(12, ' ') + '\n');
        encoder.text(`Gross Revenue`.padEnd(maxCols - 12, ' ') + `฿${(reportData.grossRevenue || reportData.totalSales || 0).toLocaleString()}`.padStart(12, ' ') + '\n');
        encoder.text(`Discounts`.padEnd(maxCols - 12, ' ') + `-฿${(reportData.discounts || reportData.totalDiscounts || 0).toLocaleString()}`.padStart(12, ' ') + '\n');
        encoder.line(divider);
    }

    // Section 2: ยอดขายตามการชำระเงิน
    if (reportData.paymentSales) {
        encoder.line(divider);
        encoder.bold(true).line('ยอดขายตามการชำระเงิน').bold(false);
        
        const cash = reportData.paymentSales.cash || { count: 0, amount: 0 };
        const linemanCash = reportData.paymentSales.linemanCash || { count: 0, amount: 0 };
        const credit = reportData.paymentSales.creditCard || { count: 0, amount: 0 };
        const qr = reportData.paymentSales.qrPromptPay || { count: 0, amount: 0 };
        const other = reportData.paymentSales.other || { count: 0, amount: 0, subItems: [] };
        
        encoder.line(formatThreeCols('เงินสด', cash.count, (cash.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        encoder.line(formatThreeCols('เงินสดจาก LINE MAN', linemanCash.count, (linemanCash.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        encoder.line(formatThreeCols('บัตรเครดิต', credit.count, (credit.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        encoder.line(formatThreeCols('QR PromptPay', qr.count, (qr.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        encoder.line(formatThreeCols('การชำระเงินแบบอื่นๆ', other.count, (other.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        
        if (other.subItems && other.subItems.length > 0) {
            other.subItems.forEach(sub => {
                encoder.line(formatThreeCols(`• ${sub.name}`, sub.count, (sub.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
            });
        }
        
        const netSales = reportData.totalSales - (reportData.totalDiscounts || 0);
        encoder.line(formatTwoCols('ยอดขายสุทธิ', netSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    } else {
        // Fallback
        encoder.bold(true).line('REVENUE BY METHOD').bold(false);
        encoder.text(`Cash Payments`.padEnd(maxCols - 12, ' ') + `฿${(reportData.cashRevenue || reportData.cashSales || 0).toLocaleString()}`.padStart(12, ' ') + '\n');
        encoder.text(`QR Payments`.padEnd(maxCols - 12, ' ') + `฿${(reportData.qrRevenue || reportData.qrSales || 0).toLocaleString()}`.padStart(12, ' ') + '\n');
    }

    // Section 3: ยอดขายตามประเภทออเดอร์
    if (reportData.orderTypeSales) {
        encoder.line(divider);
        encoder.bold(true).line('ยอดขายตามประเภทออเดอร์').bold(false);
        
        const dineIn = reportData.orderTypeSales.dineIn || { count: 0, amount: 0 };
        const pickup = reportData.orderTypeSales.pickup || { count: 0, amount: 0 };
        
        if (dineIn.count > 0 || pickup.count === 0) {
            encoder.line(formatThreeCols('กินที่ร้าน', dineIn.count, (dineIn.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        }
        if (pickup.count > 0) {
            encoder.line(formatThreeCols('กลับบ้าน / รับเอง', pickup.count, (pickup.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        }
    }

    // Section 4: ยอดขายตามช่องทางการขาย
    if (reportData.channelSales) {
        encoder.line(divider);
        encoder.bold(true).line('ยอดขายตามช่องทางการขาย').bold(false);
        
        const linemanDelivery = reportData.channelSales.linemanDelivery || { count: 0, amount: 0 };
        const walkin = reportData.channelSales.walkin || { count: 0, amount: 0 };
        
        if (linemanDelivery.count > 0) {
            encoder.line(formatThreeCols('LINE MAN Delivery', linemanDelivery.count, (linemanDelivery.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        }
        if (walkin.count > 0 || linemanDelivery.count === 0) {
            encoder.line(formatThreeCols('หน้าร้าน / Direct', walkin.count, (walkin.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
        }
    }

    // Section 5: รอบการขาย
    encoder.line(divider);
    encoder.bold(true).line('รอบการขาย').bold(false);
    encoder.line(formatTwoCols('เงินสดเริ่มต้น', (reportData.openingFloat || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    encoder.line(formatTwoCols('ยอดขายเงินสด', (reportData.cashSales || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    encoder.line(formatTwoCols('คืนเงิน', '0.00', maxCols));
    encoder.line(formatTwoCols('เงินเข้า/เงินออก', ((reportData.totalIn || 0) - (reportData.totalOut || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    encoder.line(formatTwoCols('จำนวนเงินที่ควรมี', (reportData.expectedCash || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    encoder.line(formatTwoCols('จำนวนจริงในลิ้นชัก', (reportData.actualCash || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    encoder.line(formatTwoCols('ส่วนต่าง', (reportData.difference || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    encoder.line(formatTwoCols('บิลทั้งหมด', (reportData.totalBookings || 0).toString(), maxCols));

    // Detailed adjustments list on receipt
    if (reportData.adjustments && reportData.adjustments.length > 0) {
        reportData.adjustments.forEach(adj => {
            const prefix = adj.type === 'in' ? 'นำเข้า' : 'นำออก';
            const sign = adj.type === 'in' ? '+' : '-';
            const label = `  • [${prefix}] ${adj.note || ''}`;
            const amountStr = `${sign}${adj.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            encoder.line(formatTwoCols(label, amountStr, maxCols));
        });
    }

    // Section 6: ทำลายบิล (Void)
    const voidData = reportData.voidData || { wholeBill: { count: 0, amount: 0 }, itemLevel: { count: 0, amount: 0 }, paidBillVoidCount: 0 };
    encoder.line(divider);
    encoder.bold(true).line('ทำลายบิล (Void)').bold(false);
    encoder.line(formatThreeCols('ทำลายทั้งบิล', voidData.wholeBill.count, (voidData.wholeBill.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    encoder.line(formatThreeCols('ทำลายรายเมนู', voidData.itemLevel.count, (voidData.itemLevel.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    encoder.line(formatTwoCols('ทำลายบิลที่ชำระเงินแล้ว', (voidData.paidBillVoidCount || 0).toString(), maxCols));

    // Section 7: ยกเลิกเมนู (Cancel)
    const cancelData = reportData.cancelData || { wholeBill: { count: 0, amount: 0 }, itemLevel: { count: 0, amount: 0 } };
    encoder.line(divider);
    encoder.bold(true).line('ยกเลิกเมนู (Cancel)').bold(false);
    encoder.line(formatThreeCols('ยกเลิกบิล', cancelData.wholeBill.count, (cancelData.wholeBill.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));
    encoder.line(formatThreeCols('ยกเลิกรายเมนู', cancelData.itemLevel.count, (cancelData.itemLevel.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), maxCols));

    encoder.line(divider)
           .feed(4)
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

// Download and resize image url to base64 JPEG format for thermal printers
async function downloadAndResizeLogoToBase64(logoUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = logoUrl;
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const targetWidth = 200; // Auto resizing to max 200px width for clean thermal print
                const scale = targetWidth / img.width;
                canvas.width = targetWidth;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
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

                // Dynamically strip cut command from rawData if present
                let cleanData = rawData;
                let shouldManualCut = false;
                if (rawData && rawData.length >= 4) {
                    const lastFour = rawData.slice(-4);
                    // 0x1D, 0x56, 66 (0x42), 0x00 is GS V 66 0
                    if (lastFour[0] === 0x1D && lastFour[1] === 0x56 && lastFour[2] === 66 && lastFour[3] === 0) {
                        cleanData = rawData.slice(0, -4);
                        shouldManualCut = true;
                    }
                }

                // If logo URL is provided, try to print it first
                if (logoUrl) {
                    try {
                        logger.info("SUNMI: downloading and resizing logo: " + logoUrl);
                        const base64Image = await downloadAndResizeLogoToBase64(logoUrl);
                        logger.info("SUNMI: printing logo bitmap");
                        await SunmiPrinter.setAlignment({ alignment: "center" });
                        await SunmiPrinter.printBitmap({ bitmap: base64Image });
                        await SunmiPrinter.lineWrap({ lines: 1 });
                        await SunmiPrinter.setAlignment({ alignment: "left" });
                        logger.info("SUNMI: logo print completed successfully");
                    } catch (logoErr) {
                        console.warn("SUNMI print logo warning (non-fatal):", logoErr);
                        logger.warn("SUNMI: print logo warning (non-fatal)", logoErr);
                    }
                }

                logger.info("SUNMI: converting rawData to base64 string");
                let binary = '';
                const len = cleanData.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(cleanData[i]);
                }
                const base64Data = window.btoa(binary);

                logger.info("SUNMI: calling sendRAWBase64Data");
                await SunmiPrinter.sendRAWBase64Data({ data: base64Data });
                logger.info("SUNMI: sendRAWBase64Data completed successfully");
                
                // If QR URL is provided, print it at the bottom
                if (qrUrl) {
                    try {
                        logger.info("SUNMI: downloading and resizing QR code: " + qrUrl);
                        const base64Qr = await downloadAndResizeLogoToBase64(qrUrl);
                        logger.info("SUNMI: printing QR code bitmap");
                        await SunmiPrinter.setAlignment({ alignment: "center" });
                        await SunmiPrinter.printBitmap({ bitmap: base64Qr });
                        await SunmiPrinter.lineWrap({ lines: 1 });
                        await SunmiPrinter.setAlignment({ alignment: "left" });
                        logger.info("SUNMI: QR code print completed successfully");
                    } catch (qrErr) {
                        console.warn("SUNMI print QR warning (non-fatal):", qrErr);
                        logger.warn("SUNMI: print QR warning (non-fatal)", qrErr);
                    }
                }

                // If we stripped the cut command or explicitly need cutting, trigger it manually
                if (shouldManualCut) {
                    logger.info("SUNMI: executing manual cutPaper");
                    await SunmiPrinter.cutPaper();
                }

                // Add a small 150ms buffer delay for physical motor/paper feed sync
                await new Promise(r => setTimeout(r, 150));
                
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

