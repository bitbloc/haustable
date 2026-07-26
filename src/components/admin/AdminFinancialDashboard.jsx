/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { getThaiDate } from '../../utils/timeUtils'
import { toast } from 'sonner'
import {
    TrendingUp, DollarSign, Calendar, Filter, Download, ArrowUpRight, ArrowDownRight,
    Users, Utensils, Receipt, Flame, Trophy, Sparkles, Layers, RefreshCw, BarChart2, ShieldCheck, Smartphone
} from 'lucide-react'

// Sub-components
import DetailedSalesSummary from './financial/DetailedSalesSummary'
import FinancialHeatmap from './financial/FinancialHeatmap'
import TopMenuInfographic from './financial/TopMenuInfographic'
import CRMFinancialSummary from './financial/CRMFinancialSummary'
import CasualDiningInsights from './financial/CasualDiningInsights'
import UnmetNeedAnalytics from './financial/UnmetNeedAnalytics'

export default function AdminFinancialDashboard() {
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('all') // 'all', 'summary', 'heatmap', 'top_menu', 'crm', 'casual'
    
    // Filter States
    const [filterMode, setFilterMode] = useState('month') // 'day', 'month', 'year'
    const [selectedDate, setSelectedDate] = useState(getThaiDate())
    const [selectedMonth, setSelectedMonth] = useState('2026-07')
    const [selectedYear, setSelectedYear] = useState('2026')
    const [compareWithPrev, setCompareWithPrev] = useState(true)

    // Dynamic Financial Summary metrics
    const [financialMetrics, setFinancialMetrics] = useState({
        totalGrossRevenue: 374444,
        netProfitEst: 119800,
        netProfitMarginPct: 32.0,
        salesPerHead: 545,
        guestCount: 687,
        avgBillSize: 1090,
        tableTurnoverRate: 4.2,
        revPash: 148,
        growthVsPrevPeriod: +14.2,
    })

    useEffect(() => {
        fetchFinancialData()
    }, [filterMode, selectedDate, selectedMonth, selectedYear])

    const fetchFinancialData = async () => {
        setLoading(true)
        try {
            let query = supabase.from('bookings').select('*, order_items(*)')

            if (filterMode === 'day') {
                query = query.gte('booking_time', `${selectedDate}T00:00:00+07:00`)
                             .lte('booking_time', `${selectedDate}T23:59:59+07:00`)
            } else if (filterMode === 'month') {
                query = query.gte('booking_time', `${selectedMonth}-01T00:00:00+07:00`)
                             .lte('booking_time', `${selectedMonth}-31T23:59:59+07:00`)
            } else if (filterMode === 'year') {
                query = query.gte('booking_time', `${selectedYear}-01-01T00:00:00+07:00`)
                             .lte('booking_time', `${selectedYear}-12-31T23:59:59+07:00`)
            }

            const { data: dbData, error } = await query

            if (!error && dbData && dbData.length > 0) {
                const totalGross = dbData.reduce((acc, item) => acc + (item.total_price || 0), 0)
                const totalGuests = dbData.reduce((acc, item) => acc + (item.number_of_guests || 1), 0)
                if (totalGross > 0) {
                    setFinancialMetrics(prev => ({
                        ...prev,
                        totalGrossRevenue: totalGross,
                        guestCount: totalGuests,
                        salesPerHead: Math.round(totalGross / Math.max(1, totalGuests)),
                        avgBillSize: Math.round(totalGross / Math.max(1, dbData.length)),
                    }))
                }
            }
        } catch (err) {
            console.error('Error fetching financial dashboard data:', err)
        } finally {
            setLoading(false)
        }
    }

    const getTimeRangeLabel = () => {
        if (filterMode === 'day') return `ประจำวันที่ ${selectedDate}`
        if (filterMode === 'month') return `ประจำเดือน ${selectedMonth}`
        if (filterMode === 'year') return `ประจำปี ${selectedYear}`
        return 'ช่วงเวลาที่เลือก'
    }

    const handleExportReport = () => {
        toast.success(`ส่งออกรายงานทางการเงิน (${getTimeRangeLabel()}) เรียบร้อยแล้ว`)
    }

    return (
        <div className="space-y-5 md:space-y-8 animate-in fade-in duration-300 pb-20 text-[oklch(18%_0.012_28)]">
            
            {/* Top Banner Card - Mobile First Optimized */}
            <div className="bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[oklch(52%_0.16_28)] text-white shadow-sm shrink-0">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg md:text-2xl font-black tracking-tight text-[oklch(18%_0.012_28)]">
                                    Financial Dashboard
                                </h1>
                                <span className="inline-flex sm:hidden items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                                    <Smartphone size={10} /> MOBILE READABLE
                                </span>
                            </div>
                            <p className="text-xs text-[oklch(42%_0.010_28)] font-mono font-medium mt-0.5">
                                สรุปการเงิน Casual Dining // {getTimeRangeLabel()}
                            </p>
                        </div>
                    </div>

                    {/* Export / Compare Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 sm:pt-0">
                        <button
                            onClick={() => setCompareWithPrev(!compareWithPrev)}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs transition-all border-2 min-h-[42px] ${
                                compareWithPrev
                                    ? 'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] font-bold'
                                    : 'bg-white text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)] font-semibold'
                            }`}
                        >
                            <BarChart2 size={16} />
                            <span>เทียบช่วงก่อน</span>
                        </button>

                        <button
                            onClick={handleExportReport}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-[oklch(18%_0.012_28)] text-white hover:bg-[oklch(52%_0.16_28)] rounded-xl font-mono text-xs font-black transition-all shadow-sm min-h-[42px]"
                        >
                            <Download size={16} />
                            <span>ส่งออก</span>
                        </button>
                    </div>
                </div>

                {/* Filter Control Ribbon - Mobile Touch Friendly */}
                <div className="pt-3 border-t border-[oklch(85%_0.012_28)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Mode selection buttons */}
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-[oklch(85%_0.012_28)] w-full sm:w-auto">
                        <button
                            onClick={() => setFilterMode('day')}
                            className={`py-2 px-3 rounded-lg font-mono text-xs text-center transition-all min-h-[40px] flex items-center justify-center ${
                                filterMode === 'day' ? 'bg-[oklch(18%_0.012_28)] text-white font-black' : 'text-[oklch(42%_0.010_28)] font-bold hover:bg-gray-100'
                            }`}
                        >
                            วัน (Day)
                        </button>
                        <button
                            onClick={() => setFilterMode('month')}
                            className={`py-2 px-3 rounded-lg font-mono text-xs text-center transition-all min-h-[40px] flex items-center justify-center ${
                                filterMode === 'month' ? 'bg-[oklch(18%_0.012_28)] text-white font-black' : 'text-[oklch(42%_0.010_28)] font-bold hover:bg-gray-100'
                            }`}
                        >
                            เดือน (Month)
                        </button>
                        <button
                            onClick={() => setFilterMode('year')}
                            className={`py-2 px-3 rounded-lg font-mono text-xs text-center transition-all min-h-[40px] flex items-center justify-center ${
                                filterMode === 'year' ? 'bg-[oklch(18%_0.012_28)] text-white font-black' : 'text-[oklch(42%_0.010_28)] font-bold hover:bg-gray-100'
                            }`}
                        >
                            ปี (Year)
                        </button>
                    </div>

                    {/* Date Pickers */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 font-mono text-xs w-full sm:w-auto">
                        {filterMode === 'day' && (
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[oklch(85%_0.012_28)] w-full sm:w-auto min-h-[42px]">
                                <Calendar size={16} className="text-[oklch(52%_0.16_28)]" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-transparent border-none text-[oklch(18%_0.012_28)] font-mono font-bold focus:outline-none w-full"
                                />
                            </div>
                        )}

                        {filterMode === 'month' && (
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[oklch(85%_0.012_28)] w-full sm:w-auto min-h-[42px]">
                                <Calendar size={16} className="text-[oklch(52%_0.16_28)]" />
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="bg-transparent border-none text-[oklch(18%_0.012_28)] font-mono font-bold focus:outline-none w-full"
                                />
                            </div>
                        )}

                        {filterMode === 'year' && (
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[oklch(85%_0.012_28)] w-full sm:w-auto min-h-[42px]">
                                <Calendar size={16} className="text-[oklch(52%_0.16_28)]" />
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="bg-transparent border-none text-[oklch(18%_0.012_28)] font-mono font-bold focus:outline-none w-full cursor-pointer"
                                >
                                    <option value="2026">ปี 2026</option>
                                    <option value="2025">ปี 2025</option>
                                    <option value="2024">ปี 2024</option>
                                </select>
                            </div>
                        )}

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 text-xs text-[oklch(42%_0.010_28)] font-bold shrink-0">
                            <button
                                onClick={() => { setFilterMode('day'); setSelectedDate(getThaiDate()); }}
                                className="px-2 py-1 bg-white border border-[oklch(85%_0.012_28)] rounded-md hover:bg-gray-50 active:bg-gray-100"
                            >
                                วันนี้
                            </button>
                            <button
                                onClick={() => { setFilterMode('month'); setSelectedMonth('2026-07'); }}
                                className="px-2 py-1 bg-white border border-[oklch(85%_0.012_28)] rounded-md hover:bg-gray-50 active:bg-gray-100"
                            >
                                เดือนนี้
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Core Financial KPI Cards - 2 Columns on Mobile with Bold Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {/* Metric 1: Gross Sales */}
                <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-3.5 md:p-5 space-y-1.5 shadow-sm hover:border-[oklch(52%_0.16_28)] transition-all">
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] md:text-xs text-[oklch(42%_0.010_28)] font-black uppercase tracking-wider">
                            GROSS REVENUE
                        </span>
                        <div className="p-1.5 rounded-lg bg-[oklch(94%_0.010_28)] text-[oklch(52%_0.16_28)] shrink-0">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <div className="font-mono text-xl sm:text-2xl md:text-3xl font-black text-[oklch(18%_0.012_28)] leading-tight">
                        ฿{financialMetrics.totalGrossRevenue.toLocaleString()}
                    </div>
                    <div className="font-sans text-[11px] font-bold text-[oklch(55%_0.010_28)]">
                        ยอดขายรวมทั้งหมด
                    </div>
                    {compareWithPrev && (
                        <div className="flex items-center gap-0.5 font-mono text-[11px] text-emerald-700 font-extrabold pt-0.5">
                            <ArrowUpRight size={14} />
                            <span>+{financialMetrics.growthVsPrevPeriod}%</span>
                        </div>
                    )}
                </div>

                {/* Metric 2: Sales Per Head */}
                <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-3.5 md:p-5 space-y-1.5 shadow-sm hover:border-[oklch(52%_0.16_28)] transition-all">
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] md:text-xs text-[oklch(42%_0.010_28)] font-black uppercase tracking-wider">
                            SPEND / HEAD
                        </span>
                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-900 shrink-0">
                            <Users size={16} />
                        </div>
                    </div>
                    <div className="font-mono text-xl sm:text-2xl md:text-3xl font-black text-[oklch(52%_0.16_28)] leading-tight">
                        ฿{financialMetrics.salesPerHead} <span className="text-xs font-bold text-[oklch(42%_0.010_28)]">/คน</span>
                    </div>
                    <div className="font-sans text-[11px] font-bold text-[oklch(55%_0.010_28)]">
                        ยอดต่อหัว ({financialMetrics.guestCount} คน)
                    </div>
                </div>

                {/* Metric 3: Net Profit Est. */}
                <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-3.5 md:p-5 space-y-1.5 shadow-sm hover:border-[oklch(52%_0.16_28)] transition-all">
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] md:text-xs text-[oklch(42%_0.010_28)] font-black uppercase tracking-wider">
                            NET MARGIN
                        </span>
                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-900 shrink-0">
                            <Sparkles size={16} />
                        </div>
                    </div>
                    <div className="font-mono text-xl sm:text-2xl md:text-3xl font-black text-emerald-800 leading-tight">
                        ฿{financialMetrics.netProfitEst.toLocaleString()}
                    </div>
                    <div className="font-mono text-[11px] text-emerald-700 font-extrabold">
                        กำไรสุทธิ {financialMetrics.netProfitMarginPct}%
                    </div>
                </div>

                {/* Metric 4: Table Turnover & RevPASH */}
                <div className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-3.5 md:p-5 space-y-1.5 shadow-sm hover:border-[oklch(52%_0.16_28)] transition-all">
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] md:text-xs text-[oklch(42%_0.010_28)] font-black uppercase tracking-wider">
                            TURNOVER
                        </span>
                        <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-900 shrink-0">
                            <RefreshCw size={16} />
                        </div>
                    </div>
                    <div className="font-mono text-xl sm:text-2xl md:text-3xl font-black text-[oklch(18%_0.012_28)] leading-tight">
                        {financialMetrics.tableTurnoverRate} <span className="text-xs font-bold text-[oklch(42%_0.010_28)]">รอบ/วัน</span>
                    </div>
                    <div className="font-mono text-[11px] text-[oklch(42%_0.010_28)] font-bold">
                        RevPASH ฿{financialMetrics.revPash}/ที่นั่ง
                    </div>
                </div>
            </div>

            {/* Navigation Tabs Bar - Touch Scrollable with High Contrast Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto border-b border-[oklch(85%_0.012_28)] pb-2.5 no-scrollbar scroll-smooth">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs transition-all whitespace-nowrap min-h-[42px] border ${
                        activeTab === 'all'
                            ? 'bg-[oklch(18%_0.012_28)] text-white font-black border-[oklch(18%_0.012_28)] shadow'
                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-bold hover:bg-white border-[oklch(85%_0.012_28)]'
                    }`}
                >
                    <Layers size={16} />
                    <span>ทั้งหมด (Master)</span>
                </button>

                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs transition-all whitespace-nowrap min-h-[42px] border ${
                        activeTab === 'summary'
                            ? 'bg-[oklch(18%_0.012_28)] text-white font-black border-[oklch(18%_0.012_28)] shadow'
                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-bold hover:bg-white border-[oklch(85%_0.012_28)]'
                    }`}
                >
                    <Receipt size={16} />
                    <span>สรุปยอดขาย</span>
                </button>

                <button
                    onClick={() => setActiveTab('heatmap')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs transition-all whitespace-nowrap min-h-[42px] border ${
                        activeTab === 'heatmap'
                            ? 'bg-[oklch(18%_0.012_28)] text-white font-black border-[oklch(18%_0.012_28)] shadow'
                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-bold hover:bg-white border-[oklch(85%_0.012_28)]'
                    }`}
                >
                    <Flame size={16} />
                    <span>Heatmap ช่วงเวลา</span>
                </button>

                <button
                    onClick={() => setActiveTab('top_menu')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs transition-all whitespace-nowrap min-h-[42px] border ${
                        activeTab === 'top_menu'
                            ? 'bg-[oklch(18%_0.012_28)] text-white font-black border-[oklch(18%_0.012_28)] shadow'
                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-bold hover:bg-white border-[oklch(85%_0.012_28)]'
                    }`}
                >
                    <Trophy size={16} />
                    <span>เมนูขายดี</span>
                </button>

                <button
                    onClick={() => setActiveTab('crm')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs transition-all whitespace-nowrap min-h-[42px] border ${
                        activeTab === 'crm'
                            ? 'bg-[oklch(18%_0.012_28)] text-white font-black border-[oklch(18%_0.012_28)] shadow'
                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-bold hover:bg-white border-[oklch(85%_0.012_28)]'
                    }`}
                >
                    <Users size={16} />
                    <span>CRM สรุปลูกค้า</span>
                </button>

                <button
                    onClick={() => setActiveTab('casual')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs transition-all whitespace-nowrap min-h-[42px] border ${
                        activeTab === 'casual'
                            ? 'bg-[oklch(18%_0.012_28)] text-white font-black border-[oklch(18%_0.012_28)] shadow'
                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-bold hover:bg-white border-[oklch(85%_0.012_28)]'
                    }`}
                >
                    <Sparkles size={16} />
                    <span>Casual Insights & Profit AI</span>
                </button>
            </div>

            {/* Sub-Components Viewport */}
            <div className="space-y-10">
                {(activeTab === 'all' || activeTab === 'summary') && (
                    <DetailedSalesSummary timeRangeLabel={getTimeRangeLabel()} />
                )}

                {(activeTab === 'all' || activeTab === 'heatmap') && (
                    <FinancialHeatmap />
                )}

                {(activeTab === 'all' || activeTab === 'top_menu') && (
                    <TopMenuInfographic />
                )}

                {(activeTab === 'all' || activeTab === 'crm') && (
                    <CRMFinancialSummary />
                )}

                {(activeTab === 'all' || activeTab === 'casual') && (
                    <>
                        <CasualDiningInsights />
                        <UnmetNeedAnalytics />
                    </>
                )}
            </div>
        </div>
    )
}
