/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Synchronized Thermal Receipt & Open Bill Audit Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getThaiDate } from '../../../utils/timeUtils';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import generatePayload from 'promptpay-qr';
import html2canvas from 'html2canvas';
import ViewSlipModal from '../../shared/ViewSlipModal';
import {
    fetchPrinterConfigOnline, initPrinterConfigSync,
    generateDivider, getShortBookingId
} from '../../../utils/printerHelper';
import { posCache, getOfflineQueue } from '../../../utils/offlineHelper';
import {
    Receipt, Calendar, Filter, Search, Download, ExternalLink,
    CheckCircle2, AlertCircle, FileText, Image as ImageIcon,
    RefreshCw, Layers, CreditCard, DollarSign, Smartphone, QrCode, Printer,
    Copy, Share2, Clock, WifiOff
} from 'lucide-react';

const getCurrentBangkokMonth = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

// Item & Total extraction helpers supporting Supabase, POS Local Cache, Offline Queue, and custom fee items
const getBookingItems = (order) => {
    if (!order) return [];
    if (Array.isArray(order.order_items) && order.order_items.length > 0) {
        return order.order_items;
    }
    if (Array.isArray(order.items) && order.items.length > 0) {
        return order.items;
    }
    if (Array.isArray(order.cart) && order.cart.length > 0) {
        return order.cart;
    }
    if (Array.isArray(order.cartItems) && order.cartItems.length > 0) {
        return order.cartItems;
    }
    if (Array.isArray(order.details?.items) && order.details.items.length > 0) {
        return order.details.items;
    }
    if (Array.isArray(order.order_details) && order.order_details.length > 0) {
        return order.order_details;
    }
    return [];
};

const getItemName = (item) => {
    if (!item) return 'รายการสินค้า';
    return (
        item.menu_items?.name ||
        item.name ||
        item.menu_name ||
        item.item_name ||
        item.title ||
        item.label ||
        'รายการสินค้า'
    );
};

const getItemQty = (item) => {
    if (!item) return 1;
    const q = parseInt(item.quantity ?? item.qty ?? item.count ?? 1, 10);
    return isNaN(q) || q <= 0 ? 1 : q;
};

const getItemUnitPrice = (item) => {
    if (!item) return 0;
    const p = parseFloat(
        item.price_at_time ??
        item.price ??
        item.unit_price ??
        item.menu_items?.price ??
        0
    );
    return isNaN(p) ? 0 : p;
};

const calculateSubtotal = (order, items) => {
    const itemsSum = items.reduce((sum, item) => {
        const qty = getItemQty(item);
        const price = getItemUnitPrice(item);
        return sum + (qty * price);
    }, 0);

    if (itemsSum > 0) return itemsSum;
    const directTotal = parseFloat(order?.total_amount ?? order?.total_price ?? order?.total ?? 0);
    return isNaN(directTotal) ? 0 : directTotal;
};

const calculateNetTotal = (order, subtotal) => {
    const directTotal = parseFloat(order?.total_amount ?? order?.total_price ?? order?.total ?? 0);
    if (!isNaN(directTotal) && directTotal > 0) return directTotal;
    const discount = parseFloat(order?.discount_amount || 0);
    return Math.max(0, subtotal - (isNaN(discount) ? 0 : discount));
};

export default function SlipAuditManager({ 
    filterMode: parentFilterMode, 
    selectedDate: parentSelectedDate,
    selectedMonth: parentSelectedMonth,
    selectedYear: parentSelectedYear 
}) {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    
    // Filter controls
    const [filterMode, setFilterMode] = useState(parentFilterMode || 'month'); // 'day', 'month', 'year'
    const [selectedDate, setSelectedDate] = useState(parentSelectedDate || getThaiDate());
    const [selectedMonth, setSelectedMonth] = useState(parentSelectedMonth || getCurrentBangkokMonth());
    const [selectedYear, setSelectedYear] = useState(parentSelectedYear || String(new Date().getFullYear()));
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'open_bill', 'paid', 'slip_only', 'no_slip'
    const [searchQuery, setSearchQuery] = useState('');
    
    // Printer & Shop settings synced with backend (app_settings)
    const [printerConfig, setPrinterConfig] = useState({
        shop_name: 'IN THE HAUS',
        shop_address: '',
        shop_phone: '',
        shop_vat: '',
        shop_logo_url: '',
        shop_footer_text: '',
        shop_tagline: '',
        divider_style: 'dashed',
        footer_ascii_art: '',
        promptpay_id: ''
    });

    // Modal states
    const [viewSlipUrl, setViewSlipUrl] = useState(null);
    const [exportingId, setExportingId] = useState(null);

    // Refs for image canvas capture
    const cardRefs = useRef({});

    // Real-time Printer Config & Receipt Settings Sync with Supabase app_settings
    useEffect(() => {
        const loadSettings = async () => {
            const cfg = await fetchPrinterConfigOnline();
            if (cfg) setPrinterConfig(prev => ({ ...prev, ...cfg }));

            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['promptpay_id', 'phone_number', 'receipt_shop_phone']);

                if (data && data.length > 0) {
                    const ppObj = data.find(i => (i.key === 'promptpay_id' || i.key === 'phone_number' || i.key === 'receipt_shop_phone') && i.value);
                    if (ppObj && ppObj.value) {
                        setPrinterConfig(prev => ({ ...prev, promptpay_id: ppObj.value }));
                    }
                }
            } catch (err) {}
        };

        loadSettings();

        const unsubscribe = initPrinterConfigSync((updatedCfg) => {
            if (updatedCfg) setPrinterConfig(prev => ({ ...prev, ...updatedCfg }));
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (parentFilterMode) setFilterMode(parentFilterMode);
        if (parentSelectedDate) setSelectedDate(parentSelectedDate);
        if (parentSelectedMonth) setSelectedMonth(parentSelectedMonth);
        if (parentSelectedYear) setSelectedYear(parentSelectedYear);
    }, [parentFilterMode, parentSelectedDate, parentSelectedMonth, parentSelectedYear]);

    useEffect(() => {
        fetchOrdersAndSlips();
    }, [filterMode, selectedDate, selectedMonth, selectedYear]);

    useEffect(() => {
        applyFilters();
    }, [orders, statusFilter, searchQuery]);

    const fetchOrdersAndSlips = async () => {
        setLoading(true);
        try {
            let startIso, endIso;
            if (filterMode === 'day') {
                startIso = `${selectedDate}T00:00:00+07:00`;
                endIso = `${selectedDate}T23:59:59+07:00`;
            } else if (filterMode === 'month') {
                startIso = `${selectedMonth}-01T00:00:00+07:00`;
                const [y, m] = selectedMonth.split('-');
                const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
                endIso = `${selectedMonth}-${String(lastDay).padStart(2, '0')}T23:59:59+07:00`;
            } else {
                startIso = `${selectedYear}-01-01T00:00:00+07:00`;
                endIso = `${selectedYear}-12-31T23:59:59+07:00`;
            }

            // 1. Fetch range bookings from Supabase
            const { data: rangeData, error: rangeErr } = await supabase
                .from('bookings')
                .select(`
                    id, tracking_token, booking_time, total_amount, total_price, discount_amount,
                    status, pax, number_of_guests, booking_type, payment_slip_url, staff_remark,
                    customer_note, pickup_contact_name, pickup_contact_phone, user_id,
                    profiles ( * ),
                    tables_layout ( table_name ),
                    order_items ( id, quantity, price_at_time, special_instructions, selected_options, menu_items ( id, name, price, menu_categories ( name ) ) )
                `)
                .gte('booking_time', startIso)
                .lte('booking_time', endIso)
                .order('booking_time', { ascending: false });

            if (rangeErr) console.warn("Supabase range query warning:", rangeErr);

            // 2. Fetch ALL active Open Bills (status !== completed/cancelled/void) regardless of date bounds
            const { data: openBillsData, error: openErr } = await supabase
                .from('bookings')
                .select(`
                    id, tracking_token, booking_time, total_amount, total_price, discount_amount,
                    status, pax, number_of_guests, booking_type, payment_slip_url, staff_remark,
                    customer_note, pickup_contact_name, pickup_contact_phone, user_id,
                    profiles ( * ),
                    tables_layout ( table_name ),
                    order_items ( id, quantity, price_at_time, special_instructions, selected_options, menu_items ( id, name, price, menu_categories ( name ) ) )
                `)
                .in('status', ['pending', 'confirmed', 'seated', 'ready', 'open', 'draft', 'pending_payment'])
                .order('booking_time', { ascending: false });

            if (openErr) console.warn("Supabase open bills query warning:", openErr);

            // 3. Inspect posCache & localStorage offline queue for active/unsent orders
            let localCached = [];
            try {
                localCached = posCache.getBookings() || [];
            } catch (e) {}

            let offlineQueue = [];
            try {
                const queue = getOfflineQueue() || [];
                offlineQueue = queue.map(q => q.payload?.booking || q.payload?.order).filter(Boolean);
            } catch (e) {}

            // Deduplicate all orders by ID
            const orderMap = new Map();

            (rangeData || []).forEach(b => { if (b && b.id) orderMap.set(String(b.id), b); });
            (openBillsData || []).forEach(b => { if (b && b.id) orderMap.set(String(b.id), b); });
            localCached.forEach(b => {
                if (b && b.id && !orderMap.has(String(b.id))) {
                    orderMap.set(String(b.id), b);
                }
            });
            offlineQueue.forEach(b => {
                if (b && b.id && !orderMap.has(String(b.id))) {
                    orderMap.set(String(b.id), { ...b, isOfflineUnsent: true });
                }
            });

            const combinedRaw = Array.from(orderMap.values());

            // 4. Direct Supabase order_items query fallback for any booking missing order_items (e.g. PC browser view)
            const missingItemBookingIds = combinedRaw
                .filter(b => b && b.id && (!b.order_items || b.order_items.length === 0))
                .map(b => b.id);

            if (missingItemBookingIds.length > 0) {
                try {
                    const { data: directItems, error: itemsErr } = await supabase
                        .from('order_items')
                        .select(`
                            id,
                            booking_id,
                            quantity,
                            price_at_time,
                            price,
                            special_instructions,
                            selected_options,
                            menu_item_id,
                            menu_items (
                                id,
                                name,
                                price
                            )
                        `)
                        .in('booking_id', missingItemBookingIds);

                    if (!itemsErr && directItems && directItems.length > 0) {
                        const itemsByBooking = {};
                        directItems.forEach(item => {
                            const bId = String(item.booking_id);
                            if (!itemsByBooking[bId]) itemsByBooking[bId] = [];
                            itemsByBooking[bId].push(item);
                        });

                        combinedRaw.forEach(b => {
                            const bId = String(b.id);
                            if (itemsByBooking[bId] && itemsByBooking[bId].length > 0) {
                                b.order_items = itemsByBooking[bId];
                            }
                        });
                    }
                } catch (e) {
                    console.warn("Direct order_items fallback error:", e);
                }
            }

            // 5. Direct Supabase menu_items fallback to map missing menu item names/prices
            let menuItemMap = {};
            try {
                const { data: menuList } = await supabase
                    .from('menu_items')
                    .select('id, name, price');
                if (menuList && menuList.length > 0) {
                    menuList.forEach(m => {
                        menuItemMap[String(m.id)] = m;
                    });
                }
            } catch (e) {}

            combinedRaw.forEach(b => {
                const items = getBookingItems(b);
                items.forEach(item => {
                    if (!item.menu_items && item.menu_item_id && menuItemMap[String(item.menu_item_id)]) {
                        item.menu_items = menuItemMap[String(item.menu_item_id)];
                    }
                });
            });

            const combinedList = combinedRaw.sort((a, b) => {
                return new Date(b.booking_time || Date.now()) - new Date(a.booking_time || Date.now());
            });

            setOrders(combinedList);
        } catch (err) {
            console.error("Failed to fetch slip audit orders:", err);
            toast.error("ไม่สามารถดึงข้อมูลสลิปและออเดอร์ได้");
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let result = [...orders];

        // 1. Status Filter
        if (statusFilter === 'open_bill') {
            result = result.filter(o => o.status !== 'completed' && o.status !== 'paid' && o.status !== 'success' && o.status !== 'cancelled' && o.status !== 'void');
        } else if (statusFilter === 'paid') {
            result = result.filter(o => o.status === 'completed' || o.status === 'paid' || o.status === 'success');
        } else if (statusFilter === 'slip_only') {
            result = result.filter(o => !!o.payment_slip_url);
        } else if (statusFilter === 'no_slip') {
            result = result.filter(o => !o.payment_slip_url);
        }

        // 2. Search query filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(o => {
                const token = (o.tracking_token || '').toLowerCase();
                const idStr = String(o.id).toLowerCase();
                const table = (o.tables_layout?.table_name || '').toLowerCase();
                const name = (o.profiles?.display_name || o.pickup_contact_name || o.customer_name || '').toLowerCase();
                const phone = (o.profiles?.phone || o.pickup_contact_phone || '').toLowerCase();
                const remark = (o.staff_remark || '').toLowerCase();
                const itemsList = getBookingItems(o);
                const itemsStr = itemsList.map(i => getItemName(i)).join(' ').toLowerCase();

                return token.includes(q) || idStr.includes(q) || table.includes(q) || name.includes(q) || phone.includes(q) || remark.includes(q) || itemsStr.includes(q);
            });
        }

        setFilteredOrders(result);
    };

    const getFullSlipUrl = (srcUrl) => {
        if (!srcUrl) return '';
        if (srcUrl.startsWith('http://') || srcUrl.startsWith('https://') || srcUrl.startsWith('blob:') || srcUrl.startsWith('data:')) {
            return srcUrl;
        }
        return `https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/slips/${srcUrl}`;
    };

    const isOrderPaid = (order) => {
        return order.status === 'completed' || order.status === 'paid' || order.status === 'success';
    };

    const getPaymentMethodLabel = (order) => {
        if (!isOrderPaid(order)) {
            return 'OPEN BILL (ยังไม่ชำระเงิน)';
        }
        const remark = (order.staff_remark || '').toLowerCase();
        if (order.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน') || remark.includes('promptpay')) {
            return 'QR TRANSFER / โอนเงินผ่าน QR';
        }
        if (remark.includes('credit') || remark.includes('บัตรเครดิต')) {
            return 'CREDIT CARD / บัตรเครดิต';
        }
        if (remark.includes('wallet')) {
            return 'MEMBER WALLET / วอลเล็ทสมาชิก';
        }
        return 'CASH / เงินสด';
    };

    const handleExportSlipAsImage = async (orderId, token) => {
        const element = cardRefs.current[orderId];
        if (!element) {
            toast.error("ไม่พบโหนดสำหรับการแปลงภาพ");
            return;
        }

        setExportingId(orderId);
        toast.info("กำลังประมวลผลการส่งออกภาพใบแจ้งยอด/สลิป...");

        try {
            const canvas = await html2canvas(element, {
                useCORS: true,
                allowTaint: true,
                scale: 3,
                backgroundColor: '#ffffff',
                logging: false,
            });

            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const fileName = `bill_${token || orderId}_${selectedDate || 'audit'}.png`;
            link.href = image;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success(`ส่งออกภาพใบเสร็จ/ใบแจ้งยอดเรียบร้อยแล้ว (${fileName})`);
        } catch (err) {
            console.error("Export slip image error:", err);
            toast.error("เกิดข้อผิดพลาดในการบันทึกภาพสลิป");
        } finally {
            setExportingId(null);
        }
    };

    const handleCopyBillLink = (order) => {
        const link = `${window.location.origin}/t/${order.tracking_token || order.id}`;
        navigator.clipboard.writeText(link);
        toast.success(`คัดลอกลิงก์แจ้งยอดออเดอร์ #${getShortBookingId(order)} เรียบร้อยแล้ว (ส่งให้ลูกค้าทาง LINE/FB ได้ทันที)`);
    };

    const formatThaiDateTime = (isoString) => {
        if (!isoString) return '-';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('th-TH', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (e) {
            return isoString;
        }
    };

    const getTimeRangeTitle = () => {
        if (filterMode === 'day') return `ประจำวันที่ ${selectedDate}`;
        if (filterMode === 'month') return `ประจำเดือน ${selectedMonth}`;
        return `ประจำปี ${selectedYear}`;
    };

    const openBillsCount = orders.filter(o => o.status !== 'completed' && o.status !== 'paid' && o.status !== 'success' && o.status !== 'cancelled' && o.status !== 'void').length;
    const paidOrdersCount = orders.filter(o => o.status === 'completed' || o.status === 'paid' || o.status === 'success').length;
    const ordersWithSlipsCount = orders.filter(o => !!o.payment_slip_url).length;

    const totalRevenueSum = filteredOrders.reduce((sum, o) => {
        const items = getBookingItems(o);
        const sub = calculateSubtotal(o, items);
        const net = calculateNetTotal(o, sub);
        return sum + net;
    }, 0);

    const dividerStyle = printerConfig.divider_style || 'dashed';
    const shopName = printerConfig.shop_name || printerConfig.receipt_shop_name || 'IN THE HAUS';
    const shopAddress = printerConfig.shop_address || printerConfig.receipt_shop_address || '';
    const shopPhone = printerConfig.shop_phone || printerConfig.receipt_shop_phone || '';
    const shopVat = printerConfig.shop_vat || printerConfig.receipt_shop_vat || '';
    const shopLogoUrl = printerConfig.shop_logo_url || printerConfig.receipt_shop_logo_url || '';
    const shopTagline = printerConfig.shop_tagline || '';
    const shopFooter = printerConfig.shop_footer_text || printerConfig.receipt_shop_footer || '';
    const asciiArt = printerConfig.footer_ascii_art || '';
    const promptpayId = printerConfig.promptpay_id || '0985284217';

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* View Full Slip Modal */}
            {viewSlipUrl && (
                <ViewSlipModal 
                    url={viewSlipUrl} 
                    onClose={() => setViewSlipUrl(null)} 
                />
            )}

            {/* Header Control Panel */}
            <div className="bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[oklch(85%_0.012_28)] pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-[oklch(18%_0.012_28)] text-white rounded-xl shrink-0 shadow-sm">
                            <Receipt size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg md:text-xl font-black tracking-tight text-[oklch(18%_0.012_28)] font-sans">
                                    ระบบสลิปใบเสร็จ & Open Bill ส่งลูกค้าออนไลน์ (Thermal Ticket Sync)
                                </h2>
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-emerald-800 text-white font-bold uppercase tracking-wider">
                                    OPEN BILL & ONLINE SYNCED
                                </span>
                            </div>
                            <p className="text-xs font-mono font-bold text-[oklch(42%_0.010_28)] mt-0.5">
                                รวมรายการยังไม่ชำระเงิน (Open Bill) และรายการชำระแล้ว พร้อมสร้างภาพสลิป/QR Code ส่งลูกค้าออนไลน์ // {getTimeRangeTitle()}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={fetchOrdersAndSlips}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 border-2 border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono text-xs font-black rounded-xl transition-all shadow-sm shrink-0 min-h-[42px]"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        <span>รีเฟรชข้อมูล</span>
                    </button>
                </div>

                {/* Filter Sub-Ribbon */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
                    {/* Filter Mode Selector */}
                    <div className="md:col-span-4 grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                        <button
                            onClick={() => setFilterMode('day')}
                            className={`py-2 px-2 rounded-lg font-mono text-xs text-center transition-all ${
                                filterMode === 'day' ? 'bg-[oklch(18%_0.012_28)] text-white font-black' : 'text-[oklch(42%_0.010_28)] font-bold hover:bg-gray-50'
                            }`}
                        >
                            วัน (Day)
                        </button>
                        <button
                            onClick={() => setFilterMode('month')}
                            className={`py-2 px-2 rounded-lg font-mono text-xs text-center transition-all ${
                                filterMode === 'month' ? 'bg-[oklch(18%_0.012_28)] text-white font-black' : 'text-[oklch(42%_0.010_28)] font-bold hover:bg-gray-50'
                            }`}
                        >
                            เดือน (Month)
                        </button>
                        <button
                            onClick={() => setFilterMode('year')}
                            className={`py-2 px-2 rounded-lg font-mono text-xs text-center transition-all ${
                                filterMode === 'year' ? 'bg-[oklch(18%_0.012_28)] text-white font-black' : 'text-[oklch(42%_0.010_28)] font-bold hover:bg-gray-50'
                            }`}
                        >
                            ปี (Year)
                        </button>
                    </div>

                    {/* Date Pickers */}
                    <div className="md:col-span-4 flex items-center gap-2 bg-white px-3 py-2 rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                        <Calendar size={16} className="text-[oklch(52%_0.16_28)] shrink-0" />
                        {filterMode === 'day' && (
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-[oklch(18%_0.012_28)] font-mono font-black focus:outline-none w-full text-xs"
                            />
                        )}
                        {filterMode === 'month' && (
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent border-none text-[oklch(18%_0.012_28)] font-mono font-black focus:outline-none w-full text-xs"
                            />
                        )}
                        {filterMode === 'year' && (
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="bg-transparent border-none text-[oklch(18%_0.012_28)] font-mono font-black focus:outline-none w-full text-xs cursor-pointer"
                            >
                                <option value="2026">ปี 2026</option>
                                <option value="2025">ปี 2025</option>
                                <option value="2024">ปี 2024</option>
                            </select>
                        )}
                    </div>

                    {/* Search Input */}
                    <div className="md:col-span-4 flex items-center gap-2 bg-white px-3 py-2 rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                        <Search size={16} className="text-[oklch(55%_0.010_28)] shrink-0" />
                        <input
                            type="text"
                            placeholder="ค้นหา โต๊ะ, รหัสออเดอร์, ชื่อ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none text-[oklch(18%_0.012_28)] font-mono text-xs font-bold focus:outline-none w-full"
                        />
                    </div>
                </div>

                {/* Status & Slip Filter Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                                statusFilter === 'all' ? 'bg-[oklch(18%_0.012_28)] text-white font-black' : 'text-[oklch(42%_0.010_28)] hover:bg-gray-50'
                            }`}
                        >
                            ทั้งหมด ({orders.length})
                        </button>

                        <button
                            onClick={() => setStatusFilter('open_bill')}
                            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1 ${
                                statusFilter === 'open_bill' ? 'bg-amber-800 text-white font-black' : 'text-amber-900 bg-amber-50 hover:bg-amber-100'
                            }`}
                        >
                            <Clock size={14} />
                            <span>ยังไม่ชำระ / Open Bill ({openBillsCount})</span>
                        </button>

                        <button
                            onClick={() => setStatusFilter('paid')}
                            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1 ${
                                statusFilter === 'paid' ? 'bg-emerald-800 text-white font-black' : 'text-emerald-900 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                        >
                            <CheckCircle2 size={14} />
                            <span>ชำระเงินแล้ว ({paidOrdersCount})</span>
                        </button>

                        <button
                            onClick={() => setStatusFilter('slip_only')}
                            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1 ${
                                statusFilter === 'slip_only' ? 'bg-indigo-800 text-white font-black' : 'text-indigo-900 hover:bg-indigo-50'
                            }`}
                        >
                            <ImageIcon size={14} />
                            <span>มีสลิปแนบ ({ordersWithSlipsCount})</span>
                        </button>
                    </div>

                    <div className="font-mono text-xs font-black text-[oklch(18%_0.012_28)] bg-white px-3 py-2 rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                        ยอดขายรวมผลลัพธ์: <span className="text-[oklch(52%_0.16_28)] text-sm">฿{totalRevenueSum.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Content Viewport - Render exact backend thermal receipt & open bill cards */}
            {loading ? (
                <div className="py-20 text-center font-mono text-xs text-[oklch(55%_0.010_28)] uppercase tracking-widest flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-[oklch(85%_0.012_28)] border-t-[oklch(18%_0.012_28)] animate-spin" />
                    <span>กำลังโหลดสลิปใบเสร็จและ Open Bill...</span>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="p-10 bg-white border-2 border-dashed border-[oklch(85%_0.012_28)] rounded-2xl text-center space-y-3">
                    <AlertCircle size={32} className="mx-auto text-[oklch(55%_0.010_28)]" />
                    <div className="font-sans font-bold text-base text-[oklch(18%_0.012_28)]">
                        ไม่พบรายการออเดอร์ หรือ Open Bill ตามเงื่อนไขที่เลือก
                    </div>
                    <p className="font-mono text-xs text-[oklch(42%_0.010_28)]">
                        ลองเปลี่ยนตัวกรอง วัน/เดือน/ปี หรือเลือกแท็บ "ยังไม่ชำระ / Open Bill" หรือ "ทั้งหมด"
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                    {filteredOrders.map((order) => {
                        const queueNo = getShortBookingId(order);
                        const fullSlipUrl = getFullSlipUrl(order.payment_slip_url);
                        const items = getBookingItems(order);
                        const subtotal = calculateSubtotal(order, items);
                        const discount = parseFloat(order.discount_amount || 0);
                        const netTotal = calculateNetTotal(order, subtotal);
                        const paxCount = order.pax || order.number_of_guests || 1;
                        const defaultWalkIns = ['walk-in guest', 'walk-in pick-up', 'walk-in customer', 'walk-in', 'walk-in customer (offline)', 'walk-in pick-up (offline)', 'anonymous user', 'walk-in-customer'];
                        const guestName = order.profiles?.display_name || (order.pickup_contact_name && !defaultWalkIns.includes(order.pickup_contact_name.toLowerCase().trim()) ? order.pickup_contact_name : (order.customer_name && !defaultWalkIns.includes(order.customer_name.toLowerCase().trim()) ? order.customer_name : 'Guest'));
                        const phone = order.profiles?.phone || order.pickup_contact_phone || '';
                        const tableName = order.tables_layout?.table_name || (order.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN');
                        const paid = isOrderPaid(order);
                        const payMethodLabel = getPaymentMethodLabel(order);
                        const trackingUrl = `${window.location.origin}/t/${order.tracking_token || order.id}`;
                        const isOfflineSyncPending = items.length === 0 && (order.staff_remark || '').includes('Offline');

                        // PromptPay QR payload for unpaid / Open Bill
                        let qrPayload = trackingUrl;
                        if (!paid && netTotal > 0 && promptpayId) {
                            try {
                                qrPayload = generatePayload(promptpayId, { amount: netTotal });
                            } catch (e) {
                                qrPayload = trackingUrl;
                            }
                        }

                        const docTitle = paid ? 'RECEIPT / ใบเสร็จรับเงิน' : 'BILLING SLIP / ใบแจ้งยอดชำระเงิน';

                        return (
                            <div key={order.id} className="flex flex-col items-center gap-3">
                                {/* Action Top Ribbon */}
                                <div className="w-full flex items-center justify-between gap-2 px-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-xs font-black text-[oklch(18%_0.012_28)]">
                                            #{queueNo}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-black border ${
                                            paid 
                                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                                                : 'bg-amber-100 text-amber-900 border-amber-300'
                                        }`}>
                                            {paid ? 'PAID' : 'OPEN BILL'}
                                        </span>
                                        {(order.isOfflineUnsent || isOfflineSyncPending) && (
                                            <span className="px-1.5 py-0.5 rounded font-mono text-[8px] font-black bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-0.5">
                                                <WifiOff size={10} />
                                                <span>UNSENT POS</span>
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleCopyBillLink(order)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono text-[10px] font-bold rounded-lg transition-all min-h-[34px]"
                                            title="คัดลอกลิงก์แจ้งยอดส่งลูกค้าทาง LINE/FB"
                                        >
                                            <Copy size={12} />
                                            <span>คัดลอกลิงก์</span>
                                        </button>

                                        <button
                                            onClick={() => handleExportSlipAsImage(order.id, order.tracking_token)}
                                            disabled={exportingId === order.id}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(52%_0.16_28)] text-white font-mono text-[10px] font-black rounded-lg transition-all shadow-sm shrink-0 min-h-[34px]"
                                        >
                                            <Download size={12} />
                                            <span>{exportingId === order.id ? 'กำลังดาวน์โหลด...' : 'โหลดสลิป PNG'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Actual Thermal Receipt Ticket DOM Node (Synced with Backend Printer Layout) */}
                                <div 
                                    ref={(el) => (cardRefs.current[order.id] = el)}
                                    className="bg-white text-black p-6 w-[340px] shadow-lg border border-[oklch(85%_0.012_28)] rounded-sm font-mono relative select-none"
                                    style={{ fontFamily: "'Courier Prime', 'Courier New', monospace" }}
                                >
                                    {/* Shop Header & Logo */}
                                    <div className="text-center mb-4 flex flex-col items-center">
                                        {shopLogoUrl ? (
                                            <img 
                                                src={shopLogoUrl} 
                                                alt="Shop Logo" 
                                                className="w-24 h-auto mb-2 object-contain contrast-125"
                                            />
                                        ) : (
                                            <div className="text-2xl font-black uppercase tracking-tight mb-1">
                                                {shopName}
                                            </div>
                                        )}
                                        
                                        {shopTagline && (
                                            <p className="text-[9px] font-bold tracking-widest uppercase text-gray-700">
                                                {shopTagline}
                                            </p>
                                        )}

                                        <div className="text-[10px] font-bold uppercase tracking-wider text-black border-t border-b border-black py-1 my-2 w-full text-center">
                                            {docTitle}
                                        </div>

                                        {/* Shop Address & Tax Metadata */}
                                        {(shopAddress || shopPhone || shopVat) && (
                                            <div className="text-[8px] leading-relaxed text-center font-bold text-gray-600 border-b border-dashed border-black pb-2 mb-2 w-full uppercase">
                                                {shopAddress && <div>{shopAddress}</div>}
                                                {shopPhone && <div>TEL: {shopPhone}</div>}
                                                {shopVat && <div>TAX ID: {shopVat}</div>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Prominent Table / Queue Box */}
                                    <div className="text-center mb-4">
                                        <div className="inline-block border-2 border-black rounded-md px-6 py-2">
                                            <span className="text-[8px] font-bold block leading-none text-gray-500 uppercase tracking-wider mb-1">
                                                TABLE / โต๊ะ
                                            </span>
                                            <span className="text-2xl font-black leading-none block uppercase">
                                                {tableName}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Order Meta Grid */}
                                    <div className="grid grid-cols-2 gap-y-1 text-[10px] font-bold border-t-2 border-b-2 border-dashed border-black py-3 mb-4">
                                        <div className="text-gray-500">QUEUE NO.</div>
                                        <div className="text-right font-mono font-black">#{queueNo}</div>
                                        
                                        <div className="text-gray-500">DATE</div>
                                        <div className="text-right">{formatThaiDateTime(order.booking_time)}</div>
                                        
                                        <div className="text-gray-500">GUEST</div>
                                        <div className="text-right break-words">{guestName}</div>

                                        <div className="text-gray-500">PAX / จำนวนคน</div>
                                        <div className="text-right font-bold">{paxCount} คน</div>

                                        {phone && (
                                            <>
                                                <div className="text-gray-500">PHONE</div>
                                                <div className="text-right">{phone}</div>
                                            </>
                                        )}
                                    </div>

                                    {/* Items List */}
                                    <div className="space-y-2 mb-4">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-right mb-1 opacity-60">
                                            01. ITEMS
                                        </div>
                                        {items.length === 0 ? (
                                            <div className="text-[10px] font-bold text-center py-2 text-amber-900 bg-amber-50 rounded border border-amber-300 leading-normal px-2">
                                                ⏳ ออเดอร์เปิดจาก POS ออฟไลน์<br/>(กรุณากด 'ซิงค์ข้อมูล' ที่เครื่อง POS)
                                            </div>
                                        ) : (
                                            items.map((item, idx) => {
                                                const name = getItemName(item);
                                                const qty = getItemQty(item);
                                                const unitPrice = getItemUnitPrice(item);
                                                const lineTotal = qty * unitPrice;

                                                return (
                                                    <div key={idx} className="text-xs">
                                                        <div className="flex justify-between font-bold items-baseline gap-2">
                                                            <span className="w-6 shrink-0 text-sm font-black">{qty}x</span>
                                                            <span className="grow font-bold uppercase text-[12px] tracking-tight leading-4">
                                                                {name}
                                                            </span>
                                                            <span className="shrink-0 font-mono font-bold">
                                                                {lineTotal > 0 ? lineTotal.toLocaleString() : (unitPrice > 0 ? unitPrice.toLocaleString() : '')}
                                                            </span>
                                                        </div>
                                                        {item.special_instructions && (
                                                            <div className="pl-6 text-[10px] text-gray-800 font-bold border-l-2 border-black ml-1 pl-2">
                                                                ▶ {item.special_instructions}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Divider Line */}
                                    <div className="text-center font-mono text-[10px] text-black overflow-hidden whitespace-nowrap my-2 font-bold select-none">
                                        {generateDivider(dividerStyle, 32)}
                                    </div>

                                    {/* Totals Section */}
                                    <div className="space-y-1 mb-3 font-bold text-xs">
                                        <div className="flex justify-between text-gray-500">
                                            <span>SUBTOTAL</span>
                                            <span>{subtotal.toLocaleString()}</span>
                                        </div>
                                        {discount > 0 && (
                                            <div className="flex justify-between text-green-700">
                                                <span>DISCOUNT</span>
                                                <span>-{discount.toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="text-center font-mono text-[10px] text-black overflow-hidden whitespace-nowrap my-1 font-bold select-none">
                                            {generateDivider(dividerStyle, 32)}
                                        </div>
                                        <div className="flex justify-between items-end pt-1">
                                            <span className="font-black text-xs uppercase tracking-wider">TOTAL AMOUNT</span>
                                            <span className="font-black text-xl leading-none">{netTotal.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Payment Status & PromptPay QR Code Section */}
                                    <div className="text-center font-mono text-[10px] text-black overflow-hidden whitespace-nowrap my-2 font-bold select-none">
                                        {generateDivider(dividerStyle, 32)}
                                    </div>

                                    <div className="pt-1 text-center flex flex-col items-center">
                                        <span className="text-[9px] font-black tracking-widest uppercase mb-2">
                                            {paid ? 'ORDER COMPLETED / ชำระเรียบร้อย' : 'SCAN TO PAY / สแกนชำระเงิน (PROMPTPAY)'}
                                        </span>
                                        
                                        <div className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm inline-block my-1">
                                            <QRCodeSVG 
                                                value={qrPayload}
                                                size={120}
                                                bgColor="#FFFFFF"
                                                fgColor="#181815"
                                                level="M"
                                            />
                                        </div>
                                        
                                        <span className="text-[8px] text-gray-500 font-mono mt-1 uppercase font-bold">
                                            {paid ? 'RECEIPT VERIFICATION QR' : 'IN THE HAUS PROMPTPAY'}
                                        </span>

                                        <div className={`border-2 border-black rounded px-3 py-1 mt-3 font-black text-xs uppercase tracking-wider ${
                                            paid ? 'bg-black text-white' : 'bg-amber-100 text-amber-950 border-black'
                                        }`}>
                                            {payMethodLabel}
                                        </div>
                                    </div>

                                    {/* Uploaded Customer Slip Image Preview Attachment if present */}
                                    {order.payment_slip_url && (
                                        <div className="mt-4 pt-3 border-t-2 border-dashed border-black">
                                            <div className="text-[9px] font-black uppercase tracking-wider mb-2 flex items-center justify-between">
                                                <span>สลิปแนบ (CUSTOMER SLIP)</span>
                                                <button 
                                                    onClick={() => setViewSlipUrl(order.payment_slip_url)}
                                                    className="text-[9px] text-blue-600 underline font-bold"
                                                >
                                                    ขยายดู
                                                </button>
                                            </div>
                                            <div 
                                                onClick={() => setViewSlipUrl(order.payment_slip_url)}
                                                className="cursor-pointer overflow-hidden rounded border border-black max-h-40 bg-black flex items-center justify-center"
                                            >
                                                <img 
                                                    src={fullSlipUrl} 
                                                    alt="Attached Slip" 
                                                    className="w-full h-auto object-contain max-h-40"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Note for Staff / Kitchen */}
                                    {(order.customer_note || order.staff_remark) && (
                                        <div className="bg-black text-white p-3 font-mono text-[10px] relative mt-4">
                                            <div className="absolute -top-2 left-2 bg-black px-1 text-[8px] font-bold uppercase tracking-wider">
                                                NOTE FOR STAFF / KITCHEN
                                            </div>
                                            {order.customer_note && <div><strong>ลูกค้า:</strong> {order.customer_note}</div>}
                                            {order.staff_remark && <div><strong>พนักงาน:</strong> {order.staff_remark}</div>}
                                        </div>
                                    )}

                                    {/* ASCII Art & Footer */}
                                    <div className="text-center mt-5 space-y-1">
                                        {asciiArt && (
                                            <pre className="font-mono text-[9px] font-bold leading-tight text-center whitespace-pre overflow-x-auto text-black my-1.5">
                                                {asciiArt}
                                            </pre>
                                        )}
                                        {shopFooter && (
                                            <div className="text-[10px] font-mono text-black font-bold uppercase tracking-wider">
                                                {shopFooter}
                                            </div>
                                        )}
                                        <div className="text-[8px] font-mono font-bold text-gray-500 uppercase tracking-widest pt-1">
                                            TH
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
