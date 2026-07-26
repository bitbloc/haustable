/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'
import { Sparkles, AlertTriangle, Grid, CloudRain, Lightbulb, TrendingUp, DollarSign, Target, ArrowRight } from 'lucide-react'

export default function UnmetNeedAnalytics({ data }) {
    const yieldLeakage = data?.yieldLeakage || {
        estimatedLostRevenue: 4200,
        soloInFourTopPct: 32.5,
        deadSeatCount: 28,
        recommendation: 'ในรอบ Peak Dinner (18:00-20:00) แนะนำจัดสรรโต๊ะ 2 ท็อปแยกโซน หรือใช้ตัวแบ่งโต๊ะเพื่อเพิ่มความจุที่นั่งได้อีก +24%',
    }

    const menuMatrix = data?.menuMatrix || [
        { quadrant: 'Stars (ดาวเด่น)', items: ['ข้าวหน้าเนื้อวากิว', 'Yuzu Highball'], desc: 'กำไรสูง + ขายดีมาก', action: 'คงคุณภาพ & โฆษณาหลัก', bg: 'bg-emerald-50 border-2 border-emerald-300 text-emerald-950' },
        { quadrant: 'Plowhorses (ตัวทำเงิน)', items: ['ข้าวแกงกะหรี่คัตสึ', 'ชาเขียวเย็น'], desc: 'ขายดีมาก แต่กำไรต่อจานต่ำ', action: 'ปรับเพิ่มราคา ฿10-15 หรือคุมต้นทุน', bg: 'bg-blue-50 border-2 border-blue-300 text-blue-950' },
        { quadrant: 'Puzzles (ปริศนากำไรสูง)', items: ['สเต๊กริบอายออสเตรเลีย', 'เซตครอบครัว B'], desc: 'กำไรสูงมาก แต่ยอดขายยังน้อย', action: 'จัดโปรโมชั่นดันให้เป็นดาวเด่น', bg: 'bg-purple-50 border-2 border-purple-300 text-purple-950' },
        { quadrant: 'Dogs (ภาระต้นทุน)', items: ['สลัดเต้าหู้ทอด', 'ซุปมิโซะพิเศษ'], desc: 'กำไรต่ำ + ขายได้น้อย', action: 'พิจารณาถอดออกจากเมนูหลัก', bg: 'bg-rose-50 border-2 border-rose-300 text-rose-950' },
    ]

    const weatherPredictor = data?.weatherPredictor || {
        currentWeather: 'ฝนตกหนักช่วงเย็น (Rainy Surge)',
        dineInImpact: '-18% Dine-in / จองโต๊ะ',
        pickupImpact: '+35% Pickup / สั่งกลับบ้าน',
        netRevenueImpact: '+8.5% Net Basket Size',
        paydaySurgeBonus: '+28% Revenue ช่วง 28-3 ของเดือน',
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[oklch(85%_0.012_28)] gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <Sparkles size={20} className="text-[oklch(52%_0.16_28)] shrink-0" />
                        <h3 className="font-black text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                            Unmet Need & Profit Maximizer Features
                        </h3>
                    </div>
                    <p className="text-xs font-semibold text-[oklch(42%_0.010_28)] mt-0.5">
                        ระบบตรวจจับขยะเวลาโต๊ะว่าง (Yield Leakage) และเมทริกซ์วิเคราะห์กำไรเมนู
                    </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-mono text-xs text-[oklch(52%_0.16_28)] font-black self-start sm:self-auto">
                    <Lightbulb size={14} />
                    <span>AI PROFIT INSIGHTS</span>
                </div>
            </div>

            {/* Grid 1: Yield & Seat Leakage Detector */}
            <div className="bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                        <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                            YIELD & SEAT LEAKAGE DETECTOR
                        </h4>
                    </div>
                    <span className="font-mono text-xs font-black text-rose-800 bg-rose-100 px-3 py-1 rounded-lg border-2 border-rose-300 self-start sm:self-auto">
                        สูญเสียโอกาส ฿{yieldLeakage.estimatedLostRevenue.toLocaleString()}/วัน
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                    <div className="p-3.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                        <div className="text-[11px] text-[oklch(42%_0.010_28)] font-bold">โต๊ะ 4 ท็อปนั่ง 1-2 ท่านช่วงพีค</div>
                        <div className="font-black text-xl text-[oklch(52%_0.16_28)]">{yieldLeakage.soloInFourTopPct}%</div>
                        <div className="text-[10px] text-[oklch(42%_0.010_28)] font-bold">เกิดขยะพื้นที่ที่นั่งแฝง</div>
                    </div>

                    <div className="p-3.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                        <div className="text-[11px] text-[oklch(42%_0.010_28)] font-bold">เก้าอี้ว่างสูญเปล่า (Dead Seats)</div>
                        <div className="font-black text-xl text-[oklch(18%_0.012_28)]">{yieldLeakage.deadSeatCount} ที่นั่ง/รอบพีค</div>
                        <div className="text-[10px] text-[oklch(42%_0.010_28)] font-bold">ในรอบ 18:00 - 20:00</div>
                    </div>

                    <div className="p-3.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                        <div className="text-[11px] text-[oklch(42%_0.010_28)] font-bold">โอกาสเพิ่มรายได้เมื่อปรับผัง</div>
                        <div className="font-black text-xl text-emerald-800">+฿{(yieldLeakage.estimatedLostRevenue * 30).toLocaleString()}</div>
                        <div className="text-[10px] text-emerald-700 font-bold">เมื่อจัดสรรโต๊ะ 2-top คล่องตัว</div>
                    </div>
                </div>

                <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs font-sans text-amber-950 flex items-start gap-2.5 shadow-sm">
                    <Lightbulb size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <strong className="font-black">ข้อเสนอแนะเพื่อเพิ่มรายได้:</strong> {yieldLeakage.recommendation}
                    </div>
                </div>
            </div>

            {/* Grid 2: Menu Engineering Cash Matrix */}
            <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b-2 border-[oklch(85%_0.012_28)] pb-2.5">
                    <div className="flex items-center gap-2">
                        <Grid size={20} className="text-[oklch(52%_0.16_28)] shrink-0" />
                        <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                            MENU ENGINEERING CASH MATRIX (4 QUADRANTS)
                        </h4>
                    </div>
                    <span className="font-mono text-xs font-black text-[oklch(42%_0.010_28)]">Popularity vs Profit</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:gap-4">
                    {menuMatrix.map((q, idx) => (
                        <div key={idx} className={`p-4 rounded-xl space-y-2 ${q.bg}`}>
                            <div className="flex items-center justify-between">
                                <h5 className="font-black text-sm md:text-base font-sans">{q.quadrant}</h5>
                                <span className="font-mono text-[11px] font-bold opacity-90">{q.desc}</span>
                            </div>

                            <div className="space-y-1 pt-1">
                                <div className="text-xs font-black font-mono">รายการเมนูในกลุ่มนี้:</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {q.items.map((it, iIdx) => (
                                        <span key={iIdx} className="px-2 py-1 bg-white rounded-lg border-2 border-black/10 text-xs font-sans font-black shadow-sm">
                                            {it}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="text-[11px] font-mono font-black pt-2 border-t border-black/15">
                                📌 แนะนำ: {q.action}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Grid 3: Weather & Surge Sales Predictor */}
            <div className="bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <CloudRain size={20} className="text-indigo-600 shrink-0" />
                        <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                            WEATHER & PAYDAY SURGE PREDICTOR
                        </h4>
                    </div>
                    <span className="font-mono text-xs font-black text-indigo-900 bg-indigo-100 px-3 py-1 rounded-lg border border-indigo-300 self-start sm:self-auto">
                        {weatherPredictor.currentWeather}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs pt-1">
                    <div className="p-3.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                        <div className="text-[11px] text-[oklch(42%_0.010_28)] font-bold">ผลกระทบหน้าร้าน (Dine-in)</div>
                        <div className="font-black text-base text-rose-800">{weatherPredictor.dineInImpact}</div>
                    </div>

                    <div className="p-3.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                        <div className="text-[11px] text-[oklch(42%_0.010_28)] font-bold">ผลกระทบรับกลับบ้าน (Pickup)</div>
                        <div className="font-black text-base text-emerald-800">{weatherPredictor.pickupImpact}</div>
                    </div>

                    <div className="p-3.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                        <div className="text-[11px] text-[oklch(42%_0.010_28)] font-bold">โบนัสรอบเงินเดือนออก (Payday)</div>
                        <div className="font-black text-base text-[oklch(52%_0.16_28)]">{weatherPredictor.paydaySurgeBonus}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
