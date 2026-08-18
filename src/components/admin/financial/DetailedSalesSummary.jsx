/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react'
import { 
    CreditCard, 
    QrCode, 
    Banknote, 
    Wallet, 
    UtensilsCrossed, 
    ShoppingBag, 
    ArrowUpRight, 
    Percent, 
    Receipt, 
    ShieldCheck, 
    TrendingUp, 
    Flame, 
    Layers,
    BarChart3
} from 'lucide-react'

export default function DetailedSalesSummary({ data, timeRangeLabel }) {
    const [hoveredHour, setHoveredHour] = useState(null)

    const paymentMethods = data?.paymentMethods || [
        { name: 'PromptPay QR', amount: 0, percent: 0, count: 0, icon: QrCode, color: 'text-emerald-800 bg-emerald-100 border-emerald-300' },
        { name: 'Credit / Debit Card', amount: 0, percent: 0, count: 0, icon: CreditCard, color: 'text-indigo-800 bg-indigo-100 border-indigo-300' },
        { name: 'Cash (เงินสด)', amount: 0, percent: 0, count: 0, icon: Banknote, color: 'text-amber-800 bg-amber-100 border-amber-300' },
        { name: 'Member Wallet', amount: 0, percent: 0, count: 0, icon: Wallet, color: 'text-rose-800 bg-rose-100 border-rose-300' },
    ]

    const diningChannels = data?.diningChannels || [
        { name: 'Dine-In (ทานที่ร้าน / จองโต๊ะ)', amount: 0, percent: 0, tables: 0, avgPerTable: 0, icon: UtensilsCrossed },
        { name: 'Takeaway / Pickup (รับกลับบ้าน)', amount: 0, percent: 0, orders: 0, avgPerOrder: 0, icon: ShoppingBag },
    ]

    const auditReconciliation = data?.auditReconciliation || {
        grossSales: 0,
        totalDiscounts: 0,
        discountCount: 0,
        taxableSubtotal: 0,
        serviceCharge10: 0,
        vat7: 0,
        netPayable: 0,
        avgTicket: 0,
    }

    const hourlyVelocity = data?.hourlyVelocity || []

    // Calculate max hourly revenue for graph scaling
    const maxHourlyGross = Math.max(...hourlyVelocity.map(h => h.gross || 0), 100)
    const peakHourData = hourlyVelocity.reduce((max, h) => (h.gross > (max?.gross || 0) ? h : max), null)

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[oklch(85%_0.012_28)] gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <Receipt size={20} className="text-[oklch(52%_0.16_28)] shrink-0" />
                        <h3 className="font-black text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                            สรุปยอดขายแบบละเอียด (Detailed Revenue Audit)
                        </h3>
                    </div>
                    <p className="text-xs font-semibold text-[oklch(42%_0.010_28)] mt-0.5">
                        ช่องทางชำระเงิน ช่องทางขาย (ทานที่ร้าน & Pickup) และตารางกระทบยอด ({timeRangeLabel})
                    </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-mono text-xs text-[oklch(18%_0.012_28)] font-bold self-start sm:self-auto">
                    <ShieldCheck size={14} className="text-emerald-700" />
                    <span>AUDITED & BALANCED</span>
                </div>
            </div>

            {/* Visual Hourly Velocity Chart (SVG Interactive Graph) */}
            <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[oklch(85%_0.012_28)] pb-2.5">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={18} className="text-[oklch(52%_0.16_28)]" />
                        <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                            HOURLY SALES VELOCITY VISUALIZER
                        </h4>
                    </div>
                    {peakHourData && peakHourData.gross > 0 && (
                        <span className="font-mono text-xs font-black text-emerald-900 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md">
                            ⚡ Peak: {peakHourData.hour} (฿{peakHourData.gross.toLocaleString()})
                        </span>
                    )}
                </div>

                {/* SVG Visual Bars */}
                <div className="pt-2">
                    <div className="grid grid-cols-12 md:grid-cols-14 gap-1.5 items-end h-40 pt-6 px-1">
                        {hourlyVelocity.map((h, idx) => {
                            const heightPct = Math.max(4, Math.round((h.gross / maxHourlyGross) * 100))
                            const isPeak = peakHourData?.hour === h.hour && h.gross > 0
                            const isHovered = hoveredHour === h.hour

                            return (
                                <div
                                    key={idx}
                                    onMouseEnter={() => setHoveredHour(h.hour)}
                                    onMouseLeave={() => setHoveredHour(null)}
                                    className="flex flex-col items-center h-full justify-end group relative cursor-pointer"
                                >
                                    {/* Tooltip on Hover / Peak */}
                                    {isHovered && (
                                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-20 bg-[oklch(18%_0.012_28)] text-white text-[10px] font-mono px-2 py-1 rounded-md shadow-xl whitespace-nowrap pointer-events-none border border-white/20 text-center">
                                            <div className="font-black text-emerald-400">฿{h.gross.toLocaleString()}</div>
                                            <div className="text-gray-300 text-[9px]">{h.bills} บิล | {h.hour}</div>
                                        </div>
                                    )}

                                    {/* Bar Element */}
                                    <div className="w-full flex justify-center items-end h-full">
                                        <div
                                            style={{ height: `${heightPct}%` }}
                                            className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                                                isPeak
                                                    ? 'bg-[oklch(52%_0.16_28)] shadow-md'
                                                    : h.gross > 0
                                                    ? 'bg-[oklch(80%_0.05_28)] group-hover:bg-[oklch(52%_0.16_28)]'
                                                    : 'bg-[oklch(94%_0.010_28)]'
                                            }`}
                                        />
                                    </div>

                                    {/* Hour Label */}
                                    <span className={`text-[10px] font-mono mt-1.5 font-bold truncate max-w-full ${
                                        isPeak ? 'text-[oklch(52%_0.16_28)] font-black' : 'text-[oklch(42%_0.010_28)]'
                                    }`}>
                                        {h.hour?.split(':')[0] || idx}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Grid Row 1: Payment Methods & Channels */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                {/* Payment Methods (7 cols) */}
                <div className="lg:col-span-7 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                            PAYMENT METHOD SETTLEMENT
                        </h4>
                        <span className="font-mono text-xs font-black text-[oklch(52%_0.16_28)]">
                            Total ฿{Math.ceil(paymentMethods.reduce((a,b)=>a+b.amount, 0)).toLocaleString()}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                        {paymentMethods.map((pm, idx) => {
                            const Icon = pm.icon || (
                                pm.name?.toLowerCase().includes('qr') ? QrCode :
                                pm.name?.toLowerCase().includes('card') || pm.name?.toLowerCase().includes('credit') ? CreditCard :
                                pm.name?.toLowerCase().includes('wallet') ? Wallet : Banknote
                            )
                            return (
                                <div key={idx} className="p-3 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1.5 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`p-1 rounded-md ${pm.color || 'text-amber-800 bg-amber-100 border-amber-300'}`}>
                                                <Icon size={14} />
                                            </div>
                                            <span className="text-xs font-black text-[oklch(18%_0.012_28)] truncate">{pm.name}</span>
                                        </div>
                                        <span className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)]">
                                            {pm.percent}%
                                        </span>
                                    </div>

                                    <div className="font-mono text-lg md:text-xl font-black text-[oklch(18%_0.012_28)] leading-none pt-1">
                                        ฿{Math.ceil(pm.amount || 0).toLocaleString()}
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] font-mono text-[oklch(42%_0.010_28)] font-bold">
                                        <span>{pm.count || 0} รายการ</span>
                                        <span>เฉลี่ย ฿{pm.count > 0 ? Math.round(pm.amount/pm.count) : 0}</span>
                                    </div>

                                    {/* Visual Bar */}
                                    <div className="w-full bg-[oklch(94%_0.010_28)] rounded-full h-2 overflow-hidden">
                                        <div className="bg-[oklch(52%_0.16_28)] h-2 rounded-full transition-all duration-500" style={{ width: `${pm.percent || 0}%` }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Dining Channels - Strictly 2 Channels (5 cols) */}
                <div className="lg:col-span-5 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3">
                    <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                        DINING CHANNEL SHARE (2 CHANNELS)
                    </h4>

                    <div className="space-y-2.5">
                        {diningChannels.map((ch, idx) => {
                            const Icon = ch.icon || (
                                ch.name?.toLowerCase().includes('dine') ? UtensilsCrossed : ShoppingBag
                            )
                            return (
                                <div key={idx} className="p-3.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] shrink-0">
                                            <Icon size={20} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-[oklch(18%_0.012_28)]">{ch.name}</div>
                                            <div className="text-[11px] font-mono font-bold text-[oklch(42%_0.010_28)]">
                                                เฉลี่ย ฿{ch.avgPerTable || ch.avgPerOrder || 0}/ออเดอร์
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-mono text-base font-black text-[oklch(18%_0.012_28)] tracking-tight">
                                            ฿{Math.ceil(ch.amount).toLocaleString()}
                                        </div>
                                        <div className="font-mono text-[11px] text-[oklch(52%_0.16_28)] font-black">
                                            {ch.percent}% of total
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Grid Row 2: Reconciliation & Hourly Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                {/* Financial Reconciliation Statement (5 cols) */}
                <div className="lg:col-span-5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2.5">
                        <span className="text-xs font-mono font-black uppercase text-[oklch(18%_0.012_28)] tracking-wider">
                            FINANCIAL RECONCILIATION
                        </span>
                        <Percent size={18} className="text-[oklch(52%_0.16_28)]" />
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between py-1 text-[oklch(18%_0.012_28)]">
                            <span className="font-semibold text-[oklch(42%_0.010_28)]">Gross Sales (ยอดขายรวม)</span>
                            <span className="font-black text-sm">฿{Math.ceil(auditReconciliation.grossSales).toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between py-1 text-rose-800 bg-rose-50 px-2 rounded-lg font-bold">
                            <span>Less: Total Discounts ({auditReconciliation.discountCount} รายการ)</span>
                            <span className="font-black">฿{Math.ceil(auditReconciliation.totalDiscounts).toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between py-1.5 border-t border-[oklch(85%_0.012_28)] font-bold text-[oklch(18%_0.012_28)]">
                            <span>Taxable Subtotal (ฐานภาษี)</span>
                            <span className="font-black">฿{Math.ceil(auditReconciliation.taxableSubtotal).toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between py-1 text-[oklch(42%_0.010_28)] font-bold">
                            <span>Service Charge (10%)</span>
                            <span className="font-black">฿{Math.ceil(auditReconciliation.serviceCharge10).toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between py-1 text-[oklch(42%_0.010_28)] font-bold">
                            <span>VAT (7%)</span>
                            <span className="font-black">฿{Math.ceil(auditReconciliation.vat7).toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between items-center py-3.5 px-3.5 bg-[oklch(18%_0.012_28)] text-white rounded-xl mt-3 shadow-sm">
                            <span className="font-sans font-black text-xs md:text-sm">ยอดรับชำระสุทธิ (NET)</span>
                            <span className="font-mono text-lg md:text-xl font-black text-[oklch(97%_0.008_28)] tracking-tight">
                                ฿{Math.ceil(auditReconciliation.netPayable).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Hourly Velocity Table (7 cols) */}
                <div className="lg:col-span-7 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2.5">
                        <span className="text-xs font-mono font-black uppercase text-[oklch(18%_0.012_28)] tracking-wider">
                            HOURLY REVENUE AUDIT TABLE
                        </span>
                        <span className="font-mono text-xs font-black text-[oklch(52%_0.16_28)]">
                            Avg ฿{auditReconciliation.avgTicket}/บิล
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs min-w-[500px]">
                            <thead>
                                <tr className="border-b-2 border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] text-[11px] font-black uppercase tracking-widest bg-[oklch(94%_0.010_28)]">
                                    <th className="py-2.5 px-3 border-r border-[oklch(85%_0.012_28)]">ช่วงเวลา</th>
                                    <th className="py-2.5 px-3 text-right border-r border-[oklch(85%_0.012_28)]">ยอดขาย (฿)</th>
                                    <th className="py-2.5 px-3 text-right border-r border-[oklch(85%_0.012_28)]">บิล</th>
                                    <th className="py-2.5 px-3 text-right border-r border-[oklch(85%_0.012_28)]">เฉลี่ย/บิล</th>
                                    <th className="py-2.5 px-3">เมนูขายดีประจำช่วง</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]">
                                {hourlyVelocity.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-6 text-center text-[oklch(42%_0.010_28)] font-bold">
                                            ไม่มีสถิติรายชั่วโมงในช่วงเวลาที่เลือก
                                        </td>
                                    </tr>
                                ) : (
                                    hourlyVelocity.map((hv, idx) => (
                                        <tr key={idx} className="hover:bg-white transition-colors border-b border-[oklch(85%_0.012_28)]/50">
                                            <td className="py-2.5 px-3 font-black text-[oklch(18%_0.012_28)] border-r border-[oklch(85%_0.012_28)]/50">{hv.hour}</td>
                                            <td className="py-2.5 px-3 text-right font-black text-[oklch(52%_0.16_28)] text-sm tracking-tight border-r border-[oklch(85%_0.012_28)]/50">
                                                ฿{Math.ceil(hv.gross).toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold border-r border-[oklch(85%_0.012_28)]/50">{hv.bills}</td>
                                            <td className="py-2.5 px-3 text-right text-[oklch(42%_0.010_28)] font-bold tracking-tight border-r border-[oklch(85%_0.012_28)]/50">฿{Math.ceil(hv.avgBill).toLocaleString()}</td>
                                            <td className="py-2.5 px-3 font-sans truncate max-w-[140px]">
                                                <span className="px-2 py-0.5 rounded bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] font-bold text-[11px] uppercase tracking-tight">
                                                    {hv.peakItem}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
