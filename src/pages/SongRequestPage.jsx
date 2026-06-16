import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Search, Music, MessageSquare, Upload, Play, CheckCircle2, ListMusic, Send, Heart, X, Sparkles, Clock, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Toaster, toast } from 'sonner'

export default function SongRequestPage() {
  const [activeTab, setActiveTab] = useState('request') // 'request' | 'queue'
  
  // Form States
  const [spotifyLink, setSpotifyLink] = useState('')
  const [trackName, setTrackName] = useState('')
  const [artistName, setArtistName] = useState('')
  const [requesterName, setRequesterName] = useState('')
  const [dedicationMessage, setDedicationMessage] = useState('')
  const [slipFile, setSlipFile] = useState(null)
  
  // Spotify Integration States
  const [playlistTracks, setPlaylistTracks] = useState([])
  const [loadingPlaylist, setLoadingPlaylist] = useState(false)
  const [playlistError, setPlaylistError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [searchMode, setSearchMode] = useState('playlist') // 'playlist' | 'catalog'
  const [isSpotifyActive, setIsSpotifyActive] = useState(false)

  // Queue & Settings States
  const [queue, setQueue] = useState([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [paymentQrUrl, setPaymentQrUrl] = useState(null)

  // GPS Settings
  const [gpsConfig, setGpsConfig] = useState({
    enabled: true,
    latitude: 17.39008981227407,
    longitude: 104.79292770946343,
    radius: 1000 // meters (1 km)
  })

  // Success Overlay
  const [showSuccess, setShowSuccess] = useState(false)

  const fetchPlaylistTracks = async () => {
    setLoadingPlaylist(true)
    setPlaylistError(null)
    try {
      const { data, error } = await supabase.functions.invoke('spotify-search?playlist=true')
      if (error) throw error
      if (data?.error) {
        setPlaylistError(data.error)
        setIsSpotifyActive(false)
      } else if (data?.tracks && data.tracks.length > 0) {
        setPlaylistTracks(data.tracks)
        setIsSpotifyActive(true)
      } else {
        setIsSpotifyActive(false)
      }
    } catch (err) {
      console.error('Failed to load playlist:', err)
      setPlaylistError(err.message || 'Failed to load playlist')
      setIsSpotifyActive(false)
    } finally {
      setLoadingPlaylist(false)
    }
  }

  // Load Initial Data & Settings
  useEffect(() => {
    fetchSettings()
    fetchQueue()
    fetchPlaylistTracks()

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

  const handleCatalogSearch = async (queryStr) => {
    if (!queryStr.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const { data, error } = await supabase.functions.invoke(`spotify-search?q=${encodeURIComponent(queryStr)}`)
      if (error) throw error
      if (data?.error) {
        toast.error(data.error)
      } else {
        setSearchResults(data?.tracks || [])
      }
    } catch (err) {
      console.error('Search failed:', err)
      toast.error('ค้นหาเพลงล้มเหลว: ' + err.message)
    } finally {
      setSearching(false)
    }
  }

  // Handle Debounced Catalog Search
  useEffect(() => {
    if (searchMode === 'catalog' && searchQuery.trim().length > 1) {
      const delayDebounceFn = setTimeout(() => {
        handleCatalogSearch(searchQuery)
      }, 500)
      return () => clearTimeout(delayDebounceFn)
    } else {
      setSearchResults([])
    }
  }, [searchQuery, searchMode])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('key, value')
      if (error) throw error
      
      const qr = data.find(item => item.key === 'payment_qr_url')?.value
      if (qr) setPaymentQrUrl(qr)
      
      const gpsEnabled = data.find(item => item.key === 'qr_gps_enabled')?.value
      const lat = data.find(item => item.key === 'qr_latitude')?.value
      const lng = data.find(item => item.key === 'qr_longitude')?.value
      const rad = data.find(item => item.key === 'qr_radius')?.value
      
      setGpsConfig({
        enabled: gpsEnabled !== 'false',
        latitude: lat ? parseFloat(lat) : 17.39008981227407,
        longitude: lng ? parseFloat(lng) : 104.79292770946343,
        radius: rad ? parseFloat(rad) : 1000
      })
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
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

  // Calculate distance in meters
  const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3 // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Parse Spotify Track ID from Link/URI
  const extractTrackId = (input) => {
    if (!input) return '';
    const match = input.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (match) return match[1];
    const uriMatch = input.match(/spotify:track:([a-zA-Z0-9]+)/);
    if (uriMatch) return uriMatch[1];
    return input.trim();
  };

  // Handle Submit Song Request
  const handleSubmitRequest = async (e) => {
    e.preventDefault()
    if (!trackName.trim()) return toast.error('กรุณาระบุชื่อเพลง')
    if (!artistName.trim()) return toast.error('กรุณาระบุชื่อศิลปิน')
    if (!requesterName.trim()) return toast.error('กรุณาระบุชื่อผู้ขอเพลง')
    if (!slipFile) return toast.error('กรุณาอัปโหลดสลิปโอนเงิน 100 บาท')

    setUploading(true)
    const toastId = toast.loading('กำลังตรวจสอบสิทธิ์พื้นที่ (GPS)...')

    // Helper for GPS check
    const verifyLocation = () => {
      return new Promise((resolve, reject) => {
        if (!gpsConfig.enabled) {
          return resolve(null);
        }
        
        if (!navigator.geolocation) {
          return reject(new Error('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง GPS'));
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const dist = getDistanceInMeters(
              position.coords.latitude,
              position.coords.longitude,
              gpsConfig.latitude,
              gpsConfig.longitude
            );
            
            if (dist > gpsConfig.radius) {
              reject(new Error(`คุณอยู่นอกพื้นที่ร้าน ไม่สามารถขอเพลงได้ (ระยะห่างจากร้าน: ${dist.toFixed(0)} เมตร)`));
            } else {
              resolve(dist);
            }
          },
          (err) => {
            let errorMsg = 'ไม่สามารถระบุพิกัด GPS ได้';
            if (err.code === err.PERMISSION_DENIED) {
              errorMsg = 'กรุณาเปิดสิทธิ์การเข้าถึงตำแหน่งพิกัด (GPS) ในการตั้งค่าเบราว์เซอร์เพื่อยืนยันว่าคุณอยู่ในร้าน';
            } else if (err.code === err.TIMEOUT) {
              errorMsg = 'การค้นหาพิกัด GPS หมดเวลา กรุณาลองใหม่อีกครั้ง';
            }
            reject(new Error(errorMsg));
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    };

    try {
      // 0. Verify GPS Location
      let currentDistance = null;
      if (gpsConfig.enabled) {
        try {
          const dist = await verifyLocation();
          currentDistance = dist;
        } catch (gpsError) {
          throw gpsError;
        }
      }

      // 1. Upload Slip Image to Slips bucket
      toast.loading('กำลังอัปโหลดสลิปโอนเงิน...', { id: toastId });
      const fileExt = slipFile.name.split('.').pop()
      const fileName = `song_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('slips')
        .upload(fileName, slipFile, { cacheControl: '15552000' })

      if (uploadError) throw uploadError

      const slipPublicUrl = supabase.storage.from('slips').getPublicUrl(fileName).data.publicUrl
      const parsedTrackId = extractTrackId(spotifyLink) || `manual_${Date.now()}`;

      // 2. Insert into song_requests Table
      toast.loading('กำลังส่งข้อมูลคำขอเพลง...', { id: toastId });
      const requestData = {
        track_id: parsedTrackId,
        track_name: trackName,
        artist_name: artistName,
        album_image: selectedTrack?.albumImage || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop', // Default vinyl/cover placeholder
        track_duration_ms: selectedTrack?.duration_ms || 180000, // Default 3 minutes
        requester_name: requesterName,
        message: dedicationMessage,
        slip_url: fileName, // Save relative path
        status: 'pending'
      }

      const { error: dbError } = await supabase
        .from('song_requests')
        .insert(requestData)

      if (dbError) throw dbError

      // 3. Construct and Trigger LINE Flex Message via send-line-notify
      const lineMessage = `🎵 ขอเพลงใหม่: ${trackName} - ${artistName}\nผู้ขอ: ${requesterName}\nข้อความ: ${dedicationMessage || '-'}`
      const durationMs = selectedTrack?.duration_ms || 180000
      const durationMin = Math.floor(durationMs / 60000)
      const durationSec = Math.floor((durationMs % 60000) / 1000).toString().padStart(2, '0')
      const gpsNote = currentDistance !== null ? `📍 ตรวจสอบ GPS แล้ว (ห่างจากร้าน ${currentDistance.toFixed(0)} เมตร)` : '📍 ข้ามการตรวจสอบตำแหน่งพิกัด';

      const flexPayload = {
        type: "flex",
        altText: `🎵 ขอเพลงใหม่: ${trackName} - ${artistName}`,
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
                color: "#1DB954"
              }
            ],
            backgroundColor: "#121212",
            paddingAll: "16px"
          },
          body: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#181818",
            contents: [
              {
                type: "text",
                text: trackName,
                weight: "bold",
                size: "lg",
                color: "#FFFFFF",
                wrap: true
              },
              {
                type: "text",
                text: `${artistName} · ${durationMin}:${durationSec}`,
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
                        text: "ตำแหน่ง",
                        color: "#B3B3B3",
                        size: "xs",
                        flex: 1
                      },
                      {
                        type: "text",
                        text: gpsNote,
                        size: "xs",
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
                        wrap: true,
                        style: "italic"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            backgroundColor: "#121212",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#1DB954",
                height: "sm",
                action: {
                  type: "uri",
                  label: "Open Spotify 🎧",
                  uri: spotifyLink.startsWith('http') ? spotifyLink : `https://open.spotify.com/track/${parsedTrackId}`
                }
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
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
      setSpotifyLink('')
      setTrackName('')
      setArtistName('')
      setSelectedTrack(null)
      setSlipFile(null)
      setDedicationMessage('')
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
      toast.error(err.message || 'ส่งขอเพลงล้มเหลว')
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
            <Music size={14} /> ขอเพลงใหม่
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
          <form onSubmit={handleSubmitRequest} className="space-y-5 flex-1 flex flex-col">
            
            {/* GPS verification note */}
            {gpsConfig.enabled && (
              <div className="flex items-center gap-2.5 text-[10px] text-gray-400 bg-white/5 border border-white/5 p-3 rounded-2xl">
                <MapPin className="w-4 h-4 text-[#1DB954] shrink-0" />
                <span className="leading-normal">ตรวจสอบ GPS: ระบบจะตรวจสอบตำแหน่งของคุณว่าอยู่ในรัศมีร้าน (ไม่เกิน {(gpsConfig.radius / 1000).toFixed(1)} กม.) ขณะกดส่งเพลง</span>
              </div>
            )}

            {/* Spotify Song Selector */}
            {isSpotifyActive ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] text-gray-500 uppercase font-black tracking-wider">เลือกเพลง / Select Song *</label>
                  <button
                    type="button"
                    onClick={() => setIsSpotifyActive(false)}
                    className="text-[10px] text-gray-400 hover:text-white transition-colors underline font-bold"
                  >
                    กรอกข้อมูลเพลงด้วยตัวเอง (Manual Input)
                  </button>
                </div>

                {selectedTrack ? (
                  /* Selected Song Card */
                  <div className="bg-[#1DB954]/10 border border-[#1DB954]/25 p-4 rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#1DB954]/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="flex items-center gap-3.5 min-w-0 z-10">
                      <div className="w-14 h-14 bg-zinc-800 rounded-xl overflow-hidden shrink-0 shadow-md border border-white/10">
                        <img src={selectedTrack.albumImage || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop'} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-white truncate leading-snug">{selectedTrack.name}</h4>
                        <p className="text-xs text-[#1DB954] font-bold truncate mt-0.5">{selectedTrack.artists}</p>
                        <span className="inline-flex items-center gap-1 text-[9px] text-gray-400 mt-1">
                          <Music size={8} className="text-[#1DB954]" /> Selected Song
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTrack(null)
                        setTrackName('')
                        setArtistName('')
                        setSpotifyLink('')
                      }}
                      className="text-gray-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all z-10 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  /* Search & List Selector */
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input
                        type="text"
                        placeholder={searchMode === 'playlist' ? "ค้นหาเพลงในเพลย์ลิสต์ร้าน..." : "ค้นหาเพลงบน Spotify..."}
                        className="w-full bg-[#161616] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white focus:outline-none focus:border-[#1DB954] transition-colors placeholder:text-gray-600 shadow-inner"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex bg-[#121212] p-1 rounded-xl border border-white/5 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchMode('playlist')
                          setSearchQuery('')
                        }}
                        className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 ${
                          searchMode === 'playlist' ? 'bg-[#1DB954] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        เพลงแนะนำของร้าน
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchMode('catalog')
                          setSearchQuery('')
                        }}
                        className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 ${
                          searchMode === 'catalog' ? 'bg-[#1DB954] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        ค้นหาทั่วไป (Spotify)
                      </button>
                    </div>

                    {/* List Tracks container */}
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {loadingPlaylist || searching ? (
                        <div className="flex items-center justify-center py-8 text-gray-500 text-[11px] gap-2">
                          <div className="w-4 h-4 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
                          กำลังโหลดรายชื่อเพลง...
                        </div>
                      ) : searchMode === 'playlist' ? (
                        /* Render Playlist Tracks */
                        (() => {
                          const filtered = playlistTracks.filter(track =>
                            track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            track.artists.toLowerCase().includes(searchQuery.toLowerCase())
                          )

                          if (filtered.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500 text-[11px]">
                                ไม่พบเพลงในเพลย์ลิสต์ร้าน <br/>
                                <button
                                  type="button"
                                  onClick={() => setSearchMode('catalog')}
                                  className="text-[#1DB954] font-bold underline mt-1 block w-full text-center"
                                >
                                  ลองค้นหาทั่วไปบน Spotify
                                </button>
                              </div>
                            )
                          }

                          return filtered.map(track => (
                            <div
                              key={track.id}
                              onClick={() => {
                                setSelectedTrack(track)
                                setTrackName(track.name)
                                setArtistName(track.artists)
                                setSpotifyLink(`https://open.spotify.com/track/${track.id}`)
                              }}
                              className="bg-[#161616] border border-white/5 p-2 rounded-xl flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img src={track.albumImage || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop'} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                <div className="min-w-0">
                                  <h5 className="font-bold text-xs text-white truncate group-hover:text-[#1DB954] transition-colors">{track.name}</h5>
                                  <p className="text-[10px] text-gray-500 truncate mt-0.5">{track.artists}</p>
                                </div>
                              </div>
                              <span className="text-[9px] bg-white/5 border border-white/5 text-gray-400 group-hover:bg-[#1DB954] group-hover:text-black group-hover:border-transparent font-bold px-2 py-1 rounded-lg transition-all shrink-0">
                                เลือก
                              </span>
                            </div>
                          ))
                        })()
                      ) : (
                        /* Render Catalog Search Results */
                        (() => {
                          if (!searchQuery.trim()) {
                            return (
                              <div className="text-center py-8 text-gray-500 text-[11px]">
                                พิมพ์ชื่อเพลงหรือศิลปินเพื่อค้นหา...
                              </div>
                            )
                          }

                          if (searchResults.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500 text-[11px]">
                                ไม่พบผลลัพธ์การค้นหา
                              </div>
                            )
                          }

                          return searchResults.map(track => (
                            <div
                              key={track.id}
                              onClick={() => {
                                setSelectedTrack(track)
                                setTrackName(track.name)
                                setArtistName(track.artists)
                                setSpotifyLink(`https://open.spotify.com/track/${track.id}`)
                              }}
                              className="bg-[#161616] border border-white/5 p-2 rounded-xl flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img src={track.albumImage || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop'} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                <div className="min-w-0">
                                  <h5 className="font-bold text-xs text-white truncate group-hover:text-[#1DB954] transition-colors">{track.name}</h5>
                                  <p className="text-[10px] text-gray-500 truncate mt-0.5">{track.artists}</p>
                                </div>
                              </div>
                              <span className="text-[9px] bg-white/5 border border-white/5 text-gray-400 group-hover:bg-[#1DB954] group-hover:text-black group-hover:border-transparent font-bold px-2 py-1 rounded-lg transition-all shrink-0">
                                เลือก
                              </span>
                            </div>
                          ))
                        })()
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback Manual Fields */
              <div className="space-y-4 animate-fade-in">
                {playlistTracks.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsSpotifyActive(true)}
                      className="text-[10px] text-[#1DB954] hover:text-[#1ed760] font-bold underline transition-colors cursor-pointer"
                    >
                      กลับไปเลือกจากเพลย์ลิสต์ร้าน
                    </button>
                  </div>
                )}

                {/* Spotify Link Field */}
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2">ลิงก์เพลง Spotify / Spotify Track Link (ถ้ามี)</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="วางลิงก์ เช่น https://open.spotify.com/track/..."
                      className="w-full bg-[#161616] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white focus:outline-none focus:border-[#1DB954] transition-colors placeholder:text-gray-600 shadow-inner"
                      value={spotifyLink}
                      onChange={(e) => setSpotifyLink(e.target.value)}
                    />
                  </div>
                </div>

                {/* Song Title & Artist Group */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2">ชื่อเพลง / Song Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="ชื่อเพลง..."
                      className="w-full bg-[#161616] border border-white/5 rounded-xl p-3 font-bold text-xs text-white focus:outline-none focus:border-[#1DB954] transition-colors"
                      value={trackName}
                      onChange={(e) => setTrackName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2">ศิลปิน / Artist *</label>
                    <input
                      type="text"
                      required
                      placeholder="ชื่อศิลปิน..."
                      className="w-full bg-[#161616] border border-white/5 rounded-xl p-3 font-bold text-xs text-white focus:outline-none focus:border-[#1DB954] transition-colors"
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Requester Name */}
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2">ชื่อของคุณ / Your Name *</label>
              <input
                type="text"
                required
                placeholder="พิมพ์ชื่อของคุณ..."
                className="w-full bg-[#161616] border border-white/5 rounded-xl p-3 font-bold text-xs text-white focus:outline-none focus:border-[#1DB954] transition-colors"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
              />
            </div>

            {/* Dedication Message */}
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2">ฝากข้อความถึงดีเจ / Message to DJ (ไม่บังคับ)</label>
              <textarea
                rows={2}
                placeholder="เช่น ขอมอบเพลงนี้ให้เพื่อนร่วมโต๊ะ..."
                className="w-full bg-[#161616] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#1DB954] transition-colors resize-none placeholder:text-gray-600"
                value={dedicationMessage}
                onChange={(e) => setDedicationMessage(e.target.value)}
              />
            </div>

            {/* PromptPay QR Code */}
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

            {/* Upload Slip */}
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2">สลิปโอนเงิน / Slip Transfer (100 THB) *</label>
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
                <label className="border border-dashed border-white/10 hover:border-[#1DB954]/50 cursor-pointer bg-[#161616] p-5 rounded-xl flex flex-col items-center justify-center gap-2 group transition-all text-center">
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

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-4 rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 transform active:scale-95 shadow-lg shadow-[#1DB954]/10 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send size={14} fill="black" /> {uploading ? 'กำลังส่งคำขอเพลง...' : 'ส่งคำขอเพลง (Submit Request)'}
              </button>
            </div>
          </form>
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
