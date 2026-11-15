/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react';
import { 
    FileSpreadsheet, 
    Download, 
    Printer, 
    Search, 
    TrendingUp, 
    ShieldAlert, 
    CheckCircle2, 
    Calendar,
    Filter,
    ArrowUpRight,
    Info,
    Receipt,
    FileText,
    Layers,
    CreditCard,
    Coins,
    QrCode,
    Loader2,
    Clock,
    Sparkles,
    UtensilsCrossed,
    ShoppingBag,
    Eye,
    Plus,
    Trash2,
    AlertTriangle,
    ExternalLink
} from 'lucide-react';
import { 
    formatTaxId, 
    formatBranch, 
    exportUnifiedSalesLedgerCsv, 
    downloadCsvFile,
    thaiBahtText,
    toBangkokDateKey,
    isTaxableSale,
    bookingSaleAmount,
    buildStableBillNumbers
} from '../../../utils/thaiTaxHelper';
import { supabase } from '../../../lib/supabaseClient';
import SalesTaxLedgerPrintView from './SalesTaxLedgerPrintView';
import POSBillDetailsModal from '../../../pos/POSBillDetailsModal';
import TaxInvoiceModal from './TaxInvoiceModal';
import TaxInvoicePrintView from './TaxInvoicePrintView';
import { toast } from 'sonner';

const VAT_THRESHOLD_ANNUAL = 1800000; // 1.8 Million THB per Revenue Code

export default function SalesTaxReportTab({ 
    invoices = [], 
    companySettings = {}, 
    onOpenInvoice,
    allYearBookings = [],
    onDeleteBooking,
    onDeleteInvoice
}) {
    const isVatRegistered = companySettings?.tax_is_vat_registered === 'true' || companySettings?.tax_is_vat_registered === true;
    const [activePrintInvoice, setActivePrintInvoice] = useState(null);

    // Time helper utilities
    const getTodayDate = () => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const getCurrentMonth = () => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    };

    const getYesterdayDate = () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Filter & Granularity States
    const [timeFilterMode, setTimeFilterMode] = useState('month'); // 'day' | 'month' | 'all' (tax periods are months)
    const [selectedDate, setSelectedDate] = useState(getTodayDate);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'cancelled'
    const [paymentFilter, setPaymentFilter] = useState('all'); // 'all' | 'cash' | 'promptpay' | 'credit_card'
    const [channelFilter, setChannelFilter] = useState('all'); // 'all' | 'dine_in' | 'pickup'
    const [dataSourceMode, setDataSourceMode] = useState('pos_bills'); // 'pos_bills' | 'all' | 'invoices'

    // Modals
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedBillForDetail, setSelectedBillForDetail] = useState(null);
    const [selectedBookingForTaxModal, setSelectedBookingForTaxModal] = useState(null);
    const [billToDelete, setBillToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Format display string for the active period
    const activePeriodLabel = useMemo(() => {
        const monthNames = [
            'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
            'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];
        if (timeFilterMode === 'day') {
            const [y, m, d] = selectedDate.split('-');
            const mIdx = parseInt(m, 10) - 1;
            const thYear = parseInt(y, 10) + 543;
            return `ประจำวันที่ ${parseInt(d, 10)} ${monthNames[mIdx] || m} ${thYear}`;
        }
        if (timeFilterMode === 'month') {
            const [year, month] = selectedMonth.split('-');
            const mIdx = parseInt(month, 10) - 1;
            const thYear = parseInt(year, 10) + 543;
            return `ประจำเดือน ${monthNames[mIdx] || month} ${thYear}`;
        }
        return 'ทุกช่วงเวลา';
    }, [timeFilterMode, selectedDate, selectedMonth]);

    // Helper: Detect Payment Method from booking & remark
    const detectPaymentMethod = (b) => {
        if (!b) return 'cash';
        const remark = String(b.staff_remark || '').toLowerCase();
        const explicitMethod = String(b.payment_method || '').toLowerCase();

        // 1. Explicit Cash Check (Must take highest priority over QR-order prefixes and reservation slips)
        if (remark.includes('paid by cash') || remark.includes('[cash:') || remark.includes('เงินสด') || remark.includes('ชำระเงินสด') || explicitMethod === 'cash') {
            return 'cash';
        }

        // 2. Explicit Credit Card Check
        if (remark.includes('paid by credit') || remark.includes('[credit:') || remark.includes('paid by card') || remark.includes('บัตรเครดิต') || remark.includes('credit') || explicitMethod === 'credit' || explicitMethod === 'credit_card') {
            return 'credit_card';
        }

        // 3. QR / PromptPay / Bank Transfer Check
        if (remark.includes('paid by qr') || remark.includes('paid by transfer') || remark.includes('[qr:') || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน') || remark.includes('promptpay') || remark.includes('สแกนจ่าย') || explicitMethod === 'qr' || explicitMethod === 'promptpay' || explicitMethod === 'transfer') {
            return 'promptpay';
        }

        // 4. Online Deposit / Slip
        if (b.payment_slip_url) return 'promptpay';

        return 'cash';
    };

    // Helper: Extract Customer / Guest Name
    const getCustomerDisplayName = (b) => {
        if (!b) return 'ลูกค้าทั่วไป';
        if (b.pickup_contact_name) return b.pickup_contact_name;
        if (b.profiles?.display_name) return b.profiles.display_name;
        if (b.profiles?.nickname) return b.profiles.nickname;
        if (b.customer_name && b.customer_name !== 'Walk-in Customer' && b.customer_name !== 'Walk-in Guest') {
            return b.customer_name;
        }
        if (b.tables_layout?.table_name) {
            return `ลูกค้าโต๊ะ ${b.tables_layout.table_name}`;
        }
        return 'ลูกค้าหน้าร้าน';
    };

    // Helper: Build Itemized Summary
    const getItemsSummary = (b) => {
        if (!b?.order_items || b.order_items.length === 0) return '';
        return b.order_items.map(item => {
            const name = item.custom_name || item.menu_items?.name || 'สินค้า';
            return `${name} x${item.quantity || 1}`;
        }).join(', ');
    };

    // Helper: Convert ISO date string to local YYYY-MM-DD (Thailand time)
    const toLocalDateKey = toBangkokDateKey;

    const stableBillNumbers = useMemo(() => buildStableBillNumbers(allYearBookings || []), [allYearBookings]);

    // In-memory lookup map of bookings by id
    const bookingById = useMemo(() => {
        const map = new Map();
        (allYearBookings || []).forEach(b => {
            if (b?.id) map.set(b.id, b);
        });
        return map;
    }, [allYearBookings]);

    // In-memory lookup map of active invoices by booking_id (excluding void/cancelled)
    const invoiceByBookingId = useMemo(() => {
        const map = new Map();
        (invoices || []).forEach(inv => {
            if (!inv.booking_id) return;
            const s = String(inv.status || '').toLowerCase();
            if (s === 'cancelled' || s === 'void' || s === 'voided' || s === 'deleted') return;
            if (!map.has(inv.booking_id)) {
                const linkedB = bookingById.get(inv.booking_id);
                const syncedIssuedAt = linkedB?.booking_time || inv.issued_at || inv.created_at;
                map.set(inv.booking_id, {
                    ...inv,
                    issued_at: syncedIssuedAt,
                    booking_time: linkedB?.booking_time || inv.booking_time
                });
            }
        });
        return map;
    }, [invoices, bookingById]);

    // Normalize & Compile Real POS Bookings into sequential Bill items (Excluding Voided/Cancelled)
    const compiledPosBills = useMemo(() => {
        if (!allYearBookings || allYearBookings.length === 0) return [];
        
        // Filter bookings matching the active date/month filter AND exclude void/cancelled
        const timeFiltered = allYearBookings.filter(b => {
            if (!isTaxableSale(b)) return false; // only paid, closed bills are sales

            const localDate = toLocalDateKey(b.booking_time || b.created_at);
            if (timeFilterMode === 'day') {
                return localDate === selectedDate;
            }
            if (timeFilterMode === 'month') {
                return localDate.startsWith(selectedMonth);
            }
            return true; // 'all'
        });

        // Sort chronologically ascending for standard sequential reporting
        timeFiltered.sort((a, b) => {
            const timeA = new Date(a.booking_time || a.created_at).getTime();
            const timeB = new Date(b.booking_time || b.created_at).getTime();
            return timeA - timeB;
        });

        // Map to structured bill records; bill numbers come from the stable monthly sequence
        return timeFiltered.map((b) => {
            const total = bookingSaleAmount(b);
            const preVat = isVatRegistered ? Math.round((total / 1.07) * 100) / 100 : total;
            const vat = isVatRegistered ? Math.round((total - preVat) * 100) / 100 : 0;
            const generatedBillNo = stableBillNumbers.get(b.id) || b.order_number || '-';
            const detectedPayment = detectPaymentMethod(b);
            const customerName = getCustomerDisplayName(b);
            const itemsSummary = getItemsSummary(b);

            // Check if full tax invoice already exists via in-memory lookup
            const existingTaxInvoice = invoiceByBookingId.get(b.id) || null;
            const orderTimestamp = b.booking_time || b.created_at;

            return {
                id: b.id,
                booking_id: b.id,
                bill_number: generatedBillNo,
                invoice_number: existingTaxInvoice?.invoice_number || generatedBillNo,
                tax_invoice_record: existingTaxInvoice,
                has_tax_invoice: Boolean(existingTaxInvoice),
                customer_name: existingTaxInvoice?.customer_name || customerName,
                customer_phone: existingTaxInvoice?.customer_phone || b.customer_phone || b.profiles?.phone_number || b.pickup_contact_phone || '',
                customer_tax_id: existingTaxInvoice?.customer_tax_id || b.customer_tax_id || '',
                customer_branch_type: existingTaxInvoice?.customer_branch_type || 'head_office',
                customer_branch_code: existingTaxInvoice?.customer_branch_code || '00000',
                table_name: b.tables_layout?.table_name || null,
                booking_type: b.booking_type || (b.tables_layout ? 'dine_in' : 'pickup'),
                booking_time: b.booking_time,
                issued_at: orderTimestamp,
                created_at: b.created_at,
                pre_vat_amount: preVat,
                vat_amount: vat,
                total_amount: total,
                payment_method: detectedPayment,
                items_summary: itemsSummary,
                raw_booking: b,
                status: 'active',
                source_type: 'pos_bill'
            };
        });
    }, [allYearBookings, timeFilterMode, selectedDate, selectedMonth, isVatRegistered, invoiceByBookingId, stableBillNumbers]);

    // Active Compiled Records based on Data Source Mode (Excluding Voided)
    const activeRawRecords = useMemo(() => {
        // Filter invoices by time AND exclude void/cancelled
        const timeFilteredInvoices = invoices.filter(inv => {
            if (inv.status === 'cancelled' || inv.status === 'void') return false; // Exclude voided invoices
            const linkedB = inv.booking_id ? bookingById.get(inv.booking_id) : null;
            const rawDate = linkedB?.booking_time || inv.issued_at || inv.created_at || '';
            const localDate = toLocalDateKey(rawDate);
            if (timeFilterMode === 'day') {
                return localDate === selectedDate;
            }
            if (timeFilterMode === 'month') {
                return localDate.startsWith(selectedMonth);
            }
            return true;
        }).map(inv => {
            const linkedB = inv.booking_id ? bookingById.get(inv.booking_id) : null;
            return {
                ...inv,
                issued_at: linkedB?.booking_time || inv.issued_at || inv.created_at,
                booking_time: linkedB?.booking_time || inv.booking_time,
                source_type: 'tax_invoice'
            };
        });

        if (dataSourceMode === 'invoices') {
            return timeFilteredInvoices;
        } else if (dataSourceMode === 'pos_bills') {
            return compiledPosBills;
        } else {
            // Unified Mode (All POS Bills + Invoices that are standalone or linked)
            const invoiceBookingIds = new Set(timeFilteredInvoices.map(i => i.booking_id).filter(Boolean));
            const remainingBills = compiledPosBills.filter(b => !invoiceBookingIds.has(b.booking_id));

            const combined = [...timeFilteredInvoices, ...remainingBills];
            combined.sort((a, b) => {
                const timeA = new Date(a.issued_at || a.created_at).getTime();
                const timeB = new Date(b.issued_at || b.created_at).getTime();
                return timeA - timeB;
            });
            return combined;
        }
    }, [dataSourceMode, invoices, compiledPosBills, timeFilterMode, selectedDate, selectedMonth]);

    // Filter by search query, status, payment method, and channel
    const filteredRecords = useMemo(() => {
        return activeRawRecords.filter(item => {
            // 1. Status Filter
            const matchesStatus = statusFilter === 'all' 
                ? true 
                : (statusFilter === 'active' ? item.status !== 'cancelled' : item.status === 'cancelled');
            if (!matchesStatus) return false;

            // 2. Payment Method Filter
            if (paymentFilter !== 'all') {
                const itemPayment = (item.payment_method || '').toLowerCase();
                if (paymentFilter === 'cash' && !itemPayment.includes('cash')) return false;
                if (paymentFilter === 'promptpay' && !(itemPayment.includes('promptpay') || itemPayment.includes('qr') || itemPayment.includes('transfer'))) return false;
                if (paymentFilter === 'credit_card' && !(itemPayment.includes('credit') || itemPayment.includes('card'))) return false;
            }

            // 3. Channel Filter
            if (channelFilter !== 'all') {
                const bType = (item.booking_type || 'dine_in').toLowerCase();
                if (channelFilter === 'dine_in' && !(bType === 'dine_in' || bType === 'walk_in' || item.table_name)) return false;
                if (channelFilter === 'pickup' && !(bType.includes('pickup') || bType.includes('takeaway'))) return false;
            }

            // 4. Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchesSearch = 
                    (item.invoice_number || '').toLowerCase().includes(q) ||
                    (item.bill_number || '').toLowerCase().includes(q) ||
                    (item.customer_name || '').toLowerCase().includes(q) ||
                    (item.customer_phone || '').includes(q) ||
                    (item.customer_tax_id || '').includes(q) ||
                    (item.table_name || '').toLowerCase().includes(q) ||
                    (item.items_summary || '').toLowerCase().includes(q) ||
                    (item.payment_method || '').toLowerCase().includes(q);

                if (!matchesSearch) return false;
            }

            return true;
        });
    }, [activeRawRecords, searchQuery, statusFilter, paymentFilter, channelFilter]);

    // Financial Aggregate Calculations for Active Selection
    const periodStats = useMemo(() => {
        const activeOnly = filteredRecords.filter(i => i.status !== 'cancelled');
        const grossSales = activeOnly.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
        const preVatSales = activeOnly.reduce((sum, i) => sum + Number(i.pre_vat_amount || 0), 0);
        const outputVat = activeOnly.reduce((sum, i) => sum + Number(i.vat_amount || 0), 0);
        const recordCount = activeOnly.length;
        const cancelledCount = filteredRecords.filter(i => i.status === 'cancelled').length;

        return {
            grossSales,
            preVatSales: isVatRegistered ? preVatSales : grossSales,
            outputVat: isVatRegistered ? outputVat : 0,
            recordCount,
            cancelledCount
        };
    }, [filteredRecords, isVatRegistered]);

    // YTD Revenue & 1.8M Baht VAT Threshold Progress
    const ytdStats = useMemo(() => {
        const currentYear = (selectedDate || selectedMonth).split('-')[0] || String(new Date().getFullYear());
        
        const yearInvoices = invoices.filter(i =>
            toBangkokDateKey(i.issued_at || i.created_at).startsWith(currentYear) && i.status !== 'cancelled'
        );
        const totalFromInvoices = yearInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

        const yearBookings = (allYearBookings || []).filter(b =>
            isTaxableSale(b) && toBangkokDateKey(b.booking_time || b.created_at).startsWith(currentYear)
        );
        const totalFromBookings = yearBookings.reduce((sum, b) => sum + bookingSaleAmount(b), 0);

        const ytdGross = Math.max(totalFromInvoices, totalFromBookings);
        const pct = Math.min(100, (ytdGross / VAT_THRESHOLD_ANNUAL) * 100);
        const remaining = Math.max(0, VAT_THRESHOLD_ANNUAL - ytdGross);
        const isNearThreshold = pct >= 80;
        const isExceeded = ytdGross >= VAT_THRESHOLD_ANNUAL;

        return {
            year: currentYear,
            ytdGross,
            pct,
            remaining,
            isNearThreshold,
            isExceeded
        };
    }, [invoices, allYearBookings, selectedDate, selectedMonth]);

    const handleExportCsv = () => {
        if (filteredRecords.length === 0) {
            toast.warning('ไม่พบข้อมูลรายการขายในช่วงเวลาและเงื่อนไขที่เลือก');
            return;
        }
        const timePeriodTag = timeFilterMode === 'day' ? selectedDate : (timeFilterMode === 'month' ? selectedMonth : 'all');
        const csv = exportUnifiedSalesLedgerCsv(filteredRecords, timePeriodTag, isVatRegistered, {
            reportType: dataSourceMode
        });
        const prefix = isVatRegistered ? 'Sales_Tax_Report' : 'Sales_Bill_Ledger';
        const filename = `${prefix}_${dataSourceMode}_${timePeriodTag}.csv`;
        downloadCsvFile(csv, filename);
        toast.success(`ดาวน์โหลดรายงาน ${filename} เรียบร้อยแล้ว (พร้อมเปิดใน Excel)`);
    };

    // Execute Bill Deletion with Auto-Resequence
    const handleExecuteDeleteBill = async () => {
        if (!billToDelete) return;
        setDeleting(true);
        const toastId = toast.loading('กำลังยกเลิกบิล…');
        try {
            if (billToDelete.source_type === 'pos_bill') {
                const { error } = await supabase
                    .from('bookings')
                    .update({ 
                        status: 'cancelled', 
                        staff_remark: '[VOIDED_FROM_TAX_LEDGER]' 
                    })
                    .eq('id', billToDelete.id);

                // Never hard-delete a sale: if voiding fails, stop and say so
                if (error) throw error;

                if (onDeleteBooking) {
                    onDeleteBooking(billToDelete.id);
                }
            } else if (billToDelete.source_type === 'tax_invoice') {
                const { error } = await supabase
                    .from('tax_invoices')
                    .update({
                        status: 'cancelled',
                        cancellation_reason: 'ยกเลิกจากสมุดรายงานยอดขาย',
                        cancelled_at: new Date().toISOString()
                    })
                    .eq('id', billToDelete.id);
                if (error) throw error;

                if (onDeleteInvoice) {
                    onDeleteInvoice(billToDelete.id);
                }
            }

            toast.success(`ยกเลิกบิล ${billToDelete.bill_number || billToDelete.invoice_number || ''} แล้ว`, { id: toastId });
            setBillToDelete(null);
        } catch (err) {
            console.error('Failed to delete bill:', err);
            toast.error('ยกเลิกบิลไม่สำเร็จ: ' + (err?.message || 'กรุณาลองใหม่อีกครั้ง'), { id: toastId });
        } finally {
            setDeleting(false);
        }
    };

    // Helper for rendering payment method badges
    const renderPaymentBadge = (method) => {
        const m = String(method || '').toLowerCase();
        if (m.includes('promptpay') || m.includes('qr') || m.includes('transfer')) {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 tabular-nums text-[11px] font-bold border border-blue-200">
                    <QrCode size={10} /> พร้อมเพย์
                </span>
            );
        }
        if (m.includes('cash') || m.includes('เงินสด')) {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 tabular-nums text-[11px] font-bold border border-emerald-200">
                    <Coins size={10} /> เงินสด
                </span>
            );
        }
        if (m.includes('credit') || m.includes('card')) {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 tabular-nums text-[11px] font-bold border border-purple-200">
                    <CreditCard size={10} /> บัตรเครดิต
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] tabular-nums text-[11px] font-medium">
                {method ? String(method).toUpperCase() : 'ทั่วไป'}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Year-to-date sales against the 1.8M VAT line: information only. The owner has
                agreed with the Revenue Department that the shop does not register yet. */}
            {!isVatRegistered && (
                <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-4 space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-[var(--color-ink)]">ยอดขายสะสมปี {ytdStats.year}</h3>
                            <p className="text-xs text-[var(--color-muted)]">เทียบกับเกณฑ์จด VAT 1,800,000 บาทต่อปี (ข้อมูลอ้างอิง)</p>
                        </div>
                        <div className="text-right tabular-nums">
                            <span className="text-lg font-bold text-[var(--color-ink)]">฿{ytdStats.ytdGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            <span className="text-xs text-[var(--color-muted)]"> / ฿1,800,000 · {ytdStats.pct.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--color-paper-2)]">
                        <div className="h-full bg-[var(--color-ink)] transition-all duration-500" style={{ width: `${ytdStats.pct}%` }} />
                    </div>
                </div>
            )}

            {/* TOP CONTROL BAR: Granular Date Filter + Data Source Switcher + Sub-Filters & Actions */}
            <div className="bg-[oklch(99%_0.004_28)] border border-[#D1D1CD] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 ">
                
                {/* ROW 1: Time Range Filters (Day, Month, All + Date Pickers) */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[oklch(90%_0.008_28)] pb-3">
                    
                    {/* Time Filter Mode Pill Group */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-xl border border-[oklch(90%_0.008_28)] text-xs tabular-nums">
                            <button
                                onClick={() => {
                                    setTimeFilterMode('day');
                                    setSelectedDate(getTodayDate());
                                }}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${timeFilterMode === 'day' ? 'bg-[#1A1A1A] text-[oklch(97%_0.008_28)] font-bold ' : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                            >
                                <Clock size={12} />
                                <span>รายวัน</span>
                            </button>

                            <button
                                onClick={() => setTimeFilterMode('month')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${timeFilterMode === 'month' ? 'bg-[#1A1A1A] text-[oklch(97%_0.008_28)] font-bold ' : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                            >
                                <Calendar size={12} />
                                <span>รายเดือน</span>
                            </button>

                            <button
                                onClick={() => setTimeFilterMode('all')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${timeFilterMode === 'all' ? 'bg-[#1A1A1A] text-[oklch(97%_0.008_28)] font-bold ' : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                            >
                                <span>ทุกช่วง</span>
                            </button>
                        </div>

                        {/* Granular Input depending on mode */}
                        {timeFilterMode === 'day' && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1.5 border border-[oklch(85%_0.012_28)] rounded-xl px-2.5 py-1 bg-[oklch(99%_0.004_28)]">
                                    <Calendar size={14} className="text-[oklch(50%_0.010_28)]" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="text-xs tabular-nums font-bold text-[oklch(18%_0.012_28)] focus:outline-none bg-transparent cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={() => setSelectedDate(getTodayDate())}
                                    className={`px-2.5 py-1 rounded-lg text-xs tabular-nums font-bold border transition-colors cursor-pointer ${selectedDate === getTodayDate() ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-zinc-900' : 'bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(90%_0.008_28)]'}`}
                                >
                                    วันนี้
                                </button>
                                <button
                                    onClick={() => setSelectedDate(getYesterdayDate())}
                                    className={`px-2.5 py-1 rounded-lg text-xs tabular-nums font-bold border transition-colors cursor-pointer ${selectedDate === getYesterdayDate() ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-zinc-900' : 'bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(90%_0.008_28)]'}`}
                                >
                                    เมื่อวาน
                                </button>
                            </div>
                        )}

                        {timeFilterMode === 'month' && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1.5 border border-[oklch(85%_0.012_28)] rounded-xl px-2.5 py-1 bg-[oklch(99%_0.004_28)]">
                                    <Calendar size={14} className="text-[oklch(50%_0.010_28)]" />
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="text-xs tabular-nums font-bold text-[oklch(18%_0.012_28)] focus:outline-none bg-transparent cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={() => setSelectedMonth(getCurrentMonth())}
                                    className={`px-2.5 py-1 rounded-lg text-xs tabular-nums font-bold border transition-colors cursor-pointer ${selectedMonth === getCurrentMonth() ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-zinc-900' : 'bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(90%_0.008_28)]'}`}
                                >
                                    เดือนนี้
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Active Period Tag */}
                    <div className="text-xs tabular-nums text-[oklch(42%_0.010_28)] bg-[oklch(94%_0.010_28)] px-3 py-1 rounded-xl border border-[oklch(90%_0.008_28)]">
                        {activePeriodLabel} • ยอดขายรวม: <strong className="text-[oklch(18%_0.012_28)] font-bold">฿{periodStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                </div>

                {/* ROW 2: Data Source Switcher, Secondary Filters & Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    
                    {/* Left: Source Tabs & Detailed Filters */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Data Source Selector */}
                        <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-xl border border-[oklch(90%_0.008_28)] text-xs tabular-nums">
                            <button
                                onClick={() => setDataSourceMode('pos_bills')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${dataSourceMode === 'pos_bills' ? 'bg-[#1A1A1A] text-[oklch(97%_0.008_28)] font-bold ' : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                            >
                                <Receipt size={13} />
                                <span>บิลขาย POS ({compiledPosBills.length})</span>
                            </button>
                            <button
                                onClick={() => setDataSourceMode('all')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${dataSourceMode === 'all' ? 'bg-[#1A1A1A] text-[oklch(97%_0.008_28)] font-bold ' : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                            >
                                <Layers size={13} />
                                <span>รวมทุกบิลขาย</span>
                            </button>
                            <button
                                onClick={() => setDataSourceMode('invoices')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${dataSourceMode === 'invoices' ? 'bg-[#1A1A1A] text-[oklch(97%_0.008_28)] font-bold ' : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                            >
                                <FileText size={13} />
                                <span>เอกสารภาษี ({invoices.filter(i => {
                                    if (i.status === 'cancelled' || i.status === 'void') return false;
                                    const linkedB = i.booking_id ? bookingById.get(i.booking_id) : null;
                                    const localDate = toLocalDateKey(linkedB?.booking_time || i.issued_at || i.created_at);
                                    return timeFilterMode === 'day' ? localDate === selectedDate : (timeFilterMode === 'month' ? localDate.startsWith(selectedMonth) : true);
                                }).length})</span>
                            </button>
                        </div>

                        {/* Payment Method Filter */}
                        <select
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            aria-label="กรองตามวิธีชำระเงิน"
                            className="px-2.5 py-1.5 bg-[oklch(99%_0.004_28)] border border-[oklch(85%_0.012_28)] rounded-xl text-xs tabular-nums font-medium focus:border-zinc-900 focus:outline-none cursor-pointer"
                        >
                            <option value="all">ทุกช่องทางชำระเงิน</option>
                            <option value="cash">เฉพาะ เงินสด</option>
                            <option value="promptpay">เฉพาะ พร้อมเพย์ / โอน</option>
                            <option value="credit_card">เฉพาะ บัตรเครดิต</option>
                        </select>

                        {/* Channel Filter (Dine-in / Pickup) */}
                        <select
                            value={channelFilter}
                            onChange={(e) => setChannelFilter(e.target.value)}
                            aria-label="กรองตามช่องทาง"
                            className="px-2.5 py-1.5 bg-[oklch(99%_0.004_28)] border border-[oklch(85%_0.012_28)] rounded-xl text-xs tabular-nums font-medium focus:border-zinc-900 focus:outline-none cursor-pointer"
                        >
                            <option value="all">ทุกรูปแบบ</option>
                            <option value="dine_in">ทานที่ร้าน</option>
                            <option value="pickup">สั่งกลับบ้าน</option>
                        </select>

                        {/* Search */}
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(50%_0.010_28)]" />
                            <input
                                type="text"
                                placeholder="ค้นหาเลขบิล / ลูกค้า / โต๊ะ / เมนู..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 border border-[oklch(85%_0.012_28)] rounded-xl text-xs tabular-nums w-44 sm:w-56 focus:border-zinc-900 focus:outline-none bg-[oklch(99%_0.004_28)]"
                            />
                        </div>
                    </div>

                    {/* Right: Export & Print Action Buttons */}
                    <div className="flex items-center gap-2 self-end lg:self-auto">
                        <button
                            onClick={handleExportCsv}
                            className="px-3.5 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.008_28)] text-[oklch(18%_0.012_28)] rounded-xl tabular-nums font-bold text-xs flex items-center gap-1.5 border border-[oklch(85%_0.012_28)] transition-colors cursor-pointer "
                        >
                            <FileSpreadsheet size={15} className="text-emerald-700" />
                            <span>ส่งออก CSV</span>
                        </button>

                        <button
                            onClick={() => setShowPrintModal(true)}
                            className="px-4 py-2 bg-[#1A1A1A] hover:bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] rounded-xl tabular-nums font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                        >
                            <Printer size={15} className="text-emerald-400" />
                            <span>พิมพ์รายงาน / โหลด PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Metric KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Gross Sales */}
                <div className="bg-[oklch(99%_0.004_28)] border border-[#D1D1CD] rounded-2xl p-4 ">
                    <span className="tabular-nums text-xs font-bold text-[oklch(50%_0.010_28)] block">
                        ยอดขายรวมทั้งสิ้น
                    </span>
                    <div className="tabular-nums font-black text-xl text-[oklch(18%_0.012_28)] mt-1">
                        ฿{periodStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-xs text-[oklch(50%_0.010_28)] tabular-nums mt-0.5 block">
                        {activePeriodLabel} ({periodStats.recordCount} รายการ)
                    </span>
                </div>

                {/* Card 2: Taxable Base */}
                <div className="bg-[oklch(99%_0.004_28)] border border-[#D1D1CD] rounded-2xl p-4 ">
                    <span className="tabular-nums text-xs font-bold text-[oklch(50%_0.010_28)] block">
                        มูลค่าฐานภาษี
                    </span>
                    <div className="tabular-nums font-black text-xl text-[oklch(18%_0.012_28)] mt-1">
                        ฿{periodStats.preVatSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-xs text-[oklch(50%_0.010_28)] tabular-nums mt-0.5 block">
                        {isVatRegistered ? 'ยอดขายก่อนคิด VAT 7%' : 'ยอดขายสุทธิ (ยังไม่เข้าระบบ VAT)'}
                    </span>
                </div>

                {/* Card 3: Output VAT 7% */}
                <div className="bg-[oklch(99%_0.004_28)] border border-[#D1D1CD] rounded-2xl p-4 ">
                    <span className="tabular-nums text-xs font-bold text-[oklch(50%_0.010_28)] block">
                        ภาษีขายที่ต้องนำส่ง (Output VAT 7%)
                    </span>
                    <div className={`tabular-nums font-black text-xl mt-1 ${isVatRegistered ? 'text-[oklch(52%_0.16_28)]' : 'text-[oklch(50%_0.010_28)]'}`}>
                        {isVatRegistered ? `฿${periodStats.outputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '฿0.00'}
                    </div>
                    <span className="text-xs text-[oklch(50%_0.010_28)] tabular-nums mt-0.5 block">
                        {isVatRegistered ? 'สำหรับยื่นแบบ ภ.พ.30' : 'ยังไม่จด VAT ไม่ต้องนำส่งภาษีขาย'}
                    </span>
                </div>

                {/* Card 4: Report Classification */}
                <div className="bg-[#1A1A1A] text-[oklch(97%_0.008_28)] rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                        <span className="tabular-nums text-xs font-bold text-[oklch(50%_0.010_28)] block">
                            แบบแสดงรายการบัญชี
                        </span>
                        <div className="font-bold text-sm text-emerald-400 mt-1">
                            {isVatRegistered ? 'แบบ ภ.พ.30 (รายงานภาษีขาย)' : 'สมุดรายรับรายบิล'}
                        </div>
                    </div>
                    <span className="text-xs text-[oklch(50%_0.010_28)] tabular-nums">
                        โหมด: {dataSourceMode === 'invoices' ? 'เอกสารภาษี' : (dataSourceMode === 'pos_bills' ? 'บิลขายจริงจาก POS' : 'รวมทุกบิลขาย')}
                    </span>
                </div>
            </div>

            {/* Official Tabular Sales Tax & Real POS Bill Ledger */}
            <div className="bg-[oklch(99%_0.004_28)] border border-[#D1D1CD] rounded-2xl overflow-hidden ">
                <div className="px-5 py-4 border-b border-[oklch(90%_0.008_28)] flex flex-wrap justify-between items-center bg-zinc-50/70 gap-2">
                    <div>
                        <h3 className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                            {isVatRegistered ? 'รายงานภาษีขาย (Sales Tax Report ภ.พ.30)' : 'สมุดรายงานยอดขายและรายรับรายบิล'}
                        </h3>
                        <p className="text-[13px] text-[oklch(50%_0.010_28)] tabular-nums">
                            {activePeriodLabel} • จำนวน {filteredRecords.length} รายการ (คลิกที่แถวเพื่อดูรายละเอียดบิล / ออกใบกำกับภาษี)
                        </p>
                    </div>
                    <div className="text-xs tabular-nums text-[oklch(42%_0.010_28)] bg-[oklch(99%_0.004_28)] border border-[oklch(90%_0.008_28)] px-3 py-1 rounded-lg">
                        รวมทั้งสิ้น: <strong className="text-[oklch(18%_0.012_28)]">฿{periodStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr className="bg-zinc-100/90 border-b border-[oklch(85%_0.012_28)] tabular-nums text-xs text-[oklch(42%_0.010_28)]">
                                <th className="p-3 w-10 text-center">ลำดับ</th>
                                <th className="p-3 w-28">วันที่ / เวลา</th>
                                <th className="p-3 w-36">เลขที่บิล / เอกสาร</th>
                                <th className="p-3 w-28">โต๊ะ / ช่องทาง</th>
                                <th className="p-3">ลูกค้า / รายการสินค้า</th>
                                <th className="p-3 w-28">ชำระเงิน</th>
                                <th className="p-3 text-right w-28">{isVatRegistered ? 'มูลค่าก่อนภาษี' : 'มูลค่าสินค้า'}</th>
                                {isVatRegistered && <th className="p-3 text-right w-24">ภาษี 7%</th>}
                                <th className="p-3 text-right w-28">รวมทั้งสิ้น</th>
                                <th className="p-3 text-center w-28">การจัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[oklch(90%_0.008_28)]">
                            {filteredRecords.map((item, idx) => {
                                const isCancelled = item.status === 'cancelled';
                                const rawDate = item.issued_at || item.created_at || item.booking_time;
                                const dateObj = rawDate ? new Date(rawDate) : null;
                                const dateStr = dateObj ? dateObj.toLocaleDateString('th-TH') : '-';
                                const timeStr = dateObj ? dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
                                
                                const docNo = item.invoice_number || item.bill_number || (item.id ? `POS-${String(item.id).slice(0, 8).toUpperCase()}` : '-');

                                const preVat = Number(item.pre_vat_amount !== undefined 
                                    ? item.pre_vat_amount 
                                    : (isVatRegistered ? (Number(item.total_amount || item.total_price || 0) / 1.07) : (item.total_amount || item.total_price || 0)));
                                const vat = Number(item.vat_amount !== undefined 
                                    ? item.vat_amount 
                                    : (isVatRegistered ? (Number(item.total_amount || item.total_price || 0) - preVat) : 0));
                                const total = Number(item.total_amount !== undefined ? item.total_amount : (item.total_price || 0));

                                return (
                                    <tr 
                                        key={item.id || idx}
                                        className={`hover:bg-zinc-50/80 transition-colors cursor-pointer ${isCancelled ? 'bg-red-50/40 text-[oklch(50%_0.010_28)]' : ''}`}
                                        onClick={() => {
                                            if (item.source_type === 'tax_invoice' && onOpenInvoice) {
                                                onOpenInvoice(item);
                                            } else if (item.raw_booking) {
                                                setSelectedBillForDetail(item.raw_booking);
                                            }
                                        }}
                                    >
                                        <td className="p-3 text-center tabular-nums text-[oklch(50%_0.010_28)]">{idx + 1}</td>
                                        <td className="p-3 tabular-nums">
                                            <div>{dateStr}</div>
                                            {timeStr && <div className="text-xs text-[oklch(50%_0.010_28)]">{timeStr}</div>}
                                        </td>
                                        <td className="p-3 tabular-nums font-bold text-[oklch(18%_0.012_28)]">
                                            <div className="flex items-center gap-1.5">
                                                <span>{docNo}</span>
                                                {item.has_tax_invoice && item.tax_invoice_record && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActivePrintInvoice(item.tax_invoice_record);
                                                        }}
                                                        className="px-1.5 py-0.2 rounded text-[11px] tabular-nums font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 cursor-pointer transition-colors"
                                                        title="คลิกเพื่อเปิดดู/ดาวน์โหลด PDF ใบเสร็จรับเงิน/ใบกำกับภาษี"
                                                    >
                                                        ใบเสร็จ
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 tabular-nums text-[13px]">
                                            {item.table_name ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] font-bold border border-[oklch(90%_0.008_28)]">
                                                    <UtensilsCrossed size={11} className="text-[oklch(50%_0.010_28)]" /> โต๊ะ {item.table_name}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
                                                    <ShoppingBag size={11} className="text-amber-600" /> Pickup
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="font-semibold text-[oklch(18%_0.012_28)]">{item.customer_name || 'ลูกค้าทั่วไป'}</div>
                                            {item.items_summary && (
                                                <div className="text-xs text-[oklch(50%_0.010_28)] tabular-nums truncate max-w-xs mt-0.5" title={item.items_summary}>
                                                    {item.items_summary}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            {renderPaymentBadge(item.payment_method)}
                                        </td>
                                        <td className="p-3 text-right tabular-nums font-semibold">
                                            {preVat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        {isVatRegistered && (
                                            <td className="p-3 text-right tabular-nums font-semibold text-[oklch(52%_0.16_28)]">
                                                {vat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        )}
                                        <td className="p-3 text-right tabular-nums font-bold text-[oklch(18%_0.012_28)]">
                                            {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1">
                                                {item.source_type === 'pos_bill' ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedBillForDetail(item.raw_booking)}
                                                            className="p-1 rounded hover:bg-[oklch(90%_0.008_28)] text-[oklch(42%_0.010_28)] transition-colors cursor-pointer"
                                                            title="ดูรายละเอียดบิล"
                                                        >
                                                            <Eye size={14} />
                                                        </button>

                                                        {item.has_tax_invoice && item.tax_invoice_record ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setActivePrintInvoice(item.tax_invoice_record)}
                                                                className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 tabular-nums text-[11px] font-bold border border-emerald-200 transition-colors flex items-center gap-0.5 cursor-pointer"
                                                                title="ดู/พิมพ์เอกสารใบเสร็จ/ใบกำกับภาษี"
                                                            >
                                                                <FileText size={10} />
                                                                <span>PDF</span>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedBookingForTaxModal(item.raw_booking)}
                                                                className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 tabular-nums text-[11px] font-bold border border-blue-200 transition-colors flex items-center gap-0.5 cursor-pointer"
                                                                title="ออกใบกำกับภาษีเต็มรูปจากบิลนี้"
                                                            >
                                                                <Plus size={10} />
                                                                <span>ออกใบเสร็จ</span>
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => setBillToDelete(item)}
                                                            className="p-1 rounded hover:bg-red-100 text-[oklch(50%_0.010_28)] hover:text-red-600 transition-colors cursor-pointer ml-0.5"
                                                            title="ยกเลิกบิลนี้ (ไม่นับเป็นยอดขาย)"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <span className="px-2 py-0.5 rounded text-[11px] tabular-nums font-bold bg-emerald-100 text-emerald-800">
                                                            ปกติ
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setBillToDelete(item)}
                                                            className="p-1 rounded hover:bg-red-100 text-[oklch(50%_0.010_28)] hover:text-red-600 transition-colors cursor-pointer"
                                                            title="ยกเลิกเอกสารนี้"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredRecords.length === 0 && (
                                <tr>
                                    <td colSpan={isVatRegistered ? 10 : 9} className="p-12 text-center text-[oklch(50%_0.010_28)] tabular-nums">
                                        ไม่พบรายการบิลขายจากการขายหน้าร้าน POS หรือใบกำกับภาษีในช่วงเวลาที่เลือก
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {filteredRecords.length > 0 && (
                            <tfoot>
                                <tr className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] tabular-nums font-bold text-xs">
                                    <td colSpan={6} className="p-3 text-right">
                                        รวมทั้งสิ้น:
                                    </td>
                                    <td className="p-3 text-right">
                                        ฿{periodStats.preVatSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    {isVatRegistered && (
                                        <td className="p-3 text-right text-emerald-400">
                                            ฿{periodStats.outputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                    )}
                                    <td className="p-3 text-right text-emerald-400 font-black">
                                        ฿{periodStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-center text-[13px] text-[oklch(50%_0.010_28)]">
                                        {periodStats.recordCount} รายการ
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Printable A4 Modal (SalesTaxLedgerPrintView) */}
            {showPrintModal && (
                <SalesTaxLedgerPrintView
                    periodMonth={selectedMonth}
                    periodDate={selectedDate}
                    filterMode={timeFilterMode}
                    periodLabel={activePeriodLabel}
                    records={filteredRecords}
                    companySettings={companySettings}
                    isVatRegistered={isVatRegistered}
                    dataSourceMode={dataSourceMode}
                    onClose={() => setShowPrintModal(false)}
                />
            )}

            {/* POS Bill Details Modal */}
            {selectedBillForDetail && (
                <POSBillDetailsModal
                    booking={selectedBillForDetail}
                    onClose={() => setSelectedBillForDetail(null)}
                />
            )}

            {/* Issue Tax Invoice from POS Bill Modal */}
            {selectedBookingForTaxModal && (
                <TaxInvoiceModal
                    isOpen={true}
                    onClose={() => setSelectedBookingForTaxModal(null)}
                    booking={selectedBookingForTaxModal}
                    companySettings={companySettings}
                    onSaveSuccess={(savedInvoice, printImmediately) => {
                        setSelectedBookingForTaxModal(null);
                        toast.success('ออกเอกสารใบกำกับภาษีเรียบร้อยแล้ว');
                        if (printImmediately) {
                            setActivePrintInvoice(savedInvoice);
                        }
                    }}
                />
            )}

            {/* A4 Official Printable Tax Invoice / Receipt View */}
            {activePrintInvoice && (
                <TaxInvoicePrintView
                    invoice={activePrintInvoice}
                    companySettings={companySettings}
                    onClose={() => setActivePrintInvoice(null)}
                />
            )}

            {/* Delete Bill & Auto-Resequence Confirmation Modal */}
            {billToDelete && (
                <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 tabular-nums">
                    <div className="bg-[oklch(99%_0.004_28)] border border-[#D1D1CD] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 border-b border-[oklch(90%_0.008_28)] pb-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                                <Trash2 size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-[oklch(18%_0.012_28)] ">
                                    ยืนยันการยกเลิกบิลขาย
                                </h3>
                                <p className="text-[13px] text-[oklch(50%_0.010_28)]">
                                    บิลจะถูกยกเลิกและไม่นับเป็นยอดขาย
                                </p>
                            </div>
                        </div>

                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(90%_0.008_28)] rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-[oklch(50%_0.010_28)]">เลขที่บิล:</span>
                                <span className="font-bold text-[oklch(18%_0.012_28)]">{billToDelete.bill_number || billToDelete.invoice_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(50%_0.010_28)]">ยอดเงินรวม:</span>
                                <span className="font-bold text-emerald-700">฿{Number(billToDelete.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(50%_0.010_28)]">ลูกค้า / โต๊ะ:</span>
                                <span className="font-bold text-[oklch(18%_0.012_28)]">{billToDelete.customer_name} {billToDelete.table_name ? `(โต๊ะ ${billToDelete.table_name})` : ''}</span>
                            </div>
                        </div>

                        <div className="text-xs text-[oklch(42%_0.010_28)] bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed flex items-start gap-2">
                            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <strong>หมายเหตุ:</strong> บิลจะเปลี่ยนสถานะเป็นยกเลิก (ไม่ได้ลบออกจากระบบ) และเลขบิลของเดือนนั้นจะรันต่อเนื่องใหม่
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => setBillToDelete(null)}
                                className="py-2.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.008_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-xl font-bold text-xs transition-colors cursor-pointer"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={handleExecuteDeleteBill}
                                className="py-2.5 bg-red-600 hover:bg-red-700 text-[oklch(97%_0.008_28)] rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 "
                            >
                                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                <span>{deleting ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิกบิล'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
