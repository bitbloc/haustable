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
        <div className="space-y-6 text-[var(--color-ink)] font-sans">
            
            {/* 1. Header Toolbar */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-paper-2)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[11px] tabular-nums font-bold bg-[var(--color-ink)] text-[var(--color-paper)] ">
                                CRM // LOYALTY
                            </span>
                            <h3 className="font-bold text-base md:text-lg text-[var(--color-ink)] tracking-tight">
                                สรุปสัดส่วนยอดขายสมาชิก (Member CRM Financial Share)
                            </h3>
                        </div>
                        <p className="text-[13px] tabular-nums text-[var(--color-muted)] mt-0.5">
                            เปรียบเทียบพฤติกรรมการใช้จ่ายระหว่างสมาชิกและลูกค้าทั่วไป
                        </p>
                    </div>

                    <div className="tabular-nums text-xs font-bold text-[var(--color-ink)]">
                        สมาชิกที่ใช้บริการ: {memberShare.totalMembersCount} ท่าน
                    </div>
                </div>
            </div>

            {/* 2. Grid Row: Member Revenue Contribution & Loyalty Tiers */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Member Revenue Contribution (6 cols) */}
                <div className="lg:col-span-6 border border-[var(--color-rule)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]">
                    <div className="p-4 bg-[var(--color-paper-2)] tabular-nums text-xs font-bold text-[var(--color-ink)]">
                        MEMBER SHARE // สัดส่วนยอดขายสมาชิก
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-baseline tabular-nums text-xs">
                                <span className="font-bold text-[var(--color-ink)] font-sans">สมาชิก (Member Share)</span>
                                <span className="font-bold text-base text-[var(--brand-plum)] tabular-nums">
                                    ฿{memberShare.memberSales.toLocaleString()} ({memberShare.memberPercent}%)
                                </span>
                            </div>

                            {/* Two-Tone Progress Bar */}
                            <div className="w-full bg-[var(--color-paper-2)] h-3 overflow-hidden flex border border-[var(--color-rule)]">
                                <div className="bg-[var(--brand-plum)] h-3 transition-all duration-500" style={{ width: `${memberShare.memberPercent}%` }} />
                                <div className="bg-[var(--color-rule)] h-3 transition-all duration-500" style={{ width: `${memberShare.nonMemberPercent}%` }} />
                            </div>

                            <div className="flex justify-between items-baseline text-xs tabular-nums text-[var(--color-muted)]">
                                <span>สมาชิก {memberShare.totalMembersCount} ราย</span>
                                <span>ทั่วไป: ฿{memberShare.nonMemberSales.toLocaleString()} ({memberShare.nonMemberPercent}%)</span>
                            </div>
                        </div>

                        {/* Comparative Spend Boxes */}
                        <div className="grid grid-cols-2 gap-3 pt-2 tabular-nums text-xs">
                            <div className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] space-y-1">
                                <div className="text-xs text-[var(--color-muted)]">ยอดเฉลี่ย/ท่าน [สมาชิก]</div>
                                <div className="font-bold text-lg text-[var(--brand-plum)] tabular-nums">
                                    ฿{memberShare.avgSpendMember}
                                </div>
                                <div className="text-xs text-[oklch(45%_0.08_140)] font-bold">
                                    {memberShare.avgSpendMember > memberShare.avgSpendNonMember ? 'สูงกว่าลูกค้าทั่วไป' : 'สะสมแต้มต่อเนื่อง'}
                                </div>
                            </div>

                            <div className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] space-y-1">
                                <div className="text-xs text-[var(--color-muted)]">ยอดเฉลี่ย/ท่าน [ทั่วไป]</div>
                                <div className="font-bold text-lg text-[var(--color-ink)] tabular-nums">
                                    ฿{memberShare.avgSpendNonMember}
                                </div>
                                <div className="text-xs text-[var(--color-muted)]">
                                    ลูกค้า Walk-in ทั่วไป
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loyalty Tier Performance (6 cols) */}
                <div className="lg:col-span-6 border border-[var(--color-rule)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]">
                    <div className="p-4 bg-[var(--color-paper-2)] tabular-nums text-xs font-bold text-[var(--color-ink)]">
                        TIER PERFORMANCE // ยอดขายตามระดับสมาชิก
                    </div>

                    <div className="p-4">
                        {memberTiers.length === 0 ? (
                            <div className="p-6 text-center text-xs tabular-nums text-[var(--color-muted)]">
                                ไม่มีสถิติยอดขายตามระดับสมาชิกในช่วงเวลานี้
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 tabular-nums text-xs">
                                {memberTiers.map((tier, idx) => (
                                    <div key={idx} className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-[var(--color-ink)]">{tier.name}</span>
                                            <span className="text-xs text-[var(--color-muted)]">{tier.members || 0} คน</span>
                                        </div>
                                        <div className="font-bold text-base text-[var(--color-ink)] tabular-nums">
                                            ฿{(tier.totalSales || 0).toLocaleString()}
                                        </div>
                                        <div className="text-xs text-[var(--color-muted)]">
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
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]">
                <div className="p-4 bg-[var(--color-paper-2)] flex items-center justify-between tabular-nums text-xs">
                    <span className="font-bold text-[var(--color-ink)]">
                        VIP LEADERBOARD // อันดับลูกค้าสมาชิกที่มียอดใช้จ่ายสูงสุด
                    </span>
                    <span className="text-[var(--color-muted)]">TOP SPENDERS</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left tabular-nums text-[13px] min-w-[520px]">
                        <thead>
                            <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-[var(--color-muted)] text-xs font-bold ">
                                <th className="p-3 border-r border-[var(--color-rule)]">RANK</th>
                                <th className="p-3 border-r border-[var(--color-rule)]">MEMBER NAME</th>
                                <th className="p-3 border-r border-[var(--color-rule)]">TIER</th>
                                <th className="p-3 text-right border-r border-[var(--color-rule)]">VISITS</th>
                                <th className="p-3 text-right border-r border-[var(--color-rule)]">AVG TICKET</th>
                                <th className="p-3 text-right">TOTAL SPENT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-rule)] text-[var(--color-ink)]">
                            {topSpenders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-6 text-center text-[var(--color-muted)] font-sans">
                                        ไม่มีข้อมูลสมาชิกในช่วงเวลานี้ (ลูกค้าทำรายการในโหมด Walk-in ทั่วไป)
                                    </td>
                                </tr>
                            ) : (
                                topSpenders.map((sp, idx) => (
                                    <tr key={idx} className="hover:bg-[var(--color-paper-2)] transition-colors">
                                        <td className="p-3 font-bold border-r border-[var(--color-rule)]">#{sp.rank || idx + 1}</td>
                                        <td className="p-3 font-bold text-sm font-sans border-r border-[var(--color-rule)]">{sp.name}</td>
                                        <td className="p-3 border-r border-[var(--color-rule)]">
                                            <span className="px-2 py-0.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-[11px]">
                                                {sp.tier}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right border-r border-[var(--color-rule)] tabular-nums">{sp.visits} ครั้ง</td>
                                        <td className="p-3 text-right text-[var(--color-muted)] border-r border-[var(--color-rule)] tabular-nums">
                                            ฿{sp.avgTicket?.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right font-bold text-sm text-[var(--brand-plum)] tabular-nums">
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
