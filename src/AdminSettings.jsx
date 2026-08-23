import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabaseClient'
import { Save, Power, Upload, Calendar, Trash2, Volume2, Bell, MessageSquare, QrCode, RefreshCw, Download, Cake, Heart, TrendingUp, Coins, Award, Users, ShieldCheck, Gift, Terminal, AlertTriangle, FileText, Copy, Plus, Calculator, RotateCcw, CheckCircle2, Sparkles, Layers, ExternalLink, Edit3, Check, Clock, Utensils, CheckSquare, Square, Moon, Sun } from 'lucide-react'
import QRCode from 'qrcode'
import CheckinManager from './components/admin/CheckinManager'
import DataPurgePanel from './components/admin/DataPurgePanel'
import { printToBluetoothDirect, encodeShiftReportData, printToRawBTWebSocket, printToSunmiBuiltIn, generateDivider } from './utils/printerHelper'
import { simulateWmaOrder } from './utils/wmaNativeBridge'
import { DEFAULT_CRM_SETTINGS, DEFAULT_CRM_TIERS, parseTiersConfig, calculateMemberTier, calculateCoinsEarned, calculateCoinsDiscount, getTierVisualTheme } from './utils/crmHelper'
import { BleClient } from '@capacitor-community/bluetooth-le'
import { Capacitor } from '@capacitor/core'
import { Printer } from '@capgo/capacitor-printer'
import { logger } from './utils/logger'
import { getAppOrigin, safeTimestampUrl } from './utils/urlHelper'
import VisualCalendarBlocker from './components/admin/settings/VisualCalendarBlocker'
import TimeSlotStudio from './components/admin/settings/TimeSlotStudio'

// PWA Install Button Component
const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  if (!deferredPrompt) return null

  return (
    <button 
        onClick={handleInstall}
        className="flex items-center gap-2 bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-700 transition-colors border border-zinc-700"
    >
    </button>
  );
};

const ASCII_ART_PRESETS = [
    {
        id: 'thank_you_spaced',
        name: 'THANK YOU (Spaced Text)',
        art: `T H A N K   Y O U
  S E E   Y O U   A G A I N`
    },
    {
        id: 'in_the_haus',
        name: 'IN THE HAUS (Clean Text)',
        art: `--- IN THE HAUS ---`
    },
    {
        id: 'classic_banner',
        name: 'THANK YOU (Clean Banner)',
        art: `===========================
   THANK YOU FOR VISITING
===========================`
    },
    {
        id: 'have_a_nice_day',
        name: 'HAVE A NICE DAY (Spaced)',
        art: `H A V E   A   N I C E   D A Y
   THANK YOU VERY MUCH`
    },
    {
        id: 'welcome_home',
        name: 'WELCOME HOME (Spaced Banner)',
        art: `+-------------------------+
      WELCOME HOME
+-------------------------+`
    }
];

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        shop_mode_table: 'auto',
        shop_mode_pickup: 'auto',

        opening_time: '10:00',
        closing_time: '20:00',
        floorplan_url: '',
        payment_qr_url: '',
        promptpay_id: '',
        promptpay_name: '',
        booking_time_slots: '11:00, 12:00, 13:00, 14:00, 17:00, 18:00, 19:00, 20:00',
        is_menu_system_enabled: 'true',
        sms_api_key: '',
        sms_api_secret: '',
        admin_phone_contact: '',
        staff_pin_code: '',
        contact_phone: '',
        contact_map_url: '',

        qr_ordering_enabled: 'true',
        song_request_enabled: 'true',
        qr_gps_enabled: 'true',
        qr_latitude: '17.40722',
        qr_longitude: '104.78028',
        qr_radius: '50',
        qr_kitchen_open_time: '10:00',
        qr_kitchen_close_time: '22:00',
        qr_kitchen_cutoff_enabled: 'true',
        qr_kitchen_mode: 'auto',
        qr_kitchen_closed_categories: '[]',
        spotify_client_id: '',
        spotify_client_secret: '',
        link_og_image_url: '',
        link_og_description: '',
        default_vat_enabled: 'true',
        crm_welcome_xhaus: '10.00',
        crm_redeem_rate_xhaus: '1.00',
        crm_min_redeem_xhaus: '10.00',
        crm_base_spend_amount: '100.00',
        crm_max_redeem_percent: '100',
        crm_tier_eval_months: '12',
        crm_grace_period_days: '30',
        crm_tiers_config: JSON.stringify(DEFAULT_CRM_TIERS),
        receipt_shop_name: 'IN THE HAUS',
        receipt_shop_address: '',
        receipt_shop_phone: '',
        receipt_shop_vat: '',
        receipt_shop_logo_url: '',
        receipt_shop_footer: 'THANK YOU FOR YOUR VISIT',
        google_review_url: 'https://g.page/r/CXmnpQhwM5MYEBM/review'
    })
    const [loading, setLoading] = useState(false)
    const [timestamp, setTimestamp] = useState(Date.now())
    const [uploadingQr, setUploadingQr] = useState(false)
    const [uploadingFloor, setUploadingFloor] = useState(false)
    const [uploadingSound, setUploadingSound] = useState(false)
    const [uploadingKdsSound, setUploadingKdsSound] = useState(false)
    const [uploadingHomeBg, setUploadingHomeBg] = useState(false)
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [crmQrUrl, setCrmQrUrl] = useState('')

    // Dynamic Relationship Tiers Management & Simulation State
    const [editableTiers, setEditableTiers] = useState(DEFAULT_CRM_TIERS)
    const [isTiersSaving, setIsTiersSaving] = useState(false)
    const [simSpendAmount, setSimSpendAmount] = useState('500')
    const [simAccumSpent, setSimAccumSpent] = useState('4500')
    const [simGracePeriod, setSimGracePeriod] = useState(false)

    useEffect(() => {
        const url = `${getAppOrigin()}/member-card`;
        QRCode.toDataURL(url, { width: 300, margin: 2 })
            .then(urlData => setCrmQrUrl(urlData))
            .catch(err => console.error("Failed to generate CRM QR:", err));
    }, []);

    // Blocked Dates
    const [blockedList, setBlockedList] = useState([])
    const [blockForm, setBlockForm] = useState({ startDate: '', endDate: '', reason: '' })
    
    // Store Settings (Relational Table)
    const [targetFoodCost, setTargetFoodCost] = useState(30);
    const [activeSettingsTab, setActiveSettingsTab] = useState('booking');

    // Printer Configuration
    const [printerConfig, setPrinterConfig] = useState({
        cashier_printer_type: 'sunmi', // 'sunmi' | 'universal' | 'lan' | 'bluetooth'
        cashier_printer_ip: '192.168.1.100',
        cashier_printer_port: '9100',
        cashier_printer_bt_name: 'CashierPrinter',
        cashier_paper_size: '80mm',
        kitchen_printer_type: 'sunmi',
        kitchen_printer_ip: '192.168.1.200',
        kitchen_printer_port: '9100',
        kitchen_printer_bt_name: 'KitchenPrinter',
        kitchen_paper_size: '80mm',
        footer_ascii_art: `T H A N K   Y O U\n  S E E   Y O U   A G A I N`,
        shop_footer_text: 'THANK YOU FOR YOUR VISIT'
    });
    const [previewTab, setPreviewTab] = useState('billing'); // 'billing' | 'kitchen' | 'bar'
    const [selectedAsciiPreset, setSelectedAsciiPreset] = useState('thank_you_spaced');
    const [isScanning, setIsScanning] = useState(false);
    const [allCategories, setAllCategories] = useState([]);
    const [draggedOverColumn, setDraggedOverColumn] = useState(null);

    const defaultRouteCategory = (cat) => {
        const name = (cat.name || '').toLowerCase();
        if (
            name.includes('coffee') || name.includes('soft drink') || name.includes('drink') || 
            name.includes('beer') || name.includes('alcahol') || name.includes('alcohol') || 
            name.includes('tea') || name.includes('beverage') || name.includes('bar') || 
            name.includes('cocktail') || name.includes('mocktail') || name.includes('เครื่องดื่ม') || 
            name.includes('กาแฟ') || name.includes('ชา') || name.includes('เบียร์') || 
            name.includes('เหล้า') || name.includes('น้ำ')
        ) {
            return 'bar';
        }
        return 'kitchen';
    };

    useEffect(() => {
        const fetchCats = async () => {
            try {
                const { data, error } = await supabase
                    .from('menu_categories')
                    .select('*')
                    .order('display_order');
                if (!error && data) {
                    setAllCategories(data);
                }
            } catch (err) {
                console.error("Failed to fetch menu categories:", err);
            }
        };
        fetchCats();
    }, []);

    // Auto-populate default category routing if any categories are unassigned or empty
    useEffect(() => {
        if (allCategories.length === 0) return;

        const currentKitchen = printerConfig.kitchen_categories || [];
        const currentBar = printerConfig.bar_categories || [];
        const assignedIds = new Set([...currentKitchen, ...currentBar]);

        const unassigned = allCategories.filter(cat => !assignedIds.has(cat.id));
        if (unassigned.length > 0) {
            const newKitchen = [...currentKitchen];
            const newBar = [...currentBar];

            unassigned.forEach(cat => {
                const target = defaultRouteCategory(cat);
                if (target === 'bar') {
                    if (!newBar.includes(cat.id)) newBar.push(cat.id);
                } else {
                    if (!newKitchen.includes(cat.id)) newKitchen.push(cat.id);
                }
            });

            const autoUpdated = {
                ...printerConfig,
                kitchen_categories: newKitchen,
                bar_categories: newBar
            };
            setPrinterConfig(autoUpdated);
            localStorage.setItem('onhaus_printer_config', JSON.stringify(autoUpdated));
            (async () => {
                try {
                    await supabase.from('app_settings').upsert({
                        key: 'printer_config',
                        value: JSON.stringify(autoUpdated)
                    });
                } catch (err) {
                    console.error("Auto printer routing save err:", err);
                }
            })();
        }
    }, [allCategories, printerConfig.kitchen_categories, printerConfig.bar_categories]);

    const handleCategoryDragStart = (e, catId) => {
        e.dataTransfer.setData('text/plain', catId);
    };

    const handleCategoryDragOver = (e, column) => {
        e.preventDefault();
        if (draggedOverColumn !== column) {
            setDraggedOverColumn(column);
        }
    };

    const handleCategoryDrop = (e, targetColumn) => {
        e.preventDefault();
        setDraggedOverColumn(null);
        const catId = e.dataTransfer.getData('text/plain');
        if (!catId) return;

        let newKitchen = [...(printerConfig.kitchen_categories || [])];
        let newBar = [...(printerConfig.bar_categories || [])];

        newKitchen = newKitchen.filter(id => id !== catId);
        newBar = newBar.filter(id => id !== catId);

        if (targetColumn === 'kitchen') {
            newKitchen.push(catId);
        } else if (targetColumn === 'bar') {
            newBar.push(catId);
        }

        const updated = {
            ...printerConfig,
            kitchen_categories: newKitchen,
            bar_categories: newBar
        };
        handleSavePrinter(updated);
    };

    const handleAssignCategory = (catId, target) => {
        let newKitchen = [...(printerConfig.kitchen_categories || [])];
        let newBar = [...(printerConfig.bar_categories || [])];

        newKitchen = newKitchen.filter(id => id !== catId);
        newBar = newBar.filter(id => id !== catId);

        if (target === 'kitchen') {
            newKitchen.push(catId);
        } else if (target === 'bar') {
            newBar.push(catId);
        }

        const updated = {
            ...printerConfig,
            kitchen_categories: newKitchen,
            bar_categories: newBar
        };
        handleSavePrinter(updated);
    };

    const handleRemoveCategory = (catId, source) => {
        let newKitchen = [...(printerConfig.kitchen_categories || [])];
        let newBar = [...(printerConfig.bar_categories || [])];

        if (source === 'kitchen') {
            newKitchen = newKitchen.filter(id => id !== catId);
        } else if (source === 'bar') {
            newBar = newBar.filter(id => id !== catId);
        }

        const updated = {
            ...printerConfig,
            kitchen_categories: newKitchen,
            bar_categories: newBar
        };
        handleSavePrinter(updated);
    };

    // Kitchen Cutoff Category Helpers & Live Status
    const getKitchenClosedCategoryIds = () => {
        try {
            if (!settings.qr_kitchen_closed_categories) return [];
            const parsed = typeof settings.qr_kitchen_closed_categories === 'string'
                ? JSON.parse(settings.qr_kitchen_closed_categories)
                : settings.qr_kitchen_closed_categories;
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.warn('Error parsing qr_kitchen_closed_categories:', e);
        }

        const fallbackIds = allCategories
            .filter(c => c.hide_on_kitchen_close === true)
            .map(c => c.id);
        return fallbackIds;
    };

    const isKitchenCurrentlyClosed = () => {
        const mode = settings.qr_kitchen_mode || 'auto';
        if (mode === 'force_close') return true;
        if (mode === 'force_open') return false;
        if (settings.qr_kitchen_cutoff_enabled === 'false') return false;

        const openTimeStr = settings.qr_kitchen_open_time || settings.opening_time || '10:00';
        const [openH, openM] = openTimeStr.split(':').map(Number);
        const closeTimeStr = settings.qr_kitchen_close_time || '22:00';
        const [closeH, closeM] = closeTimeStr.split(':').map(Number);

        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const openMins = (openH ?? 10) * 60 + (openM || 0);
        const closeMins = (closeH ?? 22) * 60 + (closeM || 0);

        if (closeMins > openMins) {
            // e.g. Open 10:00 - 22:00 -> Closed before 10:00 AM or after 22:00 PM
            return currentMins < openMins || currentMins >= closeMins;
        } else {
            return currentMins < openMins && currentMins >= closeMins;
        }
    };

    const handleToggleKitchenCutoffCategory = async (catId) => {
        const currentList = getKitchenClosedCategoryIds();
        const exists = currentList.includes(catId);
        const nextList = exists ? currentList.filter(id => id !== catId) : [...currentList, catId];
        const nextListStr = JSON.stringify(nextList);
        
        await handleSave('qr_kitchen_closed_categories', nextListStr);
        
        try {
            await supabase.from('menu_categories').update({ hide_on_kitchen_close: !exists }).eq('id', catId);
            setAllCategories(prev => prev.map(c => c.id === catId ? { ...c, hide_on_kitchen_close: !exists } : c));
        } catch (err) {
            console.warn('Sync hide_on_kitchen_close to menu_categories err:', err);
        }
    };

    const handleSelectAllKitchenCategories = async () => {
        const kitchenCatIds = allCategories
            .filter(c => defaultRouteCategory(c) === 'kitchen')
            .map(c => c.id);
        const nextListStr = JSON.stringify(kitchenCatIds);
        await handleSave('qr_kitchen_closed_categories', nextListStr);

        try {
            await supabase.from('menu_categories').update({ hide_on_kitchen_close: true }).in('id', kitchenCatIds);
            const barCatIds = allCategories.filter(c => defaultRouteCategory(c) === 'bar').map(c => c.id);
            if (barCatIds.length > 0) {
                await supabase.from('menu_categories').update({ hide_on_kitchen_close: false }).in('id', barCatIds);
            }
            setAllCategories(prev => prev.map(c => ({
                ...c,
                hide_on_kitchen_close: kitchenCatIds.includes(c.id)
            })));
        } catch (err) {
            console.warn('Sync hide_on_kitchen_close err:', err);
        }
    };

    const handleSelectAllCategoriesForCutoff = async () => {
        const allIds = allCategories.map(c => c.id);
        await handleSave('qr_kitchen_closed_categories', JSON.stringify(allIds));
        try {
            await supabase.from('menu_categories').update({ hide_on_kitchen_close: true }).in('id', allIds);
            setAllCategories(prev => prev.map(c => ({ ...c, hide_on_kitchen_close: true })));
        } catch (e) {}
    };

    const handleClearAllCutoffCategories = async () => {
        await handleSave('qr_kitchen_closed_categories', JSON.stringify([]));
        try {
            const allIds = allCategories.map(c => c.id);
            if (allIds.length > 0) {
                await supabase.from('menu_categories').update({ hide_on_kitchen_close: false }).in('id', allIds);
            }
            setAllCategories(prev => prev.map(c => ({ ...c, hide_on_kitchen_close: false })));
        } catch (e) {}
    };

    useEffect(() => {
        const loadPrinterConfig = async () => {
            // 1. Try reading local storage first
            const stored = localStorage.getItem('onhaus_printer_config');
            if (stored) {
                try {
                    setPrinterConfig(JSON.parse(stored));
                } catch (err) {
                    console.error("Error reading stored printer settings:", err);
                }
            }

            // 2. Fetch online settings from Supabase app_settings
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'printer_config')
                    .maybeSingle();

                if (data && data.value) {
                    const onlineConfig = JSON.parse(data.value);
                    setPrinterConfig(onlineConfig);
                    localStorage.setItem('onhaus_printer_config', JSON.stringify(onlineConfig));
                }
            } catch (err) {
                console.error("Failed to load printer config online:", err);
            }
        };

        loadPrinterConfig();
    }, []);

    const handleSavePrinter = async (updatedConfig) => {
        setPrinterConfig(updatedConfig);
        localStorage.setItem('onhaus_printer_config', JSON.stringify(updatedConfig));

        try {
            await supabase.from('app_settings').upsert({
                key: 'printer_config',
                value: JSON.stringify(updatedConfig)
            });
            toast.success("บันทึกการตั้งค่าหมวดหมู่และเครื่องพิมพ์ออนไลน์สำเร็จ");
        } catch (err) {
            console.error("Failed to sync printer config online:", err);
        }
    };

    const handleTestPrint = async (type) => {
        const name = type === 'cashier' ? 'Cashier Thermal Printer' : 'Kitchen Thermal Printer';
        const configType = type === 'cashier' ? printerConfig.cashier_printer_type : printerConfig.kitchen_printer_type;
        const configSize = type === 'cashier' ? printerConfig.cashier_paper_size : printerConfig.kitchen_paper_size;
        const configIp = type === 'cashier' ? printerConfig.cashier_printer_ip : printerConfig.kitchen_printer_ip;
        const configPort = type === 'cashier' ? printerConfig.cashier_printer_port : printerConfig.kitchen_printer_port;
        const configBt = type === 'cashier' ? printerConfig.cashier_printer_bt_name : printerConfig.kitchen_printer_bt_name;

        if (configType === 'sunmi') {
            try {
                const dummyReport = {
                    staffName: 'Admin Test',
                    totalBookings: 5,
                    totalItems: 12,
                    grossRevenue: 2450,
                    discounts: 150,
                    cashRevenue: 1300,
                    qrRevenue: 1000,
                    netRevenue: 2300
                };
                const rawBytes = encodeShiftReportData(dummyReport, '80mm', 'sunmi');
                await printToSunmiBuiltIn(rawBytes);
                alert(`✅ ทดสอบพิมพ์ผ่านเครื่องพิมพ์ SUNMI ในตัวสำเร็จ!`);
            } catch (err) {
                console.error("Test SUNMI print failed:", err);
                alert(`❌ SUNMI Print Error: ${err.message || err}`);
            }
        } else if (configType === 'rawbt') {
            try {
                // Generate simple test ESC/POS bytes
                const dummyReport = {
                    staffName: 'Admin Test',
                    totalBookings: 5,
                    totalItems: 12,
                    grossRevenue: 2450,
                    discounts: 150,
                    cashRevenue: 1300,
                    qrRevenue: 1000,
                    netRevenue: 2300
                };
                const rawBytes = encodeShiftReportData(dummyReport, configSize, 'rawbt');
                
                alert(`📤 ส่งข้อมูลพิมพ์ทดสอบไปที่แอป RawBT...\n(กรุณาเช็คว่าเปิดแอป RawBT และเปิดสิทธิ์ 'WebSocket Server' ในแอปแล้ว)`);
                await printToRawBTWebSocket(rawBytes);
                alert(`✅ ทดสอบพิมพ์ผ่าน RawBT สำเร็จ!`);
            } catch (err) {
                console.error("Test RawBT print failed:", err);
                alert(`❌ RawBT Print Error: ${err.message || err}`);
            }
        } else if (configType === 'bluetooth') {
            try {
                // Generate simple test ESC/POS bytes
                const dummyReport = {
                    staffName: 'Admin Test',
                    totalBookings: 5,
                    totalItems: 12,
                    grossRevenue: 2450,
                    discounts: 150,
                    cashRevenue: 1300,
                    qrRevenue: 1000,
                    netRevenue: 2300
                };
                const rawBytes = encodeShiftReportData(dummyReport, '58mm', 'bluetooth');
                
                alert(`📤 Connecting to Bluetooth printer [${configBt}]...\n(Please make sure Bluetooth is enabled and the printer is powered on)`);
                
                await printToBluetoothDirect(configBt, rawBytes);
                alert(`✅ Test print sent successfully to [${configBt}]!`);
            } catch (err) {
                console.error("Test bluetooth print failed:", err);
                alert(`❌ Bluetooth Print Error: ${err.message || err}\n\nMake sure the device matches, is turned on, and you have paired it once.`);
            }
        } else if (configType === 'universal') {
            try {
                const htmlContent = `
                    <html>
                        <head>
                            <title>Test Print</title>
                            <style>
                                @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                                body { 
                                    font-family: 'Courier Prime', 'Courier New', monospace; 
                                    background: white; 
                                    color: black; 
                                    font-size: 11px; 
                                    padding: 20px 10px;
                                    text-align: center;
                                    width: 280px;
                                }
                                .header { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
                                .divider { border-top: 1px dashed black; margin: 10px 0; }
                            </style>
                        </head>
                        <body>
                            <div class="header">IN THE HAUS</div>
                            <div>TEST RECEIPT / ใบทดสอบระบบพิมพ์</div>
                            <div>Type: UNIVERSAL (${configSize})</div>
                            <div class="divider"></div>
                            <div>Date: ${new Date().toLocaleString('th-TH')}</div>
                            <div>Status: SUCCESS / เชื่อมต่อสำเร็จ</div>
                            <div class="divider"></div>
                            <div style="font-size: 9px; color: #555;">smallfry.world</div>
                        </body>
                    </html>
                `;

                if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Printer')) {
                    await Printer.printHtml({
                        name: `TestPrint-${Date.now()}`,
                        html: htmlContent
                    });
                } else {
                    // Browser fallback
                    const printWindow = window.open('', '_blank', 'width=400,height=600');
                    if (printWindow) {
                        printWindow.document.write(htmlContent);
                        printWindow.document.close();
                    } else {
                        const iframe = document.createElement('iframe');
                        iframe.style.position = 'fixed';
                        iframe.style.right = '0';
                        iframe.style.bottom = '0';
                        iframe.style.width = '0';
                        iframe.style.height = '0';
                        iframe.style.border = '0';
                        document.body.appendChild(iframe);
                        
                        iframe.contentDocument.write(htmlContent);
                        iframe.contentDocument.close();
                        iframe.onload = () => {
                            iframe.contentWindow.focus();
                            iframe.contentWindow.print();
                            setTimeout(() => {
                                document.body.removeChild(iframe);
                            }, 1000);
                        };
                    }
                }
            } catch (err) {
                console.error("Test universal print failed:", err);
                alert(`❌ Universal Print Error: ${err.message || err}`);
            }
        } else {
            let details = `Type: ${configType.toUpperCase()}, Size: ${configSize}`;
            if (configType === 'lan') {
                details += ` (IP: ${configIp}:${configPort})`;
            }
            alert(`📤 [Test Print Simulation]\nConfigured as [${name}]\n(${details})\n\nConnection check: OK!`);
        }
    };

    const handleScanBluetooth = async (type) => {
        setScanningTargetType(type);
        setScannedDevices([]);
        setIsScanning(true);

        try {
            if (Capacitor.isNativePlatform()) {
                await BleClient.initialize();
                
                await BleClient.requestLEScan(
                    {},
                    (result) => {
                        if (result.device && result.device.name) {
                            setScannedDevices(prev => {
                                if (prev.some(d => d.deviceId === result.device.deviceId)) return prev;
                                return [...prev, { name: result.device.name, deviceId: result.device.deviceId }];
                            });
                        }
                    }
                );

                setTimeout(async () => {
                    try {
                        await BleClient.stopLEScan();
                    } catch (e) {}
                }, 10000);

            } else {
                if (!navigator.bluetooth) {
                    alert("อุปกรณ์นี้ไม่รองรับ Web Bluetooth (ต้องเปิดใช้บน HTTPS หรือรันผ่านแอป Native)");
                    setIsScanning(false);
                    return;
                }
                const device = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: [
                        '00001101-0000-1000-8000-00805f9b34fb',
                        '0000fee7-0000-1000-8000-00805f9b34fb',
                        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                        '0000e7e7-0000-1000-8000-00805f9b34fb'
                    ]
                });
                if (device && device.name) {
                    const updated = type === 'cashier' 
                        ? { ...printerConfig, cashier_printer_bt_name: device.name }
                        : { ...printerConfig, kitchen_printer_bt_name: device.name };
                    handleSavePrinter(updated);
                    alert(`✅ เลือกเครื่องพิมพ์สำเร็จ: ${device.name}`);
                }
                setIsScanning(false);
            }
        } catch (err) {
            console.error("Bluetooth scan failed:", err);
            setIsScanning(false);
            if (err.name !== 'NotFoundError' && err.message !== 'User cancelled') {
                alert(`ไม่สามารถสแกนบลูทูธได้: ${err.message || err}\nโปรดเช็คว่าได้เปิด Bluetooth และสิทธิ์ของ Location บนเครื่องแท็บเล็ตแล้ว`);
            }
        }
    };

    const handleSelectDevice = async (device) => {
        try {
            if (Capacitor.isNativePlatform()) {
                await BleClient.stopLEScan();
            }
        } catch (e) {}

        const updated = scanningTargetType === 'cashier' 
            ? { ...printerConfig, cashier_printer_bt_name: device.name }
            : { ...printerConfig, kitchen_printer_bt_name: device.name };
        
        handleSavePrinter(updated);
        setIsScanning(false);
        alert(`✅ เลือกเครื่องพิมพ์สำเร็จ: ${device.name}`);
    };

    const handleCancelScan = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                await BleClient.stopLEScan();
            }
        } catch (e) {}
        setIsScanning(false);
    };

    // Load Settings & Realtime Subscriptions
    useEffect(() => { 
        fetchSettings();
        fetchStoreSettings();

        let debounceTimer = null;
        const debouncedReload = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchSettings();
                fetchStoreSettings();
            }, 400);
        };

        const channel = supabase
            .channel('admin-settings-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, debouncedReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, debouncedReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_dates' }, debouncedReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, debouncedReload)
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [])

    const fetchStoreSettings = async () => {
        const { data } = await supabase.from('store_settings').select('target_food_cost_pct').single();
        if (data) setTargetFoodCost(data.target_food_cost_pct || 30);
    };

    const handleSaveStoreSetting = async (key, value) => {
         // Optimistic
         if (key === 'target_food_cost_pct') setTargetFoodCost(value);

         try {
             const { error } = await supabase.from('store_settings').update({ [key]: value }).eq('id', 1); // Singleton ID 1
             if (error) throw error;
         } catch (err) {
             console.error(err);
             alert('Failed to save store setting'); // Changed toast.error to alert
             fetchStoreSettings();
         }
    };

    const fetchSettings = async () => {
        const { data } = await supabase.from('app_settings').select('key, value').not('key', 'in', '("tax_signature_image")')
        if (data) {
            const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {})
            // Merge กับค่า default เพื่อป้องกัน undefined
            setSettings(prev => ({ ...prev, ...map }))
            if (map.crm_tiers_config) {
                setEditableTiers(parseTiersConfig(map.crm_tiers_config))
            }
        }

        // Fetch Blocked Dates
        const { data: bd } = await supabase.from('blocked_dates').select('*').order('blocked_date', { ascending: true })
        setBlockedList(bd || [])
    }

    // Dynamic Tiers Management Handlers
    const handleTierFieldChange = (index, field, value) => {
        setEditableTiers(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleAddTier = () => {
        setEditableTiers(prev => {
            const lastTier = prev[prev.length - 1];
            const nextMinSpend = lastTier ? (parseFloat(lastTier.min_spend) || 0) + 4000 : 0;
            const nextMultiplier = lastTier ? (parseFloat(lastTier.multiplier) || 1.0) + 0.25 : 1.0;
            const nextLevel = String(prev.length + 1).padStart(2, '0');
            const themeOptions = ['bronze', 'silver', 'gold', 'emerald'];
            const nextTheme = themeOptions[prev.length % themeOptions.length];
            const newTier = {
                id: `tier_${Date.now()}`,
                level_code: nextLevel,
                name: `Tier ${prev.length + 1}`,
                min_spend: nextMinSpend,
                multiplier: nextMultiplier,
                tagline: 'ระดับสมาชิกใหม่',
                condition_text: `มียอดจ่ายสะสมสุทธิครบ ${nextMinSpend.toLocaleString()} บาทภายใน ${settings.crm_tier_eval_months || 12} เดือน`,
                badge_theme: nextTheme
            };
            return [...prev, newTier];
        });
    };

    const handleDeleteTier = (index) => {
        if (editableTiers.length <= 1) {
            alert('ต้องมีระดับความสัมพันธ์อย่างน้อย 1 ระดับในระบบ');
            return;
        }
        if (!confirm(`ต้องการลบระดับ "${editableTiers[index].name}" หรือไม่?`)) return;
        setEditableTiers(prev => prev.filter((_, i) => i !== index));
    };

    const handleResetTiers = () => {
        if (!confirm('ต้องการคืนค่าระดับความสัมพันธ์ทั้งหมดกลับเป็นค่าเริ่มต้นระบบหรือไม่?')) return;
        setEditableTiers([...DEFAULT_CRM_TIERS]);
    };

    const handleSaveTiers = async () => {
        setIsTiersSaving(true);
        try {
            const normalized = parseTiersConfig(editableTiers);
            setEditableTiers(normalized);
            const jsonStr = JSON.stringify(normalized);
            await handleSave('crm_tiers_config', jsonStr);
            alert('✅ บันทึกการตั้งค่าระดับความสัมพันธ์ (Relationship Tiers) สำเร็จ!');
        } catch (err) {
            console.error("Save tiers error:", err);
            alert('❌ บันทึกระดับสมาชิกล้มเหลว: ' + (err.message || err));
        } finally {
            setIsTiersSaving(false);
        }
    };

    // Save Function (แก้ใหม่ให้ลื่นขึ้น)
    const handleSave = async (key, value) => {
        // 1. อัปเดตหน้าจอทันที (UI Optimistic Update)
        setSettings(prev => ({ ...prev, [key]: value }))

        // 2. ส่งค่าไป Database เงียบๆ
        try {
            const { error } = await supabase.from('app_settings').upsert({ key, value: String(value) })
            if (error) throw error
        } catch (err) {
            console.error(err)
            alert('บันทึกไม่สำเร็จ โปรดลองใหม่')
            fetchSettings() // ถ้าพัง ให้โหลดค่าเดิมกลับมา
        }
    }

    // Upload Function
    const handleUpload = async (file, settingKey, loadingSetter) => {
        if (!file) return
        loadingSetter(true)
        try {
            // 1. อัปโหลดทับไฟล์เดิม (ใช้ upsert: true)
            const fileExt = file.name.split('.').pop()
            const fileName = `${settingKey}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(fileName, file, { upsert: true })

            if (uploadError) throw uploadError

            // 2. ได้ URL มา
            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName)

            // 3. บันทึก URL ผ่าน handleSave เพื่อความ Consistent
            await handleSave(settingKey, publicUrl)

            // 4. อัปเดต timestamp
            setTimestamp(Date.now())

            alert('อัปเดตเรียบร้อย!')
        } catch (error) {
            alert('Error: ' + error.message)
        } finally {
            loadingSetter(false)
        }
    }

    // Helper: Create range array
    const getDatesInRange = (startDate, endDate) => {
        const dates = []
        let currentDate = new Date(startDate)
        const stopDate = new Date(endDate)
        while (currentDate <= stopDate) {
            dates.push(currentDate.toISOString().split('T')[0])
            currentDate.setDate(currentDate.getDate() + 1)
        }
        return dates
    }

    const handleBlockDates = async (e) => {
        e.preventDefault()
        if (!blockForm.startDate) return alert('Select start date')

        // Use startDate as endDate if endDate is empty (Single day block)
        const finalEndDate = blockForm.endDate || blockForm.startDate

        if (new Date(blockForm.startDate) > new Date(finalEndDate)) {
            return alert('Start date must be before end date')
        }

        try {
            const datesToBlock = getDatesInRange(blockForm.startDate, finalEndDate)
            const payload = datesToBlock.map(dateStr => ({
                blocked_date: dateStr,
                reason: blockForm.reason || 'Closed'
            }))

            // UPSERT with ignoreDuplicates
            const { error } = await supabase
                .from('blocked_dates')
                .upsert(payload, { onConflict: 'blocked_date', ignoreDuplicates: true })

            if (error) throw error

            setBlockForm({ startDate: '', endDate: '', reason: '' })
            fetchSettings()
            alert(`Blocked ${datesToBlock.length} dates successfully!`)
        } catch (err) { alert(err.message) }
    }

    const handleDeleteBlockedDate = async (id) => {
        if (!confirm('Unblock this date?')) return
        const { error } = await supabase.from('blocked_dates').delete().eq('id', id)
        if (!error) fetchSettings()
    }

    return (
        <div className="max-w-7xl mx-auto pb-6 animate-fade-in px-4 pt-1 text-[#1A1A1A]">
            {/* Back Navigation Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-3 font-sans">
                <button 
                    type="button"
                    onClick={() => window.location.href = '/pos'}
                    className="flex items-center gap-1.5 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-zinc-200 cursor-pointer shadow-sm animate-none"
                >
                    ← Back to POS (กลับหน้า POS)
                </button>
                <button 
                    type="button"
                    onClick={() => window.location.href = '/staff'}
                    className="flex items-center gap-1.5 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-zinc-200 cursor-pointer shadow-sm animate-none"
                >
                    ← Back to Staff (กลับหน้า Staff)
                </button>
            </div>

            <div className="flex items-center justify-between mb-3 gap-2">
                <h1 className="text-xl font-bold text-ink tracking-tight">System Settings</h1>
                <InstallPWA />
            </div>

            {/* Tabs Control - High-Contrast Dieter Rams & Thai Modern Nav */}
            <div className="bg-[#F5F5F2] p-2 rounded-2xl border border-[#D1D1CD] shadow-sm mb-6 flex flex-wrap gap-1.5">
                {[
                    { id: 'booking', label: '🍽 ตั้งค่าร้าน & การจอง', desc: 'CORE & BOOKING', icon: Power },
                    { id: 'link', label: '🔗 Landing Page', desc: 'LINK MANAGER', icon: FileText },
                    { id: 'checkins', label: '📸 เช็กอิน / รีวิว', desc: 'REVIEWS', icon: Heart },
                    { id: 'integrations', label: '⚙️ APIs & QR', desc: 'INTEGRATIONS', icon: Terminal },
                    { id: 'printers', label: '🖨 เครื่องพิมพ์ & สลิป', desc: 'HARDWARE & RECEIPTS', icon: QrCode },
                    { id: 'crm', label: '🪙 CRM & xhaus Coins', desc: 'LOYALTY PROGRAM', icon: Coins },
                    { id: 'data_purge', label: '🧹 ล้างข้อมูลทดสอบ', desc: 'GO-LIVE RESET', icon: Trash2 },
                    { id: 'debug', label: '🔧 Debug Logs', desc: 'SYSTEM LOGS', icon: AlertTriangle }
                ].map(tab => {
                    const IconComp = tab.icon;
                    const isActive = activeSettingsTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveSettingsTab(tab.id)}
                            className={`flex-1 min-w-[150px] px-3.5 py-3 rounded-xl font-bold text-left transition-all cursor-pointer flex items-center gap-3 border ${
                                isActive
                                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-md ring-2 ring-black/10'
                                    : 'bg-white text-[#1A1A1A] border-[#D1D1CD] hover:bg-[#EFEFED] hover:border-[#1A1A1A]'
                            }`}
                        >
                            <div className={`p-2 rounded-lg flex items-center justify-center shrink-0 border ${
                                isActive 
                                    ? 'bg-[#ff0000] text-white border-red-600 shadow-sm' 
                                    : 'bg-[#F0F0EC] text-[#1A1A1A] border-[#D1D1CD]'
                            }`}>
                                <IconComp size={16} strokeWidth={2.2} />
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs font-bold leading-tight block truncate">{tab.label}</span>
                                <span className={`text-[9px] font-mono tracking-wider block truncate mt-0.5 font-bold ${
                                    isActive ? 'text-[#ff9999]' : 'text-[#767673]'
                                }`}>
                                    {tab.desc}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: Booking & Core Settings - Seamless Google Workspace Style Layout */}
            {activeSettingsTab === 'booking' && (
                <div className="space-y-6 animate-fade-in">
                    
                    {/* Top Row: Master Switches & Status Controls */}
                    {/* Row 1: Unified Shop Status Controls & Visual Calendar Blocker */}
                    <div className="grid lg:grid-cols-12 gap-6">
                        
                        {/* Column 1: Unified Shop Status & Operating Hours (5 cols) */}
                        <div className="lg:col-span-5 space-y-6">
                            
                            {/* Unified Shop Status Control Card */}
                            <div className="bg-white p-6 rounded-2xl border border-[oklch(85%_0.012_28)] shadow-2xs space-y-5">
                                <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] rounded-xl">
                                            <Power size={18} />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                                SHOP STATUS CONTROLS
                                            </h2>
                                            <p className="text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                                                สถานะเปิด-ปิด 3 บริการหลักของร้าน
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Table Booking Status */}
                                <div className="space-y-2">
                                    <label className="text-xs font-mono font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider block">
                                        🍽 Table Booking (จองโต๊ะทานที่ร้าน)
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                                        {[
                                            { mode: 'auto', label: 'Auto (ตามเวลา)', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
                                            { mode: 'manual_open', label: 'Manual Open', color: 'bg-blue-50 text-blue-800 border-blue-300' },
                                            { mode: 'manual_close', label: 'Manual Close', color: 'bg-red-50 text-red-800 border-red-300' }
                                        ].map(({ mode, label, color }) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => handleSave('shop_mode_table', mode)}
                                                className={`py-2 px-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer text-center select-none ${
                                                    settings.shop_mode_table === mode
                                                        ? `${color} ring-2 ring-black/10 shadow-xs font-extrabold`
                                                        : 'bg-[oklch(97%_0.008_28)] border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Pickup Status */}
                                <div className="space-y-2 pt-2 border-t border-[oklch(85%_0.012_28)]">
                                    <label className="text-xs font-mono font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider block">
                                        🛍 Pickup Online (สั่งรับกลับบ้าน)
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                                        {[
                                            { mode: 'auto', label: 'Auto (ตามเวลา)', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
                                            { mode: 'manual_open', label: 'Manual Open', color: 'bg-blue-50 text-blue-800 border-blue-300' },
                                            { mode: 'manual_close', label: 'Manual Close', color: 'bg-red-50 text-red-800 border-red-300' }
                                        ].map(({ mode, label, color }) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => handleSave('shop_mode_pickup', mode)}
                                                className={`py-2 px-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer text-center select-none ${
                                                    settings.shop_mode_pickup === mode
                                                        ? `${color} ring-2 ring-black/10 shadow-xs font-extrabold`
                                                        : 'bg-[oklch(97%_0.008_28)] border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* HAUSMADE Shop Status */}
                                <div className="space-y-2 pt-2 border-t border-[oklch(85%_0.012_28)]">
                                    <label className="text-xs font-mono font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider block">
                                        📦 HAUSMADE Shop (สินค้าออนไลน์)
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                                        {[
                                            { mode: 'auto', label: 'Auto (ตามเวลา)', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
                                            { mode: 'manual_open', label: 'Manual Open', color: 'bg-blue-50 text-blue-800 border-blue-300' },
                                            { mode: 'manual_close', label: 'Manual Close', color: 'bg-red-50 text-red-800 border-red-300' }
                                        ].map(({ mode, label, color }) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => handleSave('shop_mode_hausmade', mode)}
                                                className={`py-2 px-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer text-center select-none ${
                                                    (settings.shop_mode_hausmade || 'manual_close') === mode
                                                        ? `${color} ring-2 ring-black/10 shadow-xs font-extrabold`
                                                        : 'bg-[oklch(97%_0.008_28)] border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Schedule Hours */}
                                <div className="pt-3 border-t border-[oklch(85%_0.012_28)]">
                                    <p className="text-[11px] font-mono text-[oklch(55%_0.010_28)] mb-2">
                                        * กำหนดเวลาเปิด-ปิดสำหรับโหมด Auto
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-mono font-bold text-[oklch(18%_0.012_28)] uppercase mb-1">
                                                เวลาเปิดร้าน (Opens)
                                            </label>
                                            <input
                                                type="time"
                                                value={settings.opening_time || '11:00'}
                                                onChange={(e) => handleSave('opening_time', e.target.value)}
                                                className="w-full bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-2 rounded-lg text-xs font-mono font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-[oklch(18%_0.012_28)]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-mono font-bold text-[oklch(18%_0.012_28)] uppercase mb-1">
                                                เวลาปิดร้าน (Closes)
                                            </label>
                                            <input
                                                type="time"
                                                value={settings.closing_time || '22:00'}
                                                onChange={(e) => handleSave('closing_time', e.target.value)}
                                                className="w-full bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-2 rounded-lg text-xs font-mono font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-[oklch(18%_0.012_28)]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Default VAT Toggle */}
                                <div className="pt-3 border-t border-[oklch(85%_0.012_28)]">
                                    <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                        settings.default_vat_enabled === 'true'
                                            ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-400'
                                            : 'bg-[oklch(97%_0.008_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                                                <TrendingUp size={16} />
                                            </div>
                                            <div>
                                                <span className="block font-mono font-bold text-xs text-[oklch(18%_0.012_28)]">
                                                    Default VAT 7%
                                                </span>
                                                <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                                    ภาษีมูลค่าเพิ่ม 7% เริ่มต้นของร้าน
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 ${settings.default_vat_enabled === 'true' ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform duration-300 ${settings.default_vat_enabled === 'true' ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={settings.default_vat_enabled === 'true'}
                                            onChange={(e) => handleSave('default_vat_enabled', e.target.checked ? 'true' : 'false')}
                                        />
                                    </label>
                                </div>

                            </div>
                        </div>

                        {/* Column 2: Blocked Dates Studio (7 cols) */}
                        <div className="lg:col-span-7">
                            <VisualCalendarBlocker
                                blockedList={blockedList}
                                onRefresh={fetchSettings}
                            />
                        </div>

                    </div>

                    {/* Announcement Card Settings */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div>
                                <h2 className="text-base font-bold text-gray-900">Announcement & Store Policies</h2>
                                <p className="text-xs text-gray-500">จัดการข้อความประกาศ เงื่อนไขการสั่ง และรอบเวลาบริการ</p>
                            </div>
                            <button
                                onClick={async () => {
                                    await handleSave('announcement_headline', settings.announcement_headline)
                                    await handleSave('announcement_detail', settings.announcement_detail)
                                    await handleSave('booking_min_spend', settings.booking_min_spend)
                                    await handleSave('booking_min_advance_hours', settings.booking_min_advance_hours)
                                    await handleSave('pickup_min_advance_hours', settings.pickup_min_advance_hours)
                                    await handleSave('booking_time_slots', settings.booking_time_slots)
                                    await handleSave('policy_dine_in', settings.policy_dine_in)
                                    await handleSave('policy_pickup', settings.policy_pickup)
                                    await handleSave('contact_phone', settings.contact_phone)
                                    await handleSave('contact_map_url', settings.contact_map_url)
                                    alert('บันทึกการตั้งค่าเรียบร้อย!')
                                }}
                                className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-transform active:scale-95 shadow cursor-pointer"
                            >
                                <Save size={16} /> บันทึกการตั้งค่า
                            </button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Headline (หัวข้อข่าวประกาศ)</label>
                                <input
                                    type="text"
                                    value={settings.announcement_headline || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, announcement_headline: e.target.value }))}
                                    placeholder="เช่น BY ร้านในบ้าน"
                                    className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-black"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Detail (ข้อความวิ่ง Marquee)</label>
                                <input
                                    type="text"
                                    value={settings.announcement_detail || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, announcement_detail: e.target.value }))}
                                    placeholder="เช่น IN THE HAUS..."
                                    className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-sm text-gray-900 outline-none focus:border-black"
                                />
                            </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">เบอร์โทรติดต่อร้าน (Contact Phone)</label>
                                <input
                                    type="text"
                                    value={settings.contact_phone || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, contact_phone: e.target.value }))}
                                    placeholder="เช่น 0812345678"
                                    className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-sm font-mono text-gray-900 outline-none focus:border-black"
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Google Maps URL</label>
                                <input
                                    type="text"
                                    value={settings.contact_map_url || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, contact_map_url: e.target.value }))}
                                    placeholder="https://maps.google.com/..."
                                    className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-sm text-gray-900 outline-none focus:border-black"
                                />
                             </div>
                        </div>

                        {/* Policy & Rate Settings */}
                        <div className="pt-4 border-t border-gray-100 grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">ขั้นต่ำต่อท่าน (บาท)</label>
                                <input
                                    type="number"
                                    value={settings.booking_min_spend || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, booking_min_spend: e.target.value }))}
                                    placeholder="150"
                                    className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-black"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">จองล่วงหน้าขั้นต่ำ (ชั่วโมง)</label>
                                <input
                                    type="number"
                                    value={settings.booking_min_advance_hours || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, booking_min_advance_hours: e.target.value }))}
                                    placeholder="2"
                                    className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-black"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Pickup ล่วงหน้าขั้นต่ำ (ชั่วโมง)</label>
                                <input
                                    type="number"
                                    value={settings.pickup_min_advance_hours || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, pickup_min_advance_hours: e.target.value }))}
                                    placeholder="1"
                                    className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-black"
                                />
                            </div>
                        </div>

                        {/* Time Slot Studio */}
                        <div className="pt-2">
                            <TimeSlotStudio
                                value={settings.booking_time_slots || ''}
                                openingTime={settings.opening_time || '11:00'}
                                closingTime={settings.closing_time || '22:00'}
                                onChange={(newSlots) => setSettings(prev => ({ ...prev, booking_time_slots: newSlots }))}
                            />
                        </div>

                        {/* Active Hardcoded System Policies */}
                        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                                <ShieldCheck size={16} />
                                System Default Active Policies (เงื่อนไขการจองในระบบ)
                            </div>
                            <div className="grid md:grid-cols-2 gap-4 text-xs text-emerald-900">
                                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm space-y-1">
                                    <span className="font-bold text-emerald-800 block mb-1">🍽 Dine-in Policy (การจองโต๊ะทานที่ร้าน):</span>
                                    <p>• สั่งอาหารขั้นต่ำ 150 บาทต่อท่าน</p>
                                    <p>• ชำระมัดจำ 50% อัตโนมัติ (หักคืนให้อัตโนมัติจากบิลหน้าร้าน)</p>
                                    <p>• คืนมัดจำได้หากยกเลิกล่วงหน้าเกิน 24 ชั่วโมง</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm space-y-1">
                                    <span className="font-bold text-emerald-800 block mb-1">🛍 Pickup Policy (การสั่งกลับบ้าน):</span>
                                    <p>• ชำระเงินเต็มจำนวน 100% เท่านั้น</p>
                                    <p>• ไม่สามารถยกเลิกออเดอร์และขอคืนเงินได้ทุกกรณี</p>
                                </div>
                            </div>
                        </div>
                    </div>



                    {/* QR Payment, Floor Plan, Home Background - 3 Columns Layout! */}
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* QR Code Section */}
                        <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-ink mb-3">QR Payment</h2>
                                <div className="mb-4 flex justify-center bg-canvas p-4 rounded-2xl border border-gray-100">
                                    {settings.payment_qr_url ? (
                                        <img src={safeTimestampUrl(settings.payment_qr_url, timestamp)} className="w-32 h-32 object-cover rounded-xl border border-brand" />
                                    ) : (
                                        <div className="w-32 h-32 bg-gray-150 rounded-xl flex items-center justify-center text-subInk text-xs">No QR</div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block w-full cursor-pointer group">
                                    <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-3 text-center group-hover:border-brand transition-colors">
                                        <span className="text-subInk text-xs group-hover:text-ink">{uploadingQr ? 'Uploading...' : '📸 Click to replace QR'}</span>
                                    </div>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], 'payment_qr_url', setUploadingQr)} />
                                </label>
                                <p className="text-[9px] text-gray-400 mt-2 text-center">Square (1:1), Max 500KB</p>

                                <div className="mt-3 pt-3 border-t border-gray-150 space-y-2.5">
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase text-subInk mb-1">
                                            ชื่อบัญชีพร้อมเพย์ (Account Name)
                                        </label>
                                        <input
                                            type="text"
                                            value={settings.promptpay_name || ''}
                                            onChange={(e) => handleSave('promptpay_name', e.target.value)}
                                            className="w-full px-3 py-2 bg-canvas border border-gray-200 rounded-xl text-xs font-bold text-ink outline-none focus:border-brand"
                                            placeholder="เช่น อิน เดอะ เฮ้าส์ หรือ นาย สมชาย ใจดี"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase text-subInk mb-1">
                                            เบอร์พร้อมเพย์รับเงิน (PromptPay ID)
                                        </label>
                                        <input
                                            type="text"
                                            value={settings.promptpay_id || ''}
                                            onChange={(e) => handleSave('promptpay_id', e.target.value)}
                                            className="w-full px-3 py-2 bg-canvas border border-gray-200 rounded-xl text-xs font-bold text-ink outline-none focus:border-brand"
                                            placeholder="เช่น 0985284217 หรือ เลขประจำตัวผู้เสียภาษี 13 หลัก"
                                        />
                                    </div>
                                    <p className="text-[9px] text-gray-400">ใช้แสดงชื่อบัญชี เบอร์โทร และสร้าง Dynamic QR บนหน้าจอลูกค้า (CDS) และสลิป</p>
                                </div>
                            </div>
                        </div>

                        {/* Floor Plan Section */}
                        <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-ink mb-3">Floor Plan</h2>
                                <div className="mb-4 flex justify-center bg-canvas p-4 rounded-2xl border border-gray-100">
                                    {settings.floorplan_url ? (
                                        <img src={safeTimestampUrl(settings.floorplan_url, timestamp)} className="w-full h-32 object-cover rounded-xl border border-gray-100" />
                                    ) : (
                                        <div className="w-full h-32 bg-gray-150 rounded-xl flex items-center justify-center text-subInk text-xs">No Plan</div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block w-full cursor-pointer group">
                                    <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-3 text-center group-hover:border-brand transition-colors">
                                        <span className="text-subInk text-xs group-hover:text-ink">{uploadingFloor ? 'Uploading...' : '📸 Click to replace Floor Plan'}</span>
                                    </div>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], 'floorplan_url', setUploadingFloor)} />
                                </label>
                                <p className="text-[9px] text-gray-400 mt-2 text-center">Landscape (16:9), Max 2MB</p>
                            </div>
                        </div>

                        {/* Home Background Section */}
                        <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-ink mb-3">Home Background</h2>
                                <div className="mb-4 flex justify-center bg-canvas p-4 rounded-2xl border border-gray-100">
                                    {settings.home_background_url ? (
                                        <img src={safeTimestampUrl(settings.home_background_url, timestamp)} className="w-full h-32 object-cover rounded-xl border border-gray-100" />
                                    ) : (
                                        <div className="w-full h-32 bg-gray-150 rounded-xl flex items-center justify-center text-subInk text-xs">Default Background</div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block w-full cursor-pointer group">
                                    <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-3 text-center group-hover:border-brand transition-colors">
                                        <span className="text-subInk text-xs group-hover:text-ink">{uploadingHomeBg ? 'Uploading...' : '📸 Replace Background'}</span>
                                    </div>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], 'home_background_url', setUploadingHomeBg)} />
                                </label>
                                <div className="flex justify-between items-center mt-2 px-1">
                                     <p className="text-[9px] text-gray-400">1920x1080, Max 2MB</p>
                                     {settings.home_background_url && (
                                        <button 
                                            onClick={() => handleSave('home_background_url', '')}
                                            className="text-[9px] text-red-500 hover:text-red-400 underline cursor-pointer"
                                        >
                                            Reset
                                        </button>
                                     )}
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Data Maintenance Section */}
                    <div className="bg-paper p-8 rounded-3xl border border-gray-200 space-y-6 shadow-sm">
                        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                            <span className="text-red-500">⚠</span> Data Maintenance
                        </h2>
                        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-red-100 rounded-2xl bg-red-50/50 gap-4">
                            <div>
                                <h3 className="font-bold text-ink text-sm md:text-base">Clean Old Slips (&gt;180 Days)</h3>
                                <p className="text-xs text-subInk mt-1 leading-relaxed">
                                    ลบรูปสลิปที่เก่ากว่า 180 วัน (6 เดือน) ออกจาก Storage เพื่อประหยัดพื้นที่ (ข้อมูลการจองหลักยังอยู่ครบถ้วน)
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!window.confirm('Are you sure you want to delete slip images older than 180 days (6 months)?')) return

                                    try {
                                        setLoading(true)
                                        // 1. Calculate Date 180 Days Ago
                                        const d = new Date()
                                        d.setDate(d.getDate() - 180)
                                        const cutoffDate = d.toISOString()

                                        // 2. Find old bookings with slips
                                        const { data: oldBookings, error: fetchError } = await supabase
                                            .from('bookings')
                                            .select('id, payment_slip_url')
                                            .lt('booking_time', cutoffDate)
                                            .not('payment_slip_url', 'is', null)

                                        if (fetchError) throw fetchError
                                        if (!oldBookings || oldBookings.length === 0) {
                                            alert('No old slips found to clean.')
                                            return
                                        }

                                        // 3. Delete from Storage
                                        const filesToRemove = oldBookings.map(b => b.payment_slip_url)
                                        const { error: storageError } = await supabase.storage
                                            .from('slips')
                                            .remove(filesToRemove)

                                        if (storageError) throw storageError

                                        // 4. Update Database (Set payment_slip_url to null)
                                        const idsToUpdate = oldBookings.map(b => b.id)
                                        const { error: updateError } = await supabase
                                            .from('bookings')
                                            .update({ payment_slip_url: null })
                                            .in('id', idsToUpdate)

                                        if (updateError) throw updateError

                                        alert(`Cleaned up ${filesToRemove.length} old slips successfully!`)

                                    } catch (e) {
                                        console.error(e)
                                        alert('Error cleaning slips: ' + e.message)
                                    } finally {
                                        setLoading(false)
                                    }
                                }}
                                disabled={loading}
                                className="px-6 py-3 bg-white text-red-500 border border-red-200 rounded-xl font-bold hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer text-sm whitespace-nowrap self-start md:self-auto"
                            >
                                {loading ? 'Cleaning...' : 'Clean Now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Landing Page Settings */}
            {activeSettingsTab === 'link' && (
                <div className="animate-fade-in">
                    <LinkPageManager 
                        settings={settings} 
                        handleSave={handleSave} 
                        handleUpload={handleUpload}
                        timestamp={timestamp}
                        setTimestamp={setTimestamp}
                    />
                </div>
            )}

            {/* TAB 2.5: Check-in Stream Manager */}
            {activeSettingsTab === 'checkins' && (
                <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm animate-fade-in">
                    <CheckinManager />
                </div>
            )}

            {/* TAB 3: Integrations & APIs Settings */}
            {activeSettingsTab === 'integrations' && (
                <div className="grid lg:grid-cols-2 gap-6 animate-fade-in">
                    <div className="space-y-6">
                        {/* Pricing Strategy Config */}
                        <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                                 <TrendingUp size={20} className="text-blue-600" /> Pricing Strategy
                            </h2>
                             <div>
                                <label className="block text-xs font-bold text-subInk uppercase mb-1">Target Food Cost %</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1" max="100"
                                        value={targetFoodCost}
                                        onChange={(e) => handleSaveStoreSetting('target_food_cost_pct', parseFloat(e.target.value))}
                                        className="w-24 bg-canvas border border-gray-200 p-3 rounded-xl text-ink font-bold text-lg outline-none focus:border-blue-500 font-mono text-center"
                                    />
                                    <span className="text-ink font-bold">%</span>
                                    <div className="text-xs text-subInk ml-2">
                                        used to calculate recommended selling price. <br/>
                                        (e.g. Cost 30 / 30% = Price 100)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Spotify Song Request System Settings */}
                        <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                                 <span className="text-lg">🎵</span> Spotify Song Requests
                            </h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Spotify Client ID</label>
                                    <input
                                        type="text"
                                        value={settings.spotify_client_id || ''}
                                        onChange={(e) => setSettings(prev => ({ ...prev, spotify_client_id: e.target.value }))}
                                        onBlur={() => handleSave('spotify_client_id', settings.spotify_client_id)}
                                        className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-xs font-mono text-ink outline-none focus:border-brand"
                                        placeholder="Enter Spotify Client ID"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Spotify Client Secret</label>
                                    <input
                                        type="password"
                                        value={settings.spotify_client_secret || ''}
                                        onChange={(e) => setSettings(prev => ({ ...prev, spotify_client_secret: e.target.value }))}
                                        onBlur={() => handleSave('spotify_client_secret', settings.spotify_client_secret)}
                                        className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-xs font-mono text-ink outline-none focus:border-brand"
                                        placeholder="Enter Spotify Client Secret"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Spotify Playlist URL or ID</label>
                                    <input
                                        type="text"
                                        value={settings.spotify_playlist_id || ''}
                                        onChange={(e) => setSettings(prev => ({ ...prev, spotify_playlist_id: e.target.value }))}
                                        onBlur={() => handleSave('spotify_playlist_id', settings.spotify_playlist_id)}
                                        className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-xs font-mono text-ink outline-none focus:border-brand"
                                        placeholder="e.g. 37i9dQZF1DXcBWIGg3m31s or full Spotify playlist URL"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-subInk uppercase font-bold mb-1">กฎและแนวเพลงคุมโทน (Music Guidelines)</label>
                                    <textarea
                                        rows={3}
                                        value={settings.song_request_guidelines || ''}
                                        onChange={(e) => setSettings(prev => ({ ...prev, song_request_guidelines: e.target.value }))}
                                        onBlur={() => handleSave('song_request_guidelines', settings.song_request_guidelines)}
                                        className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-ink outline-none focus:border-brand resize-none"
                                        placeholder="แนะนำแนว Pop/Jazz ชิลๆ งดรับเพลงแนวเมทัล/ลูกทุ่งแดนซ์"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 leading-relaxed">
                                    Get these credentials from <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline font-bold">Spotify Developer Dashboard</a> by creating a Web API application.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* QR Customer Ordering Settings Card */}
                        <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                                 <QrCode size={20} className="text-orange-500" /> QR Customer Ordering
                            </h2>
                            
                            <div className="space-y-4">
                                {/* Enable QR Ordering Toggle */}
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <span className="block font-bold text-sm text-ink">Enable QR Ordering</span>
                                        <span className="text-[10px] text-subInk">Allow customers to place orders via QR code at tables</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={settings.qr_ordering_enabled === 'true'}
                                        onChange={(e) => handleSave('qr_ordering_enabled', e.target.checked ? 'true' : 'false')}
                                        className="accent-brandDark w-4 h-4"
                                    />
                                </label>

                                {/* Enable Song Request Toggle */}
                                <label className="flex items-center justify-between cursor-pointer border-t border-gray-100 pt-3 mt-3">
                                    <div>
                                        <span className="block font-bold text-sm text-ink">Enable Song Request</span>
                                        <span className="text-[10px] text-subInk">Turn on/off the song request page for customers</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={settings.song_request_enabled !== 'false'}
                                        onChange={(e) => handleSave('song_request_enabled', e.target.checked ? 'true' : 'false')}
                                        className="accent-brandDark w-4 h-4"
                                    />
                                </label>

                                {/* Enable Geofencing Toggle */}
                                <label className="flex items-center justify-between cursor-pointer border-t border-gray-100 pt-3">
                                    <div>
                                        <span className="block font-bold text-sm text-ink">Enable GPS Geofencing</span>
                                        <span className="text-[10px] text-subInk">Prevent customers ordering from outside restaurant premises</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={settings.qr_gps_enabled === 'true'}
                                        onChange={(e) => handleSave('qr_gps_enabled', e.target.checked ? 'true' : 'false')}
                                        className="accent-brandDark w-4 h-4"
                                    />
                                </label>

                                {settings.qr_gps_enabled === 'true' && (
                                    <div className="space-y-3 bg-canvas p-4 rounded-2xl border border-gray-100 animate-fade-in">
                                        <div>
                                            <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Restaurant Latitude</label>
                                            <input
                                                type="text"
                                                value={settings.qr_latitude || ''}
                                                onChange={(e) => setSettings(prev => ({ ...prev, qr_latitude: e.target.value }))}
                                                onBlur={() => handleSave('qr_latitude', settings.qr_latitude)}
                                                className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-mono text-ink outline-none focus:border-brand"
                                                placeholder="e.g. 17.40722"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Restaurant Longitude</label>
                                            <input
                                                type="text"
                                                value={settings.qr_longitude || ''}
                                                onChange={(e) => setSettings(prev => ({ ...prev, qr_longitude: e.target.value }))}
                                                onBlur={() => handleSave('qr_longitude', settings.qr_longitude)}
                                                className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-mono text-ink outline-none focus:border-brand"
                                                placeholder="e.g. 104.78028"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Allowed Radius (meters)</label>
                                            <input
                                                type="number"
                                                value={settings.qr_radius || ''}
                                                onChange={(e) => setSettings(prev => ({ ...prev, qr_radius: e.target.value }))}
                                                onBlur={() => handleSave('qr_radius', settings.qr_radius)}
                                                className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-ink outline-none focus:border-brand"
                                                placeholder="e.g. 50"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Google Review Link Setting */}
                                <div className="border-t border-gray-100 pt-4 mt-4">
                                    <label className="block text-xs font-bold text-ink mb-1">
                                        Google Review URL (ลิงก์รีวิวร้าน Google Maps)
                                    </label>
                                    <p className="text-[10px] text-subInk mb-2">
                                        ลิงก์สำหรับให้ลูกค้ากดรีวิว 5 ดาว หลังสั่งอาหารในหน้า QR Code
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={settings.google_review_url || ''}
                                            onChange={(e) => setSettings(prev => ({ ...prev, google_review_url: e.target.value }))}
                                            onBlur={() => handleSave('google_review_url', settings.google_review_url)}
                                            className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-xs font-mono text-ink outline-none focus:border-brand"
                                            placeholder="https://g.page/r/CXmnpQhwM5MYEBM/review"
                                        />
                                        {settings.google_review_url && (
                                            <a
                                                href={settings.google_review_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-3 py-2 bg-canvas hover:bg-gray-200 border border-gray-200 rounded-xl text-xs font-mono text-ink flex items-center gap-1 shrink-0"
                                            >
                                                <ExternalLink size={13} />
                                                <span>เปิดดู</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Kitchen Cutoff & QR Schedule Card */}
                        <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                                        <Clock size={20} className="text-amber-600" /> Kitchen Cutoff Schedule (ปิดครัว 4 ทุ่ม)
                                    </h2>
                                    <p className="text-xs text-subInk mt-1">
                                        กำหนดเวลาปิดรับออเดอร์ครัว และเลือกหมวดหมู่ที่ต้องการซ่อนในหน้า QR ลูกค้า
                                    </p>
                                </div>

                                {/* Live Status Pill */}
                                {(() => {
                                    const isClosed = isKitchenCurrentlyClosed();
                                    const closedCount = getKitchenClosedCategoryIds().length;
                                    return (
                                        <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 ${
                                            isClosed 
                                                ? 'bg-rose-50 border-rose-200 text-rose-700' 
                                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${isClosed ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                                            <span>{isClosed ? `ครัวปิด (${closedCount} หมวดซ่อนอยู่)` : 'ครัวเปิดปกติ'}</span>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="space-y-4">
                                {/* Cutoff Master Toggle */}
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <span className="block font-bold text-sm text-ink">เปิดใช้งานระบบตัดรอบเวลาปิดครัว</span>
                                        <span className="text-[10px] text-subInk">เมื่อถึงเวลาปิดครัว จะซ่อนหมวดหมู่อาหารที่เลือกไว้โดยอัตโนมัติ</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={settings.qr_kitchen_cutoff_enabled !== 'false'}
                                        onChange={(e) => handleSave('qr_kitchen_cutoff_enabled', e.target.checked ? 'true' : 'false')}
                                        className="accent-brandDark w-4 h-4 cursor-pointer"
                                    />
                                </label>

                                {/* Kitchen Mode Control */}
                                <div className="space-y-2 pt-2 border-t border-gray-100">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                                        โหมดสถานะห้องครัว (Kitchen Status Mode)
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { mode: 'auto', label: `Auto (${settings.qr_kitchen_open_time || '10:00'} - ${settings.qr_kitchen_close_time || '22:00'})`, desc: 'เปิด 10:00 / ปิด 22:00' },
                                            { mode: 'force_close', label: 'Force Close', desc: 'ปิดครัวทันที' },
                                            { mode: 'force_open', label: 'Force Open', desc: 'เปิดสั่งตลอด' }
                                        ].map(({ mode, label, desc }) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => handleSave('qr_kitchen_mode', mode)}
                                                className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                                                    (settings.qr_kitchen_mode || 'auto') === mode
                                                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm ring-2 ring-black/10'
                                                        : 'bg-canvas border-gray-200 text-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                <div className="leading-tight">{label}</div>
                                                <div className={`text-[9px] mt-0.5 ${(settings.qr_kitchen_mode || 'auto') === mode ? 'text-gray-300' : 'text-subInk'}`}>{desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Kitchen Operating Hours: Open & Close Times */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                                    {/* Kitchen Open Time (ตอนเช้า) */}
                                    <div className="space-y-2 bg-canvas p-3 rounded-2xl border border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <Sun size={14} className="text-amber-500" /> เวลาเปิดครัวตอนเช้า (Open)
                                            </label>
                                            <span className="text-[10px] font-mono text-subInk">10:00 น.</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="time" 
                                                value={settings.qr_kitchen_open_time || '10:00'} 
                                                onChange={(e) => handleSave('qr_kitchen_open_time', e.target.value)} 
                                                className="w-32 bg-white border border-gray-200 p-2 rounded-xl text-xs font-mono font-bold text-gray-900 outline-none focus:border-black shadow-xs" 
                                            />
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {['08:00', '09:00', '09:30', '10:00', '10:30', '11:00'].map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => handleSave('qr_kitchen_open_time', t)}
                                                        className={`px-2 py-1 rounded-md border text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                                                            (settings.qr_kitchen_open_time || '10:00') === t
                                                                ? 'bg-amber-600 text-white border-amber-600'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                                                        }`}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Kitchen Close Time (ตอนค่ำ) */}
                                    <div className="space-y-2 bg-canvas p-3 rounded-2xl border border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <Moon size={14} className="text-indigo-500" /> เวลาปิดครัวตอนค่ำ (Cutoff)
                                            </label>
                                            <span className="text-[10px] font-mono text-subInk">22:00 น.</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="time" 
                                                value={settings.qr_kitchen_close_time || '22:00'} 
                                                onChange={(e) => handleSave('qr_kitchen_close_time', e.target.value)} 
                                                className="w-32 bg-white border border-gray-200 p-2 rounded-xl text-xs font-mono font-bold text-gray-900 outline-none focus:border-black shadow-xs" 
                                            />
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {['21:00', '21:30', '22:00', '22:30', '23:00'].map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => handleSave('qr_kitchen_close_time', t)}
                                                        className={`px-2 py-1 rounded-md border text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                                                            (settings.qr_kitchen_close_time || '22:00') === t
                                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                                                        }`}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Category Selection for Kitchen Cutoff */}
                                <div className="space-y-3 pt-3 border-t border-gray-100">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <span className="block font-bold text-xs text-ink uppercase tracking-wider">
                                                หมวดหมู่ที่ต้องการซ่อนเมื่อครัวปิด (Cutoff Categories)
                                            </span>
                                            <span className="text-[10px] text-subInk">
                                                ติ๊กเลือกหมวดหมู่ที่จะไม่แสดงใน QR เมื่อครัวปิด (เครื่องดื่ม/บาร์ ไม่ต้องติ๊กเพื่อให้สั่งได้ต่อ)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllKitchenCategories}
                                                className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                                                title="เลือกเฉพาะหมวดอาหารครัว ไม่รวมเครื่องดื่ม"
                                            >
                                                🍳 เฉพาะครัว
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSelectAllCategoriesForCutoff}
                                                className="px-2 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold hover:bg-gray-200 transition-colors cursor-pointer"
                                            >
                                                เลือกทั้งหมด
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleClearAllCutoffCategories}
                                                className="px-2 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold hover:bg-gray-200 transition-colors cursor-pointer"
                                            >
                                                ล้าง
                                            </button>
                                        </div>
                                    </div>

                                    {/* Category Grid Checklist */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-canvas p-3 rounded-2xl border border-gray-100 max-h-60 overflow-y-auto custom-scrollbar">
                                        {allCategories.map(cat => {
                                            const closedIds = getKitchenClosedCategoryIds();
                                            const isSelected = closedIds.includes(cat.id) || cat.hide_on_kitchen_close === true;
                                            const isBar = defaultRouteCategory(cat) === 'bar';

                                            return (
                                                <div 
                                                    key={cat.id}
                                                    onClick={() => handleToggleKitchenCutoffCategory(cat.id)}
                                                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                                        isSelected 
                                                            ? 'bg-rose-50/80 border-rose-200 text-rose-900 shadow-2xs' 
                                                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                            isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-gray-300 bg-white'
                                                        }`}>
                                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-xs truncate">{cat.name}</div>
                                                            <div className="flex items-center gap-1 text-[9px] text-subInk font-mono">
                                                                <span>{isBar ? '☕ Bar/Drink' : '🍳 Kitchen'}</span>
                                                                {cat.is_drink_stamp_eligible && <span className="text-amber-700 font-bold">· 10F1</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                                                        isSelected 
                                                            ? 'bg-rose-600 text-white' 
                                                            : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {isSelected ? 'ซ่อนเมื่อปิดครัว' : 'เปิดตลอด'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

                {/* TAB 4: Printers Settings */}
                {activeSettingsTab === 'printers' && (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in font-sans text-[#1A1A1A]">
                        {/* Cashier Printer Card */}
                        <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-4 rounded-xl shadow-sm flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-[#D1D1CD] pb-3">
                                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                                         <span>🖨</span> Cashier Printer (เครื่องพิมพ์หลัก)
                                    </h2>
                                    <span className={`px-2 py-0.5 rounded font-mono text-[8px] font-bold uppercase tracking-widest ${printerConfig.cashier_printer_type === 'universal' ? 'bg-[#00CC44]/10 text-[#00CC44] border border-[#00CC44]/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                        {printerConfig.cashier_printer_type}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Connection Type (การเชื่อมต่อ)</label>
                                        <select 
                                            value={printerConfig.cashier_printer_type} 
                                            onChange={(e) => handleSavePrinter({ ...printerConfig, cashier_printer_type: e.target.value })} 
                                            className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs text-[#1A1A1A] font-medium outline-none focus:border-[#FF5500] cursor-pointer"
                                        >
                                            <option value="sunmi">🖨️ SUNMI Built-in Printer (Auto)</option>
                                        </select>
                                    </div>

                                    {printerConfig.cashier_printer_type === 'lan' && (
                                        <div className="grid grid-cols-3 gap-2 animate-fade-in">
                                            <div className="col-span-2">
                                                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">IP Address</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. 192.168.1.100" 
                                                    value={printerConfig.cashier_printer_ip} 
                                                    onChange={(e) => handleSavePrinter({ ...printerConfig, cashier_printer_ip: e.target.value })} 
                                                    className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-mono text-[#1A1A1A]" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Port</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="9100" 
                                                    value={printerConfig.cashier_printer_port} 
                                                    onChange={(e) => handleSavePrinter({ ...printerConfig, cashier_printer_port: e.target.value })} 
                                                    className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-mono text-[#1A1A1A]" 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {printerConfig.cashier_printer_type === 'bluetooth' && (
                                        <div className="animate-fade-in space-y-1">
                                            <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Bluetooth Device Name / MAC Address</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. GG-5805DD / BT-SPP" 
                                                    value={printerConfig.cashier_printer_bt_name} 
                                                    onChange={(e) => handleSavePrinter({ ...printerConfig, cashier_printer_bt_name: e.target.value })} 
                                                    className="flex-1 px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-mono text-[#1A1A1A]" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleScanBluetooth('cashier')}
                                                    className="px-3 py-2 bg-[#1A1A1A] hover:bg-[#333330] text-white font-mono text-[9px] font-bold uppercase rounded-lg active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                                                >
                                                    🔍 Scan & Pair
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Paper Width (ความกว้างกระดาษ)</label>
                                        <select 
                                            value={printerConfig.cashier_paper_size} 
                                            onChange={(e) => handleSavePrinter({ ...printerConfig, cashier_paper_size: e.target.value })} 
                                            className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs text-[#1A1A1A] font-medium outline-none focus:border-[#FF5500] cursor-pointer"
                                        >
                                            <option value="80mm">80mm Thermal Paper (Recommended)</option>
                                            <option value="58mm">58mm Thermal Paper</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 mt-6 border-t border-[#D1D1CD] flex gap-2 font-mono text-[9px] font-bold uppercase tracking-wider">
                                <button 
                                    onClick={() => handleTestPrint('cashier')}
                                    className="flex-grow bg-white hover:bg-[#E0E0DC] border border-[#D1D1CD] text-[#1A1A1A] py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                    Test Receipt Print
                                </button>
                            </div>
                        </div>

                        {/* Kitchen Printer Card */}
                        <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-4 rounded-xl shadow-sm flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-[#D1D1CD] pb-3">
                                    <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                                         <span>🖨</span> Kitchen Printer (เครื่องพิมพ์ในครัว)
                                    </h2>
                                    <span className={`px-2 py-0.5 rounded font-mono text-[8px] font-bold uppercase tracking-widest ${printerConfig.kitchen_printer_type === 'universal' ? 'bg-[#00CC44]/10 text-[#00CC44] border border-[#00CC44]/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                        {printerConfig.kitchen_printer_type}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Connection Type (การเชื่อมต่อ)</label>
                                        <select 
                                            value={printerConfig.kitchen_printer_type} 
                                            onChange={(e) => handleSavePrinter({ ...printerConfig, kitchen_printer_type: e.target.value })} 
                                            className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs text-[#1A1A1A] font-medium outline-none focus:border-[#FF5500] cursor-pointer"
                                        >
                                            <option value="sunmi">🖨️ SUNMI Built-in Printer (Auto)</option>
                                        </select>
                                    </div>

                                    {printerConfig.kitchen_printer_type === 'lan' && (
                                        <div className="grid grid-cols-3 gap-2 animate-fade-in">
                                            <div className="col-span-2">
                                                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">IP Address</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. 192.168.1.200" 
                                                    value={printerConfig.kitchen_printer_ip} 
                                                    onChange={(e) => handleSavePrinter({ ...printerConfig, kitchen_printer_ip: e.target.value })} 
                                                    className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-mono text-[#1A1A1A]" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Port</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="9100" 
                                                    value={printerConfig.kitchen_printer_port} 
                                                    onChange={(e) => handleSavePrinter({ ...printerConfig, kitchen_printer_port: e.target.value })} 
                                                    className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-mono text-[#1A1A1A]" 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {printerConfig.kitchen_printer_type === 'bluetooth' && (
                                        <div className="animate-fade-in space-y-1">
                                            <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Bluetooth Device Name / MAC Address</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. GG-5805DD / BT-SPP" 
                                                    value={printerConfig.kitchen_printer_bt_name} 
                                                    onChange={(e) => handleSavePrinter({ ...printerConfig, kitchen_printer_bt_name: e.target.value })} 
                                                    className="flex-1 px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-mono text-[#1A1A1A]" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleScanBluetooth('kitchen')}
                                                    className="px-3 py-2 bg-[#1A1A1A] hover:bg-[#333330] text-white font-mono text-[9px] font-bold uppercase rounded-lg active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                                                >
                                                    🔍 Scan & Pair
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Paper Width (ความกว้างกระดาษ)</label>
                                        <select 
                                            value={printerConfig.kitchen_paper_size} 
                                            onChange={(e) => handleSavePrinter({ ...printerConfig, kitchen_paper_size: e.target.value })} 
                                            className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs text-[#1A1A1A] font-medium outline-none focus:border-[#FF5500] cursor-pointer"
                                        >
                                            <option value="80mm">80mm Thermal Paper (Recommended)</option>
                                            <option value="58mm">58mm Thermal Paper</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 mt-6 border-t border-[#D1D1CD] flex gap-2 font-mono text-[9px] font-bold uppercase tracking-wider">
                                <button 
                                    onClick={() => handleTestPrint('kitchen')}
                                    className="flex-grow bg-white hover:bg-[#E0E0DC] border border-[#D1D1CD] text-[#1A1A1A] py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                    Test Kitchen Order Print
                                </button>
                            </div>
                        </div>

                        {/* Secondary Bar Printer Card */}
                        <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-4 rounded-xl shadow-sm flex flex-col justify-between col-span-1 sm:col-span-2">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-[#D1D1CD] pb-3">
                                    <div>
                                        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                                            <span>🍷</span> Secondary Bar Printer (เครื่องพิมพ์เสริมแยกบาร์/เครื่องดื่ม)
                                        </h2>
                                        <p className="text-[10px] text-[#767673] mt-0.5">เปิดใช้งานหากต้องการแยกพิมพ์สลิปบาร์/เครื่องดื่มไปยังเครื่องพิมพ์เครื่องที่ 2 ในอนาคต</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={!!printerConfig.separate_bar_printer} 
                                            onChange={(e) => handleSavePrinter({ ...printerConfig, separate_bar_printer: e.target.checked })} 
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-[#D1D1CD] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ff0000]"></div>
                                    </label>
                                </div>

                                {printerConfig.separate_bar_printer && (
                                    <div className="space-y-3 animate-fade-in pt-1">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Secondary Connection Type (การเชื่อมต่อเครื่องที่ 2)</label>
                                                <select 
                                                    value={printerConfig.bar_printer_type || 'lan'} 
                                                    onChange={(e) => handleSavePrinter({ ...printerConfig, bar_printer_type: e.target.value })} 
                                                    className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs text-[#1A1A1A] font-medium outline-none focus:border-[#ff0000] cursor-pointer"
                                                >
                                                    <option value="sunmi">SUNMI Secondary Printer</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Paper Width (ความกว้างกระดาษเครื่องที่ 2)</label>
                                                <select 
                                                    value={printerConfig.bar_paper_size || '80mm'} 
                                                    onChange={(e) => handleSavePrinter({ ...printerConfig, bar_paper_size: e.target.value })} 
                                                    className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs text-[#1A1A1A] font-medium outline-none focus:border-[#ff0000] cursor-pointer"
                                                >
                                                    <option value="80mm">80mm Thermal Paper (Recommended)</option>
                                                    <option value="58mm">58mm Thermal Paper</option>
                                                </select>
                                            </div>
                                        </div>

                                        {printerConfig.bar_printer_type === 'lan' && (
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="col-span-2">
                                                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Bar Printer IP Address</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="e.g. 192.168.1.201" 
                                                        value={printerConfig.bar_printer_ip || ''} 
                                                        onChange={(e) => handleSavePrinter({ ...printerConfig, bar_printer_ip: e.target.value })} 
                                                        className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-mono text-[#1A1A1A]" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Port</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="9100" 
                                                        value={printerConfig.bar_printer_port || '9100'} 
                                                        onChange={(e) => handleSavePrinter({ ...printerConfig, bar_printer_port: e.target.value })} 
                                                        className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-mono text-[#1A1A1A]" 
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {printerConfig.bar_printer_type === 'bluetooth' && (
                                            <div className="space-y-1">
                                                <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">Bar Bluetooth Device Name / MAC</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. BAR-PRINTER-58" 
                                                    value={printerConfig.bar_printer_bt_name || ''} 
                                                    onChange={(e) => handleSavePrinter({ ...printerConfig, bar_printer_bt_name: e.target.value })} 
                                                    className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-mono text-[#1A1A1A]" 
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Wongnai Merchant App (WMA) Virtual ESC/POS Printer Bridge Card */}
                        <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-5 rounded-xl shadow-sm space-y-4 col-span-1 sm:col-span-2">
                            <div className="flex flex-wrap justify-between items-center border-b border-[#D1D1CD] pb-3 gap-2">
                                <div>
                                    <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                                        <span>🛵</span> Wongnai Merchant App (WMA) ESC/POS Bridge & Interceptor
                                    </h2>
                                    <p className="text-[10px] text-[#767673] mt-0.5">
                                        พอร์ตจำลองเครื่องพิมพ์เสมือน (Port 9100) และระบบดักจับการแจ้งเตือน Android เพื่อดูดออเดอร์ LINE MAN เข้า POS อัตโนมัติ
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                        PORT 9100 LISTENING
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="space-y-2 bg-white p-4 rounded-xl border border-[#D1D1CD]">
                                    <h3 className="font-mono font-bold uppercase text-[11px] text-[#1A1A1A] flex items-center gap-1.5">
                                        <span>⚙️</span> การตั้งค่าในแอป Wongnai Merchant App (WMA)
                                    </h3>
                                    <ol className="space-y-1.5 text-[11px] text-[#555] list-decimal list-inside leading-relaxed">
                                        <li>เปิดแอป <strong>WMA</strong> &gt; ไปที่ <strong>ตั้งค่า</strong> &gt; <strong>เครื่องพิมพ์</strong></li>
                                        <li>กด <strong>เพิ่มเครื่องพิมพ์</strong> &gt; เลือก <strong>LAN / Wi-Fi (IP Printer)</strong></li>
                                        <li>ใส่ IP: <strong className="font-mono text-[#1A1A1A]">127.0.0.1</strong> และ Port: <strong className="font-mono text-[#1A1A1A]">9100</strong></li>
                                        <li>เลือกรุ่น <strong>ทั่วไป / ESC/POS (80mm)</strong></li>
                                        <li>เปิด <strong>"พิมพ์อัตโนมัติเมื่อมีออเดอร์ใหม่"</strong> แล้วกดบันทึก</li>
                                    </ol>
                                </div>

                                <div className="space-y-2 bg-white p-4 rounded-xl border border-[#D1D1CD] flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-mono font-bold uppercase text-[11px] text-[#1A1A1A] flex items-center gap-1.5">
                                            <span>🧪</span> ตรวจสอบและทดสอบการรับออเดอร์ (Diagnostic Test)
                                        </h3>
                                        <p className="text-[11px] text-[#767673] mt-1 leading-relaxed">
                                            กดปุ่มด้านล่างเพื่อจำลองส่งออเดอร์ LINE MAN เข้าสู่ระบบ POS เพื่อทดสอบเสียงเตือน การบันทึก และการแสดงผลบนหน้าจอ
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                await simulateWmaOrder();
                                                alert('✅ ยิงออเดอร์จำลอง LINE MAN สำเร็จ! ระบบได้บันทึกและส่งเสียงแจ้งเตือนเรียบร้อย');
                                            } catch (e) {
                                                alert('❌ ทดสอบไม่สำเร็จ: ' + (e.message || 'Error'));
                                            }
                                        }}
                                        className="w-full py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-98 flex items-center justify-center gap-1.5"
                                    >
                                        <span>🧪 ทดสอบยิงออเดอร์จำลอง LINE MAN (Simulate Test)</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                    {/* Category Printer Routing Card */}
                    <div className="col-span-2 bg-[#F5F5F2] border border-[#D1D1CD] p-6 rounded-xl shadow-sm space-y-4 mt-2 font-sans text-[#1A1A1A]">
                        <div className="border-b border-[#D1D1CD] pb-3">
                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                                <span>🔀</span> การจัดเส้นทางหมวดหมู่พิมพ์ (Printer Category Routing)
                            </h2>
                            <p className="text-[10px] text-[#767673] font-sans mt-1">กดปุ่มหรือลากหมวดหมู่อาหารไปวางในฝั่งเครื่องพิมพ์ที่ต้องการ เพื่อแยกรายการพิมพ์ออกเป็นใบสั่งครัว/สั่งเครื่องดื่มโดยอัตโนมัติ (รองรับทั้งมือถือ/APK และ Desktop)</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Unassigned Categories Column */}
                            <div 
                                onDragOver={(e) => handleCategoryDragOver(e, 'unassigned')}
                                onDrop={(e) => handleCategoryDrop(e, 'unassigned')}
                                className="bg-white border border-[#D1D1CD] p-4 rounded-xl space-y-3 min-h-[250px]"
                            >
                                <h3 className="text-xs font-mono font-bold uppercase text-[#767673] border-b border-[#F0F0EC] pb-2 flex justify-between items-center">
                                    <span>📂 หมวดหมู่ยังไม่ระบุ</span>
                                    <span className="text-[10px] bg-[#F5F5F2] px-1.5 py-0.5 rounded text-[#1A1A1A] font-bold font-mono">
                                        {allCategories.filter(cat => !(printerConfig.kitchen_categories || []).includes(cat.id) && !(printerConfig.bar_categories || []).includes(cat.id)).length}
                                    </span>
                                </h3>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {allCategories
                                        .filter(cat => !(printerConfig.kitchen_categories || []).includes(cat.id) && !(printerConfig.bar_categories || []).includes(cat.id))
                                        .map(cat => (
                                            <div
                                                key={cat.id}
                                                draggable
                                                onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
                                                className="bg-[#F5F5F2] border border-[#D1D1CD] p-2.5 rounded-lg text-xs font-semibold cursor-grab active:cursor-grabbing hover:border-[#FF5500] hover:bg-orange-50/10 transition-all flex justify-between items-center gap-2"
                                            >
                                                <span className="truncate">{cat.name}</span>
                                                <div className="flex gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAssignCategory(cat.id, 'kitchen')}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[10px] font-bold px-2 py-1 rounded active:scale-95 transition-all cursor-pointer shadow-xs"
                                                        title="ย้ายเข้าเครื่องพิมพ์ครัว"
                                                    >
                                                        + ครัว
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAssignCategory(cat.id, 'bar')}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-mono text-[10px] font-bold px-2 py-1 rounded active:scale-95 transition-all cursor-pointer shadow-xs"
                                                        title="ย้ายเข้าเครื่องพิมพ์บาร์"
                                                    >
                                                        + บาร์
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {allCategories.filter(cat => !(printerConfig.kitchen_categories || []).includes(cat.id) && !(printerConfig.bar_categories || []).includes(cat.id)).length === 0 && (
                                        <div className="text-[10px] text-[#767673] font-mono text-center py-8">จัดสรรครบทุกหมวดหมู่แล้ว</div>
                                    )}
                                </div>
                            </div>

                            {/* Kitchen Printer Categories Column */}
                            <div 
                                onDragOver={(e) => handleCategoryDragOver(e, 'kitchen')}
                                onDrop={(e) => handleCategoryDrop(e, 'kitchen')}
                                className={`bg-[#E6F4EA]/20 border ${draggedOverColumn === 'kitchen' ? 'border-[#00CC44] bg-[#E6F4EA]/40' : 'border-[#D1D1CD]'} p-4 rounded-xl space-y-3 min-h-[250px] transition-all`}
                            >
                                <h3 className="text-xs font-mono font-bold uppercase text-[#00CC44] border-b border-[#E6F4EA] pb-2 flex justify-between items-center">
                                    <span>🍳 พิมพ์ออกครัว (Kitchen)</span>
                                    <span className="text-[10px] bg-emerald-600/10 px-1.5 py-0.5 rounded text-emerald-600 font-bold font-mono">
                                        {(printerConfig.kitchen_categories || []).length}
                                    </span>
                                </h3>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {allCategories
                                        .filter(cat => (printerConfig.kitchen_categories || []).includes(cat.id))
                                        .map(cat => (
                                            <div
                                                key={cat.id}
                                                draggable
                                                onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
                                                className="bg-white border border-[#D1D1CD] p-2.5 rounded-lg text-xs font-semibold cursor-grab active:cursor-grabbing hover:border-emerald-500 transition-all flex justify-between items-center gap-2"
                                            >
                                                <span className="truncate">{cat.name}</span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAssignCategory(cat.id, 'bar')}
                                                        className="bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded active:scale-95 transition-all cursor-pointer"
                                                        title="ย้ายไปเครื่องพิมพ์บาร์"
                                                    >
                                                        → บาร์
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCategory(cat.id, 'kitchen')}
                                                        className="text-[#767673] hover:text-red-500 font-mono text-xs font-bold px-1.5 py-0.5 hover:bg-red-50 rounded cursor-pointer transition-all"
                                                        title="ย้ายกลับหมวดหมู่ยังไม่ระบุ"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {(printerConfig.kitchen_categories || []).length === 0 && (
                                        <div className="text-[10px] text-[#767673] font-mono text-center py-8">กดปุ่มหรือลากหมวดหมู่มาวางที่นี่ เพื่อส่งเข้าเครื่องพิมพ์ครัว</div>
                                    )}
                                </div>
                            </div>

                            {/* Bar Printer Categories Column */}
                            <div 
                                onDragOver={(e) => handleCategoryDragOver(e, 'bar')}
                                onDrop={(e) => handleCategoryDrop(e, 'bar')}
                                className={`bg-[#E8F0FE]/20 border ${draggedOverColumn === 'bar' ? 'border-blue-500 bg-[#E8F0FE]/40' : 'border-[#D1D1CD]'} p-4 rounded-xl space-y-3 min-h-[250px] transition-all`}
                            >
                                <h3 className="text-xs font-mono font-bold uppercase text-blue-600 border-b border-[#E8F0FE] pb-2 flex justify-between items-center">
                                    <span>🍺 พิมพ์ออกบาร์ (Bar)</span>
                                    <span className="text-[10px] bg-blue-600/10 px-1.5 py-0.5 rounded text-blue-600 font-bold font-mono">
                                        {(printerConfig.bar_categories || []).length}
                                    </span>
                                </h3>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {allCategories
                                        .filter(cat => (printerConfig.bar_categories || []).includes(cat.id))
                                        .map(cat => (
                                            <div
                                                key={cat.id}
                                                draggable
                                                onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
                                                className="bg-white border border-[#D1D1CD] p-2.5 rounded-lg text-xs font-semibold cursor-grab active:cursor-grabbing hover:border-blue-500 transition-all flex justify-between items-center gap-2"
                                            >
                                                <span className="truncate">{cat.name}</span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAssignCategory(cat.id, 'kitchen')}
                                                        className="bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded active:scale-95 transition-all cursor-pointer"
                                                        title="ย้ายไปเครื่องพิมพ์ครัว"
                                                    >
                                                        ← ครัว
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCategory(cat.id, 'bar')}
                                                        className="text-[#767673] hover:text-red-500 font-mono text-xs font-bold px-1.5 py-0.5 hover:bg-red-50 rounded cursor-pointer transition-all"
                                                        title="ย้ายกลับหมวดหมู่ยังไม่ระบุ"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {(printerConfig.bar_categories || []).length === 0 && (
                                        <div className="text-[10px] text-[#767673] font-mono text-center py-8">กดปุ่มหรือลากหมวดหมู่มาวางที่นี่ เพื่อส่งเข้าเครื่องพิมพ์บาร์</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Card: Live Thermal Receipt Preview & ASCII Art Footer Editor */}
                        <div className="col-span-2 bg-[#F5F5F2] border border-[#D1D1CD] p-6 rounded-xl shadow-sm space-y-6 mt-4 font-sans text-[#1A1A1A]">
                            <div className="border-b border-[#D1D1CD] pb-4 flex flex-wrap justify-between items-center gap-3">
                                <div>
                                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
                                        ตัวอย่างการจัดหน้าพิมพ์ & ASCII Art Footer (Receipt Live Layout & Footer Editor)
                                    </h2>
                                    <p className="text-[10px] text-[#767673] mt-1 font-sans">
                                        ดูตัวอย่างการแสดงผลสลิปแบบเรียลไทม์ (ความกว้าง 80mm / 58mm) พร้อมเลือกและปรับแต่งข้อความตัวอักษร ASCII Art ปิดท้ายสลิป
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#D1D1CD] shadow-xs">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewTab('billing')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${previewTab === 'billing' ? 'bg-[#ff0000] text-white shadow-xs' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                                        >
                                            บิลคิดเงิน (Receipt)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewTab('kitchen')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${previewTab === 'kitchen' ? 'bg-[#ff0000] text-white shadow-xs' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                                        >
                                            สั่งอาหาร (Kitchen)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewTab('bar')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${previewTab === 'bar' ? 'bg-[#ff0000] text-white shadow-xs' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                                        >
                                            สั่งเครื่องดื่ม (Bar)
                                        </button>
                                    </div>

                                    {/* Explicit Save Button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleSavePrinter(printerConfig);
                                            alert("บันทึกการตั้งค่าจัดหน้าสลิปและเครื่องพิมพ์เรียบร้อยแล้ว!");
                                        }}
                                        className="flex items-center gap-1.5 bg-[#ff0000] hover:bg-[#cc0000] text-white font-mono text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                                    >
                                        <Save size={15} /> บันทึกการตั้งค่า (Save Settings)
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Left Column: Layout Controls & ASCII Art (7 cols) */}
                                <div className="lg:col-span-7 space-y-4">
                                    {/* Shop Header & Logo Uploader Card */}
                                    <div className="bg-white border border-[#D1D1CD] p-4 rounded-xl space-y-4 shadow-sm">
                                        <h3 className="text-xs font-mono font-bold uppercase text-[#1A1A1A] flex items-center justify-between border-b border-[#F0F0EC] pb-2">
                                            <span>ข้อมูลหัวใบเสร็จ & โลโก้ร้าน (Shop Header & Logo)</span>
                                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono font-bold">HEADER & LOGO</span>
                                        </h3>

                                        {/* Logo Uploader Box */}
                                        <div className="bg-[#F9F9F8] border border-[#D1D1CD] p-3 rounded-xl flex items-center gap-4">
                                            <div className="w-20 h-20 bg-white rounded-lg border border-[#D1D1CD] flex items-center justify-center overflow-hidden shrink-0">
                                                {settings.receipt_shop_logo_url ? (
                                                    <img 
                                                        src={safeTimestampUrl(settings.receipt_shop_logo_url, timestamp)} 
                                                        alt="Shop Logo"
                                                        className="max-w-full max-h-full object-contain p-1"
                                                    />
                                                ) : (
                                                    <span className="text-[10px] font-mono text-[#767673]">No Logo</span>
                                                )}
                                            </div>
                                            <div className="flex-1 space-y-1.5">
                                                <label className="block cursor-pointer group">
                                                    <div className="bg-white border border-dashed border-[#D1D1CD] rounded-lg px-3 py-2 text-center group-hover:border-[#ff0000] transition-colors shadow-2xs">
                                                        <span className="text-xs font-bold text-[#1A1A1A]">
                                                            {uploadingLogo ? 'กำลังอัปโหลด...' : 'อัปโหลดโลโก้ร้าน (Shop Logo)'}
                                                        </span>
                                                    </div>
                                                    <input 
                                                        type="file" 
                                                        className="hidden" 
                                                        accept="image/*" 
                                                        onChange={(e) => handleUpload(e.target.files[0], 'receipt_shop_logo_url', setUploadingLogo)} 
                                                    />
                                                </label>
                                                <p className="text-[9px] text-[#767673]">
                                                    ไฟล์ภาพจะแสดงที่ด้านบนสุดของสลิปคิดเงิน
                                                </p>
                                            </div>
                                        </div>

                                        {/* Shop Header Fields */}
                                        <div className="space-y-3 pt-1">
                                            <div>
                                                <label className="block text-[10px] font-mono font-bold uppercase text-[#767673] mb-1">
                                                    ชื่อร้านบนใบเสร็จ (Shop Name)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={settings.receipt_shop_name || ''}
                                                    onChange={(e) => handleSave('receipt_shop_name', e.target.value)}
                                                    className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#D1D1CD] rounded-lg text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#ff0000]"
                                                    placeholder="IN THE HAUS"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-mono font-bold uppercase text-[#767673] mb-1">
                                                    ที่อยู่ร้าน (Shop Address)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={settings.receipt_shop_address || ''}
                                                    onChange={(e) => handleSave('receipt_shop_address', e.target.value)}
                                                    className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#D1D1CD] rounded-lg text-xs font-medium text-[#1A1A1A] outline-none focus:border-[#ff0000]"
                                                    placeholder="123 ถนนโชคชัย นครพนม 48000"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                                <div>
                                                    <label className="block text-[10px] font-mono font-bold uppercase text-[#767673] mb-1">
                                                        ชื่อบัญชีพร้อมเพย์ (Account Name)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={settings.promptpay_name || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            handleSave('promptpay_name', val);
                                                            handleSavePrinter({ ...printerConfig, promptpay_name: val });
                                                        }}
                                                        className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#D1D1CD] rounded-lg text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#ff0000]"
                                                        placeholder="อิน เดอะ เฮ้าส์"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-mono font-bold uppercase text-[#767673] mb-1">
                                                        เบอร์พร้อมเพย์ (PromptPay ID)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={settings.promptpay_id || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            handleSave('promptpay_id', val);
                                                            handleSavePrinter({ ...printerConfig, promptpay_id: val });
                                                        }}
                                                        className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#D1D1CD] rounded-lg text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#ff0000]"
                                                        placeholder="0985284217"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-mono font-bold uppercase text-[#767673] mb-1">
                                                        เบอร์โทรศัพท์ (Phone)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={settings.receipt_shop_phone || ''}
                                                        onChange={(e) => handleSave('receipt_shop_phone', e.target.value)}
                                                        className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#D1D1CD] rounded-lg text-xs font-medium text-[#1A1A1A] outline-none focus:border-[#ff0000]"
                                                        placeholder="081-234-5678"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-mono font-bold uppercase text-[#767673] mb-1">
                                                        เลขภาษี (VAT ID)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={settings.receipt_shop_vat || ''}
                                                        onChange={(e) => handleSave('receipt_shop_vat', e.target.value)}
                                                        className="w-full px-3 py-2 bg-[#F9F9F8] border border-[#D1D1CD] rounded-lg text-xs font-medium text-[#1A1A1A] outline-none focus:border-[#ff0000]"
                                                        placeholder="0105560000000"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Divider Line Pattern Selector Card */}
                                    <div className="bg-white border border-[#D1D1CD] p-4 rounded-xl space-y-3 shadow-sm">
                                        <h3 className="text-xs font-mono font-bold uppercase text-[#1A1A1A] flex items-center justify-between border-b border-[#F0F0EC] pb-2">
                                            <span>เลือกลวดลายเส้นคั่นสลิป (Divider Line Pattern)</span>
                                            <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono font-bold">DIVIDER PATTERN</span>
                                        </h3>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {[
                                                { id: 'dashed', name: '- - - เส้นประมาตรฐาน', pattern: '- - - - - - - - - - - -' },
                                                { id: 'dotted', name: '. . . เส้นจุดเรียบหรู', pattern: '. . . . . . . . . . . .' },
                                                { id: 'solid', name: '───── เส้นทึบเดี่ยว', pattern: '────────────────────────' },
                                                { id: 'double', name: '═════ เส้นทึบคู่', pattern: '════════════════════════' },
                                                { id: 'star', name: '★ ★ ★ เส้นดาว', pattern: '★ * ★ * ★ * ★ * ★ * ★ *' },
                                                { id: 'wave', name: '~ ~ ~ เส้นคลื่น', pattern: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~' }
                                            ].map(style => (
                                                <button
                                                    key={style.id}
                                                    type="button"
                                                    onClick={() => handleSavePrinter({ ...printerConfig, divider_style: style.id })}
                                                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${ (printerConfig.divider_style || 'dashed') === style.id ? 'bg-orange-50/20 border-[#ff0000] ring-2 ring-[#ff0000]/15 shadow-xs' : 'bg-[#F9F9F8] border-[#D1D1CD] hover:bg-white'}`}
                                                >
                                                    <span className="text-[11px] font-bold text-[#1A1A1A]">{style.name}</span>
                                                    <span className="font-mono text-[10px] text-[#767673] mt-1.5 overflow-hidden whitespace-nowrap block">
                                                        {style.pattern}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ASCII Art Footer Controls Card */}
                                    <div className="bg-white border border-[#D1D1CD] p-4 rounded-xl space-y-4 shadow-sm">
                                        <h3 className="text-xs font-mono font-bold uppercase text-[#1A1A1A] flex items-center justify-between border-b border-[#F0F0EC] pb-2">
                                            <span>เลือกข้อความ ASCII Art Font สำเร็จรูป</span>
                                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-mono font-bold">ASCII FONT</span>
                                        </h3>

                                        {/* Presets Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {ASCII_ART_PRESETS.map(preset => (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedAsciiPreset(preset.id);
                                                        handleSavePrinter({ ...printerConfig, footer_ascii_art: preset.art });
                                                    }}
                                                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${printerConfig.footer_ascii_art === preset.art ? 'bg-orange-50/20 border-[#ff0000] ring-2 ring-[#ff0000]/15 shadow-xs' : 'bg-[#F9F9F8] border-[#D1D1CD] hover:bg-white hover:border-[#767673]'}`}
                                                >
                                                    <span className="text-xs font-bold text-[#1A1A1A]">{preset.name}</span>
                                                    <pre className="font-mono text-[9px] text-[#767673] mt-2 whitespace-pre leading-tight overflow-x-auto bg-white p-2 rounded border border-[#EBEBE8]">
                                                        {preset.art}
                                                    </pre>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Custom ASCII Art Textarea Input */}
                                        <div className="space-y-1.5 pt-2">
                                            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#767673]">
                                                ข้อความ ASCII Art Footer ที่ใช้งานอยู่ (ปรับแต่งตัวอักษรได้ตามต้องการ)
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={printerConfig.footer_ascii_art || ''}
                                                onChange={(e) => handleSavePrinter({ ...printerConfig, footer_ascii_art: e.target.value })}
                                                placeholder="พิมพ์ข้อความตัวอักษร ASCII Art ตรงนี้..."
                                                className="w-full p-3 bg-[#F9F9F8] border border-[#D1D1CD] rounded-xl text-xs font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#ff0000] focus:ring-2 focus:ring-[#ff0000]/15 leading-tight resize-y shadow-inner"
                                            />
                                            <p className="text-[9px] text-[#767673]">สามารถพิมพ์ข้อความตัวอักษรหลายบรรทัด หรือคัดลอกข้อความมาวางได้ทันที</p>
                                        </div>

                                        {/* Shop Footer Line */}
                                        <div className="space-y-1.5 pt-2 border-t border-[#F0F0EC]">
                                            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#767673]">
                                                ข้อความท้ายสลิปหลัก (Shop Footer Text)
                                            </label>
                                            <input
                                                type="text"
                                                value={printerConfig.shop_footer_text || settings.receipt_shop_footer || 'THANK YOU FOR YOUR VISIT'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    handleSavePrinter({ ...printerConfig, shop_footer_text: val });
                                                    handleSave('receipt_shop_footer', val);
                                                }}
                                                className="w-full px-3 py-2.5 bg-[#F9F9F8] border border-[#D1D1CD] rounded-xl text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#ff0000] shadow-inner"
                                                placeholder="เช่น ขอบคุณที่อุดหนุน แล้วพบกันใหม่ครับ!"
                                            />
                                        </div>
                                    </div>

                                    {/* Bottom Explicit Save Button */}
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleSavePrinter(printerConfig);
                                                alert("บันทึกการตั้งค่าจัดหน้าสลิปและเครื่องพิมพ์เรียบร้อยแล้ว!");
                                            }}
                                            className="w-full flex items-center justify-center gap-2 bg-[#ff0000] hover:bg-[#cc0000] text-white font-mono text-xs font-bold py-3 rounded-xl transition-all cursor-pointer shadow-md active:scale-98"
                                        >
                                            <Save size={16} /> บันทึกการตั้งค่าการจัดหน้า & เครื่องพิมพ์ (Save All Settings)
                                        </button>
                                    </div>
                                </div>

                                {/* Right Column: Thermal Paper Live Preview Mockup (5 cols) */}
                                <div className="lg:col-span-5 flex flex-col items-center">
                                    <div className="text-[10px] font-mono font-bold uppercase text-[#767673] mb-2 flex items-center gap-1.5">
                                        <span>ตัวอย่างใบเสร็จจริง (LIVE RECEIPT MOCKUP)</span>
                                        <span className="bg-[#1A1A1A] text-white px-2 py-0.5 rounded text-[8px]">
                                            {printerConfig.cashier_paper_size || '80mm'}
                                        </span>
                                    </div>

                                    {/* Simulated Physical Thermal Paper Card with Jagged Tear Edges */}
                                    <div className="w-full max-w-[320px] bg-white border border-[#D1D1CD] shadow-2xl p-5 text-[#1A1A1A] font-mono text-[11px] leading-snug rounded-t-xl relative overflow-hidden select-none">
                                        {/* Paper Header */}
                                        {previewTab === 'billing' ? (
                                            <div className="text-center pb-2 mb-2">
                                                {/* Render Uploaded Shop Logo if Available */}
                                                {settings.receipt_shop_logo_url && (
                                                    <div className="flex justify-center mb-2">
                                                        <img 
                                                            src={`${settings.receipt_shop_logo_url}?t=${timestamp}`} 
                                                            alt="Shop Logo" 
                                                            className="max-h-16 max-w-[140px] object-contain p-1"
                                                        />
                                                    </div>
                                                )}
                                                <div className="font-bold text-lg tracking-tight uppercase">
                                                    {settings.receipt_shop_name || 'IN THE HAUS'}
                                                </div>
                                                {settings.receipt_shop_address && (
                                                    <div className="text-[9px] text-[#555] mt-0.5">{settings.receipt_shop_address}</div>
                                                )}
                                                {settings.receipt_shop_phone && (
                                                    <div className="text-[9px] text-[#555]">TEL: {settings.receipt_shop_phone}</div>
                                                )}
                                                {settings.receipt_shop_vat && (
                                                    <div className="text-[9px] text-[#555]">TAX ID: {settings.receipt_shop_vat}</div>
                                                )}
                                            </div>
                                        ) : (
                                            /* Clean Header for Kitchen & Bar Order Slips (No Logo, No Address/VAT) */
                                            <div className="text-center pb-1 mb-1">
                                                <div className="text-base font-black uppercase tracking-wide text-[#1A1A1A]">
                                                    {previewTab === 'kitchen' ? 'KITCHEN ORDER (ใบสั่งครัว)' : 'BAR ORDER (ใบสั่งบาร์)'}
                                                </div>
                                            </div>
                                        )}

                                        {/* Dynamic Divider Line */}
                                        <div className="text-center font-mono text-[10px] text-[#1A1A1A] overflow-hidden whitespace-nowrap my-1 font-bold">
                                            {generateDivider(printerConfig.divider_style || 'dashed', 32)}
                                        </div>

                                        {/* Queue & Table Box */}
                                        <div className="border-2 border-[#1A1A1A] p-2 text-center my-3 bg-[#F9F9F8]">
                                            <div className="text-base font-black uppercase tracking-tight">โต๊ะ 04 (TABLE 04)</div>
                                            <div className="text-xs font-black text-[#ff0000] mt-0.5">คิว: #HAUS-102</div>
                                        </div>

                                        {/* Customer & Staff Metadata (Only for Billing) */}
                                        {previewTab === 'billing' && (
                                            <div className="my-2 text-[10px] space-y-0.5">
                                                <div>วันที่-เวลา: {new Date().toLocaleString('th-TH')}</div>
                                                <div>ลูกค้า: ลูกค้าทั่วไป (Walk-in)</div>
                                                <div>พนักงาน: แคชเชียร์ A (CASHIER A)</div>
                                            </div>
                                        )}

                                        {/* Dynamic Divider Line */}
                                        <div className="text-center font-mono text-[10px] text-[#1A1A1A] overflow-hidden whitespace-nowrap my-1 font-bold">
                                            {generateDivider(printerConfig.divider_style || 'dashed', 32)}
                                        </div>

                                        {/* Items List */}
                                        <div className="my-2">
                                            <div className="font-bold text-[10px] pb-1 mb-2 uppercase">
                                                {previewTab === 'kitchen' ? 'รายการอาหาร (ครัว)' : previewTab === 'bar' ? 'รายการเครื่องดื่ม (บาร์)' : 'รายการสินค้า'}
                                            </div>

                                            {previewTab === 'billing' && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold w-6 shrink-0">1x</span>
                                                        <span className="font-bold flex-1 pr-1 truncate">ข้าวผัดกระเพราเนื้อสับไข่ดาว</span>
                                                        <span className="font-bold shrink-0">145.-</span>
                                                    </div>
                                                    <div className="text-[9px] text-[#555] pl-6">+ ไข่ดาวสุกพิเศษ</div>

                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold w-6 shrink-0">2x</span>
                                                        <span className="font-bold flex-1 pr-1 truncate">MATCHA LATTE ICE LARGE</span>
                                                        <span className="font-bold shrink-0">240.-</span>
                                                    </div>
                                                    <div className="text-[9px] text-[#555] pl-6">(2 x ฿120.-)</div>
                                                    <div className="text-[9px] text-[#555] pl-6">+ หวานน้อย 50%</div>
                                                </div>
                                            )}

                                            {previewTab === 'kitchen' && (
                                                <div className="space-y-3">
                                                    <div className="font-black text-sm">
                                                        <div>1x ข้าวผัดกระเพราเนื้อสับ</div>
                                                        <div className="text-[10px] font-bold text-[#ff0000] pl-3">- ไข่ดาวสุกพิเศษ</div>
                                                    </div>
                                                    <div className="font-black text-sm">
                                                        <div>2x ต้มยำกุ้งน้ำข้น (หม้อไฟ)</div>
                                                        <div className="text-[10px] font-bold text-[#ff0000] pl-3">- ขอเผ็ดน้อย</div>
                                                    </div>
                                                </div>
                                            )}

                                            {previewTab === 'bar' && (
                                                <div className="space-y-3">
                                                    <div className="font-black text-sm">
                                                        <div>2x MATCHA LATTE ICE</div>
                                                        <div className="text-[10px] font-bold text-[#ff0000] pl-3">- หวานน้อย 50%</div>
                                                        <div className="text-[10px] font-bold text-[#ff0000] pl-3">- เพิ่มแก้วน้ำแข็ง 2</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Dynamic Divider Line */}
                                        <div className="text-center font-mono text-[10px] text-[#1A1A1A] overflow-hidden whitespace-nowrap my-1 font-bold">
                                            {generateDivider(printerConfig.divider_style || 'dashed', 32)}
                                        </div>

                                        {/* Subtotal & Totals (Only for Billing) */}
                                        {previewTab === 'billing' && (
                                            <div className="space-y-1 text-[10px] my-2">
                                                <div className="flex justify-between">
                                                    <span>จำนวนชิ้น</span>
                                                    <span>3 ชิ้น</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>ยอดรวมก่อนหัก</span>
                                                    <span>385.-</span>
                                                </div>
                                                <div className="text-center font-mono text-[10px] text-[#1A1A1A] overflow-hidden whitespace-nowrap my-1 font-bold">
                                                    {generateDivider(printerConfig.divider_style || 'dashed', 32)}
                                                </div>
                                                <div className="flex justify-between font-bold text-sm pt-0.5">
                                                    <span>ยอดรวมสุทธิ</span>
                                                    <span>฿385.00</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Human Notes (If Any) */}
                                        <div className="text-[10px] my-2">
                                            <div className="font-bold">หมายเหตุ:</div>
                                            <div>ลูกค้า: ขอจานแบ่งเพิ่ม 2 ใบ</div>
                                        </div>

                                        {/* Dynamic Divider Line */}
                                        <div className="text-center font-mono text-[10px] text-[#1A1A1A] overflow-hidden whitespace-nowrap my-1 font-bold">
                                            {generateDivider(printerConfig.divider_style || 'dashed', 32)}
                                        </div>

                                        {/* Live ASCII Art Footer Display & Shop Footer (Only for Billing) */}
                                        {previewTab === 'billing' && (
                                            <>
                                                <div className="text-center my-3 whitespace-pre font-mono text-[9px] font-bold text-[#1A1A1A] leading-tight bg-[#F9F9F8] p-2 rounded border border-dashed border-[#CCCCCC]">
                                                    {printerConfig.footer_ascii_art || `T H A N K   Y O U\n  S E E   Y O U   A G A I N`}
                                                </div>

                                                <div className="text-center font-bold text-[9px] uppercase tracking-wider">
                                                    {printerConfig.shop_footer_text || settings.receipt_shop_footer || 'THANK YOU FOR YOUR VISIT'}
                                                </div>
                                            </>
                                        )}

                                        {/* Physical Paper Sawtooth/Zigzag Cut Effect */}
                                        <div className="w-full h-3 mt-4 bg-[radial-gradient(circle,_transparent_4px,_#ffffff_4px)] bg-[length:10px_10px] bg-repeat-x -mb-5"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}



                {/* TAB 5: CRM Settings */}
                {activeSettingsTab === 'crm' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in font-sans text-[#1A1A1A] mb-8">
                        {/* Left & Center: Config Rules & Relationship Levels */}
                        <div className="lg:col-span-2 space-y-6">
                            
                            {/* 1. Coins Settings Card */}
                            <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-6 rounded-2xl shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-[#D1D1CD] pb-3">
                                    <div className="flex items-center gap-2">
                                        <Coins className="text-[#FFAA00]" size={20} />
                                        <div>
                                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
                                                xhaus Coins Configuration (เงื่อนไขและกติกาเงินเหรียญ)
                                            </h2>
                                            <p className="text-[8.5px] text-[#767673] font-sans">
                                                กำหนดอัตราแลกเปลี่ยน โบนัสต้อนรับ และเงื่อนไขการสะสมเหรียญของระบบ
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-800 border border-amber-500/20 text-[9px] font-mono font-bold rounded">
                                        SYNCED REAL-TIME
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                                    {/* 1. Welcome Coins */}
                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                            Welcome Coins (เหรียญต้อนรับ)
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={settings.crm_welcome_xhaus || ''} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, crm_welcome_xhaus: e.target.value }))}
                                                onBlur={(e) => handleSave('crm_welcome_xhaus', e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#FF5500]" 
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[#767673] uppercase">xhaus</span>
                                        </div>
                                        <p className="text-[8px] text-[#767673] mt-1">รับฟรีทันทีเมื่อสมัครสมาชิก</p>
                                    </div>

                                    {/* 2. Redeem Rate */}
                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                            Redeem Rate (อัตราแลกส่วนลด)
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={settings.crm_redeem_rate_xhaus || ''} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, crm_redeem_rate_xhaus: e.target.value }))}
                                                onBlur={(e) => handleSave('crm_redeem_rate_xhaus', e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#FF5500]" 
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[#767673] uppercase">Baht/coin</span>
                                        </div>
                                        <p className="text-[8px] text-[#767673] mt-1">มูลค่าเงินบาทต่อการแลก 1 xhaus</p>
                                    </div>

                                    {/* 3. Min Redeem Limit */}
                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                            Min Redeem (แลกใช้ขั้นต่ำ)
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={settings.crm_min_redeem_xhaus || ''} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, crm_min_redeem_xhaus: e.target.value }))}
                                                onBlur={(e) => handleSave('crm_min_redeem_xhaus', e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#FF5500]" 
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[#767673] uppercase">xhaus</span>
                                        </div>
                                        <p className="text-[8px] text-[#767673] mt-1">เหรียญขั้นต่ำที่ต้องมีจึงจะแลกได้</p>
                                    </div>

                                    {/* 4. Base Spend Unit */}
                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                            Base Spend Unit (ยอดคิดเหรียญ)
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                step="1"
                                                value={settings.crm_base_spend_amount || '100'} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, crm_base_spend_amount: e.target.value }))}
                                                onBlur={(e) => handleSave('crm_base_spend_amount', e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#FF5500]" 
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[#767673] uppercase">Baht</span>
                                        </div>
                                        <p className="text-[8px] text-[#767673] mt-1">ทุกๆ X บาท = ตัวคูณ xhaus</p>
                                    </div>
                                </div>

                                {/* Granular Advanced Limits */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#D1D1CD]/60">
                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                            Max Redeem Per Bill (% ยอดบิล)
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={settings.crm_max_redeem_percent || '100'} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, crm_max_redeem_percent: e.target.value }))}
                                                onBlur={(e) => handleSave('crm_max_redeem_percent', e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#FF5500]" 
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[#767673]">%</span>
                                        </div>
                                        <p className="text-[8px] text-[#767673] mt-1">จำกัดส่วนลดเหรียญไม่เกิน X% ของบิล (100 = ไม่จำกัด)</p>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                            Evaluation Period (รอบประเมิน)
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                min="1"
                                                max="36"
                                                value={settings.crm_tier_eval_months || '12'} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, crm_tier_eval_months: e.target.value }))}
                                                onBlur={(e) => handleSave('crm_tier_eval_months', e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#FF5500]" 
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[#767673]">Months</span>
                                        </div>
                                        <p className="text-[8px] text-[#767673] mt-1">รอบคำนวณยอดสะสมเพื่อจัดระดับ (เช่น 12 เดือน)</p>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                            Grace Period (ระยะผ่อนผันใจ)
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                min="0"
                                                max="180"
                                                value={settings.crm_grace_period_days || '30'} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, crm_grace_period_days: e.target.value }))}
                                                onBlur={(e) => handleSave('crm_grace_period_days', e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-bold text-[#1A1A1A] outline-none focus:border-[#FF5500]" 
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[#767673]">Days</span>
                                        </div>
                                        <p className="text-[8px] text-[#767673] mt-1">ผ่อนผันตรึงระดับสมาชิกรักษาใจต่ออีก X วัน</p>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Dynamic Relationship Levels Card */}
                            <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-6 rounded-2xl shadow-sm space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D1D1CD] pb-3">
                                    <div className="flex items-center gap-2">
                                        <Award className="text-zinc-800" size={20} />
                                        <div>
                                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
                                                Relationship Levels Manager (จัดการระดับความสัมพันธ์ของคนในบ้าน)
                                            </h2>
                                            <p className="text-[8.5px] text-[#767673]">
                                                ปรับแต่งชื่อระดับ ยอดสะสมขั้นต่ำ ตัวคูณสะสมแต้ม และคำโปรยได้อิสระ
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 font-mono">
                                        <button
                                            type="button"
                                            onClick={handleResetTiers}
                                            className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                            title="คืนค่าระดับเริ่มต้น"
                                        >
                                            <RotateCcw size={11} /> Reset
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleAddTier}
                                            className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 border border-[#D1D1CD] text-[#1A1A1A] rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            <Plus size={12} /> Add Tier
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveTiers}
                                            disabled={isTiersSaving}
                                            className="px-3.5 py-1.5 bg-[#1A1A1A] hover:bg-[#333330] text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                                        >
                                            <Save size={12} /> {isTiersSaving ? 'Saving...' : 'Save Tiers'}
                                        </button>
                                    </div>
                                </div>

                                {/* List of Editable Tier Cards */}
                                <div className="space-y-4 pt-1">
                                    {editableTiers.map((tier, idx) => {
                                        const theme = getTierVisualTheme(tier.name, tier.badge_theme);
                                        const baseSpend = parseFloat(settings.crm_base_spend_amount) || 100;
                                        const mult = parseFloat(tier.multiplier) || 1.0;
                                        const coinsPerBase = ((baseSpend / baseSpend) * mult).toFixed(2);
                                        const returnPct = ((mult / baseSpend) * 100).toFixed(2);

                                        return (
                                            <div 
                                                key={tier.id || idx} 
                                                className="bg-white border border-[#D1D1CD] rounded-xl p-4 space-y-3 hover:shadow-md transition-all relative group"
                                            >
                                                {/* Card Header Row */}
                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 border text-[9px] font-mono font-bold rounded uppercase tracking-wider ${theme.pillBg}`}>
                                                            LEVEL {tier.level_code || String(idx + 1).padStart(2, '0')}
                                                        </span>
                                                        <input 
                                                            type="text" 
                                                            value={tier.name} 
                                                            onChange={(e) => handleTierFieldChange(idx, 'name', e.target.value)}
                                                            className="text-xs font-bold text-[#1A1A1A] bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-[#FF5500] px-1 py-0.5 outline-none font-sans"
                                                            placeholder="ชื่อระดับ เช่น Haus Common"
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        {/* Badge Theme selector */}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[8px] font-mono uppercase text-zinc-400">Theme:</span>
                                                            <select 
                                                                value={tier.badge_theme || 'bronze'}
                                                                onChange={(e) => handleTierFieldChange(idx, 'badge_theme', e.target.value)}
                                                                className="text-[9px] font-mono font-bold bg-neutral-50 border border-zinc-200 rounded px-2 py-1 outline-none cursor-pointer"
                                                            >
                                                                <option value="bronze">Clay / Bronze</option>
                                                                <option value="silver">Silver / Slate</option>
                                                                <option value="gold">Gold / VIP</option>
                                                                <option value="emerald">Emerald / Green</option>
                                                            </select>
                                                        </div>

                                                        {/* Delete Button */}
                                                        {editableTiers.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTier(idx)}
                                                                className="text-zinc-350 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                                                                title="ลบระดับนี้"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card Parameters Grid */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    {/* Min Spent Threshold */}
                                                    <div>
                                                        <label className="block text-[8.5px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                                            Min Spend (ยอดสะสมขั้นต่ำ)
                                                        </label>
                                                        <div className="relative">
                                                            <input 
                                                                type="number"
                                                                step="100"
                                                                value={tier.min_spend}
                                                                onChange={(e) => handleTierFieldChange(idx, 'min_spend', e.target.value)}
                                                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-[#D1D1CD] rounded text-xs font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#FF5500]"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-zinc-400">THB</span>
                                                        </div>
                                                    </div>

                                                    {/* Multiplier */}
                                                    <div>
                                                        <label className="block text-[8.5px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                                            Earn Multiplier (ตัวคูณแต้ม)
                                                        </label>
                                                        <div className="relative">
                                                            <input 
                                                                type="number"
                                                                step="0.05"
                                                                min="0.1"
                                                                value={tier.multiplier}
                                                                onChange={(e) => handleTierFieldChange(idx, 'multiplier', e.target.value)}
                                                                className="w-full px-2.5 py-1.5 bg-neutral-50 border border-[#D1D1CD] rounded text-xs font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#FF5500]"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-zinc-400">x</span>
                                                        </div>
                                                    </div>

                                                    {/* Calculated Return Display */}
                                                    <div className="bg-[#FAF9F5] border border-zinc-200 rounded p-2 flex flex-col justify-center text-right font-mono">
                                                        <p className="text-[9px] font-bold text-[#1A1A1A]">
                                                            ทุก {baseSpend} บ. = {coinsPerBase} xhaus
                                                        </p>
                                                        <p className="text-[8px] text-[#00CC44] font-bold uppercase mt-0.5">
                                                            มูลค่าคืน {returnPct}%
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Tagline & Condition Texts */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                    <div>
                                                        <label className="block text-[8px] font-mono uppercase text-zinc-400 mb-0.5">
                                                            Tagline (คำโปรยระดับสมาชิก)
                                                        </label>
                                                        <input 
                                                            type="text" 
                                                            value={tier.tagline || ''} 
                                                            onChange={(e) => handleTierFieldChange(idx, 'tagline', e.target.value)}
                                                            placeholder="เช่น พื้นที่ที่เราเริ่มรู้จักกัน"
                                                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded text-[9.5px] text-zinc-700 outline-none focus:border-[#FF5500]"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[8px] font-mono uppercase text-zinc-400 mb-0.5">
                                                            Condition Note (คำอธิบายเงื่อนไข)
                                                        </label>
                                                        <input 
                                                            type="text" 
                                                            value={tier.condition_text || ''} 
                                                            onChange={(e) => handleTierFieldChange(idx, 'condition_text', e.target.value)}
                                                            placeholder="เช่น มียอดใช้จ่ายสะสม 12 เดือนแรกเริ่ม"
                                                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded text-[9.5px] text-zinc-700 outline-none focus:border-[#FF5500]"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Live Simulation & Sandbox Tool */}
                            <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-6 rounded-2xl shadow-sm space-y-4">
                                <div className="flex items-center gap-2 border-b border-[#D1D1CD] pb-3">
                                    <Calculator className="text-zinc-800" size={20} />
                                    <div>
                                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
                                            Tier & Coins Live Simulator (เครื่องมือจำลองคำนวณ)
                                        </h2>
                                        <p className="text-[8.5px] text-[#767673]">
                                            ทดสอบกรอกยอดสะสมและยอดบิลเพื่อตรวจสอบระดับสมาชิกและจำนวนเหรียญที่จะได้รับ
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                                Test 12M Accumulated Spend (ยอดสะสมย้อนหลัง)
                                            </label>
                                            <div className="relative">
                                                <input 
                                                    type="number"
                                                    value={simAccumSpent}
                                                    onChange={(e) => setSimAccumSpent(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-bold font-mono outline-none"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-zinc-400">THB</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] mb-1">
                                                Test Current Bill Total (ยอดบิลมื้อนี้)
                                            </label>
                                            <div className="relative">
                                                <input 
                                                    type="number"
                                                    value={simSpendAmount}
                                                    onChange={(e) => setSimSpendAmount(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-[#D1D1CD] rounded-lg text-xs font-bold font-mono outline-none"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-zinc-400">THB</span>
                                            </div>
                                        </div>

                                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                                            <input 
                                                type="checkbox"
                                                checked={simGracePeriod}
                                                onChange={(e) => setSimGracePeriod(e.target.checked)}
                                                className="accent-[#FF5500] w-3.5 h-3.5 rounded"
                                            />
                                            <span className="text-[9px] text-[#1A1A1A] font-medium">จำลองสถานะอยู่ในช่วงผ่อนผันรักษาระดับ (Grace Period)</span>
                                        </label>
                                    </div>

                                    {/* Simulation Result Preview */}
                                    {(() => {
                                        const spendVal = parseFloat(simSpendAmount) || 0;
                                        const accumVal = parseFloat(simAccumSpent) || 0;
                                        const graceVal = simGracePeriod ? accumVal + 1000 : accumVal;
                                        const parsedTiers = parseTiersConfig(editableTiers);
                                        const res = calculateMemberTier(accumVal, graceVal, parsedTiers);
                                        const baseUnit = parseFloat(settings.crm_base_spend_amount) || 100;
                                        const coinsEarned = calculateCoinsEarned(spendVal, res.multiplier, baseUnit);
                                        const rate = parseFloat(settings.crm_redeem_rate_xhaus) || 1.0;
                                        const maxPct = parseFloat(settings.crm_max_redeem_percent) || 100;
                                        const discRes = calculateCoinsDiscount(coinsEarned * 10, rate, maxPct, spendVal, parseFloat(settings.crm_min_redeem_xhaus) || 10);
                                        const theme = getTierVisualTheme(res.current_tier, res.tier_obj?.badge_theme);

                                        return (
                                            <div className="bg-white border border-[#D1D1CD] rounded-xl p-4 flex flex-col justify-between space-y-3 font-mono text-[10px]">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                                                        <span className="text-[8px] uppercase tracking-wider text-zinc-400">Calculated Tier:</span>
                                                        <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase ${theme.pillBg}`}>
                                                            {res.current_tier} ({res.multiplier}x)
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between items-center text-[9px]">
                                                        <span className="text-zinc-500">Coins Earned (เหรียญที่ได้รอบนี้):</span>
                                                        <span className="font-bold text-emerald-600">+{coinsEarned.toFixed(2)} xhaus</span>
                                                    </div>

                                                    <div className="flex justify-between items-center text-[9px]">
                                                        <span className="text-zinc-500">Next Tier Target (สู่ระดับถัดไป):</span>
                                                        <span className="font-bold text-zinc-700">
                                                            {res.next_tier ? `อีก ${res.amount_to_next_tier.toLocaleString()} บ. (${res.progress_pct}%)` : 'สูงสุดแล้ว'}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between items-center text-[9px]">
                                                        <span className="text-zinc-500">Max Discount from Coins (เพดานส่วนลด):</span>
                                                        <span className="font-bold text-amber-700">{((spendVal * maxPct) / 100).toLocaleString()} Baht</span>
                                                    </div>
                                                </div>

                                                <div className="bg-neutral-50 p-2 rounded border border-zinc-200 text-[8px] text-zinc-500">
                                                    💡 คำนวณตามสูตร: (ยอดบิล {spendVal} / {baseUnit}) × {res.multiplier}x = {coinsEarned.toFixed(2)} xhaus
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Column 2: QR Code Registration Card & Quick Links */}
                        <div className="space-y-6 h-fit">
                            <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-6 rounded-2xl shadow-sm flex flex-col items-center text-center space-y-4">
                                <div className="w-full flex items-center gap-2 border-b border-[#D1D1CD] pb-3 text-left">
                                    <QrCode className="text-zinc-800" size={20} />
                                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
                                        Registration QR Code
                                    </h2>
                                </div>

                                <p className="text-[9px] text-[#767673] font-medium leading-relaxed">
                                    พิมพ์ภาพหรือตั้งคิวอาร์โค้ดนี้ไว้ที่โต๊ะอาหาร เพื่อให้ลูกค้าสแกนสมัครสมาชิกด่วนผ่านมือถือได้ทันที
                                </p>

                                <div className="bg-white border border-[#D1D1CD] p-4 rounded-xl shadow-inner flex items-center justify-center">
                                    {crmQrUrl ? (
                                        <img src={crmQrUrl} alt="CRM Member Card Registration QR" className="w-44 h-44" />
                                    ) : (
                                        <div className="w-44 h-44 flex items-center justify-center text-zinc-400 font-mono text-[9px]">Generating QR...</div>
                                    )}
                                </div>

                                <div className="w-full pt-2 space-y-2">
                                    <a 
                                        href={crmQrUrl} 
                                        download="crm-member-registration-qr.png"
                                        className="w-full bg-[#1A1A1A] hover:bg-[#333330] text-white py-2.5 rounded-lg font-mono text-[9px] font-bold uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                    >
                                        <Download size={12} /> Download QR Code Image
                                    </a>
                                    <a
                                        href={`${getAppOrigin()}/member-card`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full bg-white hover:bg-neutral-50 border border-[#D1D1CD] text-[#1A1A1A] py-2 rounded-lg font-mono text-[9px] font-bold uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <ExternalLink size={11} /> Open Member Portal ↗
                                    </a>
                                    <p className="text-[8px] text-[#767673] font-mono select-all">
                                        Target: {getAppOrigin()}/member-card
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bluetooth Scanner Overlay Modal */}
                {isScanning && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                        <div className="bg-white border border-[#D1D1CD] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col font-sans text-[#1A1A1A]">
                            {/* Header */}
                            <div className="bg-[#1A1A1A] text-white p-4 flex justify-between items-center">
                                <span className="font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                    <span className="animate-pulse text-red-500">●</span> SCANNING FOR PRINTERS
                                </span>
                                <button 
                                    type="button"
                                    onClick={handleCancelScan} 
                                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-sm font-bold uppercase"
                                >
                                    Close
                                </button>
                            </div>
                            
                            {/* Body */}
                            <div className="p-4 flex-1 overflow-y-auto max-h-[300px] space-y-2 no-scrollbar">
                                <p className="text-[10px] text-[#767673] uppercase tracking-wide font-bold">
                                    Select printer from the list below:
                                </p>
                                
                                {scannedDevices.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                                        <div className="w-8 h-8 rounded-full border-2 border-t-zinc-800 border-zinc-200 animate-spin" />
                                        <p className="text-xs text-[#767673] font-bold">Searching nearby devices...</p>
                                        <p className="text-[10px] text-zinc-400">Make sure Bluetooth & GPS Location are turned ON.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-[#E0E0DC] border border-[#D1D1CD] rounded-xl overflow-hidden bg-zinc-50">
                                        {scannedDevices.map((device, idx) => (
                                            <button
                                                key={device.deviceId || idx}
                                                type="button"
                                                onClick={() => handleSelectDevice(device)}
                                                className="w-full text-left px-4 py-3 hover:bg-white text-xs font-mono font-bold text-[#1A1A1A] flex items-center justify-between transition-colors active:bg-zinc-100 cursor-pointer"
                                            >
                                                <span>{device.name}</span>
                                                <span className="text-[9px] text-[#767673] font-normal">{device.deviceId}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Footer */}
                            <div className="bg-zinc-50 p-3 border-t border-[#D1D1CD] flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={handleCancelScan}
                                    className="bg-white border border-[#D1D1CD] text-[#1A1A1A] hover:bg-zinc-100 px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 7: Diagnostics & Logs */}
                {activeSettingsTab === 'debug' && (
                    <div className="space-y-6 animate-fade-in font-sans text-[#1A1A1A]">
                        {/* Summary & Diagnoses */}
                        <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-6 rounded-2xl shadow-sm space-y-4">
                            <div className="flex items-center gap-2 border-b border-[#D1D1CD] pb-3">
                                <Terminal className="text-zinc-700" size={20} />
                                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
                                    Crash Diagnostics (วิเคราะห์สาเหตุการหยุดทำงาน)
                                </h2>
                            </div>

                            {/* Diagnose Logic */}
                            {(() => {
                                const logs = logger.getLogs();
                                const crashLogs = logs.filter(l => l.level === 'CRASH');
                                const hasSunmiCrash = crashLogs.some(l => l.title.includes('print_sunmi'));

                                return (
                                    <div className="space-y-4">
                                        {hasSunmiCrash ? (
                                            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl space-y-2 animate-fade-in">
                                                <div className="flex items-center gap-2 font-bold text-xs font-mono uppercase text-red-600">
                                                    <AlertTriangle size={16} />
                                                    ตรวจพบการหยุดทำงานของแอป (Crash) จากเครื่องพิมพ์ SUNMI ในตัว
                                                </div>
                                                <p className="text-xs leading-relaxed font-medium">
                                                    แอปพลิเคชันเคยหยุดทำงานกระทันหัน (Force Close) ระหว่างเรียกใช้งานเครื่องพิมพ์ระบบ SUNMI ในตัว 
                                                    มักเกิดจากความไม่เข้ากันทางฮาร์ดแวร์ระหว่าง **Capacitor Sunmi Plugin (AIDL)** กับบอร์ดเฟิร์มแวร์ของรุ่น **Sunmi D2s Plus**
                                                </p>
                                                <div className="text-[11px] bg-white/60 p-2.5 rounded-lg border border-red-100 mt-2 space-y-1">
                                                    <div className="font-bold">💡 คำแนะนำในการแก้ไข:</div>
                                                    <div>1. เปิดแอป <span className="font-bold">App Market (หรือ App Store)</span> บนเครื่อง Sunmi D2s Plus</div>
                                                    <div>2. ค้นหาและอัปเดตแอปพลิเคชันระบบชื่อ <span className="font-bold text-brand">Sunmi Printer Service</span> (หรือ <span className="font-bold text-brand">WOYOU AIO Service</span>) เป็นเวอร์ชันล่าสุด</div>
                                                    <div>3. ทำการปิด-เปิดเครื่องใหม่ (Restart Device) เพื่อเริ่มการทำงานของบริการการพิมพ์ระบบใหม่</div>
                                                    <div>4. หลีกเลี่ยงการเปิดแอปพลิเคชันอื่นที่แย่งการใช้เครื่องพิมพ์ในเวลาเดียวกัน</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl space-y-1">
                                                <div className="flex items-center gap-2 font-bold text-xs font-mono uppercase text-emerald-600">
                                                    <ShieldCheck size={16} />
                                                    ระบบทำงานเป็นปกติ (No Native Crashes Detected)
                                                </div>
                                                <p className="text-xs leading-relaxed font-medium">
                                                    ยังไม่ตรวจพบประวัติแอปพลิเคชันปิดตัวลงกระทันหันจากปัญหาการเรียกใช้โมดูลหรือฟลัชฮาร์ดแวร์ Native
                                                </p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                                            <div className="bg-white border border-[#D1D1CD] p-3 rounded-xl space-y-1">
                                                <div className="text-subInk text-[9px] uppercase font-bold tracking-wider">Environment Info</div>
                                                <div>Platform: <span className="font-bold">{Capacitor.getPlatform()}</span></div>
                                                <div>Native App: <span className="font-bold">{Capacitor.isNativePlatform() ? 'Yes' : 'No'}</span></div>
                                            </div>
                                            <div className="bg-white border border-[#D1D1CD] p-3 rounded-xl space-y-1">
                                                <div className="text-subInk text-[9px] uppercase font-bold tracking-wider">Log Statistics</div>
                                                <div>Total Logs Cached: <span className="font-bold">{logs.length}</span></div>
                                                <div>Crashes Logged: <span className="font-bold text-red-600">{crashLogs.length}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Logs Panel */}
                        <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-6 rounded-2xl shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-[#D1D1CD] pb-3">
                                <div className="flex items-center gap-2">
                                    <FileText className="text-zinc-700" size={20} />
                                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
                                        Runtime & Uncaught Logs (ประวัติข้อผิดพลาดของระบบ)
                                    </h2>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const logsText = JSON.stringify(logger.getLogs(), null, 2);
                                            navigator.clipboard.writeText(logsText);
                                            alert("คัดลอกประวัติข้อผิดพลาดไปที่ Clipboard สำเร็จ!");
                                        }}
                                        className="bg-white hover:bg-[#E0E0DC] border border-[#D1D1CD] text-[#1A1A1A] px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm animate-none"
                                    >
                                        <Copy size={12} /> Copy Logs
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm("คุณแน่ใจหรือไม่ว่าต้องการล้างประวัติบันทึกข้อผิดพลาดทั้งหมด?")) {
                                                logger.clearLogs();
                                                alert("ล้างประวัติบันทึกสำเร็จ!");
                                                window.location.reload();
                                            }
                                        }}
                                        className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95 cursor-pointer animate-none"
                                    >
                                        <Trash2 size={12} /> Clear Logs
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto border border-[#D1D1CD] rounded-xl bg-white text-xs font-mono divide-y divide-[#EAEAEA] no-scrollbar">
                                {logger.getLogs().length === 0 ? (
                                    <div className="p-8 text-center text-subInk font-medium">ไม่มีบันทึกประวัติข้อผิดพลาดในขณะนี้</div>
                                ) : (
                                    logger.getLogs().slice().reverse().map(log => (
                                        <div key={log.id} className="p-3 hover:bg-zinc-50 transition-colors">
                                            <div className="flex justify-between items-start gap-2 mb-1">
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                                    log.level === 'CRASH' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                    log.level === 'ERROR' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                                    log.level === 'WARN' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                    'bg-blue-100 text-blue-700 border border-blue-200'
                                                }`}>
                                                    {log.level}
                                                </span>
                                                <span className="text-[10px] text-subInk">{new Date(log.timestamp).toLocaleString('th-TH')}</span>
                                            </div>
                                            <div className="font-bold text-[#1A1A1A]">{log.title}</div>
                                            {log.details && (
                                                <pre className="mt-1 p-2 bg-zinc-50 border border-zinc-150 rounded text-[9px] text-[#444] overflow-x-auto whitespace-pre-wrap font-mono max-h-[100px]">
                                                    {JSON.stringify(log.details, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 8: System Test Data Purge */}
                {activeSettingsTab === 'data_purge' && (
                    <DataPurgePanel />
                )}
            </div>
    )
}

// ═══════════════════════════════════════════════════════════
// Link Page Manager — Admin UI for /link landing page
// ═══════════════════════════════════════════════════════════
function LinkPageManager({ settings, handleSave, timestamp, setTimestamp }) {
    const [uploading, setUploading] = useState({})
    const [menuUrls, setMenuUrls] = useState([])
    const [atmUrls, setAtmUrls] = useState([])

    const promoSlots = (settings.link_menu_promo_slots || '5')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(Number);

    useEffect(() => {
        const urls = []
        for (let i = 1; i <= 10; i++) {
            const url = settings[`link_menu_${i}`]
            if (url) urls.push({ slot: i, url })
        }
        setMenuUrls(urls)

        const aUrls = []
        for (let i = 1; i <= 10; i++) {
            const url = settings[`link_atm_${i}`]
            if (url) aUrls.push({ slot: i, url })
        }
        setAtmUrls(aUrls)
    }, [settings])

    // Auto-resize image before upload (max 1200px width, converts to WebP with JPEG fallback, 0.8 quality)
    const resizeImage = (file, maxWidth = 1200, forceJpeg = false) => {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => {
                const img = new Image()
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    const scale = Math.min(1, maxWidth / img.width)
                    canvas.width = img.width * scale
                    canvas.height = img.height * scale
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                    
                    // Detect webp support via canvas
                    let type = 'image/webp'
                    let ext = '.webp'
                    if (forceJpeg) {
                        type = 'image/jpeg'
                        ext = '.jpg'
                    } else {
                        try {
                            const testData = canvas.toDataURL('image/webp')
                            if (!testData.startsWith('data:image/webp')) {
                                type = 'image/jpeg'
                                ext = '.jpg'
                            }
                        } catch (err) {
                            type = 'image/jpeg'
                            ext = '.jpg'
                        }
                    }

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ext), { type, lastModified: Date.now() }))
                    }, type, 0.8)
                }
                img.src = e.target.result
            }
            reader.readAsDataURL(file)
        })
    }

    const uploadImage = async (file, settingKey) => {
        if (!file) return
        setUploading(prev => ({ ...prev, [settingKey]: true }))
        try {
            const maxWidth = settingKey.startsWith('link_sig_img_') ? 600 : 1200
            const forceJpeg = settingKey === 'link_og_image_url'
            const resized = await resizeImage(file, maxWidth, forceJpeg)
            const ext = resized.name.split('.').pop()
            const fileName = `link/${settingKey}_${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from('public-assets').upload(fileName, resized, { upsert: true, contentType: resized.type, cacheControl: '15552000' })
            if (uploadError) throw uploadError
            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName)
            await handleSave(settingKey, publicUrl)
            setTimestamp(Date.now())
        } catch (error) {
            alert('Upload error: ' + error.message)
        } finally {
            setUploading(prev => ({ ...prev, [settingKey]: false }))
        }
    }

    const handleMenuUpload = async (files) => {
        if (!files || files.length === 0) return
        const fileArr = Array.from(files)
        let nextSlot = 1
        for (let i = 1; i <= 10; i++) {
            if (!settings[`link_menu_${i}`]) { nextSlot = i; break }
            if (i === 10 && settings[`link_menu_${i}`]) { alert('เมนูเต็ม 10 รูปแล้ว'); return }
            nextSlot = i + 1
        }
        for (const file of fileArr) {
            if (nextSlot > 10) break
            await uploadImage(file, `link_menu_${nextSlot}`)
            nextSlot++
        }
        alert(`อัพโหลดเมนูสำเร็จ ${fileArr.length} รูป!`)
    }

    const handleDeleteMenu = async (slot) => {
        if (!confirm('ลบรูปเมนูนี้และเลื่อนคิวภาพถัดไปมาแทนที่?')) return
        await handleSave(`link_menu_${slot}`, '')
        const remaining = []
        for (let i = 1; i <= 10; i++) {
            if (i === slot) continue
            const url = settings[`link_menu_${i}`]
            if (url) remaining.push(url)
        }
        for (let i = 1; i <= 10; i++) {
            await handleSave(`link_menu_${i}`, remaining[i - 1] || '')
        }
    }

    const handleAtmUpload = async (files) => {
        if (!files || files.length === 0) return
        const fileArr = Array.from(files)
        let nextSlot = 1
        for (let i = 1; i <= 10; i++) {
            if (!settings[`link_atm_${i}`]) { nextSlot = i; break }
            if (i === 10 && settings[`link_atm_${i}`]) { alert('รูปบรรยากาศเต็ม 10 รูปแล้ว'); return }
            nextSlot = i + 1
        }
        for (const file of fileArr) {
            if (nextSlot > 10) break
            await uploadImage(file, `link_atm_${nextSlot}`)
            nextSlot++
        }
        alert(`อัพโหลดรูปบรรยากาศสำเร็จ ${fileArr.length} รูป!`)
    }

    const handleDeleteAtm = async (slot) => {
        if (!confirm('ลบรูปบรรยากาศนี้และเลื่อนคิวภาพถัดไปมาแทนที่?')) return
        await handleSave(`link_atm_${slot}`, '')
        const remaining = []
        for (let i = 1; i <= 10; i++) {
            if (i === slot) continue
            const url = settings[`link_atm_${i}`]
            if (url) remaining.push(url)
        }
        for (let i = 1; i <= 10; i++) {
            await handleSave(`link_atm_${i}`, remaining[i - 1] || '')
        }
    }

    const togglePromoSlot = async (slotNum) => {
        let currentPromo = (settings.link_menu_promo_slots || '5')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(Number);
        
        if (currentPromo.includes(slotNum)) {
            currentPromo = currentPromo.filter(n => n !== slotNum);
        } else {
            currentPromo = [...currentPromo, slotNum];
        }
        
        const newValue = currentPromo.sort((a, b) => a - b).join(',');
        await handleSave('link_menu_promo_slots', newValue);
    };

    // Helper: image upload block
    const ImageUploadBlock = ({ settingKey, label, aspect = 'aspect-video', placeholder }) => (
        <div className="space-y-2">
            <label className="block text-xs font-bold text-brandDark uppercase">{label}</label>
            <div className={`relative w-full ${aspect} rounded-2xl overflow-hidden bg-gray-100 border border-gray-200`}>
                {settings[settingKey] ? (
                    <img src={safeTimestampUrl(settings[settingKey], timestamp)} className="w-full h-full object-cover" alt={label} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-subInk text-sm">{placeholder || 'ยังไม่มีรูป'}</div>
                )}
            </div>
            <div className="flex gap-2">
                <label className="flex-1 cursor-pointer group">
                    <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-2.5 text-center group-hover:border-brand transition-colors">
                        <span className="text-subInk text-xs group-hover:text-ink">
                            {uploading[settingKey] ? 'กำลังอัพโหลด...' : '📸 เลือกรูป'}
                        </span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e.target.files[0], settingKey)} />
                </label>
                {settings[settingKey] && (
                    <button onClick={() => handleSave(settingKey, '')} className="text-xs text-red-500 hover:text-red-400 px-2">ลบ</button>
                )}
            </div>
        </div>
    )

    return (
        <div className="bg-paper p-8 rounded-3xl border border-gray-200 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-ink flex items-center gap-2">🔗 Link Page Manager</h2>
                <a href="/link" target="_blank" className="text-xs bg-zinc-800 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-zinc-700 transition-colors">
                    ดูหน้า /link →
                </a>
            </div>
            <p className="text-xs text-subInk -mt-4">จัดการรูปภาพ, เมนู และข้อความสำหรับ Landing Page (/link)</p>

            {/* Logo & Open Graph Image */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="max-w-xs">
                    <ImageUploadBlock settingKey="link_logo_url" label="Logo (โลโก้)" aspect="aspect-square" placeholder="ยังไม่มีโลโก้" />
                </div>
                <div>
                    <ImageUploadBlock settingKey="link_og_image_url" label="ภาพพรีวิวสำหรับแชร์โซเชียล (Open Graph Share Image - เน้นอาหาร)" aspect="aspect-video" placeholder="ยังไม่มีรูปพรีวิวแชร์โซเชียล (ระบบจะดึงรูปพรีวิวอาหารทั่วไป/ร้าน เป็นค่าเริ่มต้น)" />
                </div>
            </div>

            {/* Text Fields */}
            <div className="grid lg:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-brandDark uppercase mb-1">ชื่อร้าน EN (Shop Name)</label>
                    <input type="text" value={settings.link_shop_name || ''} onChange={(e) => handleSave('link_shop_name', e.target.value)}
                        placeholder="IN THE HAUS" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-brandDark uppercase mb-1">ชื่อร้าน TH</label>
                    <input type="text" value={settings.link_shop_name_th || ''} onChange={(e) => handleSave('link_shop_name_th', e.target.value)}
                        placeholder="ในบ้าน" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand" />
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-brandDark uppercase mb-1">Subtitle / Tagline</label>
                    <input type="text" value={settings.link_subtitle || ''} onChange={(e) => handleSave('link_subtitle', e.target.value)}
                        placeholder="จริตจัด รสชัดเจน" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-brandDark uppercase mb-1">เวลาเปิด-ปิด</label>
                    <input type="text" value={settings.link_hours || ''} onChange={(e) => handleSave('link_hours', e.target.value)}
                        placeholder="เปิดทุกวัน 11:30 - 23:30 น." className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand" />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-brandDark uppercase mb-1">📍 ที่อยู่ (Location Text)</label>
                <input type="text" value={settings.link_location_text || ''} onChange={(e) => handleSave('link_location_text', e.target.value)}
                    placeholder="ริมแม่น้ำโขง · นครพนม" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand" />
            </div>
            <div>
                <label className="block text-xs font-bold text-brandDark uppercase mb-1">#️⃣ Hashtags (คั่นด้วย comma)</label>
                <input type="text" value={settings.link_tags || ''} onChange={(e) => handleSave('link_tags', e.target.value)}
                    placeholder="#inthehausth, #homefood, #southernthaifood" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand font-mono text-sm" />
                <p className="text-[10px] text-gray-400 mt-1">ใส่ # นำหน้า คั่นด้วย comma เช่น #tag1, #tag2, #tag3</p>
            </div>
            <div>
                <label className="block text-xs font-bold text-brandDark uppercase mb-1">🔗 ลิงก์ฟีดรูปภาพเช็กอิน (Social Media Feed JSON URL)</label>
                <input type="text" value={settings.link_social_feed_url || ''} onChange={(e) => handleSave('link_social_feed_url', e.target.value)}
                    placeholder="เช่น https://widgets.elfsight.com/... หรือ JSON Feed URL" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand font-mono text-sm" />
                <p className="text-[10px] text-gray-400 mt-1">วางลิงก์ JSON Feed จากผู้ให้บริการภายนอก (เช่น Elfsight, EmbedSocial, Outscraper) เพื่อดึงรูปภาพเช็กอินอัปเดตอัตโนมัติ 100%</p>
            </div>
            <div>
                <label className="block text-xs font-bold text-brandDark uppercase mb-1">📝 คำอธิบายสำหรับแชร์โซเชียล (Social Share Description)</label>
                <textarea rows={3} value={settings.link_og_description || ''} onChange={(e) => handleSave('link_og_description', e.target.value)}
                    placeholder="ป้อนคำอธิบายของร้านสำหรับแสดงเวลาแชร์ลิงก์ลงโซเชียล เช่น Facebook, LINE..." className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand text-sm" />
                <p className="text-[10px] text-gray-400 mt-1">ความยาวแนะนำ: ประมาณ 2-3 บรรทัด (ไม่โดนปุ่มแชร์ของแต่ละโซเชียลบดบังคำ)</p>
            </div>

            {/* Menu Images Manager - MOVED UP HERE */}
            <div className="space-y-3 border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-brandDark uppercase">📖 เมนู (Menu Images)</label>
                    <span className="text-subInk text-[10px]">ระบุตำแหน่งตามหน้าที่แสดงบนเว็บ สามารถกดปุ่มเพื่อกำหนดให้หน้านั้นเป็นแท็บโปรโมชั่นพิเศษได้</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(slot => {
                        const url = settings[`link_menu_${slot}`];
                        const isPromo = promoSlots.includes(slot);
                        return (
                            <div key={slot} className={`bg-canvas p-2 rounded-xl border flex flex-col justify-between ${isPromo ? 'border-red-200 ring-1 ring-red-100 bg-red-50/20' : 'border-gray-200'}`}>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <button
                                            type="button"
                                            onClick={() => togglePromoSlot(slot)}
                                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-colors cursor-pointer ${isPromo ? 'bg-red-500 text-white border-red-500' : 'bg-white text-subInk border-gray-200 hover:text-ink'}`}
                                            title="คลิกสลับระหว่าง เมนูหลัก กับ โปรโมชั่น"
                                        >
                                            {isPromo ? '🔥 โปรโมชั่น' : '📖 เมนูหลัก'}
                                        </button>
                                        <span className="text-[9px] font-mono text-gray-400 font-bold">#P.{slot}</span>
                                    </div>

                                    <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-gray-150 border border-gray-200 flex items-center justify-center">
                                        {url ? (
                                            <img src={safeTimestampUrl(url, timestamp)} alt={`Menu ${slot}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center text-gray-300 text-xs font-bold font-mono">Empty</div>
                                        )}
                                        {uploading[`link_menu_${slot}`] && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-col gap-1">
                                    <label className="w-full cursor-pointer">
                                        <div className="bg-white border border-gray-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-md py-1 text-[9px] font-bold text-center transition-all cursor-pointer">
                                            {url ? '🔄 เปลี่ยนรูป' : '📸 อัปโหลด'}
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e.target.files[0], `link_menu_${slot}`)} />
                                    </label>
                                    {url && (
                                        <div className="flex gap-1 w-full">
                                            <button
                                                onClick={() => handleSave(`link_menu_${slot}`, '')}
                                                className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-md py-0.5 text-[8px] font-bold transition-all text-center"
                                                title="ลบเฉพาะช่องนี้"
                                            >
                                                ลบรูป
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMenu(slot)}
                                                className="flex-1 bg-neutral-100 hover:bg-neutral-250 text-neutral-600 rounded-md py-0.5 text-[8px] font-bold transition-all text-center"
                                                title="ลบและเลื่อนคิวภาพถัดไปมาแทนที่"
                                            >
                                                ลบ & เลื่อน
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-3">
                    <label className="block w-full cursor-pointer group">
                        <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-3 text-center group-hover:border-brand transition-colors">
                            <span className="text-subInk text-xs group-hover:text-ink block">⚡ อัปโหลดเพิ่มหลายรูปพร้อมกัน (จะสุ่มเข้าช่องว่างถัดไปโดยอัตโนมัติ)</span>
                        </div>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleMenuUpload(e.target.files)} />
                    </label>
                </div>
            </div>

            {/* Signature Dishes */}
            <div className="space-y-4 border-t border-gray-100 pt-6">
                <label className="block text-xs font-bold text-brandDark uppercase">🍽 Signature Dishes (เมนูแนะนำ สูงสุด 3 จาน)</label>
                <p className="text-[10px] text-subInk -mt-2">ถ้าไม่ใส่จะไม่แสดงส่วนนี้ในหน้า /link</p>
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map(n => (
                        <div key={n} className="space-y-2 bg-canvas p-3 rounded-xl border border-gray-200">
                            <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                                {settings[`link_sig_img_${n}`] ? (
                                    <img src={safeTimestampUrl(settings[`link_sig_img_${n}`], timestamp)} className="w-full h-full object-cover" alt={`Sig ${n}`} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-subInk text-[10px]">#{n}</div>
                                )}
                            </div>
                            <label className="block cursor-pointer">
                                <div className="text-center text-[10px] text-subInk hover:text-ink py-1 border border-dashed border-gray-300 rounded-lg cursor-pointer">
                                    {uploading[`link_sig_img_${n}`] ? '...' : '📸'}
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e.target.files[0], `link_sig_img_${n}`)} />
                            </label>
                            <input type="text" value={settings[`link_sig_name_${n}`] || ''} onChange={(e) => handleSave(`link_sig_name_${n}`, e.target.value)}
                                placeholder="ชื่อเมนู" className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-ink text-xs outline-none focus:border-brand" />
                            <input type="text" value={settings[`link_sig_price_${n}`] || ''} onChange={(e) => handleSave(`link_sig_price_${n}`, e.target.value)}
                                placeholder="ราคา" className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-ink text-xs outline-none focus:border-brand font-mono" />
                            {settings[`link_sig_img_${n}`] && (
                                <button onClick={() => { handleSave(`link_sig_img_${n}`, ''); handleSave(`link_sig_name_${n}`, ''); handleSave(`link_sig_price_${n}`, ''); }}
                                    className="text-[10px] text-red-500 hover:text-red-400 w-full text-center">ลบ</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Atmosphere Images Manager */}
            <div className="space-y-3 border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-brandDark uppercase">✨ บรรยากาศร้าน (Atmosphere Images)</label>
                    <span className="text-subInk text-[10px]">ระบุตำแหน่งรูปบรรยากาศที่จะแสดงในแกลเลอรี (รูปที่ 1 จะแสดงเป็นรูปแรกสุด)</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(slot => {
                        const url = settings[`link_atm_${slot}`];
                        const isFirst = slot === 1;
                        return (
                            <div key={slot} className={`bg-canvas p-2 rounded-xl border flex flex-col justify-between ${isFirst ? 'border-brand ring-1 ring-brand bg-brand/5' : 'border-gray-200'}`}>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-[9px] font-bold ${isFirst ? 'text-ink' : 'text-subInk'}`}>
                                            รูปที่ #{slot} {isFirst ? '(หน้าปก)' : ''}
                                        </span>
                                    </div>

                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-150 border border-gray-200 flex items-center justify-center">
                                        {url ? (
                                            <img src={safeTimestampUrl(url, timestamp)} alt={`Atm ${slot}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center text-gray-300 text-xs font-bold font-mono">Empty</div>
                                        )}
                                        {uploading[`link_atm_${slot}`] && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-col gap-1">
                                    <label className="w-full cursor-pointer">
                                        <div className="bg-white border border-gray-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-md py-1 text-[9px] font-bold text-center transition-all cursor-pointer">
                                            {url ? '🔄 เปลี่ยนรูป' : '📸 อัปโหลด'}
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e.target.files[0], `link_atm_${slot}`)} />
                                    </label>
                                    {url && (
                                        <div className="flex gap-1 w-full">
                                            <button
                                                onClick={() => handleSave(`link_atm_${slot}`, '')}
                                                className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-md py-0.5 text-[8px] font-bold transition-all text-center"
                                                title="ลบเฉพาะช่องนี้"
                                            >
                                                ลบรูป
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAtm(slot)}
                                                className="flex-1 bg-neutral-100 hover:bg-neutral-250 text-neutral-600 rounded-md py-0.5 text-[8px] font-bold transition-all text-center"
                                                title="ลบและเลื่อนคิวภาพถัดไปมาแทนที่"
                                            >
                                                ลบ & เลื่อน
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-3">
                    <label className="block w-full cursor-pointer group">
                        <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-3 text-center group-hover:border-brand transition-colors">
                            <span className="text-subInk text-xs group-hover:text-ink block">⚡ อัปโหลดเพิ่มหลายรูปพร้อมกัน (จะสุ่มเข้าช่องว่างถัดไปโดยอัตโนมัติ)</span>
                        </div>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleAtmUpload(e.target.files)} />
                    </label>
                </div>
            </div>
        </div>
    )
}

