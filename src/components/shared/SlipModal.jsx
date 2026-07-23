import { useRef, useState, useEffect } from 'react'
import { X, Printer as PrinterIcon, Download, Check } from 'lucide-react'
import { toPng } from 'html-to-image'
import { supabase } from '../../lib/supabaseClient'
import { Capacitor } from '@capacitor/core'
import { Printer } from '@capgo/capacitor-printer'
import { printToBluetoothDirect, encodeReceiptData, printToRawBTWebSocket, printToSunmiBuiltIn } from '../../utils/printerHelper'

const BAR_CATEGORIES = [
    '7524bb8a-4698-45c6-aa17-d8ccc296f667', // Coffee
    '912683ef-fdc3-40a3-8dd8-b09507791240', // Soft Drink
    'b441665e-2f23-4df3-a11d-63485e1690dc', // Beer
    'a2c783fc-975b-4779-b9eb-67391eeafd1f', // Alcohol
    '1983955d-5787-4351-b729-51b95761f125', // Mocktail & Cocktail
    '1407d869-4eed-489e-aeeb-ba7ef19f57bd', // Bottled
    '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'  // PRO Beer
];

export default function SlipModal({ booking, type, onClose }) {
    const slipRef = useRef(null)
    const [saving, setSaving] = useState(false)
    const [optionMap, setOptionMap] = useState({})
    const [qrCodeUrl, setQrCodeUrl] = useState(null)
    // Determine initial tab:
    // If type === 'kitchen', default to kitchen.
    // Else if status === 'completed', default to receipt.
    // Else, default to billing.
    const getInitialTab = () => {
        if (type === 'kitchen') return 'kitchen'
        if (booking.status === 'completed') return 'receipt'
        return 'billing'
    }
    const [activeTab, setActiveTab] = useState(getInitialTab)

    const getIsAutoPrintingInitial = () => {
        try {
            const stored = localStorage.getItem('onhaus_printer_config');
            let config = {};
            if (stored) {
                config = JSON.parse(stored);
            }
            const currentTab = getInitialTab();
            const printerType = currentTab === 'kitchen' 
                ? (config.kitchen_printer_type || 'sunmi')
                : (config.cashier_printer_type || 'sunmi');
            return printerType === 'sunmi';
        } catch (err) {
            console.error("Failed to read printer config initially:", err);
            return true; // Default to true on error to remain silent
        }
    };

    const [isAutoPrinting, setIsAutoPrinting] = useState(getIsAutoPrintingInitial)
    const [printerConfig, setPrinterConfig] = useState({ kitchen_categories: [], bar_categories: [] });

    useEffect(() => {
        try {
            const stored = localStorage.getItem('onhaus_printer_config');
            if (stored) {
                setPrinterConfig(JSON.parse(stored));
            }
        } catch (e) {
            // ignore
        }
    }, []);

    // Determine initial payment method:
    // Check booking.payment_slip_url or booking.staff_remark
    const getInitialPaymentMethod = () => {
        if (booking.payment_slip_url) return 'qr'
        const remark = (booking.staff_remark || '').toLowerCase()
        if (remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน')) return 'qr'
        if (remark.includes('cash') || remark.includes('เงินสด')) return 'cash'
        return 'cash'
    }
    const [paymentMethod, setPaymentMethod] = useState(getInitialPaymentMethod)

    const [receiptShopName, setReceiptShopName] = useState('IN THE HAUS');
    const [receiptShopAddress, setReceiptShopAddress] = useState('');
    const [receiptShopPhone, setReceiptShopPhone] = useState('');
    const [receiptShopVat, setReceiptShopVat] = useState('');
    const [receiptShopLogoUrl, setReceiptShopLogoUrl] = useState('');
    const [receiptShopFooter, setReceiptShopFooter] = useState('THANK YOU FOR YOUR VISIT');

    const hasAutoPrintedRef = useRef(false);

    // Fetch Options mapping, QR settings, and execute SUNMI Auto Print
    useEffect(() => {
        const initAndAutoPrint = async () => {
            // 1. Fetch options mapping
            let currentOptionMap = {};
            let loadedConfig = {};
            try {
                const { data } = await supabase.from('option_choices').select('id, name')
                if (data) {
                    currentOptionMap = data.reduce((acc, opt) => ({ ...acc, [opt.id]: opt.name }), {})
                    setOptionMap(currentOptionMap)
                }
            } catch (err) {
                console.error("Failed to load options:", err)
            }

            // 2. Fetch all app settings (QR Code, Receipt Info)
            try {
                const { data } = await supabase.from('app_settings').select('*');
                if (data) {
                    const settingsMap = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    if (settingsMap.payment_qr_url) setQrCodeUrl(settingsMap.payment_qr_url);
                    if (settingsMap.receipt_shop_name) setReceiptShopName(settingsMap.receipt_shop_name);
                    if (settingsMap.receipt_shop_address) setReceiptShopAddress(settingsMap.receipt_shop_address);
                    if (settingsMap.receipt_shop_phone) setReceiptShopPhone(settingsMap.receipt_shop_phone);
                    if (settingsMap.receipt_shop_vat) setReceiptShopVat(settingsMap.receipt_shop_vat);
                    if (settingsMap.receipt_shop_logo_url) setReceiptShopLogoUrl(settingsMap.receipt_shop_logo_url);
                    if (settingsMap.receipt_shop_footer) setReceiptShopFooter(settingsMap.receipt_shop_footer);

                    loadedConfig = {
                        shopName: settingsMap.receipt_shop_name,
                        shopAddress: settingsMap.receipt_shop_address,
                        shopPhone: settingsMap.receipt_shop_phone,
                        shopVat: settingsMap.receipt_shop_vat,
                        shopLogoUrl: settingsMap.receipt_shop_logo_url,
                        shopFooter: settingsMap.receipt_shop_footer,
                        paymentQrUrl: settingsMap.payment_qr_url
                    };
                }
            } catch (err) {
                console.error("Failed to load app settings:", err);
            }

            // 3. Check printer configuration
            let printerType = 'sunmi';
            try {
                const stored = localStorage.getItem('onhaus_printer_config');
                if (stored) {
                    const config = JSON.parse(stored);
                    if (activeTab === 'kitchen') {
                        printerType = config.kitchen_printer_type || 'sunmi';
                    } else {
                        printerType = config.cashier_printer_type || 'sunmi';
                    }
                }
            } catch (err) {
                console.error("Failed to read printer config:", err);
            }

            // 4. SUNMI Auto Print (Guard with hasAutoPrintedRef to prevent duplicate triggers)
            if (printerType === 'sunmi') {
                if (hasAutoPrintedRef.current) return;
                hasAutoPrintedRef.current = true;

                setIsAutoPrinting(true);
                // Wait 400ms for stable render state
                await new Promise(resolve => setTimeout(resolve, 400));
                try {
                    let activePaperSize = '58mm';
                    try {
                        const stored = localStorage.getItem('onhaus_printer_config');
                        if (stored) {
                            const config = JSON.parse(stored);
                            if (config.paper_width) activePaperSize = config.paper_width;
                        }
                    } catch (e) {}

                    if (activeTab === 'kitchen') {
                        // Print Kitchen slip
                        const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'sunmi');
                        if (kitchenBytes) {
                            await printToSunmiBuiltIn(kitchenBytes);
                        }
                        
                        // Print Bar slip
                        const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'sunmi');
                        if (barBytes) {
                            await printToSunmiBuiltIn(barBytes);
                        }

                        // Print Other slip
                        const otherBytes = encodeReceiptData(booking, 'other', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'sunmi');
                        if (otherBytes) {
                            await printToSunmiBuiltIn(otherBytes);
                        }
                    } else {
                        const rawBytes = encodeReceiptData(booking, activeTab, paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'sunmi');
                        if (rawBytes) {
                            // QR code ONLY for billing tab (PromptPay before payment). NEVER on receipt tab after payment!
                            const qrToPrint = (activeTab === 'billing') ? loadedConfig.paymentQrUrl : null;
                            await printToSunmiBuiltIn(rawBytes, loadedConfig.shopLogoUrl, qrToPrint);
                        }
                    }
                    onClose();
                } catch (err) {
                    console.error("SUNMI Auto print failed:", err);
                    alert(`พิมพ์อัตโนมัติผ่าน SUNMI ล้มเหลว: ${err.message || err}\nระบบจะสลับมาแสดงหน้าตัวอย่างเพื่อให้กดยืนยันด้วยตนเอง`);
                    setIsAutoPrinting(false);
                }
            }
        };

        initAndAutoPrint();
    }, []);

    // Helper to get option names
    const getOptionName = (id) => optionMap[id] || id

    // Generate HTML for Print
    const getPrintHtml = () => {
        const dateStr = new Date(booking.booking_time).toLocaleString('th-TH')
        
        let staffName = ''
        try {
            const shift = JSON.parse(localStorage.getItem('pos_current_shift'))
            if (shift && shift.staffName) {
                staffName = shift.staffName
            }
        } catch (e) {
            console.error(e)
        }
        
        const kitchenCatIds = printerConfig.kitchen_categories || [];
        const barCatIds = printerConfig.bar_categories || [];
        
        let filteredItems = booking.order_items || [];
        if (kitchenCatIds.length === 0 && barCatIds.length === 0) {
            if (activeTab === 'kitchen') {
                filteredItems = filteredItems.filter(item => !BAR_CATEGORIES.includes(item.menu_items?.category_id));
            } else if (activeTab === 'bar') {
                filteredItems = filteredItems.filter(item => BAR_CATEGORIES.includes(item.menu_items?.category_id));
            }
        } else {
            if (activeTab === 'kitchen') {
                filteredItems = filteredItems.filter(item => kitchenCatIds.includes(item.menu_items?.category_id));
            } else if (activeTab === 'bar') {
                filteredItems = filteredItems.filter(item => barCatIds.includes(item.menu_items?.category_id));
            } else if (activeTab === 'other') {
                filteredItems = filteredItems.filter(item => !kitchenCatIds.includes(item.menu_items?.category_id) && !barCatIds.includes(item.menu_items?.category_id));
            }
        }

        // Sort items for kitchen, bar, and other to group by category first, then alphabetically by name
        if (activeTab === 'kitchen' || activeTab === 'bar' || activeTab === 'other') {
            filteredItems = [...filteredItems].sort((a, b) => {
                const catA = a.menu_items?.category_id || '';
                const catB = b.menu_items?.category_id || '';
                if (catA !== catB) return catA.localeCompare(catB);
                const nameA = a.menu_items?.name || '';
                const nameB = b.menu_items?.name || '';
                return nameA.localeCompare(nameB);
            });
        }

        // Items HTML
        const itemsHtml = filteredItems.map(item => {
            const name = item.menu_items?.name || 'Item'
            let optsHtml = ''
            
            if (item.selected_options) {
                let optionsList = []
                if (Array.isArray(item.selected_options)) {
                     optionsList = item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt)
                } else if (typeof item.selected_options === 'object') {
                    const ids = Object.values(item.selected_options).flat()
                    optionsList = ids.map(id => getOptionName(id))
                }
                if (optionsList.length > 0) {
                    optsHtml = optionsList.map(opt => `<div class="opt">+ ${opt}</div>`).join('')
                }
            }

            const price = (item.price_at_time * item.quantity).toLocaleString()

            // If kitchen or bar, format with bold boxed quantity, large font, and no price
            if (activeTab === 'kitchen' || activeTab === 'bar') {
                return `
                    <div class="item kitchen-item" style="border-bottom: 1px dashed black; padding-bottom: 6px; margin-bottom: 6px;">
                        <div class="row" style="font-size: 15px; font-weight: bold; display: flex; align-items: center;">
                            <span class="qty" style="font-size: 16px; background: black; color: white; padding: 2px 6px; border-radius: 4px; margin-right: 8px; flex-shrink: 0;">${item.quantity}x</span>
                            <span class="name" style="flex-grow: 1; text-transform: uppercase;">${name}</span>
                        </div>
                        ${optsHtml ? `<div class="opts" style="font-size: 11px; margin-left: 35px; font-weight: bold; color: black;">${optsHtml}</div>` : ''}
                    </div>
                `
            }

            // Customer Receipt: Show unit price calculation if quantity > 1
            const showUnitPrice = item.quantity > 1 
                ? `<div style="font-size: 9px; color: #555; margin-left: 25px; margin-top: 1px;">(${item.quantity} x ฿${item.price_at_time.toLocaleString()})</div>` 
                : '';

            return `
                <div class="item">
                    <div class="row">
                        <span class="qty">${item.quantity}</span>
                        <span class="name">${name}</span>
                        <span class="price">${price}</span>
                    </div>
                    ${showUnitPrice}
                    ${optsHtml ? `<div class="opts">${optsHtml}</div>` : ''}
                </div>
            `
        }).join('') || '<div class="empty">ไม่มีรายการสินค้า</div>'

        const discountHtml = (activeTab !== 'kitchen' && activeTab !== 'bar' && booking.discount_amount > 0) ? `
            <div class="row meta-row">
                <span>ส่วนลด (${booking.promotion_codes?.code || 'โปรโมชั่น'})</span>
                <span>-${booking.discount_amount.toLocaleString()}</span>
            </div>
        ` : ''

        const subtotal = booking.order_items?.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0) || 0;
        const discountVal = booking.discount_amount || 0;
        const netAfterDiscount = subtotal - discountVal;

        const vatVal = (booking.total_amount && Math.abs(booking.total_amount - (netAfterDiscount * 1.07)) < 1) 
            ? (netAfterDiscount * 0.07) 
            : 0;

        const vatHtml = vatVal > 0 ? `
            <div class="row"><span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span> <span>${vatVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
        ` : '';

        const totalQty = booking.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

        const totalsHtml = (activeTab !== 'kitchen' && activeTab !== 'bar') ? `
            <div class="totals">
                <div class="row"><span>จำนวนชิ้น (QTY)</span> <span>${totalQty}</span></div>
                <div class="row"><span>ยอดรวมก่อนหัก</span> <span>${subtotal.toLocaleString()}</span></div>
                ${discountHtml}
                ${vatHtml}
                <div class="row total-row" style="font-size: 15px; border-top: 1px dashed black; padding-top: 5px;">
                    <span>ยอดรวมทั้งสิ้น (TOTAL)</span>
                    <span>${booking.total_amount?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
            </div>
        ` : ''

        const noteHtml = (booking.customer_note && (activeTab === 'kitchen' || activeTab === 'bar')) ? `
            <div class="kitchen-note-box">
                <div class="kitchen-note-label">หมายเหตุ / NOTE FOR STAFF</div>
                ${booking.customer_note}
            </div>
        ` : ''

        // Dynamic title based on activeTab
        let docTitle = 'TICKET'
        let docHeader = receiptShopName || 'IN THE HAUS'
        if (activeTab === 'kitchen') {
            docTitle = 'KITCHEN ORDER / ใบสั่งอาหาร'
        } else if (activeTab === 'bar') {
            docTitle = 'BAR ORDER / ใบสั่งเครื่องดื่ม'
        } else if (activeTab === 'billing') {
            docTitle = 'BILLING SLIP / ใบแจ้งยอด'
        } else if (activeTab === 'receipt') {
            docTitle = 'RECEIPT / ใบเสร็จรับเงิน'
        }

        // QR Code Section HTML - ONLY for billing tab (PromptPay before payment)
        let qrSectionHtml = ''
        if (activeTab === 'billing' && qrCodeUrl) {
            qrSectionHtml = `
                <div class="qr-section">
                    <div class="qr-title">PROMPTPAY / สแกนชำระเงิน (พร้อมเพย์)</div>
                    <img src="${qrCodeUrl}" class="qr-img" alt="QR Code" />
                </div>
            `
        }

        // Payment Method / PAID Badge Section for Receipt
        let paymentMethodHtml = ''
        if (activeTab === 'receipt') {
            const methodLabel = paymentMethod === 'cash' 
                ? 'เงินสด' 
                : (paymentMethod === 'credit' ? 'บัตรเครดิต' : 'โอนเงินผ่าน QR')
            
            let cashChangeHtml = ''
            if (paymentMethod === 'cash') {
                const storedRecv = localStorage.getItem('last_cash_received');
                const storedChange = localStorage.getItem('last_cash_change');
                if (storedRecv !== null && storedChange !== null) {
                    const cashRecvVal = parseFloat(storedRecv).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    const cashChangeVal = parseFloat(storedChange).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    cashChangeHtml = `
                        <div style="font-size: 10px; margin-top: 6px; text-align: left; display: flex; flex-direction: column; gap: 2px; border-bottom: 1px dashed black; padding-bottom: 4px; margin-bottom: 4px;">
                            <div style="display: flex; justify-content: space-between;"><span>รับเงินสดมา:</span> <span>฿${cashRecvVal}</span></div>
                            <div style="display: flex; justify-content: space-between; font-weight: bold;"><span>เงินทอน:</span> <span>฿${cashChangeVal}</span></div>
                        </div>
                    `
                }
            }

            paymentMethodHtml = `
                <div class="payment-section">
                    <div class="payment-method">ช่องทางชำระเงิน: ${methodLabel}</div>
                    ${cashChangeHtml}
                    <div class="paid-badge">ชำระเงินแล้ว / PAID</div>
                </div>
            `
        }

        const queueNo = (booking.tracking_token && booking.tracking_token.length <= 8) ? booking.tracking_token : String(booking.id).slice(0, 4)

        return `
            <html>
                <head>
                    <title>${docTitle} #${queueNo}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;900&display=swap');

                        body { 
                            font-family: 'Courier Prime', 'Courier New', monospace; 
                            background: white; 
                            color: black; 
                            font-size: 11px; 
                            margin: 0; 
                            padding: 20px 10px;
                            width: 280px;
                        }
                        .brand { 
                            font-family: 'Inter', sans-serif; 
                            font-size: 24px; 
                            font-weight: 900; 
                            text-align: center; 
                            text-transform: uppercase; 
                            letter-spacing: -1px;
                            margin-bottom: 2px;
                            line-height: 1;
                        }
                        .tagline {
                            font-size: 8px;
                            text-align: center;
                            text-transform: uppercase;
                            letter-spacing: 2px;
                            margin-bottom: 10px;
                            border-bottom: 2px dashed black;
                            padding-bottom: 5px;
                        }
                        .ticket-title {
                            font-size: 12px;
                            font-weight: bold;
                            text-align: center;
                            margin-bottom: 10px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .center-flex { display: flex; justify-content: center; margin-bottom: 12px; }
                        .queue-box {
                            border: 2px solid black;
                            text-align: center;
                            padding: 4px 10px;
                            display: inline-block;
                        }
                        .queue-label {
                            font-size: 8px;
                            text-transform: uppercase;
                            color: #555;
                            margin-bottom: 2px;
                            font-weight: bold;
                        }
                        .queue-val {
                            font-size: 24px;
                            font-weight: 900;
                            line-height: 1;
                        }
                        .meta { border-top: 2px dashed black; border-bottom: 2px dashed black; padding: 8px 0; margin-bottom: 12px; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                        .label { color: #000; font-weight: bold; text-transform: uppercase; }
                        .val { font-weight: normal; text-align: right; }
                        
                        .items { margin-bottom: 12px; }
                        .item { margin-bottom: 8px; }
                        .qty { width: 25px; font-weight: bold; flex-shrink: 0; font-size: 11px; }
                        .name { flex-grow: 1; margin-right: 5px; font-weight: bold; text-transform: uppercase; }
                        .price { text-align: right; width: 60px; flex-shrink: 0; }
                        .opts { margin-left: 25px; margin-top: 2px; color: #555; font-size: 9px; font-style: italic; }

                        .totals { border-top: 2px solid black; padding-top: 8px; margin-bottom: 12px; }
                        .total-row { font-size: 14px; font-weight: bold; margin-top: 4px; }
                        
                        .kitchen-note-box { 
                            background: black; 
                            color: white; 
                            padding: 8px; 
                            margin-top: 10px; 
                            font-size: 11px; 
                            font-weight: bold;
                        }
                        .kitchen-note-label { 
                            font-size: 8px; 
                            border-bottom: 1px solid white; 
                            padding-bottom: 2px; 
                            margin-bottom: 4px; 
                            text-transform: uppercase;
                        }

                        .payment-section {
                            border-top: 2px dashed black;
                            padding: 8px 0;
                            text-align: center;
                            margin-bottom: 12px;
                        }
                        .payment-method {
                            font-size: 10px;
                            font-weight: bold;
                            text-transform: uppercase;
                        }
                        .paid-badge {
                            border: 2px solid black;
                            display: inline-block;
                            padding: 3px 10px;
                            font-size: 14px;
                            font-weight: 900;
                            text-transform: uppercase;
                            margin-top: 5px;
                            letter-spacing: 1px;
                        }

                        .qr-section {
                            text-align: center;
                            margin: 15px 0;
                            border-top: 1px dashed #ccc;
                            padding-top: 10px;
                        }
                        .qr-title {
                            font-size: 9px;
                            font-weight: bold;
                            margin-bottom: 5px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                        .qr-img {
                            width: 140px;
                            height: 140px;
                            object-fit: contain;
                        }

                        .footer { text-align: center; margin-top: 15px; font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #555; }
                        @media print { 
                            body { width: 100%; padding: 0; } 
                            .qr-img { width: 140px; height: 140px; }
                        }
                    </style>
                </head>
                <body>
                    <!-- Logo rendering if customer receipt -->
                    ${(activeTab !== 'kitchen' && activeTab !== 'bar' && receiptShopLogoUrl) ? `
                        <div style="text-align: center; margin-bottom: 8px;">
                            <img src="${receiptShopLogoUrl}" style="max-width: 140px; max-height: 80px; object-fit: contain;" />
                        </div>
                    ` : ''}

                    <div class="brand">${docHeader}</div>
                    <div class="tagline">TASTE YOUR SCENT.</div>

                    <!-- Shop metadata rendering if customer receipt -->
                    ${(activeTab !== 'kitchen' && activeTab !== 'bar' && (receiptShopAddress || receiptShopPhone || receiptShopVat)) ? `
                        <div style="text-align: center; font-size: 8px; line-height: 1.3; margin-bottom: 12px; border-bottom: 1px dashed black; padding-bottom: 8px; text-transform: uppercase;">
                            ${receiptShopAddress ? `<div style="margin-bottom: 2px;">${receiptShopAddress}</div>` : ''}
                            ${receiptShopPhone ? `<div style="margin-bottom: 2px;">Tel: ${receiptShopPhone}</div>` : ''}
                            ${receiptShopVat ? `<div>Tax ID: ${receiptShopVat}</div>` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="ticket-title">${docTitle}</div>

                    <div class="center-flex">
                        <div class="queue-box">
                            <div class="queue-label">TABLE / โต๊ะ</div>
                            <div class="queue-val">${booking.tables_layout?.table_name || 'PICKUP'}</div>
                        </div>
                    </div>
                    
                    <div class="meta">
                        <div class="row"><span class="label">หมายเลขคิว / QUEUE NO</span> <span class="val">#${queueNo}</span></div>
                        <div class="row"><span class="label">วันที่-เวลา / DATE</span> <span class="val">${dateStr}</span></div>
                        <div class="row"><span class="label">ลูกค้า / GUEST</span> <span class="val">${booking.profiles?.display_name || booking.pickup_contact_name || 'ลูกค้าทั่วไป (Walk-in)'}</span></div>
                        ${(booking.profiles?.phone_number || booking.pickup_contact_phone) ? `<div class="row"><span class="label">เบอร์โทร / PHONE</span> <span class="val">${booking.profiles?.phone_number || booking.pickup_contact_phone}</span></div>` : ''}
                        <!-- Cashier shift staff info if customer receipt -->
                        ${(activeTab !== 'kitchen' && activeTab !== 'bar' && staffName) ? `<div class="row"><span class="label">พนักงาน / STAFF</span> <span class="val">${staffName}</span></div>` : ''}
                    </div>

                    <div class="items">
                        ${itemsHtml}
                    </div>

                    ${totalsHtml}

                    ${paymentMethodHtml}

                    ${qrSectionHtml}

                    ${noteHtml}

                    <div class="footer">
                        ${receiptShopFooter || 'THANK YOU FOR YOUR VISIT'}
                    </div>

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `
    }

    const handlePrint = async () => {
        let printerType = 'sunmi';
        let btDeviceName = '';
        let paperSize = '58mm';
        
        try {
            const stored = localStorage.getItem('onhaus_printer_config');
            if (stored) {
                const config = JSON.parse(stored);
                if (activeTab === 'kitchen' || activeTab === 'bar' || activeTab === 'other') {
                    printerType = config.kitchen_printer_type || 'sunmi';
                    btDeviceName = config.kitchen_printer_bt_name || '';
                    paperSize = config.kitchen_paper_size || '58mm';
                } else {
                    printerType = config.cashier_printer_type || 'sunmi';
                    btDeviceName = config.cashier_printer_bt_name || '';
                    paperSize = config.cashier_paper_size || '58mm';
                }
            }
        } catch (err) {
            console.error("Failed to read printer config:", err);
        }

        const receiptConfig = {
            shopName: receiptShopName,
            shopAddress: receiptShopAddress,
            shopPhone: receiptShopPhone,
            shopVat: receiptShopVat,
            shopLogoUrl: receiptShopLogoUrl,
            shopFooter: receiptShopFooter
        };

        if (printerType === 'sunmi') {
            try {
                let activePaperSize = '58mm';
                try {
                    const stored = localStorage.getItem('onhaus_printer_config');
                    if (stored) {
                        const config = JSON.parse(stored);
                        if (config.paper_width) activePaperSize = config.paper_width;
                    }
                } catch (e) {}

                const rawBytes = encodeReceiptData(booking, activeTab, paymentMethod, optionMap, activePaperSize, receiptConfig, 'sunmi');
                if (rawBytes) {
                    const logoToPrint = (activeTab !== 'kitchen' && activeTab !== 'bar') ? receiptConfig.shopLogoUrl : null;
                    // QR code ONLY for billing tab (PromptPay before payment). NEVER on receipt tab after payment!
                    const qrToPrint = (activeTab === 'billing') ? qrCodeUrl : null;
                    await printToSunmiBuiltIn(rawBytes, logoToPrint, qrToPrint);
                } else {
                    toast.error("ไม่มีรายการสินค้าในหมวดหมู่นี้");
                }
                return; // successfully printed directly, exit
            } catch (err) {
                console.error("SUNMI print failed, falling back to standard dialog:", err);
                alert(`เกิดข้อผิดพลาดในการพิมพ์ผ่าน SUNMI: ${err.message || err}\nระบบจะสลับไปใช้หน้าต่างพิมพ์ของเครื่องแทน`);
            }
        } else if (printerType === 'rawbt') {
            try {
                const rawBytes = encodeReceiptData(booking, activeTab, paymentMethod, optionMap, paperSize, receiptConfig, 'rawbt');
                await printToRawBTWebSocket(rawBytes);
                return; // successfully printed directly, exit
            } catch (err) {
                console.error("RawBT print failed, falling back to standard dialog:", err);
                alert(`เกิดข้อผิดพลาดในการพิมพ์ผ่าน RawBT: ${err.message || err}\nระบบจะสลับไปใช้หน้าต่างพิมพ์ของเครื่องแทน`);
            }
        } else if (printerType === 'bluetooth') {
            try {
                const rawBytes = encodeReceiptData(booking, activeTab, paymentMethod, optionMap, paperSize, receiptConfig, 'bluetooth');
                await printToBluetoothDirect(btDeviceName, rawBytes);
                return; // successfully printed directly, exit
            } catch (err) {
                console.error("Direct bluetooth print failed, falling back to standard dialog:", err);
            }
        }

        const htmlContent = getPrintHtml()
        
        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Printer')) {
            try {
                await Printer.printHtml({
                    name: `Receipt-${booking.tracking_token || String(booking.id).slice(0, 4)}`,
                    html: htmlContent
                })
            } catch (err) {
                console.error("Native print failed, falling back to browser print:", err)
                fallbackBrowserPrint(htmlContent)
            }
        } else {
            fallbackBrowserPrint(htmlContent)
        }
    }

    const fallbackBrowserPrint = (htmlContent) => {
        const printWindow = window.open('', '_blank', 'width=400,height=600')
        if (printWindow) {
            printWindow.document.write(htmlContent)
            printWindow.document.close()
        } else {
            // Fallback for browsers that block popups
            const iframe = document.createElement('iframe')
            iframe.style.position = 'fixed'
            iframe.style.right = '0'
            iframe.style.bottom = '0'
            iframe.style.width = '0'
            iframe.style.height = '0'
            iframe.style.border = '0'
            document.body.appendChild(iframe)
            
            iframe.contentDocument.write(htmlContent)
            iframe.contentDocument.close()
            iframe.onload = () => {
                iframe.contentWindow.focus()
                iframe.contentWindow.print()
                setTimeout(() => {
                    document.body.removeChild(iframe)
                }, 1000)
            }
        }
    }

    const handleSaveImage = async () => {
        if (!slipRef.current) return
        setSaving(true)
        try {
            const dataUrl = await toPng(slipRef.current, { 
                cacheBust: true, 
                backgroundColor: '#ffffff', 
                pixelRatio: 3 
            })
            const link = document.createElement('a')
            link.href = dataUrl
            link.download = `${activeTab}-ticket-${String(booking.id).slice(0, 8)}.png`
            link.click()
        } catch (err) {
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    // Jagged Edge CSS (Simulated on Screen)
    const jaggedCss = `
        .ticket-visual {
            position: relative;
            background: #fff;
            filter: drop-shadow(0px 2px 10px rgba(0,0,0,0.1));
        }
        .ticket-visual::before, .ticket-visual::after {
            content: "";
            position: absolute;
            left: 0;
            width: 100%;
            height: 10px;
            background-size: 20px 20px;
            background-repeat: repeat-x;
        }
        .ticket-visual::before {
            top: -10px;
            background: radial-gradient(circle at 10px 15px, transparent 10px, #fff 11px);
            background-size: 20px 20px;
            transform: rotate(180deg);
        }
        .ticket-visual::after {
            bottom: -10px;
            background: radial-gradient(circle at 10px 15px, transparent 10px, #fff 11px);
            background-size: 20px 20px;
        }
    `

    const queueNo = (booking.tracking_token && booking.tracking_token.length <= 8) ? booking.tracking_token : String(booking.id).slice(0, 4)
    const dateStr = new Date(booking.booking_time).toLocaleString('th-TH')
    const subtotal = booking.order_items?.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0) || 0;

    useEffect(() => {
        if (type === 'kitchen') {
            let isSunmi = false;
            try {
                const stored = localStorage.getItem('onhaus_printer_config');
                if (stored) {
                    const config = JSON.parse(stored);
                    if (config.kitchen_printer_type === 'sunmi') {
                        isSunmi = true;
                    }
                }
            } catch (err) {}

            if (!isSunmi) {
                const timer = setTimeout(() => {
                    handlePrint();
                }, 600);
                return () => clearTimeout(timer);
            }
        }
    }, [type]);    if (isAutoPrinting) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <style>{jaggedCss}</style>
            <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-4 flex justify-between items-center text-[#1A1A1A] border-b border-[#D1D1CD]">
                    <h3 className="font-mono font-bold text-xs uppercase tracking-widest">Ticket Preview</h3>
                    <button onClick={onClose} className="p-2 hover:bg-[#E0E0DC] text-[#767673] hover:text-[#1A1A1A] rounded-full transition-colors"><X size={18} /></button>
                </div>

                {/* Interactive Tabs */}
                <div className="flex bg-[#E0E0DC] border border-[#D1D1CD] p-1 rounded-xl mx-4 mt-4 gap-1">
                    <button 
                        onClick={() => setActiveTab('kitchen')} 
                        className={`flex-1 py-2 rounded-lg font-mono font-bold text-[9px] uppercase tracking-wider transition-colors ${activeTab === 'kitchen' ? 'bg-white text-[#1A1A1A] border border-[#B0B0AC] shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                    >
                        ใบสั่งครัว (Kitchen)
                    </button>
                    <button 
                        onClick={() => setActiveTab('bar')} 
                        className={`flex-1 py-2 rounded-lg font-mono font-bold text-[9px] uppercase tracking-wider transition-colors ${activeTab === 'bar' ? 'bg-white text-[#1A1A1A] border border-[#B0B0AC] shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                    >
                        ใบสั่งบาร์ (Bar)
                    </button>
                    <button 
                        onClick={() => setActiveTab('other')} 
                        className={`flex-1 py-2 rounded-lg font-mono font-bold text-[9px] uppercase tracking-wider transition-colors ${activeTab === 'other' ? 'bg-white text-[#1A1A1A] border border-[#B0B0AC] shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                    >
                        ใบสั่งอื่นๆ (Other)
                    </button>
                    <button 
                        onClick={() => setActiveTab('billing')} 
                        className={`flex-1 py-2 rounded-lg font-mono font-bold text-[9px] uppercase tracking-wider transition-colors ${activeTab === 'billing' ? 'bg-white text-[#1A1A1A] border border-[#B0B0AC] shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                    >
                        ใบแจ้งยอด (Bill)
                    </button>
                    <button 
                        onClick={() => setActiveTab('receipt')} 
                        className={`flex-1 py-2 rounded-lg font-mono font-bold text-[9px] uppercase tracking-wider transition-colors ${activeTab === 'receipt' ? 'bg-white text-[#1A1A1A] border border-[#B0B0AC] shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                    >
                        ใบเสร็จ (Receipt)
                    </button>
                </div>

                {/* Payment Method Selector (Only for Billing / Receipt tabs) */}
                {(activeTab === 'billing' || activeTab === 'receipt') && (
                    <div className="flex items-center justify-between bg-white border border-[#D1D1CD] p-3 rounded-xl mx-4 mt-3">
                        <span className="text-[10px] font-mono font-bold text-[#767673] uppercase tracking-wider">ช่องทางชำระเงิน / Payment:</span>
                        <div className="flex gap-1.5">
                            <button 
                                onClick={() => setPaymentMethod('cash')}
                                className={`px-2 py-1.5 rounded-lg font-mono font-bold text-[9px] uppercase tracking-wider transition-colors ${paymentMethod === 'cash' ? 'bg-[#ff0000] text-white border border-[#c00000]' : 'bg-[#F5F5F2] border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] hover:border-[#B0B0AC]'}`}
                            >
                                เงินสด (CASH)
                            </button>
                            <button 
                                onClick={() => setPaymentMethod('qr')}
                                className={`px-2 py-1.5 rounded-lg font-mono font-bold text-[9px] uppercase tracking-wider transition-colors ${paymentMethod === 'qr' ? 'bg-[#ff0000] text-white border border-[#c00000]' : 'bg-[#F5F5F2] border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] hover:border-[#B0B0AC]'}`}
                            >
                                โอนเงิน (QR)
                            </button>
                            <button 
                                onClick={() => setPaymentMethod('credit')}
                                className={`px-2 py-1.5 rounded-lg font-mono font-bold text-[9px] uppercase tracking-wider transition-colors ${paymentMethod === 'credit' ? 'bg-[#ff0000] text-white border border-[#c00000]' : 'bg-[#F5F5F2] border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] hover:border-[#B0B0AC]'}`}
                            >
                                บัตร (CREDIT)
                            </button>
                        </div>
                    </div>
                )}

                {/* Preview Window */}
                <div className="flex-1 overflow-y-auto py-6 px-4 bg-[#ECECE9] border-t border-b border-[#D1D1CD] flex flex-col items-center mt-4">
                    <div 
                        ref={slipRef} 
                        className="ticket-visual bg-[#fdfdfd] text-black pt-8 pb-10 px-8 w-[340px] origin-top mt-4 mb-6"
                        style={{ fontFamily: "'Courier Prime', 'Courier New', monospace" }}
                    >
                        {/* BRAND HEADER (Hide for kitchen/bar order to make it neat) */}
                        {activeTab !== 'kitchen' && activeTab !== 'bar' ? (
                            <div className="text-center mb-5 flex flex-col items-center">
                                {/* Logo */}
                                <img src="/receipt-logo.png" alt="Logo" className="w-24 h-auto mb-3 object-contain contrast-125" />
                                
                                <p className="text-[9px] font-bold tracking-widest uppercase mb-4 border-b border-dashed border-black pb-3 w-full text-center">
                                    TASTE YOUR SCENT.
                                </p>
                            </div>
                        ) : activeTab === 'kitchen' ? (
                            <div className="text-center mb-5 bg-black text-white py-2 font-bold text-sm tracking-widest">
                                KITCHEN ORDER / ใบสั่งอาหาร
                            </div>
                        ) : (
                            <div className="text-center mb-5 bg-black text-white py-2 font-bold text-sm tracking-widest">
                                BAR ORDER / ใบสั่งเครื่องดื่ม
                            </div>
                        )}

                        {/* Prominent Table Name */}
                        <div className="text-center mb-5">
                            <div className="inline-block border-2 border-black rounded-md px-6 py-2">
                                <span className="text-sm font-bold block leading-none text-gray-500 uppercase tracking-wider text-[8px] mb-1">TABLE / โต๊ะ</span>
                                <span className="text-3xl font-black leading-none block">
                                    {booking.tables_layout?.table_name || 'PICKUP'}
                                </span>
                            </div>
                        </div>

                        {/* Meta Grid */}
                        <div className="grid grid-cols-2 gap-y-1.5 text-[10px] font-bold border-b-2 border-dashed border-black pb-4 mb-4">
                            <div className="text-gray-500">QUEUE NO.</div>
                            <div className="text-right font-mono">#{queueNo}</div>
                            
                            <div className="text-gray-500">DATE</div>
                            <div className="text-right">{dateStr}</div>
                            
                            <div className="text-gray-500">GUEST</div>
                            <div className="text-right truncate">{booking.profiles?.display_name || booking.pickup_contact_name || 'Guest'}</div>

                            {(booking.profiles?.phone_number || booking.pickup_contact_phone) && (
                                <>
                                    <div className="text-gray-500">PHONE</div>
                                    <div className="text-right">{booking.profiles?.phone_number || booking.pickup_contact_phone}</div>
                                </>
                            )}
                        </div>

                        {/* Items */}
                        <div className="space-y-3 mb-5">
                            <div className="text-[9px] font-black uppercase tracking-widest text-right mb-1 opacity-55">
                                {activeTab === 'kitchen' ? 'KITCHEN ITEMS' : activeTab === 'bar' ? 'BAR ITEMS' : activeTab === 'other' ? 'OTHER ITEMS' : '01. ITEMS'}
                            </div>
                            {booking.order_items?.filter(item => {
                                const categoryId = item.menu_items?.category_id;
                                const kitchenCatIds = printerConfig.kitchen_categories || [];
                                const barCatIds = printerConfig.bar_categories || [];

                                if (kitchenCatIds.length === 0 && barCatIds.length === 0) {
                                    if (activeTab === 'kitchen') return !BAR_CATEGORIES.includes(categoryId);
                                    if (activeTab === 'bar') return BAR_CATEGORIES.includes(categoryId);
                                } else {
                                    if (activeTab === 'kitchen') return kitchenCatIds.includes(categoryId);
                                    if (activeTab === 'bar') return barCatIds.includes(categoryId);
                                    if (activeTab === 'other') return !kitchenCatIds.includes(categoryId) && !barCatIds.includes(categoryId);
                                }
                                return true;
                            }).map((item, idx) => {
                                let optionsList = []
                                if (Array.isArray(item.selected_options)) {
                                     optionsList = item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt)
                                } else if (typeof item.selected_options === 'object') {
                                    optionsList = Object.values(item.selected_options).flat().map(id => optionMap[id] || id)
                                }
                                
                                return (
                                    <div key={idx} className="text-xs">
                                        <div className="flex justify-between font-bold items-baseline gap-2 mb-0.5">
                                            <span className="w-6 shrink-0 text-sm font-black">{item.quantity}x</span>
                                            <span className="grow font-bold uppercase text-[13px] tracking-tight leading-4">{item.menu_items?.name || 'Item'}</span>
                                            {activeTab !== 'kitchen' && activeTab !== 'bar' && activeTab !== 'other' && (
                                                <span className="shrink-0 font-mono font-normal">{(item.price_at_time * item.quantity).toLocaleString()}</span>
                                            )}
                                        </div>
                                        {optionsList.length > 0 && (
                                            <div className="pl-6 space-y-0.5 text-[9px] text-gray-500 font-medium italic border-l border-gray-200 ml-1 pl-2">
                                                {optionsList.map((opt, i) => <div key={i}>+ {opt}</div>)}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Totals (Hide for kitchen/bar) */}
                        {activeTab !== 'kitchen' && activeTab !== 'bar' && (
                            <div className="border-t-2 border-black pt-3.5 mb-4">
                                <div className="flex justify-between text-xs mb-1 font-bold text-gray-500">
                                    <span>SUBTOTAL</span>
                                    <span>{subtotal.toLocaleString()}</span>
                                </div>
                                 {booking.discount_amount > 0 && (
                                    <div className="flex justify-between text-xs mb-1 font-bold text-green-600">
                                        <span>DISCOUNT</span>
                                        <span>-{booking.discount_amount.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-end border-t border-dashed border-black/30 pt-2">
                                    <span className="font-black text-xs uppercase tracking-wider">TOTAL AMOUNT</span>
                                    <span className="font-black text-xl leading-none">{booking.total_amount?.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Payment Details Section (Only for Receipt) */}
                        {activeTab === 'receipt' && (
                            <div className="border-t-2 border-dashed border-black py-4 my-2 text-center flex flex-col items-center">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                                    Payment Method: {paymentMethod === 'cash' ? 'CASH / เงินสด' : (paymentMethod === 'credit' ? 'CREDIT CARD / บัตรเครดิต' : 'QR TRANSFER / โอนเงินผ่าน QR')}
                                </div>
                                <div className="border-4 border-double border-black rounded-lg py-1.5 px-6 font-black text-sm text-black uppercase tracking-widest transform -rotate-2 mt-3 select-none">
                                    PAID / ชำระแล้ว
                                </div>
                            </div>
                        )}

                        {/* PromptPay QR Code (For Billing always, and Receipt optionally as requested) */}
                        {(activeTab === 'billing' || (activeTab === 'receipt' && paymentMethod === 'qr')) && qrCodeUrl && (
                            <div className={`border-t border-dashed border-black/40 pt-4 mt-4 text-center flex flex-col items-center ${activeTab === 'receipt' ? 'opacity-70' : ''}`}>
                                <span className="text-[9px] font-black tracking-widest uppercase mb-2">
                                    {activeTab === 'billing' ? 'SCAN TO PAY / สแกนชำระเงิน' : 'SHOP QR CODE / คิวอาร์โค้ดร้านค้า'}
                                </span>
                                <img src={qrCodeUrl} alt="PromptPay QR" className="w-36 h-36 object-contain rounded-xl border border-gray-100 p-2 bg-white" />
                                <span className="text-[8px] text-gray-400 font-mono mt-1">IN THE HAUS PROMPTPAY</span>
                            </div>
                        )}

                        {/* Note for Kitchen (Always show if present, formatted beautifully) */}
                        {booking.customer_note && (
                            <div className="bg-black text-white p-3 font-mono text-[10px] relative mt-4">
                                <div className="absolute -top-2 left-2 bg-black px-1 text-[8px] font-bold uppercase tracking-wider">Note for Kitchen</div>
                                {booking.customer_note}
                            </div>
                        )}
                        
                        {/* Footer */}
                        <div className="text-center mt-6 space-y-0.5">
                            <div className="text-[9px] font-black tracking-[0.2em] uppercase">INTHEHAUS</div>
                            <div className="text-[8px] font-mono text-gray-400">THANK YOU FOR YOUR VISIT</div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-[#F5F5F2] flex gap-3 border-t border-[#D1D1CD]">
                    <button onClick={handlePrint} className="flex-1 bg-[#ff0000] hover:bg-[#c00000] text-white py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
                        <PrinterIcon size={14} /> Print Ticket
                    </button>
                    <button onClick={handleSaveImage} className="flex-grow bg-white border border-[#D1D1CD] text-[#1A1A1A] hover:bg-[#E0E0DC] py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer" disabled={saving}>
                        {saving ? 'Saving...' : <><Download size={14} /> Save Image</>}
                    </button>
                </div>
            </div>
        </div>
    )
}
