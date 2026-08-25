/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
    Printer as PrinterIcon, 
    TrendingUp, 
    Banknote, 
    CreditCard, 
    Percent, 
    ShoppingBag, 
    Loader2, 
    RefreshCw, 
    CheckCircle2, 
    FileText,
    Clock,
    ChevronDown,
    ChevronUp,
    X,
    Image as ImageIcon,
    Search,
    Calendar,
    AlertCircle,
    RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';
import SlipModal from '../components/shared/SlipModal';
import ViewSlipModal from '../components/shared/ViewSlipModal';
import POSBillDetailsModal from './POSBillDetailsModal';
import { 
    printToBluetoothDirect, 
    encodeShiftReportData, 
    encodeShiftClosureReportData, 
    printToRawBTWebSocket, 
    printToSunmiBuiltIn, 
    compileShiftReportData, 
    getShortBookingId 
} from '../utils/printerHelper';
import { getCurrentShift, getShiftHistory, syncShiftHistoryFromCloud, voidShiftTransaction, getBookingPaymentBreakdown, calculateShiftMetrics } from '../utils/shiftHelper';
import { isOnline } from '../utils/offlineHelper';
import { parseTableTransferInfo } from '../utils/tableTransferHelper';

export { getBookingPaymentBreakdown };

export default function POSReportsPanel({ isActive = true, refreshKey = 0 }) {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeReprintBooking, setActiveReprintBooking] = useState(null);
    const [activeViewBooking, setActiveViewBooking] = useState(null);
    const [shiftHistory, setShiftHistory] = useState([]);
    const [activeShift, setActiveShift] = useState(null);
    const [activeShiftSummary, setActiveShiftSummary] = useState(null);
    const [activeShiftTopSellers, setActiveShiftTopSellers] = useState([]);
    const [expandedShiftId, setExpandedShiftId] = useState(null);
    const [expandedShiftDetails, setExpandedShiftDetails] = useState({});
    const [payMethodFilter, setPayMethodFilter] = useState('all'); // 'all' | 'cash' | 'qr' | 'credit' | 'void'
    const [searchQuery, setSearchQuery] = useState('');
    const [shiftSearchQuery, setShiftSearchQuery] = useState('');
    const [viewSlipUrl, setViewSlipUrl] = useState(null);

    // Filter Date (Defaults to Today in Asia/Bangkok)
    const getBangkokDate = () => {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    };
    const getYesterdayBangkokDate = () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    };
    const [filterDate, setFilterDate] = useState(getBangkokDate());

    const isActiveRef = useRef(isActive);
    useEffect(() => {
        isActiveRef.current = isActive;
    }, [isActive]);

    const loadShiftHistoryData = () => {
        const history = getShiftHistory();
        setShiftHistory(history);

        if (isActiveRef.current && isOnline()) {
            syncShiftHistoryFromCloud().then(cloudHistory => {
                if (cloudHistory) {
                    setShiftHistory(cloudHistory);
                }
            });
        }
    };

    const loadActiveShift = async () => {
        const current = getCurrentShift();
        setActiveShift(current);
        if (!current) {
            setActiveShiftSummary(null);
            setActiveShiftTopSellers([]);
            return;
        }

        // If inactive or offline, calculate directly from local transactions to save bandwidth
        if (!isActiveRef.current || !isOnline()) {
            const metrics = calculateShiftMetrics(current, []);
            let fallbackCash = 0, fallbackQr = 0, fallbackCredit = 0;
            (current.transactions || []).forEach(tx => {
                const amt = Number(tx.amount || 0);
                if (tx.paymentMethod === 'cash') fallbackCash += amt;
                else if (tx.paymentMethod === 'credit') fallbackCredit += amt;
                else fallbackQr += amt;
            });
            metrics.cashSales = Math.max(metrics.cashSales, fallbackCash);
            metrics.qrSales = Math.max(metrics.qrSales, fallbackQr);
            metrics.creditSales = Math.max(metrics.creditSales, fallbackCredit);
            metrics.totalSales = metrics.cashSales + metrics.qrSales + metrics.creditSales;
            metrics.expectedCash = metrics.openingFloat + metrics.cashSales + metrics.totalIn - metrics.totalOut;
            setActiveShiftSummary(metrics);
            return;
        }

        try {
            // Fetch bookings completed during the active shift (using booking_time OR updated_at)
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    id, 
                    status, 
                    total_amount, 
                    discount_amount,
                    staff_remark, 
                    customer_note,
                    payment_slip_url,
                    booking_time,
                    updated_at,
                    order_items (
                        quantity,
                        custom_name,
                        menu_items (
                            name
                        )
                    )
                `)
                .eq('status', 'completed')
                .or(`booking_time.gte.${current.openedAt},updated_at.gte.${current.openedAt}`);

            if (!error && data) {
                const metrics = calculateShiftMetrics(current, data);
                setActiveShiftSummary(metrics);

                const itemCounts = {};
                data.forEach(b => {
                    b.order_items?.forEach(item => {
                        const name = item.custom_name || item.menu_items?.name || item.name || 'เมนูเพิ่มเติม';
                        const qty = item.quantity || 0;
                        itemCounts[name] = (itemCounts[name] || 0) + qty;
                    });
                });

                const sortedSellers = Object.entries(itemCounts)
                    .map(([name, qty]) => ({ name, quantity: qty }))
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, 10);
                setActiveShiftTopSellers(sortedSellers);
            } else {
                // Fallback to local transactions
                const metrics = calculateShiftMetrics(current, []);
                let fallbackCash = 0, fallbackQr = 0, fallbackCredit = 0;
                (current.transactions || []).forEach(tx => {
                    const amt = Number(tx.amount || 0);
                    if (tx.paymentMethod === 'cash') fallbackCash += amt;
                    else if (tx.paymentMethod === 'credit') fallbackCredit += amt;
                    else fallbackQr += amt;
                });
                metrics.cashSales = Math.max(metrics.cashSales, fallbackCash);
                metrics.qrSales = Math.max(metrics.qrSales, fallbackQr);
                metrics.creditSales = Math.max(metrics.creditSales, fallbackCredit);
                metrics.totalSales = metrics.cashSales + metrics.qrSales + metrics.creditSales;
                metrics.expectedCash = metrics.openingFloat + metrics.cashSales + metrics.totalIn - metrics.totalOut;
                setActiveShiftSummary(metrics);
            }
        } catch (err) {
            console.error("Failed to load active shift summary:", err);
            const metrics = calculateShiftMetrics(current, []);
            setActiveShiftSummary(metrics);
            setActiveShiftTopSellers([]);
        }
    };

    useEffect(() => {
        if (!expandedShiftId) return;
        if (expandedShiftDetails[expandedShiftId]) return;

        const fetchShiftSellers = async () => {
            setExpandedShiftDetails(prev => ({
                ...prev,
                [expandedShiftId]: { loading: true, topSellers: [] }
            }));

            try {
                const shift = shiftHistory.find(x => x.id === expandedShiftId);
                if (!shift) throw new Error("Shift not found");

                const openedAt = shift.openedAt;
                const closedAt = shift.closedAt || new Date().toISOString();

                const { data, error } = await supabase
                    .from('bookings')
                    .select(`
                        id,
                        status,
                        order_items (
                            quantity,
                            custom_name,
                            menu_items (
                                name
                            )
                        )
                    `)
                    .eq('status', 'completed')
                    .or(`and(booking_time.gte.${openedAt},booking_time.lte.${closedAt}),and(updated_at.gte.${openedAt},updated_at.lte.${closedAt})`);

                if (error) throw error;

                const itemCounts = {};
                (data || []).forEach(b => {
                    b.order_items?.forEach(item => {
                        const name = item.custom_name || item.menu_items?.name || item.name || 'เมนูเพิ่มเติม';
                        const qty = item.quantity || 0;
                        itemCounts[name] = (itemCounts[name] || 0) + qty;
                    });
                });

                const sortedSellers = Object.entries(itemCounts)
                    .map(([name, qty]) => ({ name, quantity: qty }))
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, 10);

                setExpandedShiftDetails(prev => ({
                    ...prev,
                    [expandedShiftId]: { loading: false, topSellers: sortedSellers }
                }));
            } catch (err) {
                console.error("Failed to fetch sellers for shift:", err);
                setExpandedShiftDetails(prev => ({
                    ...prev,
                    [expandedShiftId]: { loading: false, topSellers: [] }
                }));
            }
        };

        fetchShiftSellers();
    }, [expandedShiftId, shiftHistory]);

    const fetchReportData = async (showSpinner = true) => {
        if (!isActiveRef.current) return;
        if (showSpinner) setLoading(true);
        try {
            const startOfDay = `${filterDate}T00:00:00+07:00`;
            const endOfDay = `${filterDate}T23:59:59+07:00`;

            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    *,
                    profiles ( id, display_name, nickname, phone_number, current_tier ),
                    tables_layout (table_name),
                    order_items (
                        id,
                        quantity,
                        price_at_time,
                        selected_options,
                        menu_item_id,
                        menu_items (
                            name,
                            category_id
                        )
                    ),
                    promotion_codes (code)
                `)
                .or(`and(booking_time.gte.${startOfDay},booking_time.lte.${endOfDay}),and(updated_at.gte.${startOfDay},updated_at.lte.${endOfDay},status.eq.completed)`)
                .order('booking_time', { ascending: false });

            let finalBookings = bookingsData || [];
            if (bookingsError) {
                // Fallback to strict booking_time range
                const fallbackRes = await supabase
                    .from('bookings')
                    .select(`
                        *,
                        profiles ( id, display_name, nickname, phone_number, current_tier ),
                        tables_layout (table_name),
                        order_items (
                            id,
                            quantity,
                            price_at_time,
                            selected_options,
                            menu_item_id,
                            menu_items (
                                name,
                                category_id
                            )
                        ),
                        promotion_codes (code)
                    `)
                    .gte('booking_time', startOfDay)
                    .lte('booking_time', endOfDay)
                    .order('booking_time', { ascending: false });
                if (fallbackRes.error) throw fallbackRes.error;
                finalBookings = fallbackRes.data || [];
            }
            setBookings(finalBookings);

            // Load categories from cache if available to prevent excessive queries
            try {
                const cachedCats = localStorage.getItem('pos_cache_menu_categories');
                if (cachedCats) {
                    const parsed = JSON.parse(cachedCats);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setCategories(parsed);
                        return;
                    }
                }
            } catch (e) {}

            const { data: categoriesData } = await supabase
                .from('menu_categories')
                .select('id, name');
            if (categoriesData) {
                setCategories(categoriesData);
                try {
                    localStorage.setItem('pos_cache_menu_categories', JSON.stringify(categoriesData));
                } catch (e) {}
            }

        } catch (err) {
            console.error("Error fetching report data:", err);
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    useEffect(() => {
        if (isActive) {
            fetchReportData(true);
            loadShiftHistoryData();
            loadActiveShift();
        }

        let debounceTimer = null;
        const triggerDebouncedSync = () => {
            if (!isActiveRef.current) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadShiftHistoryData();
                loadActiveShift();
                fetchReportData(false);
            }, 500);
        };

        const handleShiftChanged = () => {
            triggerDebouncedSync();
        };
        window.addEventListener('pos-shift-changed', handleShiftChanged);

        // Realtime Subscription: Instant update whenever any booking or shift changes
        const reportsRealtimeChannel = supabase.channel('pos-reports-realtime-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                triggerDebouncedSync();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_shifts' }, () => {
                triggerDebouncedSync();
            })
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            window.removeEventListener('pos-shift-changed', handleShiftChanged);
            supabase.removeChannel(reportsRealtimeChannel);
        };
    }, [filterDate, isActive]);

    // Instant update when switching into reports tab or when a checkout happens
    useEffect(() => {
        if (isActive) {
            fetchReportData(false);
            loadActiveShift();
            loadShiftHistoryData();
        }
    }, [isActive, refreshKey]);

    // --- DERIVED METRICS ---
    const categoryMap = useMemo(() => {
        return categories.reduce((acc, cat) => ({ ...acc, [cat.id]: cat.name }), {});
    }, [categories]);

    const completedBookings = useMemo(() => bookings.filter(b => b.status === 'completed'), [bookings]);
    const mergedBookings = useMemo(() => bookings.filter(b => parseTableTransferInfo(b, bookings).isMergedSource), [bookings]);
    const pureVoidedBookings = useMemo(() => bookings.filter(b => (b.status === 'void' || b.status === 'cancelled') && !parseTableTransferInfo(b, bookings).isMergedSource), [bookings]);
    const voidedBookings = useMemo(() => bookings.filter(b => b.status === 'void' || b.status === 'cancelled'), [bookings]);
    const activeBookings = useMemo(() => bookings.filter(b => b.status === 'seated' || b.status === 'confirmed'), [bookings]);

    const totalSales = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const totalDiscounts = completedBookings.reduce((sum, b) => sum + (b.discount_amount || 0), 0);
    const activeUnpaid = activeBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

    // Accurate calculation of cash, qr, and credit sales
    const { cashSales, qrSales, creditSales } = useMemo(() => {
        let cash = 0, qr = 0, credit = 0;
        completedBookings.forEach(b => {
            const breakdown = getBookingPaymentBreakdown(b);
            cash += breakdown.cash;
            qr += breakdown.qr;
            credit += breakdown.credit;
        });
        return { cashSales: cash, qrSales: qr, creditSales: credit };
    }, [completedBookings]);

    // Filter bookings based on payment method tab and search query
    const filteredForBreakdown = useMemo(() => {
        let sourceList = completedBookings;
        if (payMethodFilter === 'void') {
            sourceList = pureVoidedBookings;
        } else if (payMethodFilter === 'merged') {
            sourceList = mergedBookings;
        }

        return sourceList.filter(b => {
            if (payMethodFilter !== 'all' && payMethodFilter !== 'void' && payMethodFilter !== 'merged') {
                const breakdown = getBookingPaymentBreakdown(b);
                if (payMethodFilter === 'cash' && breakdown.cash <= 0) return false;
                if (payMethodFilter === 'qr' && breakdown.qr <= 0) return false;
                if (payMethodFilter === 'credit' && breakdown.credit <= 0) return false;
            }

            const defaultWalkIns = ['walk-in guest', 'walk-in pick-up', 'walk-in customer', 'walk-in', 'walk-in customer (offline)', 'walk-in pick-up (offline)', 'anonymous user', 'walk-in-customer'];
            const getGuestNameLower = () => {
                if (b.profiles?.display_name) return b.profiles.display_name.toLowerCase();
                const name = b.pickup_contact_name || b.customer_name || '';
                if (!name || defaultWalkIns.includes(name.toLowerCase().trim())) return 'guest';
                return name.toLowerCase();
            };

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim().replace(/^#/, '');
                const shortId = getShortBookingId(b).toLowerCase();
                const token = (b.tracking_token || '').toLowerCase();
                const idStr = String(b.id).toLowerCase();
                const tableName = (b.tables_layout?.table_name || '').toLowerCase();
                const guestName = getGuestNameLower();
                const phone = (b.profiles?.phone_number || b.pickup_contact_phone || '').toLowerCase();
                const remark = (b.staff_remark || '').toLowerCase();

                return shortId.includes(q) || token.includes(q) || idStr.includes(q) || tableName.includes(q) || guestName.includes(q) || phone.includes(q) || remark.includes(q);
            }
            return true;
        });
    }, [completedBookings, voidedBookings, mergedBookings, pureVoidedBookings, payMethodFilter, searchQuery]);

    // Category sales compile
    const categoryList = useMemo(() => {
        const categorySales = {};
        filteredForBreakdown.forEach(b => {
            b.order_items?.forEach(item => {
                const catId = item.menu_items?.category_id || item.category_id || (item.destination === 'bar' ? 'bar' : 'kitchen');
                const catName = categoryMap[catId] || (item.destination === 'bar' ? 'เครื่องดื่ม' : item.destination === 'kitchen' ? 'อาหาร' : 'อื่นๆ / Uncategorized');
                const itemTotal = (item.price_at_time || 0) * (item.quantity || 0);
                
                if (!categorySales[catId]) {
                    categorySales[catId] = {
                        name: catName,
                        quantity: 0,
                        amount: 0
                    };
                }
                categorySales[catId].quantity += item.quantity || 0;
                categorySales[catId].amount += itemTotal;
            });
        });

        const list = Object.values(categorySales).sort((a, b) => b.amount - a.amount);
        const sumAmt = list.reduce((s, c) => s + c.amount, 0) || 1;
        return list.map(c => ({
            ...c,
            pct: Math.round((c.amount / sumAmt) * 100)
        }));
    }, [filteredForBreakdown, categoryMap]);

    // Filtered historical shifts
    const filteredShiftHistory = useMemo(() => {
        if (!shiftSearchQuery.trim()) return shiftHistory;
        const q = shiftSearchQuery.toLowerCase().trim();
        return shiftHistory.filter(s => {
            const name = (s.staffName || '').toLowerCase();
            const dateStr = s.openedAt ? new Date(s.openedAt).toLocaleString('th-TH').toLowerCase() : '';
            return name.includes(q) || dateStr.includes(q);
        });
    }, [shiftHistory, shiftSearchQuery]);

    // Print Shift Report
    const handlePrintShiftReport = async () => {
        let paperSize = '80mm';
        let printerType = 'sunmi';
        let btDeviceName = '';
        
        try {
            const stored = localStorage.getItem('onhaus_printer_config');
            if (stored) {
                const config = JSON.parse(stored);
                printerType = config.cashier_printer_type || 'sunmi';
                btDeviceName = config.cashier_printer_bt_name || '';
                paperSize = config.cashier_paper_size || '80mm';
            }
        } catch (err) {
            console.error("Failed to read printer config:", err);
        }

        const dayShift = {
            staffName: 'Cashier Staff',
            openedAt: bookings.length > 0 ? bookings[bookings.length - 1].booking_time : new Date().toISOString(),
            closedAt: new Date().toISOString(),
            openingFloat: 0,
            expectedCash: cashSales,
            closedCash: cashSales,
            difference: 0,
            cashSales: cashSales,
            qrSales: qrSales,
            creditSales: creditSales,
            totalSales: totalSales,
            totalIn: 0,
            totalOut: 0
        };
        const compiledReport = compileShiftReportData(dayShift, bookings, categories);

        if (printerType === 'sunmi') {
            try {
                const rawBytes = encodeShiftReportData(compiledReport, '80mm', 'sunmi');
                await printToSunmiBuiltIn(rawBytes);
                return;
            } catch (err) {
                console.error("SUNMI shift report print failed:", err);
            }
        } else if (printerType === 'rawbt') {
            try {
                const rawBytes = encodeShiftReportData(compiledReport, paperSize, 'rawbt');
                await printToRawBTWebSocket(rawBytes);
                return;
            } catch (err) {
                console.error("RawBT shift report print failed:", err);
            }
        } else if (printerType === 'bluetooth') {
            try {
                const rawBytes = encodeShiftReportData(compiledReport, paperSize, 'bluetooth');
                await printToBluetoothDirect(btDeviceName, rawBytes);
                return;
            } catch (err) {
                console.error("Direct bluetooth shift report print failed:", err);
            }
        }

        const printDateStr = new Date().toLocaleString('th-TH');
        const catHtml = categoryList.length > 0 ? `
            <div class="table-row table-header" style="font-weight: bold; border-bottom: 1px dashed black; padding-bottom: 3px; margin-bottom: 4px;">
                <span class="col-name">รายการ / หมวดหมู่</span>
                <span class="col-qty">จำนวน</span>
                <span class="col-amt">ยอดเงิน</span>
            </div>
            ${categoryList.map(c => `
                <div class="table-row">
                    <span class="col-name">${c.name}</span>
                    <span class="col-qty">x${c.quantity}</span>
                    <span class="col-amt">฿${c.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            `).join('')}
        ` : '<div class="empty">No Category Sales</div>';

        const htmlContent = `
            <html>
                <head>
                    <title>Shift Report - ${filterDate}</title>
                    <style>
                        body { 
                            font-family: monospace; 
                            background: white; 
                            color: black; 
                            font-size: 11px; 
                            padding: 20px 10px;
                            width: 280px;
                        }
                        .header { text-align: center; margin-bottom: 15px; }
                        .title { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
                        .subtitle { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
                        .date { font-size: 9px; color: #555; }
                        .section { border-top: 1px dashed black; padding: 10px 0; margin-top: 10px; }
                        .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                        .table-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
                        .col-name { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                        .col-qty { width: 45px; text-align: right; }
                        .col-amt { width: 85px; text-align: right; font-weight: bold; }
                        .grand-total-box {
                            border: 2px solid black;
                            background: #f8f8f8;
                            text-align: center;
                            padding: 10px 6px;
                            margin: 15px 0;
                        }
                        .grand-total-label { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
                        .grand-total-val { font-size: 24px; font-weight: bold; line-height: 1; color: #000; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">IN THE HAUS</div>
                        <div class="subtitle">DAILY SALES SUMMARY</div>
                        <div class="date">Report Date: ${filterDate}</div>
                        <div class="date">Printed: ${printDateStr}</div>
                    </div>
                    <div class="section">
                        <div class="section-title">Sales Summary</div>
                        <div class="row"><span>Total Bills</span> <span>${completedBookings.length}</span></div>
                        <div class="row"><span>Total Discounts</span> <span>-฿${totalDiscounts.toLocaleString()}</span></div>
                        <div class="row"><span>Cash Sales</span> <span>฿${cashSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <div class="row"><span>QR Transfer</span> <span>฿${qrSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <div class="row"><span>Credit Card</span> <span>฿${creditSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    </div>
                    <div class="section">
                        <div class="section-title">Sales By Category</div>
                        ${catHtml}
                    </div>
                    <div class="grand-total-box">
                        <div class="grand-total-label">NET REVENUE</div>
                        <div class="grand-total-val">฿${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <script>window.onload = function() { window.print(); }</script>
                </body>
            </html>
        `;

        fallbackBrowserPrint(htmlContent);
    };

    const handlePrintHistoricalShiftReport = async (shift) => {
        const toastId = toast.loading('กำลังโหลดข้อมูลและเตรียมพิมพ์รายงานประวัติ...');
        const adjs = Array.isArray(shift.adjustments) ? shift.adjustments : [];
        const totalIn = adjs.length > 0 
            ? adjs.filter(a => a.type === 'in').reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
            : Number(shift.totalIn || 0);
        const totalOut = adjs.length > 0 
            ? adjs.filter(a => a.type === 'out').reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
            : Number(shift.totalOut || 0);
        try {
            let bookingsData = [];
            if (isOnline()) {
                const { data, error } = await supabase
                    .from('bookings')
                    .select(`
                        *,
                        tables_layout (table_name),
                        order_items (
                            id,
                            quantity,
                            price_at_time,
                            menu_item_id,
                            status,
                            menu_items (
                                name,
                                category_id
                            )
                        )
                    `)
                    .eq('status', 'completed')
                    .or(`and(booking_time.gte.${shift.openedAt},booking_time.lte.${shift.closedAt || new Date().toISOString()}),and(updated_at.gte.${shift.openedAt},updated_at.lte.${shift.closedAt || new Date().toISOString()})`);
                if (!error && data) {
                    bookingsData = data;
                }
            }
            
            const { data: categoriesData } = await supabase
                .from('menu_categories')
                .select('id, name');
            
            const compiledReport = compileShiftReportData(
                {
                    ...shift,
                    totalIn,
                    totalOut
                },
                bookingsData,
                categoriesData || []
            );

            let reportPaperSize = '80mm';
            try {
                const storedCfg = localStorage.getItem('onhaus_printer_config');
                if (storedCfg) {
                    const cfg = JSON.parse(storedCfg);
                    reportPaperSize = cfg.cashier_paper_size || cfg.paper_width || '80mm';
                }
            } catch (e) {}

            const rawBytes = encodeShiftClosureReportData(compiledReport, reportPaperSize, 'sunmi');
            await printToSunmiBuiltIn(rawBytes);
            toast.dismiss(toastId);
            toast.success("พิมพ์รายงานประวัติรอบขายผ่าน SUNMI สำเร็จ");
        } catch (err) {
            console.error("Historical Shift Print failed:", err);
            toast.dismiss(toastId);
            toast.error("ไม่สามารถพิมพ์ผ่าน Sunmi ได้: " + (err.message || 'Error'));
        }
    };

    const fallbackBrowserPrint = (htmlContent) => {
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
    };

    const handleVoidBill = async (bookingId, amount) => {
        const isConfirmed = window.confirm(`คุณแน่ใจหรือไม่ที่จะทำการยกเลิก (Void) บิลยอด ฿${amount.toLocaleString()}.- ใช่หรือไม่?\nการดำเนินการนี้จะเปลี่ยนสถานะบิลเป็นโมฆะและบันทึกประวัติการยกเลิก`);
        if (!isConfirmed) return;

        try {
            const { error } = await supabase
                .from('bookings')
                .update({ 
                    status: 'void',
                    staff_remark: `[VOIDED_BY_STAFF] ${new Date().toLocaleTimeString('th-TH')}`
                })
                .eq('id', bookingId);

            if (error) throw error;

            const currentShift = getCurrentShift();
            if (currentShift && currentShift.transactions?.some(tx => tx.bookingId === bookingId)) {
                voidShiftTransaction(bookingId);
                loadActiveShift();
            }

            toast.success("ยกเลิกบิล (Void) สำเร็จแล้ว");
            fetchReportData();
        } catch (err) {
            console.error("Failed to void bill:", err);
            toast.error(`เกิดข้อผิดพลาดในการยกเลิกบิล: ${err.message || err}`);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 bg-[oklch(94%_0.010_28)] overflow-y-auto text-[oklch(18%_0.012_28)] font-sans select-none">
            {/* Header controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-[oklch(85%_0.012_28)] shrink-0">
                <div>
                    <h3 className="font-mono font-bold text-sm tracking-wider uppercase text-[oklch(18%_0.012_28)]">
                        DAILY SALES & SHIFT REPORT / รายงานยอดขายและสรุปรอบกะ
                    </h3>
                    <p className="text-[10px] text-[oklch(55%_0.010_28)] font-bold font-mono mt-0.5 uppercase tracking-tight">
                        ตรวจสอบยอดชำระเงิน ลิ้นชักเงินสด และพิมพ์รายงานสรุปกะ
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto font-mono text-[10px] flex-wrap">
                    <div className="flex items-center bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-lg p-0.5 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setFilterDate(getBangkokDate())}
                            className={`px-2.5 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                                filterDate === getBangkokDate() 
                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] shadow-2xs' 
                                    : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                            }`}
                        >
                            วันนี้
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterDate(getYesterdayBangkokDate())}
                            className={`px-2.5 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                                filterDate === getYesterdayBangkokDate() 
                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] shadow-2xs' 
                                    : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                            }`}
                        >
                            เมื่อวาน
                        </button>
                    </div>

                    <input 
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] px-3 py-1.5 rounded-lg text-xs outline-none text-[oklch(18%_0.012_28)] focus:border-[oklch(18%_0.012_28)]"
                    />

                    <button 
                        type="button"
                        onClick={fetchReportData} 
                        className="p-2 bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg text-[oklch(18%_0.012_28)] transition-colors cursor-pointer"
                        title="Reload"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-60 space-y-3 font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                     <Loader2 className="animate-spin w-8 h-8 text-[oklch(52%_0.16_28)]" />
                     <p>กำลังคำนวณและประมวลผลข้อมูลยอดขาย...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Metrics Summary Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
                        
                        {/* Net Revenue */}
                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-xl relative overflow-hidden shadow-2xs flex flex-col justify-between min-h-[105px]">
                            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-[oklch(52%_0.16_28)]"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-mono font-bold">
                                <TrendingUp size={11} className="text-[oklch(52%_0.16_28)]" /> NET REVENUE
                            </div>
                            <p className="text-xl font-mono font-bold text-[oklch(18%_0.012_28)] mt-1.5">฿{totalSales.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[oklch(55%_0.010_28)] uppercase">{completedBookings.length} BILLS COMPLETED</p>
                        </div>

                        {/* Cash Sales */}
                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-xl relative overflow-hidden shadow-2xs flex flex-col justify-between min-h-[105px]">
                            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-emerald-500"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-mono font-bold">
                                <Banknote size={11} className="text-emerald-600" /> CASH SALES
                            </div>
                            <p className="text-xl font-mono font-bold text-emerald-700 mt-1.5">฿{cashSales.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[oklch(55%_0.010_28)] uppercase">PHYSICAL DRAWER</p>
                        </div>

                        {/* QR Sales */}
                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-xl relative overflow-hidden shadow-2xs flex flex-col justify-between min-h-[105px]">
                            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-blue-500"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-mono font-bold">
                                <CreditCard size={11} className="text-blue-600" /> QR TRANSFER
                            </div>
                            <p className="text-xl font-mono font-bold text-blue-700 mt-1.5">฿{qrSales.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[oklch(55%_0.010_28)] uppercase">BANK DEPOSIT</p>
                        </div>

                        {/* Credit Sales */}
                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-xl relative overflow-hidden shadow-2xs flex flex-col justify-between min-h-[105px]">
                            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-amber-500"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-mono font-bold">
                                <CreditCard size={11} className="text-amber-600" /> CREDIT CARD
                            </div>
                            <p className="text-xl font-mono font-bold text-amber-700 mt-1.5">฿{creditSales.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[oklch(55%_0.010_28)] uppercase">CARD EDC</p>
                        </div>

                        {/* Discounts */}
                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-xl relative overflow-hidden shadow-2xs flex flex-col justify-between min-h-[105px]">
                            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-[oklch(45%_0.08_140)]"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-mono font-bold">
                                <Percent size={11} className="text-[oklch(45%_0.08_140)]" /> DISCOUNTS
                            </div>
                            <p className="text-xl font-mono font-bold text-[oklch(45%_0.08_140)] mt-1.5">฿{totalDiscounts.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[oklch(55%_0.010_28)] uppercase">PROMO / CRM</p>
                        </div>

                        {/* Active Unpaid / Tables */}
                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-xl relative overflow-hidden shadow-2xs flex flex-col justify-between min-h-[105px] col-span-2 md:col-span-1">
                            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-purple-500"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-mono font-bold">
                                <ShoppingBag size={11} className="text-purple-600" /> ACTIVE UNPAID
                            </div>
                            <p className="text-xl font-mono font-bold text-purple-700 mt-1.5">฿{activeUnpaid.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[oklch(55%_0.010_28)] uppercase">{activeBookings.length} TABLES PENDING</p>
                        </div>
                    </div>

                    {/* Active Shift Section */}
                    {activeShift && (
                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-5 shadow-2xs">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[oklch(85%_0.012_28)] pb-3 mb-4 select-none">
                                <div>
                                    <h4 className="font-mono font-bold text-xs text-[oklch(18%_0.012_28)] uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        ACTIVE SHIFT / รอบการขายปัจจุบัน - {activeShift.staffName}
                                    </h4>
                                    <p className="text-[9px] text-[oklch(55%_0.010_28)] font-mono uppercase tracking-tight mt-0.5">
                                        OPENED: {new Date(activeShift.openedAt).toLocaleString('th-TH')}
                                    </p>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border bg-emerald-50 text-emerald-800 border-emerald-200">
                                    [OPEN] กะกำลังทำงาน
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-5">
                                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-lg text-xs font-mono">
                                    <p className="text-[8px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-bold">OPENING FLOAT / เงินต้น</p>
                                    <p className="text-sm font-bold mt-1 text-[oklch(18%_0.012_28)]">฿{(activeShift.openingFloat || 0).toLocaleString()}</p>
                                </div>

                                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-lg text-xs font-mono">
                                    <p className="text-[8px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-bold text-emerald-700">CASH IN / เงินเข้า (+)</p>
                                    <p className="text-sm font-bold mt-1 text-emerald-700">
                                        +฿{(activeShiftSummary ? activeShiftSummary.totalIn : 0).toLocaleString()}
                                    </p>
                                </div>

                                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-lg text-xs font-mono">
                                    <p className="text-[8px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-bold text-red-600">CASH OUT / เงินออก (-)</p>
                                    <p className="text-sm font-bold mt-1 text-red-600">
                                        -฿{(activeShiftSummary ? activeShiftSummary.totalOut : 0).toLocaleString()}
                                    </p>
                                </div>

                                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-lg text-xs font-mono">
                                    <p className="text-[8px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-bold text-blue-700">CASH SALES / ขายเงินสด</p>
                                    <p className="text-sm font-bold mt-1 text-blue-700">
                                        ฿{(activeShiftSummary ? activeShiftSummary.cashSales : 0).toLocaleString()}
                                    </p>
                                </div>

                                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-lg text-xs font-mono col-span-2 md:col-span-1">
                                    <p className="text-[8px] text-[oklch(55%_0.010_28)] uppercase tracking-widest font-bold text-[oklch(52%_0.16_28)]">EXPECTED CASH / ในลิ้นชัก</p>
                                    <p className="text-sm font-bold mt-1 text-[oklch(52%_0.16_28)]">
                                        ฿{(activeShiftSummary ? activeShiftSummary.expectedCash : 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-5">
                                {/* Left Column: Cash Adjustments */}
                                <div className="flex flex-col gap-1.5">
                                    <div className="text-[9px] font-mono font-bold tracking-wider text-[oklch(55%_0.010_28)] uppercase select-none">
                                        รายการนำเงินเข้า-ออกในรอบนี้ (CASH ADJUSTMENTS)
                                    </div>
                                    <div className="border border-[oklch(85%_0.012_28)] rounded-lg overflow-hidden bg-white max-h-[200px] overflow-y-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] font-mono text-[8px] uppercase tracking-wider text-[oklch(55%_0.010_28)] select-none sticky top-0">
                                                    <th className="py-2 px-3 w-20">TIME</th>
                                                    <th className="py-2 px-3 w-28">TYPE</th>
                                                    <th className="py-2 px-3 text-right w-28">AMOUNT</th>
                                                    <th className="py-2 px-3">REASON / NOTE</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[oklch(94%_0.010_28)] font-sans text-[oklch(18%_0.012_28)]">
                                                {(activeShift.adjustments || []).map((adj, idx) => (
                                                    <tr key={adj.id || idx} className="hover:bg-[oklch(94%_0.010_28)]/50 transition-colors">
                                                        <td className="py-2 px-3 font-mono text-[9px] text-[oklch(55%_0.010_28)]">
                                                            {new Date(adj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            {adj.type === 'in' ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-emerald-50 text-emerald-800 border-emerald-200">
                                                                    DEPOSIT (เข้า)
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-red-50 text-red-800 border-red-200">
                                                                    PAYOUT (ออก)
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className={`py-2 px-3 text-right font-mono font-bold ${adj.type === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>
                                                            {adj.type === 'in' ? '+' : '-'}฿{adj.amount?.toLocaleString()}.-
                                                        </td>
                                                        <td className="py-2 px-3 text-[10px] truncate max-w-xs text-[oklch(55%_0.010_28)] font-medium">
                                                            {adj.note || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!activeShift.adjustments || activeShift.adjustments.length === 0) && (
                                                    <tr>
                                                        <td colSpan="4" className="py-6 text-center font-mono text-[9px] text-[oklch(55%_0.010_28)] uppercase italic">
                                                            ไม่มีรายการเบิกเงินสดในกะปัจจุบัน
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Right Column: Top 10 Best Sellers */}
                                <div className="flex flex-col gap-1.5">
                                    <div className="text-[9px] font-mono font-bold tracking-wider text-[oklch(55%_0.010_28)] uppercase select-none">
                                        TOP 10 BEST SELLERS IN ACTIVE SHIFT / เมนูขายดีรอบนี้
                                    </div>
                                    <div className="border border-[oklch(85%_0.012_28)] rounded-lg bg-white p-3 max-h-[200px] overflow-y-auto flex flex-col gap-1 shadow-2xs">
                                        {activeShiftTopSellers.length === 0 ? (
                                            <div className="text-center font-mono text-[9px] text-[oklch(55%_0.010_28)] py-10 uppercase italic">
                                                กำลังประมวลผลเมนูขายดี...
                                            </div>
                                        ) : (
                                            activeShiftTopSellers.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center py-1 border-b border-[oklch(94%_0.010_28)] last:border-b-0 text-xs">
                                                    <div className="flex items-center gap-2 select-none truncate pr-2">
                                                        <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] w-4 font-bold">{idx + 1}.</span>
                                                        <span className="font-medium text-[oklch(18%_0.012_28)] truncate">{item.name}</span>
                                                    </div>
                                                    <span className="font-mono font-bold text-emerald-700 shrink-0">{item.quantity.toLocaleString()} x</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filter & Search Bar for Completed Bills */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-3.5 shadow-2xs select-none">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-72">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)]" />
                                <input
                                    type="text"
                                    placeholder="ค้นหา Short ID (#A2EB), โต๊ะ, ชื่อ..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] focus:border-[oklch(18%_0.012_28)] pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono font-bold text-[oklch(18%_0.012_28)] outline-none placeholder:text-[oklch(55%_0.010_28)]"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] text-xs font-mono font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-0.5 rounded-lg w-full md:w-auto overflow-x-auto">
                            {[
                                { id: 'all', label: `ALL (${completedBookings.length})` },
                                { id: 'cash', label: 'CASH' },
                                { id: 'qr', label: 'QR TRANSFER' },
                                { id: 'credit', label: 'CREDIT' },
                                { id: 'merged', label: `MERGED (${mergedBookings.length})` },
                                { id: 'void', label: `VOIDED (${pureVoidedBookings.length})` }
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    type="button"
                                    onClick={() => setPayMethodFilter(btn.id)}
                                    className={`px-3 py-1.5 rounded-md font-mono text-[9px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                                        payMethodFilter === btn.id
                                            ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs border border-[oklch(85%_0.012_28)]'
                                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] border border-transparent'
                                    }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Split Layout: Categories & Log */}
                    <div className="grid md:grid-cols-3 gap-5">
                        
                        {/* Categories Sales Card */}
                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-5 flex flex-col shadow-2xs">
                            <h4 className="font-mono font-bold text-xs text-[oklch(18%_0.012_28)] uppercase tracking-wider mb-3 flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2 select-none">
                                <span>SALES BY CATEGORY / หมวดหมู่</span>
                                <span className="text-[10px] text-[oklch(55%_0.010_28)]">{categoryList.length} CATEGORIES</span>
                            </h4>

                            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[340px] pr-1">
                                {categoryList.map((c, i) => (
                                    <div key={i} className="bg-[oklch(94%_0.010_28)] p-2.5 rounded-lg border border-[oklch(85%_0.012_28)] text-xs flex flex-col gap-1">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="font-bold text-[oklch(18%_0.012_28)]">{c.name}</span>
                                                <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)] ml-2 uppercase">
                                                    ({c.quantity} items)
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-mono font-bold text-[oklch(18%_0.012_28)]">
                                                    ฿{c.amount.toLocaleString()}
                                                </span>
                                                <span className="text-[9px] font-mono font-bold text-[oklch(52%_0.16_28)] ml-1.5">
                                                    {c.pct}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full bg-[oklch(85%_0.012_28)]/50 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-[oklch(52%_0.16_28)] h-full rounded-full transition-all duration-300"
                                                style={{ width: `${Math.min(100, Math.max(2, c.pct))}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {categoryList.length === 0 && (
                                    <div className="text-center font-mono text-[9px] text-[oklch(55%_0.010_28)] py-12 uppercase italic">
                                        ไม่มีรายการขายในตัวกรองนี้
                                    </div>
                                )}
                            </div>
                            
                            <button 
                                type="button"
                                onClick={handlePrintShiftReport}
                                className="w-full mt-4 bg-[oklch(18%_0.012_28)] hover:opacity-90 text-[oklch(97%_0.008_28)] py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                            >
                                <PrinterIcon size={12} /> PRINT DAILY SUMMARY
                            </button>
                        </div>

                        {/* Completed / Voided Bills Table */}
                        <div className="md:col-span-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-5 flex flex-col shadow-2xs">
                            <h4 className="font-mono font-bold text-xs text-[oklch(18%_0.012_28)] uppercase tracking-wider mb-3 flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2 select-none">
                                <span>
                                    {payMethodFilter === 'void' 
                                        ? 'VOIDED BILLS AUDIT TRAIL / รายการบิลยกเลิก' 
                                        : payMethodFilter === 'merged'
                                            ? 'MERGED TABLE TRANSFERS / รายการโอนย้าย-รวมบิล'
                                            : "TODAY'S BILLS LOG / รายการบิล"}
                                </span>
                                <span className="text-[10px] text-[oklch(55%_0.010_28)]">{filteredForBreakdown.length} RECORDS</span>
                            </h4>

                            <div className="flex-1 overflow-x-auto max-h-[380px] scrollbar-none">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] font-mono font-bold text-[9px] uppercase tracking-wider select-none bg-[oklch(94%_0.010_28)]">
                                            <th className="py-2.5 px-3 w-16">BILL NO</th>
                                            <th className="py-2.5 px-3 w-16">TIME</th>
                                            <th className="py-2.5 px-3 w-28 text-center">TABLE</th>
                                            <th className="py-2.5 px-3">CUSTOMER / สมาชิก</th>
                                            <th className="py-2.5 px-3 w-32">PAY METHOD</th>
                                            <th className="py-2.5 px-3 text-right">AMOUNT</th>
                                            <th className="py-2.5 px-3 text-right w-24">ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[oklch(94%_0.010_28)]">
                                        {filteredForBreakdown.map((b) => {
                                            const timeStr = b.booking_time ? new Date(b.booking_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                                            const defaultWalkIns = ['walk-in guest', 'walk-in pick-up', 'walk-in customer', 'walk-in', 'walk-in customer (offline)', 'walk-in pick-up (offline)', 'anonymous user', 'walk-in-customer'];
                                            const profileObj = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
                                            const isMember = !!(profileObj || b.user_id);
                                            const memberName = profileObj?.display_name || profileObj?.nickname || (b.customer_name && !defaultWalkIns.includes(b.customer_name.toLowerCase().trim()) ? b.customer_name : null);
                                            const guestName = (b.pickup_contact_name && !defaultWalkIns.includes(b.pickup_contact_name.toLowerCase().trim())) ? b.pickup_contact_name : 'ลูกค้าทั่วไป';
                                            const transfer = parseTableTransferInfo(b, bookings);
                                            const isMerged = transfer.isMergedSource;
                                            const isVoid = (b.status === 'void' || b.status === 'cancelled') && !isMerged;
                                            const paymentBreakdown = getBookingPaymentBreakdown(b);

                                            return (
                                                <tr 
                                                    key={b.id} 
                                                    onClick={() => setActiveViewBooking(b)}
                                                    className={`hover:bg-[oklch(94%_0.010_28)]/50 transition-colors cursor-pointer ${
                                                        isMerged 
                                                            ? 'bg-[oklch(98%_0.008_28)]' 
                                                            : isVoid 
                                                                ? 'opacity-60 bg-red-50/20' 
                                                                : ''
                                                    }`}
                                                >
                                                    <td className="py-2.5 px-3 font-mono font-bold text-[oklch(18%_0.012_28)]">
                                                        #{getShortBookingId(b)}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-[oklch(55%_0.010_28)]">{timeStr}</td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-center text-[oklch(52%_0.16_28)]">
                                                        {isMerged ? (
                                                            <span className="text-[10px] text-[oklch(52%_0.16_28)] font-bold">
                                                                {b.tables_layout?.table_name || 'PICK'} ➔ {transfer.targetTableDisplay || transfer.mergedToTable}
                                                            </span>
                                                        ) : (
                                                            <span>
                                                                {b.tables_layout?.table_name || 'PICK'}
                                                                {transfer.isMergedTarget && (
                                                                    <span className="ml-1 text-[8px] text-[oklch(30%_0.08_140)] font-bold">
                                                                        (+{transfer.mergedFromTableDisplay || transfer.mergedFromTables.join(',')})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-sans">
                                                        {isMember ? (
                                                            <div className="flex flex-col gap-0.5 max-w-[150px]">
                                                                <div className="flex items-center gap-1.5 truncate">
                                                                    <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase bg-emerald-700 text-white shrink-0">
                                                                        MEMBER
                                                                    </span>
                                                                    <span className="font-bold text-[oklch(18%_0.012_28)] text-xs truncate">
                                                                        {memberName || 'สมาชิก'}
                                                                    </span>
                                                                </div>
                                                                {profileObj?.phone_number && (
                                                                    <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)] pl-0.5">
                                                                        {profileObj.phone_number}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 max-w-[150px]">
                                                                <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)] border border-[oklch(85%_0.012_28)] shrink-0">
                                                                    GUEST
                                                                </span>
                                                                <span className="text-[oklch(55%_0.010_28)] text-xs truncate font-medium">
                                                                    {guestName}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        {isMerged ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-black uppercase border bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.16_28)] border-[oklch(52%_0.16_28)] whitespace-nowrap">
                                                                MERGED ➔ {transfer.targetTableDisplay || transfer.mergedToTable}
                                                            </span>
                                                        ) : isVoid ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-red-100 text-red-900 border-red-300">
                                                                VOIDED
                                                            </span>
                                                        ) : paymentBreakdown.isSplit ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-purple-50 text-purple-800 border-purple-200">
                                                                SPLIT PAY
                                                            </span>
                                                        ) : paymentBreakdown.credit > 0 ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-amber-50 text-amber-800 border-amber-200">
                                                                CREDIT
                                                            </span>
                                                        ) : paymentBreakdown.qr > 0 ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-blue-50 text-blue-800 border-blue-200">
                                                                QR PAY
                                                            </span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-emerald-50 text-emerald-800 border-emerald-200">
                                                                CASH
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                                                        {isMerged ? (
                                                            <div className="text-right">
                                                                <span className="text-[11px] font-mono font-black text-[oklch(52%_0.16_28)] block">
                                                                    โอนไป {transfer.targetTableDisplay || transfer.mergedToTable}
                                                                </span>
                                                                <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)]">
                                                                    {transfer.originalTotal > 0 ? `(เดิม ฿${transfer.originalTotal.toLocaleString()})` : '฿0'}
                                                                </span>
                                                            </div>
                                                        ) : isVoid ? (
                                                            <span className="line-through text-red-500">฿{b.total_amount?.toLocaleString()}</span>
                                                        ) : (
                                                            <span>฿{b.total_amount?.toLocaleString()}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                        {b.payment_slip_url && (
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setViewSlipUrl(b.payment_slip_url); }}
                                                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-800 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                                                title="ดูสลิปโอนเงิน"
                                                            >
                                                                <ImageIcon size={10} />
                                                            </button>
                                                        )}
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setActiveViewBooking(b); }}
                                                            className="p-1.5 bg-white hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                                            title="ดูรายละเอียดบิล"
                                                        >
                                                            <FileText size={10} />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setActiveReprintBooking(b); }}
                                                            className="p-1.5 bg-white hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                                            title="พิมพ์สลิปซ้ำ"
                                                        >
                                                            <PrinterIcon size={10} />
                                                        </button>
                                                        {!isVoid && (
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); handleVoidBill(b.id, b.total_amount); }}
                                                                className="p-1.5 bg-white hover:bg-red-50 border border-[oklch(85%_0.012_28)] hover:border-red-300 rounded-lg text-red-600 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                                                title="ยกเลิกบิล (Void)"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredForBreakdown.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="py-12 text-center font-mono text-[9px] text-[oklch(55%_0.010_28)] uppercase italic">
                                                    ไม่มีรายการบิลในเงื่อนไขการค้นหานี้
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                    {/* Historical Shift Section */}
                    <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-5 flex flex-col shadow-2xs mt-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[oklch(85%_0.012_28)] pb-3 mb-4 select-none">
                            <h4 className="font-mono font-bold text-xs text-[oklch(18%_0.012_28)] uppercase tracking-wider flex items-center gap-2">
                                <Clock size={13} className="text-[oklch(52%_0.16_28)]" /> 
                                <span>SHIFT CLOSURE HISTORY / ประวัติการปิดรอบกะ</span>
                            </h4>

                            <div className="relative w-full sm:w-60">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)]" />
                                <input 
                                    type="text"
                                    placeholder="ค้นหาชื่อพนักงาน, วันที่..."
                                    value={shiftSearchQuery}
                                    onChange={(e) => setShiftSearchQuery(e.target.value)}
                                    className="w-full bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] focus:border-[oklch(18%_0.012_28)] pl-7 pr-3 py-1 rounded-lg text-xs font-mono text-[oklch(18%_0.012_28)] outline-none"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[300px]">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] font-mono font-bold text-[9px] uppercase tracking-wider select-none bg-[oklch(94%_0.010_28)]">
                                        <th className="py-2.5 px-3">STAFF / พนักงาน</th>
                                        <th className="py-2.5 px-3">OPENED</th>
                                        <th className="py-2.5 px-3">CLOSED</th>
                                        <th className="py-2.5 px-3 text-right">FLOAT</th>
                                        <th className="py-2.5 px-3 text-right">CASH SALES</th>
                                        <th className="py-2.5 px-3 text-right text-emerald-700">CASH IN (+)</th>
                                        <th className="py-2.5 px-3 text-right text-red-600">CASH OUT (-)</th>
                                        <th className="py-2.5 px-3 text-right">EXPECTED</th>
                                        <th className="py-2.5 px-3 text-right">ACTUAL</th>
                                        <th className="py-2.5 px-3 text-right">DIFF</th>
                                        <th className="py-2.5 px-3 text-center">ACTION</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(94%_0.010_28)]">
                                    {filteredShiftHistory.map((s, i) => {
                                        const openTime = new Date(s.openedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
                                        const isShiftOpen = s.status === 'open';
                                        
                                        const closeTime = isShiftOpen ? (
                                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                กำลังใช้งาน
                                            </span>
                                        ) : s.closedAt ? new Date(s.closedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';
                                        
                                        const txs = s.transactions || [];
                                        const adjs = s.adjustments || [];
                                        
                                        const totalIn = Math.round(s.totalIn !== undefined ? s.totalIn : adjs.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0));
                                        const totalOut = Math.round(s.totalOut !== undefined ? s.totalOut : adjs.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0));
                                        
                                        const shiftCashSales = Math.round(s.cashSales !== undefined ? s.cashSales : txs.filter(tx => tx.paymentMethod === 'cash').reduce((sum, tx) => sum + tx.amount, 0));
                                        
                                        const calculatedExpected = Math.round((s.openingFloat || 0) + shiftCashSales + totalIn - totalOut);
                                        const expectedCash = Math.round(s.expectedCash !== undefined ? s.expectedCash : calculatedExpected);
                                        const closedCash = Math.round(s.closedCash || 0);
                                        const difference = isShiftOpen ? 0 : Math.round(s.difference !== undefined && s.difference !== 0 ? s.difference : (closedCash - expectedCash));
                                        
                                        const isExpanded = expandedShiftId === s.id;

                                        return (
                                            <React.Fragment key={s.id || i}>
                                                <tr 
                                                    onClick={() => setExpandedShiftId(prev => prev === s.id ? null : s.id)}
                                                    className="hover:bg-[oklch(94%_0.010_28)]/50 cursor-pointer transition-colors font-mono text-[10px]"
                                                >
                                                    <td className="py-2.5 px-3 font-sans font-bold text-[oklch(18%_0.012_28)] uppercase flex items-center gap-1 select-none">
                                                        {isExpanded ? <ChevronUp size={10} className="text-[oklch(52%_0.16_28)]" /> : <ChevronDown size={10} className="text-[oklch(55%_0.010_28)]" />}
                                                        <span>{s.staffName}</span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-[oklch(55%_0.010_28)]">{openTime}</td>
                                                    <td className="py-2.5 px-3 text-[oklch(55%_0.010_28)]">{closeTime}</td>
                                                    <td className="py-2.5 px-3 text-right">฿{Math.round(s.openingFloat || 0).toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">฿{shiftCashSales.toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">+฿{totalIn.toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right text-red-600 font-bold">-฿{totalOut.toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold">฿{expectedCash.toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-[oklch(55%_0.010_28)]">
                                                        {isShiftOpen ? '-' : `฿${closedCash.toLocaleString()}`}
                                                    </td>
                                                    <td className={`py-2.5 px-3 text-right font-bold ${isShiftOpen ? 'text-[oklch(55%_0.010_28)]' : difference === 0 ? 'text-[oklch(55%_0.010_28)]' : difference > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                                        {isShiftOpen ? '-' : (difference > 0 ? '+' : '') + difference.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePrintHistoricalShiftReport(s);
                                                            }}
                                                            className="p-1.5 bg-white hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors cursor-pointer inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase"
                                                        >
                                                            <PrinterIcon size={10} /> REPRINT
                                                        </button>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-[oklch(94%_0.010_28)]/30">
                                                        <td colSpan="11" className="p-4 border-t border-b border-[oklch(85%_0.012_28)]">
                                                            <div className="grid md:grid-cols-2 gap-5">
                                                                
                                                                {/* Left Column: Cash Adjustments */}
                                                                <div className="flex flex-col gap-1.5">
                                                                    <div className="text-[9px] font-mono font-bold tracking-wider text-[oklch(55%_0.010_28)] uppercase mb-0.5 select-none">
                                                                        รายการนำเงินเข้า-ออกระหว่างรอบ (ADJUSTMENTS)
                                                                    </div>
                                                                    <div className="border border-[oklch(85%_0.012_28)] rounded-lg overflow-hidden bg-white shadow-2xs max-h-[200px] overflow-y-auto">
                                                                        <table className="w-full text-left text-xs border-collapse">
                                                                            <thead>
                                                                                <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] font-mono text-[8px] uppercase tracking-wider text-[oklch(55%_0.010_28)] select-none sticky top-0">
                                                                                    <th className="py-2 px-3 w-20">TIME</th>
                                                                                    <th className="py-2 px-3 w-28">TYPE</th>
                                                                                    <th className="py-2 px-3 text-right w-28">AMOUNT</th>
                                                                                    <th className="py-2 px-3">REASON / NOTE</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-[oklch(94%_0.010_28)] font-sans text-[oklch(18%_0.012_28)]">
                                                                                {adjs.map((adj, idx) => (
                                                                                    <tr key={adj.id || idx} className="hover:bg-[oklch(94%_0.010_28)]/50 transition-colors">
                                                                                        <td className="py-2 px-3 font-mono text-[9px] text-[oklch(55%_0.010_28)]">
                                                                                            {new Date(adj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                        </td>
                                                                                        <td className="py-2 px-3">
                                                                                            {adj.type === 'in' ? (
                                                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-emerald-50 text-emerald-800 border-emerald-200">
                                                                                                    DEPOSIT
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-red-50 text-red-800 border-red-200">
                                                                                                    PAYOUT
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className={`py-2 px-3 text-right font-mono font-bold ${adj.type === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>
                                                                                            {adj.type === 'in' ? '+' : '-'}฿{adj.amount?.toLocaleString()}.-
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-[10px] truncate max-w-xs text-[oklch(55%_0.010_28)]">
                                                                                            {adj.note || '-'}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                                {adjs.length === 0 && (
                                                                                    <tr>
                                                                                        <td colSpan="4" className="py-4 text-center font-mono text-[9px] text-[oklch(55%_0.010_28)] uppercase italic">
                                                                                            ไม่มีรายการเบิกจ่ายเงินสดระหว่างรอบ
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>

                                                                {/* Right Column: Top 10 Best Sellers */}
                                                                <div className="flex flex-col gap-1.5">
                                                                    <div className="text-[9px] font-mono font-bold tracking-wider text-[oklch(55%_0.010_28)] uppercase mb-0.5 select-none">
                                                                        TOP 10 BEST SELLERS / เมนูขายดีในกะนี้
                                                                    </div>
                                                                    <div className="border border-[oklch(85%_0.012_28)] rounded-lg bg-white p-3 shadow-2xs max-h-[200px] overflow-y-auto flex flex-col gap-1">
                                                                        {expandedShiftDetails[s.id]?.loading ? (
                                                                            <div className="text-center font-mono text-[9px] text-[oklch(55%_0.010_28)] py-10 uppercase italic animate-pulse">
                                                                                กำลังโหลดข้อมูลเมนูขายดี...
                                                                            </div>
                                                                        ) : !expandedShiftDetails[s.id]?.topSellers || expandedShiftDetails[s.id]?.topSellers.length === 0 ? (
                                                                            <div className="text-center font-mono text-[9px] text-[oklch(55%_0.010_28)] py-10 uppercase italic">
                                                                                ไม่มีข้อมูลรายการขายในกะนี้
                                                                            </div>
                                                                        ) : (
                                                                            expandedShiftDetails[s.id].topSellers.map((item, idx) => (
                                                                                <div key={idx} className="flex justify-between items-center py-1 border-b border-[oklch(94%_0.010_28)] last:border-b-0 text-xs">
                                                                                    <div className="flex items-center gap-2 select-none truncate pr-2">
                                                                                        <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] w-4 font-bold">{idx + 1}.</span>
                                                                                        <span className="font-medium text-[oklch(18%_0.012_28)] truncate">{item.name}</span>
                                                                                    </div>
                                                                                    <span className="font-mono font-bold text-emerald-700 shrink-0">{item.quantity.toLocaleString()} x</span>
                                                                                </div>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                </div>

                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                    {filteredShiftHistory.length === 0 && (
                                        <tr>
                                            <td colSpan="11" className="py-12 text-center font-mono text-[9px] text-[oklch(55%_0.010_28)] uppercase italic">
                                                ไม่พบประวัติการปิดรอบกะ
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Reprint Slip Modal */}
            {activeReprintBooking && (
                <SlipModal 
                    booking={activeReprintBooking}
                    type="customer"
                    onClose={() => setActiveReprintBooking(null)}
                />
            )}

            {/* View Bill Details Modal */}
            {activeViewBooking && (
                <POSBillDetailsModal 
                    booking={activeViewBooking} 
                    onClose={() => setActiveViewBooking(null)} 
                />
            )}

            {/* View Payment Slip Image Modal */}
            {viewSlipUrl && (
                <ViewSlipModal 
                    url={viewSlipUrl}
                    onClose={() => setViewSlipUrl(null)}
                />
            )}
        </div>
    );
}
