/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, 
    Search, 
    Receipt, 
    Calendar, 
    Check, 
    Loader2, 
    RotateCcw, 
    CreditCard, 
    QrCode, 
    Banknote,
    FileCheck2,
    ArrowRight,
    Utensils,
    User
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { getShortBookingId } from '../../../utils/printerHelper';

export default function ReceiptPickerModal({ 
    onSelectReceipt, 
    onClose,
    currentSelectedId = null
}) {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'yesterday' | '7days' | 'month' | 'all'
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'not_invoiced'

    useEffect(() => {
        fetchBookings();
    }, [dateFilter]);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('bookings')
                .select(`
                    id,
                    created_at,
                    booking_time,
                    total_amount,
                    discount_amount,
                    xhaus_discount,
                    status,
                    booking_type,
                    staff_remark,
                    payment_slip_url,
                    pickup_contact_name,
                    pickup_contact_phone,
                    customer_note,
                    pax,
                    tables_layout (
                        id,
                        table_name
                    ),
                    profiles (
                        id,
                        display_name,
                        nickname,
                        phone_number,
                        current_tier
                    ),
                    order_items (
                        id,
                        quantity,
                        price_at_time,
                        selected_options,
                        custom_name,
                        menu_items (
                            id,
                            name,
                            price,
                            category_id
                        )
                    ),
                    tax_invoices (
                        id,
                        invoice_number,
                        doc_type,
                        status
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(80);

            const now = new Date();
            if (dateFilter === 'today') {
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                query = query.gte('created_at', startOfDay.toISOString());
            } else if (dateFilter === 'yesterday') {
                const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
                const endYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
                query = query.gte('created_at', startYesterday.toISOString()).lte('created_at', endYesterday.toISOString());
            } else if (dateFilter === '7days') {
                const past7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
                query = query.gte('created_at', past7Days.toISOString());
            } else if (dateFilter === 'month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                query = query.gte('created_at', startOfMonth.toISOString());
            }

            const { data, error } = await query;
            if (!error && data) {
                setBookings(data);
            } else {
                // Fallback to local cached bookings
                const local = localStorage.getItem('pos_cache_active_bookings');
                if (local) setBookings(JSON.parse(local));
            }
        } catch (err) {
            console.error('Error fetching bookings for tax picker:', err);
            const local = localStorage.getItem('pos_cache_active_bookings');
            if (local) setBookings(JSON.parse(local));
        } finally {
            setLoading(false);
        }
    };

    const detectPaymentMethod = (b) => {
        if (!b) return { label: 'CASH', icon: Banknote };
        const remark = (b.staff_remark || '').toLowerCase();
        const explicitMethod = (b.payment_method || '').toLowerCase();

        // 1. Explicit Cash Check (Must take highest priority over QR-order prefixes and reservation slips)
        if (remark.includes('paid by cash') || remark.includes('[cash:') || remark.includes('เงินสด') || remark.includes('ชำระเงินสด') || explicitMethod === 'cash') {
            return { label: 'CASH', icon: Banknote };
        }

        // 2. Explicit Credit Card Check
        if (remark.includes('paid by credit') || remark.includes('[credit:') || remark.includes('paid by card') || remark.includes('บัตรเครดิต') || remark.includes('credit') || explicitMethod === 'credit' || explicitMethod === 'credit_card') {
            return { label: 'CREDIT', icon: CreditCard };
        }

        // 3. QR / PromptPay / Bank Transfer Check
        if (remark.includes('paid by qr') || remark.includes('paid by transfer') || remark.includes('[qr:') || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน') || remark.includes('promptpay') || remark.includes('สแกนจ่าย') || explicitMethod === 'qr' || explicitMethod === 'promptpay' || explicitMethod === 'transfer') {
            return { label: 'QR', icon: QrCode };
        }

        // 4. Online Deposit / Slip
        if (b.payment_slip_url) {
            return { label: 'QR', icon: QrCode };
        }
        return { label: 'CASH', icon: Banknote };
    };

    const formatThaiDateTime = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    // Filter Logic
    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            // Status check
            const isCompletedOrConfirmed = b.status === 'completed' || b.status === 'confirmed' || b.status === 'paid' || !b.status;
            if (statusFilter === 'completed' && !isCompletedOrConfirmed) return false;
            
            const activeTaxInvoice = (b.tax_invoices || []).find(inv => inv.status !== 'cancelled');
            if (statusFilter === 'not_invoiced' && activeTaxInvoice) return false;

            // Search query check
            const q = searchQuery.toLowerCase().trim();
            if (!q) return true;

            const shortId = getShortBookingId(b).toLowerCase();
            const fullId = (b.id || '').toLowerCase();
            const tableName = (b.tables_layout?.table_name || '').toLowerCase();
            const customerName = (b.pickup_contact_name || b.guest_name || b.profiles?.display_name || '').toLowerCase();
            const phone = (b.pickup_contact_phone || b.phone_number || b.profiles?.phone_number || '').toLowerCase();
            const totalStr = String(b.total_amount || '');

            const itemsStr = (b.order_items || [])
                .map(item => {
                    const menuItem = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
                    return (item.custom_name || item.item_name || menuItem?.name || '').toLowerCase();
                })
                .join(' ');

            return shortId.includes(q) || 
                   fullId.includes(q) || 
                   tableName.includes(q) || 
                   customerName.includes(q) || 
                   phone.includes(q) || 
                   totalStr.includes(q) || 
                   itemsStr.includes(q);
        });
    }, [bookings, searchQuery, statusFilter]);

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto font-sans">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-none shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-[var(--color-ink)]">
                
                {/* Header: Dieter Rams Brutalist Grid */}
                <div className="bg-[var(--color-ink)] text-[var(--color-paper)] px-4 py-3 sm:px-6 flex items-center justify-between border-b border-[var(--color-rule)] shrink-0 font-mono">
                    <div className="flex items-center gap-3">
                        <div className="text-xs font-bold px-2 py-0.5 bg-[var(--color-accent)] text-white">
                            POS//RECEIPTS
                        </div>
                        <div>
                            <h2 className="font-bold text-sm sm:text-base tracking-wider uppercase">
                                SELECT RECEIPT / POS BILL (เลือกจากใบเสร็จ)
                            </h2>
                            <p className="text-[10px] text-[var(--color-paper)]/70">
                                [เลือกบิลเพื่อดึงรายการสินค้า ยอดชำระ และข้อมูลลูกค้าเข้าสู่ใบกำกับภาษีทันที]
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1 text-[var(--color-paper)]/70 hover:text-white transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Filter & Search Bar */}
                <div className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] p-3 sm:p-4 space-y-3 shrink-0 font-mono text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[240px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                            <input
                                type="text"
                                placeholder="ค้นหา #คิว, โต๊ะ, ชื่อลูกค้า, เบอร์โทร, รายการสินค้า..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-xs text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none"
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Reload Button */}
                        <button
                            onClick={fetchBookings}
                            disabled={loading}
                            className="px-3 py-2 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] disabled:opacity-50"
                        >
                            <RotateCcw size={12} className={loading ? 'animate-spin' : ''} />
                            <span>RELOAD</span>
                        </button>
                    </div>

                    {/* Quick Filters */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--color-rule)]/60">
                        {/* Date Filter Tabs */}
                        <div className="flex items-center border border-[var(--color-rule)] bg-[var(--color-paper)]">
                            <button
                                onClick={() => setDateFilter('today')}
                                className={`px-2.5 py-1 text-[11px] transition-colors ${dateFilter === 'today' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                            >
                                วันนี้ (Today)
                            </button>
                            <button
                                onClick={() => setDateFilter('yesterday')}
                                className={`px-2.5 py-1 text-[11px] transition-colors border-l border-[var(--color-rule)] ${dateFilter === 'yesterday' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                            >
                                เมื่อวาน
                            </button>
                            <button
                                onClick={() => setDateFilter('7days')}
                                className={`px-2.5 py-1 text-[11px] transition-colors border-l border-[var(--color-rule)] ${dateFilter === '7days' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                            >
                                7 วันล่าสุด
                            </button>
                            <button
                                onClick={() => setDateFilter('month')}
                                className={`px-2.5 py-1 text-[11px] transition-colors border-l border-[var(--color-rule)] ${dateFilter === 'month' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                            >
                                เดือนนี้
                            </button>
                            <button
                                onClick={() => setDateFilter('all')}
                                className={`px-2.5 py-1 text-[11px] transition-colors border-l border-[var(--color-rule)] ${dateFilter === 'all' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                            >
                                ทั้งหมด
                            </button>
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-neutral)]">
                            <span>สถานะ:</span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-2 py-1 bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] font-bold focus:outline-none"
                            >
                                <option value="all">ทั้งหมด ({bookings.length})</option>
                                <option value="not_invoiced">ยังไม่ออกใบกำกับภาษี</option>
                                <option value="completed">เฉพาะบิลที่ชำระแล้ว</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Body Content: Scrollable Receipts List */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-[var(--color-paper)]">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-2 text-[var(--color-neutral)] font-mono text-xs">
                            <Loader2 size={24} className="animate-spin text-[var(--color-accent)]" />
                            <span>กำลังโหลดรายการบิลและใบเสร็จ POS...</span>
                        </div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="py-16 border border-dashed border-[var(--color-rule)] text-center p-6 space-y-2">
                            <Receipt size={32} className="mx-auto text-[var(--color-muted)]" />
                            <div className="font-mono font-bold text-xs text-[var(--color-ink)]">
                                ไม่พบบิลหรือใบเสร็จตามเงื่อนไขที่เลือก
                            </div>
                            <p className="text-[11px] text-[var(--color-neutral)] font-mono">
                                ลองเปลี่ยนช่วงเวลา หรือล้างคำค้นหาเพื่อแสดงรายการทั้งหมด
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--color-rule)] border border-[var(--color-rule)] bg-white">
                            {filteredBookings.map((booking) => {
                                const shortId = getShortBookingId(booking);
                                const tableName = booking.tables_layout?.table_name || (booking.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN');
                                const customerName = booking.pickup_contact_name || booking.guest_name || booking.profiles?.display_name || '';
                                const customerPhone = booking.pickup_contact_phone || booking.phone_number || booking.profiles?.phone_number || '';
                                const itemsCount = (booking.order_items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
                                const payMethod = detectPaymentMethod(booking);
                                const PayIcon = payMethod.icon;
                                const isSelected = currentSelectedId && (currentSelectedId === booking.id || currentSelectedId === shortId);
                                
                                const activeInvoices = (booking.tax_invoices || []).filter(inv => inv.status !== 'cancelled');
                                const hasInvoice = activeInvoices.length > 0;

                                // Build preview text of first 3 items
                                const itemsPreview = (booking.order_items || [])
                                    .slice(0, 3)
                                    .map(item => {
                                        const menuItem = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
                                        const name = item.custom_name || item.item_name || menuItem?.name || 'รายการสินค้า';
                                        return `${name} x${item.quantity || 1}`;
                                    })
                                    .join(', ');
                                const remainingItemsCount = Math.max(0, (booking.order_items || []).length - 3);

                                return (
                                    <div
                                        key={booking.id}
                                        onClick={() => onSelectReceipt(booking)}
                                        className={`p-3 sm:p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group ${
                                            isSelected 
                                                ? 'bg-[var(--color-paper-2)] border-l-4 border-l-[var(--color-accent)]' 
                                                : 'hover:bg-[var(--color-paper-2)]'
                                        }`}
                                    >
                                        {/* Left Side: Metadata & Items */}
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                                                {/* Short Bill ID Badge */}
                                                <span className="px-2 py-0.5 bg-[var(--color-ink)] text-[var(--color-paper)] font-bold text-[11px] tracking-wider">
                                                    #{shortId}
                                                </span>

                                                {/* Table Badge */}
                                                <span className="px-2 py-0.5 bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] font-bold text-[11px]">
                                                    โต๊ะ {tableName}
                                                </span>

                                                {/* Date & Time */}
                                                <span className="text-[11px] text-[var(--color-neutral)] flex items-center gap-1">
                                                    <Calendar size={11} />
                                                    {formatThaiDateTime(booking.booking_time || booking.created_at)}
                                                </span>

                                                {/* Payment Method Badge */}
                                                <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-200 text-[10px] flex items-center gap-1 font-bold">
                                                    <PayIcon size={10} />
                                                    {payMethod.label}
                                                </span>

                                                {/* Invoice Status Badge if already issued */}
                                                {hasInvoice && (
                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold flex items-center gap-1">
                                                        <FileCheck2 size={11} />
                                                        ออกแล้ว ({activeInvoices[0].invoice_number})
                                                    </span>
                                                )}
                                            </div>

                                            {/* Customer Name / Phone */}
                                            {customerName && (
                                                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
                                                    <User size={12} className="text-[var(--color-neutral)] shrink-0" />
                                                    <span>{customerName}</span>
                                                    {customerPhone && (
                                                        <span className="font-mono text-[11px] text-[var(--color-neutral)]">
                                                            ({customerPhone})
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Line Items Summary */}
                                            <div className="text-[11px] text-[var(--color-neutral)] line-clamp-1 flex items-center gap-1.5 font-mono">
                                                <Utensils size={11} className="shrink-0 text-[var(--color-muted)]" />
                                                <span>
                                                    {itemsPreview || 'ไม่มีรายการสินค้า'}
                                                    {remainingItemsCount > 0 && ` (+${remainingItemsCount} รายการ)`}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Right Side: Total Amount & CTA */}
                                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--color-rule)]">
                                            <div className="text-left sm:text-right font-mono">
                                                <span className="text-[10px] text-[var(--color-neutral)] block uppercase">
                                                    ยอดรวมสุทธิ ({itemsCount} ชิ้น)
                                                </span>
                                                <span className="text-sm sm:text-base font-bold text-[var(--color-ink)] block">
                                                    ฿{Number(booking.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectReceipt(booking);
                                                }}
                                                className={`px-3.5 py-2 font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                                    isSelected 
                                                        ? 'bg-[var(--color-accent)] text-white' 
                                                        : 'bg-[var(--color-ink)] text-[var(--color-paper)] group-hover:bg-black'
                                                }`}
                                            >
                                                {isSelected ? (
                                                    <>
                                                        <Check size={13} />
                                                        <span>เลือกแล้ว</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>เลือกบิลนี้</span>
                                                        <ArrowRight size={13} />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Toolbar */}
                <div className="p-3 sm:p-4 bg-[var(--color-paper-2)] border-t border-[var(--color-rule)] flex items-center justify-between shrink-0 font-mono text-xs">
                    <span className="text-[11px] text-[var(--color-neutral)]">
                        แสดงทั้งหมด {filteredBookings.length} บิล
                    </span>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 border border-[var(--color-rule)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] font-bold transition-colors cursor-pointer"
                    >
                        ปิดหน้าต่าง (CLOSE)
                    </button>
                </div>
            </div>
        </div>
    );
}
