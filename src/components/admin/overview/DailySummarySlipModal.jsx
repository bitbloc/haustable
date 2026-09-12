/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useRef, useState, useMemo, useEffect } from 'react'
import { X, Download, Copy, Printer, Check, AlertCircle } from 'lucide-react'
import { toPng } from 'html-to-image'
import html2canvas from 'html2canvas'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabaseClient'
import { getThaiDate } from '../../../utils/timeUtils'
import { getBookingPaymentBreakdown } from '../../../pos/POSReportsPanel'
import { printToSunmiBuiltIn, encodeShiftClosureReportData, compileShiftReportData } from '../../../utils/printerHelper'

export default function DailySummarySlipModal({
    bookings = [],
    shifts = [],
    selectedDate = getThaiDate(),
    companySettings = {},
    onClose,
    onPrintSlip
}) {
    const slipRef = useRef(null)
    const [saving, setSaving] = useState(false)
    const [copied, setCopied] = useState(false)
    const [printing, setPrinting] = useState(false)
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

    // Drawer reconciliation metrics aggregated across all shifts on selectedDate
    const drawerData = useMemo(() => {
        if (!shifts || shifts.length === 0) return null

        const sorted = [...shifts].sort((a, b) => new Date(a.opened_at || 0) - new Date(b.opened_at || 0))
        const openingFloat = Number(sorted[0]?.opening_float || 0)
        const totalIn = sorted.reduce((sum, s) => sum + Number(s.total_in || 0), 0)
        const totalOut = sorted.reduce((sum, s) => sum + Number(s.total_out || 0), 0)
        const allAdjustments = []
        sorted.forEach(s => {
            (Array.isArray(s.adjustments) ? s.adjustments : []).forEach(a => {
                allAdjustments.push({ ...a, staffName: s.staff_name })
            })
        })
        const cashSales = reportData.cashTotal
        const expectedCash = openingFloat + cashSales + totalIn - totalOut
        const closedCash = Number(sorted[sorted.length - 1]?.closed_cash ?? expectedCash)
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
    }, [shifts, reportData.cashTotal])

    // Shifts breakdown summary for each individual shift on selectedDate
    const shiftsSummary = useMemo(() => {
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
    }, [shifts])

    /**
     * Bulletproof Full-Slip Image Exporter
     * Captures the complete, uncut slip from top to bottom on both desktop and mobile devices.
     * Prevents viewport clipping and Android/iOS GPU canvas dimension truncation.
     */
    const exportFullSlipImage = async () => {
        if (!slipRef.current) return null
        const element = slipRef.current

        // 1. Temporarily scroll the modal container to top (0) so the entire element is at the origin
        const scrollContainer = element.closest('.overflow-y-auto') || element.parentElement
        const originalScrollTop = scrollContainer ? scrollContainer.scrollTop : 0
        if (scrollContainer) {
            scrollContainer.scrollTop = 0
        }

        // Allow browser layout engine to paint at top
        await new Promise(resolve => setTimeout(resolve, 80))

        try {
            const fullWidth = Math.max(element.scrollWidth, element.offsetWidth, 360)
            const fullHeight = Math.max(element.scrollHeight, element.offsetHeight)

            // Safe dynamic pixelRatio: mobile GPU hardware limit for canvas height is 4096px
            let scale = 2
            if (fullHeight * scale > 4000) {
                scale = Math.max(1, +(4000 / fullHeight).toFixed(2))
            }

            // 1. Primary: html-to-image toPng with skipFonts & explicit full dimensions
            try {
                const dataUrl = await toPng(element, {
                    pixelRatio: scale,
                    quality: 0.98,
                    cacheBust: true,
                    skipFonts: true, // Prevents CORS font download failure in WebView / local
                    backgroundColor: '#ffffff',
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
                console.warn('toPng failed, trying html2canvas fallback:', toPngErr)
            }

            // 2. Resilient fallback: html2canvas with full dimensions & zeroed scroll offsets
            const canvas = await html2canvas(element, {
                scale: scale,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                x: 0,
                y: 0,
                width: fullWidth,
                height: fullHeight,
                windowWidth: fullWidth + 100,
                windowHeight: fullHeight + 100,
                onclone: (clonedDoc, clonedElement) => {
                    clonedElement.style.height = `${fullHeight}px`
                    clonedElement.style.maxHeight = 'none'
                    clonedElement.style.overflow = 'visible'
                    clonedElement.style.position = 'static'
                    clonedElement.style.transform = 'none'
                }
            })
            return canvas.toDataURL('image/png', 0.98)
        } finally {
            // Restore user's scroll position
            if (scrollContainer) {
                scrollContainer.scrollTop = originalScrollTop
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

            const link = document.createElement('a')
            link.download = `Z_REPORT_${selectedDate}.png`
            link.href = dataUrl
            document.body.appendChild(link)
            link.click()
            setTimeout(() => {
                if (link.parentNode) link.parentNode.removeChild(link)
            }, 100)

            toast.success('บันทึกรูปภาพสลิปสรุปยอดปิดวันครบถ้วนเรียบร้อยแล้ว (PNG)')
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

    // Isolated Thermal Receipt Browser Printing (1 single clean page, no 4-page dashboard spillover)
    const printSlipToBrowser = () => {
        if (!slipRef.current) return

        const iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = '0'
        iframe.style.visibility = 'hidden'
        document.body.appendChild(iframe)

        const doc = iframe.contentWindow.document
        doc.open()

        // Include current stylesheets so Tailwind styling and typography are preserved
        let stylesHtml = ''
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
            stylesHtml += node.outerHTML
        })

        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>สลิปสรุปยอดปิดวัน // ${selectedDate}</title>
                ${stylesHtml}
                <style>
                    @page {
                        size: 80mm auto;
                        margin: 2mm;
                    }
                    @media print {
                        html, body {
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #ffffff !important;
                        }
                    }
                    * {
                        box-sizing: border-box !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body {
                        background: #ffffff !important;
                        margin: 0 auto !important;
                        padding: 4px !important;
                        width: 76mm !important;
                        max-width: 76mm !important;
                        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace !important;
                    }
                </style>
            </head>
            <body>
                <div style="width: 74mm; margin: 0 auto; background: #ffffff;">
                    ${slipRef.current.innerHTML}
                </div>
            </body>
            </html>
        `)
        doc.close()

        setTimeout(() => {
            try {
                iframe.contentWindow.focus()
                iframe.contentWindow.print()
            } catch (e) {
                console.error('Print iframe error:', e)
            } finally {
                setTimeout(() => {
                    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
                }, 2000)
            }
        }, 250)
    }

    // Direct Thermal Receipt Printing (Sunmi Built-In or isolated iframe print fallback)
    const handlePrint = async () => {
        if (printing) return
        setPrinting(true)
        try {
            if (typeof onPrintSlip === 'function') {
                await onPrintSlip()
                setPrinting(false)
                return
            }

            const dayShift = {
                staffName: drawerData?.staffNames || 'ADMIN / CASHIER',
                openedAt: bookings.length > 0 ? bookings[bookings.length - 1].booking_time : new Date().toISOString(),
                closedAt: new Date().toISOString(),
                openingFloat: drawerData?.openingFloat ?? 0,
                expectedCash: drawerData?.expectedCash ?? reportData.cashTotal,
                closedCash: drawerData?.closedCash ?? reportData.cashTotal,
                difference: drawerData?.difference ?? 0,
                cashSales: reportData.cashTotal,
                qrSales: reportData.qrTotal,
                creditSales: reportData.creditTotal,
                totalSales: reportData.settledNetRevenue,
                totalIn: drawerData?.totalIn ?? 0,
                totalOut: drawerData?.totalOut ?? 0,
                adjustments: drawerData?.allAdjustments ?? [],
                shifts: shiftsSummary
            }

            const compiledReport = compileShiftReportData(dayShift, bookings, categories)
            const rawBytes = encodeShiftClosureReportData(compiledReport, '80mm', 'sunmi')
            const printed = await printToSunmiBuiltIn(rawBytes)

            if (printed) {
                toast.success('สั่งพิมพ์สลิปสรุปยอดออกเครื่องพิมพ์ Thermal สำเร็จ')
            } else {
                printSlipToBrowser()
            }
        } catch (err) {
            console.error('Print failed, using browser printer:', err)
            printSlipToBrowser()
        } finally {
            setPrinting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Modal Header */}
                <div className="p-3 sm:p-4 bg-[oklch(98%_0.006_28)] border-b border-[oklch(85%_0.012_28)] flex items-center justify-between font-mono shrink-0">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-[oklch(55%_0.010_28)]">
                            DAILY SALES Z-REPORT AUDIT
                        </span>
                        <h3 className="text-sm md:text-base font-black text-[oklch(18%_0.012_28)] uppercase tracking-tight">
                            สลิปสรุปยอดปิดวัน // {selectedDate}
                        </h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-sm hover:bg-[oklch(90%_0.012_28)] text-[oklch(42%_0.010_28)] hover:text-black transition-colors cursor-pointer"
                        title="ปิดหน้าต่าง"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Slip Preview Area: Full white background on both desktop and mobile */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-8 bg-white flex justify-center">
                    <div 
                        ref={slipRef}
                        className="w-full max-w-md bg-white p-2 sm:p-3 font-mono text-xs text-[oklch(18%_0.012_28)] space-y-3 select-none"
                    >
                        {/* 1. Shop Header & Metadata */}
                        <div className="text-center space-y-1 pb-2.5 border-b-2 border-dashed border-[oklch(80%_0.012_28)]">
                            <h2 className="text-base font-black tracking-widest uppercase">{shopName}</h2>
                            <p className="text-[10px] text-[oklch(42%_0.010_28)] font-bold uppercase tracking-wider">
                                DAILY SALES Z-REPORT (สลิปปิดวัน)
                            </p>
                            {shopPhone && (
                                <p className="text-[9px] text-[oklch(55%_0.010_28)]">TEL: {shopPhone}</p>
                            )}
                            <div className="text-[10px] text-[oklch(42%_0.010_28)] pt-1 space-y-0.5">
                                <div>วันที่: <strong>{selectedDate}</strong></div>
                                <div className="text-[9px] text-[oklch(55%_0.010_28)]">
                                    เวลาพิมพ์: {new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                                </div>
                                <div className="text-[9px] text-[oklch(55%_0.010_28)] uppercase">
                                    ผู้ตรวจสอบ: ADMIN / CASHIER
                                </div>
                            </div>
                        </div>

                        {/* 2. Main Revenue Card (Strictly Settled Sales) */}
                        <div className="bg-[oklch(98%_0.006_28)] p-3 rounded-sm border border-[oklch(88%_0.010_28)] space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase tracking-wider">
                                    TOTAL NET SALES (ยอดขายสุทธิ)
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-xs bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] font-bold">
                                    เช็คบิลแล้ว
                                </span>
                            </div>
                            
                            <div className="text-2xl sm:text-3xl font-black text-[oklch(18%_0.012_28)] tracking-tight">
                                ฿{reportData.settledNetRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>

                            <div className="text-[10px] text-[oklch(55%_0.010_28)] pt-1 border-t border-[oklch(90%_0.008_28)] flex justify-between">
                                <span>บิลปิดสำเร็จ: <strong>{reportData.completedCount} บิล</strong></span>
                                <span>ยกเลิก: <strong>{reportData.cancelledCount} บิล</strong></span>
                            </div>

                            {reportData.totalDiscounts > 0 && (
                                <div className="text-[10px] text-[oklch(55%_0.010_28)] flex justify-between">
                                    <span>ยอดรวมก่อนลด: ฿{reportData.grossSettledRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    <span className="text-[oklch(52%_0.16_28)] font-bold">ส่วนลด: -฿{reportData.totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                        </div>

                        {/* 2.5 Individual Shifts Breakdown (ยอดขายแยกตามกะ) */}
                        {shiftsSummary.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-dashed border-[oklch(85%_0.012_28)]">
                                <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider border-b border-[oklch(88%_0.010_28)] pb-1 flex justify-between">
                                    <span>SHIFTS SUMMARY (ยอดขายแยกตามกะ)</span>
                                    <span className="text-[9px] font-normal text-[oklch(55%_0.010_28)]">{shiftsSummary.length} กะ</span>
                                </div>
                                <div className="space-y-1.5">
                                    {shiftsSummary.map((s) => (
                                        <div key={s.id} className="bg-[oklch(98%_0.006_28)] border border-[oklch(90%_0.008_28)] p-2 rounded-xs space-y-1">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <div className="font-bold flex items-center gap-1.5">
                                                    <span className="text-[9px] px-1 py-0.2 bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-xs uppercase text-[oklch(42%_0.010_28)]">
                                                        กะ {s.index}
                                                    </span>
                                                    <span className="text-[oklch(18%_0.012_28)] font-black truncate max-w-[150px]">
                                                        {s.staffName}
                                                    </span>
                                                </div>
                                                <span className="font-black text-xs text-[oklch(18%_0.012_28)]">
                                                    ฿{s.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[9px] text-[oklch(55%_0.010_28)]">
                                                <span>เวลา: {s.timeStr}</span>
                                                {s.txCount > 0 && <span>{s.txCount} บิล</span>}
                                            </div>
                                            <div className="pt-1 border-t border-[oklch(92%_0.008_28)] flex items-center justify-between text-[10px]">
                                                <span className="text-[oklch(42%_0.010_28)]">
                                                    เงินสด: <strong>฿{s.cashSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                                </span>
                                                <span className="text-emerald-900">
                                                    QR: <strong>฿{s.qrSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                                </span>
                                                {s.creditSales > 0 && (
                                                    <span className="text-[oklch(42%_0.010_28)]">
                                                        บัตร: <strong>฿{s.creditSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between font-bold pt-1 border-t border-[oklch(90%_0.008_28)] text-[11px]">
                                    <span>รวมยอดทุกกะ ({shiftsSummary.reduce((acc, s) => acc + s.txCount, 0)} บิล):</span>
                                    <span>฿{shiftsSummary.reduce((acc, s) => acc + s.totalSales, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        )}

                        {/* 3. Warning Alert for Active Unpaid Tables (If any tables still open) */}
                        {reportData.activeCount > 0 && (
                            <div className="p-2.5 bg-[oklch(97%_0.012_28)] border border-[oklch(82%_0.08_28)] rounded-xs space-y-1 text-[10px]">
                                <div className="flex items-center justify-between font-bold text-[oklch(52%_0.16_28)]">
                                    <span className="flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        <span>ยังมีโต๊ะค้างชำระ ({reportData.activeCount} โต๊ะ)</span>
                                    </span>
                                    <span>฿{reportData.activeUnpaidTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="space-y-0.5 text-[9px] text-[oklch(42%_0.010_28)] pt-0.5 border-t border-[oklch(88%_0.012_28)]">
                                    {reportData.activeTablesList.map((t, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span>• {t.name} ({t.itemsCount} รายการ)</span>
                                            <span className="font-bold">฿{t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[9px] text-[oklch(55%_0.010_28)] pt-1 italic">
                                    * ยอดนี้ยังไม่เช็คบิล จึงยังไม่ถูกรวมในยอดขายสุทธิ
                                </div>
                            </div>
                        )}

                        {/* 4. Payment Methods Breakdown (Strictly Realized) */}
                        <div className="space-y-1 pt-1">
                            <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider border-b border-[oklch(88%_0.010_28)] pb-1 flex justify-between">
                                <span>PAYMENT BREAKDOWN (ช่องทางชำระ)</span>
                                <span className="text-[9px] font-normal text-[oklch(55%_0.010_28)]">จำนวน / ยอดเงิน</span>
                            </div>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-[oklch(42%_0.010_28)]">เงินสด (CASH):</span>
                                    <span className="font-bold">
                                        {reportData.cashCount > 0 ? `${reportData.cashCount} บิล · ` : ''}฿{reportData.cashTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[oklch(42%_0.010_28)]">PROMPTPAY QR:</span>
                                    <span className="font-bold text-emerald-900">
                                        {reportData.qrCount > 0 ? `${reportData.qrCount} บิล · ` : ''}฿{reportData.qrTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[oklch(42%_0.010_28)]">บัตรเครดิต (CREDIT):</span>
                                    <span className="font-bold">
                                        {reportData.creditCount > 0 ? `${reportData.creditCount} บิล · ` : ''}฿{reportData.creditTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 4.5 Cash Drawer & Reconciliation (รอบลิ้นชักและเงินสด) */}
                        {drawerData && (
                            <div className="space-y-1 pt-1 border-t border-dashed border-[oklch(85%_0.012_28)] text-xs">
                                <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider border-b border-[oklch(88%_0.010_28)] pb-1 flex justify-between">
                                    <span>CASH DRAWER ({drawerData.shiftsCount} กะ · {drawerData.staffNames})</span>
                                    <span className="text-[9px] font-normal text-[oklch(55%_0.010_28)]">ยอดเงิน</span>
                                </div>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[oklch(42%_0.010_28)]">เงินทอนตั้งต้น:</span>
                                        <span className="font-bold">฿{drawerData.openingFloat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[oklch(42%_0.010_28)]">+ ขายเงินสด:</span>
                                        <span className="font-bold text-emerald-900">+฿{drawerData.cashSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    {drawerData.totalIn > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-[oklch(42%_0.010_28)]">+ เงินนำเข้าลิ้นชัก:</span>
                                            <span className="font-bold text-emerald-900">+฿{drawerData.totalIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {drawerData.totalOut > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-[oklch(42%_0.010_28)]">- เงินนำออกลิ้นชัก:</span>
                                            <span className="font-bold text-[oklch(52%_0.16_28)]">-฿{drawerData.totalOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-0.5 border-t border-[oklch(90%_0.008_28)] font-bold">
                                        <span>= เงินที่ควรมีในลิ้นชัก:</span>
                                        <span>฿{drawerData.expectedCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>เงินสดนับจริง:</span>
                                        <span className="font-black">฿{drawerData.closedCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-[oklch(55%_0.010_28)]">ส่วนต่าง:</span>
                                        <span className={`font-bold ${Math.abs(drawerData.difference) < 0.01 ? 'text-[oklch(35%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'}`}>
                                            {Math.abs(drawerData.difference) < 0.01 ? '0.00 (ยอดตรงพอดี ✓)' : (drawerData.difference > 0 ? `+฿${drawerData.difference.toFixed(2)}` : `-฿${Math.abs(drawerData.difference).toFixed(2)}`)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 5. Sales by Category (ยอดขายแยกตามหมวดหมู่) */}
                        {reportData.categorySales.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-dashed border-[oklch(85%_0.012_28)]">
                                <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider border-b border-[oklch(88%_0.010_28)] pb-1 flex justify-between">
                                    <span>SALES BY CATEGORY (ยอดขายตามหมวด)</span>
                                    <span className="text-[9px] font-normal text-[oklch(55%_0.010_28)]">จำนวน / ยอดเงิน</span>
                                </div>
                                <div className="space-y-1 text-xs">
                                    {reportData.categorySales.map((cat, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <span className="truncate max-w-[190px] text-[oklch(35%_0.010_28)]">
                                                {cat.name}
                                            </span>
                                            <span className="font-bold shrink-0">
                                                {cat.qty}x (฿{cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-bold pt-1 border-t border-[oklch(90%_0.008_28)] text-[11px]">
                                        <span>รวมทุกหมวดหมู่ ({reportData.totalItemsSold} ชิ้น):</span>
                                        <span>฿{reportData.settledNetRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 6. Top 5 Best-Selling Items */}
                        {reportData.topItems.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-dashed border-[oklch(85%_0.012_28)]">
                                <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider border-b border-[oklch(88%_0.010_28)] pb-1">
                                    TOP 5 BEST-SELLERS (5 เมนูขายดี)
                                </div>
                                <div className="space-y-1 text-[11px]">
                                    {reportData.topItems.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <span className="truncate max-w-[210px]">
                                                {idx + 1}. {item.name}
                                            </span>
                                            <span className="font-bold shrink-0">
                                                {item.qty}x (฿{item.total.toLocaleString()})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 7. Service Mix & Channels Breakdown */}
                        <div className="space-y-1 pt-1 border-t border-dashed border-[oklch(85%_0.012_28)] text-xs">
                            <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider border-b border-[oklch(88%_0.010_28)] pb-1">
                                SERVICE MIX & CHANNELS (ประเภทและช่องทาง)
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div className="space-y-0.5">
                                    <span className="text-[9px] uppercase text-[oklch(55%_0.010_28)] font-bold">ประเภทบริการ:</span>
                                    <div className="flex justify-between">
                                        <span>ทานที่ร้าน:</span>
                                        <span className="font-bold">{reportData.dineInSettledCount} บิล</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>รับกลับบ้าน:</span>
                                        <span className="font-bold">{reportData.pickupSettledCount} บิล</span>
                                    </div>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-[9px] uppercase text-[oklch(55%_0.010_28)] font-bold">ช่องทางขาย:</span>
                                    <div className="flex justify-between">
                                        <span>หน้าร้าน:</span>
                                        <span className="font-bold">{reportData.walkinCount} บิล</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>เดลิเวอรี่:</span>
                                        <span className="font-bold">{reportData.linemanCount} บิล</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 8. Operational Performance & Guest Statistics */}
                        <div className="space-y-1 pt-1 border-t border-dashed border-[oklch(85%_0.012_28)] text-[11px]">
                            <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider border-b border-[oklch(88%_0.010_28)] pb-1">
                                SALES STATISTICS (สถิติการขาย)
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(42%_0.010_28)]">จำนวนลูกค้าทั้งหมด (PAX):</span>
                                <span className="font-bold">{reportData.totalGuests} ท่าน</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(42%_0.010_28)]">ยอดขายเฉลี่ยต่อบิล:</span>
                                <span className="font-bold">฿{reportData.avgPerBill.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(42%_0.010_28)]">ยอดขายเฉลี่ยต่อหัว (PAX):</span>
                                <span className="font-bold">฿{reportData.avgPerGuest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {/* 9. Tax Status Notice (Strictly NON-VAT per Store Settings) */}
                        <div className="pt-1.5 border-t border-dashed border-[oklch(85%_0.012_28)]">
                            {isVatEnabled ? (
                                <div className="space-y-1 text-xs">
                                    <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider pb-1">
                                        TAX SUMMARY (สรุปภาษี VAT 7%)
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span>ยอดก่อนภาษี:</span>
                                        <span>฿{(reportData.settledNetRevenue / 1.07).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span>ภาษีมูลค่าเพิ่ม (7%):</span>
                                        <span>฿{(reportData.settledNetRevenue - (reportData.settledNetRevenue / 1.07)).toFixed(2)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[oklch(96%_0.008_28)] p-2 rounded-xs text-center space-y-0.5">
                                    <div className="text-[10px] font-bold text-[oklch(35%_0.010_28)] uppercase tracking-wider">
                                        NON-VAT REGISTERED (ไม่คิดภาษีมูลค่าเพิ่ม)
                                    </div>
                                    <div className="text-[9px] text-[oklch(55%_0.010_28)]">
                                        ร้านค้ายังไม่เปิดระบบ VAT 7% · ยอดทั้งหมดเป็นยอดสุทธิ
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 10. Audit Verification & Sign-off Footer */}
                        <div className="pt-2 border-t-2 border-dashed border-[oklch(80%_0.012_28)] text-center text-[10px] text-[oklch(55%_0.010_28)] space-y-1.5">
                            <div className="pt-0.5 text-[9px] uppercase tracking-widest font-bold text-[oklch(35%_0.010_28)]">
                                DAILY Z-REPORT AUDITED & VERIFIED
                            </div>
                            <div className="pt-1.5 border-t border-[oklch(90%_0.008_28)] flex justify-between items-end text-[9px] text-[oklch(50%_0.010_28)]">
                                <div>
                                    <span>เวลาปิดรายงาน: {new Date().toLocaleTimeString('th-TH')}</span>
                                </div>
                                <div className="text-right">
                                    <span>ผู้ตรวจสอบ: ______________</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="p-3 sm:p-4 bg-white border-t border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between gap-2 font-mono text-xs shrink-0 shadow-lg">
                    <button
                        onClick={onClose}
                        className="px-3.5 py-2 border border-[oklch(85%_0.012_28)] hover:bg-[oklch(95%_0.010_28)] rounded-sm font-bold text-[oklch(42%_0.010_28)] transition-colors cursor-pointer"
                    >
                        ปิดหน้าต่าง
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Thermal Print Button */}
                        <button
                            onClick={handlePrint}
                            disabled={printing}
                            className="px-3 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="พิมพ์ออกเครื่องพิมพ์ความร้อน (Thermal 80mm)"
                        >
                            <Printer size={14} />
                            <span>{printing ? 'กำลังพิมพ์...' : 'พิมพ์สลิป'}</span>
                        </button>

                        {/* Copy Image Button */}
                        <button
                            onClick={handleCopyImage}
                            className="px-3 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="คัดลอกรูปภาพลง Clipboard สำหรับส่งเข้า LINE"
                        >
                            {copied ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                            <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกรูป'}</span>
                        </button>

                        {/* Save PNG Button */}
                        <button
                            onClick={handleSavePng}
                            disabled={saving}
                            className="px-4 py-2 bg-[oklch(18%_0.012_28)] hover:bg-black text-white rounded-sm font-black flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                        >
                            <Download size={14} />
                            <span>{saving ? 'กำลังบันทึก...' : 'SAVE PNG SLIP'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
