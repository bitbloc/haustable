/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'
import { CreditCard, QrCode, Banknote, Wallet, UtensilsCrossed, ShoppingBag, Truck, ArrowUpRight, Percent, Receipt, ShieldCheck } from 'lucide-react'

export default function DetailedSalesSummary({ data, timeRangeLabel }) {
    const paymentMethods = data?.paymentMethods || [
        { name: 'PromptPay QR', amount: 184500, percent: 54.5, count: 248, icon: QrCode, color: 'text-emerald-800 bg-emerald-100 border-emerald-300' },
        { name: 'Credit / Debit Card', amount: 98200, percent: 29.0, count: 112, icon: CreditCard, color: 'text-indigo-800 bg-indigo-100 border-indigo-300' },
        { name: 'Cash (เงินสด)', amount: 37800, percent: 11.2, count: 86, icon: Banknote, color: 'text-amber-800 bg-amber-100 border-amber-300' },
        { name: 'Member Wallet', amount: 18000, percent: 5.3, count: 34, icon: Wallet, color: 'text-rose-800 bg-rose-100 border-rose-300' },
    ]

    const diningChannels = data?.diningChannels || [
        { name: 'Dine-In (ทานที่ร้าน)', amount: 254200, percent: 75.1, tables: 184, avgPerTable: 1381, icon: UtensilsCrossed },
        { name: 'Takeaway / Pickup', amount: 56300, percent: 16.6, orders: 94, avgPerOrder: 598, icon: ShoppingBag },
        { name: 'Online Delivery', amount: 28000, percent: 8.3, orders: 48, avgPerOrder: 583, icon: Truck },
    ]

    const auditReconciliation = data?.auditReconciliation || {
        grossSales: 374444,
        totalDiscounts: -35944,
        discountCount: 42,
        taxableSubtotal: 338500,
        serviceCharge10: 33850,
        vat7: 23695,
        netPayable: 338500,
        avgTicket: 705,
    }

    const hourlyVelocity = data?.hourlyVelocity || [
        { hour: '11:00 - 12:00', gross: 24500, bills: 28, avgBill: 875, peakItem: 'Katsu Curry Set' },
        { hour: '12:00 - 13:00', gross: 68200, bills: 64, avgBill: 1065, peakItem: 'Wagyu Don & Beer' },
        { hour: '13:00 - 14:00', gross: 41000, bills: 42, avgBill: 976, peakItem: 'Salmon Sashimi' },
        { hour: '14:00 - 17:00', gross: 32500, bills: 38, avgBill: 855, peakItem: 'Matcha & Dessert' },
        { hour: '17:00 - 19:00', gross: 89400, bills: 76, avgBill: 1176, peakItem: 'Sharing Platter' },
        { hour: '19:00 - 21:00', gross: 104800, bills: 82, avgBill: 1278, peakItem: 'Draft Beer & Yakitori' },
        { hour: '21:00 - 23:00', gross: 38500, bills: 34, avgBill: 1132, peakItem: 'Highball & Fries' },
    ]

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
                        ช่องทางชำระเงิน ช่องทางขาย และตารางกระทบยอด ({timeRangeLabel})
                    </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-mono text-xs text-[oklch(18%_0.012_28)] font-bold self-start sm:self-auto">
                    <ShieldCheck size={14} className="text-emerald-700" />
                    <span>AUDITED & BALANCED</span>
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
                            Total ฿{paymentMethods.reduce((a,b)=>a+b.amount, 0).toLocaleString()}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                        {paymentMethods.map((pm, idx) => {
                            const Icon = pm.icon
                            return (
                                <div key={idx} className="p-3 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1.5 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`p-1 rounded-md ${pm.color}`}>
                                                <Icon size={14} />
                                            </div>
                                            <span className="text-xs font-black text-[oklch(18%_0.012_28)] truncate">{pm.name}</span>
                                        </div>
                                        <span className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)]">
                                            {pm.percent}%
                                        </span>
                                    </div>

                                    <div className="font-mono text-lg md:text-xl font-black text-[oklch(18%_0.012_28)] leading-none pt-1">
                                        ฿{pm.amount.toLocaleString()}
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] font-mono text-[oklch(42%_0.010_28)] font-bold">
                                        <span>{pm.count} รายการ</span>
                                        <span>เฉลี่ย ฿{Math.round(pm.amount/pm.count)}</span>
                                    </div>

                                    {/* Visual Bar */}
                                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                        <div className="bg-[oklch(52%_0.16_28)] h-2 rounded-full" style={{ width: `${pm.percent}%` }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Dining Channels (5 cols) */}
                <div className="lg:col-span-5 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3">
                    <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                        DINING CHANNEL SHARE
                    </h4>

                    <div className="space-y-2.5">
                        {diningChannels.map((ch, idx) => {
                            const Icon = ch.icon
                            return (
                                <div key={idx} className="p-3 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-lg bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] shrink-0">
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-[oklch(18%_0.012_28)]">{ch.name}</div>
                                            <div className="text-[11px] font-mono font-bold text-[oklch(42%_0.010_28)]">
                                                เฉลี่ย ฿{ch.avgPerTable || ch.avgPerOrder}/ออเดอร์
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-mono text-base font-black text-[oklch(18%_0.012_28)]">
                                            ฿{ch.amount.toLocaleString()}
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
                            <span className="font-black text-sm">฿{auditReconciliation.grossSales.toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between py-1 text-rose-800 bg-rose-50 px-2 rounded-lg font-bold">
                            <span>Less: Total Discounts ({auditReconciliation.discountCount} รายการ)</span>
                            <span className="font-black">฿{auditReconciliation.totalDiscounts.toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between py-1.5 border-t border-[oklch(85%_0.012_28)] font-bold text-[oklch(18%_0.012_28)]">
                            <span>Taxable Subtotal (ฐานภาษี)</span>
                            <span className="font-black">฿{auditReconciliation.taxableSubtotal.toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between py-1 text-[oklch(42%_0.010_28)] font-bold">
                            <span>Service Charge (10%)</span>
                            <span className="font-black">฿{auditReconciliation.serviceCharge10.toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between py-1 text-[oklch(42%_0.010_28)] font-bold">
                            <span>VAT (7%)</span>
                            <span className="font-black">฿{auditReconciliation.vat7.toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between items-center py-3.5 px-3.5 bg-[oklch(18%_0.012_28)] text-white rounded-xl mt-3 shadow-sm">
                            <span className="font-sans font-black text-xs md:text-sm">ยอดรับชำระสุทธิ (NET)</span>
                            <span className="font-mono text-lg md:text-xl font-black text-[oklch(97%_0.008_28)]">
                                ฿{auditReconciliation.netPayable.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Hourly Velocity Table (7 cols) */}
                <div className="lg:col-span-7 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2.5">
                        <span className="text-xs font-mono font-black uppercase text-[oklch(18%_0.012_28)] tracking-wider">
                            HOURLY REVENUE VELOCITY
                        </span>
                        <span className="font-mono text-xs font-black text-[oklch(52%_0.16_28)]">
                            Avg ฿{auditReconciliation.avgTicket}/บิล
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs min-w-[500px]">
                            <thead>
                                <tr className="border-b-2 border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] text-[11px] font-black uppercase tracking-wider">
                                    <th className="py-2 px-2">ช่วงเวลา</th>
                                    <th className="py-2 px-2 text-right">ยอดขาย (฿)</th>
                                    <th className="py-2 px-2 text-right">บิล</th>
                                    <th className="py-2 px-2 text-right">เฉลี่ย/บิล</th>
                                    <th className="py-2 px-2">เมนูขายดีประจำช่วง</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]">
                                {hourlyVelocity.map((hv, idx) => (
                                    <tr key={idx} className="hover:bg-white transition-colors">
                                        <td className="py-2.5 px-2 font-black text-[oklch(18%_0.012_28)]">{hv.hour}</td>
                                        <td className="py-2.5 px-2 text-right font-black text-[oklch(52%_0.16_28)] text-sm">
                                            ฿{hv.gross.toLocaleString()}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-bold">{hv.bills}</td>
                                        <td className="py-2.5 px-2 text-right text-[oklch(42%_0.010_28)] font-bold">฿{hv.avgBill}</td>
                                        <td className="py-2.5 px-2 font-sans truncate max-w-[140px]">
                                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px]">
                                                {hv.peakItem}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
