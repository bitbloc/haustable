/* Hallmark · component: SongRequestPage · genre: modern-minimal · theme: custom · vibe: "Dieter Rams industrial dashboard, Spotify request"
 * states: default · hover · focus · active · loading · error · success
 * contrast: pass (APCA / WCAG compliant)
 */
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Search, Music, MessageSquare, Upload, Play, CheckCircle2, ListMusic, Send, Heart, X, Sparkles, Clock, MapPin, Copy, RefreshCw, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Toaster, toast } from 'sonner'
import { Link } from 'react-router-dom'

export default function SongRequestPage() {
  const [activeTab, setActiveTab] = useState('request') // 'request' | 'queue'
  
  // Form States
  const [spotifyLink, setSpotifyLink] = useState('')
  const [trackName, setTrackName] = useState('')
  const [artistName, setArtistName] = useState('')
  const [requesterName, setRequesterName] = useState('')
  const [dedicationMessage, setDedicationMessage] = useState('')
  const [slipFile, setSlipFile] = useState(null)
  const [donationAmount, setDonationAmount] = useState('100')
  
  // Spotify Integration States
  const [playlistTracks, setPlaylistTracks] = useState([])
  const [loadingPlaylist, setLoadingPlaylist] = useState(false)
  const [playlistError, setPlaylistError] = useState(null)
  const [spotifyApiError, setSpotifyApiError] = useState(null)
  const [songGuidelines, setSongGuidelines] = useState('')
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

  // System Settings
  const [isSystemEnabled, setIsSystemEnabled] = useState(true)

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
        if (data.error.includes('Playlist') || data.error.includes('playlist') || data.error.includes('not configured')) {
          setPlaylistTracks([])
          setIsSpotifyActive(true)
          setSearchMode('catalog')
        } else {
          setIsSpotifyActive(false)
        }
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
    setSpotifyApiError(null)
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(queryStr)}&entity=song&limit=15&country=TH`
      const resp = await fetch(url)
      if (!resp.ok) {
        throw new Error(`iTunes API returned status ${resp.status}`)
      }
      const data = await resp.json()
      
      const tracks = (data.results || []).map((item) => {
        const albumImage = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb.jpg', '300x300bb.jpg') : ''
        return {
          id: String(item.trackId),
          name: item.trackName,
          artists: item.artistName,
          albumName: item.collectionName || '',
          albumImage: albumImage || item.artworkUrl100 || '',
          duration_ms: item.trackTimeMillis || 180000,
          uri: `https://open.spotify.com/search/${encodeURIComponent(item.trackName + ' ' + item.artistName)}`,
          previewUrl: item.previewUrl || ''
        }
      })
      
      setSearchResults(tracks)
      setSpotifyApiError(null)
    } catch (err) {
      console.error('iTunes Search failed:', err)
      setSpotifyApiError('ระบบค้นหาขัดข้องชั่วคราว คุณสามารถพิมพ์ขอเพลงด้วยตนเองได้')
      setSearchResults([])
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
      
      const guidelines = data.find(item => item.key === 'song_request_guidelines')?.value
      if (guidelines) setSongGuidelines(guidelines)
      
      const gpsEnabled = data.find(item => item.key === 'qr_gps_enabled')?.value
      const lat = data.find(item => item.key === 'qr_latitude')?.value
      const lng = data.find(item => item.key === 'qr_longitude')?.value
      const rad = data.find(item => item.key === 'qr_radius')?.value
      
      const enabled = data.find(item => item.key === 'song_request_enabled')?.value
      if (enabled === 'false') {
        setIsSystemEnabled(false)
      } else {
        setIsSystemEnabled(true)
      }
      
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
    if (!donationAmount || parseFloat(donationAmount) <= 0) return toast.error('กรุณาระบุจำนวนเงินบริจาค')
    if (!slipFile) return toast.error('กรุณาอัปโหลดสลิปโอนเงิน')

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
         message: `[Donation: ${donationAmount} THB]${dedicationMessage ? ' ' + dedicationMessage : ''}`,
         slip_url: fileName, // Save relative path
         status: 'pending'
       }
 
       const { error: dbError } = await supabase
         .from('song_requests')
         .insert(requestData)
 
       if (dbError) throw dbError
 
       // 3. Construct and Trigger LINE Flex Message via send-line-notify
       const lineMessage = `🎵 ขอเพลงใหม่: ${trackName} - ${artistName}\nผู้ขอ: ${requesterName}\nผู้สนับสนุน: ${donationAmount} THB\nข้อความ: ${dedicationMessage || '-'}`
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
                 text: `🎵 SONG REQUEST · ${donationAmount} THB`,
                 weight: "bold",
                 size: "sm",
                 color: "#1A1A1A"
               }
             ]
           },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: trackName,
                weight: "bold",
                size: "lg",
                color: "#1A1A1A",
                wrap: true
              },
              {
                type: "text",
                text: `${artistName} · ${durationMin}:${durationSec}`,
                size: "sm",
                color: "#666666",
                margin: "xs",
                wrap: true
              },
              {
                type: "separator",
                margin: "lg",
                color: "#E2E2E0"
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
                        color: "#888888",
                        size: "xs",
                        flex: 1
                      },
                      {
                        type: "text",
                        text: requesterName,
                        weight: "bold",
                        size: "sm",
                        color: "#1A1A1A",
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
                        color: "#888888",
                        size: "xs",
                        flex: 1
                      },
                      {
                        type: "text",
                        text: gpsNote,
                        size: "xs",
                        color: "#1A1A1A",
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
                        color: "#888888",
                        size: "xs",
                        flex: 1
                      },
                      {
                        type: "text",
                        text: dedicationMessage || "-",
                        size: "sm",
                        color: "#1A1A1A",
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
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#1A1A1A",
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
            ]
          },
          styles: {
            header: {
              backgroundColor: "#F4F4F3",
              separator: true,
              separatorColor: "#E2E2E0"
            },
            body: {
              backgroundColor: "#FFFFFF"
            },
            footer: {
              backgroundColor: "#F4F4F3",
              separator: true,
              separatorColor: "#E2E2E0"
            }
          }
        }
      }

      const { error: lineError } = await supabase.functions.invoke('send-line-notify', {
        body: { message: lineMessage, flexPayload }
      })

      if (lineError) console.error('LINE notification failed:', lineError)

      toast.dismiss(toastId)
      setSpotifyLink('')
      setTrackName('')
      setArtistName('')
      setSelectedTrack(null)
      setSlipFile(null)
      setDedicationMessage('')
      setDonationAmount('100')
      setShowSuccess(true)
      
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#E05315', '#222222', '#F2F2EC']
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
        return (
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 text-[8px] font-mono font-bold rounded-[3px] uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 border border-emerald-700 animate-pulse shadow-[0_0_3px_#10b981]"></span>
            Now Playing
          </span>
        )
      case 'completed':
        return <span className="px-2 py-0.5 bg-neutral-100 text-[var(--color-muted)] border border-[var(--color-rule)] text-[8px] font-mono rounded-[3px] uppercase">Completed</span>
      case 'rejected':
        return <span className="px-2 py-0.5 bg-red-500/10 text-red-600 border border-red-500/25 text-[8px] font-mono rounded-[3px] uppercase">Rejected</span>
      default:
        return (
          <span className="px-2 py-0.5 bg-[var(--color-paper-3)] text-[var(--color-ink-2)] border border-[var(--color-rule)] text-[8px] font-mono rounded-[3px] uppercase flex items-center gap-1">
            Queued
          </span>
        )
    }
  }

  return (
    <div id="song-request-root" className="min-h-screen flex flex-col items-center select-none pb-12">
      <Toaster position="top-center" richColors closeButton />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

        html, body {
          overflow-x: clip !important;
        }

        #song-request-root {
          --color-paper: oklch(96% 0.003 80);      /* Braun light-grey casing */
          --color-paper-2: oklch(92% 0.004 80);    /* Secondary card panel */
          --color-paper-3: oklch(88% 0.005 80);    /* Inset panel bg */
          --color-ink: oklch(20% 0.003 80);        /* Deep charcoal */
          --color-ink-2: oklch(40% 0.004 80);      /* Muted lettering */
          --color-muted: oklch(55% 0.004 80);      /* Greyed elements */
          --color-rule: oklch(82% 0.004 80);       /* Hairline dividers */
          --color-brand: oklch(62% 0.16 35);      /* Braun Dial Orange Accent */
          --color-accent-ink: oklch(98% 0 0);      /* White button text */
          --color-focus: oklch(62% 0.16 35);
          
          --font-display: 'Space Mono', monospace;
          --font-body: 'IBM Plex Sans Thai', 'Inter', sans-serif;
          
          --dur-short: 180ms;
          --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
          
          background-color: var(--color-paper);
          color: var(--color-ink);
          font-family: var(--font-body);
        }

        #song-request-root .btn-tab {
          transition: background-color var(--dur-short) var(--ease-out), color var(--dur-short) var(--ease-out);
        }
        #song-request-root .btn-tab:focus-visible {
          outline: 2px solid var(--color-focus);
        }
        
        #song-request-root .btn-action {
          transition: background-color var(--dur-short) var(--ease-out), color var(--dur-short) var(--ease-out), transform var(--dur-short) var(--ease-out);
        }
        #song-request-root .btn-action:hover:not(:disabled) {
          filter: brightness(0.95);
        }
        #song-request-root .btn-action:active:not(:disabled) {
          transform: scale(0.98);
        }
        #song-request-root .btn-action:focus-visible {
          outline: 2px solid var(--color-focus);
          outline-offset: 2px;
        }

        #song-request-root .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        #song-request-root .custom-scrollbar::-webkit-scrollbar-track {
          background: var(--color-paper-3);
          border-radius: 2px;
        }
        #song-request-root .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--color-rule);
          border-radius: 2px;
        }
      `}</style>

      {/* Back to Arcade Button */}
      <div className="w-full bg-[oklch(20%_0.003_80)] text-[var(--color-paper)] py-2.5 px-6 flex items-center justify-between shadow-md z-10 sticky top-0">
        <Link
          to="/arcade"
          className="btn-action flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>BACK TO ARCADE / กลับไปหน้าเกม</span>
        </Link>
      </div>

      {/* Dieter Rams Dashboard Masthead */}
      <header className="w-full border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 select-none mb-6">
        {/* Brand block */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--color-ink)] flex items-center justify-center p-1 rounded-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <img 
              src="/logo-secondary.png" 
              alt="ในบ้าน" 
              className="h-5 w-auto object-contain brightness-0 invert" 
            />
          </div>
          <div>
            <h1 className="text-[10px] font-bold font-mono tracking-widest text-[var(--color-ink)] uppercase">
              HAUS SONG REQUEST SYSTEM
            </h1>
            <p className="text-[8px] text-[var(--color-ink-2)] font-mono uppercase tracking-wider">
              MODEL T-2026 // SPOTIFY INTEGRATION
            </p>
          </div>
        </div>

        {/* Tab Navigation switches */}
        <div className="flex bg-[var(--color-paper-3)] p-0.5 rounded-[4px] border border-[var(--color-rule)]">
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`btn-tab px-4 py-1.5 rounded-[3px] text-[9px] font-bold font-mono uppercase tracking-wider ${
              activeTab === 'request' 
                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-sm' 
                : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
            }`}
          >
            REQUEST SONG / ขอเพลงใหม่
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab('queue')
              fetchQueue(true)
            }}
            className={`btn-tab px-4 py-1.5 rounded-[3px] text-[9px] font-bold font-mono uppercase tracking-wider relative ${
              activeTab === 'queue' 
                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-sm' 
                : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
            }`}
          >
            UPCOMING QUEUE / คิวเพลง
            {queue.filter(q => q.status === 'pending').length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[var(--color-brand)] text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold font-mono border border-white">
                {queue.filter(q => q.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="w-full max-w-md px-6 flex-grow flex flex-col">
        {!isSystemEnabled ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <Music className="w-12 h-12 text-[var(--color-muted)]" />
            <h2 className="text-lg font-bold font-mono text-[var(--color-ink)] uppercase tracking-widest">SYSTEM OFFLINE</h2>
            <p className="text-xs text-[var(--color-ink-2)] font-sans max-w-xs leading-relaxed">
              ขออภัยค่ะ ระบบขอเพลงปิดให้บริการชั่วคราว<br/>กรุณาติดตามเวลาเปิดให้บริการอีกครั้ง
            </p>
          </div>
        ) : activeTab === 'request' ? (
          <form onSubmit={handleSubmitRequest} className="flex-grow flex flex-col gap-5">
            
            {/* Guidelines alert board */}
            {songGuidelines && (
              <div className="bg-white border border-[var(--color-rule)] p-4.5 rounded-md flex flex-col gap-2 shadow-sm relative overflow-hidden font-mono text-[10px]">
                <div className="flex items-center gap-2 text-[var(--color-brand)] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>กติกาการขอเพลง (Music Guidelines)</span>
                </div>
                <p className="text-[10px] text-[var(--color-ink-2)] leading-relaxed whitespace-pre-wrap font-sans">
                  {songGuidelines}
                </p>
              </div>
            )}
            
            {/* GPS verification banner */}
            {gpsConfig.enabled && (
              <div className="flex items-center gap-2.5 text-[9px] text-[var(--color-ink-2)] bg-white border border-[var(--color-rule)] p-3.5 rounded-md font-mono select-none">
                <MapPin className="w-3.5 h-3.5 text-[var(--color-brand)] shrink-0" />
                <span className="leading-normal uppercase">GPS LOCK ENABLED: ระบบตรวจสอบตำแหน่งพิกัดในร้าน (ไม่เกิน {(gpsConfig.radius / 1000).toFixed(1)} กม.) ขณะกดส่ง</span>
              </div>
            )}

            {/* Song Form Card */}
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg p-5 flex flex-col gap-4 shadow-sm">
              
              {/* Spotify Song Selector */}
              {isSpotifyActive ? (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center select-none">
                    <label className="block text-[9px] text-[var(--color-ink-2)] uppercase font-mono font-bold tracking-wider">// CHOOSE SONG</label>
                    <button
                      type="button"
                      onClick={() => setIsSpotifyActive(false)}
                      className="text-[9px] text-[var(--color-brand)] hover:underline font-mono uppercase font-bold"
                    >
                      [ MANUAL INPUT ]
                    </button>
                  </div>

                  {selectedTrack ? (
                    /* Selected Song display */
                    <div className="bg-white border border-[var(--color-rule)] p-3 rounded-md flex items-center justify-between shadow-sm relative overflow-hidden">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 bg-neutral-100 rounded-sm overflow-hidden shrink-0 shadow-sm border border-[var(--color-rule)]">
                          <img src={selectedTrack.albumImage || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop'} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 font-sans text-xs">
                          <h4 className="font-bold text-[var(--color-ink)] truncate leading-snug">{selectedTrack.name}</h4>
                          <p className="text-[10px] text-[var(--color-brand)] font-bold truncate mt-0.5">{selectedTrack.artists}</p>
                          <span className="inline-flex items-center gap-1 text-[8px] text-[var(--color-muted)] font-mono uppercase mt-1 leading-none">
                            Selected Song //
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
                        className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)] font-mono text-[9px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] px-2.5 py-1 rounded-[3px] uppercase cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    /* Search input and listing selector */
                    <div className="flex flex-col gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] w-3.5 h-3.5" />
                        <input
                          type="text"
                          placeholder={searchMode === 'playlist' ? "ค้นหาเพลงแนะนำของร้าน..." : "ค้นหาเพลงบน Spotify..."}
                          className="w-full bg-white border border-[var(--color-rule)] rounded-[4px] py-2 pl-9 pr-8 text-xs font-sans text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-brand)] transition-colors placeholder:text-neutral-400"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)] font-mono text-[10px]"
                          >
                            [X]
                          </button>
                        )}
                      </div>

                      {spotifyApiError && (
                        <div className="bg-red-500/5 border border-red-500/20 text-red-600 p-3 rounded-md text-[10px] space-y-1 font-mono">
                          <p className="font-bold">⚠️ AUTO SEARCH FAILED</p>
                          <p className="opacity-80 font-sans">{spotifyApiError}</p>
                          <button
                            type="button"
                            onClick={() => setIsSpotifyActive(false)}
                            className="text-[var(--color-brand)] font-bold underline mt-1.5 block cursor-pointer"
                          >
                            สลับไปกรอกข้อมูลเพลงด้วยตัวเอง (พิมพ์มือ)
                          </button>
                        </div>
                      )}

                      {/* Mode tab sliders */}
                      {playlistTracks.length > 0 && (
                        <div className="flex bg-[var(--color-paper-3)] p-0.5 rounded-[4px] border border-[var(--color-rule)] gap-0.5 select-none">
                          <button
                            type="button"
                            onClick={() => {
                              setSearchMode('playlist')
                              setSearchQuery('')
                            }}
                            className={`flex-1 py-1 rounded-[3px] font-bold font-mono text-[8px] uppercase transition-all ${
                              searchMode === 'playlist' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-sm' : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
                            }`}
                          >
                            Store Recommended / แนะนำร้าน
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchMode('catalog')
                              setSearchQuery('')
                            }}
                            className={`flex-1 py-1 rounded-[3px] font-bold font-mono text-[8px] uppercase transition-all ${
                              searchMode === 'catalog' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-sm' : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
                            }`}
                          >
                            Spotify Catalog / ค้นหาทั่วไป
                          </button>
                        </div>
                      )}

                      {/* Search Results / Recommendation list box */}
                      <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar bg-white border border-[var(--color-rule)] p-2 rounded-[3px] font-mono text-[9px]">
                        {loadingPlaylist || searching ? (
                          <div className="flex items-center justify-center py-8 text-[var(--color-muted)] text-[10px] gap-2 animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin text-[var(--color-brand)]" />
                            <span>SEARCHING LEDGER…</span>
                          </div>
                        ) : searchMode === 'playlist' ? (
                          (() => {
                            const filtered = playlistTracks.filter(track =>
                              track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              track.artists.toLowerCase().includes(searchQuery.toLowerCase())
                            )

                            if (filtered.length === 0) {
                              return (
                                <div className="text-center py-6 text-[var(--color-muted)] text-[10px] font-sans">
                                  ไม่พบเพลงในเพลย์ลิสต์แนะนำ <br/>
                                  <button
                                    type="button"
                                    onClick={() => setSearchMode('catalog')}
                                    className="text-[var(--color-brand)] font-bold underline mt-1 block w-full text-center font-mono text-[9px] uppercase"
                                  >
                                    [ SEARCH GENERAL SPOTIFY ]
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
                                className="p-2 border-b border-dashed border-[var(--color-rule)] last:border-0 flex items-center justify-between hover:bg-[var(--color-paper-2)] cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img src={track.albumImage || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop'} alt="" className="w-8 h-8 rounded-sm object-cover shrink-0 border border-[var(--color-rule)]" />
                                  <div className="min-w-0 text-left font-sans text-xs">
                                    <h5 className="font-bold text-[var(--color-ink)] truncate leading-none">{track.name}</h5>
                                    <p className="text-[9px] text-[var(--color-ink-2)] truncate mt-1">{track.artists}</p>
                                  </div>
                                </div>
                                <span className="text-[8px] bg-[var(--color-paper-3)] border border-[var(--color-rule)] text-[var(--color-ink)] font-bold px-2 py-0.5 rounded-[3px] uppercase shrink-0">
                                  SELECT
                                </span>
                              </div>
                            ))
                          })()
                        ) : (
                          (() => {
                            if (!searchQuery.trim()) {
                              return (
                                <div className="text-center py-6 text-[var(--color-muted)] text-[10px] font-sans">
                                  พิมพ์ชื่อเพลงหรือศิลปินเพื่อเริ่มต้นค้นหา...
                                </div>
                              )
                            }

                            if (searchResults.length === 0) {
                              return (
                                <div className="text-center py-6 text-[var(--color-muted)] text-[10px] font-sans">
                                  ไม่พบผลลัพธ์การค้นหาในสารบบ
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
                                  setSpotifyLink(track.uri || `https://open.spotify.com/track/${track.id}`)
                                }}
                                className="p-2 border-b border-dashed border-[var(--color-rule)] last:border-0 flex items-center justify-between hover:bg-[var(--color-paper-2)] cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img src={track.albumImage || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop'} alt="" className="w-8 h-8 rounded-sm object-cover shrink-0 border border-[var(--color-rule)]" />
                                  <div className="min-w-0 text-left font-sans text-xs">
                                    <h5 className="font-bold text-[var(--color-ink)] truncate leading-none">{track.name}</h5>
                                    <p className="text-[9px] text-[var(--color-ink-2)] truncate mt-1">{track.artists}</p>
                                  </div>
                                </div>
                                <span className="text-[8px] bg-[var(--color-paper-3)] border border-[var(--color-rule)] text-[var(--color-ink)] font-bold px-2 py-0.5 rounded-[3px] uppercase shrink-0">
                                  SELECT
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
                /* Fallback Manual Inputs styling */
                <div className="flex flex-col gap-3">
                  {playlistTracks.length > 0 && (
                    <div className="flex justify-end select-none">
                      <button
                        type="button"
                        onClick={() => setIsSpotifyActive(true)}
                        className="text-[9px] text-[var(--color-brand)] hover:underline font-mono uppercase font-bold"
                      >
                        [ LOAD STORE RECOMMENDATIONS ]
                      </button>
                    </div>
                  )}

                  {/* Spotify Link Field */}
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-[9px] text-[var(--color-ink-2)] uppercase font-mono font-bold tracking-wider">// SPOTIFY URL LINK (IF ANY)</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] w-3.5 h-3.5" />
                      <input
                        type="text"
                        placeholder="วางลิงก์ เช่น https://open.spotify.com/track/..."
                        className="w-full bg-white border border-[var(--color-rule)] rounded-[4px] py-2 pl-9 pr-4 text-xs font-sans text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-brand)] transition-colors placeholder:text-neutral-400"
                        value={spotifyLink}
                        onChange={(e) => setSpotifyLink(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Song title and artist */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="block text-[9px] text-[var(--color-ink-2)] uppercase font-mono font-bold tracking-wider">// SONG TITLE *</label>
                      <input
                        type="text"
                        required
                        placeholder="ระบุชื่อเพลง..."
                        className="w-full bg-white border border-[var(--color-rule)] rounded-[4px] py-2 px-3 text-xs font-sans text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                        value={trackName}
                        onChange={(e) => setTrackName(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="block text-[9px] text-[var(--color-ink-2)] uppercase font-mono font-bold tracking-wider">// ARTIST NAME *</label>
                      <input
                        type="text"
                        required
                        placeholder="ระบุชื่อศิลปิน..."
                        className="w-full bg-white border border-[var(--color-rule)] rounded-[4px] py-2 px-3 text-xs font-sans text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Requester Name */}
              <div className="flex flex-col gap-1.5">
                <label className="block text-[9px] text-[var(--color-ink-2)] uppercase font-mono font-bold tracking-wider">// SENDER NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="ระบุชื่อของคุณ..."
                  className="w-full bg-white border border-[var(--color-rule)] rounded-[4px] py-2 px-3 text-xs font-sans text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                />
              </div>

              {/* Donation Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="block text-[9px] text-[var(--color-ink-2)] uppercase font-mono font-bold tracking-wider">// SUPPORT DONATION AMOUNT (THB) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="จำนวนเงินสนับสนุน (เช่น 100 บาท)..."
                  className="w-full bg-white border border-[var(--color-rule)] rounded-[4px] py-2 px-3 text-xs font-sans text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                />
              </div>

              {/* Dedication Message */}
              <div className="flex flex-col gap-1.5">
                <label className="block text-[9px] text-[var(--color-ink-2)] uppercase font-mono font-bold tracking-wider">// MESSAGE TO DJ / ข้อความฝากดีเจ</label>
                <textarea
                  rows={2}
                  placeholder="ฝากความในใจหรือคำอวยพรสั้นๆ..."
                  className="w-full bg-white border border-[var(--color-rule)] rounded-[4px] py-2 px-3 text-xs font-sans text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-brand)] transition-colors resize-none placeholder:text-neutral-400"
                  value={dedicationMessage}
                  onChange={(e) => setDedicationMessage(e.target.value)}
                />
              </div>

              {/* PromptPay QR Code Panel */}
              <div className="bg-white border border-[var(--color-rule)] rounded-md p-4 flex flex-col items-center">
                <span className="text-[9px] font-bold font-mono tracking-widest text-[var(--color-brand)] mb-3 uppercase">// SCAN PROMPTPAY TO DONATE</span>
                {paymentQrUrl ? (
                  <div className="bg-white p-2 border border-[var(--color-rule)] rounded-[4px] mb-3 shadow-sm select-none">
                    <img src={paymentQrUrl} alt="PromptPay" className="w-32 h-32 object-contain" />
                  </div>
                ) : (
                  <div className="w-32 h-32 bg-[var(--color-paper-3)] text-[var(--color-muted)] rounded-[4px] border border-[var(--color-rule)] flex items-center justify-center text-[10px] font-mono mb-3 select-none">
                    NO INSTALLED QR CODE
                  </div>
                )}
                <p className="text-[9px] text-[var(--color-ink-2)] text-center leading-relaxed max-w-[240px] font-mono uppercase select-none">
                  สแกน QR Code เพื่อร่วมโอนเงินสนับสนุน จากนั้นแนบหลักฐานรูปสลิปที่โอนด้านล่าง
                </p>
              </div>

              {/* Upload Payment Slip */}
              <div className="flex flex-col gap-1.5">
                <label className="block text-[9px] text-[var(--color-ink-2)] uppercase font-mono font-bold tracking-wider">// ATTACH PAYMENT SLIP *</label>
                {slipFile ? (
                  <div className="bg-white border border-emerald-500/60 p-3 rounded-md flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 border border-emerald-700 shadow-[0_0_3px_#10b981]"></span>
                      <p className="text-xs font-mono font-bold text-emerald-600 truncate flex-1">{slipFile.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSlipFile(null)}
                      className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)] font-mono text-[9px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] px-2.5 py-0.5 rounded-[3px] uppercase cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="border border-dashed border-[var(--color-rule)] hover:border-[var(--color-brand)] cursor-pointer bg-white p-5 rounded-md flex flex-col items-center justify-center gap-2 group transition-all text-center select-none">
                    <Upload size={16} className="text-[var(--color-ink-2)] group-hover:text-[var(--color-brand)] transition-colors" />
                    <span className="text-[10px] font-bold font-mono text-[var(--color-ink-2)] group-hover:text-[var(--color-ink)] uppercase">
                      UPLOAD PAYMENT SLIP / คลิกแนบสลิป
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

              {/* Submit Request Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-action w-full bg-[var(--color-brand)] text-white hover:bg-[oklch(58% 0.16 35)] font-mono font-bold py-3.5 rounded-[4px] cursor-pointer text-xs uppercase border border-[oklch(52% 0.16 35)] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Send size={12} className="shrink-0" />
                  <span>{uploading ? 'TRANSMITTING REQUEST BLOCK…' : 'SUBMIT REQUEST / ส่งคำขอเพลง'}</span>
                </button>
              </div>

            </div>
          </form>
        ) : (
          /* Upcoming Queue View list */
          <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg p-5 flex flex-col gap-4 shadow-sm">
            
            <div className="border-b border-[var(--color-rule)] pb-2 flex justify-between items-center select-none">
              <div className="flex items-center gap-1.5 text-[var(--color-ink)]">
                <ListMusic className="w-3.5 h-3.5 text-[var(--color-brand)]" />
                <h2 className="text-[10px] font-bold font-mono tracking-widest uppercase">// LIVE REQUEST QUEUE</h2>
              </div>
              <button 
                onClick={() => fetchQueue(true)}
                className="px-2 py-0.5 text-[8px] text-[var(--color-ink-2)] hover:text-[var(--color-ink)] font-mono bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[3px] transition-all cursor-pointer"
              >
                REFRESH
              </button>
            </div>

            {loadingQueue ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-7 h-7 text-[var(--color-brand)] animate-spin" />
                <p className="text-[10px] text-[var(--color-ink-2)] font-mono animate-pulse">READING QUEUE STACK…</p>
              </div>
            ) : queue.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center text-[var(--color-muted)] font-mono text-[10px]">
                <ListMusic className="w-7 h-7 mb-2 opacity-60 text-[var(--color-ink)]" />
                <p className="font-bold">QUEUE IS CURRENTLY EMPTY</p>
                <p className="text-[9px] mt-1 font-sans text-zinc-500">
                  ขอเพลงเป็นคนแรกเพื่อเปิดบรรยากาศในร้านเลย!
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 font-sans">
                
                {/* Now Playing Tracks */}
                {queue.filter(q => q.status === 'playing').map((reqItem) => (
                  <div 
                    key={reqItem.id}
                    className="bg-white border border-emerald-500/60 p-4 rounded-md flex items-center gap-4 shadow-sm relative"
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                    <div className="w-12 h-12 bg-neutral-100 rounded-sm overflow-hidden shrink-0 border border-[var(--color-rule)]">
                      <img src={reqItem.album_image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 text-xs text-left">
                      <div className="mb-1.5">{getStatusBadge(reqItem.status)}</div>
                      <h3 className="font-bold text-[var(--color-ink)] truncate leading-snug">{reqItem.track_name}</h3>
                      <p className="text-[10px] text-[var(--color-brand)] font-bold truncate mt-0.5">{reqItem.artist_name}</p>
                      {reqItem.requester_name && (
                        <p className="text-[9px] text-[var(--color-ink-2)] truncate mt-1 font-mono">
                          REQUESTER: <span className="text-[var(--color-ink)] font-bold">{reqItem.requester_name}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Queue Separator tag */}
                {queue.filter(q => q.status === 'playing').length > 0 && queue.filter(q => q.status !== 'playing').length > 0 && (
                  <div className="text-[8px] text-[var(--color-muted)] font-bold font-mono uppercase tracking-widest pt-2 pb-1 border-b border-dashed border-[var(--color-rule)] select-none">
                    UPCOMING QUEUE / ลำดับคิวถัดไป
                  </div>
                )}

                {/* Other Queue Tracks */}
                {queue.filter(q => q.status !== 'playing').length > 0 && (
                  <div className="flex flex-col font-mono text-[9px] bg-white border border-[var(--color-rule)] p-2 rounded-[3px]">
                    {queue.filter(q => q.status !== 'playing').map((reqItem, index) => (
                      <div 
                        key={reqItem.id}
                        className="py-2.5 px-2 border-b border-dashed border-[var(--color-rule)] last:border-0 hover:bg-[var(--color-paper-2)] transition-colors flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-4 text-left font-bold text-[var(--color-muted)]">
                            {(index + 1).toString().padStart(2, '0')}
                          </span>
                          <img src={reqItem.album_image} alt="" className="w-8 h-8 rounded-sm object-cover shrink-0 border border-[var(--color-rule)]" />
                          <div className="min-w-0 text-left font-sans text-xs">
                            <h4 className="font-bold text-[var(--color-ink)] truncate leading-none">{reqItem.track_name}</h4>
                            <p className="text-[9px] text-[var(--color-ink-2)] truncate mt-1 leading-none">{reqItem.artist_name}</p>
                            {reqItem.requester_name && (
                              <p className="text-[8px] text-[var(--color-muted)] truncate mt-1 uppercase font-mono">
                                BY: {reqItem.requester_name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">{getStatusBadge(reqItem.status)}</div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}
          </div>
        )}
      </main>

      {/* Success Modal Overlay Casing */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="w-full max-w-md bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-md p-6 sm:p-8 shadow-xl text-left relative"
            >
              {/* Minimal orange highlight strip */}
              <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-brand)] rounded-t-md" />
              
              <div className="w-8 h-8 bg-emerald-500/10 text-emerald-600 rounded-[3px] flex items-center justify-center mb-6">
                <CheckCircle2 size={16} />
              </div>
              
              <h2 className="text-[10px] font-bold font-mono tracking-widest text-[var(--color-brand)] uppercase mb-2">
                // SONG REQUEST ENQUEUED SUCCESS
              </h2>
              <h3 className="text-[13px] font-bold text-[var(--color-ink)] mb-2 font-sans">ส่งคำขอเพลงเข้าสู่ระบบเรียบร้อย!</h3>
              <p className="text-[10px] text-[var(--color-ink-2)] leading-relaxed font-sans mb-8">
                ข้อมูลคำขอและสลิปเงินบริจาคของคุณพร้อมเพลงได้รับการส่งเข้าห้องดีเจเป็นที่เรียบร้อย พนักงานจะเร่งตรวจสอบข้อมูลสลิปและคิวสำหรับคุณนะคะ 💚
              </p>

              <button
                onClick={() => {
                  setShowSuccess(false)
                  setActiveTab('queue')
                  fetchQueue(true)
                }}
                className="btn-action w-full bg-[var(--color-ink)] text-[var(--color-paper)] font-mono font-bold py-2.5 rounded-[4px] cursor-pointer text-xs uppercase shadow-sm"
              >
                VIEW LIVE QUEUE / ดูคิวเพลงทั้งหมด
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
