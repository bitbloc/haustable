import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Search, Music, MessageSquare, Upload, Play, CheckCircle2, ListMusic, Send, Heart, X, Sparkles, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Toaster, toast } from 'sonner'

export default function SongRequestPage() {
  const [activeTab, setActiveTab] = useState('request') // 'request' | 'queue'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  
  // Requests Queue
  const [queue, setQueue] = useState([])
  const [loadingQueue, setLoadingQueue] = useState(true)

  // Request Modal State
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [requesterName, setRequesterName] = useState('')
  const [dedicationMessage, setDedicationMessage] = useState('')
  const [slipFile, setSlipFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [paymentQrUrl, setPaymentQrUrl] = useState(null)

  // Success Overlay
  const [showSuccess, setShowSuccess] = useState(false)

  // Spotify Search Debounce Timer
  const searchTimeoutRef = useRef(null)

  // Load Initial Data & Settings
  useEffect(() => {
    fetchPaymentQr()
    fetchQueue()

    // Setup Realtime Database Subscription for Queue updates
    const subscription = supabase
      .channel('public:song_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests' }, () => {
        fetchQueue(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  // Auto-fill user name if logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.user_metadata?.full_name) {
        setRequesterName(data.user.user_metadata.full_name)
      }
    })
  }, [])

  const fetchPaymentQr = async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'payment_qr_url').maybeSingle()
    if (data?.value) setPaymentQrUrl(data.value)
  }

  const fetchQueue = async (silent = false) => {
    if (!silent) setLoadingQueue(true)
    try {
      const { data, error } = await supabase
        .from('song_requests')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setQueue(data || [])
    } catch (err) {
      console.error('Failed to load song queue:', err)
    } finally {
      if (!silent) setLoadingQueue(false)
    }
  }

  // Handle Search Input Change
  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchQuery(val)

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!val.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke(`spotify-search?q=${encodeURIComponent(val)}`, {
          method: 'GET'
        })

        if (error) throw error
        setSearchResults(data.tracks || [])
      } catch (err) {
        console.error('Search failed:', err)
        toast.error('ค้นหาเพลงล้มเหลว กรุณาลองใหม่อีกครั้ง')
      } finally {
        setSearching(false)
      }
    }, 500)
  }

  // Handle Submit Song Request
  const handleSubmitRequest = async (e) => {
    e.preventDefault()
    if (!selectedTrack) return
    if (!requesterName.trim()) return toast.error('กรุณาระบุชื่อผู้ขอเพลง')
    if (!slipFile) return toast.error('กรุณาอัปโหลดสลิปโอนเงิน 100 บาท')

    setUploading(true)
    const toastId = toast.loading('กำลังประมวลผลคำขอเพลงและสลิป...')

    try {
      // 1. Upload Slip Image to Slips bucket
      const fileExt = slipFile.name.split('.').pop()
      const fileName = `song_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('slips')
        .upload(fileName, slipFile, { cacheControl: '15552000' })

      if (uploadError) throw uploadError

      const slipPublicUrl = supabase.storage.from('slips').getPublicUrl(fileName).data.publicUrl

      // 2. Insert into song_requests Table
      const requestData = {
        track_id: selectedTrack.id,
        track_name: selectedTrack.name,
        artist_name: selectedTrack.artists,
        album_image: selectedTrack.albumImage,
        track_duration_ms: selectedTrack.duration_ms,
        requester_name: requesterName,
        message: dedicationMessage,
        slip_url: fileName, // Save relative path
        status: 'pending'
      }

      const { data: insertedData, error: dbError } = await supabase
        .from('song_requests')
        .insert(requestData)
        .select()
        .single()

      if (dbError) throw dbError

      // 3. Construct and Trigger LINE Flex Message via send-line-notify
      const lineMessage = `🎵 ขอเพลงใหม่: ${selectedTrack.name} - ${selectedTrack.artists}\nผู้ขอ: ${requesterName}\nข้อความ: ${dedicationMessage || '-'}`
      const durationMin = Math.floor(selectedTrack.duration_ms / 60000)
      const durationSec = ((selectedTrack.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')

      const flexPayload = {
        type: "flex",
        altText: `🎵 ขอเพลงใหม่: ${selectedTrack.name} - ${selectedTrack.artists}`,
        contents: {
          type: "bubble",
          size: "mega",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "🎵 SONG REQUEST · 100 THB",
                weight: "bold",
                size: "sm",
                color: "#1DB954",
                letterSpacing: "0.1em"
              }
            ],
            backgroundColor: "#121212",
            paddingAll: "16px"
          },
          hero: {
            type: "image",
            url: selectedTrack.albumImage || "https://placehold.co/300",
            size: "full",
            aspectRatio: "1:1",
            aspectMode: "cover"
          },
          body: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#181818",
            contents: [
              {
                type: "text",
                text: selectedTrack.name,
                weight: "bold",
                size: "lg",
                color: "#FFFFFF",
                wrap: true
              },
              {
                type: "text",
                text: `${selectedTrack.artists} · ${durationMin}:${durationSec}`,
                size: "sm",
                color: "#B3B3B3",
                margin: "xs",
                wrap: true
              },
              {
                type: "separator",
                margin: "lg",
                color: "#282828"
              },
              {
                type: "box",
                layout: "vertical",
                margin: "lg",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "baseline",
                    contents: [
                      {
                        type: "text",
                        text: "ผู้ขอ",
                        color: "#B3B3B3",
                        size: "xs",
                        flex: 1
                      },
                      {
                        type: "text",
                        text: requesterName,
                        weight: "bold",
                        size: "sm",
                        color: "#FFFFFF",
                        flex: 4,
                        wrap: true
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "baseline",
                    contents: [
                      {
                        type: "text",
                        text: "ข้อความ",
                        color: "#B3B3B3",
                        size: "xs",
                        flex: 1
                      },
                      {
                        type: "text",
                        text: dedicationMessage || "-",
                        size: "sm",
                        color: "#FFFFFF",
                        flex: 4,
                        wrap: true
                      }
                    ]
                  }
                ]
              }
            ],
            paddingAll: "20px"
          },
          footer: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#181818",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#1DB954",
                action: {
                  type: "uri",
                  label: "Open Spotify 🎧",
                  uri: `https://open.spotify.com/track/${selectedTrack.id}`
                }
              },
              {
                type: "button",
                style: "secondary",
                color: "#282828",
                action: {
                  type: "uri",
                  label: "View Slip 🧾",
                  uri: slipPublicUrl
                }
              }
            ],
            paddingAll: "16px"
          }
        }
      }

      const { error: lineError } = await supabase.functions.invoke('send-line-notify', {
        body: { message: lineMessage, flexPayload }
      })

      if (lineError) console.error('LINE notification failed:', lineError)

      // Clean form & show success
      toast.dismiss(toastId)
      setSlipFile(null)
      setDedicationMessage('')
      setSelectedTrack(null)
      setShowSuccess(true)
      
      // Explosion!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      })

    } catch (err) {
      console.error(err)
      toast.dismiss(toastId)
      toast.error('ส่งขอเพลงล้มเหลว: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'playing':
        return <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-black rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1.5"><Play size={10} fill="currentColor" /> Now Playing</span>
      case 'completed':
        return <span className="px-3 py-1 bg-white/5 text-gray-500 border border-white/5 text-[10px] font-bold rounded-full uppercase tracking-wider">Completed</span>
      case 'rejected':
        return <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold rounded-full uppercase tracking-wider">Rejected</span>
      default:
        return <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1"><Clock size={10} /> Queued</span>
    }
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white font-sans flex flex-col items-center">
      <Toaster position="top-center" richColors />

      {/* Dynamic Spotify BG Header */}
      <div className="w-full relative overflow-hidden bg-gradient-to-b from-[#1DB954]/20 via-[#0C0C0C] to-[#0C0C0C] py-8 px-6 flex flex-col items-center border-b border-white/5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#1DB954] rounded-full blur-[120px] opacity-20 pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-purple-600 rounded-full blur-[120px] opacity-10 pointer-events-none" />

        <div className="flex items-center gap-2 mb-2 scale-95 md:scale-100">
          <img src="/logo.png" alt="In The Haus" className="h-10 w-auto object-contain filter invert brightness-200" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-center bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">Spotify Song Requests</h1>
        <p className="text-xs text-gray-400 mt-2 text-center max-w-xs leading-relaxed">
          ขอเพลงโปรดของคุณเข้ามาในร้าน เพียงบริจาค <span className="text-[#1DB954] font-black">100 บาท</span> ต่อเพลง
        </p>

        {/* Tab Selector */}
        <div className="flex bg-white/5 backdrop-blur-md p-1 rounded-full border border-white/10 mt-6 max-w-xs w-full gap-1">
          <button
            onClick={() => setActiveTab('request')}
            className={`flex-1 py-2 rounded-full font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'request' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Search size={14} /> ขอเพลงใหม่
          </button>
          <button
            onClick={() => {
              setActiveTab('queue')
              fetchQueue(true)
            }}
            className={`flex-1 py-2 rounded-full font-bold text-xs transition-all flex items-center justify-center gap-1.5 relative ${
              activeTab === 'queue' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <ListMusic size={14} /> คิวเพลง
            {queue.filter(q => q.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-bounce border border-black">
                {queue.filter(q => q.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <main className="w-full max-w-md px-6 py-6 flex-1 flex flex-col pb-24">
        {activeTab === 'request' ? (
          <div className="flex-1 flex flex-col">
            {/* Search Input */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="ค้นหา ชื่อเพลง / ศิลปิน ใน Spotify..."
                className="w-full bg-[#161616] border border-white/5 rounded-2xl py-4 pl-12 pr-4 font-bold text-sm focus:outline-none focus:border-[#1DB954] transition-colors placeholder:text-gray-600 shadow-inner"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Search Results */}
            <div className="space-y-3 flex-1">
              {searchResults.map((track) => (
                <motion.div
                  key={track.id}
                  onClick={() => setSelectedTrack(track)}
                  whileTap={{ scale: 0.98 }}
                  className="bg-[#121212] border border-white/5 hover:border-white/10 p-3 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-all"
                >
                  <div className="w-14 h-14 bg-zinc-800 rounded-xl overflow-hidden shrink-0 shadow-md">
                    {track.albumImage ? (
                      <img src={track.albumImage} alt={track.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <Music size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-sm text-white truncate">{track.name}</h3>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{track.artists}</p>
                    <p className="text-[10px] text-gray-600 truncate mt-1">{track.albumName}</p>
                  </div>
                  <ChevronRightIcon className="text-gray-700 w-5 h-5 shrink-0" />
                </motion.div>
              ))}

              {!searchQuery && (
                <div className="flex flex-col items-center justify-center py-20 text-gray-600 text-center">
                  <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <Search size={22} className="text-gray-500" />
                  </div>
                  <p className="text-xs font-bold">ค้นหาเพลงที่คุณชื่นชอบ</p>
                  <p className="text-[10px] text-gray-600 max-w-[200px] mt-1">
                    พิมพ์ชื่อเพลงหรือศิลปินเพื่อค้นหาคลังเพลงของ Spotify
                  </p>
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !searching && (
                <div className="text-center py-20 text-gray-500 text-xs">
                  ไม่พบเพลงที่ค้นหา ลองเปลี่ยนคำค้นหาดูนะคะ
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Live Queue View */
          <div className="space-y-4">
            {loadingQueue ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500 text-xs">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
                กำลังโหลดคิวเพลง...
              </div>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-600 text-center">
                <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <ListMusic size={22} className="text-gray-500" />
                </div>
                <p className="text-xs font-bold">คิวเพลงว่างอยู่</p>
                <p className="text-[10px] text-gray-600 mt-1">
                  ขอเพลงเป็นคนแรกเพื่อเปิดบรรยากาศในร้านเลย!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Now Playing Section */}
                {queue.filter(q => q.status === 'playing').map((reqItem) => (
                  <motion.div
                    key={reqItem.id}
                    layoutId={reqItem.id}
                    className="bg-gradient-to-r from-green-950/20 to-black border border-green-500/30 p-4 rounded-3xl flex items-center gap-4 shadow-lg shadow-green-950/10 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="w-16 h-16 bg-zinc-800 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-green-500/30">
                      <img src={reqItem.album_image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">{getStatusBadge(reqItem.status)}</div>
                      <h3 className="font-extrabold text-sm text-white truncate">{reqItem.track_name}</h3>
                      <p className="text-xs text-green-400 font-bold truncate mt-0.5">{reqItem.artist_name}</p>
                      {reqItem.requester_name && (
                        <p className="text-[10px] text-gray-500 truncate mt-1">
                          ผู้ขอ: <span className="text-gray-300 font-bold">{reqItem.requester_name}</span>
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Separator */}
                {queue.filter(q => q.status === 'playing').length > 0 && (
                  <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest pt-2 pb-1 border-b border-white/5">
                    คิวถัดไป (UPCOMING QUEUE)
                  </div>
                )}

                {/* Pending Queue Items */}
                {queue.filter(q => q.status !== 'playing').map((reqItem) => (
                  <motion.div
                    key={reqItem.id}
                    layoutId={reqItem.id}
                    className="bg-[#121212] border border-white/5 p-3.5 rounded-2xl flex items-center gap-4 hover:bg-[#161616] transition-colors"
                  >
                    <div className="w-12 h-12 bg-zinc-800 rounded-xl overflow-hidden shrink-0 opacity-80">
                      <img src={reqItem.album_image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-xs text-white truncate">{reqItem.track_name}</h4>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{reqItem.artist_name}</p>
                      {reqItem.requester_name && (
                        <p className="text-[9px] text-gray-600 truncate mt-1">
                          ผู้ขอ: <span className="text-gray-400 font-bold">{reqItem.requester_name}</span>
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">{getStatusBadge(reqItem.status)}</div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Dynamic Request Drawer/Modal */}
      <AnimatePresence>
        {selectedTrack && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-end justify-center p-0 md:p-4">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={() => setSelectedTrack(null)} />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-[#121212] w-full max-w-md rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 p-6 z-10 max-h-[92vh] overflow-y-auto relative shadow-2xl flex flex-col"
            >
              <button
                onClick={() => setSelectedTrack(null)}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-5 flex flex-col items-center">
                <span className="text-[10px] bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 font-black px-4 py-1.5 rounded-full uppercase tracking-wider mb-4">
                  ยืนยันการขอเพลง (100 THB)
                </span>
                
                {/* Track Details */}
                <div className="w-24 h-24 bg-zinc-800 rounded-2xl overflow-hidden shadow-lg border border-white/10 mb-3">
                  <img src={selectedTrack.albumImage} alt="" className="w-full h-full object-cover" />
                </div>
                <h3 className="font-black text-lg text-white max-w-[280px] truncate">{selectedTrack.name}</h3>
                <p className="text-xs text-gray-400 font-bold truncate mt-0.5 max-w-[280px]">{selectedTrack.artists}</p>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                {/* Step 1: PromptPay QR Code */}
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-4 flex flex-col items-center">
                  <span className="text-[9px] font-black tracking-widest text-[#1DB954] mb-3 uppercase">SCAN PROMPTPAY TO DONATE</span>
                  {paymentQrUrl ? (
                    <div className="bg-white p-2 rounded-xl mb-3 shadow-md">
                      <img src={paymentQrUrl} alt="PromptPay" className="w-32 h-32 object-contain" />
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-black/30 text-gray-600 rounded-xl flex items-center justify-center text-xs mb-3">
                      ไม่มีรูปภาพ QR ในระบบ
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 text-center leading-relaxed max-w-[240px]">
                    สแกน QR Code ด้านบนเพื่อโอนเงินจำนวน <span className="text-white font-extrabold">100 บาท</span> จากนั้นแนบหลักฐานการโอน
                  </p>
                </div>

                {/* Step 2: Upload Slip */}
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2">สลิปโอนเงิน / Slip Transfer (100 THB)</label>
                  {slipFile ? (
                    <div className="bg-[#1DB954]/10 border border-[#1DB954]/20 p-3.5 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-[#1DB954]/20 text-[#1DB954] rounded-lg flex items-center justify-center shrink-0">
                          <CheckCircle2 size={16} />
                        </div>
                        <p className="text-xs font-bold text-white truncate flex-1">{slipFile.name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSlipFile(null)}
                        className="text-gray-500 hover:text-white p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="border border-dashed border-white/10 hover:border-[#1DB954]/50 cursor-pointer bg-black/30 p-4 rounded-xl flex flex-col items-center justify-center gap-2 group transition-all text-center">
                      <Upload size={18} className="text-gray-500 group-hover:text-[#1DB954] transition-colors" />
                      <span className="text-[11px] font-bold text-gray-400 group-hover:text-white">
                        คลิกเพื่ออัปโหลดรูปภาพสลิป
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>

                {/* Step 3: Requester Name */}
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2">ชื่อของคุณ / Requester Name</label>
                  <input
                    type="text"
                    required
                    placeholder="พิมพ์ชื่อของคุณ..."
                    className="w-full bg-[#161616] border border-white/5 rounded-xl p-3 font-bold text-xs text-white focus:outline-none focus:border-[#1DB954] transition-colors"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                  />
                </div>

                {/* Step 4: Message */}
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2">ฝากข้อความถึงดีเจ / Message to DJ (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="เช่น มอบเพลงนี้ให้กับโต๊ะข้างๆ หรืออยากพูดอะไร..."
                    className="w-full bg-[#161616] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#1DB954] transition-colors resize-none placeholder:text-gray-600"
                    value={dedicationMessage}
                    onChange={(e) => setDedicationMessage(e.target.value)}
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-4 rounded-2xl text-sm transition-all duration-300 transform active:scale-95 shadow-lg shadow-[#1DB954]/10 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  <Send size={14} fill="black" /> {uploading ? 'กำลังส่งคำขอเพลง...' : 'ส่งคำขอเพลง (Submit Request)'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Success Screen Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0C0C0C] z-50 flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#1DB954] rounded-full blur-[160px] opacity-20 pointer-events-none" />
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="flex flex-col items-center"
            >
              <div className="w-20 h-20 bg-green-500/10 text-[#1DB954] rounded-full flex items-center justify-center mb-6 border-2 border-[#1DB954]/30 shadow-lg shadow-green-950/20">
                <Sparkles size={36} fill="#1DB954" className="animate-pulse" />
              </div>
              
              <h2 className="text-3xl font-black mb-3 text-white tracking-tight">ส่งขอเพลงเรียบร้อยแล้ว!</h2>
              <p className="text-sm text-gray-400 max-w-xs leading-relaxed mb-10">
                ข้อความของท่านพร้อมเพลงได้ถูกส่งเข้ากลุ่ม LINE ของร้านแล้ว พนักงานกำลังทำการตรวจสอบและจัดเตรียมคิวเพลงให้นะคะ 💚
              </p>

              <button
                onClick={() => {
                  setShowSuccess(false)
                  setActiveTab('queue')
                  fetchQueue(true)
                }}
                className="bg-white text-black font-black px-8 py-3.5 rounded-full text-xs hover:bg-gray-200 tracking-wider transition-all transform active:scale-95 shadow-md flex items-center gap-2"
              >
                ดูคิวเพลงทั้งหมด
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Simple Helper Component to clean up code
function ChevronRightIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
