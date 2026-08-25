/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Power, FileText, Heart, Terminal, QrCode, Coins, Trash2, AlertTriangle, Download, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { supabase } from './lib/supabaseClient';
import { DEFAULT_CRM_TIERS, parseTiersConfig } from './utils/crmHelper';
import { getAppOrigin } from './utils/urlHelper';

// Subcomponents
import CheckinManager from './components/admin/CheckinManager';
import DataPurgePanel from './components/admin/DataPurgePanel';
import GeneralBookingSettingsTab from './components/admin/settings/GeneralBookingSettingsTab';
import LandingPageSettingsTab from './components/admin/settings/LandingPageSettingsTab';
import IntegrationsTab from './components/admin/settings/IntegrationsTab';
import HardwarePrintersTab from './components/admin/settings/HardwarePrintersTab';
import CrmCoinsTab from './components/admin/settings/CrmCoinsTab';
import DebugLogsTab from './components/admin/settings/DebugLogsTab';

// PWA Install Button Component
const InstallPWA = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            toast.success('เริ่มการติดตั้งแอปพลิเคชัน');
        }
    };

    if (!deferredPrompt) return null;

    return (
        <button
            type="button"
            onClick={handleInstall}
            className="flex items-center gap-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] px-3 py-1.5 rounded-lg text-xs font-mono font-bold hover:bg-black transition-colors cursor-pointer shadow-xs"
        >
            <Download size={13} />
            <span>ติดตั้งแอป POS</span>
        </button>
    );
};

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        shop_mode_table: 'auto',
        shop_mode_pickup: 'auto',
        shop_mode_hausmade: 'manual_close',
        opening_time: '11:00',
        closing_time: '22:00',
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
    });

    const [timestamp, setTimestamp] = useState(Date.now());
    const [crmQrUrl, setCrmQrUrl] = useState('');
    const [editableTiers, setEditableTiers] = useState(DEFAULT_CRM_TIERS);
    const [blockedList, setBlockedList] = useState([]);
    const [targetFoodCost, setTargetFoodCost] = useState(30);
    const [activeSettingsTab, setActiveSettingsTab] = useState('booking');
    const [allCategories, setAllCategories] = useState([]);

    const [printerConfig, setPrinterConfig] = useState({
        cashier_printer_type: 'sunmi',
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
        shop_footer_text: 'THANK YOU FOR YOUR VISIT',
        divider_style: 'dashed',
        kitchen_categories: [],
        bar_categories: []
    });

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
        const url = `${getAppOrigin()}/member-card`;
        QRCode.toDataURL(url, { width: 300, margin: 2 })
            .then(urlData => setCrmQrUrl(urlData))
            .catch(err => console.error('Failed to generate CRM QR:', err));
    }, []);

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
                console.error('Failed to fetch menu categories:', err);
            }
        };
        fetchCats();
    }, []);

    // Load Printer Config
    useEffect(() => {
        const loadPrinterConfig = async () => {
            const stored = localStorage.getItem('onhaus_printer_config');
            if (stored) {
                try {
                    setPrinterConfig(JSON.parse(stored));
                } catch (err) {
                    console.error('Error reading stored printer settings:', err);
                }
            }

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
                console.error('Failed to load printer config online:', err);
            }
        };

        loadPrinterConfig();
    }, []);

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
    }, []);

    const fetchStoreSettings = async () => {
        const { data } = await supabase.from('store_settings').select('target_food_cost_pct').single();
        if (data) setTargetFoodCost(data.target_food_cost_pct || 30);
    };

    const handleSaveStoreSetting = async (key, value) => {
        if (key === 'target_food_cost_pct') setTargetFoodCost(value);
        try {
            const { error } = await supabase.from('store_settings').update({ [key]: value }).eq('id', 1);
            if (error) throw error;
            toast.success('บันทึกการตั้งค่า Food Cost % สำเร็จ');
        } catch (err) {
            console.error(err);
            toast.error('บันทึกค่าล้มเหลว');
            fetchStoreSettings();
        }
    };

    const fetchSettings = async () => {
        const { data } = await supabase.from('app_settings').select('key, value').not('key', 'in', '("tax_signature_image")');
        if (data) {
            const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
            setSettings(prev => ({ ...prev, ...map }));
            if (map.crm_tiers_config) {
                setEditableTiers(parseTiersConfig(map.crm_tiers_config));
            }
        }

        const { data: bd } = await supabase.from('blocked_dates').select('*').order('blocked_date', { ascending: true });
        setBlockedList(bd || []);
    };

    const handleSave = async (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        try {
            const { error } = await supabase.from('app_settings').upsert({ key, value: String(value) });
            if (error) throw error;
        } catch (err) {
            console.error(err);
            toast.error('บันทึกไม่สำเร็จ โปรดลองใหม่');
            fetchSettings();
        }
    };

    const handleSavePrinter = async (updatedConfig) => {
        setPrinterConfig(updatedConfig);
        localStorage.setItem('onhaus_printer_config', JSON.stringify(updatedConfig));
        try {
            await supabase.from('app_settings').upsert({
                key: 'printer_config',
                value: JSON.stringify(updatedConfig)
            });
            toast.success('บันทึกการตั้งค่าเครื่องพิมพ์เรียบร้อย');
        } catch (err) {
            console.error('Failed to sync printer config online:', err);
        }
    };

    const handleUpload = async (file, settingKey, loadingSetter) => {
        if (!file) return;
        loadingSetter(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${settingKey}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName);
            await handleSave(settingKey, publicUrl);
            setTimestamp(Date.now());
            toast.success('อัปโหลดรูปภาพสำเร็จ');
        } catch (error) {
            toast.error('Error: ' + error.message);
        } finally {
            loadingSetter(false);
        }
    };

    const SETTINGS_TABS = [
        { id: 'booking', label: 'Core & Booking', desc: 'สถานะร้าน & วันปิด', icon: Power },
        { id: 'link', label: 'Landing Page', desc: 'ลิงก์ /link & เมนู', icon: FileText },
        { id: 'checkins', label: 'Reviews Feed', desc: 'เช็กอิน & รีวิว', icon: Heart },
        { id: 'integrations', label: 'APIs & QR', desc: 'QR สั่ง & Spotify', icon: Terminal },
        { id: 'printers', label: 'Hardware & Slips', desc: 'เครื่องพิมพ์ & สลิป', icon: QrCode },
        { id: 'crm', label: 'CRM & Coins', desc: 'สมาชิกระดับ & xhaus', icon: Coins },
        { id: 'data_purge', label: 'Data Reset', desc: 'ล้างข้อมูลทดสอบ', icon: Trash2 },
        { id: 'debug', label: 'Debug Logs', desc: 'ประวัติข้อผิดพลาด', icon: AlertTriangle }
    ];

    return (
        <div className="max-w-7xl mx-auto pb-12 px-4 pt-2 text-[var(--color-ink)] space-y-6">
            {/* Top Navigation & Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-rule)] pb-3">
                <div className="flex items-center gap-2">
                    <Link
                        to="/pos"
                        className="inline-flex items-center gap-1 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors border border-[var(--color-rule)] shadow-2xs"
                    >
                        <ArrowLeft size={13} />
                        <span>POS</span>
                    </Link>
                    <Link
                        to="/staff"
                        className="inline-flex items-center gap-1 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors border border-[var(--color-rule)] shadow-2xs"
                    >
                        <ArrowLeft size={13} />
                        <span>Staff</span>
                    </Link>
                    <span className="text-[var(--color-rule)]">|</span>
                    <h1 className="text-base font-mono font-bold text-[var(--color-ink)] tracking-tight uppercase">
                        System Settings
                    </h1>
                </div>

                <InstallPWA />
            </div>

            {/* Neo-Brutalist Tabular Header Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-[var(--color-rule)] divide-x divide-y sm:divide-y-0 divide-[var(--color-rule)] bg-[var(--color-paper)] rounded-xl overflow-hidden shadow-2xs">
                {SETTINGS_TABS.map((tab) => {
                    const IconComp = tab.icon;
                    const isActive = activeSettingsTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveSettingsTab(tab.id)}
                            className={`p-3 text-left transition-colors cursor-pointer flex flex-col justify-between min-h-[64px] ${
                                isActive
                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                    : 'bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <span className="text-xs font-mono font-bold tracking-tight block truncate">
                                    {tab.label}
                                </span>
                                <IconComp size={14} className={isActive ? 'text-[var(--color-paper)]' : 'text-[var(--color-neutral)]'} />
                            </div>
                            <span className={`text-[9px] font-mono tracking-wider uppercase block truncate mt-1 ${
                                isActive ? 'text-[var(--color-paper)]/75' : 'text-[var(--color-neutral)]'
                            }`}>
                                {tab.desc}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Tab 1: Core Booking Settings */}
            {activeSettingsTab === 'booking' && (
                <GeneralBookingSettingsTab
                    settings={settings}
                    handleSave={handleSave}
                    handleUpload={handleUpload}
                    timestamp={timestamp}
                    setTimestamp={setTimestamp}
                    blockedList={blockedList}
                    fetchSettings={fetchSettings}
                />
            )}

            {/* Tab 2: Landing Page Settings */}
            {activeSettingsTab === 'link' && (
                <LandingPageSettingsTab
                    settings={settings}
                    handleSave={handleSave}
                    timestamp={timestamp}
                    setTimestamp={setTimestamp}
                />
            )}

            {/* Tab 3: Checkin & Reviews Feed */}
            {activeSettingsTab === 'checkins' && (
                <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)]">
                    <CheckinManager />
                </div>
            )}

            {/* Tab 4: Integrations & APIs */}
            {activeSettingsTab === 'integrations' && (
                <IntegrationsTab
                    settings={settings}
                    handleSave={handleSave}
                    targetFoodCost={targetFoodCost}
                    handleSaveStoreSetting={handleSaveStoreSetting}
                    allCategories={allCategories}
                    setAllCategories={setAllCategories}
                    defaultRouteCategory={defaultRouteCategory}
                />
            )}

            {/* Tab 5: Hardware & Printers */}
            {activeSettingsTab === 'printers' && (
                <HardwarePrintersTab
                    printerConfig={printerConfig}
                    setPrinterConfig={setPrinterConfig}
                    handleSavePrinter={handleSavePrinter}
                    allCategories={allCategories}
                    settings={settings}
                    handleSave={handleSave}
                    timestamp={timestamp}
                />
            )}

            {/* Tab 6: CRM & xhaus Coins */}
            {activeSettingsTab === 'crm' && (
                <CrmCoinsTab
                    settings={settings}
                    setSettings={setSettings}
                    handleSave={handleSave}
                    editableTiers={editableTiers}
                    setEditableTiers={setEditableTiers}
                    crmQrUrl={crmQrUrl}
                />
            )}

            {/* Tab 7: Data Purge */}
            {activeSettingsTab === 'data_purge' && (
                <DataPurgePanel />
            )}

            {/* Tab 8: Debug & System Logs */}
            {activeSettingsTab === 'debug' && (
                <DebugLogsTab />
            )}
        </div>
    );
}
