import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Trophy, Ticket, AlertTriangle, Users, Play, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminArcade() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [raffleTickets, setRaffleTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drawingLoading, setDrawingLoading] = useState(false);
    const [drawResult, setDrawResult] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Leaderboard
            const { data: lbData, error: lbError } = await supabase
                .from('leaderboard')
                .select('*')
                .order('score', { ascending: false });
            if (lbError) throw lbError;
            setLeaderboard(lbData || []);

            // 2. Fetch current week's raffle ticket logs
            const now = new Date();
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const weekStart = new Date(now.setDate(diff));
            weekStart.setHours(0, 0, 0, 0);

            const { data: rfData, error: rfError } = await supabase
                .from('arcade_rewards_log')
                .select(`
                    id,
                    profile_id,
                    score,
                    created_at,
                    profiles:profile_id (
                        display_name,
                        nickname
                    )
                `)
                .eq('reward_type', 'raffle_40')
                .gte('created_at', weekStart.toISOString())
                .order('created_at', { ascending: false });

            if (rfError) throw rfError;
            setRaffleTickets(rfData || []);

        } catch (err) {
            console.error('Error fetching admin arcade details:', err);
            toast.error('Failed to load arcade statistics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRunDrawing = async () => {
        const confirmDraw = window.confirm(
            "⚠️ คำเตือนสำคัญ:\n\nการสุ่มจับรางวัลประจำสัปดาห์นี้จะทำการ:\n1. มอบรางวัล 50 xhaus แก่ผู้ชนะสุ่มรายชื่อ (Raffle Draw)\n2. มอบรางวัล 50 xhaus แก่อันดับ 1 บนลีดเดอร์บอร์ด (Top Player)\n3. รีเซ็ตลีดเดอร์บอร์ดทั้งหมดเพื่อเริ่มสัปดาห์ใหม่\n\nคุณแน่ใจหรือไม่ว่าต้องการดำเนินการ?"
        );

        if (!confirmDraw) return;

        try {
            setDrawingLoading(true);
            const { data, error } = await supabase.rpc('draw_weekly_arcade_raffle_and_reset');
            if (error) throw error;

            setDrawResult(data);
            toast.success('🎉 ดำเนินการจับรางวัลและรีเซ็ตรูปแบบเรียบร้อยแล้ว!');
            fetchData();
        } catch (err) {
            console.error('Error during drawing:', err);
            toast.error(err.message || 'เกิดข้อผิดพลาดในการรันระบบจับรางวัล');
        } finally {
            setDrawingLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto font-sans text-neutral-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-500" /> ระบบสุ่มรางวัลและรีเซ็ตการเล่นเกม (Arcade Weekly Drawing)
                    </h1>
                    <p className="text-gray-500 text-sm">การแจกรางวัลเหรียญ xhaus ประจำสัปดาห์แก่ผู้เล่นระดับท็อปและผู้ถือตั๋วชิงโชค</p>
                </div>
                <button
                    onClick={handleRunDrawing}
                    disabled={drawingLoading}
                    className="bg-red-650 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-all cursor-pointer shadow disabled:opacity-50"
                >
                    <Play size={16} /> จับรางวัล & รีเซ็ตประจำสัปดาห์
                </button>
            </div>

            {/* Warning Info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex gap-3 text-xs leading-relaxed text-yellow-800">
                <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-600" />
                <div>
                    <span className="font-bold">กติกาการแจกเหรียญ xhaus รายสัปดาห์ (Sunday Night Reset):</span>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        <li>อันดับ 1 ของตารางลีดเดอร์บอร์ด (Leaderboard) ณ สิ้นสัปดาห์ รับรางวัลพิเศษ 50 xhaus</li>
                        <li>ผู้เล่นที่บินท่อได้เกิน 40 ท่อขึ้นไปจะได้รับ ตั๋วสุ่มสิทธิ์ (Raffle Ticket) วันละ 1 ใบ</li>
                        <li>ระบบจะสุ่มจับผู้ชนะ 1 คนจากตั๋วทั้งหมดเพื่อรับรางวัลใหญ่ 50 xhaus คืนวันอาทิตย์</li>
                    </ul>
                </div>
            </div>

            {/* Draw Results Modal / Banner */}
            {drawResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6 text-sm text-emerald-800 animate-fade-in relative">
                    <button 
                        onClick={() => setDrawResult(null)}
                        className="absolute top-4 right-4 text-emerald-600 hover:text-emerald-950 font-bold"
                    >
                        ปิดผลรางวัล
                    </button>
                    <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600" /> ผลการจับรางวัลรายสัปดาห์สำเร็จแล้ว!
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                            <p className="text-xs text-neutral-500 font-semibold font-mono">🏆 อันดับที่ 1 ประจำสัปดาห์ (Leaderboard Top Player)</p>
                            <p className="text-lg font-black mt-1 text-[#1A1A1A]">
                                {drawResult.top_player?.name || '-'} ({drawResult.top_player?.score || 0} คะแนน)
                            </p>
                            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">ได้รับรางวัลพิเศษ 50 xhaus</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                            <p className="text-xs text-neutral-500 font-semibold font-mono">🎟️ ผู้สุ่มชนะตั๋วชิงโชค (Raffle Draw Winner)</p>
                            <p className="text-lg font-black mt-1 text-[#1A1A1A]">
                                {drawResult.raffle_winner?.name || '-'}
                            </p>
                            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                                สุ่มสิทธิ์สำเร็จจากจำนวนผู้เข้าร่วมทั้งหมด {drawResult.raffle_winner?.tickets_checked || 0} คน (รับ 50 xhaus)
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* 1. Leaderboard Table */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4 border-b pb-3">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <h2 className="font-bold text-base">คะแนนลีดเดอร์บอร์ดสัปดาห์นี้</h2>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-neutral-400">กำลังโหลด...</div>
                    ) : leaderboard.length === 0 ? (
                        <div className="text-center py-10 text-neutral-400 bg-gray-50 border border-dashed rounded-xl">
                            ไม่มีคะแนนลีดเดอร์บอร์ดในสัปดาห์นี้
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b text-neutral-400 uppercase tracking-wider font-mono">
                                        <th className="py-2.5 w-12 text-center">อันดับ</th>
                                        <th className="py-2.5">ชื่อแสดงผล</th>
                                        <th className="py-2.5 text-right pr-4">คะแนน</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {leaderboard.map((item, index) => (
                                        <tr key={item.id} className={`${index === 0 ? 'bg-yellow-50/40 font-bold' : ''}`}>
                                            <td className="py-2.5 text-center">
                                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                                            </td>
                                            <td className="py-2.5 font-medium">{item.display_name}</td>
                                            <td className="py-2.5 text-right pr-4 font-mono font-bold text-neutral-700">{item.score}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 2. Raffle Tickets Log */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4 border-b pb-3">
                        <Ticket className="w-5 h-5 text-blue-500" />
                        <h2 className="font-bold text-base">ผู้มีสิทธิ์ลุ้นโชคในสัปดาห์นี้ (สุ่มแจก 50 xhaus)</h2>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-neutral-400">กำลังโหลด...</div>
                    ) : raffleTickets.length === 0 ? (
                        <div className="text-center py-10 text-neutral-400 bg-gray-50 border border-dashed rounded-xl">
                            สัปดาห์นี้ยังไม่มีใครสะสมตั๋วสุ่ม
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b text-neutral-400 uppercase tracking-wider font-mono">
                                        <th className="py-2.5 pl-2">ชื่อแสดงผล</th>
                                        <th className="py-2.5 w-24 text-center">คะแนนสะสมท่อ</th>
                                        <th className="py-2.5 text-right pr-2">วันที่ได้ตั๋ว</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {raffleTickets.map((log) => {
                                        const profileName = log.profiles?.nickname || log.profiles?.display_name || 'MEMBER';
                                        return (
                                            <tr key={log.id} className="hover:bg-neutral-50/50">
                                                <td className="py-2.5 pl-2 font-medium flex items-center gap-1.5">
                                                    <span className="text-[10px]">🎟️</span> {profileName}
                                                </td>
                                                <td className="py-2.5 text-center font-mono font-semibold text-neutral-600">{log.score} ท่อ</td>
                                                <td className="py-2.5 text-right pr-2 font-mono text-neutral-400 text-[10px]">
                                                    {new Date(log.created_at).toLocaleDateString('en-GB', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
