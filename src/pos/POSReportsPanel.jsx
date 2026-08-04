import React, { useState, useEffect } from 'react';
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
    Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';
import SlipModal from '../components/shared/SlipModal';
import ViewSlipModal from '../components/shared/ViewSlipModal';
import { printToBluetoothDirect, encodeShiftReportData, encodeShiftClosureReportData, printToRawBTWebSocket, printToSunmiBuiltIn, compileShiftReportData, getShortBookingId } from '../utils/printerHelper';
import { getCurrentShift, getShiftHistory, syncShiftHistoryFromCloud, voidShiftTransaction } from '../utils/shiftHelper';

export default function POSReportsPanel() {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeReprintBooking, setActiveReprintBooking] = useState(null);
    const [shiftHistory, setShiftHistory] = useState([]);
    const [activeShift, setActiveShift] = useState(null);
    const [activeShiftSummary, setActiveShiftSummary] = useState(null);
    const [activeShiftTopSellers, setActiveShiftTopSellers] = useState([]);
    const [expandedShiftId, setExpandedShiftId] = useState(null);
    const [expandedShiftDetails, setExpandedShiftDetails] = useState({});
    const [payMethodFilter, setPayMethodFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
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

    const loadShiftHistoryData = () => {
        const history = getShiftHistory();
        setShiftHistory(history);

        // Fetch latest from Supabase and sync in background
        syncShiftHistoryFromCloud().then(cloudHistory => {
            if (cloudHistory) {
                setShiftHistory(cloudHistory);
            }
        });
    };

    const loadActiveShift = async () => {
        const current = getCurrentShift();
        setActiveShift(current);
        if (!current) {
            setActiveShiftSummary(null);
            setActiveShiftTopSellers([]);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    id, 
                    status, 
                    total_amount, 
                    staff_remark, 
                    payment_slip_url,
                    order_items (
                        quantity,
                        menu_items (
                            name
                        )
                    )
                `)
                .eq('status', 'completed')
                .gte('booking_time', current.openedAt);

            if (error) throw error;

            let cashSales = 0;
            let qrSales = 0;
            let creditSales = 0;
            const itemCounts = {};

            (data || []).forEach(b => {
                const remark = (b.staff_remark || '').toLowerCase();
                const amt = parseFloat(b.total_amount) || 0;
                
                if (remark.includes('credit') || remark.includes('บัตรเครดิต')) {
                    creditSales += amt;
                } else if (b.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน')) {
                    qrSales += amt;
                } else {
                    cashSales += amt;
                }

                b.order_items?.forEach(item => {
                    if (!item.menu_items) return;
                    const name = item.menu_items.name;
                    const qty = item.quantity || 0;
                    itemCounts[name] = (itemCounts[name] || 0) + qty;
                });
            });

            const sortedSellers = Object.entries(itemCounts)
                .map(([name, qty]) => ({ name, quantity: qty }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 10);

            const adjustments = current.adjustments || [];
            const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
            const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);

            setActiveShiftSummary({
                cashSales,
                qrSales,
                creditSales,
                totalSales: cashSales + qrSales + creditSales,
                totalIn,
                totalOut,
                expectedCash: current.openingFloat + cashSales + totalIn - totalOut
            });
            setActiveShiftTopSellers(sortedSellers);
        } catch (err) {
            console.error("Failed to load active shift summary:", err);
            setActiveShiftSummary({
                cashSales: current.cashSales || 0,
                qrSales: current.qrSales || 0,
                creditSales: current.creditSales || 0,
                totalSales: current.totalSales || 0,
                totalIn: current.totalIn || 0,
                totalOut: current.totalOut || 0,
                expectedCash: current.expectedCash || (current.openingFloat + (current.cashSales || 0) + (current.totalIn || 0) - (current.totalOut || 0))
            });
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
                            menu_items (
                                name
                            )
                        )
                    `)
                    .eq('status', 'completed')
                    .gte('booking_time', openedAt)
                    .lte('booking_time', closedAt);

                if (error) throw error;

                const itemCounts = {};
                (data || []).forEach(b => {
                    b.order_items?.forEach(item => {
                        if (!item.menu_items) return;
                        const name = item.menu_items.name;
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

    useEffect(() => {
        fetchReportData();
        loadShiftHistoryData();
        loadActiveShift();

        const handleShiftChanged = () => {
            loadShiftHistoryData();
            loadActiveShift();
        };
        window.addEventListener('pos-shift-changed', handleShiftChanged);
        return () => {
            window.removeEventListener('pos-shift-changed', handleShiftChanged);
        };
    }, [filterDate]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const startOfDay = `${filterDate}T00:00:00`;
            const endOfDay = `${filterDate}T23:59:59`;

            // 1. Fetch Bookings for the day (completed, seated, confirmed)
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    *,
                    tables_layout (table_name),
                    order_items (
                        id,
                        quantity,
                        price_at_time,
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

            if (bookingsError) throw bookingsError;
            setBookings(bookingsData || []);

            // 2. Fetch Menu Categories for name mapping
            const { data: categoriesData } = await supabase
                .from('menu_categories')
                .select('id, name');
            setCategories(categoriesData || []);

        } catch (err) {
            console.error("Error fetching report data:", err);
        } finally {
            setLoading(false);
        }
    };

    // --- DERIVED METRICS ---
    const categoryMap = categories.reduce((acc, cat) => ({ ...acc, [cat.id]: cat.name }), {});

    const completedBookings = bookings.filter(b => b.status === 'completed');
    const activeBookings = bookings.filter(b => b.status === 'seated' || b.status === 'confirmed');

    // Completed Sales Total
    const totalSales = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const totalDiscounts = completedBookings.reduce((sum, b) => sum + (b.discount_amount || 0), 0);

    // Active Tables Total (Estimated Unpaid)
    const activeUnpaid = activeBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

    // Payment method breakdown helper
    const getBookingPaymentMethod = (b) => {
        const remark = (b.staff_remark || '').toLowerCase();
        if (remark.includes('credit') || remark.includes('บัตรเครดิต')) return 'credit';
        if (b.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน')) return 'qr';
        return 'cash';
    };

    const cashSales = completedBookings
        .filter(b => getBookingPaymentMethod(b) === 'cash')
        .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    const qrSales = completedBookings
        .filter(b => getBookingPaymentMethod(b) === 'qr')
        .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    const creditSales = completedBookings
        .filter(b => getBookingPaymentMethod(b) === 'credit')
        .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    // Filter bookings for breakdown calculations based on payment method & search query
    const filteredForBreakdown = completedBookings.filter(b => {
        if (payMethodFilter !== 'all' && getBookingPaymentMethod(b) !== payMethodFilter) return false;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const token = b.tracking_token ? b.tracking_token.toLowerCase() : '';
            const idStr = String(b.id).toLowerCase();
            const tableName = (b.tables_layout?.table_name || '').toLowerCase();
            const guestName = (b.profiles?.display_name || b.pickup_contact_name || b.customer_name || '').toLowerCase();
            const phone = (b.profiles?.phone_number || b.pickup_contact_phone || '').toLowerCase();
            const remark = (b.staff_remark || '').toLowerCase();

            return token.includes(q) || idStr.includes(q) || tableName.includes(q) || guestName.includes(q) || phone.includes(q) || remark.includes(q);
        }
        return true;
    });

    // Category sales compile
    const categorySales = {};
    filteredForBreakdown.forEach(b => {
        b.order_items?.forEach(item => {
            const catId = item.menu_items?.category_id || 'uncategorized';
            const catName = categoryMap[catId] || 'Uncategorized';
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

    const categoryList = Object.values(categorySales).sort((a, b) => b.amount - a.amount);

    // Print Shift Report HTML
    const handlePrintShiftReport = async () => {
        let paperSize = '58mm';
        let printerType = 'sunmi';
        let btDeviceName = '';
        
        try {
            const stored = localStorage.getItem('onhaus_printer_config');
            if (stored) {
                const config = JSON.parse(stored);
                // Shift summary report is printed by cashier printer
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
                return; // successfully printed directly, exit
            } catch (err) {
                console.error("SUNMI shift report print failed, falling back to standard dialog:", err);
                alert(`เกิดข้อผิดพลาดในการพิมพ์ผ่าน SUNMI: ${err.message || err}\nระบบจะสลับไปใช้หน้าต่างพิมพ์ของเครื่องแทน`);
            }
        } else if (printerType === 'rawbt') {
            try {
                const rawBytes = encodeShiftReportData(compiledReport, paperSize, 'rawbt');
                await printToRawBTWebSocket(rawBytes);
                return; // successfully printed directly, exit
            } catch (err) {
                console.error("RawBT shift report print failed, falling back to standard dialog:", err);
                alert(`เกิดข้อผิดพลาดในการพิมพ์ผ่าน RawBT: ${err.message || err}\nระบบจะสลับไปใช้หน้าต่างพิมพ์ของเครื่องแทน`);
            }
        } else if (printerType === 'bluetooth') {
            try {
                const rawBytes = encodeShiftReportData(compiledReport, paperSize, 'bluetooth');
                await printToBluetoothDirect(btDeviceName, rawBytes);
                return; // successfully printed directly, exit
            } catch (err) {
                console.error("Direct bluetooth shift report print failed, falling back to standard dialog:", err);
            }
        }

        const printDateStr = new Date().toLocaleString('th-TH');

        const catHtml = categoryList.map(c => `
            <div class="row">
                <span>${c.name} (x${c.quantity})</span>
                <span>${c.amount.toLocaleString()}.-</span>
            </div>
        `).join('') || '<div class="empty">No Category Sales</div>';

        const htmlContent = `
            <html>
                <head>
                    <title>Shift Report - ${filterDate}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                        body { 
                            font-family: 'Courier Prime', 'Courier New', monospace; 
                            background: white; 
                            color: black; 
                            font-size: 11px; 
                            padding: 20px 10px;
                            width: 280px;
                        }
                        .header { text-align: center; margin-bottom: 15px; }
                        .title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                        .date { font-size: 9px; color: #555; }
                        
                        .section { border-top: 2px dashed black; padding: 10px 0; margin-top: 10px; }
                        .section-title { font-[9px]; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
                        
                        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                        .total-row { font-size: 14px; font-weight: bold; border-top: 1px dashed black; padding-top: 5px; margin-top: 5px; }
                        
                        .signature { margin-top: 40px; text-align: center; font-size: 9px; }
                        .sig-line { border-bottom: 1px solid black; width: 150px; margin: 30px auto 5px auto; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">IN THE HAUS</div>
                        <div class="title" style="font-size:11px;">SHIFT CLOSURE REPORT</div>
                        <div class="date">Report Date: ${filterDate}</div>
                        <div class="date">Printed: ${printDateStr}</div>
                    </div>
 
                    <div class="section">
                        <div class="section-title">Sales Summary</div>
                        <div class="row"><span>Total Completed Bills</span> <span>${completedBookings.length}</span></div>
                        <div class="row"><span>Total Discounts</span> <span>-${totalDiscounts.toLocaleString()}.-</span></div>
                        <div class="row"><span>Cash Sales</span> <span>${cashSales.toLocaleString()}.-</span></div>
                        <div class="row"><span>QR Transfer Sales</span> <span>${qrSales.toLocaleString()}.-</span></div>
                        <div class="row"><span>Credit Card Sales</span> <span>${creditSales.toLocaleString()}.-</span></div>
                        <div class="row total-row"><span>NET REVENUE</span> <span>${totalSales.toLocaleString()}.-</span></div>
                    </div>

                    <div class="section">
                        <div class="section-title">Sales By Category</div>
                        ${catHtml}
                    </div>

                    <div class="section">
                        <div class="section-title">Active Registry</div>
                        <div class="row"><span>Active Tables (Unpaid)</span> <span>${activeBookings.length}</span></div>
                        <div class="row"><span>Pending Active Value</span> <span>${activeUnpaid.toLocaleString()}.-</span></div>
                    </div>

                    <div class="signature">
                        <div class="sig-line"></div>
                        <span>Cashier / Verifier Signature</span>
                    </div>

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `;

        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Printer')) {
            try {
                await Printer.printHtml({
                    name: `Shift-Report-${filterDate}`,
                    html: htmlContent
                });
            } catch (err) {
                console.error("Native print failed, falling back to browser print:", err);
                fallbackBrowserPrint(htmlContent);
            }
        } else {
            fallbackBrowserPrint(htmlContent);
        }
    };

    const handlePrintHistoricalShiftReport = async (shift) => {
        const toastId = toast.loading('กำลังโหลดข้อมูลและเตรียมพิมพ์รายงานประวัติ...');
        const adjs = shift.adjustments || [];
        const totalIn = shift.totalIn !== undefined ? shift.totalIn : adjs.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
        const totalOut = shift.totalOut !== undefined ? shift.totalOut : adjs.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);

        try {
            // 1. Fetch bookings in this historical shift
            const completedBookingIds = shift.transactions?.map(tx => tx.bookingId) || [];
            let bookingsData = [];
            
            let bookingsQuery = supabase
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
                `);

            if (completedBookingIds.length > 0) {
                const orFilter = `id.in.(${completedBookingIds.join(',')}),and(status.in.(void,cancelled),booking_time.gte.${shift.openedAt})`;
                const { data } = await bookingsQuery.or(orFilter);
                bookingsData = data || [];
            } else {
                const { data } = await bookingsQuery
                    .in('status', ['void', 'cancelled'])
                    .gte('booking_time', shift.openedAt)
                    .lte('booking_time', shift.closedAt || new Date().toISOString());
                bookingsData = data || [];
            }
            
            // 2. Fetch categories
            const { data: categoriesData } = await supabase
                .from('menu_categories')
                .select('id, name');
            
            // 3. Compile reportData
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
            
            // Build adjustments list for printing
            const adjsHtml = adjs.map(a => `
                <div class="row" style="padding-left: 10px; font-size: 9px; color: #333;">
                    <span>• [${a.type === 'in' ? 'เงินเข้า' : 'เงินออก'}] ${a.note || ''}</span>
                    <span>${a.type === 'in' ? '+' : '-'}฿${a.amount.toLocaleString()}.-</span>
                </div>
            `).join('') || '<div class="row" style="padding-left: 10px; font-size: 9px; color: #777;"><i>ไม่มีรายการเบิกจ่ายเงินสด</i></div>';

            // Fallback: generate HTML for system print dialog
            const htmlContent = `
                <html>
                    <head>
                        <title>Historical Shift Report - ${shift.staffName}</title>
                        <style>
                            body { font-family: monospace; padding: 20px; width: 280px; font-size: 11px; }
                            .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                            .divider { border-bottom: 1px dashed black; margin: 10px 0; }
                            .title { text-align: center; font-weight: bold; font-size: 14px; }
                        </style>
                    </head>
                    <body>
                        <div class="title">IN THE HAUS</div>
                        <div class="title" style="font-size:10px;">HISTORICAL SHIFT REPORT</div>
                        <div class="divider"></div>
                        <div class="row"><span>Staff:</span> <span>${shift.staffName}</span></div>
                        <div class="row"><span>Opened:</span> <span>${new Date(shift.openedAt).toLocaleString('th-TH')}</span></div>
                        <div class="row"><span>Closed:</span> <span>${shift.closedAt ? new Date(shift.closedAt).toLocaleString('th-TH') : 'กำลังใช้งาน (Active)'}</span></div>
                        <div class="divider"></div>
                        <div class="row"><span>Opening Float:</span> <span>฿${shift.openingFloat.toLocaleString()}.-</span></div>
                        <div class="row"><span>Cash Sales:</span> <span>฿${(shift.cashSales || 0).toLocaleString()}.-</span></div>
                        <div class="row"><span>QR Sales:</span> <span>฿${(shift.qrSales || 0).toLocaleString()}.-</span></div>
                        <div class="row"><span>Cash In (+):</span> <span>+฿${totalIn.toLocaleString()}.-</span></div>
                        <div class="row"><span>Cash Out (-):</span> <span>-฿${totalOut.toLocaleString()}.-</span></div>
                        <div class="divider"></div>
                        <div style="font-weight: bold; margin-bottom: 5px;">CASH ADJUSTMENTS / รายการเบิกจ่าย:</div>
                        ${adjsHtml}
                        <div class="divider"></div>
                        <div class="row"><span>Expected Cash:</span> <span>฿${shift.expectedCash?.toLocaleString()}.-</span></div>
                        <div class="row"><span>Actual Cash:</span> <span>${shift.status === 'open' ? '-' : `฿${shift.closedCash?.toLocaleString()}.-`}</span></div>
                        <div class="row"><span>Difference:</span> <span>${shift.status === 'open' ? '-' : (shift.difference >= 0 ? '+' : '') + '฿' + shift.difference?.toLocaleString() + '.-'}</span></div>
                        <div class="divider"></div>
                        <script>window.onload = function() { window.print(); }</script>
                    </body>
                </html>
            `;
            fallbackBrowserPrint(htmlContent);
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
        const isConfirmed = window.confirm(`คุณแน่ใจหรือไม่ที่จะทำการยกเลิก (Void) บิลยอด ฿${amount.toLocaleString()}.- ใช่หรือไม่?\nการดำเนินการนี้จะเปลี่ยนสถานะบิลเป็นโมฆะและคำนวณยอดขายใหม่ (บิลที่ถูก Void จะไม่แสดงในสถิติยอดขาย)`);
        if (!isConfirmed) return;

        try {
            // 1. Update status to 'void' in Supabase bookings table
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'void' })
                .eq('id', bookingId);

            if (error) throw error;

            // 2. Check if the booking exists in the active shift transactions and void it
            const currentShift = getCurrentShift();
            if (currentShift && currentShift.transactions?.some(tx => tx.bookingId === bookingId)) {
                voidShiftTransaction(bookingId);
                loadActiveShift();
            }

            toast.success("ยกเลิกบิล (Void) สำเร็จแล้ว");

            // 3. Reload report data to refresh lists & totals immediately
            fetchReportData();
        } catch (err) {
            console.error("Failed to void bill:", err);
            toast.error(`เกิดข้อผิดพลาดในการยกเลิกบิล: ${err.message || err}`);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 bg-[#ECECE9] overflow-y-auto text-[#1A1A1A] font-sans select-none">
            {/* Header controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-[#D1D1CD] shrink-0">
                <div>
                    <h3 className="font-mono font-bold text-sm tracking-wider uppercase">Daily Sales & Shift Report</h3>
                    <p className="text-[10px] text-[#767673] font-bold font-mono mt-0.5 uppercase tracking-tight">Verify collections, payments, and print shift reports</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto font-mono text-[10px] flex-wrap">
                    <div className="flex items-center bg-white border border-[#D1D1CD] rounded-lg p-0.5 shadow-xs">
                        <button
                            onClick={() => setFilterDate(getBangkokDate())}
                            className={`px-2.5 py-1.5 rounded-md font-bold transition-all cursor-pointer ${filterDate === getBangkokDate() ? 'bg-[#1A1A1A] text-white' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                        >
                            วันนี้
                        </button>
                        <button
                            onClick={() => setFilterDate(getYesterdayBangkokDate())}
                            className={`px-2.5 py-1.5 rounded-md font-bold transition-all cursor-pointer ${filterDate === getYesterdayBangkokDate() ? 'bg-[#1A1A1A] text-white' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                        >
                            เมื่อวาน
                        </button>
                    </div>
                    <input 
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="bg-white border border-[#D1D1CD] px-3 py-2 rounded-lg text-xs outline-none text-[#1A1A1A] focus:border-[#ff0000]"
                    />
                    <button 
                        onClick={fetchReportData} 
                        className="p-2 bg-white hover:bg-[#E0E0DC] border border-[#D1D1CD] rounded-lg text-[#1A1A1A] transition-colors cursor-pointer"
                        title="Reload"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-50 space-y-3 font-mono text-[10px] font-bold text-[#767673] uppercase tracking-wider">
                     <Loader2 className="animate-spin w-8 h-8 text-[#ff0000]" />
                     <p>Generating registry data...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        
                        {/* Net Revenue */}
                        <div className="bg-white border border-[#D1D1CD] p-5 rounded-xl relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[110px]">
                            <div className="absolute top-0 left-0 w-full h-[3px] bg-[#ff0000]"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[#767673] uppercase tracking-widest font-mono font-bold">
                                <TrendingUp size={12} className="text-[#ff0000]" /> NET SALES
                            </div>
                            <p className="text-xl font-black font-mono text-[#1A1A1A] mt-2">฿{totalSales.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[#767673] mt-1 uppercase">{completedBookings.length} COMPLETED BILLS</p>
                        </div>

                        {/* Cash Sales */}
                        <div className="bg-white border border-[#D1D1CD] p-5 rounded-xl relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[110px]">
                            <div className="absolute top-0 left-0 w-full h-[3px] bg-[#00CC44]"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[#767673] uppercase tracking-widest font-mono font-bold">
                                <Banknote size={12} className="text-[#00CC44]" /> CASH
                            </div>
                            <p className="text-xl font-black font-mono text-emerald-600 mt-2">฿{cashSales.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[#767673] mt-1 uppercase">PHYSICAL DRAWER</p>
                        </div>

                        {/* QR Sales */}
                        <div className="bg-white border border-[#D1D1CD] p-5 rounded-xl relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[110px]">
                            <div className="absolute top-0 left-0 w-full h-[3px] bg-blue-500"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[#767673] uppercase tracking-widest font-mono font-bold">
                                <CreditCard size={12} className="text-blue-500" /> QR TRANSFER
                            </div>
                            <p className="text-xl font-black font-mono text-blue-600 mt-2">฿{qrSales.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[#767673] mt-1 uppercase">BANK DEPOSIT</p>
                        </div>

                        {/* Credit Sales */}
                        <div className="bg-white border border-[#D1D1CD] p-5 rounded-xl relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[110px]">
                            <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[#767673] uppercase tracking-widest font-mono font-bold">
                                <CreditCard size={12} className="text-amber-500" /> CREDIT CARD
                            </div>
                            <p className="text-xl font-black font-mono text-amber-600 mt-2">฿{creditSales.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[#767673] mt-1 uppercase">CARD TERMINAL</p>
                        </div>

                        {/* Discounts */}
                        <div className="bg-white border border-[#D1D1CD] p-5 rounded-xl relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[110px]">
                            <div className="absolute top-0 left-0 w-full h-[3px] bg-[#FFAA00]"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[#767673] uppercase tracking-widest font-mono font-bold">
                                <Percent size={12} className="text-[#FFAA00]" /> DISCOUNTS
                            </div>
                            <p className="text-xl font-black font-mono text-amber-600 mt-2">฿{totalDiscounts.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[#767673] mt-1 uppercase">PROMO APPLIED</p>
                        </div>

                        {/* Active Tables value */}
                        <div className="bg-white border border-[#D1D1CD] p-5 rounded-xl relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[110px] col-span-2 md:col-span-1">
                            <div className="absolute top-0 left-0 w-full h-[3px] bg-purple-500"></div>
                            <div className="flex items-center gap-1.5 text-[9px] text-[#767673] uppercase tracking-widest font-mono font-bold">
                                <ShoppingBag size={12} className="text-purple-500" /> ACTIVE REGISTRY
                            </div>
                            <p className="text-xl font-black font-mono text-purple-600 mt-2">฿{activeUnpaid.toLocaleString()}</p>
                            <p className="text-[9px] font-mono text-[#767673] mt-1 uppercase">{activeBookings.length} TABLES UNPAID</p>
                        </div>
                    </div>

                    {/* Active Shift / รอบการขายปัจจุบัน */}
                    {activeShift && (
                        <div className="bg-white border border-[#D1D1CD] rounded-xl p-5 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#D1D1CD] pb-3 mb-4 select-none">
                                <div>
                                    <h4 className="font-mono font-bold text-xs text-[#1A1A1A] uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        รอบการขายปัจจุบัน (Active Shift) - {activeShift.staffName}
                                    </h4>
                                    <p className="text-[9px] text-[#767673] font-mono uppercase tracking-tight mt-0.5">
                                        เปิดกะเมื่อ: {new Date(activeShift.openedAt).toLocaleString('th-TH')}
                                    </p>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">
                                    กะกำลังใช้งาน (Open)
                                </span>
                            </div>
 
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                                <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-3 rounded-lg text-xs font-mono">
                                    <p className="text-[8px] text-[#767673] uppercase tracking-widest font-bold">Opening Float / เงินต้นกะ</p>
                                    <p className="text-sm font-black mt-1 text-[#1A1A1A]">฿{activeShift.openingFloat?.toLocaleString()}</p>
                                </div>
                                <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-3 rounded-lg text-xs font-mono">
                                    <p className="text-[8px] text-[#767673] uppercase tracking-widest font-bold text-emerald-600">Cash In / เงินเข้า (+)</p>
                                    <p className="text-sm font-black mt-1 text-emerald-600">+฿{(activeShiftSummary ? activeShiftSummary.totalIn : (activeShift.totalIn || activeShift.adjustments?.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0) || 0)).toLocaleString()}</p>
                                </div>
                                <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-3 rounded-lg text-xs font-mono">
                                    <p className="text-[8px] text-[#767673] uppercase tracking-widest font-bold text-red-500">Cash Out / เงินออก (-)</p>
                                    <p className="text-sm font-black mt-1 text-red-500">-฿{(activeShiftSummary ? activeShiftSummary.totalOut : (activeShift.totalOut || activeShift.adjustments?.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0) || 0)).toLocaleString()}</p>
                                </div>
                                <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-3 rounded-lg text-xs font-mono">
                                    <p className="text-[8px] text-[#767673] uppercase tracking-widest font-bold text-blue-600">Cash Sales / ขายเงินสด</p>
                                    <p className="text-sm font-black mt-1 text-blue-600">฿{(activeShiftSummary ? activeShiftSummary.cashSales : (activeShift.cashSales || 0)).toLocaleString()}</p>
                                </div>
                                <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-3 rounded-lg text-xs font-mono col-span-2 md:col-span-1">
                                    <p className="text-[8px] text-[#767673] uppercase tracking-widest font-bold text-[#ff0000]">Expected Cash / ควรมีในลิ้นชัก</p>
                                    <p className="text-sm font-black mt-1 text-[#ff0000]">฿{(activeShiftSummary ? activeShiftSummary.expectedCash : (activeShift.expectedCash || (activeShift.openingFloat + (activeShift.cashSales || 0) + (activeShift.totalIn || 0) - (activeShift.totalOut || 0)))).toLocaleString()}</p>
                                </div>
                            </div>
 
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Left Column: Cash Adjustments */}
                                <div className="flex flex-col gap-2">
                                    <div className="text-[9px] font-mono font-bold tracking-wider text-[#767673] uppercase select-none">
                                        รายการนำเงินเข้า-ออกในรอบนี้ (Current Shift Cash Adjustments)
                                    </div>
                                    <div className="border border-[#D1D1CD] rounded-lg overflow-hidden bg-white max-h-[220px] overflow-y-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-[#F5F5F2] border-b border-[#D1D1CD] font-mono text-[8px] uppercase tracking-wider text-[#767673] select-none sticky top-0">
                                                    <th className="py-2 px-3 w-24">เวลา (Time)</th>
                                                    <th className="py-2 px-3 w-32">ประเภท (Type)</th>
                                                    <th className="py-2 px-3 text-right w-36">จำนวน (Amount)</th>
                                                    <th className="py-2 px-3">เหตุผล / รายละเอียด (Reason)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#ECECE9] font-sans font-bold text-[#1A1A1A]">
                                                {(activeShift.adjustments || []).map((adj, idx) => (
                                                    <tr key={adj.id || idx} className="hover:bg-[#F5F5F2] transition-colors">
                                                        <td className="py-2 px-3 font-mono text-[9px] text-[#767673]">
                                                            {new Date(adj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            {adj.type === 'in' ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                    เงินเข้า (Deposit)
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-red-50 text-red-700 border-red-200">
                                                                    เงินออก (Payout)
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className={`py-2 px-3 text-right font-mono font-black ${adj.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                            {adj.type === 'in' ? '+' : '-'}฿{adj.amount?.toLocaleString()}.-
                                                        </td>
                                                        <td className="py-2 px-3 text-[10px] uppercase truncate max-w-xs">
                                                            {adj.note || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!activeShift.adjustments || activeShift.adjustments.length === 0) && (
                                                    <tr>
                                                        <td colSpan="4" className="py-4 text-center font-mono text-[9px] text-[#767673] uppercase italic">
                                                            ไม่มีรายการเบิกเงินสดในกะปัจจุบัน (No cash adjustments recorded in active shift)
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
 
                                {/* Right Column: Top 10 Best Sellers */}
                                <div className="flex flex-col gap-2">
                                    <div className="text-[9px] font-mono font-bold tracking-wider text-[#767673] uppercase select-none">
                                        เมนูขายดีในกะนี้ 10 อันดับ (Top 10 Best Sellers)
                                    </div>
                                    <div className="border border-[#D1D1CD] rounded-lg bg-white p-3 max-h-[220px] overflow-y-auto flex flex-col gap-1.5 shadow-sm">
                                        {activeShiftTopSellers.length === 0 ? (
                                            <div className="text-center font-mono text-[9px] text-[#767673] py-12 uppercase italic animate-pulse">
                                                กำลังคำนวณข้อมูลเมนูขายดี...
                                            </div>
                                        ) : (
                                            activeShiftTopSellers.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center py-1.5 border-b border-[#ECECE9] last:border-b-0 text-xs">
                                                    <div className="flex items-center gap-2 select-none">
                                                        <span className="font-mono text-[10px] text-[#767673] w-4 font-bold">{idx + 1}.</span>
                                                        <span className="font-bold text-[#1A1A1A] uppercase">{item.name}</span>
                                                    </div>
                                                    <span className="font-mono font-black text-emerald-600 select-all">{item.quantity.toLocaleString()} x</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filter & Search Bar for Completed Bills */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6 bg-white border border-[#D1D1CD] rounded-xl p-4 shadow-sm select-none">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-72">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#767673]" />
                                <input
                                    type="text"
                                    placeholder="ค้นหาเลขบิล / โต๊ะ / ชื่อลูกค้า / หมายเหตุ..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[#F5F5F2] border border-[#D1D1CD] focus:border-[#ff0000] pl-9 pr-3 py-1.5 rounded-lg text-xs font-sans font-bold text-[#1A1A1A] outline-none placeholder:text-[#767673]"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#767673] hover:text-[#1A1A1A] text-xs font-mono font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 bg-[#F5F5F2] border border-[#D1D1CD] p-1 rounded-lg w-full md:w-auto overflow-x-auto">
                            {[
                                { id: 'all', label: 'ทั้งหมด (All)' },
                                { id: 'cash', label: 'เงินสด (Cash)' },
                                { id: 'qr', label: 'โอน/QR (QR)' },
                                { id: 'credit', label: 'บัตรเครดิต (Credit)' }
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setPayMethodFilter(btn.id)}
                                    className={`px-3 py-1.5 rounded-md font-mono text-[9px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                                        payMethodFilter === btn.id
                                            ? 'bg-white text-[#1A1A1A] shadow-sm border border-[#D1D1CD]'
                                            : 'text-[#767673] hover:text-[#1A1A1A] border border-transparent'
                                    }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Split Layout: Categories & Log */}
                    <div className="grid md:grid-cols-3 gap-6">
                        
                        {/* Categories Sales Card */}
                        <div className="bg-white border border-[#D1D1CD] rounded-xl p-5 flex flex-col shadow-sm">
                            <h4 className="font-mono font-bold text-xs text-[#1A1A1A] uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-[#D1D1CD] pb-2 select-none">
                                <CheckCircle2 size={14} className="text-[#ff0000]" /> Sales By Category
                            </h4>
                            <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] pr-1">
                                {categoryList.map((c, i) => (
                                    <div key={i} className="flex justify-between items-center bg-[#F5F5F2] p-2.5 rounded-lg border border-[#D1D1CD] text-xs">
                                        <div>
                                            <p className="font-bold text-[#1A1A1A]">{c.name}</p>
                                            <p className="text-[9px] font-mono text-[#767673] mt-0.5 uppercase">{c.quantity} ITEMS SOLD</p>
                                        </div>
                                        <p className="font-mono font-bold">฿{c.amount.toLocaleString()}</p>
                                    </div>
                                ))}
                                {categoryList.length === 0 && (
                                    <div className="text-center font-mono text-[9px] text-[#767673] py-12 uppercase italic">
                                        No sales logged for this payment method
                                    </div>
                                )}
                            </div>
                            
                            <button 
                                onClick={handlePrintShiftReport}
                                className="w-full mt-4 bg-[#ff0000] hover:bg-[#d00000] border border-[#c00000] text-white py-2.5 rounded-lg font-mono font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                            >
                                <PrinterIcon size={12} /> PRINT SHIFT SUMMARY
                            </button>
                        </div>

                        {/* Completed Bills Log */}
                        <div className="md:col-span-2 bg-white border border-[#D1D1CD] rounded-xl p-5 flex flex-col shadow-sm">
                            <h4 className="font-mono font-bold text-xs text-[#1A1A1A] uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-[#D1D1CD] pb-2 select-none">
                                <FileText size={14} className="text-[#ff0000]" /> Today's Completed Bills
                            </h4>
                            <div className="flex-1 overflow-x-auto max-h-[360px] scrollbar-none">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-[#D1D1CD] text-[#767673] font-mono font-bold text-[9px] uppercase tracking-wider select-none bg-[#F5F5F2]">
                                            <th className="py-2.5 px-3 w-16">Bill No</th>
                                            <th className="py-2.5 px-3 w-20">Time</th>
                                            <th className="py-2.5 px-3 w-16 text-center">Table</th>
                                            <th className="py-2.5 px-3">Guest</th>
                                            <th className="py-2.5 px-3 w-24">Pay Method</th>
                                            <th className="py-2.5 px-3 text-right">Amount</th>
                                            <th className="py-2.5 px-3 text-right w-24">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#ECECE9]">
                                        {filteredForBreakdown.map((b) => {
                                            const timeStr = new Date(b.booking_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            const guestName = b.profiles?.display_name || b.pickup_contact_name || 'Walk-in';

                                            return (
                                                <tr key={b.id} className="hover:bg-[#F5F5F2] transition-colors">
                                                    <td className="py-2.5 px-3 font-mono font-bold text-[#767673]">
                                                        #{getShortBookingId(b)}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-[#767673]">{timeStr}</td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-center text-[#ff0000]">
                                                        {b.tables_layout?.table_name || 'PICK'}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-bold truncate max-w-[120px] uppercase text-[#1A1A1A]">{guestName}</td>
                                                    <td className="py-2.5 px-3">
                                                        {(() => {
                                                            const pm = getBookingPaymentMethod(b);
                                                            if (pm === 'cash') return (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                    Cash
                                                                </span>
                                                            );
                                                            if (pm === 'credit') return (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-amber-50 text-amber-700 border-amber-200">
                                                                    Credit
                                                                </span>
                                                            );
                                                            return (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-blue-50 text-blue-700 border-blue-200">
                                                                    QR Pay
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                                                        ฿{b.total_amount?.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right flex justify-end gap-1">
                                                        {b.payment_slip_url && (
                                                            <button 
                                                                onClick={() => setViewSlipUrl(b.payment_slip_url)}
                                                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                                                title="ดูรูปสลิปหลักฐานโอนเงิน"
                                                            >
                                                                <ImageIcon size={10} />
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => setActiveReprintBooking(b)}
                                                            className="p-1.5 bg-white hover:bg-[#E0E0DC] border border-[#D1D1CD] rounded-lg text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                                            title="Reprint Bill / Receipt"
                                                        >
                                                            <PrinterIcon size={10} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleVoidBill(b.id, b.total_amount)}
                                                            className="p-1.5 bg-white hover:bg-[#ff0000]/10 border border-[#D1D1CD] hover:border-[#ff0000]/20 rounded-lg text-red-500 hover:text-[#ff0000] transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                                            title="Void Bill / ยกเลิกบิล"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredForBreakdown.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="py-10 text-center font-mono text-[9px] text-[#767673] uppercase italic">
                                                    No completed bills logged for this payment method
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                    {/* Shift History Section */}
                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-5 flex flex-col shadow-sm mt-6">
                        <h4 className="font-mono font-bold text-xs text-[#1A1A1A] uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-[#D1D1CD] pb-2 select-none">
                            <Clock size={14} className="text-[#ff0000]" /> Shift Closure History / ประวัติรอบการทำงาน
                        </h4>
                        <div className="overflow-x-auto max-h-[300px]">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-[#D1D1CD] text-[#767673] font-mono font-bold text-[9px] uppercase tracking-wider select-none bg-[#F5F5F2]">
                                        <th className="py-2.5 px-3">Staff / พนักงาน</th>
                                        <th className="py-2.5 px-3">Opened / เปิดรอบ</th>
                                        <th className="py-2.5 px-3">Closed / ปิดรอบ</th>
                                        <th className="py-2.5 px-3 text-right">Float / เงินต้น</th>
                                        <th className="py-2.5 px-3 text-right">Cash / ยอดสด</th>
                                        <th className="py-2.5 px-3 text-right text-emerald-600">Cash In (+เงินเข้า)</th>
                                        <th className="py-2.5 px-3 text-right text-red-500">Cash Out (-เงินออก)</th>
                                        <th className="py-2.5 px-3 text-right">Expected / คาดการณ์</th>
                                        <th className="py-2.5 px-3 text-right">Actual / นับจริง</th>
                                        <th className="py-2.5 px-3 text-right">Diff / ส่วนต่าง</th>
                                        <th className="py-2.5 px-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ECECE9]">
                                    {shiftHistory.map((s, i) => {
                                        const openTime = new Date(s.openedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
                                        const isShiftOpen = s.status === 'open';
                                        
                                        const closeTime = isShiftOpen ? (
                                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                กำลังใช้งาน
                                            </span>
                                        ) : s.closedAt ? new Date(s.closedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';
                                        
                                        const adjs = s.adjustments || [];
                                        const totalIn = s.totalIn !== undefined ? s.totalIn : adjs.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
                                        const totalOut = s.totalOut !== undefined ? s.totalOut : adjs.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);
                                        const isExpanded = expandedShiftId === s.id;

                                        return (
                                            <React.Fragment key={s.id || i}>
                                                <tr 
                                                    onClick={() => setExpandedShiftId(prev => prev === s.id ? null : s.id)}
                                                    className="hover:bg-[#F5F5F2] cursor-pointer transition-colors font-mono text-[10px]"
                                                >
                                                    <td className="py-2.5 px-3 font-sans font-bold text-[#1A1A1A] uppercase flex items-center gap-1 select-none">
                                                        {isExpanded ? <ChevronUp size={10} className="text-[#ff0000]" /> : <ChevronDown size={10} className="text-[#767673]" />}
                                                        <span>{s.staffName}</span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-[#767673]">{openTime}</td>
                                                    <td className="py-2.5 px-3 text-[#767673]">{closeTime}</td>
                                                    <td className="py-2.5 px-3 text-right">฿{s.openingFloat?.toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right">฿{s.cashSales?.toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">+฿{totalIn.toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right text-red-500 font-bold">-฿{totalOut.toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold">฿{s.expectedCash?.toLocaleString()}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-[#767673]">
                                                        {isShiftOpen ? '-' : `฿${s.closedCash?.toLocaleString()}`}
                                                    </td>
                                                    <td className={`py-2.5 px-3 text-right font-black ${isShiftOpen ? 'text-[#767673]' : s.difference === 0 ? 'text-[#767673]' : s.difference > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {isShiftOpen ? '-' : (s.difference > 0 ? '+' : '') + s.difference?.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePrintHistoricalShiftReport(s);
                                                            }}
                                                            className="p-1.5 bg-white hover:bg-[#E0E0DC] border border-[#D1D1CD] rounded-lg text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer inline-flex items-center gap-1 font-sans text-[9px] font-bold uppercase tracking-wider"
                                                        >
                                                            <PrinterIcon size={10} /> Reprint
                                                        </button>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-[#F9F9F7]">
                                                        <td colSpan="11" className="p-4 border-t border-b border-[#D1D1CD]">
                                                            <div className="grid md:grid-cols-2 gap-6">
                                                                
                                                                {/* Left Column: Cash Adjustments */}
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="text-[9px] font-mono font-bold tracking-wider text-[#767673] uppercase mb-1 select-none">
                                                                        รายการนำเงินเข้า-ออกระหว่างรอบ (Cash Adjustments Details)
                                                                    </div>
                                                                    <div className="border border-[#D1D1CD] rounded-lg overflow-hidden bg-white shadow-sm max-h-[220px] overflow-y-auto">
                                                                        <table className="w-full text-left text-xs border-collapse">
                                                                            <thead>
                                                                                <tr className="bg-[#F2F2EF] border-b border-[#D1D1CD] font-mono text-[8px] uppercase tracking-wider text-[#767673] select-none sticky top-0">
                                                                                    <th className="py-2 px-3 w-24">เวลา (Time)</th>
                                                                                    <th className="py-2 px-3 w-32">ประเภท (Type)</th>
                                                                                    <th className="py-2 px-3 text-right w-36">จำนวน (Amount)</th>
                                                                                    <th className="py-2 px-3">เหตุผล / รายละเอียด (Reason)</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-[#ECECE9] font-sans font-bold text-[#1A1A1A]">
                                                                                {adjs.map((adj, idx) => (
                                                                                    <tr key={adj.id || idx} className="hover:bg-[#F5F5F2] transition-colors">
                                                                                        <td className="py-2 px-3 font-mono text-[9px] text-[#767673]">
                                                                                            {new Date(adj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                        </td>
                                                                                        <td className="py-2 px-3">
                                                                                            {adj.type === 'in' ? (
                                                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                                                    เงินเข้า (Deposit)
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border bg-red-50 text-red-700 border-red-200">
                                                                                                    เงินออก (Payout)
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className={`py-2 px-3 text-right font-mono font-black ${adj.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                                            {adj.type === 'in' ? '+' : '-'}฿{adj.amount?.toLocaleString()}.-
                                                                                        </td>
                                                                                        <td className="py-2 px-3 text-[10px] uppercase truncate max-w-xs">
                                                                                            {adj.note || '-'}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                                {adjs.length === 0 && (
                                                                                    <tr>
                                                                                        <td colSpan="4" className="py-4 text-center font-mono text-[9px] text-[#767673] uppercase italic">
                                                                                            ไม่มีรายการเบิกจ่ายเงินสดระหว่างรอบ
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>

                                                                {/* Right Column: Top 10 Best Sellers */}
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="text-[9px] font-mono font-bold tracking-wider text-[#767673] uppercase mb-1 select-none">
                                                                        เมนูขายดีในกะนี้ 10 อันดับ (Top 10 Best Sellers)
                                                                    </div>
                                                                    <div className="border border-[#D1D1CD] rounded-lg bg-white p-3 shadow-sm max-h-[220px] overflow-y-auto flex flex-col gap-1.5">
                                                                        {expandedShiftDetails[s.id]?.loading ? (
                                                                            <div className="text-center font-mono text-[9px] text-[#767673] py-12 uppercase italic animate-pulse">
                                                                                กำลังโหลดข้อมูลเมนูขายดี...
                                                                            </div>
                                                                        ) : !expandedShiftDetails[s.id]?.topSellers || expandedShiftDetails[s.id]?.topSellers.length === 0 ? (
                                                                            <div className="text-center font-mono text-[9px] text-[#767673] py-12 uppercase italic">
                                                                                ไม่มีข้อมูลการขายในกะนี้ (No sales logged in this shift)
                                                                            </div>
                                                                        ) : (
                                                                            expandedShiftDetails[s.id].topSellers.map((item, idx) => (
                                                                                <div key={idx} className="flex justify-between items-center py-1.5 border-b border-[#ECECE9] last:border-b-0 text-xs">
                                                                                    <div className="flex items-center gap-2 select-none">
                                                                                        <span className="font-mono text-[10px] text-[#767673] w-4 font-bold">{idx + 1}.</span>
                                                                                        <span className="font-bold text-[#1A1A1A] uppercase">{item.name}</span>
                                                                                    </div>
                                                                                    <span className="font-mono font-black text-emerald-600 select-all">{item.quantity.toLocaleString()} x</span>
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
                                    {shiftHistory.length === 0 && (
                                        <tr>
                                            <td colSpan="11" className="py-10 text-center font-mono text-[9px] text-[#767673] uppercase italic">
                                                No completed shift logs found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Reprint Slip Modal integration */}
            {activeReprintBooking && (
                <SlipModal 
                    booking={activeReprintBooking}
                    type="customer"
                    onClose={() => setActiveReprintBooking(null)}
                />
            )}

            {/* View Payment Slip Image Modal */}
            <ViewSlipModal 
                url={viewSlipUrl}
                onClose={() => setViewSlipUrl(null)}
            />
        </div>
    );
}
