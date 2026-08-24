/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'

export default function CRMFinancialSummary({ data }) {
    const memberShare = data?.memberShare || {
        memberSales: 0,
        nonMemberSales: 0,
        memberPercent: 0,
        nonMemberPercent: 0,
        totalMembersCount: 0,
        avgSpendMember: 0,
        avgSpendNonMember: 0,
    }

    const memberTiers = data?.memberTiers || []
    const topSpenders = data?.topSpenders || []

    return (
        <div className="space-y-6 text-[oklch(18%_0.012_28)] font-sans">
            
            {/* 1. Header Toolbar */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[oklch(94%_0.010_28)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                                CRM // LOYALTY
                            </span>
                            <h3 className="font-bold text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                                สรุปสัดส่วนยอดขายสมาชิก (Member CRM Financial Share)
                            </h3>
                        </div>
                        <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-0.5">
                            เปรียบเทียบพฤติกรรมการใช้จ่ายระหว่างสมาชิกและลูกค้าทั่วไป
                        </p>
                    </div>

                    <div className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                        สมาชิกที่ใช้บริการ: {memberShare.totalMembersCount} ท่าน
                    </div>
                </div>
            </div>

            {/* 2. Grid Row: Member Revenue Contribution & Loyalty Tiers */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Member Revenue Contribution (6 cols) */}
                <div className="lg:col-span-6 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                    <div className="p-4 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                        MEMBER SHARE // สัดส่วนยอดขายสมาชิก
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-baseline font-mono text-xs">
                                <span className="font-bold text-[oklch(18%_0.012_28)] font-sans">สมาชิก (Member Share)</span>
                                <span className="font-bold text-base text-[oklch(52%_0.16_28)] tabular-nums">
                                    ฿{memberShare.memberSales.toLocaleString()} ({memberShare.memberPercent}%)
                                </span>
                            </div>

                            {/* Two-Tone Progress Bar */}
                            <div className="w-full bg-[oklch(94%_0.010_28)] h-3 overflow-hidden flex border border-[oklch(85%_0.012_28)]">
                                <div className="bg-[oklch(52%_0.16_28)] h-3 transition-all duration-500" style={{ width: `${memberShare.memberPercent}%` }} />
                                <div className="bg-[oklch(85%_0.012_28)] h-3 transition-all duration-500" style={{ width: `${memberShare.nonMemberPercent}%` }} />
                            </div>

                            <div className="flex justify-between items-baseline text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                <span>สมาชิก {memberShare.totalMembersCount} ราย</span>
                                <span>ทั่วไป: ฿{memberShare.nonMemberSales.toLocaleString()} ({memberShare.nonMemberPercent}%)</span>
                            </div>
                        </div>

                        {/* Comparative Spend Boxes */}
                        <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-xs">
                            <div className="p-3 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] space-y-1">
                                <div className="text-[10px] text-[oklch(42%_0.010_28)]">ยอดเฉลี่ย/ท่าน [สมาชิก]</div>
                                <div className="font-bold text-lg text-[oklch(52%_0.16_28)] tabular-nums">
                                    ฿{memberShare.avgSpendMember}
                                </div>
                                <div className="text-[10px] text-[oklch(45%_0.08_140)] font-bold">
                                    {memberShare.avgSpendMember > memberShare.avgSpendNonMember ? 'สูงกว่าลูกค้าทั่วไป' : 'สะสมแต้มต่อเนื่อง'}
                                </div>
                            </div>

                            <div className="p-3 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] space-y-1">
                                <div className="text-[10px] text-[oklch(42%_0.010_28)]">ยอดเฉลี่ย/ท่าน [ทั่วไป]</div>
                                <div className="font-bold text-lg text-[oklch(18%_0.012_28)] tabular-nums">
                                    ฿{memberShare.avgSpendNonMember}
                                </div>
                                <div className="text-[10px] text-[oklch(42%_0.010_28)]">
                                    ลูกค้า Walk-in ทั่วไป
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loyalty Tier Performance (6 cols) */}
                <div className="lg:col-span-6 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                    <div className="p-4 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                        TIER PERFORMANCE // ยอดขายตามระดับสมาชิก
                    </div>

                    <div className="p-4">
                        {memberTiers.length === 0 ? (
                            <div className="p-6 text-center text-xs font-mono text-[oklch(42%_0.010_28)]">
                                ไม่มีสถิติยอดขายตามระดับสมาชิกในช่วงเวลานี้
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                                {memberTiers.map((tier, idx) => (
                                    <div key={idx} className="p-3 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">{tier.name}</span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)]">{tier.members || 0} คน</span>
                                        </div>
                                        <div className="font-bold text-base text-[oklch(18%_0.012_28)] tabular-nums">
                                            ฿{(tier.totalSales || 0).toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-[oklch(42%_0.010_28)]">
                                            เฉลี่ย ฿{tier.members > 0 ? Math.round(tier.totalSales / tier.members) : 0} /ท่าน
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Top VIP Spenders Leaderboard */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                <div className="p-4 bg-[oklch(94%_0.010_28)] flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                        VIP LEADERBOARD // อันดับลูกค้าสมาชิกที่มียอดใช้จ่ายสูงสุด
                    </span>
                    <span className="text-[oklch(42%_0.010_28)]">TOP SPENDERS</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs min-w-[520px]">
                        <thead>
                            <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] text-[11px] font-bold uppercase">
                                <th className="p-3 border-r border-[oklch(85%_0.012_28)]">RANK</th>
                                <th className="p-3 border-r border-[oklch(85%_0.012_28)]">MEMBER NAME</th>
                                <th className="p-3 border-r border-[oklch(85%_0.012_28)]">TIER</th>
                                <th className="p-3 text-right border-r border-[oklch(85%_0.012_28)]">VISITS</th>
                                <th className="p-3 text-right border-r border-[oklch(85%_0.012_28)]">AVG TICKET</th>
                                <th className="p-3 text-right">TOTAL SPENT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]">
                            {topSpenders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-6 text-center text-[oklch(42%_0.010_28)] font-sans">
                                        ไม่มีข้อมูลสมาชิกในช่วงเวลานี้ (ลูกค้าทำรายการในโหมด Walk-in ทั่วไป)
                                    </td>
                                </tr>
                            ) : (
                                topSpenders.map((sp, idx) => (
                                    <tr key={idx} className="hover:bg-[oklch(94%_0.010_28)] transition-colors">
                                        <td className="p-3 font-bold border-r border-[oklch(85%_0.012_28)]">#{sp.rank || idx + 1}</td>
                                        <td className="p-3 font-bold text-sm font-sans border-r border-[oklch(85%_0.012_28)]">{sp.name}</td>
                                        <td className="p-3 border-r border-[oklch(85%_0.012_28)]">
                                            <span className="px-2 py-0.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-bold text-[10px]">
                                                {sp.tier}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right border-r border-[oklch(85%_0.012_28)] tabular-nums">{sp.visits} ครั้ง</td>
                                        <td className="p-3 text-right text-[oklch(42%_0.010_28)] border-r border-[oklch(85%_0.012_28)] tabular-nums">
                                            ฿{sp.avgTicket?.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right font-bold text-sm text-[oklch(52%_0.16_28)] tabular-nums">
                                            ฿{sp.totalLtv?.toLocaleString()}
                                        </td>
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
