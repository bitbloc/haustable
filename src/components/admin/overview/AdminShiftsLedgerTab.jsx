/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo, useEffect } from 'react'
import { ChevronDown, ChevronUp, ArrowDownLeft, ArrowUpRight, Lock, CheckCircle2, AlertTriangle, Clock, Printer, ShoppingBag } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { classifyAdjustmentNote } from './DailyShiftsCashFlowWidget'
import { printToSunmiBuiltIn, compileShiftReportData, encodeShiftClosureReportData } from '../../../utils/printerHelper'
import { fetchShiftBookings } from '../../../utils/shiftHelper'
import { toast } from 'sonner'

export default function AdminShiftsLedgerTab({
    shifts = [],
    loading = false,
    selectedDate = '',
    onRefreshShifts = null
}) {
    const [expandedShiftId, setExpandedShiftId] = useState(null)
    const [shiftTopSellers, setShiftTopSellers] = useState({})
    const [sellersLoading, setSellersLoading] = useState({})
    const [companySettings, setCompanySettings] = useState(() => {
        try {
            const stored = localStorage.getItem('onhaus_tax_settings')
            return stored ? JSON.parse(stored) : {}
        } catch {
            return {}
        }
    })

    // Sort shifts chronologically
    const sortedShifts = useMemo(() => {
        return [...(shifts || [])].sort((a, b) => new Date(a.opened_at || 0) - new Date(b.opened_at || 0))
    }, [shifts])

    // Load top sellers for expanded shift on demand
    useEffect(() => {
        if (!expandedShiftId) return
        if (shiftTopSellers[expandedShiftId]) return

        const targetShift = sortedShifts.find(s => s.id === expandedShiftId)
        if (!targetShift) return

        const fetchSellers = async () => {
            setSellersLoading(prev => ({ ...prev, [expandedShiftId]: true }))
            try {
                const data = await fetchShiftBookings(
                    supabase,
                    targetShift,
                    `
                        id,
                        status,
                        total_amount,
                        order_items (
                            quantity,
                            price_at_time,
                            custom_name,
                            menu_items ( name, price )
                        )
                    `
                )

                const itemCounts = {}
                ;(data || []).forEach(b => {
                    b.order_items?.forEach(item => {
                        const name = item.custom_name || item.menu_items?.name || 'รายการทั่วไป'
                        const qty = Number(item.quantity || 1)
                        const price = Number(item.price_at_time || item.menu_items?.price || 0)
                        if (!itemCounts[name]) {
                            itemCounts[name] = { name, quantity: 0, amount: 0 }
                        }
                        itemCounts[name].quantity += qty
                        itemCounts[name].amount += (qty * price)
                    })
                })

                const sorted = Object.values(itemCounts)
                    .sort((a, b) => b.quantity - a.quantity || b.amount - a.amount)
                    .slice(0, 10)

                setShiftTopSellers(prev => ({ ...prev, [expandedShiftId]: sorted }))
            } catch (err) {
                console.error('Failed to fetch shift sellers:', err)
            } finally {
                setSellersLoading(prev => ({ ...prev, [expandedShiftId]: false }))
            }
        }

        fetchSellers()
    }, [expandedShiftId, sortedShifts, shiftTopSellers])

    const handlePrintHistoricalShift = async (shift) => {
        try {
            const toastId = toast.loading(`กำลังดึงข้อมูลและเตรียมพิมพ์รายงานกะของ ${shift.staff_name || 'Staff'}...`)

            // 1. Fetch full bookings for this shift
            const bookingsData = await fetchShiftBookings(
                supabase,
                shift,
                `
                    *,
                    tables_layout (table_name),
                    order_items (
                        id,
                        quantity,
                        price_at_time,
                        menu_item_id,
                        status,
                        destination,
                        custom_name,
                        menu_items (
                            name,
                            category_id
                        )
                    )
                `
            )

            // 2. Fetch menu categories
            const { data: categoriesData } = await supabase
                .from('menu_categories')
                .select('id, name')

            const shiftPayload = {
                id: shift.id,
                staffName: shift.staff_name || 'Staff',
                openedAt: shift.opened_at,
                closedAt: shift.closed_at || new Date().toISOString(),
                openingFloat: Number(shift.opening_float || 0),
                cashSales: Number(shift.cash_sales || 0),
                qrSales: Number(shift.qr_sales || 0),
                creditSales: Number(shift.credit_sales || 0),
                totalSales: Number(shift.total_sales || 0),
                totalIn: Number(shift.total_in || 0),
                totalOut: Number(shift.total_out || 0),
                expectedCash: Number(shift.expected_cash || 0),
                closedCash: shift.closed_cash !== null ? Number(shift.closed_cash) : null,
                difference: Number(shift.difference || 0),
                adjustments: Array.isArray(shift.adjustments) ? shift.adjustments : []
            }

            const compiled = compileShiftReportData(shiftPayload, bookingsData || [], categoriesData || [])
            const encoded = encodeShiftClosureReportData(compiled)
            const success = await printToSunmiBuiltIn(encoded)
            toast.dismiss(toastId)
            if (success) {
                toast.success(`พิมพ์รายงานสรุปกะของ ${shift.staff_name} สำเร็จ`)
            } else {
                toast.error('ไม่พบเครื่องพิมพ์ Sunmi หรือระบบสั่งพิมพ์ไม่ตอบสนอง')
            }
        } catch (err) {
            console.error('Print error:', err)
            toast.error('เกิดข้อผิดพลาดในการสั่งพิมพ์รายงานกะ')
        }
    }

    return (
        <div className="space-y-4 font-mono">
            {/* Top Overview Strip */}
            <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(45%_0.08_140)] bg-[oklch(92%_0.012_140)] px-2 py-0.5 rounded-xs">
                            MASTER SHIFT LEDGER
                        </span>
                        <span className="text-xs text-[oklch(55%_0.010_28)] font-bold">
                            // ประวัติกะและการเคลื่อนไหวเงินสดประจำวัน
                        </span>
                    </div>
                    <div className="text-sm font-bold text-[oklch(18%_0.012_28)] mt-1">
                        บันทึกกะทั้งหมดประจำวันที่ {selectedDate}
                    </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                        <div className="text-[10px] text-[oklch(55%_0.010_28)] uppercase">จำนวนกะทั้งหมด</div>
                        <div className="text-base font-bold text-[oklch(18%_0.012_28)] tabular-nums">{sortedShifts.length} กะ</div>
                    </div>
                    <div className="h-7 w-px bg-[oklch(85%_0.012_28)]" />
                    <div className="text-right">
                        <div className="text-[10px] text-[oklch(55%_0.010_28)] uppercase">เงินสดเข้าลิ้นชักรวม</div>
                        <div className="text-base font-bold text-[oklch(35%_0.08_140)] tabular-nums">
                            +฿{sortedShifts.reduce((acc, s) => acc + Number(s.total_in || 0), 0).toLocaleString()}
                        </div>
                    </div>
                    <div className="h-7 w-px bg-[oklch(85%_0.012_28)]" />
                    <div className="text-right">
                        <div className="text-[10px] text-[oklch(55%_0.010_28)] uppercase">เงินสดเบิกจ่ายรวม</div>
                        <div className="text-base font-bold text-[oklch(52%_0.16_28)] tabular-nums">
                            -฿{sortedShifts.reduce((acc, s) => acc + Number(s.total_out || 0), 0).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Shifts Table */}
            {sortedShifts.length === 0 ? (
                <div className="p-12 text-center bg-white border border-[oklch(85%_0.012_28)] rounded-sm">
                    <p className="text-xs font-bold text-[oklch(42%_0.010_28)] uppercase tracking-wider">
                        ไม่พบข้อมูลกะในวันที่ {selectedDate}
                    </p>
                    <p className="text-[11px] text-[oklch(55%_0.010_28)] mt-1">
                        ระบบจะบันทึกกะอัตโนมัติเมื่อแคชเชียร์ทำการเปิดกะผ่านหน้าจอขายหน้าร้าน (POS)
                    </p>
                </div>
            ) : (
                <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-sm overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-[oklch(95%_0.008_28)] border-b border-[oklch(85%_0.012_28)] text-[9px] uppercase tracking-wider text-[oklch(42%_0.010_28)] select-none">
                                    <th className="py-3 px-3.5 w-8">#</th>
                                    <th className="py-3 px-3">พนักงาน / กะ</th>
                                    <th className="py-3 px-3">เวลาเปิด</th>
                                    <th className="py-3 px-3">เวลาปิด</th>
                                    <th className="py-3 px-3 text-right">เงินทอนเปิดกะ</th>
                                    <th className="py-3 px-3 text-right text-[oklch(35%_0.08_140)]">ขายเงินสด</th>
                                    <th className="py-3 px-3 text-right text-[oklch(35%_0.08_140)]">+ นำเข้า (IN)</th>
                                    <th className="py-3 px-3 text-right text-[oklch(52%_0.16_28)]">- นำออก (OUT)</th>
                                    <th className="py-3 px-3 text-right">เงินที่ควรมี</th>
                                    <th className="py-3 px-3 text-right">นับจริง</th>
                                    <th className="py-3 px-3 text-right">ส่วนต่าง</th>
                                    <th className="py-3 px-3 text-center w-24">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[oklch(90%_0.010_28)]">
                                {sortedShifts.map((s, idx) => {
                                    const isOpen = s.status === 'open'
                                    const isExpanded = expandedShiftId === s.id
                                    const openTime = s.opened_at ? new Date(s.opened_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '-'
                                    const closeTime = isOpen ? 'กำลังเปิดใช้งาน 🟢' : s.closed_at ? new Date(s.closed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '-'
                                    const fl = Number(s.opening_float || 0)
                                    const cs = Number(s.cash_sales || 0)
                                    const tIn = Number(s.total_in || 0)
                                    const tOut = Number(s.total_out || 0)
                                    const exp = Number(s.expected_cash ?? (fl + cs + tIn - tOut))
                                    const cl = Number(s.closed_cash || 0)
                                    const diff = Number(s.difference ?? (isOpen ? 0 : (cl - exp)))
                                    const adjs = Array.isArray(s.adjustments) ? s.adjustments : []

                                    return (
                                        <React.Fragment key={s.id || idx}>
                                            <tr 
                                                onClick={() => setExpandedShiftId(prev => prev === s.id ? null : s.id)}
                                                className={`hover:bg-[oklch(96%_0.008_28)] cursor-pointer transition-colors ${
                                                    isExpanded ? 'bg-[oklch(96%_0.008_28)]' : ''
                                                }`}
                                            >
                                                {/* Index & Expand Icon */}
                                                <td className="py-3 px-3.5 text-[oklch(55%_0.010_28)]">
                                                    {isExpanded ? <ChevronUp size={13} className="text-[oklch(52%_0.16_28)]" /> : <ChevronDown size={13} />}
                                                </td>

                                                {/* Staff / Shift */}
                                                <td className="py-3 px-3 font-bold text-[oklch(18%_0.012_28)]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>กะ {idx + 1}: {s.staff_name || 'Staff'}</span>
                                                        {isOpen && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)] animate-pulse" />
                                                        )}
                                                    </div>
                                                    <div className="text-[9px] text-[oklch(55%_0.010_28)] font-normal">
                                                        ID: {String(s.id).replace('shift_', '')}
                                                    </div>
                                                </td>

                                                {/* Open Time */}
                                                <td className="py-3 px-3 text-[oklch(50%_0.010_28)] tabular-nums">
                                                    {openTime}
                                                </td>

                                                {/* Close Time */}
                                                <td className="py-3 px-3 tabular-nums">
                                                    {isOpen ? (
                                                        <span className="text-[10px] text-[oklch(45%_0.08_140)] font-bold">
                                                            กำลังเปิด 🟢
                                                        </span>
                                                    ) : (
                                                        <span className="text-[oklch(50%_0.010_28)]">{closeTime}</span>
                                                    )}
                                                </td>

                                                {/* Float */}
                                                <td className="py-3 px-3 text-right tabular-nums text-[oklch(42%_0.010_28)]">
                                                    ฿{fl.toLocaleString()}
                                                </td>

                                                {/* Cash Sales */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[oklch(35%_0.08_140)]">
                                                    +฿{cs.toLocaleString()}
                                                </td>

                                                {/* Total In */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[oklch(35%_0.08_140)]">
                                                    +฿{tIn.toLocaleString()}
                                                </td>

                                                {/* Total Out */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[oklch(52%_0.16_28)]">
                                                    -฿{tOut.toLocaleString()}
                                                </td>

                                                {/* Expected Cash */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[oklch(18%_0.012_28)]">
                                                    ฿{exp.toLocaleString()}
                                                </td>

                                                {/* Closed Cash */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[oklch(42%_0.010_28)]">
                                                    {isOpen ? '-' : `฿${cl.toLocaleString()}`}
                                                </td>

                                                {/* Discrepancy */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold">
                                                    {isOpen ? (
                                                        <span className="text-[oklch(55%_0.010_28)] font-normal">—</span>
                                                    ) : Math.abs(diff) < 0.01 ? (
                                                        <span className="text-[oklch(35%_0.08_140)]">ตรงยอดพอดี</span>
                                                    ) : diff > 0 ? (
                                                        <span className="text-[oklch(35%_0.08_140)]">+฿{diff.toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-[oklch(52%_0.16_28)]">-฿{Math.abs(diff).toLocaleString()}</span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrintHistoricalShift(s)}
                                                        className="px-2 py-1 bg-white hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-xs text-[10px] font-bold text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors cursor-pointer inline-flex items-center gap-1"
                                                        title="พิมพ์ใบสรุปปิดกะ (Shift Slip)"
                                                    >
                                                        <Printer size={11} />
                                                        <span>พิมพ์สลิป</span>
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Expanded Shift Drawer */}
                                            {isExpanded && (
                                                <tr className="bg-[oklch(97%_0.008_28)]">
                                                    <td colSpan="12" className="p-4 border-t border-b border-[oklch(85%_0.012_28)]">
                                                        <div className="grid md:grid-cols-2 gap-5">
                                                            {/* Column 1: Adjustments (บอกว่าเงินเข้า-ออกใช้ทำอะไรบ้าง) */}
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-center justify-between text-[11px] font-bold text-[oklch(18%_0.012_28)]">
                                                                    <span>รายการเงินเข้า - ออกในกะนี้ (CASH ADJUSTMENTS)</span>
                                                                    <span className="text-[10px] text-[oklch(55%_0.010_28)]">{adjs.length} รายการ</span>
                                                                </div>

                                                                {adjs.length === 0 ? (
                                                                    <div className="py-6 text-center border border-dashed border-[oklch(85%_0.012_28)] rounded-xs bg-white text-xs text-[oklch(55%_0.010_28)]">
                                                                        ไม่มีการนำเงินเข้าหรือเบิกเงินสดระหว่างกะนี้
                                                                    </div>
                                                                ) : (
                                                                    <div className="border border-[oklch(85%_0.012_28)] rounded-xs overflow-hidden bg-white max-h-[220px] overflow-y-auto no-scrollbar">
                                                                        <table className="w-full text-left border-collapse text-xs">
                                                                            <thead>
                                                                                <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[8px] uppercase tracking-wider text-[oklch(42%_0.010_28)] select-none sticky top-0">
                                                                                    <th className="py-2 px-2.5 w-16">เวลา</th>
                                                                                    <th className="py-2 px-2.5 w-20">ประเภท</th>
                                                                                    <th className="py-2 px-2.5 text-right w-24">จำนวน</th>
                                                                                    <th className="py-2 px-2.5">เหตุผลว่าใช้ทำอะไร (NOTE)</th>
                                                                                    <th className="py-2 px-2.5 w-24">หมวดหมู่</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-[oklch(92%_0.010_28)]">
                                                                                {adjs.map((adj, aIdx) => {
                                                                                    const isIn = adj.type === 'in'
                                                                                    const cat = classifyAdjustmentNote(adj.note, adj.type)
                                                                                    const aTime = adj.timestamp ? new Date(adj.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '-'
                                                                                    return (
                                                                                        <tr key={adj.id || aIdx} className="hover:bg-[oklch(96%_0.008_28)]">
                                                                                            <td className="py-2 px-2.5 text-[9px] text-[oklch(50%_0.010_28)] tabular-nums">{aTime}</td>
                                                                                            <td className="py-2 px-2.5">
                                                                                                <span className={`px-1 py-0.2 rounded-2xs text-[8px] font-bold uppercase ${
                                                                                                    isIn ? 'bg-[oklch(92%_0.04_140)] text-[oklch(35%_0.08_140)]' : 'bg-[oklch(92%_0.04_28)] text-[oklch(40%_0.14_28)]'
                                                                                                }`}>
                                                                                                    {isIn ? 'เงินเข้า' : 'เงินออก'}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className={`py-2 px-2.5 text-right font-bold tabular-nums text-xs ${
                                                                                                isIn ? 'text-[oklch(35%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'
                                                                                            }`}>
                                                                                                {isIn ? `+฿${Number(adj.amount || 0).toLocaleString()}` : `-฿${Number(adj.amount || 0).toLocaleString()}`}
                                                                                            </td>
                                                                                            <td className="py-2 px-2.5 font-medium text-[11px] text-[oklch(18%_0.012_28)]">
                                                                                                {adj.note || '-'}
                                                                                            </td>
                                                                                            <td className="py-2 px-2.5 text-[9px]">
                                                                                                <span className={`px-1 py-0.2 rounded-2xs border ${cat.color}`}>
                                                                                                    {cat.label}
                                                                                                </span>
                                                                                            </td>
                                                                                        </tr>
                                                                                    )
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Column 2: Shift Sales Breakdown & Top Sellers */}
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-center justify-between text-[11px] font-bold text-[oklch(18%_0.012_28)]">
                                                                    <span>สรุปยอดขาย & เมนูขายดีประจำกะ (TOP SELLERS)</span>
                                                                    <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                                                        ยอดขายรวม: ฿{Number(s.total_sales || 0).toLocaleString()}
                                                                    </span>
                                                                </div>

                                                                {/* Sales Channel Sub-bar */}
                                                                <div className="grid grid-cols-3 gap-2 text-center text-[10px] bg-white border border-[oklch(85%_0.012_28)] p-2 rounded-xs">
                                                                    <div>
                                                                        <div className="text-[oklch(55%_0.010_28)]">เงินสด</div>
                                                                        <div className="font-bold text-[oklch(18%_0.012_28)] tabular-nums">฿{Number(s.cash_sales || 0).toLocaleString()}</div>
                                                                    </div>
                                                                    <div className="border-l border-r border-[oklch(90%_0.010_28)]">
                                                                        <div className="text-[oklch(55%_0.010_28)]">PromptPay QR</div>
                                                                        <div className="font-bold text-[oklch(18%_0.012_28)] tabular-nums">฿{Number(s.qr_sales || 0).toLocaleString()}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[oklch(55%_0.010_28)]">บัตรเครดิต</div>
                                                                        <div className="font-bold text-[oklch(18%_0.012_28)] tabular-nums">฿{Number(s.credit_sales || 0).toLocaleString()}</div>
                                                                    </div>
                                                                </div>

                                                                {/* Top Items Table */}
                                                                <div className="border border-[oklch(85%_0.012_28)] rounded-xs overflow-hidden bg-white max-h-[170px] overflow-y-auto no-scrollbar">
                                                                    {sellersLoading[s.id] ? (
                                                                        <div className="py-8 text-center text-[11px] text-[oklch(55%_0.010_28)]">
                                                                            กำลังโหลดรายการสินค้าในกะ...
                                                                        </div>
                                                                    ) : (shiftTopSellers[s.id] || []).length === 0 ? (
                                                                        <div className="py-8 text-center text-[11px] text-[oklch(55%_0.010_28)]">
                                                                            ยังไม่มีรายการออเดอร์ที่เช็คบิลเสร็จสิ้นในกะนี้
                                                                        </div>
                                                                    ) : (
                                                                        <table className="w-full text-left border-collapse text-xs">
                                                                            <thead>
                                                                                <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[8px] uppercase tracking-wider text-[oklch(42%_0.010_28)] sticky top-0">
                                                                                    <th className="py-2 px-2.5">รายการอาหาร/เครื่องดื่ม</th>
                                                                                    <th className="py-2 px-2.5 text-right w-16">จำนวน</th>
                                                                                    <th className="py-2 px-2.5 text-right w-24">ยอดเงิน</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-[oklch(92%_0.010_28)]">
                                                                                {(shiftTopSellers[s.id] || []).map((item, iIdx) => (
                                                                                    <tr key={iIdx} className="hover:bg-[oklch(96%_0.008_28)]">
                                                                                        <td className="py-2 px-2.5 font-medium text-[11px] text-[oklch(18%_0.012_28)]">
                                                                                            {item.name}
                                                                                        </td>
                                                                                        <td className="py-2 px-2.5 text-right font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                                                                            {item.quantity}
                                                                                        </td>
                                                                                        <td className="py-2 px-2.5 text-right font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                                                                            ฿{Number(item.amount || 0).toLocaleString()}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
