/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'
import { Users, Crown, HeartHandshake, Sparkles, Repeat, Award, ArrowUpRight, UserCheck, ShieldCheck } from 'lucide-react'

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
                    <span>MEMBERS ACTIVE ({memberShare.totalMembersCount} ท่าน)</span>
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
                            <div className="bg-[oklch(52%_0.16_28)] h-3.5 rounded-l-full transition-all duration-500" style={{ width: `${memberShare.memberPercent}%` }} />
                            <div className="bg-[oklch(85%_0.012_28)] h-3.5 rounded-r-full transition-all duration-500" style={{ width: `${memberShare.nonMemberPercent}%` }} />
                        </div>
                        <div className="flex justify-between items-baseline text-[11px] font-mono text-[oklch(42%_0.010_28)] font-bold">
                            <span>สมาชิก {memberShare.totalMembersCount} ราย</span>
                            <span>ทั่วไป: ฿{memberShare.nonMemberSales.toLocaleString()} ({memberShare.nonMemberPercent}%)</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="p-3 bg-[oklch(97%_0.008_28)] rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                            <div className="text-[11px] text-[oklch(42%_0.010_28)] font-mono font-bold">ยอดเฉลี่ย/ท่าน สมาชิก</div>
                            <div className="font-mono text-lg md:text-xl font-black text-[oklch(52%_0.16_28)] mt-0.5">฿{memberShare.avgSpendMember}</div>
                            <div className="text-[10px] text-emerald-700 font-mono font-bold mt-0.5">
                                {memberShare.avgSpendMember > memberShare.avgSpendNonMember ? 'สูงกว่าลูกค้าทั่วไป' : 'สะสมแต้มต่อเนื่อง'}
                            </div>
                        </div>

                        <div className="p-3 bg-[oklch(97%_0.008_28)] rounded-xl border-2 border-[oklch(85%_0.012_28)]">
                            <div className="text-[11px] text-[oklch(42%_0.010_28)] font-mono font-bold">ยอดเฉลี่ย/ท่าน ทั่วไป</div>
                            <div className="font-mono text-lg md:text-xl font-black text-[oklch(18%_0.012_28)] mt-0.5">฿{memberShare.avgSpendNonMember}</div>
                            <div className="text-[10px] text-[oklch(42%_0.010_28)] font-mono font-bold mt-0.5">ลูกค้า Walk-in / ไม่ได้สะสมแต้ม</div>
                        </div>
                    </div>
                </div>

                {/* Member Tiers (6 cols) */}
                <div className="lg:col-span-6 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3">
                    <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                        LOYALTY TIER PERFORMANCE
                    </h4>

                    <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                        {memberTiers.length === 0 ? (
                            <div className="col-span-2 p-6 bg-white rounded-xl border-2 border-[oklch(85%_0.012_28)] text-center text-xs text-[oklch(42%_0.010_28)] font-bold">
                                ยังไม่มีสถิติยอดขายตาม Tier ในช่วงเวลานี้
                            </div>
                        ) : (
                            memberTiers.map((tier, idx) => {
                                const Icon = tier.icon || Crown
                                return (
                                    <div key={idx} className={`p-3 rounded-xl border-2 ${tier.color || 'border-[oklch(85%_0.012_28)] bg-white text-[oklch(18%_0.012_28)]'} space-y-1 shadow-sm`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 font-black text-xs">
                                                <Icon size={14} />
                                                <span>{tier.name}</span>
                                            </div>
                                            <span className="font-mono text-[10px] font-black">{tier.members || 0} คน</span>
                                        </div>

                                        <div className="pt-1">
                                            <div className="font-mono text-base md:text-lg font-black">฿{(tier.totalSales || 0).toLocaleString()}</div>
                                            <div className="font-mono text-[10px] font-bold opacity-80 mt-0.5">
                                                เฉลี่ย ฿{tier.members > 0 ? Math.round(tier.totalSales / tier.members) : 0}/ท่าน
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Grid Row 2: Top VIP Spenders */}
            <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2.5">
                    <div className="flex items-center gap-2">
                        <Crown size={18} className="text-amber-500" />
                        <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                            TOP VIP SPENDERS IN PERIOD
                        </h4>
                    </div>
                    <span className="font-mono text-xs font-black text-[oklch(52%_0.16_28)]">
                        CRM LEADERBOARD
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs min-w-[520px]">
                        <thead>
                            <tr className="border-b-2 border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] uppercase text-[11px] font-black bg-[oklch(97%_0.008_28)]">
                                <th className="py-2.5 px-3">RANK</th>
                                <th className="py-2.5 px-3">MEMBER NAME</th>
                                <th className="py-2.5 px-3">TIER</th>
                                <th className="py-2.5 px-3 text-right">VISITS</th>
                                <th className="py-2.5 px-3 text-right">AVG TICKET</th>
                                <th className="py-2.5 px-3 text-right">TOTAL SPENT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[oklch(94%_0.010_28)]">
                            {topSpenders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-6 text-center text-gray-400 font-sans">
                                        ไม่มีข้อมูลสมาชิกระบุตัวตนในช่วงเวลานี้ (ลูกค้าชำระเงินในโหมด Guest/Walk-in)
                                    </td>
                                </tr>
                            ) : (
                                topSpenders.map((sp, idx) => (
                                    <tr key={idx} className="hover:bg-[oklch(97%_0.008_28)] transition-colors">
                                        <td className="py-2.5 px-3 font-black text-[oklch(18%_0.012_28)]">#{sp.rank || idx + 1}</td>
                                        <td className="py-2.5 px-3 font-black text-sm text-[oklch(18%_0.012_28)]">{sp.name}</td>
                                        <td className="py-2.5 px-3">
                                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px]">
                                                {sp.tier}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold">{sp.visits} ครั้ง</td>
                                        <td className="py-2.5 px-3 text-right font-bold text-[oklch(42%_0.010_28)]">฿{sp.avgTicket?.toLocaleString()}</td>
                                        <td className="py-2.5 px-3 text-right font-black text-sm text-[oklch(52%_0.16_28)]">฿{sp.totalLtv?.toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
