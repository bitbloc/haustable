import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Wifi, WifiOff, Volume2, VolumeX, Bell, AlertTriangle } from 'lucide-react'

export default function BookingMonitor() {
    const [isOnline, setIsOnline] = useState(true)
    const [audioUnlocked, setAudioUnlocked] = useState(false)
    const [incomingBooking, setIncomingBooking] = useState(null)
    const [wakeLock, setWakeLock] = useState(null)

    // Audio Refs
    const audioContextRef = useRef(null)
    const oscillatorRef = useRef(null)
    const intervalRef = useRef(null)

    // --- 1. Audio System (Web Audio API & HTML5 Audio) ---
    // We keep Web Audio for generated fallbacks, but add an Audio element for custom files.

    // Fetch custom sound URL from context or passed via props? 
    // Ideally BookingMonitor should context-aware or fetch settings.
    // For simplicity, let's fetch settings directly since it's mounting in layout.

    const [customSoundUrl, setCustomSoundUrl] = useState(null)
    const customAudioRef = useRef(new Audio())

    useEffect(() => {
        // Fetch setting once on mount
        const fetchSettings = async () => {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'alert_sound_url').single()
            if (data?.value) {
                setCustomSoundUrl(data.value)
                customAudioRef.current.src = data.value
                customAudioRef.current.loop = true
            }
        }
        // Also subscribe to settings changes if needed, but for now simple fetch is enough
        fetchSettings()
    }, [])

    const initAudio = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }
    }

    const playTone = (freq = 440, type = 'square') => {
        // Fallback tone logic
        if (!audioContextRef.current) return
        const osc = audioContextRef.current.createOscillator()
        const gain = audioContextRef.current.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, audioContextRef.current.currentTime)
        osc.connect(gain)
        gain.connect(audioContextRef.current.destination)
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContextRef.current.currentTime + 0.5)
        osc.stop(audioContextRef.current.currentTime + 0.5)
    }

    const startAlarm = () => {
        if (customSoundUrl) {
            // Play Custom File
            // Check if audio context is running to allow play? HTML5 Audio is separate but often needs user gesture too.
            // However "Open System" button handles the gesture context.
            customAudioRef.current.play().catch(e => console.error("Play failed", e))
        } else {
            // Play Beep Fallback
            if (intervalRef.current) return
            intervalRef.current = setInterval(() => {
                playTone(880, 'square')
                setTimeout(() => playTone(600, 'square'), 300)
            }, 1000)
        }
    }

    const stopAlarm = () => {
        if (customSoundUrl) {
            customAudioRef.current.pause()
            customAudioRef.current.currentTime = 0
        }

        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }

    // --- 2. Wake Lock System ---
    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                const lock = await navigator.wakeLock.request('screen')
                setWakeLock(lock)
                console.log('Screen Wake Lock active')

                lock.addEventListener('release', () => {
                    console.log('Screen Wake Lock released')
                    setWakeLock(null)
                })
            }
        } catch (err) {
            console.error(`${err.name}, ${err.message}`)
        }
    }

    // --- 3. Interaction (Open System) ---
    const handleOpenSystem = async () => {
        initAudio()
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume()
        }
        playTone(600, 'sine') // Test sound
        await requestWakeLock()
        setAudioUnlocked(true)
    }

    // --- 4. Supabase Realtime & Health ---
    useEffect(() => {
        // Connection Check using Supabase internal websocket state if possible, 
        // or rely on 'system' channel events.
        const channel = supabase.channel('room_monitor')

        channel
            .on('system', { event: '*' }, (payload) => {
                // Supabase doesn't always emit 'disconnect' reliably on net drop, 
                // but we can track subscription status.
            })
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'bookings' },
                (payload) => {
                    // New Booking!
                    console.log('New Booking:', payload.new)
                    setIncomingBooking(payload.new)
                    if (audioUnlocked) startAlarm()
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setIsOnline(true)
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsOnline(false)
            })

        // Native Online/Offline listeners
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => {
            setIsOnline(false)
            if (audioUnlocked) playTone(200, 'sawtooth') // Error sound
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return async () => {
            // Using unsubscribe() is standard for RealtimeSubscription
            // Note: removeChannel is the high level Supabase Client method, which handles internal map.
            // We use removeChannel to be safe.
            await supabase.removeChannel(channel)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            stopAlarm()
            if (wakeLock) wakeLock.release()
        }
    }, [audioUnlocked]) // Re-bind if unlocked state changes? No, independent.

    // Acknowledge Function
    const handleAcknowledge = () => {
        stopAlarm()
        setIncomingBooking(null)
    }

    if (!audioUnlocked) {
        return (
            <div className="fixed bottom-4 right-4 z-50 animate-bounce">
                <button
                    onClick={handleOpenSystem}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold p-4 rounded-full shadow-lg flex items-center gap-2 border-4 border-white"
                >
                    <Volume2 size={24} />
                    <span>กดเพื่อเปิดระบบ (Start Shift)</span>
                </button>
            </div>
        )
    }

    return (
        <>
            {/* Status Indicator (Bottom Left) */}
            <div className={`fixed bottom-4 left-4 z-50 px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${isOnline ? 'bg-black/80 text-[#DFFF00] border-[#DFFF00]' : 'bg-red-600 text-white border-white animate-pulse'}`}>
                {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                {isOnline ? 'SYSTEM ONLINE' : 'DISCONNECTED'}
            </div>

            {/* Wake Lock Status (Hidden or subtle) */}
            {wakeLock && (
                <div className="fixed bottom-4 left-36 z-50 text-[10px] text-gray-400 opacity-50">
                    ⚡ Screen Active
                </div>
            )}

            {/* Incoming Booking Modal */}
            {incomingBooking && (
                <div className="fixed inset-0 z-[100] bg-red-600/90 backdrop-blur-md flex flex-col items-center justify-center animate-pulse-fast">
                    <div className="text-white text-center space-y-6 p-8">
                        <Bell size={80} className="mx-auto animate-bounce" />
                        <h1 className="text-5xl font-bold">NEW ORDER!</h1>
                        <p className="text-2xl">โต๊ะ (Table): {incomingBooking.table_id}</p>
                        <p className="text-xl">ยอดเงิน: {incomingBooking.total_amount} บาท</p>

                        <button
                            onClick={handleAcknowledge}
                            className="bg-white text-red-600 px-12 py-6 rounded-3xl font-bold text-3xl shadow-xl hover:scale-105 transition-transform"
                        >
                            รับทราบ (Acknowledge)
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
