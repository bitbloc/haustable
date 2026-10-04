/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · component: OnlineAdvanceOrdersHub · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'
import { getThaiDate, formatThaiTimeOnly, formatThaiDateOnly } from '../../../utils/timeUtils'

/**
 * Format relative schedule label for online bookings & pickups
 * (e.g. "วันนี้ 18:30", "พรุ่งนี้ 12:00", "ส. 10 ต.ค. 19:00")
 */
export function formatOrderScheduleLabel(isoString, todayStr = getThaiDate()) {
    if (!isoString) return '-'
    const dateObj = new Date(isoString)
    const bDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    const timeStr = formatThaiTimeOnly(isoString)

    // Calculate tomorrow date
    const d = new Date(todayStr + 'T12:00:00+07:00')
    d.setDate(d.getDate() + 1)
    const tomorrowStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

    if (bDate === todayStr) {
        return `วันนี้ ${timeStr}`
    }
    if (bDate === tomorrowStr) {
        return `พรุ่งนี้ ${timeStr}`
    }
    return `${formatThaiDateOnly(isoString)} ${timeStr}`
}

/**
 * Determine timing horizon category: 'today' | 'tomorrow' | 'upcoming' | 'past'
 */
export function getOrderTimingHorizon(isoString, todayStr = getThaiDate()) {
    if (!isoString) return 'today'
    const dateObj = new Date(isoString)
    const bDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

    const d = new Date(todayStr + 'T12:00:00+07:00')
    d.setDate(d.getDate() + 1)
    const tomorrowStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

    if (bDate === todayStr) return 'today'
    if (bDate === tomorrowStr) return 'tomorrow'
    if (bDate > tomorrowStr) return 'upcoming'
    return 'past'
}

/**
 * Classify booking origin for Online Hub
 */
export function classifyOnlineOrder(booking) {
    if (!booking) return { type: 'unknown', label: 'ORDER', shortTag: 'ORDER', isOnline: false }

    const sourceLower = (booking.source || '').toLowerCase()
    const remarkLower = (booking.staff_remark || '').toLowerCase()
    const noteLower = (booking.customer_note || '').toLowerCase()
    const nameLower = (booking.customer_name || booking.pickup_contact_name || '').toLowerCase()
    const bType = (booking.booking_type || '').toLowerCase()
    const orderType = (booking.order_type || '').toLowerCase()

    // 1. LINE MAN Delivery
    if (sourceLower === 'lineman' || remarkLower.includes('lineman') || noteLower.includes('lineman') || nameLower.includes('line man') || nameLower.startsWith('lm-')) {
        return {
            type: 'lineman',
            label: 'LINE MAN DELIVERY',
            shortTag: 'LINE MAN',
            tagClass: 'bg-[oklch(92%_0.02_140)] text-[oklch(35%_0.08_140)] border-[oklch(75%_0.08_140)]',
            accentClass: 'border-l-[oklch(45%_0.08_140)]'
        }
    }

    // 2. Online Pick-up / Takeaway
    const isPickup = bType === 'pickup' || orderType === 'hausmade_pickup' || remarkLower.includes('pickup') || remarkLower.includes('takeaway') || remarkLower.includes('รับกลับ') || noteLower.includes('pickup')
    if (isPickup) {
        return {
            type: 'pickup',
            label: 'ONLINE PICK-UP',
            shortTag: 'PICK-UP',
            tagClass: 'bg-[oklch(93%_0.02_28)] text-[oklch(40%_0.14_28)] border-[oklch(80%_0.04_28)]',
            accentClass: 'border-l-[oklch(52%_0.16_28)]'
        }
    }

    // 3. Hausmade Shop E-Commerce / Shipping
    if (bType === 'shop' || bType === 'hausmade_shipping' || orderType.startsWith('hausmade')) {
        return {
            type: 'shop',
            label: 'HAUSMADE SHOP',
            shortTag: 'SHOP / PARCEL',
            tagClass: 'bg-[oklch(94%_0.010_28)] text-[oklch(35%_0.08_140)] border-[oklch(85%_0.012_28)]',
            accentClass: 'border-l-[oklch(45%_0.08_140)]'
        }
    }

    // 4. Online Dine-In Table Reservation
    return {
        type: 'dine_in',
        label: 'ONLINE DINE-IN',
        shortTag: booking.tables_layout?.table_name ? `โต๊ะ ${booking.tables_layout.table_name}` : 'ONLINE DINE-IN',
        tagClass: 'bg-[oklch(93%_0.02_28)] text-[oklch(40%_0.14_28)] border-[oklch(80%_0.04_28)]',
        accentClass: 'border-l-[oklch(52%_0.16_28)]'
    }
}

/**
 * OnlineAdvanceOrdersHub
 * Rams Minimalist + Thai Modern OKLCH + Zero-Icon Tabular Queue
 * Displays all active and upcoming online bookings and pickups across any date.
 */
export default function OnlineAdvanceOrdersHub({
    bookings = [],
    onViewSlip,
    onInspectBill,
    onUpdateStatus,
    onOpenProMode,
    loading = false
}) {
    const [channelFilter, setChannelFilter] = useState('all') // 'all' | 'dine_in' | 'pickup' | 'lineman'
    const [horizonFilter, setHorizonFilter] = useState('all')  // 'all' | 'today' | 'tomorrow' | 'upcoming' | 'urgent'
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [actionId, setActionId] = useState(null)

    const todayStr = useMemo(() => getThaiDate(), [])

    // Filter only active / actionable orders (exclude cancelled, void, or settled bills)
    const activeOrders = useMemo(() => {
        return (bookings || []).filter(b => {
            if (!b) return false
            const st = (b.status || '').toLowerCase()
            if (['cancelled', 'void', 'completed', 'paid', 'success'].includes(st)) return false
            // Seated tables with no advance booking are handled by floor table cards
            if (st === 'seated' && b.booking_type !== 'pickup' && (b.source || '').toLowerCase() === 'pos') return false
            return true
        })
    }, [bookings])

    // Compute Summary Counters
    const metrics = useMemo(() => {
        let total = 0
        let dineIn = 0
        let pickup = 0
        let lineman = 0
        let todayCount = 0
        let tomorrowCount = 0
        let upcomingCount = 0
        let urgentCount = 0

        activeOrders.forEach(b => {
            total++
            const classified = classifyOnlineOrder(b)
            if (classified.type === 'dine_in') dineIn++
            else if (classified.type === 'pickup') pickup++
            else if (classified.type === 'lineman') lineman++

            const horizon = getOrderTimingHorizon(b.booking_time || b.created_at, todayStr)
            if (horizon === 'today') todayCount++
            else if (horizon === 'tomorrow') tomorrowCount++
            else if (horizon === 'upcoming') upcomingCount++

            const hasUnverifiedSlip = Boolean(b.payment_slip_url) && !b.staff_remark?.includes('[SLIP_VERIFIED]')
            if (b.status === 'pending' || hasUnverifiedSlip) {
                urgentCount++
            }
        })

        return {
            total,
            dineIn,
            pickup,
            lineman,
            todayCount,
            tomorrowCount,
            upcomingCount,
            urgentCount
        }
    }, [activeOrders, todayStr])

    // Apply Filter & Smart Sorting
    const filteredOrders = useMemo(() => {
        return activeOrders
            .filter(b => {
                const classified = classifyOnlineOrder(b)
                // 1. Channel Filter
                if (channelFilter !== 'all') {
                    if (channelFilter === 'dine_in' && classified.type !== 'dine_in') return false
                    if (channelFilter === 'pickup' && classified.type !== 'pickup' && classified.type !== 'shop') return false
                    if (channelFilter === 'lineman' && classified.type !== 'lineman') return false
                }

                // 2. Horizon Filter
                const horizon = getOrderTimingHorizon(b.booking_time || b.created_at, todayStr)
                const hasUnverifiedSlip = Boolean(b.payment_slip_url) && !b.staff_remark?.includes('[SLIP_VERIFIED]')
                const isUrgent = b.status === 'pending' || hasUnverifiedSlip

                if (horizonFilter === 'today' && horizon !== 'today') return false
                if (horizonFilter === 'tomorrow' && horizon !== 'tomorrow') return false
                if (horizonFilter === 'upcoming' && horizon !== 'upcoming') return false
                if (horizonFilter === 'urgent' && !isUrgent) return false

                return true
            })
            .sort((a, b) => {
                // Tier 1: Urgency Priority (Pending or unverified slip first)
                const aUrgent = a.status === 'pending' || (Boolean(a.payment_slip_url) && !a.staff_remark?.includes('[SLIP_VERIFIED]'))
                const bUrgent = b.status === 'pending' || (Boolean(b.payment_slip_url) && !b.staff_remark?.includes('[SLIP_VERIFIED]'))
                if (aUrgent && !bUrgent) return -1
                if (!aUrgent && bUrgent) return 1

                // Tier 2: Chronological nearest booking/pickup time first
                const timeA = new Date(a.booking_time || a.created_at).getTime()
                const timeB = new Date(b.booking_time || b.created_at).getTime()
                if (timeA !== timeB) return timeA - timeB

                // Tier 3: Tie-breaker by customer name
                return (a.customer_name || '').localeCompare(b.customer_name || '')
            })
    }, [activeOrders, channelFilter, horizonFilter, todayStr])

    const handleAction = async (id, newStatus, e) => {
        if (e) e.stopPropagation()
        if (!onUpdateStatus) return
        setActionId(id)
        try {
            await onUpdateStatus(id, newStatus)
        } finally {
            setActionId(null)
        }
    }

    if (activeOrders.length === 0) {
        return null // Clean collapse when no online / advance orders exist
    }

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] rounded-xs overflow-hidden shadow-2xs font-sans transition-all">
            {/* 1. Header Strip (Dieter Rams Monospace Architecture) */}
            <div className="p-3 sm:p-4 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(97%_0.008_28)] bg-[oklch(18%_0.012_28)] px-2 py-0.5 rounded-xs">
                        ONLINE FEED // OMNI-DATE
                    </span>
                    <span className="font-sans font-bold text-sm sm:text-base text-[oklch(18%_0.012_28)] tracking-tight">
                        ออเดอร์ออนไลน์และการจองล่วงหน้า
                    </span>
                    <span className="font-mono text-xs font-bold text-[oklch(52%_0.16_28)] bg-[oklch(90%_0.02_28)] px-2 py-0.5 rounded-xs">
                        {metrics.total} รายการ
                    </span>
                    {metrics.urgentCount > 0 && (
                        <span className="font-mono text-[11px] font-bold text-[oklch(97%_0.008_28)] bg-[oklch(52%_0.16_28)] px-2 py-0.5 rounded-xs animate-pulse">
                            [ต้องจัดการ {metrics.urgentCount}]
                        </span>
                    )}
                </div>

                {/* Right controls: Collapse / Expand & Pro Mode jump */}
                <div className="flex items-center gap-2 self-start md:self-auto font-mono text-xs">
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="px-2.5 py-1 bg-[oklch(97%_0.008_28)] hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-bold rounded-xs cursor-pointer transition-colors"
                    >
                        {isCollapsed ? '[+] ขยายคิวออเดอร์' : '[-] ยุบแถบคิว'}
                    </button>
                    {onOpenProMode && (
                        <button
                            type="button"
                            onClick={onOpenProMode}
                            className="px-2.5 py-1 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold rounded-xs cursor-pointer transition-colors hidden sm:inline-block"
                        >
                            [INBOX ลึก ➔]
                        </button>
                    )}
                </div>
            </div>

            {!isCollapsed && (
                <>
                    {/* 2. Tabular Filter Ribbons (Two-Tier Multi-Dimensional Matrix) */}
                    <div className="px-3 sm:px-4 py-2.5 bg-[oklch(96%_0.008_28)] border-b border-[oklch(88%_0.012_28)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-mono">
                        {/* Horizon Selector (Date Horizons) */}
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] font-bold mr-1 shrink-0 uppercase">
                                [ช่วงวัน]
                            </span>
                            {[
                                { key: 'all', label: 'ทุกวัน', count: metrics.total },
                                { key: 'today', label: 'วันนี้', count: metrics.todayCount },
                                { key: 'tomorrow', label: 'พรุ่งนี้', count: metrics.tomorrowCount },
                                { key: 'upcoming', label: '7 วันหน้า', count: metrics.upcomingCount },
                                { key: 'urgent', label: 'ต้องตรวจด่วน', count: metrics.urgentCount, isUrgent: true }
                            ].map(item => {
                                const isActive = horizonFilter === item.key
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => setHorizonFilter(item.key)}
                                        className={`px-2 py-1 rounded-xs font-bold transition-all cursor-pointer whitespace-nowrap text-[11px] border ${
                                            isActive
                                                ? item.isUrgent
                                                    ? 'bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)] border-[oklch(52%_0.16_28)]'
                                                    : 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                : 'bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:border-[oklch(55%_0.010_28)]'
                                        }`}
                                    >
                                        <span>{item.label}</span>
                                        <span className="ml-1 opacity-80">({item.count})</span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Channel / Type Selector */}
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] font-bold mr-1 shrink-0 uppercase">
                                [ช่องทาง]
                            </span>
                            {[
                                { key: 'all', label: 'ทั้งหมด', count: metrics.total },
                                { key: 'dine_in', label: 'จองโต๊ะ', count: metrics.dineIn },
                                { key: 'pickup', label: 'รับกลับ', count: metrics.pickup },
                                { key: 'lineman', label: 'LINE MAN', count: metrics.lineman }
                            ].map(item => {
                                const isActive = channelFilter === item.key
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => setChannelFilter(item.key)}
                                        className={`px-2 py-1 rounded-xs font-bold transition-all cursor-pointer whitespace-nowrap text-[11px] border ${
                                            isActive
                                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                : 'bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:border-[oklch(55%_0.010_28)]'
                                        }`}
                                    >
                                        <span>{item.label}</span>
                                        <span className="ml-1 opacity-80">({item.count})</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* 3. Orders Grid & List (Zero-Icon Tabular Division) */}
                    <div className="divide-y divide-[oklch(88%_0.012_28)] max-h-[380px] overflow-y-auto">
                        {filteredOrders.length === 0 ? (
                            <div className="p-8 text-center font-mono text-xs text-[oklch(55%_0.010_28)]">
                                [EMPTY] ไม่มีรายการออเดอร์ออนไลน์หรือการจองตามเงื่อนไขที่เลือก
                            </div>
                        ) : (
                            filteredOrders.map(order => {
                                const classified = classifyOnlineOrder(order)
                                const scheduleLabel = formatOrderScheduleLabel(order.booking_time || order.created_at, todayStr)
                                const horizon = getOrderTimingHorizon(order.booking_time || order.created_at, todayStr)
                                const guestCount = order.guest_count || order.pax || 2
                                const amount = Number(order.total_amount || order.total_price || 0)
                                const customerName = order.pickup_contact_name || order.customer_name || order.profiles?.display_name || 'ลูกค้า'
                                const contactPhone = order.pickup_contact_phone || order.profiles?.phone_number || ''
                                const itemCount = (order.order_items || []).length
                                const hasSlip = Boolean(order.payment_slip_url)
                                const isPending = order.status === 'pending'
                                const isConfirmed = order.status === 'confirmed'
                                const isPreparing = order.status === 'preparing'
                                const isReady = order.status === 'ready'
                                const isSeated = order.status === 'seated'
                                const isUrgent = isPending || (hasSlip && !order.staff_remark?.includes('[SLIP_VERIFIED]'))

                                return (
                                    <div
                                        key={order.id}
                                        onClick={() => onInspectBill && onInspectBill(order)}
                                        className={`p-3 sm:p-4 hover:bg-[oklch(95%_0.010_28)] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-4 ${classified.accentClass} ${
                                            isUrgent ? 'bg-[oklch(96%_0.018_28)]' : 'bg-[oklch(97%_0.008_28)]'
                                        }`}
                                    >
                                        {/* Left Side: Timing, Customer & Channel */}
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Date & Time Badge */}
                                                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-xs ${
                                                    horizon === 'today'
                                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                                        : horizon === 'tomorrow'
                                                            ? 'bg-[oklch(90%_0.02_28)] text-[oklch(40%_0.14_28)] font-black'
                                                            : 'bg-[oklch(92%_0.010_28)] text-[oklch(35%_0.08_140)] font-semibold'
                                                }`}>
                                                    {scheduleLabel}
                                                </span>

                                                {/* Channel / Type Tag */}
                                                <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-xs border ${classified.tagClass}`}>
                                                    {classified.shortTag}
                                                </span>

                                                {/* Status Tag */}
                                                <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-xs border ${
                                                    isPending
                                                        ? 'bg-[oklch(92%_0.04_28)] text-[oklch(40%_0.16_28)] border-[oklch(75%_0.16_28)]'
                                                        : isConfirmed
                                                            ? 'bg-[oklch(92%_0.02_140)] text-[oklch(35%_0.08_140)] border-[oklch(75%_0.08_140)]'
                                                            : isReady
                                                                ? 'bg-[oklch(90%_0.04_140)] text-[oklch(30%_0.10_140)] border-[oklch(70%_0.10_140)]'
                                                                : 'bg-[oklch(92%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                                }`}>
                                                    {isPending ? '[รอตรวจสอบ/คอนเฟิร์ม]' : isConfirmed ? '[ยืนยันแล้ว]' : isPreparing ? '[กำลังเตรียม]' : isReady ? '[พร้อมรับ]' : isSeated ? '[นั่งที่โต๊ะ]' : `[${order.status}]`}
                                                </span>

                                                {hasSlip && (
                                                    <span className="font-mono text-[10px] font-bold bg-[oklch(90%_0.02_28)] text-[oklch(42%_0.14_28)] px-1.5 py-0.5 rounded-xs border border-[oklch(80%_0.04_28)]">
                                                        [มีสลิปโอน]
                                                    </span>
                                                )}
                                            </div>

                                            {/* Customer Name & Notes */}
                                            <div className="flex items-baseline gap-2 flex-wrap text-sm">
                                                <span className="font-bold text-[oklch(18%_0.012_28)] truncate">
                                                    {customerName}
                                                </span>
                                                {classified.type === 'dine_in' && (
                                                    <span className="font-mono text-xs text-[oklch(55%_0.010_28)]">
                                                        ({guestCount} ท่าน {order.tables_layout?.table_name ? `· โต๊ะ ${order.tables_layout.table_name}` : ''})
                                                    </span>
                                                )}
                                                {contactPhone && (
                                                    <span className="font-mono text-xs text-[oklch(55%_0.010_28)]">
                                                        · {contactPhone}
                                                    </span>
                                                )}
                                                {order.customer_note && (
                                                    <span className="text-xs text-[oklch(52%_0.16_28)] italic truncate max-w-[280px]">
                                                        "{order.customer_note}"
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Side: Total Amount & Action Buttons */}
                                        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[oklch(90%_0.010_28)]">
                                            <div className="text-left md:text-right">
                                                <div className="font-mono font-bold text-sm sm:text-base text-[oklch(18%_0.012_28)] tabular-nums">
                                                    ฿{amount.toLocaleString()}
                                                </div>
                                                <div className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                                    {itemCount > 0 ? `${itemCount} รายการ` : 'ยังไม่มีรายการ'}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-1.5 font-mono text-xs">
                                                {hasSlip && onViewSlip && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onViewSlip(order.payment_slip_url)
                                                        }}
                                                        className="px-2 py-1 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] text-[11px] font-bold rounded-xs cursor-pointer transition-colors"
                                                    >
                                                        ดูสลิป
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (onInspectBill) onInspectBill(order)
                                                    }}
                                                    className="px-2 py-1 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] text-[11px] font-bold rounded-xs cursor-pointer transition-colors"
                                                >
                                                    ดูบิล
                                                </button>

                                                {/* Status Transition Action Button */}
                                                {isPending && onUpdateStatus && (
                                                    <button
                                                        type="button"
                                                        disabled={actionId === order.id}
                                                        onClick={(e) => handleAction(order.id, 'confirmed', e)}
                                                        className="px-2.5 py-1 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-[oklch(97%_0.008_28)] text-[11px] font-bold rounded-xs cursor-pointer transition-colors whitespace-nowrap shadow-2xs"
                                                    >
                                                        {actionId === order.id ? '...' : 'ยืนยัน'}
                                                    </button>
                                                )}

                                                {isConfirmed && onUpdateStatus && (
                                                    <button
                                                        type="button"
                                                        disabled={actionId === order.id}
                                                        onClick={(e) => handleAction(order.id, 'ready', e)}
                                                        className="px-2.5 py-1 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] text-[11px] font-bold rounded-xs cursor-pointer transition-colors whitespace-nowrap shadow-2xs"
                                                    >
                                                        {actionId === order.id ? '...' : (classified.type === 'pickup' ? 'พร้อมรับ' : 'พร้อมบริการ')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* 4. Footer Summary (Hallmark Monospace Dignity) */}
                    <div className="p-2.5 bg-[oklch(94%_0.010_28)] border-t border-[oklch(85%_0.012_28)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[11px] text-[oklch(55%_0.010_28)]">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span>กำลังแสดง: <strong className="text-[oklch(18%_0.012_28)]">{filteredOrders.length}</strong> จาก {metrics.total} รายการ</span>
                            <span>•</span>
                            <span>วันนี้: <strong className="text-[oklch(18%_0.012_28)]">{metrics.todayCount}</strong></span>
                            <span>•</span>
                            <span>พรุ่งนี้: <strong className="text-[oklch(18%_0.012_28)]">{metrics.tomorrowCount}</strong></span>
                            <span>•</span>
                            <span>7 วันข้างหน้า: <strong className="text-[oklch(18%_0.012_28)]">{metrics.upcomingCount}</strong></span>
                        </div>
                        <span className="text-[10px] text-[oklch(42%_0.010_28)]">
                            [AUTO-SYNCED REALTIME]
                        </span>
                    </div>
                </>
            )}
        </div>
    )
}
