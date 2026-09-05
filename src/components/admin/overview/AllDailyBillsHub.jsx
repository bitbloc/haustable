/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo, useEffect } from 'react'
import { 
    Search, 
    Filter, 
    Printer, 
    ChefHat, 
    Wine, 
    FileText, 
    Image as ImageIcon, 
    ChevronDown, 
    ChevronUp, 
    CheckCircle2, 
    Clock, 
    Users, 
    CreditCard, 
    QrCode, 
    Banknote, 
    AlertCircle, 
    Receipt, 
    ArrowUpRight, 
    Layers,
    Utensils,
    ShoppingBag,
    X,
    ExternalLink,
    Timer,
    LayoutGrid,
    Columns,
    List
} from 'lucide-react'
import { formatThaiTimeOnly, getThaiDate, calculateDurationMinutes, formatThaiDuration, formatShortDuration } from '../../../utils/timeUtils'
import { getShortBookingId } from '../../../utils/printerHelper'
import { getBookingPaymentBreakdown } from '../../../pos/POSReportsPanel'
import { formatOrderItemOptions } from '../../../utils/menuHelper'
import { parseTableTransferInfo } from '../../../utils/tableTransferHelper'
import { supabase } from '../../../lib/supabaseClient'
import { toast } from 'sonner'

// Real-time Service Duration Badge Component
function LiveServiceDurationBadge({ booking }) {
    const [now, setNow] = useState(Date.now())
    const status = (booking?.status || '').toLowerCase()
    const isSeated = status === 'seated' || status === 'ready'
    const isCompleted = status === 'completed' || status === 'paid' || status === 'success'
    const isPending = status === 'pending'

    useEffect(() => {
        if (!isSeated && !isPending) return
        const interval = setInterval(() => {
            setNow(Date.now())
        }, 10000) // Update every 10 seconds for real-time live ticking
        return () => clearInterval(interval)
    }, [isSeated, isPending])

    const startTime = booking?.booking_time || booking?.created_at
    if (!startTime) return null

    if (isSeated) {
        const start = new Date(startTime).getTime()
        const elapsedMins = Math.max(0, Math.floor((now - start) / (1000 * 60)))
        const formatted = formatThaiDuration(elapsedMins)

        let colorClasses = 'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] font-bold'
        let dotColor = 'bg-[oklch(45%_0.08_140)]'

        if (elapsedMins >= 90) {
            colorClasses = 'bg-[oklch(96%_0.03_28)] text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)] font-bold'
            dotColor = 'bg-[oklch(52%_0.16_28)]'
        } else if (elapsedMins >= 60) {
            colorClasses = 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
            dotColor = 'bg-amber-500'
        }

        return (
            <span 
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm font-mono text-[10px] border ${colorClasses}`}
                title={`เริ่มใช้บริการ: ${formatThaiTimeOnly(startTime)} (${elapsedMins} นาทีที่แล้ว)`}
            >
                <span className="relative flex h-1.5 w-1.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`}></span>
                </span>
                <span>ทานไปแล้ว {formatted}</span>
            </span>
        )
    }

    if (isCompleted) {
        const endTime = booking?.end_time || booking?.updated_at
        const start = new Date(startTime).getTime()
        const end = endTime ? new Date(endTime).getTime() : start
        const totalMins = Math.max(0, Math.floor((end - start) / (1000 * 60)))

        if (totalMins <= 0) return null

        return (
            <span 
                className="inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[10px] font-bold bg-[oklch(95%_0.008_28)] text-[oklch(42%_0.010_28)] border border-[oklch(88%_0.010_28)]"
                title={`เริ่ม: ${formatThaiTimeOnly(startTime)} • ปิดบิล: ${formatThaiTimeOnly(endTime)}`}
            >
                <span>ใช้บริการ {formatThaiDuration(totalMins)}</span>
            </span>
        )
    }

    if (isPending) {
        const start = new Date(startTime).getTime()
        const waitMins = Math.max(0, Math.floor((now - start) / (1000 * 60)))
        if (waitMins <= 0) return null

        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm font-mono text-[10px] bg-amber-50 text-amber-900 border border-amber-300 font-bold">
                <span>รอตรวจ {waitMins}น.</span>
            </span>
        )
    }

    return null
}

export default function AllDailyBillsHub({ 
    bookings = [], 
    loading = false, 
    onPrintSlip, 
    onViewSlip, 
    onOpenTaxInvoice, 
    onUpdateStatus,
    selectedDate = getThaiDate()
}) {
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all') // all, completed, seated, pending, confirmed, cancelled
    const [paymentFilter, setPaymentFilter] = useState('all') // all, cash, qr, credit, split
    const [channelFilter, setChannelFilter] = useState('all') // all, dine_in, pickup
    const [expandedBillIds, setExpandedBillIds] = useState(new Set())
    const [dismissedCallBillIds, setDismissedCallBillIds] = useState(new Set())

    const handleDismissCallBill = async (booking) => {
        if (!booking?.id) return
        try {
            const cleanRemark = (booking.staff_remark || '')
                .replace(/\[CALL_BILL\]/gi, '')
                .replace(/\[CALL_STAFF\]/gi, '')
                .trim()
            const { error } = await supabase
                .from('bookings')
                .update({ staff_remark: cleanRemark || null })
                .eq('id', booking.id)
            if (error) throw error
            booking.staff_remark = cleanRemark
            setDismissedCallBillIds(prev => new Set(prev).add(booking.id))
            toast.success('เคลียร์สถานะเรียกเช็คบิลเรียบร้อยแล้ว')
        } catch (err) {
            console.error('Failed to dismiss call bill:', err)
            toast.error('ไม่สามารถเคลียร์แจ้งเตือนได้: ' + err.message)
        }
    }

    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('onhaus_bills_view_mode') || 'grid'
        } catch (e) {
            return 'grid'
        }
    })

    const handleViewModeChange = (mode) => {
        setViewMode(mode)
        try {
            localStorage.setItem('onhaus_bills_view_mode', mode)
        } catch (e) {}
    }

    // Toggle expand/collapse for a specific bill
    const toggleExpand = (id) => {
        setExpandedBillIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const expandAll = () => {
        setExpandedBillIds(new Set(filteredBookings.map(b => b.id)))
    }

    const collapseAll = () => {
        setExpandedBillIds(new Set())
    }

    // Filter & Priority Search Logic
    const filteredBookings = useMemo(() => {
        return (bookings || []).filter(b => {
            // Exclude internal floor blocks / maintenance holds that are not customer orders
            const isInternalBlock = (b.customer_note === 'Internal Block' || b.customer_note === 'Maintenance Block') && 
                                    (!b.order_items || b.order_items.length === 0) && 
                                    parseFloat(b.total_amount || b.total_price || 0) === 0
            if (isInternalBlock) return false

            const transfer = parseTableTransferInfo(b)

            // 1. Status Filter
            if (statusFilter === 'completed' && !(b.status === 'completed' || b.status === 'paid' || b.status === 'success')) return false
            if (statusFilter === 'seated' && b.status !== 'seated') return false
            if (statusFilter === 'pending' && b.status !== 'pending') return false
            if (statusFilter === 'confirmed' && b.status !== 'confirmed') return false
            if (statusFilter === 'merged' && !transfer.isMergedSource) return false
            if (statusFilter === 'cancelled' && (!(b.status === 'cancelled' || b.status === 'void') || transfer.isMergedSource)) return false

            // 2. Channel Filter
            const bType = (b.booking_type || 'dine_in').toLowerCase()
            if (channelFilter === 'dine_in' && !(bType === 'dine_in' || bType === 'walk_in')) return false

            if (channelFilter === 'pickup' && !(bType.includes('pickup') || bType.includes('takeaway'))) return false

            // 3. Payment Filter
            if (paymentFilter !== 'all') {
                if (transfer.isMergedSource) return false
                const breakdown = getBookingPaymentBreakdown(b)
                if (paymentFilter === 'cash' && breakdown.cash <= 0) return false
                if (paymentFilter === 'qr' && breakdown.qr <= 0) return false
                if (paymentFilter === 'credit' && breakdown.credit <= 0) return false
                if (paymentFilter === 'split' && !breakdown.isSplit) return false
            }

            // 4. Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const shortId = getShortBookingId(b).toLowerCase()
                const rawId = String(b.id || '').toLowerCase()
                const tableName = (b.tables_layout?.table_name || '').toLowerCase()
                const guestName = (b.profiles?.display_name || b.pickup_contact_name || b.customer_name || '').toLowerCase()
                const phone = (b.profiles?.phone_number || b.pickup_contact_phone || '').toLowerCase()
                const remark = (b.staff_remark || '').toLowerCase()
                const note = (b.customer_note || '').toLowerCase()
                const token = (b.tracking_token || '').toLowerCase()
                
                // Match menu item names
                const matchItem = (b.order_items || []).some(item => 
                    (item.menu_items?.name || '').toLowerCase().includes(q)
                )

                return shortId.includes(q) || rawId.includes(q) || tableName.includes(q) || 
                       guestName.includes(q) || phone.includes(q) || remark.includes(q) || 
                       note.includes(q) || token.includes(q) || matchItem
            }

            return true
        }).sort((a, b) => {
            // Priority Order:
            // 1. Seated (กำลังทาน - highest operational attention)
            // 2. Pending (รอตรวจ - new unverified orders / slips)
            // 3. Confirmed / Ready (ยืนยัน/พร้อมส่ง)
            // 4. Completed / Paid (ชำระแล้ว)
            // 5. Cancelled / Merged (ยกเลิก/รวมโต๊ะ)
            const getPriorityRank = (item) => {
                const tr = parseTableTransferInfo(item)
                if (tr.isMergedSource) return 6
                const st = (item.status || '').toLowerCase()
                if (st === 'seated') return 1
                if (st === 'pending') return 2
                if (st === 'confirmed' || st === 'ready') return 3
                if (st === 'completed' || st === 'paid' || st === 'success') return 4
                return 5
            }
            const rankA = getPriorityRank(a)
            const rankB = getPriorityRank(b)
            if (rankA !== rankB) return rankA - rankB
            return new Date(b.booking_time || b.created_at) - new Date(a.booking_time || a.created_at)
        })
    }, [bookings, statusFilter, channelFilter, paymentFilter, searchQuery])

    // Kanban Lanes partitioned by operational priority
    const kanbanLanes = useMemo(() => {
        const seated = []
        const pending = []
        const paid = []
        const pickup = []
        const other = []

        filteredBookings.forEach(b => {
            const tr = parseTableTransferInfo(b, bookings)
            const st = (b.status || '').toLowerCase()
            const isPick = b.booking_type === 'pickup' || (b.order_type || '').includes('hausmade')

            if (tr.isMergedSource || st === 'cancelled' || st === 'void') {
                other.push(b)
            } else if (st === 'seated') {
                seated.push(b)
            } else if (st === 'pending') {
                pending.push(b)
            } else if (isPick && st !== 'completed' && st !== 'paid' && st !== 'success') {
                pickup.push(b)
            } else if (st === 'completed' || st === 'paid' || st === 'success') {
                paid.push(b)
            } else {
                seated.push(b)
            }
        })

        return { seated, pending, paid, pickup, other }
    }, [filteredBookings, bookings])

    // Derived counts & sums for quick badges
    const metrics = useMemo(() => {
        let totalRev = 0
        let completedCount = 0
        let seatedCount = 0
        let pendingCount = 0
        let pureCancelledCount = 0
        let mergedCount = 0
        let totalCompletedDurationMins = 0
        let countWithDuration = 0

        ;(bookings || []).forEach(b => {
            const isInternalBlock = (b.customer_note === 'Internal Block' || b.customer_note === 'Maintenance Block') && 
                                    (!b.order_items || b.order_items.length === 0) && 
                                    parseFloat(b.total_amount || b.total_price || 0) === 0
            if (isInternalBlock) return

            const transfer = parseTableTransferInfo(b)
            const amt = parseFloat(b.total_amount || b.total_price || 0)
            
            if (transfer.isMergedSource) {
                mergedCount++
            } else if (b.status === 'completed' || b.status === 'paid' || b.status === 'success') {
                totalRev += amt
                completedCount++
                const start = b.booking_time || b.created_at
                const end = b.end_time || b.updated_at
                if (start && end) {
                    const dur = calculateDurationMinutes(start, end)
                    if (dur > 0 && dur < 480) { // filter outliers > 8 hours
                        totalCompletedDurationMins += dur
                        countWithDuration++
                    }
                }
            } else if (b.status === 'seated') {
                seatedCount++
            } else if (b.status === 'pending') {
                pendingCount++
            } else if (b.status === 'cancelled' || b.status === 'void') {
                pureCancelledCount++
            }
        })

        const avgDurationMins = countWithDuration > 0 ? Math.round(totalCompletedDurationMins / countWithDuration) : 0
        const filteredSum = filteredBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || b.total_price || 0), 0)

        return {
            totalRev,
            completedCount,
            seatedCount,
            pendingCount,
            pureCancelledCount,
            mergedCount,
            cancelledCount: pureCancelledCount + mergedCount,
            filteredCount: filteredBookings.length,
            filteredSum,
            avgDurationMins
        }
    }, [bookings, filteredBookings])

    const getStatusBadge = (booking) => {
        const transfer = parseTableTransferInfo(booking, bookings)
        
        // Distinct highlight for Source Merged Bills (Thai Modern Rams UI)
        if (transfer.isMergedSource) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-black bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.16_28)] border-2 border-[oklch(52%_0.16_28)] shadow-xs" title={`รวมรายการอาหารเข้ากับ ${transfer.targetTableDisplay || transfer.mergedToTable}`}>
                    <Layers size={11} className="text-[oklch(52%_0.16_28)]" />
                    <span>MERGED (โต๊ะรวม) ➔ {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable || 'บิลหลัก'}`}</span>
                </span>
            )
        }

        const s = (booking?.status || '').toLowerCase()
        if (s === 'completed' || s === 'paid' || s === 'success') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <CheckCircle2 size={11} className="text-emerald-700" />
                    <span>PAID (ชำระแล้ว)</span>
                </span>
            )
        }
        if (s === 'seated') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-[oklch(92%_0.02_220)] text-[oklch(35%_0.10_220)] border border-[oklch(82%_0.02_220)]">
                    <Clock size={11} />
                    <span>SEATED (กำลังทาน)</span>
                </span>
            )
        }
        if (s === 'pending') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-[oklch(93%_0.04_65)] text-[oklch(28%_0.10_65)] border border-[oklch(80%_0.06_65)] animate-pulse">
                    <AlertCircle size={11} />
                    <span>PENDING (รอตรวจ)</span>
                </span>
            )
        }
        if (s === 'confirmed' || s === 'ready') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] border border-[oklch(85%_0.08_140)]">
                    <span>CONFIRMED</span>
                </span>
            )
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                <span>{s.toUpperCase() || 'VOID'}</span>
            </span>
        )
    }

    const getPaymentBadge = (booking) => {
        const transfer = parseTableTransferInfo(booking, bookings)
        if (transfer.isMergedSource) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-[oklch(92%_0.012_28)] text-[oklch(42%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                    <Layers size={11} />
                    <span>โอนยอดไป {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable || 'บิลหลัก'}`}</span>
                </span>
            )
        }


        const breakdown = getBookingPaymentBreakdown(booking)
        if (breakdown.isSplit) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-[oklch(93%_0.04_300)] text-[oklch(28%_0.08_300)] border border-[oklch(80%_0.06_300)]">
                    <Layers size={11} />
                    <span>SPLIT (ผสม)</span>
                </span>
            )
        }
        if (breakdown.methodLabel === 'Credit Card') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-[oklch(93%_0.04_250)] text-[oklch(28%_0.08_250)] border border-[oklch(80%_0.06_250)]">
                    <CreditCard size={11} />
                    <span>CREDIT CARD</span>
                </span>
            )
        }
        if (breakdown.methodLabel === 'QR Transfer' || booking.payment_slip_url) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-[oklch(93%_0.04_140)] text-[oklch(28%_0.08_140)] border border-[oklch(80%_0.06_140)]">
                    <QrCode size={11} />
                    <span>PROMPTPAY QR</span>
                </span>
            )
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-[oklch(93%_0.04_65)] text-[oklch(28%_0.10_65)] border border-[oklch(80%_0.06_65)]">
                <Banknote size={11} />
                <span>CASH (เงินสด)</span>
            </span>
        )
    }

    // Visual Database Card Component (Dieter Rams + Thai Modern OKLCH)
    const renderVisualCard = (b) => {
        const isExpanded = expandedBillIds.has(b.id)
        const shortId = getShortBookingId(b)
        const isDineIn = b.booking_type === 'dine_in' || b.booking_type === 'walk_in'
        const guestName = b.profiles?.display_name || b.pickup_contact_name || b.customer_name || 'Walk-in Guest'
        const phone = b.profiles?.phone_number || b.pickup_contact_phone || b.phone_number || ''
        const tier = b.profiles?.current_tier || ''
        const totalAmt = parseFloat(b.total_amount || b.total_price || 0)
        const isSplitBill = (b.staff_remark || '').toLowerCase().includes('split')
        const rawItems = b.order_items || []
        const items = rawItems.length > 0
            ? rawItems
            : (isSplitBill && totalAmt > 0 ? [{
                id: `split_item_${b.id}`,
                custom_name: `แบ่งชำระ (${b.staff_remark})`,
                quantity: 1,
                price_at_time: totalAmt
            }] : [])
        const itemsCount = items.length > 0 ? items.reduce((sum, item) => sum + (item.quantity || 1), 0) : (isSplitBill && totalAmt > 0 ? 1 : 0)
        const status = (b.status || '').toLowerCase()
        const isSeated = status === 'seated'
        const isPending = status === 'pending'
        const isPaid = status === 'completed' || status === 'paid' || status === 'success'
        const isCancelled = status === 'cancelled' || status === 'void'
        const hasCallBill = Boolean(
            b.staff_remark && 
            b.staff_remark.includes('[CALL_BILL]') && 
            !isPaid && 
            !isCancelled && 
            !dismissedCallBillIds.has(b.id)
        )
        const transfer = parseTableTransferInfo(b, bookings)

        // Distinct border styling based on operational priority (Dieter Rams + Thai Modern OKLCH)
        let cardStyle = 'border-2 border-[oklch(85%_0.012_28)] bg-[oklch(99%_0.005_28)] hover:border-[oklch(52%_0.16_28)]'
        if (transfer.isMergedSource) {
            cardStyle = 'border-2 border-dashed border-[oklch(52%_0.16_28)]/50 bg-[oklch(97%_0.008_28)] opacity-75'
        } else if (hasCallBill) {
            cardStyle = 'border-2 border-[oklch(75%_0.18_65)] bg-[oklch(98%_0.02_65)] shadow-xs'
        } else if (isSeated) {
            cardStyle = 'border-2 border-[oklch(52%_0.16_28)]/80 bg-[oklch(98%_0.010_28)] shadow-xs'
        } else if (isPending) {
            cardStyle = 'border-2 border-[oklch(75%_0.14_65)] bg-[oklch(98%_0.015_65)]'
        } else if (isPaid) {
            cardStyle = 'border-2 border-[oklch(75%_0.08_140)] bg-[oklch(99%_0.005_28)] hover:border-[oklch(45%_0.08_140)]'
        }

        return (
            <div 
                key={b.id} 
                className={`rounded-sm p-3.5 flex flex-col justify-between transition-all duration-150 shadow-2xs hover:shadow-md ${cardStyle}`}
            >
                {/* Top Alert if Call Bill or Table Merged */}
                <div>
                    {hasCallBill && (
                        <div className="mb-2 px-2.5 py-1 bg-[oklch(78%_0.18_65)] text-[oklch(18%_0.012_28)] font-mono text-[10px] font-black rounded-xs flex items-center justify-between animate-pulse">
                            <span className="tracking-wider">[CALL BILL] ลูกค้าเรียกเช็คบิล</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] uppercase tracking-widest font-bold">URGENT</span>
                                <button
                                    type="button"
                                    onClick={async (e) => {
                                        e.stopPropagation()
                                        await handleDismissCallBill(b)
                                    }}
                                    className="ml-1 px-1.5 py-0.5 bg-[oklch(18%_0.012_28)] hover:bg-black text-white text-[9px] rounded-xs font-mono font-bold tracking-tight transition-colors cursor-pointer"
                                    title="เคลียร์แจ้งเตือนเรียกเช็คบิล"
                                >
                                    เคลียร์
                                </button>
                            </div>
                        </div>
                    )}
                    {transfer.isMergedSource && (
                        <div className="mb-2 px-2.5 py-1 bg-[oklch(95%_0.02_28)] text-[oklch(35%_0.16_28)] font-mono text-[10px] font-black rounded-xs border border-[oklch(52%_0.16_28)] flex items-center justify-between gap-2 shadow-2xs">
                            <span className="flex items-center gap-1">
                                <span className="px-1.5 py-0.2 bg-[oklch(52%_0.16_28)] text-white rounded-xs text-[8.5px] uppercase font-mono font-bold tracking-wider shrink-0">โต๊ะรวม</span>
                                <span className="truncate">รวมบิลเข้า {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}</span>
                            </span>
                            {transfer.originalTotal > 0 && (
                                <span className="text-[9px] tabular-nums font-bold text-[oklch(45%_0.14_28)] shrink-0">
                                    ยอดเดิม ฿{transfer.originalTotal.toLocaleString()}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Top Row: Table Tag, Time & Short ID */}
                    <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-[oklch(90%_0.008_28)]">
                        <div className="flex items-center gap-1.5 min-w-0">
                            {isDineIn ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 border font-mono text-xs font-black rounded-xs truncate ${
                                    transfer.isMergedSource
                                        ? 'bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.16_28)] border-[oklch(52%_0.16_28)]'
                                        : 'bg-[oklch(92%_0.012_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)]'
                                }`}>
                                    <Utensils size={11} className="text-[oklch(52%_0.16_28)] shrink-0" />
                                    <span>{b.tables_layout?.table_name || 'Table ?'} ({b.pax || 2}P)</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[oklch(92%_0.02_220)] text-[oklch(35%_0.10_220)] border border-[oklch(82%_0.02_220)] font-mono text-xs font-black rounded-xs">
                                    <ShoppingBag size={11} className="shrink-0" />
                                    <span>PICKUP</span>
                                </span>
                            )}
                            {transfer.isMergedSource && (
                                <span className="px-1.5 py-0.2 bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.16_28)] border border-[oklch(52%_0.16_28)] rounded-xs text-[9px] font-mono font-black shrink-0 truncate max-w-[150px]">
                                    โต๊ะรวม ➔ {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}
                                </span>
                            )}
                            {transfer.isMergedTarget && (
                                <span className="px-1 py-0.2 bg-[oklch(92%_0.02_140)] text-[oklch(30%_0.08_140)] border border-[oklch(82%_0.04_140)] rounded-xs text-[8px] font-mono font-black shrink-0">
                                    +โต๊ะรวม (+{transfer.mergedFromTableDisplay || transfer.mergedFromTables.join(', ')})
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                            <span className="text-[oklch(42%_0.010_28)] font-semibold text-[11px] tabular-nums">
                                {formatThaiTimeOnly(b.booking_time || b.created_at)}
                            </span>
                            <span className="px-1.5 py-0.2 bg-[oklch(18%_0.012_28)] text-white font-mono text-[10px] font-black rounded-xs tabular-nums">
                                #{shortId}
                            </span>
                        </div>
                    </div>

                    {/* Status & Live Duration Row */}
                    <div className="flex items-center gap-1.5 flex-wrap my-2">
                        {getStatusBadge(b)}
                        {getPaymentBadge(b)}
                        <LiveServiceDurationBadge booking={b} />
                    </div>

                    {/* Customer Info */}
                    <div className="flex items-center justify-between text-xs font-mono py-1">
                        <div className="truncate pr-1">
                            <span className="font-bold text-[oklch(18%_0.012_28)] truncate block">
                                {guestName}
                            </span>
                            {phone && (
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] font-mono tracking-tight tabular-nums">
                                    TEL: {phone}
                                </span>
                            )}
                        </div>
                        {tier && (
                            <span className="px-1.5 py-0.2 rounded-xs text-[8.5px] font-mono font-bold bg-[oklch(93%_0.04_65)] text-[oklch(28%_0.10_65)] border border-[oklch(80%_0.06_65)] shrink-0">
                                {tier}
                            </span>
                        )}
                    </div>

                    {/* Items List Preview (Clean Hairline Division - Anti Card-in-Card) */}
                    <div className="my-2 pt-2 border-t border-[oklch(90%_0.008_28)] font-mono text-xs space-y-1">
                        {items.slice(0, isExpanded ? items.length : 3).map((item, idx) => {
                            const mName = item.custom_name || item.menu_items?.name || item.name || 'Custom Item'
                            const price = parseFloat(item.price_at_time || item.menu_items?.price || item.price || 0)
                            const qty = item.quantity || 1
                            return (
                                <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                                    <span className="truncate text-[oklch(22%_0.012_28)]">
                                        <strong className="text-[oklch(52%_0.16_28)] font-bold mr-1 tabular-nums">{qty}x</strong>
                                        {mName}
                                    </span>
                                    <span className="text-[oklch(42%_0.010_28)] shrink-0 text-[10px] tabular-nums">
                                        ฿{(price * qty).toLocaleString()}
                                    </span>
                                </div>
                            )
                        })}
                        {items.length === 0 && (
                            transfer.isMergedSource ? (
                                <div className="p-2 bg-[oklch(96%_0.015_28)] border border-[oklch(88%_0.02_28)] rounded-xs text-[10px] text-[oklch(35%_0.14_28)] font-mono space-y-1">
                                    <div className="font-bold flex items-center gap-1 text-[oklch(40%_0.16_28)]">
                                        <Layers size={11} />
                                        <span>โต๊ะรวม: ย้ายรายการแล้ว</span>
                                    </div>
                                    <div className="text-[9.5px] text-[oklch(45%_0.010_28)]">
                                        รายการอาหารและยอดเงินถูกโอนไปยัง <strong className="text-[oklch(22%_0.012_28)]">{transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}</strong>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-[10px] text-[oklch(55%_0.010_28)] font-mono uppercase tracking-wider text-center py-1">
                                    ไม่มีรายการอาหารย่อย
                                </div>
                            )
                        )}
                        {items.length > 3 && (
                            <button
                                type="button"
                                onClick={() => toggleExpand(b.id)}
                                className="w-full text-center text-[10px] font-bold text-[oklch(52%_0.16_28)] hover:underline pt-1 cursor-pointer"
                            >
                                {isExpanded ? '▲ ย่อรายการ' : `+ อีก ${items.length - 3} รายการ (คลิกดูครบ)`}
                            </button>
                        )}
                    </div>
                </div>

                {/* Bottom Total & Actions */}
                <div className="pt-2 border-t border-[oklch(90%_0.008_28)] mt-1">
                    <div className="flex items-baseline justify-between font-mono mb-2">
                        {transfer.isMergedSource ? (
                            <>
                                <span className="text-[10px] text-[oklch(52%_0.16_28)] font-bold tabular-nums">
                                    โต๊ะรวม (โอนยอดแล้ว)
                                </span>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-[oklch(42%_0.010_28)] line-through tabular-nums mr-1.5 opacity-60">
                                        ฿0
                                    </span>
                                    <span className="text-sm font-black text-[oklch(52%_0.16_28)] tabular-nums">
                                        {transfer.originalTotal > 0 ? `(เดิม ฿${transfer.originalTotal.toLocaleString()})` : 'รวมบิลแล้ว'}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <>
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] font-bold tabular-nums">
                                    {itemsCount} รายการ
                                </span>
                                <span className="text-base font-black text-[oklch(18%_0.012_28)] tabular-nums">
                                    ฿{totalAmt.toLocaleString()}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Action Buttons (Non-wrapping Clickable Affordances) */}
                    <div className="flex items-center gap-1 font-mono text-xs">
                        {b.payment_slip_url && (
                            <button
                                type="button"
                                onClick={() => onViewSlip && onViewSlip(b.payment_slip_url)}
                                className="flex-1 py-1.5 bg-[oklch(93%_0.04_140)] hover:bg-[oklch(88%_0.06_140)] text-[oklch(28%_0.08_140)] border border-[oklch(80%_0.06_140)] rounded-xs font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                                title="ดูสลิปโอนเงิน"
                            >
                                <ImageIcon size={11} />
                                <span>ดูสลิป</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onPrintSlip && onPrintSlip(b, b.status === 'completed' ? 'receipt' : 'billing')}
                            className="flex-1 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-xs font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                            title="ดูภาพสลิป/PNG"
                        >
                            <Receipt size={11} />
                            <span>สลิป</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpenTaxInvoice && onOpenTaxInvoice(b)}
                            className="flex-1 py-1.5 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded-xs font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                            title="ออกใบกำกับภาษี"
                        >
                            <FileText size={11} />
                            <span>ใบกำกับ</span>
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header & Filter Toolbar */}
            <div className="bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-xl p-4 md:p-5 space-y-4 shadow-sm">
                
                {/* Title & Quick Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[oklch(85%_0.012_28)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <Receipt size={20} className="text-[oklch(52%_0.16_28)]" />
                            <h2 className="font-mono text-base md:text-lg font-black uppercase text-[oklch(18%_0.012_28)]">
                                BACKOFFICE ALL-BILLS HUB // {selectedDate}
                            </h2>
                        </div>
                        <p className="font-mono text-xs text-[oklch(42%_0.010_28)] mt-0.5">
                            ศูนย์รวมและตรวจสอบบิลทั้งหมดของวัน รายการอาหาร การชำระเงิน และการพิมพ์สลิป
                        </p>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs self-start sm:self-auto flex-wrap">
                        <div className="px-3 py-1.5 bg-white border border-[oklch(85%_0.012_28)] rounded-lg font-bold">
                            <span className="text-[oklch(42%_0.010_28)]">ยอดขายบิลปิด: </span>
                            <span className="font-black text-[oklch(52%_0.16_28)] text-sm">฿{metrics.totalRev.toLocaleString()}</span>
                        </div>
                        {metrics.avgDurationMins > 0 && (
                            <div className="px-3 py-1.5 bg-white border border-[oklch(85%_0.012_28)] rounded-lg font-bold">
                                <span className="text-[oklch(42%_0.010_28)]">เวลาเฉลี่ย/โต๊ะ: </span>
                                <span className="font-black text-[oklch(18%_0.012_28)] text-sm">{formatThaiDuration(metrics.avgDurationMins)}</span>
                            </div>
                        )}
                        <div className="px-3 py-1.5 bg-white border border-[oklch(85%_0.012_28)] rounded-lg font-bold">
                            <span className="text-[oklch(42%_0.010_28)]">บิลทั้งหมด: </span>
                            <span className="font-black text-[oklch(18%_0.012_28)] text-sm">{bookings.length}</span>
                        </div>
                    </div>
                </div>

                {/* Filter Chips Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Status Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar font-mono text-xs">
                        {[
                            { key: 'all', label: `ทั้งหมด (${bookings.length})` },
                            { key: 'completed', label: `ชำระแล้ว (${metrics.completedCount})` },
                            { key: 'seated', label: `กำลังทาน (${metrics.seatedCount})` },
                            { key: 'pending', label: `รอตรวจ (${metrics.pendingCount})` },
                            { key: 'merged', label: `รวมโต๊ะ (${metrics.mergedCount})` },
                            { key: 'cancelled', label: `ยกเลิก (${metrics.pureCancelledCount})` },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setStatusFilter(tab.key)}
                                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border font-bold ${
                                    statusFilter === tab.key
                                        ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                                        : 'bg-white text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-gray-50'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Secondary Filters: Channel & Payment Method */}
                    <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
                        {/* Channel Select */}
                        <select
                            value={channelFilter}
                            onChange={(e) => setChannelFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-white border border-[oklch(85%_0.012_28)] rounded-lg font-bold text-[oklch(18%_0.012_28)] focus:outline-none cursor-pointer"
                        >
                            <option value="all">ทุกประเภท (Dine-in/Pickup)</option>
                            <option value="dine_in">ทานที่ร้าน (Dine-In)</option>
                            <option value="pickup">รับกลับบ้าน (Pickup)</option>
                        </select>

                        {/* Payment Select */}
                        <select
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-white border border-[oklch(85%_0.012_28)] rounded-lg font-bold text-[oklch(18%_0.012_28)] focus:outline-none cursor-pointer"
                        >
                            <option value="all">ทุกช่องทางชำระ</option>
                            <option value="cash">เงินสด (Cash)</option>
                            <option value="qr">PromptPay QR</option>
                            <option value="credit">บัตรเครดิต</option>
                            <option value="split">บิลผสม (Split)</option>
                        </select>
                    </div>
                </div>

                {/* Search Bar & Expand/Collapse All */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-[oklch(85%_0.012_28)]">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(52%_0.16_28)]" />
                        <input
                            type="text"
                            placeholder="ค้นหาตาม #เลขบิล, ชื่อโต๊ะ, ชื่อลูกค้า, เบอร์โทร, เมนูอาหาร หรือหมายเหตุ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 bg-white border border-[oklch(85%_0.012_28)] rounded-lg font-mono text-xs text-[oklch(18%_0.012_28)] placeholder:text-gray-400 focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
                        <button
                            onClick={expandAll}
                            className="px-2.5 py-1.5 bg-white border border-[oklch(85%_0.012_28)] rounded-lg text-[oklch(42%_0.010_28)] hover:text-black font-bold"
                        >
                            ขยายทั้งหมด
                        </button>
                        <button
                            onClick={collapseAll}
                            className="px-2.5 py-1.5 bg-white border border-[oklch(85%_0.012_28)] rounded-lg text-[oklch(42%_0.010_28)] hover:text-black font-bold"
                        >
                            ย่อทั้งหมด
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Counter Strip & View Mode Switcher (Neo-Brutalist Tabular Layout) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs px-1 text-[oklch(42%_0.010_28)] font-bold">
                <div className="flex items-center gap-3 flex-wrap">
                    <span>แสดง <strong className="text-[oklch(18%_0.012_28)] tabular-nums">{filteredBookings.length}</strong> จาก {bookings.length} บิล</span>
                    {filteredBookings.length > 0 && (
                        <span>ยอดรวม: <strong className="text-[oklch(18%_0.012_28)] tabular-nums">฿{metrics.filteredSum.toLocaleString()}</strong></span>
                    )}
                </div>

                {/* Visual View Mode Switcher (Solid Rectangular Cells) */}
                <div className="inline-flex items-stretch border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] rounded-xs overflow-hidden shrink-0 divide-x divide-[oklch(85%_0.012_28)]">
                    <button
                        type="button"
                        onClick={() => handleViewModeChange('grid')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-black transition-all cursor-pointer ${
                            viewMode === 'grid'
                                ? 'bg-[oklch(18%_0.012_28)] text-white'
                                : 'text-[oklch(42%_0.010_28)] hover:text-black hover:bg-[oklch(90%_0.012_28)]'
                        }`}
                        title="มุมมองการ์ด Visual Database — กวาดสายตาดูได้พร้อมกันหลายบิล"
                    >
                        <LayoutGrid size={12} />
                        <span className="whitespace-nowrap">การ์ดฐานข้อมูล</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleViewModeChange('kanban')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-black transition-all cursor-pointer ${
                            viewMode === 'kanban'
                                ? 'bg-[oklch(18%_0.012_28)] text-white'
                                : 'text-[oklch(42%_0.010_28)] hover:text-black hover:bg-[oklch(90%_0.012_28)]'
                        }`}
                        title="มุมมองแยกตามลำดับความสำคัญ — กำลังทาน / รอตรวจ / ชำระแล้ว / รับกลับ"
                    >
                        <Columns size={12} />
                        <span className="whitespace-nowrap">ลำดับความสำคัญ</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleViewModeChange('list')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-black transition-all cursor-pointer ${
                            viewMode === 'list'
                                ? 'bg-[oklch(18%_0.012_28)] text-white'
                                : 'text-[oklch(42%_0.010_28)] hover:text-black hover:bg-[oklch(90%_0.012_28)]'
                        }`}
                        title="มุมมองรายการละเอียด"
                    >
                        <List size={12} />
                        <span className="whitespace-nowrap">รายการ</span>
                    </button>
                </div>
            </div>

            {/* Bills Display Area */}
            {loading ? (
                <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-12 text-center font-mono text-xs text-[oklch(55%_0.010_28)] animate-pulse rounded-sm">
                    กำลังโหลดข้อมูลบิลทั้งหมดประจำวัน...
                </div>
            ) : filteredBookings.length === 0 ? (
                <div className="bg-[oklch(98%_0.006_28)] border-2 border-dashed border-[oklch(85%_0.012_28)] p-12 rounded-sm text-center space-y-2">
                    <AlertCircle size={32} className="mx-auto text-[oklch(52%_0.16_28)] opacity-60" />
                    <h3 className="font-mono font-bold text-sm text-[oklch(18%_0.012_28)] uppercase tracking-wider">ไม่พบบิลตามเงื่อนไขที่เลือก</h3>
                    <p className="font-mono text-xs text-[oklch(55%_0.010_28)]">
                        ลองปรับตัวกรองสถานะหรือค้นหาด้วยคำค้นอื่น
                    </p>
                </div>
            ) : viewMode === 'grid' ? (
                /* 1. Visual Database Multi-Column Card Grid (Default) */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                    {filteredBookings.map(b => renderVisualCard(b))}
                </div>
            ) : viewMode === 'kanban' ? (
                /* 2. Priority Lanes (Kanban Columns with OKLCH Color Enclosures) */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5 items-start">
                    {/* Lane 1: Seated (กำลังทาน) */}
                    <div className="flex flex-col bg-[oklch(96%_0.008_28)] border-2 border-[oklch(52%_0.16_28)]/40 rounded-sm p-3 space-y-2.5 min-h-[400px]">
                        <div className="flex items-center justify-between pb-2 border-b border-[oklch(88%_0.010_28)] font-mono">
                            <span className="font-black text-xs text-[oklch(52%_0.16_28)] flex items-center gap-1.5 uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)] animate-pulse" />
                                กำลังทาน (SEATED)
                            </span>
                            <span className="px-2 py-0.5 bg-[oklch(52%_0.16_28)] text-white text-[10px] font-black rounded-xs tabular-nums">
                                {kanbanLanes.seated.length}
                            </span>
                        </div>
                        <div className="space-y-2.5 overflow-y-auto max-h-[70vh] pr-0.5 scrollbar-none">
                            {kanbanLanes.seated.map(b => renderVisualCard(b))}
                            {kanbanLanes.seated.length === 0 && (
                                <div className="text-center py-10 font-mono text-[10px] uppercase tracking-wider text-[oklch(55%_0.010_28)]">
                                    ไม่มีโต๊ะกำลังทาน
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lane 2: Pending (รอตรวจ) */}
                    <div className="flex flex-col bg-[oklch(96%_0.008_28)] border-2 border-[oklch(75%_0.14_65)] rounded-sm p-3 space-y-2.5 min-h-[400px]">
                        <div className="flex items-center justify-between pb-2 border-b border-[oklch(88%_0.010_28)] font-mono">
                            <span className="font-black text-xs text-[oklch(28%_0.10_65)] flex items-center gap-1.5 uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-[oklch(75%_0.18_65)] animate-pulse" />
                                รอตรวจ (PENDING)
                            </span>
                            <span className="px-2 py-0.5 bg-[oklch(78%_0.18_65)] text-[oklch(18%_0.012_28)] text-[10px] font-black rounded-xs tabular-nums">
                                {kanbanLanes.pending.length}
                            </span>
                        </div>
                        <div className="space-y-2.5 overflow-y-auto max-h-[70vh] pr-0.5 scrollbar-none">
                            {kanbanLanes.pending.map(b => renderVisualCard(b))}
                            {kanbanLanes.pending.length === 0 && (
                                <div className="text-center py-10 font-mono text-[10px] uppercase tracking-wider text-[oklch(55%_0.010_28)]">
                                    ไม่มีออเดอร์รอตรวจ
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lane 3: Completed (ชำระแล้ว) */}
                    <div className="flex flex-col bg-[oklch(96%_0.008_28)] border-2 border-[oklch(75%_0.08_140)] rounded-sm p-3 space-y-2.5 min-h-[400px]">
                        <div className="flex items-center justify-between pb-2 border-b border-[oklch(88%_0.010_28)] font-mono">
                            <span className="font-black text-xs text-[oklch(28%_0.08_140)] flex items-center gap-1.5 uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)]" />
                                ชำระแล้ว (PAID)
                            </span>
                            <span className="px-2 py-0.5 bg-[oklch(45%_0.08_140)] text-white text-[10px] font-black rounded-xs tabular-nums">
                                {kanbanLanes.paid.length}
                            </span>
                        </div>
                        <div className="space-y-2.5 overflow-y-auto max-h-[70vh] pr-0.5 scrollbar-none">
                            {kanbanLanes.paid.map(b => renderVisualCard(b))}
                            {kanbanLanes.paid.length === 0 && (
                                <div className="text-center py-10 font-mono text-[10px] uppercase tracking-wider text-[oklch(55%_0.010_28)]">
                                    ยังไม่มีบิลชำระ
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lane 4: Pickup (รับกลับ/พัสดุ) */}
                    <div className="flex flex-col bg-[oklch(96%_0.008_28)] border-2 border-[oklch(75%_0.08_220)] rounded-sm p-3 space-y-2.5 min-h-[400px]">
                        <div className="flex items-center justify-between pb-2 border-b border-[oklch(88%_0.010_28)] font-mono">
                            <span className="font-black text-xs text-[oklch(28%_0.08_220)] flex items-center gap-1.5 uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_220)]" />
                                รับกลับ/พัสดุ (PICKUP)
                            </span>
                            <span className="px-2 py-0.5 bg-[oklch(45%_0.08_220)] text-white text-[10px] font-black rounded-xs tabular-nums">
                                {kanbanLanes.pickup.length}
                            </span>
                        </div>
                        <div className="space-y-2.5 overflow-y-auto max-h-[70vh] pr-0.5 scrollbar-none">
                            {kanbanLanes.pickup.map(b => renderVisualCard(b))}
                            {kanbanLanes.pickup.length === 0 && (
                                <div className="text-center py-10 font-mono text-[10px] uppercase tracking-wider text-[oklch(55%_0.010_28)]">
                                    ไม่มีรายการรับกลับ
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lane 5: Merged & Cancelled */}
                    <div className="flex flex-col bg-[oklch(96%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-sm p-3 space-y-2.5 min-h-[400px] opacity-85">
                        <div className="flex items-center justify-between pb-2 border-b border-[oklch(88%_0.010_28)] font-mono">
                            <span className="font-black text-xs text-[oklch(42%_0.010_28)] flex items-center gap-1.5 uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-[oklch(55%_0.010_28)]" />
                                โต๊ะรวม/ยกเลิก (MERGED & CANCELLED)
                            </span>
                            <span className="px-2 py-0.5 bg-[oklch(42%_0.010_28)] text-white text-[10px] font-black rounded-xs tabular-nums">
                                {kanbanLanes.other.length}
                            </span>
                        </div>
                        <div className="space-y-2.5 overflow-y-auto max-h-[70vh] pr-0.5 scrollbar-none">
                            {kanbanLanes.other.map(b => renderVisualCard(b))}
                            {kanbanLanes.other.length === 0 && (
                                <div className="text-center py-10 font-mono text-[10px] uppercase tracking-wider text-[oklch(55%_0.010_28)]">
                                    ไม่มีบิลยกเลิก/โต๊ะรวม
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* 3. Compact List View (Classic Accordion) */
                <div className="space-y-3">
                    {filteredBookings.map((b) => {
                        const isExpanded = expandedBillIds.has(b.id)
                        const shortId = getShortBookingId(b)
                        const isDineIn = b.booking_type === 'dine_in' || b.booking_type === 'walk_in'
                        const guestName = b.profiles?.display_name || b.pickup_contact_name || b.customer_name || 'Guest'
                        const phone = b.profiles?.phone_number || b.pickup_contact_phone || b.phone_number || ''
                        const tier = b.profiles?.current_tier || ''
                        const totalAmt = parseFloat(b.total_amount || b.total_price || 0)
                        const itemsCount = (b.order_items || []).reduce((sum, item) => sum + (item.quantity || 1), 0)
                        const transfer = parseTableTransferInfo(b, bookings)

                        return (
                            <div 
                                key={b.id} 
                                className={`bg-white border-2 rounded-xl overflow-hidden shadow-sm transition-all ${
                                    transfer.isMergedSource 
                                        ? 'border-[oklch(52%_0.16_28)]/50 bg-[oklch(99%_0.005_28)]' 
                                        : 'border-[oklch(85%_0.012_28)] hover:border-[oklch(52%_0.16_28)]'
                                }`}
                            >
                                {/* Main Bill Row */}
                                <div className="p-3.5 md:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[oklch(98%_0.006_28)]">
                                    {/* Left: Time, Short ID, Table/Channel */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <button
                                            onClick={() => toggleExpand(b.id)}
                                            className="p-1 rounded bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono text-xs transition-colors"
                                            title={isExpanded ? 'ย่อรายละเอียด' : 'ขยายดูรายการอาหาร'}
                                        >
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>

                                        <div className="font-mono text-sm font-black text-[oklch(18%_0.012_28)]">
                                            {formatThaiTimeOnly(b.booking_time || b.created_at)}
                                        </div>

                                        <div className="px-2 py-0.5 bg-[oklch(18%_0.012_28)] text-white font-mono text-xs font-black rounded-sm tracking-wider">
                                            #{shortId}
                                        </div>

                                        {isDineIn ? (
                                            <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 border font-mono text-xs font-black rounded-sm ${
                                                transfer.isMergedSource
                                                    ? 'bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.16_28)] border-[oklch(52%_0.16_28)]'
                                                    : 'bg-[oklch(92%_0.012_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)]'
                                            }`}>
                                                <Utensils size={12} className="text-[oklch(52%_0.16_28)]" />
                                                <span>{b.tables_layout?.table_name || 'Table ?'} ({b.pax || 2}P)</span>
                                                {transfer.isMergedSource && (
                                                    <span className="ml-1 px-1.5 py-0.2 bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.16_28)] border border-[oklch(52%_0.16_28)] rounded-xs text-[9px] font-mono font-black">
                                                        โต๊ะรวม ➔ {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}
                                                    </span>
                                                )}
                                                {transfer.isMergedTarget && (
                                                    <span className="ml-1 px-1.5 py-0.2 bg-[oklch(92%_0.02_140)] text-[oklch(30%_0.08_140)] border border-[oklch(82%_0.04_140)] rounded-xs text-[9px] font-mono font-black">
                                                        + รวมจาก {transfer.mergedFromTableDisplay || transfer.mergedFromTables.join(', ')}
                                                    </span>
                                                )}
                                                {transfer.isMoved && (
                                                    <span className="ml-1 px-1.5 py-0.2 bg-[oklch(92%_0.02_220)] text-[oklch(30%_0.10_220)] border border-[oklch(82%_0.02_220)] rounded-xs text-[9px] font-mono font-black">
                                                        ย้ายจาก {transfer.movedFromTable}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[oklch(92%_0.02_220)] text-[oklch(35%_0.10_220)] border border-[oklch(82%_0.02_220)] font-mono text-xs font-black rounded-sm">
                                                <ShoppingBag size={12} />
                                                <span>PICKUP</span>
                                            </div>
                                        )}

                                        {/* Real-time Service Duration Badge */}
                                        <LiveServiceDurationBadge booking={b} />

                                        {/* Status Badge */}
                                        {getStatusBadge(b)}

                                        {/* Payment Badge */}
                                        {getPaymentBadge(b)}

                                        {/* Call Bill Badge if active and unpaid */}
                                        {Boolean(
                                            b.staff_remark && 
                                            b.staff_remark.includes('[CALL_BILL]') && 
                                            !(b.status === 'completed' || b.status === 'paid' || b.status === 'success' || b.status === 'cancelled' || b.status === 'void') && 
                                            !dismissedCallBillIds.has(b.id)
                                        ) && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[oklch(78%_0.18_65)] text-[oklch(18%_0.012_28)] font-mono text-[10px] font-black rounded-sm animate-pulse">
                                                <span>[CALL BILL]</span>
                                                <button
                                                    type="button"
                                                    onClick={async (e) => {
                                                        e.stopPropagation()
                                                        await handleDismissCallBill(b)
                                                    }}
                                                    className="ml-1 px-1 bg-[oklch(18%_0.012_28)] hover:bg-black text-white text-[8px] rounded-xs font-mono font-bold tracking-tight cursor-pointer"
                                                >
                                                    เคลียร์
                                                </button>
                                            </span>
                                        )}
                                    </div>

                                    {/* Middle: Customer & Value */}
                                    <div className="flex items-center justify-between lg:justify-end gap-4">
                                        <div className="text-left lg:text-right">
                                            <div className="flex items-center lg:justify-end gap-1.5">
                                                <span className="font-sans font-black text-sm text-[oklch(18%_0.012_28)]">
                                                    {guestName}
                                                </span>
                                                {tier && (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                        {tier}
                                                    </span>
                                                )}
                                            </div>
                                            {phone && (
                                                <div className="font-mono text-[11px] text-[oklch(42%_0.010_28)] font-semibold">
                                                    {phone}
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right pl-3 border-l border-[oklch(85%_0.012_28)]">
                                            {transfer.isMergedSource ? (
                                                <div>
                                                    <div className="font-mono text-sm md:text-base font-black text-[oklch(52%_0.16_28)] leading-tight">
                                                        โต๊ะรวม ➔ {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable || '?'}`}
                                                    </div>
                                                    <div className="font-mono text-[10px] text-[oklch(42%_0.010_28)] font-bold">
                                                        {transfer.originalTotal > 0 ? `(เดิม ฿${transfer.originalTotal.toLocaleString()})` : 'ย้ายรายการแล้ว'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="font-mono text-base md:text-lg font-black text-[oklch(18%_0.012_28)] leading-tight">
                                                        ฿{totalAmt.toLocaleString()}
                                                    </div>
                                                    <div className="font-mono text-[10px] text-[oklch(42%_0.010_28)] font-bold">
                                                        {itemsCount} รายการ
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Table Transfer High-Contrast Banner Strip */}
                                {transfer.isMergedSource && (
                                    <div className="px-3.5 py-2 bg-[oklch(96%_0.018_28)] border-t border-[oklch(85%_0.018_28)] flex items-center justify-between text-xs font-mono text-[oklch(35%_0.12_28)] flex-wrap gap-2">
                                        <div className="flex items-center gap-2 font-bold">
                                            <span className="px-1.5 py-0.5 bg-[oklch(52%_0.16_28)] text-white rounded-xs text-[9px] uppercase tracking-wider font-mono font-black">
                                                โต๊ะรวม (MERGED)
                                            </span>
                                            <span>➔ รายการอาหารและยอดเงินทั้งหมดถูกรวมไปที่ <strong>{transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}</strong> แล้ว</span>
                                        </div>
                                        {transfer.cleanRemark && (
                                            <span className="text-[oklch(42%_0.010_28)] italic">หมายเหตุเดิม: {transfer.cleanRemark}</span>
                                        )}
                                    </div>
                                )}

                                {transfer.isMergedTarget && (
                                    <div className="px-3.5 py-1.5 bg-[oklch(95%_0.02_140)] border-t border-[oklch(85%_0.04_140)] flex items-center gap-2 text-xs font-mono text-[oklch(30%_0.08_140)]">
                                        <span className="px-1.5 py-0.5 bg-[oklch(45%_0.08_140)] text-white rounded-xs text-[9px] uppercase tracking-wider font-bold">
                                            COMBINED BILL
                                        </span>
                                        <span className="font-bold">บิลนี้ได้รับรายการอาหารรวมมาจาก <strong>{transfer.mergedFromTableDisplay || `โต๊ะ ${transfer.mergedFromTables.join(', ')}`}</strong></span>
                                    </div>
                                )}

                                {transfer.isMoved && (
                                    <div className="px-3.5 py-1.5 bg-[oklch(95%_0.02_220)] border-t border-[oklch(85%_0.04_220)] flex items-center gap-2 text-xs font-mono text-[oklch(30%_0.08_220)]">
                                        <span className="px-1.5 py-0.5 bg-[oklch(35%_0.10_220)] text-white rounded-xs text-[9px] uppercase tracking-wider font-bold">
                                            MOVED TABLE
                                        </span>
                                        <span className="font-bold">ลูกค้าย้ายโต๊ะจาก <strong>โต๊ะ {transfer.movedFromTable}</strong> ➔ <strong>โต๊ะ {transfer.movedToTable || b.tables_layout?.table_name}</strong> {transfer.moveTimestamp && `(${transfer.moveTimestamp})`}</span>
                                    </div>
                                )}

                                {/* Quick Action Bar */}
                                <div className="px-3.5 py-2 bg-white border-t border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                                    <div className="flex items-center gap-1.5 text-[11px] text-[oklch(42%_0.010_28)] truncate max-w-[280px]">
                                        {transfer.cleanRemark && (
                                            <span className="truncate">Remark: <strong className="text-[oklch(18%_0.012_28)]">{transfer.cleanRemark}</strong></span>
                                        )}
                                        {b.customer_note && !transfer.cleanRemark && (
                                            <span className="truncate">Note: <strong className="text-[oklch(18%_0.012_28)]">{b.customer_note}</strong></span>
                                        )}
                                    </div>

                                    {/* Action Buttons Group */}
                                    <div className="flex items-center gap-1.5 ml-auto">
                                        {/* View Payment Slip (if attached) */}
                                        {b.payment_slip_url && (
                                            <button
                                                onClick={() => onViewSlip && onViewSlip(b.payment_slip_url)}
                                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-bold flex items-center gap-1 transition-colors"
                                                title="ดูสลิปโอนเงิน"
                                            >
                                                <ImageIcon size={13} />
                                                <span>ดูสลิป</span>
                                            </button>
                                        )}

                                        {/* View / Copy Slip as PNG */}
                                        <button
                                            type="button"
                                            onClick={() => onPrintSlip && onPrintSlip(b, b.status === 'completed' ? 'receipt' : 'billing')}
                                            className="px-2.5 py-1 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                            title="เปิดดูภาพสลิปใบแจ้งยอด/ใบเสร็จ (คัดลอกรูปส่งลูกค้า LINE หรือ Save PNG)"
                                        >
                                            <Receipt size={13} />
                                            <span>ภาพสลิป/PNG</span>
                                        </button>

                                        {/* Tax Invoice Modal Trigger */}
                                        <button
                                            onClick={() => onOpenTaxInvoice && onOpenTaxInvoice(b)}
                                            className="px-2.5 py-1 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded font-black flex items-center gap-1 transition-colors shadow-sm"
                                            title="ออกใบกำกับภาษีเต็มรูปสำหรับบิลนี้"
                                        >
                                            <FileText size={13} />
                                            <span>ใบกำกับ</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Order Items Breakdown */}
                                {isExpanded && (
                                    <div className="p-4 bg-[oklch(96%_0.008_28)] border-t border-[oklch(85%_0.012_28)] space-y-3 animate-in fade-in duration-200">
                                        <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2 font-mono text-xs">
                                            <span className="font-black text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                                                ORDER ITEMS BREAKDOWN // รายการสินค้าในบิล
                                            </span>
                                            <span className="text-[oklch(42%_0.010_28)] font-bold">
                                                Order ID: {b.id}
                                            </span>
                                        </div>

                                        {(() => {
                                            const isSplit = (b.staff_remark || '').toLowerCase().includes('split');
                                            const tableItems = (b.order_items && b.order_items.length > 0)
                                                ? b.order_items
                                                : (isSplit && totalAmt > 0 ? [{
                                                    custom_name: `แบ่งชำระ (${b.staff_remark})`,
                                                    price_at_time: totalAmt,
                                                    quantity: 1
                                                }] : []);
                                            return tableItems.length > 0 ? (
                                            <div className="divide-y divide-[oklch(90%_0.008_28)] font-mono text-xs">
                                                {tableItems.map((item, idx) => {
                                                    const mName = item.custom_name || item.menu_items?.name || item.name || 'Custom Item'
                                                    const price = parseFloat(item.price_at_time || item.menu_items?.price || item.price || 0)
                                                    const qty = item.quantity || 1
                                                    const subtotal = price * qty
                                                    const optList = formatOrderItemOptions(
                                                        item.selected_options, 
                                                        item.item_note || item.special_instructions || item.notes || item.remark
                                                    )

                                                    return (
                                                        <div key={idx} className="py-2 flex items-start justify-between gap-4">
                                                            <div className="flex items-start gap-2.5">
                                                                <span className="font-black text-[oklch(52%_0.16_28)] bg-white px-1.5 py-0.5 rounded border border-[oklch(85%_0.012_28)] min-w-[24px] text-center">
                                                                    {qty}x
                                                                </span>
                                                                <div>
                                                                    <div className="font-bold text-[oklch(18%_0.012_28)]">
                                                                        {mName}
                                                                    </div>
                                                                    {optList.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {optList.map((opt, oIdx) => (
                                                                                <span key={oIdx} className="bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] text-[11px] text-[oklch(42%_0.010_28)] px-1.5 py-0.5 rounded-sm">
                                                                                    ▶ {opt}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="text-right shrink-0">
                                                                <div className="font-black text-[oklch(18%_0.012_28)]">
                                                                    ฿{subtotal.toLocaleString()}
                                                                </div>
                                                                <div className="text-[10px] text-[oklch(42%_0.010_28)]">
                                                                    @฿{price.toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="py-3 text-center text-[oklch(42%_0.010_28)] font-mono text-xs">
                                                บิลนี้เป็นการจองโต๊ะหรือยังไม่มีรายการอาหารย่อยระบุ
                                            </div>
                                        );
                                        })()}

                                        {/* Bill Totals Summary */}
                                        <div className="pt-2 border-t-2 border-[oklch(85%_0.012_28)] flex justify-between items-baseline font-mono">
                                            <span className="text-xs font-bold text-[oklch(42%_0.010_28)]">
                                                ยอดสุทธิทั้งสิ้น (TOTAL PAYABLE):
                                            </span>
                                            <span className="text-lg font-black text-[oklch(52%_0.16_28)]">
                                                ฿{totalAmt.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
