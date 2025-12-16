import { useState, useRef, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Clock, Check, X, Bell, RefreshCw, ChefHat, Volume2, Printer, AlertTriangle } from 'lucide-react'
import { useWakeLock } from './hooks/useWakeLock'
import { useToast } from './context/ToastContext'
import ConfirmationModal from './components/ConfirmationModal'
import SlipModal from './components/shared/SlipModal'

// Helper for formatting time
const formatTime = (dateString, timeString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export default function StaffOrderPage() {
    const { toast } = useToast()
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null, isDangerous: false })
    
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isSoundChecked, setIsSoundChecked] = useState(false) // New: Force sound check
    const [pinInput, setPinInput] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [isConnected, setIsConnected] = useState(true) // Optimistic default
    
    // Printing
    const [printModal, setPrintModal] = useState({ isOpen: false, booking: null })

    const { isSupported, isLocked, request, release } = useWakeLock({
        onRequest: () => console.log('Screen locked!'),
        onRelease: () => console.log('Screen unlocked!'),
        onError: () => console.error('Wake Lock error')
    })
    
    // Audio Refs for better control
    const audioRef = useRef(new Audio())
    const [soundUrl, setSoundUrl] = useState(null)
    const [isPlaying, setIsPlaying] = useState(false)

    // Load Sound Settings & Auth Check
    useEffect(() => {
        const init = async () => {
            // 1. Check Auth
            const savedAuth = localStorage.getItem('staff_auth')
            if (savedAuth === 'true') {
                setIsAuthenticated(true)
            }

            // 2. Fetch Sound URL
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'alert_sound_url').single()
            if (data?.value) {
                setSoundUrl(data.value)
                audioRef.current.src = data.value
                audioRef.current.loop = true
            }
        }
        init()
    }, [])

    // --- Notifications ---
    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) {
            console.log('This browser does not support desktop notification')
            return
        }
        
        if (Notification.permission === 'default') {
            await Notification.requestPermission()
        }
    }

    const showSystemNotification = (title, body) => {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: '/icons/icon-192x192.png', // Assuming PWA icon exists
                vibrate: [200, 100, 200]
            })
        }
    }

    // Authenticated & Sound Verified Setup
    useEffect(() => {
        if (isAuthenticated && isSoundChecked) {
            fetchOrders()
            const channel = subscribeRealtime()
            if (isSupported) request()

            return () => {
                supabase.removeChannel(channel)
                if (isLocked) release()
                stopAlarm()
            }
        }
    }, [isAuthenticated, isSoundChecked])

    // Alarm Logic
    useEffect(() => {
        if (!isAuthenticated || !isSoundChecked) return

        // If generic pending orders exist
        if (orders.some(o => o.status === 'pending')) {
            if (!isPlaying && soundUrl) {
                playAlarm()
            }
        } else {
            stopAlarm()
        }
    }, [orders, isAuthenticated, isSoundChecked, soundUrl])

    const playAlarm = () => {
        if (!audioRef.current.src && soundUrl) audioRef.current.src = soundUrl
        
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
            playPromise
                .then(() => setIsPlaying(true))
                .catch(error => console.error("Audio playback failed:", error))
        }
    }

    const stopAlarm = () => {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
    }

    // Realtime Subscription
    const subscribeRealtime = () => {
         const channel = supabase
            .channel('staff-orders')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'bookings' },
                async (payload) => {
                    // IMMEDIATE ALERT on Insert
                    const newOrder = payload.new
                    if (newOrder.status === 'pending') {
                        playAlarm() // Force play immediately
                        showSystemNotification('New Order Incoming!', `Table: ${newOrder.table_id || 'N/A'} - Total: ${newOrder.total_amount}`)
                        
                        // Optimistic Update (wait for full fetch for relations, but alert first)
                        toast.success('New Order Received!')
                        fetchOrders() // Fetch full data to get table names/items
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'bookings' },
                () => fetchOrders() // Refresh on updates too
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setIsConnected(true)
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    console.error("Realtime disconnected:", status)
                    // Auto-reconnect logic could go here, but Supabase client handles it mostly.
                    // We keep 'isConnected' true to avoid false alarms unless critical.
                    // If it's a hard error, maybe flicker.
                     if (status === 'CHANNEL_ERROR') setIsConnected(false)
                }
            })
         return channel
    }

    const fetchOrders = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    *,
                    tables_layout (table_name),
                    order_items (
                        quantity,
                        selected_options,
                        price_at_time, 
                        menu_items (name)
                    )
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
            
            if (error) throw error
            setOrders(data || [])
            
        } catch (err) {
            console.error('Error fetching orders:', err)
            toast.error('Connection weak. Retrying...')
        } finally {
            setLoading(false)
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'staff_pin_code').single()
            const correctPin = data?.value || '0000'

            if (pinInput === correctPin) {
                setIsAuthenticated(true)
                localStorage.setItem('staff_auth', 'true')
                // Don't fetch yet, wait for sound check
            } else {
                toast.error('Incorrect PIN')
                setPinInput('')
            }
        } catch (err) {
            toast.error('Error verify')
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        setIsAuthenticated(false)
        setIsSoundChecked(false)
        localStorage.removeItem('staff_auth')
        setPinInput('')
        stopAlarm()
    }

    const updateStatus = async (id, newStatus) => {
        setConfirmModal({
            isOpen: true,
            title: newStatus === 'confirmed' ? 'Accept Order?' : 'Reject Order?',
            message: newStatus === 'confirmed' ? 'This order will start cooking.' : 'This order will be cancelled.',
            confirmText: newStatus === 'confirmed' ? 'Accept' : 'Reject',
            isDangerous: newStatus !== 'confirmed',
            action: async () => {
                try {
                    const { error } = await supabase
                        .from('bookings')
                        .update({ status: newStatus })
                        .eq('id', id)
                    
                    if (error) throw error
                    
                    // Optimistic UI Removal
                    setOrders(prev => prev.filter(o => o.id !== id))
                    
                    // If no more pending, sound stops via useEffect
                    toast.success(newStatus === 'confirmed' ? 'Order Accepted!' : 'Order Rejected')
                } catch (err) {
                    toast.error(err.message)
                }
            }
        })
    }

    // --- Sound Check Render ---
    if (isAuthenticated && !isSoundChecked) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-orange-500/10 animate-pulse pointer-events-none" />
                    
                    <Volume2 className="w-16 h-16 text-orange-500 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold text-white mb-2">Sound Check Required</h1>
                    <p className="text-zinc-400 mb-6 text-sm">
                        Please ensure your volume is at least 50%.<br/>
                        Click below to test the alert sound.
                    </p>

                    <div className="space-y-3">
                         <button 
                            onClick={() => {
                                playAlarm()
                                requestNotificationPermission()
                            }}
                            className="w-full bg-zinc-800 text-white font-bold py-3 rounded-xl hover:bg-zinc-700 transition"
                        >
                            Test Sound & Enable Alerts 🔊
                        </button>
                        <button 
                            onClick={() => {
                                stopAlarm()
                                setIsSoundChecked(true)
                            }}
                            className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl hover:bg-orange-500 transition shadow-lg shadow-orange-900/20"
                        >
                            I Can Hear It - Start Shift
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // --- Login Render ---
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                         <ChefHat className="w-8 h-8 text-orange-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Staff Access</h1>
                    <p className="text-zinc-500 mb-8 text-sm">Enter PIN code to continue</p>
                    
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input 
                            type="number" 
                            className="w-full bg-black border border-zinc-700 rounded-2xl p-4 text-center text-2xl text-white tracking-[1em] outline-none focus:border-orange-500 transition-colors appearance-none"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            maxLength={6}
                            placeholder="••••"
                        />
                         <button 
                            type="submit"
                            className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl hover:bg-orange-500 active:scale-95 transition-all"
                        >
                            {loading ? 'Checking...' : 'Enter Staff View'}
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    // --- Main Dashboard ---
    return (
        <div className="min-h-screen bg-black text-white p-4 pb-20 font-sans">
            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.action}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDangerous={confirmModal.isDangerous}
            />

            {printModal.isOpen && (
                <SlipModal 
                    booking={printModal.booking} 
                    type="kitchen"
                    onClose={() => setPrintModal({ isOpen: false, booking: null })}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-black/90 backdrop-blur py-4 z-10 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div onClick={handleLogout} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors">
                        <ChefHat className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Staff View</h1>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                             <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                            {isConnected ? 'System Live' : 'Reconnecting...'}
                        </div>
                    </div>
                </div>
                {/* Manual Refresh / Reconnect */}
                <div className="flex gap-2">
                    {orders.length > 0 && isPlaying && (
                        <button onClick={stopAlarm} className="p-2 bg-red-500/20 text-red-500 rounded-full animate-pulse">
                            <Volume2 className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={fetchOrders} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {orders.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 gap-4">
                    <Bell className="w-16 h-16 opacity-20" />
                    <p className="text-lg">No pending orders</p>
                    <p className="text-xs opacity-50">System is listening...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => (
                        <div key={order.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 relative overflow-hidden">
                             {/* Flashing Border for new orders */}
                             <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50 animate-pulse" />
                             
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-4 pb-4 border-b border-white/5">
                                <div>
                                    <div className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                                        {order.tables_layout?.table_name || 'Pickup'}
                                        {order.status === 'pending' && <span className="flex h-3 w-3 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>}
                                    </div>
                                    <div className="flex items-center gap-2 text-orange-400 text-sm font-medium">
                                        <Clock className="w-4 h-4" />
                                        {formatTime(order.booking_date, order.booking_time)}
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <div className="text-xs text-zinc-500 mb-1">#{order.id.slice(0, 4)}</div>
                                    <button 
                                        onClick={() => setPrintModal({ isOpen: true, booking: order })}
                                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-xs mb-1"
                                    >
                                        <Printer size={14} /> Print Kitchen
                                    </button>
                                </div>
                            </div>

                            {/* Order Items */}
                            <div className="space-y-3 mb-6">
                                {order.order_items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start text-sm">
                                        <div className="flex gap-3">
                                            <div className="bg-zinc-800 w-6 h-6 flex items-center justify-center rounded text-xs font-bold shrink-0 text-white">
                                                {item.quantity}x
                                            </div>
                                            <div>
                                                <div className="text-zinc-200 font-medium">{item.menu_items?.name}</div>
                                                {item.selected_options && (
                                                    <div className="text-zinc-500 text-xs mt-0.5">
                                                        {item.selected_options.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {order.customer_note && (
                                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-red-200 text-xs mt-3 flex gap-2">
                                        <span className="font-bold">Note:</span> {order.customer_note}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => updateStatus(order.id, 'cancelled')}
                                    className="py-4 rounded-xl bg-zinc-800 text-zinc-400 font-bold flex items-center justify-center gap-2 hover:bg-zinc-700 active:scale-95 transition-all"
                                >
                                    <X className="w-5 h-5" />
                                    Reject
                                </button>
                                <button 
                                    onClick={() => updateStatus(order.id, 'confirmed')}
                                    className="py-4 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-green-500 active:scale-95 transition-all shadow-lg shadow-green-900/20 animate-pulse-slow"
                                >
                                    <Check className="w-5 h-5" />
                                    Accept Order
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
