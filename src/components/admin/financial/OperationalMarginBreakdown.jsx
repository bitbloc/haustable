/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useMemo } from 'react'

/**
 * OperationalMarginBreakdown
 * Level 7: Operational Contribution vs Accounting Profit
 * Replaces decorative waterfall with crystal-clear restaurant margin economics.
 */
export default function OperationalMarginBreakdown({
    grossSales = 0,
    discounts = 0,
    fixedExpenses = 0,
    foodCostPct = 30.0,
    packagingPct = 2.5,
    platformFeePct = 4.5,
    customFoodCost = null,
    customPackaging = null,
    customPlatformFee = null
}) {
    const metrics = useMemo(() => {
        const sales = Math.max(0, grossSales)
        const discountAmt = Math.max(0, discounts)
        const netSales = Math.max(0, sales - discountAmt)

        // Tier 1: Operational Deductions
        const foodCostAmt = customFoodCost !== null ? customFoodCost : Math.round(netSales * (foodCostPct / 100))
        const packagingAmt = customPackaging !== null ? customPackaging : Math.round(netSales * (packagingPct / 100))
        const platformFeeAmt = customPlatformFee !== null ? customPlatformFee : Math.round(netSales * (platformFeePct / 100))

        const operationalGrossContribution = Math.max(
            0,
            netSales - (foodCostAmt + packagingAmt + platformFeeAmt)
        )

        const contributionPct = sales > 0 ? ((operationalGrossContribution / sales) * 100).toFixed(1) : 0
        const foodCostCalcPct = sales > 0 ? ((foodCostAmt / sales) * 100).toFixed(1) : 0
        const packagingCalcPct = sales > 0 ? ((packagingAmt / sales) * 100).toFixed(1) : 0
        const platformCalcPct = sales > 0 ? ((platformFeeAmt / sales) * 100).toFixed(1) : 0
        const discountCalcPct = sales > 0 ? ((discountAmt / sales) * 100).toFixed(1) : 0

        // Tier 2: Accounting Bottom Line
        const netOperatingProfit = operationalGrossContribution - fixedExpenses
        const netProfitMarginPct = sales > 0 ? ((netOperatingProfit / sales) * 100).toFixed(1) : 0

        return {
            sales,
            discountAmt,
            netSales,
            foodCostAmt,
            packagingAmt,
            platformFeeAmt,
            operationalGrossContribution,
            contributionPct,
            foodCostCalcPct,
            packagingCalcPct,
            platformCalcPct,
            discountCalcPct,
            fixedExpenses,
            netOperatingProfit,
            netProfitMarginPct
        }
    }, [grossSales, discounts, fixedExpenses, foodCostPct, packagingPct, platformFeePct, customFoodCost, customPackaging, customPlatformFee])

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
            
            {/* Header Strip */}
            <div className="p-3 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]">
                        P&L // MARGINS
                    </span>
                    <span className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                        OPERATIONAL CONTRIBUTION & COST BREAKDOWN // ต้นทุนจริงและกำไรหน้างาน
                    </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[oklch(42%_0.010_28)]">
                    <span>CONTRIBUTION: <strong className="text-[oklch(45%_0.08_140)]">{metrics.contributionPct}%</strong></span>
                    <span>|</span>
                    <span>NET ACCOUNTING: <strong className="text-[oklch(18%_0.012_28)]">{metrics.netProfitMarginPct}%</strong></span>
                </div>
            </div>

            {/* Split View: Operational Contribution vs Accounting Bottom Line */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[oklch(85%_0.012_28)] font-mono text-xs">
                
                {/* Left 7 Cols: Operational Contribution (กำไรจากการขายจริงหน้างาน) */}
                <div className="p-4 md:p-5 lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2">
                        <span className="font-bold text-[oklch(18%_0.012_28)] uppercase">
                            01 // OPERATIONAL CONTRIBUTION (กำไรหน้างาน)
                        </span>
                        <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                            ขายแล้วร้านเหลือเงินจริงเท่าไร
                        </span>
                    </div>

                    <div className="space-y-2.5">
                        {/* Sales */}
                        <div className="flex items-center justify-between">
                            <span className="text-[oklch(18%_0.012_28)] font-bold">ยอดขายรวม (Gross Sales)</span>
                            <div className="text-right">
                                <span className="font-bold text-[oklch(18%_0.012_28)] tabular-nums">฿{metrics.sales.toLocaleString()}</span>
                                <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-2">100.0%</span>
                            </div>
                        </div>

                        {/* Deductions */}
                        <div className="space-y-1.5 pl-3 border-l-2 border-[oklch(85%_0.012_28)]">
                            <div className="flex items-center justify-between text-[oklch(42%_0.010_28)]">
                                <span>- Food & Beverage Cost (วัตถุดิบ)</span>
                                <div className="text-right tabular-nums">
                                    <span className="text-[oklch(52%_0.16_28)]">-฿{metrics.foodCostAmt.toLocaleString()}</span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-2">{metrics.foodCostCalcPct}%</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[oklch(42%_0.010_28)]">
                                <span>- Packaging & Disposables (กล่อง/ถุง)</span>
                                <div className="text-right tabular-nums">
                                    <span className="text-[oklch(52%_0.16_28)]">-฿{metrics.packagingAmt.toLocaleString()}</span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-2">{metrics.packagingCalcPct}%</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[oklch(42%_0.010_28)]">
                                <span>- Platform Fees (GP LINE MAN / Grab)</span>
                                <div className="text-right tabular-nums">
                                    <span className="text-[oklch(52%_0.16_28)]">-฿{metrics.platformFeeAmt.toLocaleString()}</span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-2">{metrics.platformCalcPct}%</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[oklch(42%_0.010_28)]">
                                <span>- Discounts / xhaus Credits (ส่วนลด)</span>
                                <div className="text-right tabular-nums">
                                    <span className="text-[oklch(52%_0.16_28)]">-฿{metrics.discountAmt.toLocaleString()}</span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-2">{metrics.discountCalcPct}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Contribution Total */}
                        <div className="pt-2 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between bg-[oklch(94%_0.010_28)] p-2">
                            <span className="font-bold text-[oklch(18%_0.012_28)]">
                                = GROSS CONTRIBUTION (กำไรส่วนเพิ่มหน้างาน)
                            </span>
                            <div className="text-right tabular-nums">
                                <span className="font-mono text-base font-bold text-[oklch(45%_0.08_140)]">
                                    ฿{metrics.operationalGrossContribution.toLocaleString()}
                                </span>
                                <span className="text-xs font-bold text-[oklch(45%_0.08_140)] ml-2">
                                    ({metrics.contributionPct}%)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right 5 Cols: Fixed Costs & Net Accounting Profit */}
                <div className="p-4 md:p-5 lg:col-span-5 space-y-4 bg-[oklch(97%_0.008_28)]">
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2">
                        <span className="font-bold text-[oklch(18%_0.012_28)] uppercase">
                            02 // NET OPERATING (กำไรสุทธิทางบัญชี)
                        </span>
                        <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                            หลังหักโสหุ้ยร้าน
                        </span>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-[oklch(42%_0.010_28)]">
                            <span>กำไรส่วนเพิ่มหน้างาน</span>
                            <span className="font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                ฿{metrics.operationalGrossContribution.toLocaleString()}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-[oklch(42%_0.010_28)]">
                            <span>- รายจ่ายคงที่ประจำวัน (Store Expenses)</span>
                            <span className="text-[oklch(52%_0.16_28)] font-bold tabular-nums">
                                -฿{metrics.fixedExpenses.toLocaleString()}
                            </span>
                        </div>

                        <div className="p-3 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] space-y-1">
                            <span className="text-[10px] text-[oklch(42%_0.010_28)] block uppercase">
                                NET OPERATING PROFIT
                            </span>
                            <div className="font-mono text-2xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                ฿{metrics.netOperatingProfit.toLocaleString()}
                            </div>
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block">
                                Net Margin: ~{metrics.netProfitMarginPct}% ของยอดขาย
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
