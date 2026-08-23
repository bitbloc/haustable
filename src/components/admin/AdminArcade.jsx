/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Trophy, Ticket, AlertTriangle, Play, CheckCircle2, RefreshCw, X, Award, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function AdminArcade() {
    const [leaderboard, setLeaderboard] = useState([])
    const [raffleTickets, setRaffleTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [drawingLoading, setDrawingLoading] = useState(false)
    const [drawResult, setDrawResult] = useState(null)

    const fetchData = async (showLoadingState = false) => {
        try {
            if (showLoadingState) setLoading(true)

            // 1. Fetch Leaderboard
            const { data: lbData, error: lbError } = await supabase
                .from('leaderboard')
                .select('*')
                .order('score', { ascending: false })

            if (lbError) throw lbError
            setLeaderboard(lbData || [])

            // 2. Fetch current week's raffle ticket logs
            const now = new Date()
            const day = now.getDay()
            const diff = now.getDate() - day + (day === 0 ? -6 : 1)
            const weekStart = new Date(now.setDate(diff))
            weekStart.setHours(0, 0, 0, 0)

            const { data: rfData, error: rfError } = await supabase
                .from('arcade_rewards_log')
                .select(`
                    id,
                    profile_id,
                    score,
                    created_at,
                    profiles:profile_id (
                        display_name,
                        nickname,
                        phone_number
                    )
                `)
                .eq('reward_type', 'raffle_40')
                .gte('created_at', weekStart.toISOString())
                .order('created_at', { ascending: false })

            if (rfError) throw rfError
            setRaffleTickets(rfData || [])

        } catch (err) {
            console.error('Error fetching arcade details:', err)
            if (showLoadingState) toast.error('ไม่สามารถโหลดข้อมูลสถิติเกม Arcade ได้')
        } finally {
            if (showLoadingState) setLoading(false)
        }
    }

    useEffect(() => {
        fetchData(true)

        let debounceTimer = null
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                if (!drawingLoading) {
                    fetchData(false)
                }
            }, 400)
        }

        const channel = supabase
            .channel('admin-arcade-stats-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'arcade_rewards_log' }, debouncedFetch)
            .subscribe()

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
        }
    }, [drawingLoading])

    const handleRunDrawing = async () => {
        const confirmDraw = window.confirm(
            "⚠️ ยืนยันการสุ่มจับรางวัลและรีเซ็ตสัปดาห์:\n\nการดำเนินการนี้จะทำการ:\n1. มอบ 50 xhaus แก่อันดับ 1 บน Leaderboard\n2. สุ่มมอบ 50 xhaus แก่ผู้ถือตั๋วชิงโชค 1 คน\n3. รีเซ็ตตาราง Leaderboard เพื่อเริ่มสัปดาห์ใหม่\n\nคุณแน่ใจหรือไม่ว่าต้องการดำเนินการ?"
        )

        if (!confirmDraw) return

        try {
            setDrawingLoading(true)
            const { data, error } = await supabase.rpc('draw_weekly_arcade_raffle_and_reset')
            if (error) throw error

            setDrawResult(data)
            toast.success('🎉 ดำเนินการจับรางวัลและรีเซ็ตสัปดาห์เรียบร้อยแล้ว!')
            fetchData()
        } catch (err) {
            console.error('Error during drawing:', err)
            toast.error(err.message || 'เกิดข้อผิดพลาดในการรันระบบจับรางวัล')
        } finally {
            setDrawingLoading(false)
        }
    }

    return (
        <div className="space-y-6 font-mono">
            {/* Header Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.02_28)] px-2 py-0.5 rounded-xs border border-[oklch(85%_0.012_28)]">
                            ARCADE GAMING & WEEKLY REWARDS
                        </span>
                    </div>
                    <h2 className="text-base font-bold uppercase text-[oklch(18%_0.012_28)] mt-1">
                        ระบบสุ่มรางวัล & รีเซ็ตเกมประจำสัปดาห์ (Sunday Night Draw)
                    </h2>
                    <p className="text-xs text-[oklch(55%_0.010_28)] mt-0.5">
                        การแจกเหรียญ xhaus ประจำสัปดาห์แก่ผู้เล่นระดับท็อป 1 และผู้ถือตั๋วชิงโชค (บินเกิน 40 ท่อ)
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={fetchData}
                        className="px-3 py-2 bg-white hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-bold transition-colors cursor-pointer"
                        title="รีเฟรชข้อมูล"
                    >
                        <RefreshCw size={13} />
                    </button>
                    <button
                        type="button"
                        onClick={handleRunDrawing}
                        disabled={drawingLoading}
                        className="bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                    >
                        <Play size={14} />
                        <span>{drawingLoading ? 'กำลังประมวลผล...' : 'จับรางวัล & รีเซ็ตสัปดาห์'}</span>
                    </button>
                </div>
            </div>

            {/* Rules Info Card */}
            <div className="bg-white border border-[oklch(85%_0.012_28)] p-4 rounded-sm text-xs text-[oklch(42%_0.010_28)] space-y-1.5">
                <div className="flex items-center gap-2 text-[oklch(52%_0.16_28)] font-bold">
                    <AlertTriangle size={15} />
                    <span className="uppercase text-[11px]">กติกาการแจกเหรียญ xhaus ประจำสัปดาห์:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-[oklch(55%_0.010_28)]">
                    <li><strong className="text-[oklch(18%_0.012_28)]">อันดับ 1 Leaderboard</strong> ณ สิ้นสัปดาห์: รับรางวัลพิเศษ 50 xhaus</li>
                    <li><strong className="text-[oklch(18%_0.012_28)]">ผู้เล่นที่บินได้ 40 ท่อขึ้นไป</strong>: รับตั๋วสุ่มสิทธิ์ (Raffle Ticket) วันละ 1 ใบ</li>
                    <li><strong className="text-[oklch(18%_0.012_28)]">การสุ่มจับรางวัล</strong>: สุ่มผู้ชนะ 1 คนจากตั๋วทั้งหมดในสัปดาห์เพื่อรับ 50 xhaus และรีเซ็ตลีดเดอร์บอร์ด</li>
                </ul>
            </div>

            {/* Draw Result Celebration Card */}
            <AnimatePresence>
                {drawResult && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="bg-[oklch(94%_0.02_140)] border border-[oklch(45%_0.08_140)] p-4 rounded-sm text-xs text-[oklch(18%_0.012_28)] relative shadow-sm"
                    >
                        <button
                            type="button"
                            onClick={() => setDrawResult(null)}
                            className="absolute top-3 right-3 text-[oklch(45%_0.08_140)] hover:text-black cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-2 text-[oklch(45%_0.08_140)] font-bold text-sm mb-3">
                            <CheckCircle2 size={16} />
                            <span>ผลการจับรางวัลและรีเซ็ตสัปดาห์สำเร็จเรียบร้อย!</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-white p-3 rounded-sm border border-[oklch(45%_0.08_140)]/40">
                                <span className="text-[10px] uppercase font-bold text-[oklch(55%_0.010_28)] block">
                                    🏆 อันดับ 1 ประจำสัปดาห์ (Leaderboard Top Player)
                                </span>
                                <p className="text-base font-bold text-[oklch(18%_0.012_28)] mt-0.5">
                                    {drawResult.top_player?.name || '-'} ({drawResult.top_player?.score || 0} คะแนน)
                                </p>
                                <span className="text-[11px] text-[oklch(45%_0.08_140)] font-bold mt-1 block">
                                    ได้รับรางวัลพิเศษ 50 xhaus 🪙
                                </span>
                            </div>

                            <div className="bg-white p-3 rounded-sm border border-[oklch(45%_0.08_140)]/40">
                                <span className="text-[10px] uppercase font-bold text-[oklch(55%_0.010_28)] block">
                                    🎟️ ผู้ชนะตั๋วสุ่มลุ้นโชค (Raffle Winner)
                                </span>
                                <p className="text-base font-bold text-[oklch(18%_0.012_28)] mt-0.5">
                                    {drawResult.raffle_winner?.name || '-'}
                                </p>
                                <span className="text-[11px] text-[oklch(45%_0.08_140)] font-bold mt-1 block">
                                    สุ่มสำเร็จจากตั๋ว {drawResult.raffle_winner?.tickets_checked || 0} ใบ (รับ 50 xhaus 🪙)
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Grid Layout: Leaderboard & Raffle Tickets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* 1. Leaderboard Table */}
                <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-4 shadow-2xs">
                    <div className="flex items-center justify-between pb-3 border-b border-[oklch(85%_0.012_28)] mb-3">
                        <div className="flex items-center gap-2">
                            <Trophy size={16} className="text-[oklch(52%_0.16_28)]" />
                            <h3 className="font-bold text-xs uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                คะแนน Leaderboard สัปดาห์นี้ ({leaderboard.length})
                            </h3>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-xs text-[oklch(55%_0.010_28)]">กำลังโหลด...</div>
                    ) : leaderboard.length === 0 ? (
                        <div className="text-center py-12 bg-[oklch(98%_0.006_28)] border border-dashed border-[oklch(85%_0.012_28)] rounded-sm text-xs text-[oklch(55%_0.010_28)]">
                            ยังไม่มีคะแนนการเล่นในสัปดาห์นี้
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse font-mono">
                                <thead>
                                    <tr className="border-b border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] uppercase text-[10px]">
                                        <th className="py-2 px-2 w-12 text-center">อันดับ</th>
                                        <th className="py-2 px-2">ชื่อผู้เล่น</th>
                                        <th className="py-2 px-2 text-right">คะแนน</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(85%_0.012_28)]">
                                    {leaderboard.map((item, index) => {
                                        const isTop1 = index === 0
                                        const isTop3 = index < 3
                                        return (
                                            <tr 
                                                key={item.id || index}
                                                className={isTop1 ? 'bg-[oklch(97%_0.008_28)] font-bold' : 'hover:bg-[oklch(98%_0.006_28)]'}
                                            >
                                                <td className="py-2.5 px-2 text-center">
                                                    <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-bold ${
                                                        isTop1 
                                                            ? 'bg-[oklch(52%_0.16_28)] text-white' 
                                                            : isTop3 
                                                                ? 'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)]' 
                                                                : 'text-[oklch(55%_0.010_28)]'
                                                    }`}>
                                                        {String(index + 1).padStart(2, '0')}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2 font-medium text-[oklch(18%_0.012_28)]">
                                                    {item.display_name || 'Anonymous Player'}
                                                </td>
                                                <td className="py-2.5 px-2 text-right font-bold text-[oklch(52%_0.16_28)]">
                                                    {item.score} <span className="text-[10px] font-normal text-[oklch(55%_0.010_28)]">ท่อ</span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 2. Raffle Tickets Log */}
                <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-4 shadow-2xs">
                    <div className="flex items-center justify-between pb-3 border-b border-[oklch(85%_0.012_28)] mb-3">
                        <div className="flex items-center gap-2">
                            <Ticket size={16} className="text-[oklch(45%_0.08_140)]" />
                            <h3 className="font-bold text-xs uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                ตั๋วสุ่มลุ้นโชคในสัปดาห์นี้ ({raffleTickets.length})
                            </h3>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-xs text-[oklch(55%_0.010_28)]">กำลังโหลด...</div>
                    ) : raffleTickets.length === 0 ? (
                        <div className="text-center py-12 bg-[oklch(98%_0.006_28)] border border-dashed border-[oklch(85%_0.012_28)] rounded-sm text-xs text-[oklch(55%_0.010_28)]">
                            ยังไม่มีผู้สะสมตั๋วสุ่มในสัปดาห์นี้
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse font-mono">
                                <thead>
                                    <tr className="border-b border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] uppercase text-[10px]">
                                        <th className="py-2 px-2">ชื่อผู้ถือตั๋ว</th>
                                        <th className="py-2 px-2 text-center">สถิติท่อ</th>
                                        <th className="py-2 px-2 text-right">วันที่ได้รับ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(85%_0.012_28)]">
                                    {raffleTickets.map(log => {
                                        const profileName = log.profiles?.nickname || log.profiles?.display_name || 'Member'
                                        return (
                                            <tr key={log.id} className="hover:bg-[oklch(98%_0.006_28)]">
                                                <td className="py-2.5 px-2 font-medium text-[oklch(18%_0.012_28)] flex items-center gap-1.5">
                                                    <span className="text-[10px] text-[oklch(45%_0.08_140)]">🎟️</span>
                                                    <span>{profileName}</span>
                                                </td>
                                                <td className="py-2.5 px-2 text-center font-bold text-[oklch(18%_0.012_28)]">
                                                    {log.score}
                                                </td>
                                                <td className="py-2.5 px-2 text-right text-[11px] text-[oklch(55%_0.010_28)]">
                                                    {format(new Date(log.created_at), 'dd MMM, HH:mm')}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
