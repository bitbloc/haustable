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
    thaiBahtText 
} from '../../../utils/thaiTaxHelper';
import { supabase } from '../../../lib/supabaseClient';
import SalesTaxLedgerPrintView from './SalesTaxLedgerPrintView';
import POSBillDetailsModal from '../../../pos/POSBillDetailsModal';
import TaxInvoiceModal from './TaxInvoiceModal';
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
    const [timeFilterMode, setTimeFilterMode] = useState('day'); // 'day' | 'month' | 'all' (Default to 'day' for instant daily view)
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
        return 'ทุกช่วงเวลา (All Time)';
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
        if (!b) return 'ลูกค้าทั่วไป (Walk-in)';
        if (b.pickup_contact_name) return b.pickup_contact_name;
        if (b.profiles?.display_name) return b.profiles.display_name;
        if (b.profiles?.nickname) return b.profiles.nickname;
        if (b.customer_name && b.customer_name !== 'Walk-in Customer' && b.customer_name !== 'Walk-in Guest') {
            return b.customer_name;
        }
        if (b.tables_layout?.table_name) {
            return `ลูกค้าโต๊ะ ${b.tables_layout.table_name}`;
        }
        return 'ลูกค้าหน้าร้าน (Walk-in)';
    };

    // Helper: Build Itemized Summary
    const getItemsSummary = (b) => {
        if (!b?.order_items || b.order_items.length === 0) return '';
        return b.order_items.map(item => {
            const name = item.custom_name || item.menu_items?.name || 'สินค้า';
            return `${name} x${item.quantity || 1}`;
        }).join(', ');
    };

    // In-memory lookup map of invoices by booking_id
    const invoiceByBookingId = useMemo(() => {
        const map = new Map();
        (invoices || []).forEach(inv => {
            if (inv.booking_id) {
                map.set(inv.booking_id, inv);
            }
        });
        return map;
    }, [invoices]);

    // Normalize & Compile Real POS Bookings into sequential Bill items (Excluding Voided/Cancelled)
    const compiledPosBills = useMemo(() => {
        if (!allYearBookings || allYearBookings.length === 0) return [];
        
        // Filter bookings matching the active date/month filter AND exclude void/cancelled
        const timeFiltered = allYearBookings.filter(b => {
            const isCancelled = b.status === 'cancelled' || b.status === 'void' || b.status === 'deleted';
            if (isCancelled) return false; // Completely exclude voided/cancelled bills

            const rawDate = b.booking_time || b.created_at || '';
            if (timeFilterMode === 'day') {
                return rawDate.startsWith(selectedDate);
            }
            if (timeFilterMode === 'month') {
                return rawDate.startsWith(selectedMonth);
            }
            return true; // 'all'
        });

        // Sort chronologically ascending for standard sequential reporting
        timeFiltered.sort((a, b) => {
            const timeA = new Date(a.booking_time || a.created_at).getTime();
            const timeB = new Date(b.booking_time || b.created_at).getTime();
            return timeA - timeB;
        });

        // Map to structured bill records with running sequence
        const ymCompact = (selectedMonth || getCurrentMonth()).replace('-', '');
        return timeFiltered.map((b, idx) => {
            const total = Number(b.total_amount || b.total_price || 0);
            const preVat = isVatRegistered ? (total / 1.07) : total;
            const vat = isVatRegistered ? (total - preVat) : 0;
            const seqNumber = String(idx + 1).padStart(4, '0');
            const generatedBillNo = b.order_number || `BILL-${ymCompact}-${seqNumber}`;
            const detectedPayment = detectPaymentMethod(b);
            const customerName = getCustomerDisplayName(b);
            const itemsSummary = getItemsSummary(b);

            // Check if full tax invoice already exists via in-memory lookup
            const existingTaxInvoice = invoiceByBookingId.get(b.id) || null;

            return {
                id: b.id,
                booking_id: b.id,
                bill_number: generatedBillNo,
                invoice_number: existingTaxInvoice?.invoice_number || generatedBillNo,
                tax_invoice_record: existingTaxInvoice,
                has_tax_invoice: Boolean(existingTaxInvoice),
                customer_name: customerName,
                customer_phone: b.customer_phone || b.profiles?.phone_number || b.pickup_contact_phone || '',
                customer_tax_id: b.customer_tax_id || '',
                customer_branch_type: 'head_office',
                customer_branch_code: '00000',
                table_name: b.tables_layout?.table_name || null,
                booking_type: b.booking_type || (b.tables_layout ? 'dine_in' : 'pickup'),
                issued_at: b.booking_time || b.created_at,
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
    }, [allYearBookings, timeFilterMode, selectedDate, selectedMonth, isVatRegistered]);

    // Active Compiled Records based on Data Source Mode (Excluding Voided)
    const activeRawRecords = useMemo(() => {
        // Filter invoices by time AND exclude void/cancelled
        const timeFilteredInvoices = invoices.filter(inv => {
            if (inv.status === 'cancelled' || inv.status === 'void') return false; // Exclude voided invoices
            const rawDate = inv.issued_at || inv.created_at || '';
            if (timeFilterMode === 'day') {
                return rawDate.startsWith(selectedDate);
            }
            if (timeFilterMode === 'month') {
                return rawDate.startsWith(selectedMonth);
            }
            return true;
        }).map(inv => ({ ...inv, source_type: 'tax_invoice' }));

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
            (i.issued_at || i.created_at || '').startsWith(currentYear) && i.status !== 'cancelled'
        );
        const totalFromInvoices = yearInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

        const yearBookings = (allYearBookings || []).filter(b => 
            (b.booking_time || b.created_at || '').startsWith(currentYear) && b.status === 'completed'
        );
        const totalFromBookings = yearBookings.reduce((sum, b) => sum + Number(b.total_amount || b.total_price || 0), 0);

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
        const toastId = toast.loading('กำลังลบบิลและจัดเรียงลำดับใหม่...');
        try {
            if (billToDelete.source_type === 'pos_bill') {
                const { error } = await supabase
                    .from('bookings')
                    .update({ 
                        status: 'cancelled', 
                        staff_remark: '[VOIDED_FROM_TAX_LEDGER]' 
                    })
                    .eq('id', billToDelete.id);

                if (error) {
                    console.warn('Booking status update failed, attempting delete fallback:', error);
                    await supabase.from('bookings').delete().eq('id', billToDelete.id);
                }

                if (onDeleteBooking) {
                    onDeleteBooking(billToDelete.id);
                }
            } else if (billToDelete.source_type === 'tax_invoice') {
                await supabase
                    .from('tax_invoices')
                    .update({ 
                        status: 'cancelled', 
                        cancellation_reason: 'Voided from Sales Ledger' 
                    })
                    .eq('id', billToDelete.id);

                if (onDeleteInvoice) {
                    onDeleteInvoice(billToDelete.id);
                }
            }

            toast.success(`ลบบิล ${billToDelete.bill_number || billToDelete.invoice_number || ''} สำเร็จ! จัดเรียงเลขบิลใหม่อัตโนมัติแล้ว`, { id: toastId });
            setBillToDelete(null);
        } catch (err) {
            console.error('Failed to delete bill:', err);
            toast.error('เกิดข้อผิดพลาดในการลบบิล กรุณาลองใหม่อีกครั้ง', { id: toastId });
        } finally {
            setDeleting(false);
        }
    };

    // Helper for rendering payment method badges
    const renderPaymentBadge = (method) => {
        const m = String(method || '').toLowerCase();
        if (m.includes('promptpay') || m.includes('qr') || m.includes('transfer')) {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[9px] font-bold border border-blue-200">
                    <QrCode size={10} /> พร้อมเพย์
                </span>
            );
        }
        if (m.includes('cash') || m.includes('เงินสด')) {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[9px] font-bold border border-emerald-200">
                    <Coins size={10} /> เงินสด
                </span>
            );
        }
        if (m.includes('credit') || m.includes('card')) {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[9px] font-bold border border-purple-200">
                    <CreditCard size={10} /> บัตรเครดิต
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono text-[9px] font-medium">
                {method ? String(method).toUpperCase() : 'ทั่วไป'}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* 1.8 Million Baht VAT Threshold Monitor (Non-VAT Advisory Tracker) */}
            {!isVatRegistered && (
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl font-mono font-bold text-xs ${ytdStats.isExceeded ? 'bg-red-100 text-red-700' : (ytdStats.isNearThreshold ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}`}>
                                1.8M VAT TRACKER
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-zinc-900">
                                    เกณฑ์ติดตามรายได้สะสมประจำปี {ytdStats.year} (เกณฑ์จด VAT 1.8 ล้านบาท)
                                </h3>
                                <p className="text-[11px] text-zinc-500">
                                    ตามประมวลรัษฎากร หากรายรับเกิน 1,800,000 บาท/ปี ต้องยื่นขอจดทะเบียนภาษีมูลค่าเพิ่ม (ภ.พ.20) ภายใน 30 วัน
                                </p>
                            </div>
                        </div>

                        <div className="text-right font-mono">
                            <span className="text-[10px] text-zinc-500 uppercase block">รายรับสะสมปี {ytdStats.year}</span>
                            <span className="font-black text-base text-zinc-950">
                                ฿{ytdStats.ytdGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-zinc-400"> / ฿1,800,000</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden border border-zinc-200">
                        <div 
                            className={`h-full transition-all duration-500 rounded-full ${ytdStats.isExceeded ? 'bg-red-600' : (ytdStats.isNearThreshold ? 'bg-amber-500' : 'bg-emerald-600')}`}
                            style={{ width: `${ytdStats.pct}%` }}
                        />
                    </div>

                    <div className="flex flex-wrap justify-between items-center text-[11px] font-mono text-zinc-600 pt-1">
                        <span>ความคืบหน้า: <strong>{ytdStats.pct.toFixed(1)}%</strong></span>
                        <span>
                            {ytdStats.isExceeded ? (
                                <strong className="text-red-600">เกินเกณฑ์แล้ว! เตรียมยื่นจด VAT (ภ.พ.20) ภายใน 30 วัน</strong>
                            ) : (
                                <span>ยังสามารถรับรายได้แบบ Non-VAT ได้อีก: <strong className="text-emerald-700">฿{ytdStats.remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                            )}
                        </span>
                    </div>
                </div>
            )}

            {/* TOP CONTROL BAR: Granular Date Filter + Data Source Switcher + Sub-Filters & Actions */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm">
                
                {/* ROW 1: Time Range Filters (Day, Month, All + Date Pickers) */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                    
                    {/* Time Filter Mode Pill Group */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex bg-zinc-100 p-0.5 rounded-xl border border-zinc-200 text-xs font-mono">
                            <button
                                onClick={() => {
                                    setTimeFilterMode('day');
                                    setSelectedDate(getTodayDate());
                                }}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${timeFilterMode === 'day' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <Clock size={12} />
                                <span>รายวัน (Day)</span>
                            </button>

                            <button
                                onClick={() => setTimeFilterMode('month')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${timeFilterMode === 'month' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <Calendar size={12} />
                                <span>รายเดือน (Month)</span>
                            </button>

                            <button
                                onClick={() => setTimeFilterMode('all')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${timeFilterMode === 'all' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <span>ทุกช่วง (All)</span>
                            </button>
                        </div>

                        {/* Granular Input depending on mode */}
                        {timeFilterMode === 'day' && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1.5 border border-zinc-300 rounded-xl px-2.5 py-1 bg-white">
                                    <Calendar size={14} className="text-zinc-500" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="text-xs font-mono font-bold text-zinc-900 focus:outline-none bg-transparent cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={() => setSelectedDate(getTodayDate())}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${selectedDate === getTodayDate() ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'}`}
                                >
                                    วันนี้
                                </button>
                                <button
                                    onClick={() => setSelectedDate(getYesterdayDate())}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${selectedDate === getYesterdayDate() ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'}`}
                                >
                                    เมื่อวาน
                                </button>
                            </div>
                        )}

                        {timeFilterMode === 'month' && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1.5 border border-zinc-300 rounded-xl px-2.5 py-1 bg-white">
                                    <Calendar size={14} className="text-zinc-500" />
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="text-xs font-mono font-bold text-zinc-900 focus:outline-none bg-transparent cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={() => setSelectedMonth(getCurrentMonth())}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${selectedMonth === getCurrentMonth() ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'}`}
                                >
                                    เดือนนี้
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Active Period Tag */}
                    <div className="text-xs font-mono text-zinc-700 bg-zinc-100 px-3 py-1 rounded-xl border border-zinc-200">
                        {activePeriodLabel} • ยอดขายรวม: <strong className="text-zinc-950 font-bold">฿{periodStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                </div>

                {/* ROW 2: Data Source Switcher, Secondary Filters & Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    
                    {/* Left: Source Tabs & Detailed Filters */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Data Source Selector */}
                        <div className="flex bg-zinc-100 p-0.5 rounded-xl border border-zinc-200 text-xs font-mono">
                            <button
                                onClick={() => setDataSourceMode('pos_bills')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${dataSourceMode === 'pos_bills' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <Receipt size={13} />
                                <span>บิลขาย POS ({compiledPosBills.length})</span>
                            </button>
                            <button
                                onClick={() => setDataSourceMode('all')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${dataSourceMode === 'all' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <Layers size={13} />
                                <span>รวมทุกบิลขาย</span>
                            </button>
                            <button
                                onClick={() => setDataSourceMode('invoices')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${dataSourceMode === 'invoices' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <FileText size={13} />
                                <span>เอกสารภาษี ({invoices.filter(i => (i.issued_at || '').startsWith(timeFilterMode === 'day' ? selectedDate : (timeFilterMode === 'month' ? selectedMonth : ''))).length})</span>
                            </button>
                        </div>

                        {/* Payment Method Filter */}
                        <select
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            aria-label="Filter by Payment Method"
                            className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-medium focus:border-zinc-900 focus:outline-none cursor-pointer"
                        >
                            <option value="all">ทุกช่องทางชำระเงิน</option>
                            <option value="cash">เฉพาะ เงินสด (Cash)</option>
                            <option value="promptpay">เฉพาะ พร้อมเพย์ / โอน (PromptPay)</option>
                            <option value="credit_card">เฉพาะ บัตรเครดิต (Credit Card)</option>
                        </select>

                        {/* Channel Filter (Dine-in / Pickup) */}
                        <select
                            value={channelFilter}
                            onChange={(e) => setChannelFilter(e.target.value)}
                            aria-label="Filter by Channel"
                            className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-medium focus:border-zinc-900 focus:outline-none cursor-pointer"
                        >
                            <option value="all">ทุกรูปแบบ (Dine-in & Pickup)</option>
                            <option value="dine_in">ทานที่ร้าน (Dine-in / Tables)</option>
                            <option value="pickup">สั่งกลับบ้าน (Takeaway / Pickup)</option>
                        </select>

                        {/* Search */}
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="ค้นหาเลขบิล / ลูกค้า / โต๊ะ / เมนู..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 border border-zinc-300 rounded-xl text-xs font-mono w-44 sm:w-56 focus:border-zinc-900 focus:outline-none bg-white"
                            />
                        </div>
                    </div>

                    {/* Right: Export & Print Action Buttons */}
                    <div className="flex items-center gap-2 self-end lg:self-auto">
                        <button
                            onClick={handleExportCsv}
                            className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 border border-zinc-300 transition-colors cursor-pointer shadow-xs"
                        >
                            <FileSpreadsheet size={15} className="text-emerald-700" />
                            <span>Export Excel (.csv)</span>
                        </button>

                        <button
                            onClick={() => setShowPrintModal(true)}
                            className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
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
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        ยอดขายรวมทั้งสิ้น (Gross Sales)
                    </span>
                    <div className="font-mono font-black text-xl text-zinc-950 mt-1">
                        ฿{periodStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        {activePeriodLabel} ({periodStats.recordCount} รายการ)
                    </span>
                </div>

                {/* Card 2: Taxable Base */}
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        มูลค่าฐานภาษี (Taxable Base)
                    </span>
                    <div className="font-mono font-black text-xl text-zinc-950 mt-1">
                        ฿{periodStats.preVatSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        {isVatRegistered ? 'ยอดขายก่อนคิด VAT 7%' : 'ยอดขายสุทธิ (ยังไม่เข้าระบบ VAT)'}
                    </span>
                </div>

                {/* Card 3: Output VAT 7% */}
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        ภาษีขายที่ต้องนำส่ง (Output VAT 7%)
                    </span>
                    <div className={`font-mono font-black text-xl mt-1 ${isVatRegistered ? 'text-[oklch(52%_0.16_28)]' : 'text-zinc-400'}`}>
                        {isVatRegistered ? `฿${periodStats.outputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '฿0.00 (Non-VAT)'}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        {isVatRegistered ? 'สำหรับยื่นแบบ ภ.พ.30' : 'ยังไม่จด VAT ไม่ต้องนำส่งภาษีขาย'}
                    </span>
                </div>

                {/* Card 4: Report Classification */}
                <div className="bg-[#1A1A1A] text-white rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                            แบบแสดงรายการบัญชี
                        </span>
                        <div className="font-bold text-sm text-emerald-400 mt-1">
                            {isVatRegistered ? 'แบบ ภ.พ.30 (รายงานภาษีขาย)' : 'สมุดรายรับรายบิล (Sales Ledger)'}
                        </div>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                        โหมด: {dataSourceMode === 'invoices' ? 'เอกสารภาษี' : (dataSourceMode === 'pos_bills' ? 'บิลขายจริงจาก POS' : 'รวมทุกบิลขาย')}
                    </span>
                </div>
            </div>

            {/* Official Tabular Sales Tax & Real POS Bill Ledger */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-200 flex flex-wrap justify-between items-center bg-zinc-50/70 gap-2">
                    <div>
                        <h3 className="font-bold text-sm text-zinc-950 font-mono">
                            {isVatRegistered ? 'รายงานภาษีขาย (Sales Tax Report ภ.พ.30)' : 'สมุดรายงานยอดขายและรายรับรายบิล (Sales & POS Bill Ledger)'}
                        </h3>
                        <p className="text-[11px] text-zinc-500 font-mono">
                            {activePeriodLabel} • จำนวน {filteredRecords.length} รายการ (คลิกที่แถวเพื่อดูรายละเอียดบิล / ออกใบกำกับภาษี)
                        </p>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-600 bg-white border border-zinc-200 px-3 py-1 rounded-lg">
                        รวมทั้งสิ้น: <strong className="text-zinc-950">฿{periodStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-zinc-100/90 border-b border-zinc-300 font-mono text-[10px] uppercase text-zinc-700">
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
                        <tbody className="divide-y divide-zinc-200">
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
                                        className={`hover:bg-zinc-50/80 transition-colors cursor-pointer ${isCancelled ? 'bg-red-50/40 text-zinc-400' : ''}`}
                                        onClick={() => {
                                            if (item.source_type === 'tax_invoice' && onOpenInvoice) {
                                                onOpenInvoice(item);
                                            } else if (item.raw_booking) {
                                                setSelectedBillForDetail(item.raw_booking);
                                            }
                                        }}
                                    >
                                        <td className="p-3 text-center font-mono text-zinc-400">{idx + 1}</td>
                                        <td className="p-3 font-mono">
                                            <div>{dateStr}</div>
                                            {timeStr && <div className="text-[10px] text-zinc-400">{timeStr}</div>}
                                        </td>
                                        <td className="p-3 font-mono font-bold text-zinc-900">
                                            <div className="flex items-center gap-1.5">
                                                <span>{docNo}</span>
                                                {item.has_tax_invoice && (
                                                    <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-blue-100 text-blue-800">
                                                        TAX
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 font-mono text-xs">
                                            {item.table_name ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 font-bold border border-zinc-200">
                                                    <UtensilsCrossed size={11} className="text-zinc-500" /> โต๊ะ {item.table_name}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
                                                    <ShoppingBag size={11} className="text-amber-600" /> Pickup
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="font-semibold text-zinc-900">{item.customer_name || 'ลูกค้าทั่วไป'}</div>
                                            {item.items_summary && (
                                                <div className="text-[10px] text-zinc-500 font-mono truncate max-w-xs mt-0.5" title={item.items_summary}>
                                                    {item.items_summary}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            {renderPaymentBadge(item.payment_method)}
                                        </td>
                                        <td className="p-3 text-right font-mono font-semibold">
                                            {preVat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        {isVatRegistered && (
                                            <td className="p-3 text-right font-mono font-semibold text-[oklch(52%_0.16_28)]">
                                                {vat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        )}
                                        <td className="p-3 text-right font-mono font-bold text-zinc-950">
                                            {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1">
                                                {item.source_type === 'pos_bill' ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedBillForDetail(item.raw_booking)}
                                                            className="p-1 rounded hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
                                                            title="ดูรายละเอียดบิล"
                                                        >
                                                            <Eye size={14} />
                                                        </button>

                                                        {!item.has_tax_invoice && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedBookingForTaxModal(item.raw_booking)}
                                                                className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-mono text-[9.5px] font-bold border border-blue-200 transition-colors flex items-center gap-0.5 cursor-pointer"
                                                                title="ออกใบกำกับภาษีเต็มรูปจากบิลนี้"
                                                            >
                                                                <Plus size={10} />
                                                                <span>TAX</span>
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => setBillToDelete(item)}
                                                            className="p-1 rounded hover:bg-red-100 text-zinc-400 hover:text-red-600 transition-colors cursor-pointer ml-0.5"
                                                            title="ลบบิลและจัดเรียงเลขใหม่ (Auto-Resequence)"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-100 text-emerald-800">
                                                            ปกติ
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setBillToDelete(item)}
                                                            className="p-1 rounded hover:bg-red-100 text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
                                                            title="ลบเอกสารภาษีนี้และจัดเรียงเลขใหม่"
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
                                    <td colSpan={isVatRegistered ? 10 : 9} className="p-12 text-center text-zinc-400 font-mono">
                                        ไม่พบรายการบิลขายจากการขายหน้าร้าน POS หรือใบกำกับภาษีในช่วงเวลาที่เลือก
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {filteredRecords.length > 0 && (
                            <tfoot>
                                <tr className="bg-zinc-900 text-white font-mono font-bold text-xs">
                                    <td colSpan={6} className="p-3 text-right">
                                        รวมทั้งสิ้น (TOTAL):
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
                                    <td className="p-3 text-center text-[10px] text-zinc-400">
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
                    onInvoiceSaved={() => {
                        setSelectedBookingForTaxModal(null);
                        toast.success('ออกเอกสารใบกำกับภาษีเรียบร้อยแล้ว');
                    }}
                />
            )}

            {/* Delete Bill & Auto-Resequence Confirmation Modal */}
            {billToDelete && (
                <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-mono">
                    <div className="bg-white border border-[#D1D1CD] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 border-b border-zinc-200 pb-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                                <Trash2 size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-zinc-950 uppercase">
                                    ยืนยันการลบบิลขาย
                                </h3>
                                <p className="text-[11px] text-zinc-500">
                                    ลบบิลออกจากรายงานและจัดเรียงเลขบิลใหม่อัตโนมัติ
                                </p>
                            </div>
                        </div>

                        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-zinc-500">เลขที่บิล:</span>
                                <span className="font-bold text-zinc-900">{billToDelete.bill_number || billToDelete.invoice_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">ยอดเงินรวม:</span>
                                <span className="font-bold text-emerald-700">฿{Number(billToDelete.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">ลูกค้า / โต๊ะ:</span>
                                <span className="font-bold text-zinc-900">{billToDelete.customer_name} {billToDelete.table_name ? `(โต๊ะ ${billToDelete.table_name})` : ''}</span>
                            </div>
                        </div>

                        <div className="text-[11px] text-zinc-700 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed flex items-start gap-2">
                            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <strong>ระบบ Auto-Resequence:</strong> เมื่อลบบิลนี้แล้ว ระบบจะปรับสถานะบิลเป็น Void และจะทำการเรียงลำดับเลขที่บิล (BILL-YYYYMM-XXXX) ที่เหลือใหม่ทั้งหมดให้ต่อเนื่องกันทันทีโดยไม่มีช่องว่าง
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => setBillToDelete(null)}
                                className="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                            >
                                ยกเลิก (Cancel)
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={handleExecuteDeleteBill}
                                className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                <span>{deleting ? 'กำลังลบบิล...' : 'ยืนยันลบบิล'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
