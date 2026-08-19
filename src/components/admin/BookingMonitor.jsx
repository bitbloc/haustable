/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Wifi, WifiOff, Volume2, Bell } from 'lucide-react'
import { playOrderAlert, unlockAudioEngine, isAudioUnlocked } from '../../utils/audioHelper'

export default function BookingMonitor() {
    const [isOnlineState, setIsOnlineState] = useState(true)
    const [audioUnlocked, setAudioUnlocked] = useState(false)
    const [incomingBooking, setIncomingBooking] = useState(null)
    const [wakeLock, setWakeLock] = useState(null)

    // Audio Refs
    const intervalRef = useRef(null)

    useEffect(() => {
        if (isAudioUnlocked()) {
            setAudioUnlocked(true)
        }
    }, [])

    const startAlarm = (booking = null) => {
        const eventKey = booking?.id ? `monitor_order_${booking.id}` : 'monitor_order';
        playOrderAlert(eventKey, 600, 3.4)
        
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = setInterval(() => {
            playOrderAlert('monitor_repeat', 1000, 3.4)
        }, 12000)
    }

    const stopAlarm = () => {
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
        unlockAudioEngine()
        playOrderAlert('test_system', 500, 3.0) // Test sound
        await requestWakeLock()
        setAudioUnlocked(true)
    }

    // --- 4. Supabase Realtime & Health ---
    useEffect(() => {
        const channel = supabase.channel('room_monitor')

        channel
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'bookings' },
                (payload) => {
                    console.log('New Booking:', payload.new)
                    setIncomingBooking(payload.new)
                    startAlarm(payload.new)
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setIsOnlineState(true)
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsOnlineState(false)
            })

        const handleOnline = () => setIsOnlineState(true)
        const handleOffline = () => setIsOnlineState(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return async () => {
            await supabase.removeChannel(channel)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            stopAlarm()
            if (wakeLock) wakeLock.release()
        }
    }, [])

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
                    className="bg-[oklch(52%_0.16_28)] hover:opacity-90 text-white font-bold p-4 rounded-full shadow-xl flex items-center gap-2 border-2 border-white"
                >
                    <Volume2 size={24} />
                    <span>กดเพื่อเปิดระบบเสียง (Enable Audio)</span>
                </button>
            </div>
        )
    }

    return (
        <>
            {/* Status Indicator (Bottom Left) */}
            <div className={`fixed bottom-4 left-4 z-50 px-3 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-2 ${isOnlineState ? 'bg-black/80 text-[#DFFF00] border-[#DFFF00]' : 'bg-red-600 text-white border-white animate-pulse'}`}>
                {isOnlineState ? <Wifi size={14} /> : <WifiOff size={14} />}
                {isOnlineState ? 'SYSTEM ONLINE' : 'DISCONNECTED'}
            </div>

            {/* Wake Lock Status */}
            {wakeLock && (
                <div className="fixed bottom-4 left-36 z-50 text-[10px] font-mono text-gray-400 opacity-50">
                    ⚡ Screen Active
                </div>
            )}

            {/* Incoming Booking Modal */}
            {incomingBooking && (
                <div className="fixed inset-0 z-[100] bg-[oklch(18%_0.012_28)]/90 backdrop-blur-md flex flex-col items-center justify-center">
                    <div className="text-white text-center space-y-6 p-8 max-w-lg bg-[oklch(22%_0.015_28)] border border-[oklch(85%_0.012_28)]/20 rounded-2xl shadow-2xl">
                        <Bell size={64} className="mx-auto text-[oklch(52%_0.16_28)] animate-bounce" />
                        <div className="text-[12px] font-mono font-bold uppercase tracking-widest text-[oklch(52%_0.16_28)]">Incoming Order</div>
                        <h1 className="text-3xl font-bold">มีออเดอร์ใหม่เข้ามา!</h1>
                        <p className="text-xl">โต๊ะ / รายการ: {incomingBooking.tables_layout?.table_name || incomingBooking.table_id || 'Pickup / Online'}</p>
                        <p className="text-lg font-mono font-bold text-emerald-400">ยอดเงิน: ฿{incomingBooking.total_amount || 0}.-</p>

                        <button
                            onClick={handleAcknowledge}
                            className="bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] px-10 py-4 rounded-xl font-bold text-xl shadow-xl hover:opacity-90 active:scale-98 transition-all w-full"
                        >
                            รับทราบ (Acknowledge)
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
