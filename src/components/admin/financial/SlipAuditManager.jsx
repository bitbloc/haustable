/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Tabular Audit Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getThaiDate } from '../../../utils/timeUtils';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import ViewSlipModal from '../../shared/ViewSlipModal';
import {
    Receipt, Calendar, Filter, Search, Download, ExternalLink,
    CheckCircle2, AlertCircle, FileText, Image as ImageIcon,
    RefreshCw, Layers, CreditCard, DollarSign, Smartphone, QrCode
} from 'lucide-react';

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
    const [filterMode, setFilterMode] = useState(parentFilterMode || 'day'); // 'day', 'month', 'year'
    const [selectedDate, setSelectedDate] = useState(parentSelectedDate || getThaiDate());
    const [selectedMonth, setSelectedMonth] = useState(parentSelectedMonth || '2026-07');
    const [selectedYear, setSelectedYear] = useState(parentSelectedYear || '2026');
    const [slipFilter, setSlipFilter] = useState('all'); // 'all', 'slip_only', 'no_slip'
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [viewSlipUrl, setViewSlipUrl] = useState(null);
    const [exportingId, setExportingId] = useState(null);

    // Refs for image canvas capture
    const cardRefs = useRef({});

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
    }, [orders, slipFilter, searchQuery]);

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
                endIso = `${selectedMonth}-${lastDay}T23:59:59+07:00`;
            } else {
                startIso = `${selectedYear}-01-01T00:00:00+07:00`;
                endIso = `${selectedYear}-12-31T23:59:59+07:00`;
            }

            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    id,
                    tracking_token,
                    booking_time,
                    total_amount,
                    total_price,
                    discount_amount,
                    status,
                    pax,
                    number_of_guests,
                    booking_type,
                    payment_slip_url,
                    staff_remark,
                    customer_name,
                    pickup_contact_name,
                    pickup_contact_phone,
                    user_id,
                    profiles (
                        id,
                        display_name,
                        phone,
                        line_user_id
                    ),
                    tables_layout (
                        table_name
                    ),
                    order_items (
                        id,
                        quantity,
                        price_at_time,
                        special_instructions,
                        menu_items (
                            id,
                            name,
                            price,
                            menu_categories (
                                name
                            )
                        )
                    )
                `)
                .gte('booking_time', startIso)
                .lte('booking_time', endIso)
                .order('booking_time', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.error("Failed to fetch slip audit orders:", err);
            toast.error("ไม่สามารถดึงข้อมูลสลิปและออเดอร์ได้");
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let result = [...orders];

        // 1. Slip attachment filter
        if (slipFilter === 'slip_only') {
            result = result.filter(o => !!o.payment_slip_url);
        } else if (slipFilter === 'no_slip') {
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
                const itemsStr = (o.order_items || []).map(i => i.menu_items?.name || '').join(' ').toLowerCase();

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

    const getPaymentMethodBadge = (order) => {
        const remark = (order.staff_remark || '').toLowerCase();
        if (order.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน') || remark.includes('promptpay')) {
            return { label: 'PromptPay QR / โอนเงิน', class: 'bg-emerald-100 text-emerald-950 border-emerald-300' };
        }
        if (remark.includes('credit') || remark.includes('บัตรเครดิต')) {
            return { label: 'Credit / Debit Card', class: 'bg-indigo-100 text-indigo-950 border-indigo-300' };
        }
        if (remark.includes('wallet')) {
            return { label: 'Member Wallet', class: 'bg-rose-100 text-rose-950 border-rose-300' };
        }
        return { label: 'Cash (เงินสด)', class: 'bg-amber-100 text-amber-950 border-amber-300' };
    };

    const handleExportSlipAsImage = async (orderId, token) => {
        const element = cardRefs.current[orderId];
        if (!element) {
            toast.error("ไม่พบโหนดสำหรับการแปลงภาพ");
            return;
        }

        setExportingId(orderId);
        toast.info("กำลังประมวลผลการส่งออกภาพสลิป...");

        try {
            const canvas = await html2canvas(element, {
                useCORS: true,
                allowTaint: true,
                scale: 2,
                backgroundColor: '#FAFAFA',
                logging: false,
            });

            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const fileName = `slip_${token || orderId}_${selectedDate || 'audit'}.png`;
            link.href = image;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success(`ส่งออกภาพสลิปเรียบร้อยแล้ว (${fileName})`);
        } catch (err) {
            console.error("Export slip image error:", err);
            toast.error("เกิดข้อผิดพลาดในการบันทึกภาพสลิป");
        } finally {
            setExportingId(null);
        }
    };

    const formatThaiDateTime = (isoString) => {
        if (!isoString) return '-';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
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

    const ordersWithSlipsCount = orders.filter(o => !!o.payment_slip_url).length;
    const totalRevenueSum = filteredOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || o.total_price || 0), 0);

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
                                    ระบบตรวจสอบสลิป & รายการสั่งซื้อ (Slip Audit Workbench)
                                </h2>
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-[oklch(52%_0.16_28)] text-white font-bold uppercase tracking-wider">
                                    IMAGE EXPORT READY
                                </span>
                            </div>
                            <p className="text-xs font-mono font-bold text-[oklch(42%_0.010_28)] mt-0.5">
                                ดูหลักฐานสลิป รายการอาหาร เครื่องดื่ม พร้อมส่งออกเป็นภาพ QR Code // {getTimeRangeTitle()}
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

                {/* Slip Filter Category Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                        <button
                            onClick={() => setSlipFilter('all')}
                            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                                slipFilter === 'all' ? 'bg-[oklch(18%_0.012_28)] text-white font-black' : 'text-[oklch(42%_0.010_28)] hover:bg-gray-50'
                            }`}
                        >
                            ทั้งหมด ({orders.length})
                        </button>
                        <button
                            onClick={() => setSlipFilter('slip_only')}
                            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1 ${
                                slipFilter === 'slip_only' ? 'bg-emerald-800 text-white font-black' : 'text-emerald-800 hover:bg-emerald-50'
                            }`}
                        >
                            <ImageIcon size={14} />
                            <span>เฉพาะมีสลิป ({ordersWithSlipsCount})</span>
                        </button>
                        <button
                            onClick={() => setSlipFilter('no_slip')}
                            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                                slipFilter === 'no_slip' ? 'bg-[oklch(18%_0.012_28)] text-white font-black' : 'text-[oklch(42%_0.010_28)] hover:bg-gray-50'
                            }`}
                        >
                            ไม่มีสลิป ({orders.length - ordersWithSlipsCount})
                        </button>
                    </div>

                    <div className="font-mono text-xs font-black text-[oklch(18%_0.012_28)] bg-white px-3 py-2 rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                        ยอดขายรวมผลลัพธ์: <span className="text-[oklch(52%_0.16_28)] text-sm">฿{totalRevenueSum.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Content Viewport */}
            {loading ? (
                <div className="py-20 text-center font-mono text-xs text-[oklch(55%_0.010_28)] uppercase tracking-widest flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-[oklch(85%_0.012_28)] border-t-[oklch(18%_0.012_28)] animate-spin" />
                    <span>กำลังโหลดสลิปและรายการสั่งซื้อ...</span>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="p-10 bg-white border-2 border-dashed border-[oklch(85%_0.012_28)] rounded-2xl text-center space-y-3">
                    <AlertCircle size={32} className="mx-auto text-[oklch(55%_0.010_28)]" />
                    <div className="font-sans font-bold text-base text-[oklch(18%_0.012_28)]">
                        ไม่พบรายการสลิปชำระเงินตามเงื่อนไข
                    </div>
                    <p className="font-mono text-xs text-[oklch(42%_0.010_28)]">
                        ลองเปลี่ยนตัวกรอง วัน/เดือน/ปี หรือค้นหาด้วยคีย์เวิร์ดอื่น
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredOrders.map((order) => {
                        const payBadge = getPaymentMethodBadge(order);
                        const fullSlipUrl = getFullSlipUrl(order.payment_slip_url);
                        const items = order.order_items || [];
                        const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.price_at_time || i.menu_items?.price || 0) * (i.quantity || 1)), 0);
                        const discount = parseFloat(order.discount_amount || 0);
                        const netTotal = parseFloat(order.total_amount || order.total_price || subtotal);
                        const paxCount = order.pax || order.number_of_guests || 1;
                        const guestName = order.profiles?.display_name || order.pickup_contact_name || order.customer_name || 'ลูกค้าทั่วไป';
                        const phone = order.profiles?.phone || order.pickup_contact_phone || '-';
                        const tableName = order.tables_layout?.table_name || (order.booking_type === 'pickup' ? 'PICKUP' : 'โต๊ะทั่วไป');
                        const qrValue = `${window.location.origin}/t/${order.tracking_token || order.id}`;

                        return (
                            <div 
                                key={order.id}
                                ref={(el) => (cardRefs.current[order.id] = el)}
                                className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-5 space-y-4 shadow-sm hover:border-[oklch(52%_0.16_28)] transition-all flex flex-col justify-between"
                            >
                                <div className="space-y-4">
                                    {/* Top Metadata Header */}
                                    <div className="flex items-start justify-between gap-3 border-b-2 border-[oklch(85%_0.012_28)] pb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-base font-black text-[oklch(18%_0.012_28)]">
                                                    ORDER #{order.id}
                                                </span>
                                                {order.tracking_token && (
                                                    <span className="font-mono text-[10px] bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] px-2 py-0.5 rounded font-black border border-[oklch(85%_0.012_28)]">
                                                        REF: {order.tracking_token}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-mono text-xs text-[oklch(42%_0.010_28)] font-bold mt-1">
                                                {formatThaiDateTime(order.booking_time)}
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <span className={`inline-block px-2.5 py-1 rounded-lg font-mono text-xs font-black border ${payBadge.class}`}>
                                                {payBadge.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Table & Guest Details Grid */}
                                    <div className="grid grid-cols-2 gap-2 font-mono text-xs bg-[oklch(97%_0.008_28)] p-3 rounded-xl border border-[oklch(85%_0.012_28)]">
                                        <div>
                                            <span className="text-[oklch(55%_0.010_28)] font-bold block">โต๊ะ / ช่องทาง:</span>
                                            <strong className="text-[oklch(18%_0.012_28)] text-sm font-black">{tableName} ({paxCount} ท่าน)</strong>
                                        </div>
                                        <div>
                                            <span className="text-[oklch(55%_0.010_28)] font-bold block">ชื่อลูกค้า / โทร:</span>
                                            <strong className="text-[oklch(18%_0.012_28)] font-black truncate block">{guestName} ({phone})</strong>
                                        </div>
                                    </div>

                                    {/* Order Items Table */}
                                    <div className="space-y-1">
                                        <div className="font-mono text-[11px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider flex justify-between px-1">
                                            <span>รายการอาหาร & เครื่องดื่ม ({items.length})</span>
                                            <span>จำนวน x ราคา</span>
                                        </div>
                                        <div className="border-2 border-[oklch(85%_0.012_28)] rounded-xl overflow-hidden divide-y divide-[oklch(85%_0.012_28)] bg-white">
                                            {items.length === 0 ? (
                                                <div className="p-3 text-center font-mono text-xs text-[oklch(55%_0.010_28)]">
                                                    ไม่มีรายละเอียดรายการสินค้า
                                                </div>
                                            ) : (
                                                items.map((item, idx) => {
                                                    const price = parseFloat(item.price_at_time || item.menu_items?.price || 0);
                                                    const qty = item.quantity || 1;
                                                    const total = price * qty;
                                                    return (
                                                        <div key={idx} className="p-2.5 flex items-center justify-between text-xs font-mono">
                                                            <div className="space-y-0.5">
                                                                <span className="font-black text-[oklch(18%_0.012_28)] block">
                                                                    {item.menu_items?.name || 'เมนูทั่วไป'}
                                                                </span>
                                                                {item.special_instructions && (
                                                                    <span className="text-[10px] text-[oklch(52%_0.16_28)] font-bold block">
                                                                        * {item.special_instructions}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <span className="text-[oklch(55%_0.010_28)] font-bold mr-2">
                                                                    {qty} x ฿{price.toLocaleString()}
                                                                </span>
                                                                <strong className="font-black text-[oklch(18%_0.012_28)]">
                                                                    ฿{total.toLocaleString()}
                                                                </strong>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Financial Breakdown */}
                                    <div className="space-y-1.5 pt-1 border-t border-dashed border-[oklch(85%_0.012_28)] font-mono text-xs">
                                        {discount > 0 && (
                                            <div className="flex justify-between text-[oklch(52%_0.16_28)] font-bold">
                                                <span>ส่วนลด (Discount):</span>
                                                <span>-฿{discount.toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-sm pt-1">
                                            <span className="font-black text-[oklch(18%_0.012_28)]">ยอดรวมสุทธิ (NET TOTAL):</span>
                                            <span className="font-mono text-lg font-black text-[oklch(52%_0.16_28)]">
                                                ฿{netTotal.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Payment Slip Image Attachment & Verification QR Code Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t-2 border-[oklch(85%_0.012_28)]">
                                        {/* Payment Slip Thumbnail */}
                                        <div className="bg-[oklch(97%_0.008_28)] p-3 rounded-xl border border-[oklch(85%_0.012_28)] flex flex-col justify-between gap-2">
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-[11px] font-black text-[oklch(18%_0.012_28)] flex items-center gap-1">
                                                    <ImageIcon size={14} className="text-[oklch(52%_0.16_28)]" />
                                                    สลิปหลักฐานโอนเงิน
                                                </span>
                                            </div>

                                            {order.payment_slip_url ? (
                                                <div className="space-y-2">
                                                    <div 
                                                        onClick={() => setViewSlipUrl(order.payment_slip_url)}
                                                        className="relative group cursor-pointer overflow-hidden rounded-lg border border-[oklch(85%_0.012_28)] bg-black h-28 flex items-center justify-center"
                                                    >
                                                        <img 
                                                            src={fullSlipUrl}
                                                            alt="Payment Slip" 
                                                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center text-white font-mono text-[10px] font-bold gap-1">
                                                            <ExternalLink size={12} />
                                                            <span>คลิกดูขนาดเต็ม</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-28 rounded-lg border border-dashed border-[oklch(85%_0.012_28)] bg-white flex flex-col items-center justify-center p-3 text-center">
                                                    <AlertCircle size={20} className="text-[oklch(55%_0.010_28)] mb-1" />
                                                    <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)]">
                                                        ไม่มีสลิปแนบ (เงินสด/บัตร)
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* QR Code Verification */}
                                        <div className="bg-[oklch(97%_0.008_28)] p-3 rounded-xl border border-[oklch(85%_0.012_28)] flex flex-col items-center justify-center text-center space-y-2">
                                            <span className="font-mono text-[11px] font-black text-[oklch(18%_0.012_28)] flex items-center gap-1">
                                                <QrCode size={14} className="text-[oklch(52%_0.16_28)]" />
                                                QR ตรวจสอบบิล & สลิป
                                            </span>
                                            <div className="p-2 bg-white rounded-lg border border-[oklch(85%_0.012_28)] shadow-sm">
                                                <QRCodeSVG 
                                                    value={qrValue}
                                                    size={84}
                                                    bgColor="#FFFFFF"
                                                    fgColor="#181815"
                                                    level="M"
                                                />
                                            </div>
                                            <span className="font-mono text-[9px] text-[oklch(55%_0.010_28)] font-bold">
                                                SCAN TO VERIFY RECEIPT
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Export Slip as PNG Image Action Button */}
                                <div className="pt-3 border-t-2 border-[oklch(85%_0.012_28)]">
                                    <button
                                        onClick={() => handleExportSlipAsImage(order.id, order.tracking_token)}
                                        disabled={exportingId === order.id}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(52%_0.16_28)] text-white font-mono text-xs font-black rounded-xl transition-all shadow-sm active:scale-[0.99] min-h-[42px]"
                                    >
                                        <Download size={16} />
                                        <span>
                                            {exportingId === order.id ? 'กำลังบันทึกภาพ...' : 'ส่งออกเป็นภาพสลิป (EXPORT SLIP IMAGE)'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
