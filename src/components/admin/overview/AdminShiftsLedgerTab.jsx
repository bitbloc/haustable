/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { ChevronDown, ChevronUp, ArrowDownLeft, ArrowUpRight, Lock, CheckCircle2, AlertTriangle, Clock, FileText, ShoppingBag } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { classifyAdjustmentNote } from './DailyShiftsCashFlowWidget'
import { fetchShiftBookings } from '../../../utils/shiftHelper'
import { toast } from 'sonner'

const DailySummarySlipModal = lazy(() => import('./DailySummarySlipModal'))

export default function AdminShiftsLedgerTab({
    shifts = [],
    selectedDate = ''
}) {
    const [expandedShiftId, setExpandedShiftId] = useState(null)
    const [selectedShiftSlip, setSelectedShiftSlip] = useState(null)
    const [loadingShiftId, setLoadingShiftId] = useState(null)
    const [shiftTopSellers, setShiftTopSellers] = useState({})
    const [sellersLoading, setSellersLoading] = useState({})
    const [companySettings] = useState(() => {
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

    const handleOpenShiftSlip = async (shift, idx) => {
        try {
            setLoadingShiftId(shift.id)
            const toastId = toast.loading(`กำลังโหลดข้อมูลสลิปของ ${shift.staff_name || 'Staff'}...`)

            // Fetch full bookings for this shift
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
                            category_id,
                            price
                        )
                    )
                `
            )
            toast.dismiss(toastId)
            setSelectedShiftSlip({
                shift: { ...shift, index: idx + 1 },
                bookings: bookingsData || []
            })
        } catch (err) {
            console.error('Fetch shift slip error:', err)
            toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลสลิปปิดกะ')
        } finally {
            setLoadingShiftId(null)
        }
    }

    return (
        <div className="space-y-4 tabular-nums">
            {/* Top Overview Strip */}
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-[var(--status-ok-ink)] bg-[var(--status-ok-bg)] px-2 py-0.5 rounded-md">
                            บันทึกกะ POS
                        </span>
                        <span className="text-xs text-[var(--color-neutral)] font-medium">
                            ประวัติกะและการเคลื่อนไหวเงินสดประจำวัน
                        </span>
                    </div>
                    <div className="text-sm font-bold text-[var(--color-ink)] mt-1">
                        บันทึกกะทั้งหมดประจำวันที่ {selectedDate}
                    </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                        <div className="text-xs text-[var(--color-neutral)]">จำนวนกะทั้งหมด</div>
                        <div className="text-base font-bold text-[var(--color-ink)] tabular-nums">{sortedShifts.length} กะ</div>
                    </div>
                    <div className="h-7 w-px bg-[var(--color-rule)]" />
                    <div className="text-right">
                        <div className="text-xs text-[var(--color-neutral)]">เงินสดเข้าลิ้นชักรวม</div>
                        <div className="text-base font-bold text-[var(--status-ok-ink)] tabular-nums">
                            +฿{sortedShifts.reduce((acc, s) => acc + Number(s.total_in || 0), 0).toLocaleString()}
                        </div>
                    </div>
                    <div className="h-7 w-px bg-[var(--color-rule)]" />
                    <div className="text-right">
                        <div className="text-xs text-[var(--color-neutral)]">เงินสดเบิกจ่ายรวม</div>
                        <div className="text-base font-bold text-[var(--brand-plum)] tabular-nums">
                            -฿{sortedShifts.reduce((acc, s) => acc + Number(s.total_out || 0), 0).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Shifts Table */}
            {sortedShifts.length === 0 ? (
                <div className="p-12 text-center bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl">
                    <p className="text-[13px] font-bold text-[var(--color-muted)]">
                        ไม่พบข้อมูลกะในวันที่ {selectedDate}
                    </p>
                    <p className="text-[13px] text-[var(--color-neutral)] mt-1">
                        ระบบจะบันทึกกะอัตโนมัติเมื่อแคชเชียร์ทำการเปิดกะผ่านหน้าจอขายหน้าร้าน (POS)
                    </p>
                </div>
            ) : (
                <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[13px]">
                            <thead>
                                <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-xs text-[var(--color-muted)] select-none">
                                    <th className="py-3 px-3.5 w-8">#</th>
                                    <th className="py-3 px-3">พนักงาน / กะ</th>
                                    <th className="py-3 px-3">เวลาเปิด</th>
                                    <th className="py-3 px-3">เวลาปิด</th>
                                    <th className="py-3 px-3 text-right">เงินทอนเปิดกะ</th>
                                    <th className="py-3 px-3 text-right text-[var(--status-ok-ink)]">ขายเงินสด</th>
                                    <th className="py-3 px-3 text-right text-[var(--status-ok-ink)]">+ นำเข้า</th>
                                    <th className="py-3 px-3 text-right text-[var(--brand-plum)]">- นำออก</th>
                                    <th className="py-3 px-3 text-right">เงินที่ควรมี</th>
                                    <th className="py-3 px-3 text-right">นับจริง</th>
                                    <th className="py-3 px-3 text-right">ส่วนต่าง</th>
                                    <th className="py-3 px-3 text-center w-28">สลิป PNG</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-paper-3)]">
                                {sortedShifts.map((s, idx) => {
                                    const isOpen = s.status === 'open'
                                    const isExpanded = expandedShiftId === s.id
                                    const openTime = s.opened_at ? new Date(s.opened_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '-'
                                    const closeTime = isOpen ? 'กำลังเปิดใช้งาน' : s.closed_at ? new Date(s.closed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '-'
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
                                                className={`hover:bg-[var(--color-paper-2)] cursor-pointer transition-colors ${
                                                    isExpanded ? 'bg-[var(--color-paper-2)]' : ''
                                                }`}
                                            >
                                                {/* Index & Expand Icon */}
                                                <td className="py-3 px-3.5 text-[var(--color-neutral)]">
                                                    {isExpanded ? <ChevronUp size={13} className="text-[var(--brand-plum)]" /> : <ChevronDown size={13} />}
                                                </td>

                                                {/* Staff / Shift */}
                                                <td className="py-3 px-3">
                                                    <div className="font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                                                        <span>กะ {idx + 1}: {s.staff_name || 'ไม่ระบุชื่อ'}</span>
                                                        {isOpen && (
                                                            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)] font-semibold">
                                                                เปิดอยู่
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-[var(--color-neutral)]">
                                                        ID: {s.id?.slice(0, 14)}
                                                    </div>
                                                </td>

                                                {/* Open Time */}
                                                <td className="py-3 px-3 tabular-nums text-[var(--color-muted)]">
                                                    {openTime}
                                                </td>

                                                {/* Close Time */}
                                                <td className="py-3 px-3 tabular-nums text-[var(--color-muted)]">
                                                    {closeTime}
                                                </td>

                                                {/* Float */}
                                                <td className="py-3 px-3 text-right tabular-nums text-[var(--color-muted)]">
                                                    ฿{fl.toLocaleString()}
                                                </td>

                                                {/* Cash Sales */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[var(--status-ok-ink)]">
                                                    +฿{cs.toLocaleString()}
                                                </td>

                                                {/* Total In */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[var(--status-ok-ink)]">
                                                    +฿{tIn.toLocaleString()}
                                                </td>

                                                {/* Total Out */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[var(--brand-plum)]">
                                                    -฿{tOut.toLocaleString()}
                                                </td>

                                                {/* Expected Cash */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[var(--color-ink)]">
                                                    ฿{exp.toLocaleString()}
                                                </td>

                                                {/* Closed Cash */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold text-[var(--color-muted)]">
                                                    {isOpen ? '-' : `฿${cl.toLocaleString()}`}
                                                </td>

                                                {/* Discrepancy */}
                                                <td className="py-3 px-3 text-right tabular-nums font-bold">
                                                    {isOpen ? (
                                                        <span className="text-[var(--color-neutral)] font-normal">-</span>
                                                    ) : Math.abs(diff) < 0.01 ? (
                                                        <span className="text-[var(--status-ok-ink)]">ตรงยอดพอดี</span>
                                                    ) : diff > 0 ? (
                                                        <span className="text-[var(--status-ok-ink)]">+฿{diff.toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-[var(--brand-plum)]">-฿{Math.abs(diff).toLocaleString()}</span>
                                                    )}
                                                </td>

                                                {/* Actions - Digital PNG Export */}
                                                <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        disabled={loadingShiftId === s.id}
                                                        onClick={() => handleOpenShiftSlip(s, idx)}
                                                        className="px-2.5 py-1.5 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg text-xs font-semibold text-[var(--color-ink)] hover:border-[var(--color-neutral)] transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                                                        title="เปิดดูสลิปสรุปปิดกะ / บันทึก PNG หรือแชร์เข้า LINE"
                                                    >
                                                        <FileText size={12} className="text-[var(--brand-plum)]" />
                                                        <span>{loadingShiftId === s.id ? 'กำลังเปิด…' : 'สลิป PNG'}</span>
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Expanded Shift Drawer */}
                                            {isExpanded && (
                                                <tr className="bg-[var(--color-paper)]">
                                                    <td colSpan="12" className="p-4 border-t border-b border-[var(--color-rule)]">
                                                        <div className="grid md:grid-cols-2 gap-5">
                                                            {/* Column 1: Adjustments */}
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-center justify-between text-xs font-bold text-[var(--color-ink)]">
                                                                    <span>รายการเงินเข้า - ออกในกะนี้</span>
                                                                    <span className="text-xs text-[var(--color-neutral)]">{adjs.length} รายการ</span>
                                                                </div>

                                                                {adjs.length === 0 ? (
                                                                    <div className="py-6 text-center border border-dashed border-[var(--color-rule)] rounded-lg bg-[var(--color-paper)] text-xs text-[var(--color-neutral)]">
                                                                        ไม่มีการนำเงินเข้าหรือเบิกเงินสดระหว่างกะนี้
                                                                    </div>
                                                                ) : (
                                                                    <div className="border border-[var(--color-rule)] rounded-lg overflow-hidden bg-[var(--color-paper)] max-h-[220px] overflow-y-auto no-scrollbar">
                                                                        <table className="w-full text-left border-collapse text-[13px]">
                                                                            <thead>
                                                                                <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-xs text-[var(--color-muted)] select-none sticky top-0">
                                                                                    <th className="py-2 px-2.5 w-16">เวลา</th>
                                                                                    <th className="py-2 px-2.5 w-20">ประเภท</th>
                                                                                    <th className="py-2 px-2.5 text-right w-24">จำนวน</th>
                                                                                    <th className="py-2 px-2.5">เหตุผล / บันทึก</th>
                                                                                    <th className="py-2 px-2.5 w-24">หมวดหมู่</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-[var(--color-paper-2)]">
                                                                                {adjs.map((adj, aIdx) => {
                                                                                    const isIn = adj.type === 'in'
                                                                                    const cat = classifyAdjustmentNote(adj.note, adj.type)
                                                                                    const aTime = adj.timestamp ? new Date(adj.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '-'
                                                                                    return (
                                                                                        <tr key={adj.id || aIdx} className="hover:bg-[var(--color-paper-2)]">
                                                                                            <td className="py-2 px-2.5 text-[13px] text-[var(--color-neutral)] tabular-nums">{aTime}</td>
                                                                                            <td className="py-2 px-2.5">
                                                                                                <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${
                                                                                                    isIn ? 'bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)]' : 'bg-[var(--color-plum-pale)] text-[var(--brand-plum)]'
                                                                                                }`}>
                                                                                                    {isIn ? 'เงินเข้า' : 'เงินออก'}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className={`py-2 px-2.5 text-right font-bold tabular-nums text-[13px] ${
                                                                                                isIn ? 'text-[var(--status-ok-ink)]' : 'text-[var(--brand-plum)]'
                                                                                            }`}>
                                                                                                {isIn ? `+฿${Number(adj.amount || 0).toLocaleString()}` : `-฿${Number(adj.amount || 0).toLocaleString()}`}
                                                                                            </td>
                                                                                            <td className="py-2 px-2.5 font-medium text-[13px] text-[var(--color-ink)]">
                                                                                                {adj.note || '-'}
                                                                                            </td>
                                                                                            <td className="py-2 px-2.5 text-[13px]">
                                                                                                <span className={`px-1.5 py-0.5 rounded-md border text-[11px] font-semibold ${cat.color}`}>
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
                                                                <div className="flex items-center justify-between text-xs font-bold text-[var(--color-ink)]">
                                                                    <span>สรุปยอดขายและเมนูขายดีประจำกะ</span>
                                                                    <span className="text-xs text-[var(--color-neutral)]">
                                                                        ยอดขายรวม ฿{Number(s.total_sales || 0).toLocaleString()}
                                                                    </span>
                                                                </div>

                                                                {/* Sales Channel Sub-bar */}
                                                                <div className="grid grid-cols-3 gap-2 text-center text-xs bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-2 rounded-lg">
                                                                    <div>
                                                                        <div className="text-[var(--color-neutral)]">เงินสด</div>
                                                                        <div className="font-bold text-[var(--color-ink)] tabular-nums">฿{Number(s.cash_sales || 0).toLocaleString()}</div>
                                                                    </div>
                                                                    <div className="border-l border-r border-[var(--color-paper-3)]">
                                                                        <div className="text-[var(--color-neutral)]">PromptPay QR</div>
                                                                        <div className="font-bold text-[var(--color-ink)] tabular-nums">฿{Number(s.qr_sales || 0).toLocaleString()}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[var(--color-neutral)]">บัตรเครดิต</div>
                                                                        <div className="font-bold text-[var(--color-ink)] tabular-nums">฿{Number(s.credit_sales || 0).toLocaleString()}</div>
                                                                    </div>
                                                                </div>

                                                                {/* Top Items Table */}
                                                                <div className="border border-[var(--color-rule)] rounded-lg overflow-hidden bg-[var(--color-paper)] max-h-[170px] overflow-y-auto no-scrollbar">
                                                                    {sellersLoading[s.id] ? (
                                                                        <div className="py-8 text-center text-xs text-[var(--color-neutral)]">
                                                                            กำลังโหลดรายการสินค้าในกะ…
                                                                        </div>
                                                                    ) : (shiftTopSellers[s.id] || []).length === 0 ? (
                                                                        <div className="py-8 text-center text-xs text-[var(--color-neutral)]">
                                                                            ยังไม่มีรายการออเดอร์ที่เช็คบิลเสร็จสิ้นในกะนี้
                                                                        </div>
                                                                    ) : (
                                                                        <table className="w-full text-left border-collapse text-[13px]">
                                                                            <thead>
                                                                                <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-xs text-[var(--color-muted)] sticky top-0">
                                                                                    <th className="py-2 px-2.5">รายการอาหาร/เครื่องดื่ม</th>
                                                                                    <th className="py-2 px-2.5 text-right w-16">จำนวน</th>
                                                                                    <th className="py-2 px-2.5 text-right w-24">ยอดเงิน</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-[var(--color-paper-2)]">
                                                                                {(shiftTopSellers[s.id] || []).map((item, iIdx) => (
                                                                                    <tr key={iIdx} className="hover:bg-[var(--color-paper)]">
                                                                                        <td className="py-2 px-2.5 font-medium text-[13px] text-[var(--color-ink)]">
                                                                                            {item.name}
                                                                                        </td>
                                                                                        <td className="py-2 px-2.5 text-right font-bold text-[var(--color-ink)] tabular-nums">
                                                                                            {item.quantity}
                                                                                        </td>
                                                                                        <td className="py-2 px-2.5 text-right font-bold text-[var(--color-ink)] tabular-nums">
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

            {/* Shift Slip Modal (Digital PNG Export & LINE Copy) */}
            <Suspense fallback={null}>
                {selectedShiftSlip && (
                    <DailySummarySlipModal
                        targetShift={selectedShiftSlip.shift}
                        bookings={selectedShiftSlip.bookings}
                        shifts={sortedShifts}
                        selectedDate={selectedDate}
                        companySettings={companySettings}
                        onClose={() => setSelectedShiftSlip(null)}
                    />
                )}
            </Suspense>
        </div>
    )
}
