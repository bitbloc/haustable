// ESC/POS Command Constants
const ESC = 0x1B;
const GS = 0x1D;

class EscPosEncoder {
    constructor() {
        this.buffer = [];
    }

    initialize() {
        this.buffer.push(ESC, 0x40); // Initialize printer
        return this;
    }

    text(txt) {
        const bytes = encodeThaiTIS620(txt);
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

// Convert receipt/ticket details to ESC/POS binary format
export function encodeReceiptData(booking, activeTab, paymentMethod, optionMap = {}, paperSize = '58mm') {
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

    const encoder = new EscPosEncoder();
    encoder.initialize();

    const queueNo = (booking.tracking_token && booking.tracking_token.length <= 8) 
        ? booking.tracking_token 
        : booking.id.slice(0, 4);
    const dateStr = new Date(booking.booking_time).toLocaleString('th-TH');

    const maxCols = paperSize === '80mm' ? 48 : 30; // 58mm usually supports 30 or 32 columns. 30 is safest to avoid wrapping.
    const divider = '-'.repeat(maxCols);

    // 1. Header (Omit for kitchen and bar)
    if (activeTab !== 'kitchen' && activeTab !== 'bar') {
        encoder.align('center')
               .size(1, 1)
               .bold(true)
               .line('IN THE HAUS')
               .size(0, 0)
               .bold(false)
               .line('TASTE YOUR SCENT.')
               .line(divider);
    } else if (activeTab === 'kitchen') {
        encoder.align('center')
               .bold(true)
               .line('KITCHEN ORDER / ใบสั่งอาหาร')
               .bold(false)
               .line(divider);
    } else if (activeTab === 'bar') {
        encoder.align('center')
               .bold(true)
               .line('BAR ORDER / ใบสั่งเครื่องดื่ม')
               .bold(false)
               .line(divider);
    }

    // 2. Table Name (Emphasized / large font)
    const tableName = (booking.tables_layout?.table_name || 'PICKUP').toUpperCase();
    encoder.align('center')
           .bold(true)
           .size(1, 1)
           .line(`TABLE ${tableName}`)
           .size(0, 0)
           .bold(false)
           .line(divider);

    // 3. Meta info
    encoder.align('left')
           .line(`QUEUE: #${queueNo}`)
           .line(`DATE : ${dateStr}`)
           .line(`GUEST: ${booking.profiles?.display_name || booking.pickup_contact_name || 'Guest'}`);

    const phone = booking.profiles?.phone_number || booking.pickup_contact_phone;
    if (phone) {
        encoder.line(`PHONE: ${phone}`);
    }
    encoder.line(divider);

    // 4. Items Header
    encoder.bold(true)
           .line(activeTab === 'kitchen' ? 'KITCHEN ITEMS' : activeTab === 'bar' ? 'BAR ITEMS' : 'ITEMS')
           .bold(false);

    // 5. Items List
    itemsToRender.forEach(item => {
        const qty = `${item.quantity}x `.padEnd(4, ' ');
        const name = (item.menu_items?.name || 'Item').toUpperCase();
        
        let priceStr = '';
        if (activeTab !== 'kitchen' && activeTab !== 'bar') {
            priceStr = (item.price_at_time * item.quantity).toLocaleString();
        }

        // Format name + price based on maxCols
        const leftSpace = maxCols - qty.length - priceStr.length;
        let displayName = name;
        if (name.length > leftSpace) {
            displayName = name.slice(0, leftSpace - 3) + '...';
        }
        
        encoder.text(qty + displayName.padEnd(leftSpace, ' ') + priceStr + '\n');

        // Render options
        if (item.selected_options) {
            let optionsList = [];
            if (Array.isArray(item.selected_options)) {
                optionsList = item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt);
            } else if (typeof item.selected_options === 'object') {
                optionsList = Object.values(item.selected_options).flat().map(id => optionMap[id] || id);
            }
            optionsList.forEach(opt => {
                encoder.line(`   + ${opt}`);
            });
        }
    });
    encoder.line(divider);

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
               .line(divider);
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
               .line(divider);
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
    encoder.align('center')
           .line('THANK YOU FOR YOUR VISIT')
           .line('smallfry.world')
           .feed(4)
           .cut();

    return encoder.encode();
}

// Convert shift report data to ESC/POS binary format
export function encodeShiftReportData(reportData, paperSize = '58mm') {
    const encoder = new EscPosEncoder();
    encoder.initialize();

    const maxCols = paperSize === '80mm' ? 48 : 30;
    const divider = '-'.repeat(maxCols);
    const dateStr = new Date().toLocaleString('th-TH');

    encoder.align('center')
           .size(1, 1)
           .bold(true)
           .line('IN THE HAUS')
           .size(0, 0)
           .bold(false)
           .line('SHIFT SUMMARY REPORT')
           .line(divider)
           .align('left')
           .line(`Printed: ${dateStr}`)
           .line(`Staff  : ${reportData.staffName}`)
           .line(divider);

    encoder.bold(true).line('SALES SUMMARY').bold(false);
    encoder.text(`Total Bookings`.padEnd(maxCols - 12, ' ') + `${reportData.totalBookings}`.padStart(12, ' ') + '\n');
    encoder.text(`Total Items`.padEnd(maxCols - 12, ' ') + `${reportData.totalItems}`.padStart(12, ' ') + '\n');
    encoder.text(`Gross Revenue`.padEnd(maxCols - 12, ' ') + `฿${reportData.grossRevenue.toLocaleString()}`.padStart(12, ' ') + '\n');
    encoder.text(`Discounts`.padEnd(maxCols - 12, ' ') + `-฿${reportData.discounts.toLocaleString()}`.padStart(12, ' ') + '\n');
    encoder.line(divider);

    encoder.bold(true).line('REVENUE BY METHOD').bold(false);
    encoder.text(`Cash Payments`.padEnd(maxCols - 12, ' ') + `฿${reportData.cashRevenue.toLocaleString()}`.padStart(12, ' ') + '\n');
    encoder.text(`QR Payments`.padEnd(maxCols - 12, ' ') + `฿${reportData.qrRevenue.toLocaleString()}`.padStart(12, ' ') + '\n');
    encoder.line(divider);

    encoder.bold(true)
           .size(0, 1)
           .text(`NET REVENUE`.padEnd(maxCols - 12, ' ') + `฿${reportData.netRevenue.toLocaleString()}`.padStart(12, ' ') + '\n')
           .size(0, 0)
           .bold(false)
           .line(divider)
           .feed(4)
           .cut();

    return encoder.encode();
}

// Convert shift closure report data to ESC/POS binary format for SUNMI / RawBT
export function encodeShiftClosureReportData(reportData, paperSize = '80mm') {
    const encoder = new EscPosEncoder();
    encoder.initialize();

    const maxCols = paperSize === '80mm' ? 48 : 30;
    const divider = '-'.repeat(maxCols);
    const dateStr = new Date().toLocaleString('th-TH');

    encoder.align('center')
           .size(1, 1)
           .bold(true)
           .line('IN THE HAUS')
           .size(0, 0)
           .bold(false)
           .line('SHIFT CLOSURE REPORT')
           .line(divider)
           .align('left')
           .line(`Printed: ${dateStr}`)
           .line(`Staff  : ${reportData.staffName}`)
           .line(`Opened : ${new Date(reportData.openedAt).toLocaleString('th-TH')}`)
           .line(`Closed : ${new Date(reportData.closedAt).toLocaleString('th-TH')}`)
           .line(divider);

    encoder.bold(true).line('CASH FLOW').bold(false);
    encoder.text(`Opening Float`.padEnd(maxCols - 12, ' ') + `฿${reportData.openingFloat.toLocaleString()}`.padStart(12, ' ') + '\n');
    encoder.text(`Cash Sales`.padEnd(maxCols - 12, ' ') + `฿${reportData.cashSales.toLocaleString()}`.padStart(12, ' ') + '\n');
    encoder.text(`QR Sales`.padEnd(maxCols - 12, ' ') + `฿${reportData.qrSales.toLocaleString()}`.padStart(12, ' ') + '\n');
    
    if (reportData.totalIn > 0) {
        encoder.text(`Petty Cash In`.padEnd(maxCols - 12, ' ') + `+฿${reportData.totalIn.toLocaleString()}`.padStart(12, ' ') + '\n');
    }
    if (reportData.totalOut > 0) {
        encoder.text(`Petty Cash Out`.padEnd(maxCols - 12, ' ') + `-฿${reportData.totalOut.toLocaleString()}`.padStart(12, ' ') + '\n');
    }
    encoder.line(divider);

    encoder.bold(true).line('RECONCILIATION').bold(false);
    encoder.text(`Expected Cash`.padEnd(maxCols - 12, ' ') + `฿${reportData.expectedCash.toLocaleString()}`.padStart(12, ' ') + '\n');
    encoder.text(`Actual Cash`.padEnd(maxCols - 12, ' ') + `฿${reportData.actualCash.toLocaleString()}`.padStart(12, ' ') + '\n');
    encoder.line(divider);

    const diffLabel = reportData.difference === 0 ? 'Cash Matched' : reportData.difference > 0 ? 'Cash Over' : 'Cash Short';
    encoder.bold(true)
           .size(0, 1)
           .text(`DIFF (${diffLabel})`.padEnd(maxCols - 12, ' ') + `${reportData.difference >= 0 ? '+' : ''}฿${reportData.difference.toLocaleString()}`.padStart(12, ' ') + '\n')
           .size(0, 0)
           .bold(false)
           .line(divider)
           .feed(4)
           .cut();

    return encoder.encode();
}

// Connect and write raw bytes via Web Bluetooth directly
export async function printToBluetoothDirect(targetDeviceName, rawData) {
    if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth API is not supported on this platform/browser.");
    }

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
        return true;
    } catch (err) {
        console.error("Direct Bluetooth print failed:", err);
        throw err;
    }
}

// Print via RawBT Android Intent (Directly calls the main RawBT App)
export async function printToRawBTWebSocket(rawData) {
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
        return true;
    } catch (e) {
        console.error("RawBT Intent print failed:", e);
        throw new Error("เกิดข้อผิดพลาดในการเรียกใช้แอป RawBT: " + e.message);
    }
}

let sunmiPrintQueue = Promise.resolve();

// Print directly to SUNMI Built-in Thermal Printer (via Capacitor SUNMI Plugin / AIDL Service) with FIFO Queue
export async function printToSunmiBuiltIn(rawData) {
    return new Promise((resolve, reject) => {
        sunmiPrintQueue = sunmiPrintQueue.then(async () => {
            try {
                const { SunmiPrinter } = await import('@kduma-autoid/capacitor-sunmi-printer');
                try {
                    await SunmiPrinter.bindService();
                } catch (bindErr) {
                    console.warn("SUNMI bindService warning (may already be bound):", bindErr);
                }

                const dataArray = Array.from(rawData);
                await SunmiPrinter.sendRAWData({ data: dataArray });
                
                // Add a small 150ms buffer delay for physical motor/paper feed sync
                await new Promise(r => setTimeout(r, 150));
                
                resolve(true);
            } catch (e) {
                console.error("SUNMI Built-in print failed inside queue:", e);
                reject(new Error("ไม่สามารถพิมพ์ผ่านเครื่องพิมพ์ในตัว SUNMI ได้: " + e.message));
            }
        }).catch(err => {
            console.error("SUNMI Print Queue error:", err);
            reject(err);
        });
    });
}

