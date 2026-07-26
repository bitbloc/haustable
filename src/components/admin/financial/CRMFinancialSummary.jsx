/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'
import { Users, Crown, HeartHandshake, Sparkles, Repeat, Award, ArrowUpRight, UserCheck } from 'lucide-react'

export default function CRMFinancialSummary({ data }) {
    const memberShare = data?.memberShare || {
        memberSales: 0,
        nonMemberSales: 0,
        memberPercent: 0,
        nonMemberPercent: 0,
        totalMembersCount: 0,
        activeThisMonth: 0,
        repeatCustomerRate: 0,
        avgSpendMember: 0,
        avgSpendNonMember: 0,
    }

    const memberTiers = data?.memberTiers || []
    const rfmSegments = data?.rfmSegments || []
    const topSpenders = data?.topSpenders || []

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[oklch(85%_0.012_28)] gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <Users size={20} className="text-[oklch(52%_0.16_28)] shrink-0" />
                        <h3 className="font-black text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                            CRM & Customer Financial Summary
                        </h3>
                    </div>
                    <p className="text-xs font-semibold text-[oklch(42%_0.010_28)] mt-0.5">
                        สัดส่วนยอดขายสมาชิก (Member Sales Share) และกลุ่มลูกค้าหลัก
                    </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-mono text-xs text-[oklch(18%_0.012_28)] font-black self-start sm:self-auto">
                    <HeartHandshake size={14} className="text-[oklch(52%_0.16_28)]" />
                    <span>RETENTION {memberShare.repeatCustomerRate}%</span>
                </div>
            </div>

            {/* Member vs Non-Member Share & Tiers */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                {/* Member Revenue Contribution (6 cols) */}
                <div className="lg:col-span-6 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
                    <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                        MEMBER REVENUE CONTRIBUTION
                    </h4>

                    <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-black text-[oklch(18%_0.012_28)]">สมาชิก (Member Share)</span>
                            <span className="font-mono text-base md:text-lg font-black text-[oklch(52%_0.16_28)]">
                                ฿{memberShare.memberSales.toLocaleString()} ({memberShare.memberPercent}%)
                            </span>
                        </div>
                        <div className="w-full bg-[oklch(94%_0.010_28)] h-3.5 rounded-full overflow-hidden flex">
                            <div className="bg-[oklch(52%_0.16_28)] h-3.5 rounded-l-full" style={{ width: `${memberShare.memberPercent}%` }} />
                            <div className="bg-[oklch(85%_0.012_28)] h-3.5 rounded-r-full" style={{ width: `${memberShare.nonMemberPercent}%` }} />
                        </div>
                        <div className="flex justify-between items-baseline text-[11px] font-mono text-[oklch(42%_0.010_28)] font-bold">
                            <span>อัตราซื้อซ้ำสูง</span>
                            <span>ทั่วไป: ฿{memberShare.nonMemberSales.toLocaleString()} ({memberShare.nonMemberPercent}%)</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="p-3 bg-[oklch(97%_0.008_28)] rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                            <div className="text-[11px] text-[oklch(42%_0.010_28)] font-mono font-bold">ยอดเฉลี่ย/หัว สมาชิก</div>
                            <div className="font-mono text-lg md:text-xl font-black text-[oklch(52%_0.16_28)] mt-0.5">฿{memberShare.avgSpendMember}</div>
                            <div className="text-[10px] text-emerald-700 font-mono font-bold mt-0.5">+51.8% สูงกว่าทั่วไป</div>
                        </div>

                        <div className="p-3 bg-[oklch(97%_0.008_28)] rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                            <div className="text-[11px] text-[oklch(42%_0.010_28)] font-mono font-bold">ยอดเฉลี่ย/หัว ทั่วไป</div>
                            <div className="font-mono text-lg md:text-xl font-black text-[oklch(18%_0.012_28)] mt-0.5">฿{memberShare.avgSpendNonMember}</div>
                            <div className="text-[10px] text-[oklch(42%_0.010_28)] font-mono font-bold mt-0.5">ลูกค้า Walk-in</div>
                        </div>
                    </div>
                </div>

                {/* Member Tiers (6 cols) */}
                <div className="lg:col-span-6 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3">
                    <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                        LOYALTY TIER PERFORMANCE
                    </h4>

                    <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                        {memberTiers.map((tier, idx) => {
                            const Icon = tier.icon
                            return (
                                <div key={idx} className={`p-3 rounded-xl border-2 ${tier.color} space-y-1 shadow-sm`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1 font-black text-xs">
                                            <Icon size={14} />
                                            <span>{tier.name}</span>
                                        </div>
                                        <span className="font-mono text-[10px] font-black">{tier.members} คน</span>
                                    </div>

                                    <div className="pt-1">
                                        <div className="font-mono text-base md:text-lg font-black">฿{tier.totalSales.toLocaleString()}</div>
                                        <div className="font-mono text-[10px] font-bold opacity-80 mt-0.5">เฉลี่ย ฿{tier.avgPerVisit}/ครั้ง</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Grid Row 2: RFM Segments & Top Spenders */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                {/* RFM Segments (6 cols) */}
                <div className="lg:col-span-6 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3">
                    <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                        RFM CUSTOMER SEGMENTS
                    </h4>

                    <div className="space-y-2">
                        {rfmSegments.map((rfm, idx) => (
                            <div key={idx} className="p-3 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1 shadow-sm">
                                <div className="flex items-center justify-between text-xs font-black text-[oklch(18%_0.012_28)]">
                                    <span>{rfm.title}</span>
                                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-[oklch(94%_0.010_28)] text-[oklch(52%_0.16_28)]">
                                        {rfm.count} คน ({rfm.sharePct}%)
                                    </span>
                                </div>
                                <p className="text-xs text-[oklch(42%_0.010_28)] font-semibold">{rfm.desc}</p>
                                <div className="text-[11px] font-mono text-emerald-800 font-bold pt-1 border-t border-[oklch(85%_0.012_28)]">
                                    Action: {rfm.action}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top VIP Spenders Table (6 cols) */}
                <div className="lg:col-span-6 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2.5">
                        <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                            TOP 5 VIP SPENDERS
                        </h4>
                        <Crown size={18} className="text-amber-500" />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs min-w-[340px]">
                            <thead>
                                <tr className="border-b-2 border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] text-[11px] font-black uppercase tracking-wider">
                                    <th className="py-2 px-2">สมาชิก</th>
                                    <th className="py-2 px-2 text-right">ยอดรวม (LTV)</th>
                                    <th className="py-2 px-2 text-right">ครั้ง</th>
                                    <th className="py-2 px-2 text-right">เฉลี่ย/บิล</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]">
                                {topSpenders.map((vip) => (
                                    <tr key={vip.rank} className="hover:bg-[oklch(97%_0.008_28)] transition-colors">
                                        <td className="py-2.5 px-2">
                                            <div className="font-sans font-black text-[oklch(18%_0.012_28)]">{vip.name}</div>
                                            <div className="text-[10px] text-purple-800 font-mono font-bold">{vip.tier}</div>
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-black text-[oklch(52%_0.16_28)] text-sm">
                                            ฿{vip.totalLtv.toLocaleString()}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-bold">{vip.visits}</td>
                                        <td className="py-2.5 px-2 text-right text-[oklch(42%_0.010_28)] font-bold">฿{vip.avgTicket}</td>
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
