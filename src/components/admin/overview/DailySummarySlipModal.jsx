/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useRef, useState, useMemo, useEffect } from 'react'
import { X, Download, Copy, Check, AlertCircle } from 'lucide-react'
import { toPng } from 'html-to-image'
import html2canvas from 'html2canvas'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabaseClient'
import { getThaiDate } from '../../../utils/timeUtils'
import { getBookingPaymentBreakdown } from '../../../utils/shiftHelper'

export default function DailySummarySlipModal({
    bookings = [],
    shifts = [],
    targetShift = null,
    selectedDate = getThaiDate(),
    companySettings = {},
    onClose
}) {
    const slipRef = useRef(null)
    const [saving, setSaving] = useState(false)
    const [copied, setCopied] = useState(false)
    const [categories, setCategories] = useState([])

    // Load category mapping (from cache and cloud)
    useEffect(() => {
        try {
            const cached = localStorage.getItem('pos_cache_menu_categories')
            if (cached) {
                const parsed = JSON.parse(cached)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCategories(parsed)
                }
            }
        } catch (e) {}

        supabase
            .from('menu_categories')
            .select('id, name')
            .then(({ data }) => {
                if (data && data.length > 0) {
                    setCategories(data)
                }
            })
            .catch(() => {})
    }, [])

    const categoryMap = useMemo(() => {
        return (categories || []).reduce((acc, cat) => ({ ...acc, [cat.id]: cat.name }), {})
    }, [categories])

    // Shop metadata from settings
    const shopName = companySettings.receipt_shop_name || 'IN THE HAUS'
    const shopPhone = companySettings.receipt_shop_phone || '098-528-4217'
    const isVatEnabled = companySettings.default_vat_enabled === 'true' || companySettings.tax_vat_registered === 'true'

    // Compute comprehensive daily financial and sales metrics strictly from checked-out / completed orders
    const reportData = useMemo(() => {
        const completedBookings = []
        const activeUnpaidBookings = []
        const cancelledBookings = []

        ;(bookings || []).forEach(b => {
            const st = b.status
            if (st === 'completed' || st === 'paid' || st === 'success') {
                completedBookings.push(b)
            } else if (st === 'seated' || st === 'confirmed') {
                activeUnpaidBookings.push(b)
            } else if (st === 'cancelled' || st === 'void') {
                cancelledBookings.push(b)
            }
        })

        let totalSettledSales = 0
        let totalDiscounts = 0
        let totalGuests = 0

        let cashTotal = 0
        let cashCount = 0
        let qrTotal = 0
        let qrCount = 0
        let creditTotal = 0
        let creditCount = 0

        let dineInSettledCount = 0
        let dineInSettledAmount = 0
        let pickupSettledCount = 0
        let pickupSettledAmount = 0

        let walkinCount = 0
        let walkinAmount = 0
        let linemanCount = 0
        let linemanAmount = 0

        let totalItemsSold = 0
        const itemMap = new Map()
        const categorySalesMap = new Map()

        completedBookings.forEach(b => {
            const amt = parseFloat(b.total_amount || b.total_price || 0)
            const disc = parseFloat(b.discount_amount || 0)
            const pax = parseInt(b.pax || 1, 10)

            totalSettledSales += amt
            totalDiscounts += disc
            totalGuests += pax

            const breakdown = getBookingPaymentBreakdown(b)
            if (breakdown.cash > 0) {
                cashTotal += breakdown.cash
                cashCount++
            }
            if (breakdown.qr > 0) {
                qrTotal += breakdown.qr
                qrCount++
            }
            if (breakdown.credit > 0) {
                creditTotal += breakdown.credit
                creditCount++
            }

            const bType = (b.booking_type || 'dine_in').toLowerCase()
            if (bType === 'dine_in' || bType === 'walk_in') {
                dineInSettledCount++
                dineInSettledAmount += amt
            } else {
                pickupSettledCount++
                pickupSettledAmount += amt
            }

            const remark = (b.staff_remark || '').toLowerCase()
            const note = (b.customer_note || '').toLowerCase()
            const isLineman = remark.includes('lineman') || remark.includes('line man') || note.includes('lineman') || note.includes('line man')

            if (isLineman) {
                linemanCount++
                linemanAmount += amt
            } else {
                walkinCount++
                walkinAmount += amt
            }

            ;(b.order_items || []).forEach(item => {
                if (item.status === 'void' || item.status === 'cancelled') return

                const name = item.custom_name || item.menu_items?.name || item.name || 'รายการทั่วไป'
                const qty = parseInt(item.quantity || 1, 10)
                const price = parseFloat(item.price_at_time || item.menu_items?.price || item.price || 0)
                const lineTotal = price * qty
                totalItemsSold += qty

                if (itemMap.has(name)) {
                    const existing = itemMap.get(name)
                    existing.qty += qty
                    existing.total += lineTotal
                } else {
                    itemMap.set(name, { name, qty, total: lineTotal })
                }

                const catId = item.menu_items?.category_id || item.category_id || 'other'
                const catName = categoryMap[catId] || 
                                (item.destination === 'bar' ? 'เครื่องดื่ม' : item.destination === 'kitchen' ? 'อาหาร' : 'อื่นๆ / General')

                if (categorySalesMap.has(catName)) {
                    const existingCat = categorySalesMap.get(catName)
                    existingCat.qty += qty
                    existingCat.amount += lineTotal
                } else {
                    categorySalesMap.set(catName, { name: catName, qty, amount: lineTotal })
                }
            })
        })

        let activeUnpaidTotal = 0
        const activeTablesList = activeUnpaidBookings.map(b => {
            const amt = parseFloat(b.total_amount || b.total_price || 0)
            activeUnpaidTotal += amt
            const tableName = b.tables_layout?.table_name || 
                              (b.booking_type === 'pickup' ? 'Walk-in Pick-up' : (b.pickup_contact_name || b.customer_name || 'โต๊ะรับประทาน'))
            return {
                id: b.id,
                name: tableName,
                amount: amt,
                itemsCount: b.order_items?.length || 0
            }
        })

        const topItems = Array.from(itemMap.values())
            .sort((a, b) => b.qty - a.qty || b.total - a.total)
            .slice(0, 5)

        const categorySales = Array.from(categorySalesMap.values())
            .sort((a, b) => b.amount - a.amount)

        const grossSettledRevenue = totalSettledSales + totalDiscounts
        const avgPerBill = completedBookings.length > 0 ? (totalSettledSales / completedBookings.length) : 0
        const avgPerGuest = totalGuests > 0 ? (totalSettledSales / totalGuests) : 0
        const totalDayVolume = totalSettledSales + activeUnpaidTotal

        return {
            settledNetRevenue: totalSettledSales,
            grossSettledRevenue,
            totalDiscounts,
            completedCount: completedBookings.length,
            activeCount: activeUnpaidBookings.length,
            cancelledCount: cancelledBookings.length,
            totalBills: bookings.length,
            activeUnpaidTotal,
            activeTablesList,
            totalDayVolume,
            cashTotal,
            cashCount,
            qrTotal,
            qrCount,
            creditTotal,
            creditCount,
            dineInSettledCount,
            dineInSettledAmount,
            pickupSettledCount,
            pickupSettledAmount,
            walkinCount,
            walkinAmount,
            linemanCount,
            linemanAmount,
            topItems,
            categorySales,
            totalItemsSold,
            totalGuests,
            avgPerBill,
            avgPerGuest
        }
    }, [bookings, categoryMap])

    // Drawer reconciliation metrics: either for targetShift (single shift) or aggregated across all shifts
    const drawerData = useMemo(() => {
        if (targetShift) {
            const staffName = targetShift.staff_name || targetShift.staffName || 'Staff'
            const openingFloat = Number(targetShift.opening_float || 0)
            const totalIn = Number(targetShift.total_in || 0)
            const totalOut = Number(targetShift.total_out || 0)
            const cashSales = Number(targetShift.cash_sales ?? reportData.cashTotal)
            const expectedCash = Number(targetShift.expected_cash ?? (openingFloat + cashSales + totalIn - totalOut))
            const closedCash = targetShift.closed_cash !== null && targetShift.closed_cash !== undefined ? Number(targetShift.closed_cash) : expectedCash
            const difference = Number(targetShift.difference ?? (closedCash - expectedCash))
            const allAdjustments = (Array.isArray(targetShift.adjustments) ? targetShift.adjustments : []).map(a => ({ ...a, staffName }))

            return {
                openingFloat,
                cashSales,
                totalIn,
                totalOut,
                expectedCash,
                closedCash,
                difference,
                allAdjustments,
                shiftsCount: 1,
                staffNames: staffName
            }
        }

        if (!shifts || shifts.length === 0) return null

        const sorted = [...shifts].sort((a, b) => new Date(a.opened_at || 0) - new Date(b.opened_at || 0))
        const openingFloat = sorted.reduce((sum, s) => sum + Number(s.opening_float || 0), 0)
        const totalIn = sorted.reduce((sum, s) => sum + Number(s.total_in || 0), 0)
        const totalOut = sorted.reduce((sum, s) => sum + Number(s.total_out || 0), 0)
        const allAdjustments = []
        sorted.forEach(s => {
            (Array.isArray(s.adjustments) ? s.adjustments : []).forEach(a => {
                allAdjustments.push({ ...a, staffName: s.staff_name })
            })
        })
        const cashSales = reportData.cashTotal
        const expectedCash = sorted.reduce((sum, s) => {
            const sOpen = Number(s.opening_float || 0)
            const sCash = Number(s.cash_sales || 0)
            const sIn = Number(s.total_in || 0)
            const sOut = Number(s.total_out || 0)
            return sum + Number(s.expected_cash ?? (sOpen + sCash + sIn - sOut))
        }, 0)
        const closedCash = sorted.reduce((sum, s) => {
            const sOpen = Number(s.opening_float || 0)
            const sCash = Number(s.cash_sales || 0)
            const sIn = Number(s.total_in || 0)
            const sOut = Number(s.total_out || 0)
            const sExp = Number(s.expected_cash ?? (sOpen + sCash + sIn - sOut))
            return sum + (s.closed_cash !== null && s.closed_cash !== undefined ? Number(s.closed_cash) : sExp)
        }, 0)
        const difference = closedCash - expectedCash

        return {
            openingFloat,
            cashSales,
            totalIn,
            totalOut,
            expectedCash,
            closedCash,
            difference,
            allAdjustments,
            shiftsCount: sorted.length,
            staffNames: Array.from(new Set(sorted.map(s => s.staff_name).filter(Boolean))).join(', ')
        }
    }, [targetShift, shifts, reportData.cashTotal])

    // Shifts breakdown summary for each individual shift on selectedDate (only when viewing all-day summary)
    const shiftsSummary = useMemo(() => {
        if (targetShift) return [] // Hide shifts breakdown when already viewing a single shift
        if (!shifts || shifts.length === 0) return []

        const sorted = [...shifts].sort((a, b) => new Date(a.opened_at || 0) - new Date(b.opened_at || 0))

        return sorted.map((s, idx) => {
            const staffName = s.staff_name || 'ไม่ระบุพนักงาน'
            const openedAt = s.opened_at ? new Date(s.opened_at) : null
            const closedAt = s.closed_at ? new Date(s.closed_at) : null
            const isOpen = s.status === 'open'
            
            const timeStr = openedAt 
                ? `${openedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - ${isOpen ? 'เปิดอยู่' : (closedAt ? closedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ปิดแล้ว')}`
                : 'ไม่ระบุเวลา'

            const openingFloat = Number(s.opening_float || 0)
            const cashSales = Number(s.cash_sales || 0)
            const qrSales = Number(s.qr_sales || 0)
            const creditSales = Number(s.credit_sales || 0)
            const totalSales = Number(s.total_sales || (cashSales + qrSales + creditSales))
            const closedCash = s.closed_cash !== null && s.closed_cash !== undefined ? Number(s.closed_cash) : null
            const difference = Number(s.difference || 0)
            const txCount = Array.isArray(s.transactions) ? s.transactions.length : 0

            return {
                index: idx + 1,
                id: s.id || `shift_${idx}`,
                staffName,
                timeStr,
                isOpen,
                openingFloat,
                cashSales,
                qrSales,
                creditSales,
                totalSales,
                closedCash,
                difference,
                txCount
            }
        })
    }, [targetShift, shifts])

    /**
     * Bulletproof Full-Slip Image Exporter
     * Renders an unconstrained, detached DOM clone on document.body.
     * Completely eliminates all modal clipping (max-h, overflow-hidden, overflow-y-auto).
     */
    const exportFullSlipImage = async () => {
        if (!slipRef.current) return null
        const element = slipRef.current

        // 1. Create a detached rendering container on document.body without any modal height or scroll constraints
        const container = document.createElement('div')
        container.style.position = 'fixed'
        container.style.left = '-9999px'
        container.style.top = '0'
        container.style.width = '420px'
        container.style.height = 'auto'
        container.style.minHeight = 'auto'
        container.style.maxHeight = 'none'
        container.style.overflow = 'visible'
        container.style.zIndex = '-9999'
        container.style.backgroundColor = '#ffffff'
        container.style.padding = '0'
        container.style.margin = '0'

        // 2. Clone the slip DOM node
        const clone = element.cloneNode(true)
        clone.style.width = '420px'
        clone.style.maxWidth = '420px'
        clone.style.height = 'auto'
        clone.style.minHeight = 'auto'
        clone.style.maxHeight = 'none'
        clone.style.overflow = 'visible'
        clone.style.transform = 'none'
        clone.style.margin = '0'
        clone.style.boxShadow = 'none'

        container.appendChild(clone)
        document.body.appendChild(container)

        // Allow browser layout engine to paint full natural height
        await new Promise(resolve => setTimeout(resolve, 120))

        try {
            const fullWidth = 420
            const fullHeight = Math.max(clone.scrollHeight, clone.offsetHeight, clone.clientHeight)

            // Safe resolution scale: avoid exceeding 4096px canvas texture limit on mobile/Android/iOS
            let scale = 2
            if (fullHeight * scale > 4000) {
                scale = Math.max(1, +(4000 / fullHeight).toFixed(2))
            }

            // 1. Primary: html-to-image toPng on the unconstrained clone
            try {
                const dataUrl = await toPng(clone, {
                    pixelRatio: scale,
                    quality: 0.98,
                    cacheBust: true,
                    skipFonts: true, // Prevents CORS external font download failure
                    fontEmbedCSS: '',
                    backgroundColor: '#F6F2EA',
                    width: fullWidth,
                    height: fullHeight,
                    style: {
                        transform: 'none',
                        margin: '0',
                        maxHeight: 'none',
                        height: `${fullHeight}px`,
                        width: `${fullWidth}px`,
                        boxShadow: 'none',
                        overflow: 'visible'
                    }
                })

                if (dataUrl && dataUrl.length > 5000) {
                    return dataUrl
                }
            } catch (toPngErr) {
                console.warn('toPng on clone failed, trying html2canvas fallback:', toPngErr)
            }

            // 2. Resilient fallback: html2canvas on the unconstrained clone
            const canvas = await html2canvas(clone, {
                scale: scale,
                backgroundColor: '#F6F2EA',
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                x: 0,
                y: 0,
                width: fullWidth,
                height: fullHeight,
                windowWidth: fullWidth + 100,
                windowHeight: fullHeight + 100
            })
            return canvas.toDataURL('image/png', 0.98)
        } finally {
            if (container.parentNode) {
                container.parentNode.removeChild(container)
            }
        }
    }

    // Save Slip as High-Res PNG (Complete, Uncut Slip)
    const handleSavePng = async () => {
        if (saving) return
        setSaving(true)
        try {
            const dataUrl = await exportFullSlipImage()
            if (!dataUrl) throw new Error('ไม่พบข้อมูลสลิป')

            const filename = targetShift
                ? `SHIFT_${(targetShift.staff_name || targetShift.staffName || 'Staff').replace(/\s+/g, '_')}_${selectedDate}.png`
                : `Z_REPORT_${selectedDate}.png`

            const link = document.createElement('a')
            link.download = filename
            link.href = dataUrl
            document.body.appendChild(link)
            link.click()
            setTimeout(() => {
                if (link.parentNode) link.parentNode.removeChild(link)
            }, 100)

            toast.success('บันทึกรูปภาพสลิปครบถ้วนเรียบร้อยแล้ว (PNG)')
        } catch (err) {
            console.error('Failed to export PNG slip:', err)
            toast.error('ไม่สามารถบันทึกรูปภาพได้: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    // Copy Complete Slip Image to Clipboard (Instant LINE Sharing)
    const handleCopyImage = async () => {
        try {
            const dataUrl = await exportFullSlipImage()
            if (!dataUrl) throw new Error('ไม่พบข้อมูลสลิป')

            const res = await fetch(dataUrl)
            const blob = await res.blob()
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ])
            setCopied(true)
            toast.success('คัดลอกรูปสลิปเต็มใบลง Clipboard แล้ว (พร้อมวางส่งเข้า LINE)')
            setTimeout(() => setCopied(false), 2500)
        } catch (err) {
            console.error('Failed to copy image:', err)
            toast.error('เบราว์เซอร์ไม่รองรับการคัดลอกภาพ ให้กดปุ่ม SAVE PNG')
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-[var(--color-veil)] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
            <div className="bg-[var(--color-paper)] rounded-xl max-w-md w-full shadow-[var(--shadow-sheet)] overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Modal Header */}
                <div className="p-3 sm:p-4 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex items-center justify-between font-sans shrink-0">
                    <div>
                        <h3 className="text-base font-bold text-[var(--color-ink)] leading-snug">
                            {targetShift 
                                ? `สลิปสรุปปิดกะ · กะที่ ${targetShift.index || targetShift.shift_number || ''}` 
                                : 'สลิปสรุปยอดปิดวัน'
                            }
                        </h3>
                        <p className="text-xs text-[var(--color-muted)] tabular-nums mt-0.5">
                            {targetShift
                                ? `${targetShift.staff_name || targetShift.staffName || 'พนักงาน'} (${selectedDate})`
                                : `ประจำวันที่ ${selectedDate}`
                            }
                        </p>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-[var(--color-paper-3)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                        title="ปิดหน้าต่าง"
                        aria-label="ปิดหน้าต่าง"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Slip Preview Area: Warm brand cream paper */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-8 bg-[var(--color-paper)] flex justify-center">
                    <div 
                        ref={slipRef}
                        className="w-full max-w-md bg-[var(--color-paper)] p-3 sm:p-4 font-sans text-xs text-[var(--color-ink)] space-y-3.5 select-none"
                    >
                        {/* 1. Shop Header & Metadata */}
                        <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-[var(--color-control-hover)]">
                            <h2 className="text-lg font-bold text-[var(--color-ink)]">{shopName}</h2>
                            <p className="text-xs text-[var(--color-muted)] font-semibold">
                                {targetShift 
                                    ? 'สลิปสรุปปิดกะ (Shift Report)' 
                                    : 'สลิปสรุปยอดปิดวัน (Z-Report)'
                                }
                            </p>
                            {shopPhone && (
                                <p className="text-xs text-[var(--color-neutral)] font-mono tabular-nums">โทร {shopPhone}</p>
                            )}
                            <div className="text-xs text-[var(--color-muted)] pt-1 space-y-0.5 tabular-nums">
                                <div>วันที่ <strong className="text-[var(--color-ink)]">{selectedDate}</strong></div>
                                {targetShift ? (
                                    <>
                                        <div className="font-semibold text-[var(--color-ink)]">
                                            กะที่ {targetShift.index || targetShift.shift_number || '1'} พนักงาน {targetShift.staff_name || targetShift.staffName || 'พนักงาน'}
                                        </div>
                                        <div className="text-[11px] text-[var(--color-neutral)]">
                                            เปิด {targetShift.opened_at ? new Date(targetShift.opened_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} / ปิด {targetShift.closed_at ? new Date(targetShift.closed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : (targetShift.status === 'open' ? 'กำลังเปิดใช้งาน' : '-')}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-[11px] text-[var(--color-neutral)]">
                                            ออกรายงานเมื่อ {new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                                        </div>
                                        <div className="text-[11px] text-[var(--color-neutral)]">
                                            ผู้ตรวจสอบ: ผู้ดูแลระบบ / แคชเชียร์
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 2. Main Revenue Card (Strictly Settled Sales) */}
                        <div className="bg-[var(--color-paper-2)] p-3.5 rounded-lg border border-[var(--color-paper-3)] space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-[var(--color-muted)]">
                                    ยอดขายสุทธิ
                                </span>
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)] font-semibold">
                                    เช็คบิลแล้ว
                                </span>
                            </div>
                            
                            <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--color-ink)] tracking-tight tabular-nums">
                                ฿{reportData.settledNetRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>

                            <div className="text-xs text-[var(--color-neutral)] pt-1.5 border-t border-[var(--color-paper-3)] flex justify-between tabular-nums">
                                <span>บิลปิดสำเร็จ <strong className="text-[var(--color-ink)]">{reportData.completedCount} บิล</strong></span>
                                <span>ยกเลิก <strong className="text-[var(--color-ink)]">{reportData.cancelledCount} บิล</strong></span>
                            </div>

                            {reportData.totalDiscounts > 0 && (
                                <div className="text-xs text-[var(--color-neutral)] flex justify-between tabular-nums">
                                    <span>ยอดรวมก่อนลด ฿{reportData.grossSettledRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    <span className="text-[var(--brand-plum)] font-semibold">ส่วนลด -฿{reportData.totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                        </div>

                        {/* 2.5 Individual Shifts Breakdown (ยอดขายแยกตามกะ) */}
                        {shiftsSummary.length > 0 && (
                            <div className="space-y-2 pt-1.5 border-t border-dashed border-[var(--color-rule)]">
                                <div className="text-xs font-bold text-[var(--color-ink)] border-b border-[var(--color-paper-3)] pb-1 flex justify-between items-center">
                                    <span>ยอดขายแยกตามกะ</span>
                                    <span className="text-[11px] font-normal text-[var(--color-neutral)] tabular-nums">{shiftsSummary.length} กะ</span>
                                </div>
                                <div className="space-y-1.5">
                                    {shiftsSummary.map((s) => (
                                        <div key={s.id} className="bg-[var(--color-paper-2)] border border-[var(--color-paper-3)] p-2.5 rounded-lg space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="font-semibold flex items-center gap-1.5 min-w-0">
                                                    <span className="text-[11px] px-1.5 py-0.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-md text-[var(--color-muted)] shrink-0">
                                                        กะ {s.index}
                                                    </span>
                                                    <span className="text-[var(--color-ink)] font-bold truncate max-w-[150px]">
                                                        {s.staffName}
                                                    </span>
                                                </div>
                                                <span className="font-bold font-mono text-xs text-[var(--color-ink)] tabular-nums">
                                                    ฿{s.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-[var(--color-neutral)] tabular-nums">
                                                <span>เวลา {s.timeStr}</span>
                                                {s.txCount > 0 && <span>{s.txCount} บิล</span>}
                                            </div>
                                            <div className="pt-1 border-t border-[var(--color-paper-3)] flex items-center justify-between text-[11px] tabular-nums">
                                                <span className="text-[var(--color-muted)]">
                                                    เงินสด <strong>฿{s.cashSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                                </span>
                                                <span className="text-[var(--status-ok-ink)]">
                                                    โอน QR <strong>฿{s.qrSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                                </span>
                                                {s.creditSales > 0 && (
                                                    <span className="text-[var(--color-muted)]">
                                                        บัตร <strong>฿{s.creditSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between font-bold pt-1 border-t border-[var(--color-paper-3)] text-xs tabular-nums">
                                    <span>รวมยอดทุกกะ ({shiftsSummary.reduce((acc, s) => acc + s.txCount, 0)} บิล)</span>
                                    <span className="font-mono">฿{shiftsSummary.reduce((acc, s) => acc + s.totalSales, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        )}

                        {/* 3. Warning Alert for Active Unpaid Tables (If any tables still open) */}
                        {reportData.activeCount > 0 && (
                            <div className="p-2.5 bg-[var(--color-plum-pale)] border border-[var(--color-plum-border)] rounded-lg space-y-1 text-xs">
                                <div className="flex items-center justify-between font-bold text-[var(--brand-plum)] tabular-nums">
                                    <span className="flex items-center gap-1.5">
                                        <AlertCircle size={13} />
                                        <span>ยังมีโต๊ะค้างชำระ ({reportData.activeCount} โต๊ะ)</span>
                                    </span>
                                    <span className="font-mono">฿{reportData.activeUnpaidTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="space-y-0.5 text-[11px] text-[var(--color-muted)] pt-1 border-t border-[var(--color-plum-border)] tabular-nums">
                                    {reportData.activeTablesList.map((t, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span>{t.name} ({t.itemsCount} รายการ)</span>
                                            <span className="font-semibold font-mono">฿{t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[11px] text-[var(--color-neutral)] pt-1">
                                    ยอดนี้ยังไม่เช็คบิล จึงยังไม่ถูกรวมในยอดขายสุทธิ
                                </div>
                            </div>
                        )}

                        {/* 4. Payment Methods Breakdown (Strictly Realized) */}
                        <div className="space-y-1.5 pt-1">
                            <div className="text-xs font-bold text-[var(--color-ink)] border-b border-[var(--color-paper-3)] pb-1 flex justify-between items-center">
                                <span>ช่องทางรับชำระ</span>
                                <span className="text-[11px] font-normal text-[var(--color-neutral)]">จำนวน / ยอดเงิน</span>
                            </div>
                            <div className="space-y-1 text-xs tabular-nums">
                                <div className="flex justify-between items-center">
                                    <span className="text-[var(--color-muted)]">เงินสด</span>
                                    <span className="font-semibold font-mono">
                                        {reportData.cashCount > 0 ? `${reportData.cashCount} บิล · ` : ''}฿{reportData.cashTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[var(--color-muted)]">PromptPay QR</span>
                                    <span className="font-semibold font-mono text-[var(--status-ok-ink)]">
                                        {reportData.qrCount > 0 ? `${reportData.qrCount} บิล · ` : ''}฿{reportData.qrTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[var(--color-muted)]">บัตรเครดิต</span>
                                    <span className="font-semibold font-mono">
                                        {reportData.creditCount > 0 ? `${reportData.creditCount} บิล · ` : ''}฿{reportData.creditTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 4.5 Cash Drawer & Reconciliation (รอบลิ้นชักและเงินสด) */}
                        {drawerData && (
                            <div className="space-y-1.5 pt-1.5 border-t border-dashed border-[var(--color-rule)] text-xs">
                                <div className="text-xs font-bold text-[var(--color-ink)] border-b border-[var(--color-paper-3)] pb-1 flex justify-between items-center gap-2">
                                    <span className="truncate">ลิ้นชักเงินสด ({drawerData.shiftsCount} กะ)</span>
                                    <span className="text-[11px] font-normal text-[var(--color-neutral)] truncate max-w-[140px]">{drawerData.staffNames}</span>
                                </div>
                                <div className="space-y-1 text-xs tabular-nums">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[var(--color-muted)]">เงินทอนตั้งต้น</span>
                                        <span className="font-semibold font-mono">฿{drawerData.openingFloat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[var(--color-muted)]">+ ขายเงินสด</span>
                                        <span className="font-semibold font-mono text-[var(--status-ok-ink)]">+฿{drawerData.cashSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    {drawerData.totalIn > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-[var(--color-muted)]">+ เงินนำเข้าลิ้นชัก</span>
                                            <span className="font-semibold font-mono text-[var(--status-ok-ink)]">+฿{drawerData.totalIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {drawerData.totalOut > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-[var(--color-muted)]">- เงินนำออกลิ้นชัก</span>
                                            <span className="font-semibold font-mono text-[var(--brand-plum)]">-฿{drawerData.totalOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-1 border-t border-[var(--color-paper-3)] font-bold">
                                        <span>เงินที่ควรมีในลิ้นชัก</span>
                                        <span className="font-mono">฿{drawerData.expectedCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>เงินสดนับจริง</span>
                                        <span className="font-bold font-mono">฿{drawerData.closedCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-[var(--color-neutral)]">ส่วนต่าง</span>
                                        <span className={`font-bold font-mono ${Math.abs(drawerData.difference) < 0.01 ? 'text-[var(--status-ok-ink)]' : 'text-[var(--brand-plum)]'}`}>
                                            {Math.abs(drawerData.difference) < 0.01 ? '0.00 (ตรงพอดี)' : (drawerData.difference > 0 ? `+฿${drawerData.difference.toFixed(2)}` : `-฿${Math.abs(drawerData.difference).toFixed(2)}`)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 5. Sales by Category (ยอดขายแยกตามหมวดหมู่) */}
                        {reportData.categorySales.length > 0 && (
                            <div className="space-y-1.5 pt-1.5 border-t border-dashed border-[var(--color-rule)]">
                                <div className="text-xs font-bold text-[var(--color-ink)] border-b border-[var(--color-paper-3)] pb-1 flex justify-between items-center">
                                    <span>ยอดขายตามหมวดหมู่</span>
                                    <span className="text-[11px] font-normal text-[var(--color-neutral)]">จำนวน / ยอดเงิน</span>
                                </div>
                                <div className="space-y-1 text-xs tabular-nums">
                                    {reportData.categorySales.map((cat, idx) => (
                                        <div key={idx} className="flex justify-between items-center gap-2">
                                            <span className="truncate max-w-[190px] text-[var(--color-ink-soft)]">
                                                {cat.name}
                                            </span>
                                            <span className="font-semibold font-mono shrink-0">
                                                {cat.qty}x (฿{cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-bold pt-1 border-t border-[var(--color-paper-3)] text-xs">
                                        <span>รวมทุกหมวดหมู่ ({reportData.totalItemsSold} ชิ้น)</span>
                                        <span className="font-mono">฿{reportData.settledNetRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 6. Top 5 Best-Selling Items */}
                        {reportData.topItems.length > 0 && (
                            <div className="space-y-1.5 pt-1.5 border-t border-dashed border-[var(--color-rule)]">
                                <div className="text-xs font-bold text-[var(--color-ink)] border-b border-[var(--color-paper-3)] pb-1">
                                    5 เมนูขายดี
                                </div>
                                <div className="space-y-1 text-xs tabular-nums">
                                    {reportData.topItems.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center gap-2">
                                            <span className="truncate max-w-[210px]">
                                                {idx + 1}. {item.name}
                                            </span>
                                            <span className="font-semibold font-mono shrink-0">
                                                {item.qty}x (฿{item.total.toLocaleString()})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 7. Service Mix & Channels Breakdown */}
                        <div className="space-y-1.5 pt-1.5 border-t border-dashed border-[var(--color-rule)] text-xs">
                            <div className="text-xs font-bold text-[var(--color-ink)] border-b border-[var(--color-paper-3)] pb-1">
                                ประเภทบริการและช่องทางขาย
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
                                <div className="space-y-1">
                                    <span className="text-[11px] text-[var(--color-neutral)] font-semibold block">ประเภทบริการ</span>
                                    <div className="flex justify-between">
                                        <span>ทานที่ร้าน</span>
                                        <span className="font-semibold">{reportData.dineInSettledCount} บิล</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>รับกลับบ้าน</span>
                                        <span className="font-semibold">{reportData.pickupSettledCount} บิล</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[11px] text-[var(--color-neutral)] font-semibold block">ช่องทางขาย</span>
                                    <div className="flex justify-between">
                                        <span>หน้าร้าน</span>
                                        <span className="font-semibold">{reportData.walkinCount} บิล</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>เดลิเวอรี่</span>
                                        <span className="font-semibold">{reportData.linemanCount} บิล</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 8. Operational Performance & Guest Statistics */}
                        <div className="space-y-1.5 pt-1.5 border-t border-dashed border-[var(--color-rule)] text-xs tabular-nums">
                            <div className="text-xs font-bold text-[var(--color-ink)] border-b border-[var(--color-paper-3)] pb-1">
                                สถิติการขาย
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--color-muted)]">จำนวนลูกค้าทั้งหมด</span>
                                <span className="font-semibold">{reportData.totalGuests} ท่าน</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--color-muted)]">ยอดขายเฉลี่ยต่อบิล</span>
                                <span className="font-semibold font-mono">฿{reportData.avgPerBill.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--color-muted)]">ยอดขายเฉลี่ยต่อท่าน</span>
                                <span className="font-semibold font-mono">฿{reportData.avgPerGuest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {/* 9. Tax Status Notice (Strictly NON-VAT per Store Settings) */}
                        <div className="pt-1.5 border-t border-dashed border-[var(--color-rule)]">
                            {isVatEnabled ? (
                                <div className="space-y-1 text-xs tabular-nums">
                                    <div className="text-xs font-bold text-[var(--color-ink)] pb-1">
                                        สรุปภาษีมูลค่าเพิ่ม (VAT 7%)
                                    </div>
                                    <div className="flex justify-between">
                                        <span>ยอดก่อนภาษี</span>
                                        <span className="font-mono">฿{(reportData.settledNetRevenue / 1.07).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                                        <span className="font-mono">฿{(reportData.settledNetRevenue - (reportData.settledNetRevenue / 1.07)).toFixed(2)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[var(--color-paper-2)] p-2.5 rounded-lg text-center space-y-0.5">
                                    <div className="text-xs font-semibold text-[var(--color-ink-soft)]">
                                        ไม่คิดภาษีมูลค่าเพิ่ม (Non-VAT)
                                    </div>
                                    <div className="text-[11px] text-[var(--color-neutral)]">
                                        ร้านค้ายังไม่เปิดระบบ VAT 7% ยอดทั้งหมดเป็นยอดสุทธิ
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 10. Audit Verification & Sign-off Footer */}
                        <div className="pt-2.5 border-t-2 border-dashed border-[var(--color-control-hover)] text-center text-xs text-[var(--color-neutral)] space-y-1.5">
                            <div className="pt-0.5 text-xs font-semibold text-[var(--color-ink-soft)]">
                                {targetShift ? 'ตรวจสอบรายงานปิดกะเรียบร้อย' : 'ตรวจสอบรายงานปิดวันเรียบร้อย'}
                            </div>
                            <div className="pt-1.5 border-t border-[var(--color-paper-3)] flex justify-between items-end text-[11px] text-[var(--color-neutral)] tabular-nums">
                                <div>
                                    <span>ออกรายงาน {new Date().toLocaleTimeString('th-TH')}</span>
                                </div>
                                <div className="text-right">
                                    <span>ผู้ตรวจสอบ ______________</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer Controls - Digital First (No Hardware Printing) */}
                <div className="p-3 sm:p-4 bg-[var(--color-paper-2)] border-t border-[var(--color-rule)] flex flex-wrap items-center justify-between gap-2 font-sans text-xs shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-[40px] px-3.5 py-2 border border-[var(--color-rule)] bg-[var(--color-paper)] hover:bg-[var(--color-paper-3)] rounded-lg font-semibold text-[var(--color-muted)] transition-colors cursor-pointer whitespace-nowrap"
                    >
                        ปิดหน้าต่าง
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Copy Image Button */}
                        <button
                            type="button"
                            onClick={handleCopyImage}
                            className="min-h-[40px] px-3.5 py-2 bg-[var(--color-paper)] hover:bg-[var(--color-paper-3)] text-[var(--color-ink)] border border-[var(--color-rule)] rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            title="คัดลอกรูปภาพลง Clipboard สำหรับส่งเข้า LINE"
                        >
                            {copied ? <Check size={14} className="text-[var(--status-ok-ink)]" /> : <Copy size={14} />}
                            <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกรูป'}</span>
                        </button>

                        {/* Save PNG Button */}
                        <button
                            type="button"
                            onClick={handleSavePng}
                            disabled={saving}
                            className="min-h-[40px] px-4 py-2 bg-[var(--color-ink)] hover:bg-[var(--action-primary-hover)] text-[var(--color-paper)] rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                            <Download size={14} />
                            <span>{saving ? 'กำลังบันทึก…' : 'บันทึกภาพ PNG'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
