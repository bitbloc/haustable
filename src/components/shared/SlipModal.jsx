import { useRef, useState, useEffect } from 'react'
import { X, Printer as PrinterIcon, Download, Check, Copy } from 'lucide-react'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabaseClient'
import { Capacitor } from '@capacitor/core'
import { printToBluetoothDirect, encodeReceiptData, printToRawBTWebSocket, printToSunmiBuiltIn, getCleanStaffRemark, getCleanCustomerNote, generateDivider, resolveStaffDisplayName, selectItemsForTab, getShortBookingId, resolveBillingQrCode, extractCashDetails, normalizePromptPayId, getStorePromptpayId, getStorePromptpayName, formatPromptpayDisplay } from '../../utils/printerHelper'
import { formatOrderItemOptions } from '../../utils/menuHelper'
import { parseTableTransferInfo } from '../../utils/tableTransferHelper'

const BAR_CATEGORIES = [
    '7524bb8a-4698-45c6-aa17-d8ccc296f667', // Coffee
    '912683ef-fdc3-40a3-8dd8-b09507791240', // Soft Drink
    'b441665e-2f23-4df3-a11d-63485e1690dc', // Beer
    'a2c783fc-975b-4779-b9eb-67391eeafd1f', // Alcohol
    '1983955d-5787-4351-b729-51b95761f125', // Mocktail & Cocktail
    '1407d869-4eed-489e-aeeb-ba7ef19f57bd', // Bottled
    '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'  // PRO Beer
];

export default function SlipModal({ booking, type, isAdmin = false, onClose }) {
    const slipRef = useRef(null)
    const [saving, setSaving] = useState(false)
    const [isPrinting, setIsPrinting] = useState(false)
    const [optionMap, setOptionMap] = useState({})
    const [qrCodeUrl, setQrCodeUrl] = useState(null)
    const [storePromptpayId, setStorePromptpayId] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('promptpay_id') : null) || '0614232455')
    const [storePromptpayName, setStorePromptpayName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('promptpay_name') : null) || 'ธัญญธร ศรีวิเศษ')
    // Determine initial tab:
    // If isAdmin: only 'billing' or 'receipt'
    // If type === 'kitchen', default to kitchen (non-admin).
    // Else if status === 'completed', default to receipt.
    // Else, default to billing.
    const getInitialTab = () => {
        if (isAdmin) {
            const isPaid = booking?.status === 'completed' || booking?.status === 'paid' || booking?.status === 'success'
            return (type === 'receipt' || isPaid) ? 'receipt' : 'billing'
        }
        if (type === 'kitchen') return 'kitchen'
        if (booking?.status === 'completed' || booking?.status === 'paid' || booking?.status === 'success') return 'receipt'
        return 'billing'
    }
    const [activeTab, setActiveTab] = useState(getInitialTab)
    const isKitchenTab = !isAdmin && (activeTab === 'kitchen' || activeTab === 'bar' || activeTab === 'other' || activeTab === 'kitchen_all');

    const getIsAutoPrintingInitial = () => {
        if (isAdmin) return false;
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
    const [printerConfig, setPrinterConfig] = useState(() => {
        try {
            const stored = localStorage.getItem('onhaus_printer_config');
            if (stored) return JSON.parse(stored);
        } catch (e) {}
        return { kitchen_categories: [], bar_categories: [] };
    });

    useEffect(() => {
        const loadOnlineConfig = async () => {
            try {
                const stored = localStorage.getItem('onhaus_printer_config');
                if (stored) {
                    setPrinterConfig(JSON.parse(stored));
                }
            } catch (e) {}

            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('key, value');

                if (data && data.length > 0) {
                    const settingsMap = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    
                    let onlineConfig = {};
                    if (settingsMap.printer_config) {
                        try {
                            onlineConfig = JSON.parse(settingsMap.printer_config);
                        } catch(e) {}
                    }

                    if (settingsMap.receipt_shop_footer) {
                        onlineConfig.shop_footer_text = settingsMap.receipt_shop_footer;
                        setReceiptShopFooter(settingsMap.receipt_shop_footer);
                        localStorage.setItem('receipt_shop_footer', settingsMap.receipt_shop_footer);
                    }
                    if (settingsMap.receipt_shop_name) setReceiptShopName(settingsMap.receipt_shop_name);
                    if (settingsMap.receipt_shop_address) setReceiptShopAddress(settingsMap.receipt_shop_address);
                    if (settingsMap.receipt_shop_phone) setReceiptShopPhone(settingsMap.receipt_shop_phone);
                    if (settingsMap.receipt_shop_vat) setReceiptShopVat(settingsMap.receipt_shop_vat);
                    if (settingsMap.receipt_shop_logo_url) setReceiptShopLogoUrl(settingsMap.receipt_shop_logo_url);

                    setPrinterConfig(onlineConfig);
                    localStorage.setItem('onhaus_printer_config', JSON.stringify(onlineConfig));
                }
            } catch (e) {}
        };
        loadOnlineConfig();
    }, []);

    // Determine initial payment method:
    // Check booking.payment_slip_url or booking.staff_remark
    const getInitialPaymentMethod = () => {
        if (booking?.payment_slip_url) return 'qr'
        const remark = (booking?.staff_remark || '').toLowerCase()
        if (remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน')) return 'qr'
        if (remark.includes('cash') || remark.includes('เงินสด')) return 'cash'
        return 'cash'
    }
    const [paymentMethod, setPaymentMethod] = useState(getInitialPaymentMethod)

    const getStoredShopSetting = (key, fallback = '') => {
        try {
            const val = localStorage.getItem(key);
            if (val) return val;
            const configStored = localStorage.getItem('onhaus_printer_config');
            if (configStored) {
                const parsed = JSON.parse(configStored);
                if (key === 'receipt_shop_footer' && (parsed.shop_footer_text || parsed.shopFooter || parsed.receipt_shop_footer)) {
                    return parsed.shop_footer_text || parsed.shopFooter || parsed.receipt_shop_footer;
                }
            }
        } catch (e) {}
        return fallback;
    };

    const [receiptShopName, setReceiptShopName] = useState(() => getStoredShopSetting('receipt_shop_name', 'IN THE HAUS'));
    const [receiptShopAddress, setReceiptShopAddress] = useState(() => getStoredShopSetting('receipt_shop_address', ''));
    const [receiptShopPhone, setReceiptShopPhone] = useState(() => getStoredShopSetting('receipt_shop_phone', ''));
    const [receiptShopVat, setReceiptShopVat] = useState(() => getStoredShopSetting('receipt_shop_vat', ''));
    const [receiptShopLogoUrl, setReceiptShopLogoUrl] = useState(() => getStoredShopSetting('receipt_shop_logo_url', ''));
    const [receiptShopFooter, setReceiptShopFooter] = useState(() => getStoredShopSetting('receipt_shop_footer', ''));

    // Real-time subscription to sync receipt settings and printer config instantly across all machines
    useEffect(() => {
        const channel = supabase
            .channel('realtime_app_settings_slip')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_settings' },
                async (payload) => {
                    if (payload.new) {
                        if (payload.new.key === 'printer_config' && payload.new.value) {
                            try {
                                const updated = JSON.parse(payload.new.value);
                                setPrinterConfig(updated);
                                localStorage.setItem('onhaus_printer_config', payload.new.value);
                            } catch(e) {}
                        } else if (payload.new.key === 'receipt_shop_name') {
                            setReceiptShopName(payload.new.value || 'IN THE HAUS');
                        } else if (payload.new.key === 'receipt_shop_address') {
                            setReceiptShopAddress(payload.new.value || '');
                        } else if (payload.new.key === 'receipt_shop_phone') {
                            setReceiptShopPhone(payload.new.value || '');
                        } else if (payload.new.key === 'receipt_shop_vat') {
                            setReceiptShopVat(payload.new.value || '');
                        } else if (payload.new.key === 'receipt_shop_logo_url') {
                            setReceiptShopLogoUrl(payload.new.value || '');
                        } else if (payload.new.key === 'receipt_shop_footer') {
                            setReceiptShopFooter(payload.new.value || 'THANK YOU FOR YOUR VISIT');
                        } else if (payload.new.key === 'payment_qr_url') {
                            setQrCodeUrl(payload.new.value || '');
                        } else if (['promptpay_id', 'receipt_shop_phone'].includes(payload.new.key) && payload.new.value) {
                            const norm = normalizePromptPayId(payload.new.value);
                            setStorePromptpayId(norm);
                            try { localStorage.setItem('promptpay_id', norm); } catch (e) {}
                            if (activeTab === 'billing' && booking) {
                                resolveBillingQrCode(booking, { promptpay_id: norm }).then(qr => { if (qr) setQrCodeUrl(qr); });
                            }
                        } else if (['promptpay_name', 'receipt_promptpay_name'].includes(payload.new.key) && payload.new.value) {
                            setStorePromptpayName(payload.new.value);
                            try { localStorage.setItem('promptpay_name', payload.new.value); } catch (e) {}
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);


    const hasAutoPrintedRef = useRef(false);

    // Keep dynamic PromptPay QR code in sync whenever activeTab is billing or booking total updates
    useEffect(() => {
        if (activeTab === 'billing' && booking) {
            resolveBillingQrCode(booking, printerConfig).then(qr => {
                if (qr) setQrCodeUrl(qr);
            }).catch(err => {
                console.error("Error refreshing billing QR:", err);
            });
        }
    }, [activeTab, booking?.id, booking?.total_amount, booking?.deposit_amount]);

    // Fetch Options mapping, QR settings, and execute SUNMI Auto Print
    useEffect(() => {
        const initAndAutoPrint = async () => {
            // 1. Fetch options mapping and app settings in parallel for speed
            let currentOptionMap = {};
            let loadedConfig = {};
            let qrUrlForBilling = null;

            try {
                const [optionsRes, settingsRes] = await Promise.all([
                    supabase.from('option_choices').select('id, name'),
                    supabase.from('app_settings').select('key, value').not('key', 'in', '("tax_signature_image")')
                ]);

                if (optionsRes.data) {
                    currentOptionMap = optionsRes.data.reduce((acc, opt) => ({ ...acc, [opt.id]: opt.name }), {});
                    setOptionMap(currentOptionMap);
                }

                if (settingsRes.data) {
                    const settingsMap = settingsRes.data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    
                    const resolvedPpId = getStorePromptpayId(settingsMap);
                    setStorePromptpayId(resolvedPpId);
                    const resolvedPpName = getStorePromptpayName(settingsMap);
                    setStorePromptpayName(resolvedPpName);

                    if (activeTab === 'billing') {
                        qrUrlForBilling = await resolveBillingQrCode(booking, settingsMap);
                        if (qrUrlForBilling) setQrCodeUrl(qrUrlForBilling);
                    } else if (settingsMap.payment_qr_url) {
                        setQrCodeUrl(settingsMap.payment_qr_url);
                    }

                    if (settingsMap.receipt_shop_name) setReceiptShopName(settingsMap.receipt_shop_name);
                    if (settingsMap.receipt_shop_address) setReceiptShopAddress(settingsMap.receipt_shop_address);
                    if (settingsMap.receipt_shop_phone) setReceiptShopPhone(settingsMap.receipt_shop_phone);
                    if (settingsMap.receipt_shop_vat) setReceiptShopVat(settingsMap.receipt_shop_vat);
                    if (settingsMap.receipt_shop_logo_url) setReceiptShopLogoUrl(settingsMap.receipt_shop_logo_url);
                    if (settingsMap.receipt_shop_footer) setReceiptShopFooter(settingsMap.receipt_shop_footer);

                    let currentPrinterConfig = {};
                    try {
                        const stored = localStorage.getItem('onhaus_printer_config');
                        if (stored) currentPrinterConfig = JSON.parse(stored);
                    } catch (e) {}

                    loadedConfig = {
                        shopName: settingsMap.receipt_shop_name,
                        shopAddress: settingsMap.receipt_shop_address,
                        shopPhone: settingsMap.receipt_shop_phone,
                        shopVat: settingsMap.receipt_shop_vat,
                        shopLogoUrl: settingsMap.receipt_shop_logo_url,
                        shopFooter: settingsMap.receipt_shop_footer,
                        paymentQrUrl: qrUrlForBilling || settingsMap.payment_qr_url,
                        divider_style: currentPrinterConfig.divider_style || printerConfig.divider_style || 'dashed',
                        footer_ascii_art: currentPrinterConfig.footer_ascii_art || printerConfig.footer_ascii_art || '',
                        kitchen_categories: currentPrinterConfig.kitchen_categories || printerConfig.kitchen_categories || [],
                        bar_categories: currentPrinterConfig.bar_categories || printerConfig.bar_categories || []
                    };
                }
            } catch (err) {
                console.error("Failed to load options/settings:", err);
            }

            // 3. Skip Auto Print completely if in Admin Mode
            if (isAdmin) {
                return;
            }

            // 4. Check printer configuration
            let printerType = 'sunmi';
            try {
                const stored = localStorage.getItem('onhaus_printer_config');
                if (stored) {
                    const config = JSON.parse(stored);
                    if (activeTab === 'kitchen' || activeTab === 'bar' || activeTab === 'other' || activeTab === 'kitchen_all') {
                        printerType = config.kitchen_printer_type || 'sunmi';
                    } else {
                        printerType = config.cashier_printer_type || 'sunmi';
                    }
                }
            } catch (err) {
                console.error("Failed to read printer config:", err);
            }

            // 4. Auto Print (Guard with hasAutoPrintedRef to prevent duplicate triggers)
            if (printerType === 'sunmi') {
                if (hasAutoPrintedRef.current) return;
                hasAutoPrintedRef.current = true;

                setIsAutoPrinting(true);
                try {
                    let activePaperSize = printerConfig.kitchen_paper_size || printerConfig.paper_width || '80mm';
                    if (activeTab === 'kitchen') {
                        let printedAny = false;
                        const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'sunmi');
                        if (kitchenBytes) {
                            await printToSunmiBuiltIn(kitchenBytes);
                            printedAny = true;
                        }
                        
                        const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'sunmi');
                        if (barBytes) {
                            await printToSunmiBuiltIn(barBytes);
                            printedAny = true;
                        }

                        if (!printedAny) {
                            const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'sunmi');
                            if (allBytes) {
                                await printToSunmiBuiltIn(allBytes);
                            }
                        }
                    } else {
                        const rawBytes = encodeReceiptData(booking, activeTab, paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'sunmi');
                        if (rawBytes) {
                            const qrToPrint = (activeTab === 'billing') ? (loadedConfig.paymentQrUrl || qrCodeUrl) : null;
                            const logoToPrint = (activeTab !== 'kitchen' && activeTab !== 'bar' && activeTab !== 'other' && activeTab !== 'kitchen_all') ? (loadedConfig.shopLogoUrl || `${window.location.origin}/logo.png`) : null;
                            await printToSunmiBuiltIn(rawBytes, logoToPrint, qrToPrint);
                        }
                    }
                    onClose();
                } catch (err) {
                    console.error("SUNMI Auto print failed:", err);
                    alert(`พิมพ์อัตโนมัติผ่าน SUNMI ล้มเหลว: ${err.message || err}\nระบบจะสลับมาแสดงหน้าตัวอย่างเพื่อให้กดยืนยันด้วยตนเอง`);
                    setIsAutoPrinting(false);
                }
            } else if (printerType === 'rawbt') {
                if (hasAutoPrintedRef.current) return;
                hasAutoPrintedRef.current = true;
                setIsAutoPrinting(true);
                try {
                    let activePaperSize = printerConfig.kitchen_paper_size || printerConfig.paper_width || '80mm';
                    if (activeTab === 'kitchen') {
                        let printedAny = false;
                        const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'rawbt');
                        if (kitchenBytes) {
                            await printToRawBTWebSocket(kitchenBytes);
                            printedAny = true;
                        }
                        const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'rawbt');
                        if (barBytes) {
                            await printToRawBTWebSocket(barBytes);
                            printedAny = true;
                        }
                        if (!printedAny) {
                            const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'rawbt');
                            if (allBytes) {
                                await printToRawBTWebSocket(allBytes);
                            }
                        }
                    } else {
                        const rawBytes = encodeReceiptData(booking, activeTab, paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'rawbt');
                        if (rawBytes) {
                            await printToRawBTWebSocket(rawBytes);
                        }
                    }
                    onClose();
                } catch (err) {
                    console.error("RawBT Auto print failed:", err);
                    setIsAutoPrinting(false);
                }
            } else if (printerType === 'bluetooth') {
                if (hasAutoPrintedRef.current) return;
                hasAutoPrintedRef.current = true;
                setIsAutoPrinting(true);
                try {
                    let activePaperSize = printerConfig.kitchen_paper_size || printerConfig.paper_width || '80mm';
                    const btDeviceName = printerConfig.bluetooth_device_name || '';
                    if (activeTab === 'kitchen') {
                        let printedAny = false;
                        const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'bluetooth');
                        if (kitchenBytes) {
                            await printToBluetoothDirect(btDeviceName, kitchenBytes);
                            printedAny = true;
                        }
                        const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'bluetooth');
                        if (barBytes) {
                            await printToBluetoothDirect(btDeviceName, barBytes);
                            printedAny = true;
                        }
                        if (!printedAny) {
                            const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'bluetooth');
                            if (allBytes) {
                                await printToBluetoothDirect(btDeviceName, allBytes);
                            }
                        }
                    } else {
                        const rawBytes = encodeReceiptData(booking, activeTab, paymentMethod, currentOptionMap, activePaperSize, loadedConfig, 'bluetooth');
                        if (rawBytes) {
                            await printToBluetoothDirect(btDeviceName, rawBytes);
                        }
                    }
                    onClose();
                } catch (err) {
                    console.error("Bluetooth Auto print failed:", err);
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
        const transfer = parseTableTransferInfo(booking);
        const orderPlacedAtRaw = booking.created_at || booking.order_time || (booking.booking_type !== 'dine_in' && booking.booking_type !== 'pickup' ? booking.booking_time : null) || new Date().toISOString()
        const orderPlacedStr = new Date(orderPlacedAtRaw).toLocaleString('th-TH', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        })
        const formattedBookingTimeStr = new Date(booking.booking_time || Date.now()).toLocaleString('th-TH', { 
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        })
        
        let staffName = resolveStaffDisplayName(booking);
        
        const kitchenCatIds = printerConfig.kitchen_categories || [];
        const barCatIds = printerConfig.bar_categories || [];
        
        let isSeparateBarPrinterEnabled = !!(printerConfig.separate_bar_printer || printerConfig.bar_printer_ip);

        let filteredItems = selectItemsForTab(booking.order_items || [], activeTab, printerConfig);

        const isKitchen = activeTab === 'kitchen' || activeTab === 'bar' || activeTab === 'other' || activeTab === 'kitchen_all';

        // Sort items for kitchen, bar, and other to group by category first, then alphabetically by name
        if (isKitchen) {
            filteredItems = [...filteredItems].sort((a, b) => {
                const catA = a.menu_items?.category_id || a.category_id || '';
                const catB = b.menu_items?.category_id || b.category_id || '';
                if (catA !== catB) return catA.localeCompare(catB);
                const nameA = a.custom_name || a.name || a.menu_items?.name || '';
                const nameB = b.custom_name || b.name || b.menu_items?.name || '';
                return nameA.localeCompare(nameB);
            });
        }

        // Items HTML
        const itemsHtml = filteredItems.map(item => {
            const name = item.custom_name || item.name || item.menu_items?.name || 'Item'
            let optsHtml = ''
            
            if (item.selected_options || item.item_note) {
                let optionsList = []
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
                         return getOptionName(opt);
                     });
                } else if (typeof item.selected_options === 'object' && item.selected_options !== null) {
                    optionsList = Object.entries(item.selected_options).flatMap(([key, val]) => {
                        if (Array.isArray(val)) {
                            return val.map(id => getOptionName(id));
                        }
                        return [`${key}: ${val}`];
                    });
                }

                if (item.item_note && !optionsList.some(o => String(o).includes(item.item_note))) {
                    optionsList.push(`หมายเหตุ: ${item.item_note}`);
                }

                if (optionsList.length > 0) {
                    optsHtml = optionsList.map(opt => `<div class="opt" style="font-weight: bold; ${isKitchen ? 'font-size: 15px; margin-top: 3px;' : 'font-size: 10px;'} padding-left: 12px;">▶ ${opt}</div>`).join('')
                }
            }

            const price = (item.price_at_time * item.quantity).toLocaleString()

            // If kitchen or bar, format with bold boxed quantity, large font, and no price
            if (isKitchen) {
                return `
                    <div class="item kitchen-item" style="border-bottom: 1px dashed black; padding-bottom: 6px; margin-bottom: 6px;">
                        <div class="row" style="font-size: 15px; font-weight: bold; display: flex; align-items: center;">
                            <span class="qty" style="font-size: 16px; background: black; color: white; padding: 2px 6px; border-radius: 4px; margin-right: 8px; flex-shrink: 0;">${item.quantity}x</span>
                            <span class="name" style="flex-grow: 1; text-transform: uppercase;">${name}</span>
                        </div>
                        ${optsHtml ? `<div class="opts" style="font-size: 15px; margin-left: 35px; font-weight: 900; color: black; line-height: 1.3;">${optsHtml}</div>` : ''}
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

        const discountVal = Number(booking.discount_amount) || 0;
        const discountHtml = (!isKitchen && discountVal > 0) ? `
            <div class="row meta-row">
                <span>ส่วนลด (${booking.promotion_codes?.code || 'โปรโมชั่น'})</span>
                <span>-${discountVal.toLocaleString()}</span>
            </div>
        ` : ''

        const subtotal = booking.order_items?.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0) || 0;
        const netAfterDiscount = Math.max(0, subtotal - discountVal);

        const vatMode = (printerConfig.vat_mode || 'none').toLowerCase();
        const isVatEnabled = (printerConfig.vat_enabled === true || vatMode === 'inclusive' || vatMode === 'exclusive');
        const vatVal = (isVatEnabled && vatMode === 'inclusive')
            ? (netAfterDiscount * 7 / 107)
            : ((isVatEnabled && vatMode === 'exclusive')
                ? (netAfterDiscount * 0.07)
                : 0);

        const vatHtml = (isVatEnabled && vatVal > 0) ? `
            <div class="row"><span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span> <span>${Math.ceil(vatVal).toLocaleString()}</span></div>
        ` : '';

        const totalQty = booking.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

        const totalsHtml = (!isKitchen) ? `
            <div class="totals">
                <div class="row"><span>จำนวนชิ้น (QTY)</span> <span>${totalQty}</span></div>
                <div class="row"><span>ยอดรวมก่อนหัก</span> <span>${subtotal.toLocaleString()}</span></div>
                ${discountHtml}
                ${vatHtml}
                <div style="text-align: center; margin: 4px 0;">${generateDivider(printerConfig.divider_style || 'dashed', 32)}</div>
                <div class="row total-row" style="font-size: 15px; padding-top: 2px;">
                    <span>ยอดรวมทั้งสิ้น (TOTAL)</span>
                    <span>${Math.ceil(discountVal > 0 ? (netAfterDiscount + vatVal) : (booking.total_amount || netAfterDiscount)).toLocaleString()}</span>
                </div>
            </div>
        ` : ''

        const cleanCustNote = getCleanCustomerNote(booking.customer_note);
        const cleanStaffNote = getCleanStaffRemark(booking.staff_remark);
        const combinedNotes = [];
        if (cleanCustNote) combinedNotes.push(`<strong>ลูกค้า:</strong> ${cleanCustNote}`);
        if (cleanStaffNote) combinedNotes.push(`<strong>พนักงาน:</strong> ${cleanStaffNote}`);

        const noteHtml = (combinedNotes.length > 0) ? `
            <div class="kitchen-note-box" style="font-size: 10px; padding: 6px 8px; margin-top: 8px;">
                <div class="kitchen-note-label" style="font-size: 8px; margin-bottom: 3px;">หมายเหตุ / NOTES</div>
                ${combinedNotes.map(n => `<div style="margin-top: 2px; font-size: 10px; font-weight: bold; line-height: 1.3;">${n}</div>`).join('')}
            </div>
        ` : ''

        // Dynamic title based on activeTab
        let docTitle = 'TICKET'
        let docHeader = receiptShopName || 'IN THE HAUS'
        if (activeTab === 'kitchen' || activeTab === 'kitchen_all') {
            docTitle = 'KITCHEN ORDER / ใบสั่งอาหาร'
        } else if (activeTab === 'bar') {
            docTitle = 'BAR ORDER / ใบสั่งเครื่องดื่ม'
        } else if (activeTab === 'billing') {
            docTitle = 'BILLING SLIP / ใบแจ้งยอด'
        } else if (activeTab === 'receipt') {
            docTitle = 'RECEIPT / ใบเสร็จรับเงิน'
        }

        // Check category: Online Pickup vs Online Table Booking vs Walk-in Pickup vs IN HAUS Dine-In
        const remarkLower = (booking.staff_remark || '').toLowerCase();
        const noteLower = (booking.customer_note || '').toLowerCase();
        const sourceLower = (booking.source || '').toLowerCase();

        const isLineman = sourceLower === 'lineman' || remarkLower.includes('lineman') || remarkLower.includes('line man') || noteLower.includes('lineman') || (booking.customer_name || '').toLowerCase().includes('line man');
        const isOnlineSource = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('online') || noteLower.includes('online') || !!booking.payment_slip_url || isLineman;
        const isPickupOrder = booking.booking_type === 'pickup' || remarkLower.includes('pickup') || remarkLower.includes('takeaway') || remarkLower.includes('รับกลับ') || noteLower.includes('pickup') || (!booking.tables_layout && sourceLower !== 'qr') || isLineman;
        
        const isOnlinePickup = isOnlineSource && isPickupOrder && !isLineman;
        const isOnlineBooking = isOnlineSource && !isPickupOrder && sourceLower !== 'qr' && !isLineman;

        let orderBannerTitle = '';
        let orderBannerSub = '';

        if (isLineman) {
            orderBannerTitle = 'LINE MAN DELIVERY';
            orderBannerSub = '(ออเดอร์เดลิเวอรี LINE MAN)';
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

        const depositAmt = Number(booking.deposit_amount) || 0;
        const totalAmt = Number(booking.total_amount) || 0;
        const balanceDue = Math.max(0, totalAmt - depositAmt);

        // QR Code Section HTML - ONLY for billing tab (PromptPay before payment)
        let qrSectionHtml = ''
        if (activeTab === 'billing' && qrCodeUrl) {
            qrSectionHtml = `
                <div class="qr-section" style="text-align: center; margin: 8px 0;">
                    <div class="qr-title" style="font-weight: bold; font-size: 11px;">PROMPTPAY / สแกนชำระเงิน</div>
                    <img src="${qrCodeUrl}" class="qr-img" alt="QR Code" style="width: 140px; height: 140px; margin: 4px auto; display: block;" />
                    <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">ชื่อบัญชี: ${storePromptpayName || 'ธัญญธร ศรีวิเศษ'}</div>
                    <div style="font-size: 9px; font-family: monospace;">พร้อมเพย์: ${formatPromptpayDisplay(storePromptpayId || '0614232455')}</div>
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
                const totalAmt = Number(booking.total_amount) || subtotal;
                const cashDetails = extractCashDetails(booking, totalAmt);
                if (cashDetails && cashDetails.received !== null && cashDetails.received > 0) {
                    const cashRecvVal = Math.ceil(cashDetails.received).toLocaleString();
                    const cashChangeVal = Math.ceil(cashDetails.change || 0).toLocaleString();
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

        const queueNo = getShortBookingId(booking)

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
                            width: 100%;
                            display: block;
                        }
                        .tagline {
                            font-size: 8px;
                            text-align: center;
                            text-transform: uppercase;
                            letter-spacing: 2px;
                            margin-bottom: 10px;
                            border-bottom: 2px dashed black;
                            padding-bottom: 5px;
                            width: 100%;
                        }
                        .ticket-title {
                            font-size: 12px;
                            font-weight: bold;
                            text-align: center;
                            margin-bottom: 10px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            width: 100%;
                            display: block;
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
                        .row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px; }
                        .label { color: #000; font-weight: bold; text-transform: uppercase; }
                        .val { font-weight: normal; text-align: right; }
                        
                        .items { margin-bottom: 12px; }
                        .item { margin-bottom: 8px; }
                        .qty { width: 25px; font-weight: bold; flex-shrink: 0; font-size: 11px; white-space: nowrap; }
                        .name { flex-grow: 1; min-width: 0; margin-right: 5px; font-weight: bold; text-transform: uppercase; word-break: break-word; overflow-wrap: break-word; }
                        .price { text-align: right; width: 65px; flex-shrink: 0; white-space: nowrap; font-weight: bold; }
                        .opts { margin-left: 25px; margin-top: 2px; color: #000; font-size: 10px; font-weight: bold; font-style: normal; }

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

                        .kitchen-footer-block {
                            border-top: 3px solid black;
                            border-bottom: 3px solid black;
                            padding: 12px 6px;
                            margin-top: 14px;
                            margin-bottom: 8px;
                            text-align: center;
                            background: #fdfdfd;
                        }
                        .kitchen-footer-table {
                            font-size: 36px;
                            font-weight: 900;
                            line-height: 1.1;
                            text-transform: uppercase;
                            letter-spacing: -1px;
                            margin: 4px 0 6px 0;
                        }
                        .kitchen-footer-sub {
                            font-size: 11px;
                            font-weight: bold;
                            color: #222;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
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

                    <div class="ticket-title">${docTitle}</div>

                    <!-- Distinct Order Banner -->
                    <div style="border: 2px solid black; text-align: center; padding: 6px 4px; margin: 8px 0; background: #F8F8F8; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; text-align: center; width: 100%;">${orderBannerTitle}</div>
                        <div style="font-size: 10px; font-weight: bold; color: #333; margin-top: 2px; text-align: center; width: 100%;">${orderBannerSub}</div>
                    </div>

                    <!-- Shop metadata rendering if customer receipt -->
                    ${(activeTab !== 'kitchen' && activeTab !== 'bar' && (receiptShopAddress || receiptShopPhone || receiptShopVat)) ? `
                        <div style="text-align: center; font-size: 8px; line-height: 1.3; margin-bottom: 12px; border-bottom: 1px dashed black; padding-bottom: 8px; border-top: 1px dashed black; padding-top: 8px; text-transform: uppercase;">
                            ${receiptShopAddress ? `<div style="margin-bottom: 2px;">${receiptShopAddress}</div>` : ''}
                            ${receiptShopPhone ? `<div style="margin-bottom: 2px;">Tel: ${receiptShopPhone}</div>` : ''}
                            ${receiptShopVat ? `<div>Tax ID: ${receiptShopVat}</div>` : ''}
                        </div>
                    ` : ''}

                    <div class="center-flex" style="margin-top: 10px;">
                        <div class="queue-box">
                            <div class="queue-label">${isPickupOrder ? 'PICKUP QUEUE / รหัสสินค้า' : 'TABLE / โต๊ะ'}</div>
                            <div class="queue-val">${booking.tables_layout?.table_name || (isPickupOrder ? `#${queueNo}` : 'WALK-IN')}</div>
                            ${transfer.isMergedSource ? `<div style="font-size: 9px; font-weight: bold; color: #b91c1c; margin-top: 3px; text-transform: uppercase;">(โต๊ะรวม ➔ ${transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`})</div>` : ''}
                            ${transfer.isMergedTarget ? `<div style="font-size: 9px; font-weight: bold; color: #15803d; margin-top: 3px; text-transform: uppercase;">(โต๊ะรวม +${transfer.mergedFromTableDisplay || transfer.mergedFromTables.join(', ')})</div>` : ''}
                            ${transfer.isMoved ? `<div style="font-size: 9px; font-weight: bold; color: #1e40af; margin-top: 3px; text-transform: uppercase;">(ย้ายจาก โต๊ะ ${transfer.movedFromTable})</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="meta">
                        <div class="row"><span class="label">ช่องทาง / SOURCE</span> <span class="val" style="font-weight: bold;">${(isOnlinePickup || isOnlineBooking) ? 'ONLINE (ออนไลน์)' : 'IN HAUS (หน้าร้าน)'}</span></div>
                        <div class="row"><span class="label">บริการ / SERVICE</span> <span class="val" style="font-weight: bold;">${isOnlinePickup ? 'ONLINE PICKUP (รับกลับออนไลน์)' : (isOnlineBooking ? 'ONLINE BOOKING (จองโต๊ะออนไลน์)' : (isPickupOrder ? 'รับกลับบ้าน (TAKEAWAY)' : 'ทานที่ร้าน (DINE-IN)'))}</span></div>
                        ${isPickupOrder ? `
                            <div class="row"><span class="label">เวลาที่สั่ง / ORDER TIME</span> <span class="val">${orderPlacedStr}</span></div>
                            <div class="row"><span class="label">วันเวลามารับ / PICKUP TIME</span> <span class="val" style="font-weight: bold; color: #b91c1c;">${formattedBookingTimeStr}</span></div>
                        ` : isOnlineBooking ? `
                            <div class="row"><span class="label">เวลาทำรายการ / BOOKED AT</span> <span class="val">${orderPlacedStr}</span></div>
                            <div class="row"><span class="label">วันเวลาที่จอง / RESERVATION</span> <span class="val" style="font-weight: bold; color: #b91c1c;">${formattedBookingTimeStr}</span></div>
                        ` : `
                            <div class="row"><span class="label">วันที่ออกบิล / DATE</span> <span class="val">${orderPlacedStr}</span></div>
                        `}
                        <div class="row"><span class="label">ลูกค้า / GUEST</span> <span class="val">${booking.profiles?.display_name || booking.pickup_contact_name || 'ลูกค้าทั่วไป (Walk-in)'}</span></div>
                        <div class="row"><span class="label">จำนวนคน / PAX</span> <span class="val">${booking.pax || booking.guest_count || 1} คน</span></div>
                        ${(booking.profiles?.phone_number || booking.pickup_contact_phone) ? `<div class="row"><span class="label">เบอร์โทร / PHONE</span> <span class="val">${booking.profiles?.phone_number || booking.pickup_contact_phone}</span></div>` : ''}
                        ${(activeTab !== 'kitchen' && activeTab !== 'bar' && staffName) ? `<div class="row"><span class="label">พนักงาน / STAFF</span> <span class="val">${staffName}</span></div>` : ''}
                        
                        <!-- Proof Deposit Details -->
                        ${(!isKitchenTab && depositAmt > 0) ? `
                            <div style="border-top: 1px dashed black; margin-top: 6px; padding-top: 6px;">
                                <div class="row" style="font-weight: bold; color: #000;"><span>ยอดโอนมัดจำแล้ว:</span> <span>฿${Math.ceil(depositAmt).toLocaleString()}</span></div>
                                <div class="row" style="font-weight: bold; color: #d00000;"><span>ยอดคงเหลือชำระเพิ่ม:</span> <span>฿${Math.ceil(balanceDue).toLocaleString()}</span></div>
                            </div>
                        ` : ''}
                    </div>

                    <div class="items">
                        ${itemsHtml}
                    </div>

                    ${totalsHtml}

                    ${paymentMethodHtml}

                    ${qrSectionHtml}

                    ${noteHtml}

                    ${(() => {
                        if (!isKitchenTab) {
                            let art = printerConfig?.footer_ascii_art || getStoredShopSetting('footer_ascii_art', '');
                            return `
                                ${art ? `<pre style="font-family: monospace; font-size: 9px; font-weight: bold; margin: 8px 0; text-align: center; white-space: pre;">${art}</pre>` : ''}
                                <div class="footer">
                                    ${receiptShopFooter || printerConfig?.shop_footer_text || getStoredShopSetting('receipt_shop_footer', '')}
                                </div>
                            `;
                        }

                        const itemsForThisTab = selectItemsForTab(booking.order_items || [], activeTab, printerConfig);
                        const totalItemsCount = itemsForThisTab.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
                        const slipLabel = (activeTab === 'bar') ? 'บาร์' : (activeTab === 'other' ? 'อื่นๆ' : 'ครัว');
                        let footerTableTitle = isPickupOrder ? `PICKUP #${queueNo}` : `โต๊ะ ${booking.tables_layout?.table_name || 'WALK-IN'}`;
                        if (isLineman) {
                            footerTableTitle = `LINE MAN #${queueNo}`;
                        } else if (!isPickupOrder) {
                            if (transfer.isMergedSource) {
                                footerTableTitle = `โต๊ะ ${booking.tables_layout?.table_name || ''} (➔ ${transfer.mergedToTable})`;
                            } else if (transfer.isMergedTarget) {
                                footerTableTitle = `โต๊ะ ${booking.tables_layout?.table_name || ''} (+${transfer.mergedFromTables.join(',')})`;
                            } else if (transfer.isMoved) {
                                footerTableTitle = `โต๊ะ ${booking.tables_layout?.table_name || ''} (ย้ายจาก ${transfer.movedFromTable})`;
                            }
                        }
                        const orderPlacedDateObj = new Date(orderPlacedAtRaw);
                        const timeOnlyStr = orderPlacedDateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                        const paxCount = booking.pax || booking.guest_count || 1;

                        return `
                            <div class="kitchen-footer-block">
                                <div class="kitchen-footer-table">${footerTableTitle}</div>
                                <div class="kitchen-footer-sub">[ ${slipLabel} ] ${timeOnlyStr} | ${totalItemsCount} ชิ้น | ${paxCount} ท่าน</div>
                            </div>
                        `;
                    })()}

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `
    }

    const handlePrint = async () => {
        if (isPrinting) return;
        setIsPrinting(true);
        try {
            await doPrint();
        } finally {
            setIsPrinting(false);
        }
    }

    const doPrint = async () => {
        const isKitchenTabType = activeTab === 'kitchen' || activeTab === 'bar' || activeTab === 'other' || activeTab === 'kitchen_all';
        let printerType = isKitchenTabType
            ? (printerConfig.kitchen_printer_type || 'sunmi')
            : (printerConfig.cashier_printer_type || 'sunmi');
        let paperSize = isKitchenTabType
            ? (printerConfig.kitchen_paper_size || printerConfig.paper_width || '80mm')
            : (printerConfig.cashier_paper_size || printerConfig.paper_width || '80mm');
        let btDeviceName = printerConfig.bluetooth_device_name || '';

        const receiptConfig = {
            shopName: receiptShopName,
            shopAddress: receiptShopAddress,
            shopPhone: receiptShopPhone,
            shopVat: receiptShopVat,
            shopLogoUrl: receiptShopLogoUrl,
            shopFooter: receiptShopFooter,
            kitchen_categories: printerConfig.kitchen_categories || [],
            bar_categories: printerConfig.bar_categories || [],
            divider_style: printerConfig.divider_style || 'dashed'
        };

        if (printerType === 'sunmi') {
            try {
                let activePaperSize = '80mm';
                if (activeTab === 'kitchen' || activeTab === 'bar' || activeTab === 'other') {
                    activePaperSize = printerConfig.kitchen_paper_size || printerConfig.paper_width || '80mm';
                } else {
                    activePaperSize = printerConfig.cashier_paper_size || printerConfig.paper_width || '80mm';
                }

                if (activeTab === 'kitchen') {
                    // Always split into kitchen and bar
                    let printedAny = false;
                    const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, optionMap, activePaperSize, receiptConfig, 'sunmi');
                    if (kitchenBytes) {
                        await printToSunmiBuiltIn(kitchenBytes);
                        printedAny = true;
                    }
                    const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, optionMap, activePaperSize, receiptConfig, 'sunmi');
                    if (barBytes) {
                        await printToSunmiBuiltIn(barBytes);
                        printedAny = true;
                    }
                    if (!printedAny) {
                        // fallback
                        const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, optionMap, activePaperSize, receiptConfig, 'sunmi');
                        if (allBytes) {
                            await printToSunmiBuiltIn(allBytes);
                            printedAny = true;
                        }
                    }
                    if (!printedAny) {
                        toast.error("ไม่มีรายการสินค้าในหมวดหมู่นี้");
                    }
                } else {
                    const rawBytes = encodeReceiptData(booking, activeTab, paymentMethod, optionMap, activePaperSize, receiptConfig, 'sunmi');
                    if (rawBytes) {
                        const logoToPrint = (activeTab !== 'kitchen' && activeTab !== 'bar' && activeTab !== 'other' && activeTab !== 'kitchen_all') ? (receiptConfig.shopLogoUrl || `${window.location.origin}/logo.png`) : null;
                        const qrToPrint = (activeTab === 'billing') ? (qrCodeUrl || receiptConfig.paymentQrUrl) : null;
                        await printToSunmiBuiltIn(rawBytes, logoToPrint, qrToPrint);
                    } else {
                        toast.error("ไม่มีรายการสินค้าในหมวดหมู่นี้");
                    }
                }
                return; // successfully printed directly, exit
            } catch (err) {
                console.error("SUNMI print failed, falling back to standard dialog:", err);
                alert(`เกิดข้อผิดพลาดในการพิมพ์ผ่าน SUNMI: ${err.message || err}\nระบบจะสลับไปใช้หน้าต่างพิมพ์ของเครื่องแทน`);
            }
        } else if (printerType === 'rawbt') {
            try {
                if (activeTab === 'kitchen') {
                    let printedAny = false;
                    const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, optionMap, paperSize, receiptConfig, 'rawbt');
                    if (kitchenBytes) {
                        await printToRawBTWebSocket(kitchenBytes);
                        printedAny = true;
                    }
                    const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, optionMap, paperSize, receiptConfig, 'rawbt');
                    if (barBytes) {
                        await printToRawBTWebSocket(barBytes);
                        printedAny = true;
                    }
                    if (!printedAny) {
                        const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, optionMap, paperSize, receiptConfig, 'rawbt');
                        if (allBytes) {
                            await printToRawBTWebSocket(allBytes);
                            printedAny = true;
                        }
                    }
                    if (!printedAny) {
                        toast.error("ไม่มีรายการสินค้าในหมวดหมู่นี้");
                    }
                } else {
                    const rawBytes = encodeReceiptData(booking, activeTab, paymentMethod, optionMap, paperSize, receiptConfig, 'rawbt');
                    if (rawBytes) {
                        await printToRawBTWebSocket(rawBytes);
                    } else {
                        toast.error("ไม่มีรายการสินค้าในหมวดหมู่นี้");
                    }
                }
                return; // successfully printed directly, exit
            } catch (err) {
                console.error("RawBT print failed, falling back to standard dialog:", err);
                alert(`เกิดข้อผิดพลาดในการพิมพ์ผ่าน RawBT: ${err.message || err}\nระบบจะสลับไปใช้หน้าต่างพิมพ์ของเครื่องแทน`);
            }
        } else if (printerType === 'bluetooth') {
            try {
                if (activeTab === 'kitchen') {
                    let printedAny = false;
                    const kitchenBytes = encodeReceiptData(booking, 'kitchen', paymentMethod, optionMap, paperSize, receiptConfig, 'bluetooth');
                    if (kitchenBytes) {
                        await printToBluetoothDirect(btDeviceName, kitchenBytes);
                        printedAny = true;
                    }
                    const barBytes = encodeReceiptData(booking, 'bar', paymentMethod, optionMap, paperSize, receiptConfig, 'bluetooth');
                    if (barBytes) {
                        await printToBluetoothDirect(btDeviceName, barBytes);
                        printedAny = true;
                    }
                    if (!printedAny) {
                        const allBytes = encodeReceiptData(booking, 'kitchen_all', paymentMethod, optionMap, paperSize, receiptConfig, 'bluetooth');
                        if (allBytes) {
                            await printToBluetoothDirect(btDeviceName, allBytes);
                            printedAny = true;
                        }
                    }
                    if (!printedAny) {
                        toast.error("ไม่มีรายการสินค้าในหมวดหมู่นี้");
                    }
                } else {
                    const rawBytes = encodeReceiptData(booking, activeTab, paymentMethod, optionMap, paperSize, receiptConfig, 'bluetooth');
                    if (rawBytes) {
                        await printToBluetoothDirect(btDeviceName, rawBytes);
                    } else {
                        toast.error("ไม่มีรายการสินค้าในหมวดหมู่นี้");
                    }
                }
                return; // successfully printed directly, exit
            } catch (err) {
                console.error("Direct bluetooth print failed, falling back to standard dialog:", err);
            }
        }

        const htmlContent = getPrintHtml()
        
        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Printer')) {
            try {
                await Printer.printHtml({
                    name: `Receipt-${getShortBookingId(booking)}`,
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

    const [copiedImage, setCopiedImage] = useState(false)

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
            link.download = `${activeTab}-ticket-${getShortBookingId(booking)}.png`
            link.click()
            toast.success(`บันทึกสลิป ${activeTab.toUpperCase()} เป็นไฟล์ PNG เรียบร้อยแล้ว`)
        } catch (err) {
            console.error('Save PNG error:', err)
            toast.error('ไม่สามารถบันทึกรูปภาพได้: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleCopyImage = async () => {
        if (!slipRef.current) return
        try {
            const dataUrl = await toPng(slipRef.current, { 
                cacheBust: true, 
                backgroundColor: '#ffffff', 
                pixelRatio: 3 
            })
            const res = await fetch(dataUrl)
            const blob = await res.blob()
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ])
            setCopiedImage(true)
            toast.success('คัดลอกรูปสลิปลง Clipboard แล้ว (พร้อมส่งเข้า LINE)')
            setTimeout(() => setCopiedImage(false), 2500)
        } catch (err) {
            console.error('Copy image error:', err)
            toast.error('เบราว์เซอร์ไม่รองรับการคัดลอกรูปโดยตรง ให้กดปุ่ม Save PNG')
        }
    }

    const queueNo = getShortBookingId(booking)
    const orderPlacedAtRaw = booking.created_at || booking.order_time || (booking.booking_type !== 'dine_in' && booking.booking_type !== 'pickup' ? booking.booking_time : null) || new Date().toISOString()
    const orderPlacedStr = new Date(orderPlacedAtRaw).toLocaleString('th-TH', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    })
    const remarkLower = (booking.staff_remark || '').toLowerCase()
    const noteLower = (booking.customer_note || '').toLowerCase()
    const sourceLower = (booking.source || '').toLowerCase()
    const isLineman = sourceLower === 'lineman' || remarkLower.includes('lineman') || remarkLower.includes('line man') || noteLower.includes('lineman') || (booking.customer_name || '').toLowerCase().includes('line man')
    const isOnlineSource = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('online') || noteLower.includes('online') || !!booking.payment_slip_url || isLineman
    const isPickupOrder = booking.booking_type === 'pickup' || remarkLower.includes('pickup') || remarkLower.includes('takeaway') || remarkLower.includes('รับกลับ') || noteLower.includes('pickup') || (!booking.tables_layout && sourceLower !== 'qr') || isLineman
    
    const transfer = parseTableTransferInfo(booking);
    const subtotal = booking.order_items?.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0) || 0;
    const discountAmount = Number(booking.discount_amount) || 0;
    const depositAmount = Number(booking.deposit_amount) || 0;
    const displayTotalAmount = (discountAmount > 0 && Math.abs(Number(booking.total_amount) - subtotal) < 1)
        ? Math.max(0, subtotal - discountAmount)
        : (booking.total_amount || Math.max(0, subtotal - discountAmount));

    if (isAutoPrinting) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="p-3.5 px-4 bg-white border-b border-[oklch(85%_0.012_28)] flex justify-between items-center text-[oklch(18%_0.012_28)]">
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs uppercase tracking-widest text-[oklch(18%_0.012_28)]">
                            {isAdmin ? 'สลิปใบเสร็จ / BILL & RECEIPT' : 'Ticket Preview'}
                        </span>
                        <span className="font-mono text-[11px] bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] px-1.5 py-0.5 rounded-sm">
                            #{queueNo}
                        </span>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="p-1 rounded-sm hover:bg-[oklch(90%_0.012_28)] text-[oklch(42%_0.010_28)] hover:text-black transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs Switcher */}
                <div className="p-3 pb-0 bg-[oklch(97%_0.008_28)]">
                    {isAdmin ? (
                        /* Admin Mode: 2 clean tabs only (Bill vs Receipt) */
                        <div className="grid grid-cols-2 bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] p-1 rounded-lg gap-1">
                            <button 
                                type="button"
                                onClick={() => setActiveTab('billing')} 
                                className={`py-2 rounded-md font-sans font-bold text-xs transition-all cursor-pointer ${activeTab === 'billing' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs border border-[oklch(85%_0.012_28)]' : 'text-[oklch(42%_0.010_28)] hover:text-black'}`}
                            >
                                ใบแจ้งยอด (Bill & QR)
                            </button>
                            <button 
                                type="button"
                                onClick={() => setActiveTab('receipt')} 
                                className={`py-2 rounded-md font-sans font-bold text-xs transition-all cursor-pointer ${activeTab === 'receipt' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs border border-[oklch(85%_0.012_28)]' : 'text-[oklch(42%_0.010_28)] hover:text-black'}`}
                            >
                                ใบเสร็จรับเงิน (Receipt)
                            </button>
                        </div>
                    ) : (
                        /* POS / Staff Mode: All tabs */
                        <div className="flex bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] p-1 rounded-lg gap-1 overflow-x-auto">
                            <button 
                                type="button"
                                onClick={() => setActiveTab('kitchen')} 
                                className={`flex-1 py-1.5 px-2 rounded-md font-mono font-bold text-[9px] uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'kitchen' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs' : 'text-[oklch(42%_0.010_28)] hover:text-black'}`}
                            >
                                ครัว (Kitchen)
                            </button>
                            <button 
                                type="button"
                                onClick={() => setActiveTab('bar')} 
                                className={`flex-1 py-1.5 px-2 rounded-md font-mono font-bold text-[9px] uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'bar' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs' : 'text-[oklch(42%_0.010_28)] hover:text-black'}`}
                            >
                                บาร์ (Bar)
                            </button>
                            <button 
                                type="button"
                                onClick={() => setActiveTab('other')} 
                                className={`flex-1 py-1.5 px-2 rounded-md font-mono font-bold text-[9px] uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'other' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs' : 'text-[oklch(42%_0.010_28)] hover:text-black'}`}
                            >
                                อื่นๆ (Other)
                            </button>
                            <button 
                                type="button"
                                onClick={() => setActiveTab('billing')} 
                                className={`flex-1 py-1.5 px-2 rounded-md font-mono font-bold text-[9px] uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'billing' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs' : 'text-[oklch(42%_0.010_28)] hover:text-black'}`}
                            >
                                แจ้งยอด (Bill)
                            </button>
                            <button 
                                type="button"
                                onClick={() => setActiveTab('receipt')} 
                                className={`flex-1 py-1.5 px-2 rounded-md font-mono font-bold text-[9px] uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'receipt' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs' : 'text-[oklch(42%_0.010_28)] hover:text-black'}`}
                            >
                                ใบเสร็จ (Receipt)
                            </button>
                        </div>
                    )}

                    {/* Payment Method Selector (Only for Billing / Receipt tabs) */}
                    {(activeTab === 'billing' || activeTab === 'receipt') && (
                        <div className="flex items-center justify-between bg-white border border-[oklch(85%_0.012_28)] p-2 px-3 rounded-lg mt-2.5">
                            <span className="text-[11px] font-sans font-bold text-[oklch(42%_0.010_28)]">
                                ช่องทางชำระเงิน:
                            </span>
                            <div className="flex gap-1">
                                <button 
                                    type="button"
                                    onClick={() => setPaymentMethod('qr')}
                                    className={`px-2.5 py-1 rounded font-sans font-bold text-[11px] transition-colors cursor-pointer ${paymentMethod === 'qr' ? 'bg-[oklch(18%_0.012_28)] text-white' : 'bg-[oklch(95%_0.008_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(90%_0.012_28)]'}`}
                                >
                                    โอนเงิน (QR)
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`px-2.5 py-1 rounded font-sans font-bold text-[11px] transition-colors cursor-pointer ${paymentMethod === 'cash' ? 'bg-[oklch(18%_0.012_28)] text-white' : 'bg-[oklch(95%_0.008_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(90%_0.012_28)]'}`}
                                >
                                    เงินสด (CASH)
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setPaymentMethod('credit')}
                                    className={`px-2.5 py-1 rounded font-sans font-bold text-[11px] transition-colors cursor-pointer ${paymentMethod === 'credit' ? 'bg-[oklch(18%_0.012_28)] text-white' : 'bg-[oklch(95%_0.008_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(90%_0.012_28)]'}`}
                                >
                                    บัตร (CREDIT)
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Preview Window (Dieter Rams + Thai Modern) */}
                <div className="flex-1 overflow-y-auto py-4 px-3 md:px-4 bg-[oklch(93%_0.010_28)] flex justify-center items-start mt-2.5 border-t border-b border-[oklch(85%_0.012_28)]">
                    <div 
                        ref={slipRef} 
                        className="bg-white text-[oklch(18%_0.012_28)] p-6 rounded-md border border-[oklch(85%_0.012_28)] shadow-md w-full max-w-[340px] font-sans select-none space-y-4 my-1"
                    >
                        {/* BRAND HEADER */}
                        {!isKitchenTab && (
                            <div className="text-center space-y-1 pb-3 border-b border-[oklch(85%_0.012_28)]">
                                <div className="flex justify-center mb-1.5">
                                    <img 
                                        src={receiptShopLogoUrl || '/receipt-logo.png'} 
                                        alt="Logo" 
                                        className="h-10 w-auto object-contain" 
                                        onError={(e) => {
                                            if (e.target.src !== `${window.location.origin}/receipt-logo.png`) {
                                                e.target.src = '/receipt-logo.png';
                                            }
                                        }}
                                    />
                                </div>
                                <div className="font-bold text-xs uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                    {receiptShopName || 'IN THE HAUS'}
                                </div>
                                {receiptShopAddress && (
                                    <div className="text-[10px] text-[oklch(55%_0.010_28)] leading-tight max-w-[260px] mx-auto">
                                        {receiptShopAddress}
                                    </div>
                                )}
                                {(receiptShopPhone || receiptShopVat) && (
                                    <div className="text-[9px] font-mono text-[oklch(55%_0.010_28)]">
                                        {receiptShopPhone && <span>TEL: {receiptShopPhone} </span>}
                                        {receiptShopVat && <span>| TAX ID: {receiptShopVat}</span>}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* DOCUMENT TITLE & ORDER TYPE BADGE */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-mono font-bold border-b border-[oklch(88%_0.010_28)] pb-1.5">
                                <span className="uppercase text-[oklch(42%_0.010_28)]">
                                    {activeTab === 'kitchen' ? 'ใบสั่งครัว (KITCHEN)' : activeTab === 'bar' ? 'ใบสั่งบาร์ (BAR)' : activeTab === 'other' ? 'ใบสั่งอื่นๆ (OTHER)' : activeTab === 'billing' ? 'ใบแจ้งยอดชำระเงิน / BILL' : 'ใบเสร็จรับเงิน / RECEIPT'}
                                </span>
                                <span className="text-[oklch(18%_0.012_28)]">
                                    #{queueNo}
                                </span>
                            </div>

                            {/* Table / Order Channel Banner (Clean Dieter Rams Structural Block) */}
                            <div className="bg-[oklch(96%_0.008_28)] border border-[oklch(88%_0.010_28)] p-2.5 rounded-sm flex items-center justify-between">
                                <div>
                                    <span className="text-[9px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block leading-none">
                                        {booking.tables_layout ? 'TABLE / โต๊ะ' : 'ORDER TYPE / ประเภท'}
                                    </span>
                                    <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
                                        <span className="text-xl font-black text-[oklch(18%_0.012_28)] leading-tight">
                                            {booking.tables_layout?.table_name || (isPickupOrder ? 'รับกลับ (PICKUP)' : 'ทานที่ร้าน')}
                                        </span>
                                        {transfer.isMergedSource && (
                                            <span className="px-1.5 py-0.2 bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.16_28)] border border-[oklch(52%_0.16_28)] text-[9px] font-mono font-bold rounded-xs">
                                                โต๊ะรวม ➔ {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}
                                            </span>
                                        )}
                                        {transfer.isMergedTarget && (
                                            <span className="px-1.5 py-0.2 bg-[oklch(92%_0.02_140)] text-[oklch(30%_0.08_140)] border border-[oklch(82%_0.04_140)] text-[9px] font-mono font-bold rounded-xs">
                                                โต๊ะรวม (+{transfer.mergedFromTableDisplay || transfer.mergedFromTables.join(', ')})
                                            </span>
                                        )}
                                        {transfer.isMoved && (
                                            <span className="px-1.5 py-0.2 bg-[oklch(92%_0.02_220)] text-[oklch(30%_0.10_220)] border border-[oklch(82%_0.02_220)] text-[9px] font-mono font-bold rounded-xs">
                                                ย้ายจาก โต๊ะ {transfer.movedFromTable}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right font-mono text-xs">
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] block">PAX / จำนวน</span>
                                    <span className="font-bold text-[oklch(18%_0.012_28)]">{booking.pax || 1} ท่าน</span>
                                </div>
                            </div>

                            {/* Table Transfer Banner Strip */}
                            {transfer.isMergedSource && (
                                <div className="bg-[oklch(94%_0.02_28)] border border-[oklch(52%_0.16_28)] text-[oklch(35%_0.14_28)] p-2.5 rounded-sm text-[10px] font-mono font-bold space-y-0.5">
                                    <div>⚠️ โต๊ะรวม: โอนรายการทั้งหมดไปที่ <strong>{transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}</strong> เรียบร้อยแล้ว</div>
                                    {transfer.originalTotal > 0 && <div>ยอดเงินเดิมก่อนรวมบิล: ฿{transfer.originalTotal.toLocaleString()}</div>}
                                </div>
                            )}
                            {transfer.isMergedTarget && (
                                <div className="bg-[oklch(92%_0.02_140)] border border-[oklch(82%_0.04_140)] text-[oklch(30%_0.08_140)] p-2 rounded-sm text-[10px] font-mono font-bold">
                                    🔗 โต๊ะรวม: บิลนี้รวมรายการอาหารมาจาก <strong>{transfer.mergedFromTableDisplay || transfer.mergedFromTables.join(', ')}</strong>
                                </div>
                            )}
                        </div>

                        {/* Order Metadata Grid */}
                        <div className="grid grid-cols-2 gap-y-1 text-[11px] border-b border-[oklch(88%_0.010_28)] pb-2.5 font-mono">
                            <span className="text-[oklch(55%_0.010_28)]">วันที่ & เวลา:</span>
                            <span className="text-right text-[oklch(18%_0.012_28)] font-semibold">{orderPlacedStr}</span>

                            <span className="text-[oklch(55%_0.010_28)]">ลูกค้า:</span>
                            <span className="text-right text-[oklch(18%_0.012_28)] font-semibold truncate">
                                {booking.profiles?.display_name || booking.pickup_contact_name || 'ลูกค้าทั่วไป'}
                            </span>

                            {(booking.profiles?.phone_number || booking.pickup_contact_phone) && (
                                <>
                                    <span className="text-[oklch(55%_0.010_28)]">โทรศัพท์:</span>
                                    <span className="text-right text-[oklch(18%_0.012_28)] font-semibold">
                                        {booking.profiles?.phone_number || booking.pickup_contact_phone}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* ORDER ITEMS LIST */}
                        <div className="space-y-2.5">
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase text-[oklch(55%_0.010_28)] border-b border-[oklch(88%_0.010_28)] pb-1">
                                <span>รายการอาหาร (ITEMS)</span>
                                {!isKitchenTab && <span>จำนวนเงิน</span>}
                            </div>

                            <div className="space-y-2">
                                {selectItemsForTab(booking.order_items || [], activeTab, printerConfig).map((item, idx) => {
                                    const optList = formatOrderItemOptions(item.selected_options, item.item_note || item.notes || item.special_instructions || item.remark)
                                    const unitPrice = Number(item.price_at_time || 0)
                                    const lineTotal = unitPrice * (item.quantity || 1)

                                    return (
                                        <div key={idx} className="text-xs space-y-0.5 border-b border-[oklch(93%_0.008_28)] last:border-0 pb-1.5 last:pb-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex items-baseline gap-1.5 grow">
                                                    <span className="font-mono font-black text-xs text-[oklch(18%_0.012_28)] shrink-0">
                                                        {item.quantity}x
                                                    </span>
                                                    <span className="font-bold text-[oklch(18%_0.012_28)] leading-snug">
                                                        {item.custom_name || item.name || item.menu_items?.name || 'รายการสินค้า'}
                                                    </span>
                                                </div>
                                                {!isKitchenTab && (
                                                    <span className="font-mono text-right shrink-0 text-[oklch(18%_0.012_28)] font-medium">
                                                        ฿{lineTotal.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>

                                            {optList.length > 0 && (
                                                <div className="pl-5 space-y-0.5">
                                                    {optList.map((opt, oIdx) => (
                                                        <div key={oIdx} className="text-[10px] text-[oklch(45%_0.010_28)] font-sans leading-tight">
                                                            • {opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* TOTALS SUMMARY */}
                        {!isKitchenTab && (
                            <div className="border-t-2 border-[oklch(18%_0.012_28)] pt-2.5 space-y-1.5 font-mono text-xs">
                                <div className="flex justify-between text-[oklch(55%_0.010_28)]">
                                    <span>รวมค่าอาหาร (SUBTOTAL):</span>
                                    <span>฿{subtotal.toLocaleString()}</span>
                                </div>

                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-[oklch(45%_0.08_140)] font-semibold">
                                        <span>ส่วนลด (DISCOUNT):</span>
                                        <span>-฿{discountAmount.toLocaleString()}</span>
                                    </div>
                                )}

                                {depositAmount > 0 && (
                                    <div className="flex justify-between text-[oklch(35%_0.10_220)] font-semibold">
                                        <span>มัดจำล่วงหน้า (DEPOSIT):</span>
                                        <span>-฿{depositAmount.toLocaleString()}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-baseline pt-2 border-t border-[oklch(88%_0.010_28)] text-[oklch(18%_0.012_28)]">
                                    <span className="font-bold text-xs uppercase">
                                        ยอดสุทธิ (TOTAL AMOUNT):
                                    </span>
                                    <span className="text-xl font-black">
                                        ฿{Math.ceil(displayTotalAmount).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* CRM MEMBER DETAILS */}
                        {!isKitchenTab && booking.profiles && (
                            <div className="bg-[oklch(96%_0.008_28)] p-2.5 rounded-sm border border-[oklch(88%_0.010_28)] text-[11px] font-mono space-y-1">
                                <div className="flex justify-between font-bold text-[oklch(42%_0.010_28)] text-[10px] uppercase border-b border-[oklch(88%_0.010_28)] pb-0.5">
                                    <span>MEMBER</span>
                                    <span>{booking.profiles.display_name || '-'}</span>
                                </div>
                                {Number(booking.xhaus_earned) > 0 && (
                                    <div className="flex justify-between text-[oklch(45%_0.08_140)]">
                                        <span>ได้รับแต้ม xhaus:</span>
                                        <span>+{Number(booking.xhaus_earned).toLocaleString()} xhaus</span>
                                    </div>
                                )}
                                {Number(booking.xhaus_redeemed) > 0 && (
                                    <div className="flex justify-between text-[oklch(52%_0.16_28)]">
                                        <span>ใช้แต้ม xhaus:</span>
                                        <span>-{Number(booking.xhaus_redeemed).toLocaleString()} xhaus</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* BILL TAB: DYNAMIC PROMPTPAY QR CODE */}
                        {activeTab === 'billing' && qrCodeUrl && (
                            <div className="pt-2 border-t border-[oklch(88%_0.010_28)] text-center space-y-1.5 flex flex-col items-center">
                                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[oklch(42%_0.010_28)]">
                                    SCAN TO PAY / สแกนชำระเงิน
                                </span>
                                <div className="p-2 bg-white rounded-lg border border-[oklch(85%_0.012_28)] shadow-xs">
                                    <img 
                                        src={qrCodeUrl} 
                                        alt="PromptPay QR" 
                                        className="w-36 h-36 object-contain" 
                                    />
                                </div>
                                <div className="text-center space-y-0.5">
                                    <p className="text-[10px] font-bold text-[oklch(52%_0.16_28)]">
                                        ชื่อบัญชี: {storePromptpayName || 'ธัญญธร ศรีวิเศษ'}
                                    </p>
                                    <p className="text-[9px] text-[oklch(55%_0.010_28)] font-mono">
                                        พร้อมเพย์: {formatPromptpayDisplay(storePromptpayId || '0614232455')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* RECEIPT TAB: PAYMENT METHOD & STATUS (Dieter Rams Minimalist Banner, No decorative stamp) */}
                        {activeTab === 'receipt' && (() => {
                            const isCash = paymentMethod === 'cash';
                            const totalAmt = Number(booking.total_amount) || displayTotalAmount;
                            const cashDetails = isCash ? extractCashDetails(booking, totalAmt) : null;
                            const paymentLabel = isCash 
                                ? 'เงินสด (CASH)' 
                                : (paymentMethod === 'credit' ? 'บัตรเครดิต (CREDIT)' : 'โอนเงินผ่าน QR (PROMPTPAY)');

                            return (
                                <div className="pt-2 border-t border-[oklch(88%_0.010_28)] space-y-2">
                                    <div className="bg-[oklch(96%_0.008_28)] border border-[oklch(85%_0.012_28)] p-2.5 rounded-sm space-y-1 font-mono text-xs">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[oklch(42%_0.010_28)]">
                                            <span>สถานะการชำระ:</span>
                                            <span className="text-[oklch(45%_0.08_140)] font-black">PAID / ชำระแล้ว</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-1 border-t border-[oklch(90%_0.008_28)]">
                                            <span className="text-[oklch(55%_0.010_28)]">ช่องทางชำระ:</span>
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">{paymentLabel}</span>
                                        </div>

                                        {isCash && cashDetails && cashDetails.received > 0 && (
                                            <div className="pt-1 border-t border-[oklch(90%_0.008_28)] space-y-0.5 text-[11px]">
                                                <div className="flex justify-between text-[oklch(55%_0.010_28)]">
                                                    <span>รับเงินสดมา:</span>
                                                    <span className="font-bold">฿{Math.ceil(cashDetails.received).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-[oklch(18%_0.012_28)]">
                                                    <span>เงินทอน:</span>
                                                    <span>฿{Math.ceil(cashDetails.change || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Customer & Staff Notes */}
                        {(() => {
                            const cleanCust = getCleanCustomerNote(booking.customer_note);
                            const cleanStaff = getCleanStaffRemark(booking.staff_remark);
                            if (!cleanCust && !cleanStaff) return null;
                            return (
                                <div className="bg-[oklch(96%_0.008_28)] border border-[oklch(88%_0.010_28)] p-2.5 rounded-sm font-sans text-xs space-y-1">
                                    <div className="text-[10px] font-mono font-bold uppercase text-[oklch(42%_0.010_28)]">
                                        หมายเหตุ (NOTES)
                                    </div>
                                    {cleanCust && <div className="text-[oklch(18%_0.012_28)]"><strong>ลูกค้า:</strong> {cleanCust}</div>}
                                    {cleanStaff && <div className="text-[oklch(42%_0.010_28)]"><strong>พนักงาน:</strong> {cleanStaff}</div>}
                                </div>
                            );
                        })()}

                        {/* FOOTER: KITCHEN / BAR TICKET RAIL FOOTER STUB vs SHOP RECEIPT FOOTER */}
                        {isKitchenTab ? (
                            (() => {
                                const itemsForThisTab = selectItemsForTab(booking.order_items || [], activeTab, printerConfig);
                                const totalItemsCount = itemsForThisTab.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
                                const slipLabel = (activeTab === 'bar') ? 'บาร์' : (activeTab === 'other' ? 'อื่นๆ' : 'ครัว');
                                let footerTableTitle = isPickupOrder ? `PICKUP #${queueNo}` : `โต๊ะ ${booking.tables_layout?.table_name || 'WALK-IN'}`;
                                if (isLineman) {
                                    footerTableTitle = `LINE MAN #${queueNo}`;
                                } else if (!isPickupOrder) {
                                    if (transfer.isMergedSource) {
                                        footerTableTitle = `โต๊ะ ${booking.tables_layout?.table_name || ''} (➔ ${transfer.mergedToTable})`;
                                    } else if (transfer.isMergedTarget) {
                                        footerTableTitle = `โต๊ะ ${booking.tables_layout?.table_name || ''} (+${transfer.mergedFromTables.join(',')})`;
                                    } else if (transfer.isMoved) {
                                        footerTableTitle = `โต๊ะ ${booking.tables_layout?.table_name || ''} (ย้ายจาก ${transfer.movedFromTable})`;
                                    }
                                }
                                const orderPlacedDateObj = new Date(orderPlacedAtRaw);
                                const timeOnlyStr = orderPlacedDateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                                const paxCount = booking.pax || booking.guest_count || 1;

                                return (
                                    <div className="border-t-2 border-b-2 border-[oklch(18%_0.012_28)] bg-[oklch(96%_0.008_28)] p-4 sm:p-5 text-center rounded-sm space-y-1.5 mt-2">
                                        <div className="text-3xl sm:text-4xl font-black text-[oklch(18%_0.012_28)] tracking-tight leading-tight uppercase font-mono py-1">
                                            {footerTableTitle}
                                        </div>
                                        <div className="text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase tracking-wider">
                                            [ {slipLabel} ] {timeOnlyStr} | {totalItemsCount} ชิ้น | {paxCount} ท่าน
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="text-center pt-2 border-t border-[oklch(88%_0.010_28)] space-y-1">
                                <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)] uppercase tracking-wider">
                                    {receiptShopFooter || 'THANK YOU FOR YOUR VISIT // ขอบคุณที่ใช้บริการ'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Bar */}
                <div className="p-3 md:p-4 bg-white border-t border-[oklch(85%_0.012_28)] flex items-center justify-between gap-2.5">
                    {isAdmin ? (
                        /* Admin Mode: Copy Image to Clipboard as Primary CTA, Save PNG as Secondary */
                        <>
                            <button 
                                type="button"
                                onClick={handleCopyImage} 
                                className="flex-1 py-2.5 px-4 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-white rounded-lg font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer" 
                                title="คัดลอกรูปลง Clipboard เพื่อส่งเข้า LINE ให้ลูกค้าทันที"
                            >
                                {copiedImage ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}
                                <span>{copiedImage ? 'คัดลอกแล้ว!' : 'คัดลอกรูปสลิป'}</span>
                            </button>

                            <button 
                                type="button"
                                onClick={handleSaveImage} 
                                disabled={saving}
                                className="py-2.5 px-4 bg-[oklch(95%_0.008_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Download size={15} />
                                <span>{saving ? 'กำลังบันทึก...' : 'SAVE PNG'}</span>
                            </button>

                            <button 
                                type="button"
                                onClick={onClose}
                                className="py-2.5 px-3 bg-white hover:bg-[oklch(95%_0.008_28)] text-[oklch(42%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-sans text-xs font-semibold transition-colors cursor-pointer"
                            >
                                ปิด
                            </button>
                        </>
                    ) : (
                        /* POS / Staff Mode: Print Ticket as Primary */
                        <>
                            <button 
                                type="button"
                                onClick={handlePrint} 
                                disabled={isPrinting || isAutoPrinting} 
                                className={`flex-1 ${isPrinting || isAutoPrinting ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-white cursor-pointer'} py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm`}
                            >
                                <PrinterIcon size={14} /> {isPrinting || isAutoPrinting ? 'Printing...' : 'Print Ticket'}
                            </button>
                            <button 
                                type="button"
                                onClick={handleCopyImage} 
                                className="px-3 bg-white border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:bg-[oklch(95%_0.008_28)] py-2.5 rounded-lg font-mono font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer" 
                                title="คัดลอกรูปลง Clipboard"
                            >
                                {copiedImage ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                            </button>
                            <button 
                                type="button"
                                onClick={handleSaveImage} 
                                className="px-3 bg-white border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:bg-[oklch(95%_0.008_28)] py-2.5 rounded-lg font-mono font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer" 
                                disabled={saving}
                            >
                                <Download size={14} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
