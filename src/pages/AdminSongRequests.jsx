import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Play, Check, X, ExternalLink, Calendar, DollarSign, Music, CheckCircle, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'

export default function AdminSongRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // 'pending' | 'playing' | 'completed' | 'rejected' | 'all'
  
  // Slip Viewer Modal
  const [viewingSlipUrl, setViewingSlipUrl] = useState(null)

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
      console.error(err)
      toast.error('โหลดข้อมูลคำขอเพลงล้มเหลว')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleUpdateStatus = async (id, status) => {
    try {
      const { error } = await supabase
        .from('song_requests')
        .update({ status })
        .eq('id', id)

      if (error) throw error
      toast.success(`อัปเดตสถานะเป็น ${status === 'playing' ? 'กำลังเล่น' : status === 'completed' ? 'เสร็จสิ้น' : 'ปฏิเสธ'} เรียบร้อย`)
      fetchRequests(true)
    } catch (err) {
      console.error(err)
      toast.error('อัปเดตสถานะล้มเหลว')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('คุณต้องการลบรายการขอเพลงนี้ใช่หรือไม่? (การดำเนินการนี้จะไม่สามารถย้อนกลับได้)')) return
    try {
      // Fetch request first to get slip URL
      const { data: request } = await supabase
        .from('song_requests')
        .select('slip_url')
        .eq('id', id)
        .single()

      // Delete from storage if slip exists
      if (request?.slip_url) {
        await supabase.storage.from('slips').remove([request.slip_url])
      }

      // Delete from DB
      const { error } = await supabase
        .from('song_requests')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('ลบคำขอเพลงเรียบร้อยแล้ว')
      fetchRequests(true)
    } catch (err) {
      console.error(err)
      toast.error('ลบคำขอเพลงล้มเหลว')
    }
  }

  // Statistics
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const playingCount = requests.filter(r => r.status === 'playing').length
  const completedCount = requests.filter(r => r.status === 'completed').length
  
  // Earnings: count requests that are not rejected (pending, playing, completed) * 100 THB
  const totalEarnings = requests.filter(r => r.status !== 'rejected').length * 100

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true
    return req.status === filter
  })

  return (
    <div className="space-y-8 animate-fade-in pl-6 md:pl-0 text-ink">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Music className="text-orange-500" /> Song Requests Queue
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            จัดการคิวเพลงที่ลูกค้าขอพร้อมเงินบริจาค 100 บาทต่อเพลง
          </p>
        </div>
        <button 
          onClick={() => fetchRequests()} 
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 active:scale-95 text-xs font-bold rounded-xl transition-all"
        >
          รีเฟรชคิวเพลง
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Earnings Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">รายได้สะสมวันนี้</span>
            <span className="text-2xl font-black font-mono">฿{totalEarnings.toLocaleString()}</span>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center text-yellow-600">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">รอการตรวจสอบ (Pending)</span>
            <span className="text-2xl font-black font-mono">{pendingCount}</span>
          </div>
        </div>

        {/* Playing Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Play size={24} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">กำลังเล่นอยู่ (Playing)</span>
            <span className="text-2xl font-black font-mono">{playingCount}</span>
          </div>
        </div>

        {/* Completed Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-600">
            <CheckCircle size={24} />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">เล่นเสร็จสิ้น (Completed)</span>
            <span className="text-2xl font-black font-mono">{completedCount}</span>
          </div>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100 max-w-lg gap-1">
        {['pending', 'playing', 'completed', 'rejected', 'all'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs capitalize transition-all whitespace-nowrap px-3 ${
              filter === tab ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-black'
            }`}
          >
            {tab === 'pending' ? `Pending (${pendingCount})` : tab}
          </button>
        ))}
      </div>

      {/* Requests Queue List */}
      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 text-sm">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            กำลังโหลดข้อมูลคิวขอเพลง...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 text-center">
            <Music size={40} className="text-gray-200 mb-4" />
            <p className="text-sm font-bold">ไม่มีรายการขอเพลงในหน้านี้</p>
            <p className="text-xs text-gray-400 mt-1">เมื่อมีคนขอเพลง ข้อมูลจะปรากฏขึ้นที่นี่ในแบบเรียลไทม์</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredRequests.map((req) => {
              const durationMin = Math.floor(req.track_duration_ms / 60000)
              const durationSec = ((req.track_duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')
              const slipUrl = supabase.storage.from('slips').getPublicUrl(req.slip_url).data.publicUrl

              return (
                <div key={req.id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-gray-50/50 transition-colors">
                  {/* Song Info */}
                  <div className="flex gap-4 items-start flex-1 min-w-0">
                    <img src={req.album_image} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-gray-200 shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-md">
                          {durationMin}:{durationSec}
                        </span>
                        <a 
                          href={`spotify:track:${req.track_id}`} 
                          className="text-[10px] bg-green-50 hover:bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                        >
                          Spotify <ExternalLink size={10} />
                        </a>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-sm text-gray-900 truncate leading-snug">{req.track_name}</h3>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{req.artist_name}</p>
                      
                      {/* Requester & Message Box */}
                      <div className="mt-3 bg-gray-50 border border-gray-100 rounded-2xl p-3 inline-block max-w-md">
                        <p className="text-xs text-gray-500">
                          ผู้ขอ: <span className="font-bold text-gray-800">{req.requester_name}</span>
                        </p>
                        {req.message && (
                          <p className="text-xs text-gray-600 mt-1 italic font-medium">
                            "{req.message}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Slip and Actions */}
                  <div className="flex items-center gap-6 self-end lg:self-auto shrink-0">
                    {/* Payment Slip Thumbnail */}
                    <div className="text-center">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Payment Slip</span>
                      <button 
                        onClick={() => setViewingSlipUrl(slipUrl)}
                        className="w-14 h-20 bg-gray-100 hover:bg-gray-200 rounded-xl overflow-hidden border border-gray-200 relative group transition-all"
                      >
                        <img src={slipUrl} alt="Slip" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-opacity">
                          View
                        </div>
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      {req.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'playing')}
                            className="bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-green-500/10"
                          >
                            <Play size={12} fill="white" /> เล่นเพลง (Play)
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'rejected')}
                            className="bg-gray-100 hover:bg-red-50 hover:text-red-500 active:scale-95 text-gray-600 font-bold px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-center"
                          >
                            ปฏิเสธ (Reject)
                          </button>
                        </>
                      )}

                      {req.status === 'playing' && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'completed')}
                          className="bg-black hover:bg-gray-800 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg"
                        >
                          <Check size={12} /> จบคิว (Complete)
                        </button>
                      )}

                      {(req.status === 'completed' || req.status === 'rejected') && (
                        <button
                          onClick={() => handleDelete(req.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-2 rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center"
                        >
                          ลบรายการ (Delete)
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

      {/* Slip Viewer Modal */}
      <AnimatePresence>
        {viewingSlipUrl && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setViewingSlipUrl(null)} />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full relative z-10 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <button 
                onClick={() => setViewingSlipUrl(null)}
                className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-black rounded-full transition-colors"
              >
                <X size={16} />
              </button>
              
              <h3 className="font-black text-sm uppercase tracking-wider text-gray-400 mb-4">Verification Slip</h3>
              
              <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-100">
                <img src={viewingSlipUrl} alt="Transfer Slip" className="w-full h-auto object-contain" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
