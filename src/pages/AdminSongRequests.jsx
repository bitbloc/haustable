/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Play, Check, X, ExternalLink, Music, DollarSign, Clock, CheckCircle2, RefreshCw, Eye, Trash2, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format } from 'date-fns'

const parseDonationAmount = (message) => {
    if (!message) return 100
    const match = message.match(/^\[Donation:\s*(\d+)\s*THB\]/)
    return match ? parseInt(match[1], 10) : 100
}

const cleanMessage = (message) => {
    if (!message) return ''
    return message.replace(/^\[Donation:\s*\d+\s*THB\]\s*/, '')
}

export default function AdminSongRequests() {
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('pending') // 'pending' | 'playing' | 'completed' | 'rejected' | 'all'
    const [viewingSlipUrl, setViewingSlipUrl] = useState(null)

    // Test Request Modal States
    const [showTestModal, setShowTestModal] = useState(false)
    const [submittingTest, setSubmittingTest] = useState(false)
    const [testForm, setTestForm] = useState({
        trackName: '',
        artistName: '',
        requesterName: 'Admin Test',
        message: ''
    })

    const fetchRequests = async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            const { data, error } = await supabase
                .from('song_requests')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setRequests(data || [])
        } catch (err) {
            console.error('Error fetching song requests:', err)
            toast.error('ไม่สามารถโหลดข้อมูลคิวขอเพลงได้')
        } finally {
            if (!silent) setLoading(false)
        }
    }

    useEffect(() => {
        fetchRequests()

        // Real-time subscription to auto-refresh queue
        const subscription = supabase
            .channel('admin:song_requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests' }, () => {
                fetchRequests(true)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [])

    const handleUpdateStatus = async (id, status) => {
        try {
            const { error } = await supabase
                .from('song_requests')
                .update({ status })
                .eq('id', id)

            if (error) throw error
            const statusLabel = status === 'playing' ? 'กำลังเล่นเพลง' : status === 'completed' ? 'เสร็จสิ้นคิว' : 'ปฏิเสธคำขอ'
            toast.success(`อัปเดตสถานะเป็น ${statusLabel} เรียบร้อย`)
            fetchRequests(true)
        } catch (err) {
            console.error('Update status error:', err)
            toast.error('อัปเดตสถานะล้มเหลว: ' + err.message)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('ต้องการลบคำขอเพลงนี้ใช่หรือไม่?')) return
        try {
            const { data: request } = await supabase
                .from('song_requests')
                .select('slip_url')
                .eq('id', id)
                .single()

            if (request?.slip_url) {
                await supabase.storage.from('slips').remove([request.slip_url])
            }

            const { error } = await supabase
                .from('song_requests')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.success('ลบคำขอเพลงเรียบร้อยแล้ว')
            fetchRequests(true)
        } catch (err) {
            console.error('Delete error:', err)
            toast.error('ลบคำขอเพลงล้มเหลว: ' + err.message)
        }
    }

    const handleSubmitTestRequest = async (e) => {
        e.preventDefault()
        if (!testForm.trackName.trim() || !testForm.artistName.trim()) {
            return toast.error('กรุณาระบุชื่อเพลงและศิลปิน')
        }

        setSubmittingTest(true)
        try {
            const mockTrackId = 'test_' + Date.now()
            const requestData = {
                track_id: mockTrackId,
                track_name: testForm.trackName.trim(),
                artist_name: testForm.artistName.trim(),
                album_image: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop',
                track_duration_ms: 180000,
                requester_name: testForm.requesterName.trim() || 'Admin Test',
                message: testForm.message.trim() ? `[Donation: 100 THB] ${testForm.message.trim()}` : '[Donation: 100 THB]',
                slip_url: null,
                status: 'pending'
            }

            const { error: dbError } = await supabase
                .from('song_requests')
                .insert(requestData)

            if (dbError) throw dbError

            toast.success('สร้างคิวขอเพลงทดสอบเรียบร้อยแล้ว')
            setShowTestModal(false)
            setTestForm({ trackName: '', artistName: '', requesterName: 'Admin Test', message: '' })
            fetchRequests(true)
        } catch (err) {
            console.error('Test request failed:', err)
            toast.error('สร้างคิวทดลองล้มเหลว: ' + err.message)
        } finally {
            setSubmittingTest(false)
        }
    }

    // Statistics
    const pendingCount = requests.filter(r => r.status === 'pending').length
    const playingCount = requests.filter(r => r.status === 'playing').length
    const completedCount = requests.filter(r => r.status === 'completed').length
    const totalEarnings = requests
        .filter(r => r.status !== 'rejected')
        .reduce((sum, r) => sum + parseDonationAmount(r.message), 0)

    const filteredRequests = requests.filter(req => {
        if (filter === 'all') return true
        return req.status === filter
    })

    return (
        <div className="space-y-6 font-mono">
            {/* Header Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.02_28)] px-2 py-0.5 rounded-xs border border-[oklch(85%_0.012_28)]">
                            LIVE SONG REQUESTS QUEUE
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-[oklch(45%_0.08_140)] font-bold">
                            <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)] animate-pulse" />
                            <span>LIVE SYNC</span>
                        </div>
                    </div>
                    <h2 className="text-base font-bold uppercase text-[oklch(18%_0.012_28)] mt-1">
                        จัดการคิวขอเพลงสด & เงินสนับสนุน (Song Requests & Tips)
                    </h2>
                    <p className="text-xs text-[oklch(55%_0.010_28)] mt-0.5">
                        ตรวจสอบเพลงที่ลูกค้าขอพร้อมสลิปเงินบริจาคสนับสนุนร้าน ควบคุมคิวเพลงที่กำลังเล่น และแจ้งเตือน LINE
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setShowTestModal(true)}
                        className="px-3 py-2 bg-white hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-bold transition-colors cursor-pointer"
                    >
                        + สร้างคิวทดสอบ
                    </button>
                    <button
                        type="button"
                        onClick={() => fetchRequests()}
                        className="px-3 py-2 bg-[oklch(18%_0.012_28)] hover:bg-black text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                        <RefreshCw size={12} />
                        <span>รีเฟรชคิว</span>
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-sm border border-[oklch(85%_0.012_28)] shadow-2xs">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] uppercase font-bold block">เงินสนับสนุนสะสม</span>
                    <p className="text-xl font-bold text-[oklch(45%_0.08_140)] mt-0.5">฿{totalEarnings.toLocaleString()}</p>
                </div>

                <div className="bg-white p-3.5 rounded-sm border border-[oklch(85%_0.012_28)] shadow-2xs">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] uppercase font-bold block">รอการตรวจสอบ (Pending)</span>
                    <p className="text-xl font-bold text-[oklch(52%_0.16_28)] mt-0.5">{pendingCount} คิว</p>
                </div>

                <div className="bg-white p-3.5 rounded-sm border border-[oklch(85%_0.012_28)] shadow-2xs">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] uppercase font-bold block">กำลังเล่นอยู่ (Playing)</span>
                    <p className="text-xl font-bold text-[oklch(18%_0.012_28)] mt-0.5">{playingCount} เพลง</p>
                </div>

                <div className="bg-white p-3.5 rounded-sm border border-[oklch(85%_0.012_28)] shadow-2xs">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] uppercase font-bold block">เล่นเสร็จสิ้น (Completed)</span>
                    <p className="text-xl font-bold text-[oklch(42%_0.010_28)] mt-0.5">{completedCount} คิว</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-sm border border-[oklch(85%_0.012_28)] text-xs w-full sm:w-max overflow-x-auto gap-1">
                {[
                    { id: 'pending', label: `รอตรวจสอบ (${pendingCount})` },
                    { id: 'playing', label: `กำลังเล่น (${playingCount})` },
                    { id: 'completed', label: `เสร็จสิ้น (${completedCount})` },
                    { id: 'rejected', label: 'ปฏิเสธ' },
                    { id: 'all', label: `ทั้งหมด (${requests.length})` }
                ].map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all whitespace-nowrap ${
                            filter === tab.id
                                ? 'bg-[oklch(18%_0.012_28)] text-white shadow-2xs'
                                : 'text-[oklch(42%_0.010_28)] hover:text-black'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Song Queue List */}
            <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-sm shadow-2xs overflow-hidden">
                {loading ? (
                    <div className="text-center py-16 text-xs text-[oklch(55%_0.010_28)]">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[oklch(85%_0.012_28)] border-b-[oklch(18%_0.012_28)] mb-2" />
                        <p className="uppercase tracking-wider">กำลังโหลดคิวเพลง...</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="text-center py-16 text-xs text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                        ไม่มีรายการขอเพลงในสถานะนี้
                    </div>
                ) : (
                    <div className="divide-y divide-[oklch(85%_0.012_28)]">
                        {filteredRequests.map(req => {
                            const durationMin = req.track_duration_ms ? Math.floor(req.track_duration_ms / 60000) : 3
                            const durationSec = req.track_duration_ms ? ((req.track_duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0') : '00'
                            const slipUrl = req.slip_url ? supabase.storage.from('slips').getPublicUrl(req.slip_url).data.publicUrl : null
                            const donation = parseDonationAmount(req.message)
                            const note = cleanMessage(req.message)

                            return (
                                <div key={req.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[oklch(98%_0.006_28)] transition-colors">
                                    {/* Left: Album Art & Song Info */}
                                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                        {req.album_image ? (
                                            <img src={req.album_image} alt="" className="w-14 h-14 rounded-sm object-cover shrink-0 border border-[oklch(85%_0.012_28)] shadow-2xs" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-sm bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] flex items-center justify-center shrink-0 text-[oklch(55%_0.010_28)]">
                                                <Music size={20} />
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className="text-[10px] bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] font-bold px-1.5 py-0.2 rounded-xs border border-[oklch(85%_0.012_28)]">
                                                    {durationMin}:{durationSec}
                                                </span>
                                                {req.track_id && (
                                                    <a
                                                        href={req.track_id.startsWith('http') ? req.track_id : `https://open.spotify.com/track/${req.track_id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] bg-[oklch(94%_0.02_140)] text-[oklch(45%_0.08_140)] font-bold px-1.5 py-0.2 rounded-xs border border-[oklch(45%_0.08_140)] flex items-center gap-1 hover:underline"
                                                    >
                                                        Spotify <ExternalLink size={9} />
                                                    </a>
                                                )}
                                                <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                                    {format(new Date(req.created_at), 'dd MMM, HH:mm')}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded-xs border ${
                                                    req.status === 'playing'
                                                        ? 'bg-[oklch(94%_0.02_28)] text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]'
                                                        : req.status === 'completed'
                                                            ? 'bg-[oklch(94%_0.02_140)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                                                            : req.status === 'rejected'
                                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                                : 'bg-amber-50 text-amber-800 border-amber-300'
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </div>

                                            <h3 className="font-bold text-sm text-[oklch(18%_0.012_28)] truncate">{req.track_name}</h3>
                                            <p className="text-xs text-[oklch(55%_0.010_28)] truncate">{req.artist_name}</p>

                                            {/* Requester Details & Note */}
                                            <div className="mt-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-xs text-[oklch(42%_0.010_28)]">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span>ผู้ขอ: <strong className="text-[oklch(18%_0.012_28)]">{req.requester_name}</strong></span>
                                                    <span className="px-1.5 py-0.2 bg-[oklch(94%_0.02_140)] text-[oklch(45%_0.08_140)] border border-[oklch(45%_0.08_140)] rounded-xs font-bold text-[10px]">
                                                        Tip: ฿{donation}
                                                    </span>
                                                </div>
                                                {note && (
                                                    <p className="mt-1 text-[11px] italic text-[oklch(18%_0.012_28)]">
                                                        "{note}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Payment Slip & Action Controls */}
                                    <div className="flex items-center gap-3 self-end lg:self-auto shrink-0">
                                        {/* Slip Thumbnail */}
                                        <div className="text-center">
                                            {slipUrl ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingSlipUrl(slipUrl)}
                                                    className="w-12 h-16 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] rounded-sm overflow-hidden border border-[oklch(85%_0.012_28)] relative group transition-all cursor-pointer"
                                                    title="ดูภาพสลิปโอนเงิน"
                                                >
                                                    <img src={slipUrl} alt="Slip" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-opacity">
                                                        ดูสลิป
                                                    </div>
                                                </button>
                                            ) : (
                                                <div className="w-12 h-16 bg-[oklch(97%_0.008_28)] rounded-sm border border-[oklch(85%_0.012_28)] flex items-center justify-center text-[oklch(55%_0.010_28)] text-[9px]">
                                                    ไม่มีสลิป
                                                </div>
                                            )}
                                        </div>

                                        {/* State Control Buttons */}
                                        <div className="flex flex-col sm:flex-row gap-1.5 text-xs">
                                            {req.status === 'pending' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateStatus(req.id, 'playing')}
                                                        className="px-3 py-1.5 bg-[oklch(18%_0.012_28)] hover:bg-black text-white font-bold rounded-sm flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                                    >
                                                        <Play size={11} fill="currentColor" /> เล่นเพลง
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateStatus(req.id, 'rejected')}
                                                        className="px-2.5 py-1.5 bg-white hover:bg-[oklch(94%_0.02_28)] text-[oklch(52%_0.16_28)] border border-[oklch(85%_0.012_28)] hover:border-[oklch(52%_0.16_28)] font-bold rounded-sm cursor-pointer transition-colors"
                                                    >
                                                        ปฏิเสธ
                                                    </button>
                                                </>
                                            )}

                                            {req.status === 'playing' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(req.id, 'completed')}
                                                    className="px-3 py-1.5 bg-[oklch(45%_0.08_140)] hover:bg-[oklch(38%_0.08_140)] text-white font-bold rounded-sm flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                                >
                                                    <Check size={12} /> จบคิวเพลง
                                                </button>
                                            )}

                                            {(req.status === 'completed' || req.status === 'rejected') && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(req.id)}
                                                    className="px-2.5 py-1.5 bg-white hover:bg-[oklch(94%_0.02_28)] text-[oklch(55%_0.010_28)] hover:text-[oklch(52%_0.16_28)] border border-[oklch(85%_0.012_28)] rounded-sm cursor-pointer transition-colors flex items-center gap-1"
                                                >
                                                    <Trash2 size={12} /> ลบ
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Slip Zoom Modal */}
            <AnimatePresence>
                {viewingSlipUrl && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="bg-white rounded-sm p-4 max-w-sm w-full border border-[oklch(85%_0.012_28)] shadow-2xl flex flex-col max-h-[85vh] font-mono"
                        >
                            <div className="flex justify-between items-center pb-2 mb-3 border-b border-[oklch(85%_0.012_28)]">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">VERIFICATION SLIP</span>
                                <button onClick={() => setViewingSlipUrl(null)} className="p-1 hover:bg-[oklch(94%_0.010_28)] rounded-sm cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto rounded-sm border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-1">
                                <img src={viewingSlipUrl} alt="Transfer Slip" className="w-full h-auto object-contain rounded-xs" />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Test Request Modal */}
            <AnimatePresence>
                {showTestModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="bg-white rounded-sm max-w-sm w-full border border-[oklch(85%_0.012_28)] shadow-2xl flex flex-col font-mono"
                        >
                            <div className="p-4 border-b border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">TEST BENCH</span>
                                    <h3 className="text-sm font-bold uppercase text-[oklch(18%_0.012_28)]">สร้างคิวขอเพลงทดสอบ</h3>
                                </div>
                                <button onClick={() => setShowTestModal(false)} className="p-1 hover:bg-[oklch(94%_0.010_28)] rounded-sm cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmitTestRequest} className="p-5 space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">ชื่อเพลง (Song Name) *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="เช่น Daylight"
                                        value={testForm.trackName}
                                        onChange={e => setTestForm({ ...testForm, trackName: e.target.value })}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-xs text-[oklch(18%_0.012_28)] font-bold outline-none focus:border-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">ศิลปิน (Artist Name) *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="เช่น David Kushner"
                                        value={testForm.artistName}
                                        onChange={e => setTestForm({ ...testForm, artistName: e.target.value })}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">ชื่อผู้ขอ (Requester)</label>
                                    <input
                                        type="text"
                                        value={testForm.requesterName}
                                        onChange={e => setTestForm({ ...testForm, requesterName: e.target.value })}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">ข้อความฝากถึงร้าน</label>
                                    <textarea
                                        rows={2}
                                        placeholder="ข้อความขอเพลง..."
                                        value={testForm.message}
                                        onChange={e => setTestForm({ ...testForm, message: e.target.value })}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black resize-none"
                                    />
                                </div>

                                <div className="pt-2 border-t border-[oklch(85%_0.012_28)] flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowTestModal(false)}
                                        className="px-3 py-1.5 bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] font-bold rounded-sm text-xs cursor-pointer"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingTest}
                                        className="px-4 py-1.5 bg-[oklch(18%_0.012_28)] hover:bg-black text-white font-bold rounded-sm text-xs cursor-pointer shadow-sm disabled:opacity-50"
                                    >
                                        {submittingTest ? 'กำลังสร้าง...' : 'สร้างคิวทดสอบ'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
