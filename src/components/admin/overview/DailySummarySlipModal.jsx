/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useRef, useState, useMemo } from 'react'
import { X, Download, Copy, Printer, Check, FileText } from 'lucide-react'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'
import { formatThaiTimeOnly, getThaiDate } from '../../../utils/timeUtils'
import { getBookingPaymentBreakdown } from '../../../pos/POSReportsPanel'

export default function DailySummarySlipModal({
    bookings = [],
    selectedDate = getThaiDate(),
    onClose,
    onPrintSlip
}) {
    const slipRef = useRef(null)
    const [saving, setSaving] = useState(false)
    const [copied, setCopied] = useState(false)

    // Compute comprehensive daily financial and sales metrics
    const reportData = useMemo(() => {
        let totalRev = 0
        let completedCount = 0
        let cancelledCount = 0
        let seatedCount = 0
        let pendingCount = 0

        let cashTotal = 0
        let qrTotal = 0
        let creditTotal = 0

        let dineInCount = 0
        let pickupCount = 0

        // Item popularity tracker
        const itemMap = new Map()

        ;(bookings || []).forEach(b => {
            const amt = parseFloat(b.total_amount || b.total_price || 0)
            const isCompleted = b.status === 'completed' || b.status === 'paid' || b.status === 'success'

            if (isCompleted) {
                totalRev += amt
                completedCount++

                // Payment breakdown
                const breakdown = getBookingPaymentBreakdown(b)
                cashTotal += breakdown.cash
                qrTotal += breakdown.qr
                creditTotal += breakdown.credit

                // Item aggregation
                ;(b.order_items || []).forEach(item => {
                    const name = item.custom_name || item.menu_items?.name || item.name || 'Custom Item'
                    const qty = item.quantity || 1
                    const price = parseFloat(item.price_at_time || item.menu_items?.price || item.price || 0)
                    const total = price * qty

                    if (itemMap.has(name)) {
                        const existing = itemMap.get(name)
                        existing.qty += qty
                        existing.total += total
                    } else {
                        itemMap.set(name, { name, qty, total })
                    }
                })
            } else if (b.status === 'cancelled' || b.status === 'void') {
                cancelledCount++
            } else if (b.status === 'seated') {
                seatedCount++
            } else if (b.status === 'pending') {
                pendingCount++
            }

            const bType = (b.booking_type || 'dine_in').toLowerCase()
            if (bType === 'dine_in' || bType === 'walk_in') dineInCount++
            else pickupCount++
        })

        // Sort Top 5 Items
        const topItems = Array.from(itemMap.values())
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5)

        // VAT 7% Breakdown
        const netBeforeVat = totalRev / 1.07
        const vatAmount = totalRev - netBeforeVat

        return {
            totalRev,
            completedCount,
            cancelledCount,
            seatedCount,
            pendingCount,
            totalBills: bookings.length,
            cashTotal,
            qrTotal,
            creditTotal,
            dineInCount,
            pickupCount,
            topItems,
            netBeforeVat,
            vatAmount
        }
    }, [bookings])

    // Save Slip as High-Res PNG
    const handleSavePng = async () => {
        if (!slipRef.current || saving) return
        setSaving(true)
        try {
            const dataUrl = await toPng(slipRef.current, {
                pixelRatio: 3,
                quality: 1.0,
                cacheBust: true,
                style: {
                    transform: 'none',
                    margin: '0',
                }
            })

            const link = document.createElement('a')
            link.download = `DAILY_SUMMARY_${selectedDate}.png`
            link.href = dataUrl
            link.click()

            toast.success('บันทึกรูปภาพสลิปสรุปยอดวันเรียบร้อยแล้ว (PNG)')
        } catch (err) {
            console.error('Failed to export PNG slip:', err)
            toast.error('ไม่สามารถบันทึกรูปภาพได้: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    // Copy Slip Image to Clipboard
    const handleCopyImage = async () => {
        if (!slipRef.current) return
        try {
            const dataUrl = await toPng(slipRef.current, {
                pixelRatio: 3,
                quality: 1.0,
                cacheBust: true
            })
            const res = await fetch(dataUrl)
            const blob = await res.blob()
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ])
            setCopied(true)
            toast.success('คัดลอกรูปสลิปลง Clipboard แล้ว (พร้อมส่งเข้า LINE)')
            setTimeout(() => setCopied(false), 2500)
        } catch (err) {
            console.error('Failed to copy image:', err)
            toast.error('เบราว์เซอร์ไม่รองรับการคัดลอกภาพโดยตรง ให้กดปุ่ม Save PNG')
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Modal Header */}
                <div className="p-4 bg-[oklch(98%_0.006_28)] border-b border-[oklch(85%_0.012_28)] flex items-center justify-between font-mono">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-[oklch(55%_0.010_28)]">
                            DAILY SALES Z-REPORT EXPORTER
                        </span>
                        <h3 className="text-sm md:text-base font-black text-[oklch(18%_0.012_28)] uppercase tracking-tight">
                            สลิปสรุปยอดปิดวัน // {selectedDate}
                        </h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-sm hover:bg-[oklch(90%_0.012_28)] text-[oklch(42%_0.010_28)] hover:text-black transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Slip Preview Area (Styled as 80mm Thermal Receipt) */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[oklch(95%_0.008_28)] flex justify-center">
                    <div 
                        ref={slipRef}
                        className="w-full max-w-[360px] bg-white p-5 rounded-xs border border-[oklch(85%_0.012_28)] shadow-md font-mono text-xs text-[oklch(18%_0.012_28)] space-y-3.5 select-none"
                    >
                        {/* Shop Header */}
                        <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-[oklch(80%_0.012_28)]">
                            <h2 className="text-base font-black tracking-widest uppercase">IN THE HAUS</h2>
                            <p className="text-[10px] text-[oklch(42%_0.010_28)] font-semibold">DAILY SALES CLOSE SUMMARY</p>
                            <div className="text-[10px] text-[oklch(55%_0.010_28)] pt-1">
                                DATE: <strong>{selectedDate}</strong>
                            </div>
                            <div className="text-[9px] text-[oklch(55%_0.010_28)]">
                                PRINTED: {new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                            </div>
                        </div>

                        {/* Grand Revenue Total */}
                        <div className="bg-[oklch(98%_0.006_28)] p-3 rounded-sm border border-[oklch(88%_0.010_28)] space-y-1">
                            <div className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase">
                                TOTAL NET SALES (ยอดขายสุทธิ)
                            </div>
                            <div className="text-2xl font-black text-[oklch(18%_0.012_28)] tracking-tight">
                                ฿{reportData.totalRev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-[oklch(55%_0.010_28)] flex justify-between pt-1 border-t border-[oklch(90%_0.008_28)]">
                                <span>บิลปิดสำเร็จ: {reportData.completedCount} บิล</span>
                                <span>ยกเลิก: {reportData.cancelledCount} บิล</span>
                            </div>
                        </div>

                        {/* Payment Methods Breakdown */}
                        <div className="space-y-1.5 pt-1">
                            <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider border-b border-[oklch(88%_0.010_28)] pb-1">
                                PAYMENT BREAKDOWN (แยกตามช่องทาง)
                            </div>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-[oklch(42%_0.010_28)]">เงินสด (CASH):</span>
                                    <span className="font-bold">฿{reportData.cashTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[oklch(42%_0.010_28)]">PROMPTPAY QR:</span>
                                    <span className="font-bold text-emerald-900">฿{reportData.qrTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[oklch(42%_0.010_28)]">บัตรเครดิต (CREDIT):</span>
                                    <span className="font-bold">฿{reportData.creditTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Tax & Invoicing Summary */}
                        <div className="space-y-1.5 pt-2 border-t border-dashed border-[oklch(85%_0.012_28)]">
                            <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider border-b border-[oklch(88%_0.010_28)] pb-1">
                                TAX BREAKDOWN (สรุปภาษี VAT 7%)
                            </div>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-[oklch(42%_0.010_28)]">ยอดก่อนภาษี (BEFORE VAT):</span>
                                    <span>฿{reportData.netBeforeVat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[oklch(42%_0.010_28)]">ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                                    <span>฿{reportData.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between font-black pt-1 border-t border-[oklch(90%_0.008_28)]">
                                    <span>ยอดรวมสุทธิ (GRAND TOTAL):</span>
                                    <span className="text-sm">฿{reportData.totalRev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Top Best-Selling Items */}
                        {reportData.topItems.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-dashed border-[oklch(85%_0.012_28)]">
                                <div className="text-[10px] font-black text-[oklch(42%_0.010_28)] uppercase tracking-wider border-b border-[oklch(88%_0.010_28)] pb-1">
                                    TOP BEST-SELLERS (5 เมนูขายดี)
                                </div>
                                <div className="space-y-1 text-[11px]">
                                    {reportData.topItems.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <span className="truncate max-w-[200px]">
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

                        {/* Service Mix & Footer */}
                        <div className="pt-3 border-t-2 border-dashed border-[oklch(80%_0.012_28)] text-center text-[10px] text-[oklch(55%_0.010_28)] space-y-1">
                            <div className="flex justify-between font-bold">
                                <span>ทานที่ร้าน (DINE-IN): {reportData.dineInCount}</span>
                                <span>รับกลับ (PICKUP): {reportData.pickupCount}</span>
                            </div>
                            <div className="pt-2 text-[9px] uppercase tracking-widest">
                                END OF DAY REPORT VERIFIED
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="p-4 bg-white border-t border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-[oklch(85%_0.012_28)] hover:bg-[oklch(95%_0.010_28)] rounded-sm font-bold text-[oklch(42%_0.010_28)] transition-colors"
                    >
                        ปิดหน้าต่าง
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Copy Image Button */}
                        <button
                            onClick={handleCopyImage}
                            className="px-3.5 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm font-bold flex items-center gap-1.5 transition-colors"
                            title="คัดลอกรูปภาพลง Clipboard"
                        >
                            {copied ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                            <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกรูป'}</span>
                        </button>

                        {/* Save PNG Button */}
                        <button
                            onClick={handleSavePng}
                            disabled={saving}
                            className="px-4 py-2 bg-[oklch(18%_0.012_28)] hover:bg-black text-white rounded-sm font-black flex items-center gap-1.5 transition-colors shadow-sm"
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
