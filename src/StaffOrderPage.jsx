import { useState, useRef, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Clock, Check, X, Bell, RefreshCw, ChefHat, Volume2, Printer, Calendar, List, History as HistoryIcon, LogOut, Download, Share } from 'lucide-react'
import { useWakeLock } from './hooks/useWakeLock'
import { useToast } from './context/ToastContext'
import ConfirmationModal from './components/ConfirmationModal'
import SlipModal from './components/shared/SlipModal'

// --- PWA Components ---
const IOSInstallModal = ({ onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
        <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-[#1A1A1A] text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                <Share className="w-6 h-6 text-blue-500" />
            </div>
            <div>
                <h3 className="font-bold text-lg">Install on iOS</h3>
                <p className="text-gray-500 text-sm mt-2">
                    Tap the <span className="font-bold">Share</span> button and select <span className="font-bold">"Add to Home Screen"</span>
                </p>
                <p className="text-gray-500 text-sm mt-1">
                    (กดปุ่มแชร์ แล้วเลือก "เพิ่มไปยังหน้าจอโฮม")
                </p>
            </div>
            <div className="pt-2">
                 <button onClick={onClose} className="w-full py-3 bg-[#1A1A1A] text-white font-bold rounded-xl text-sm">
                     Understood
                 </button>
            </div>
        </div>
    </div>
)

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null)
    const [isIOS, setIsIOS] = useState(false)
    const [showIOSModal, setShowIOSModal] = useState(false)
    const [isInstalled, setIsInstalled] = useState(false)

    useEffect(() => {
        // iOS Check
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
        setIsIOS(isIosDevice)

        // Standalone Check
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
            setIsInstalled(true)
        }

        // Android Prompt
        const handler = (e) => {
            e.preventDefault()
            setDeferredPrompt(e)
        }
        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    if (isInstalled) return null
    if (!isIOS && !deferredPrompt) return null

    const handleInstall = () => {
        if (isIOS) {
            setShowIOSModal(true)
        } else if (deferredPrompt) {
            deferredPrompt.prompt()
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    setDeferredPrompt(null)
                }
            })
        }
    }

    return (
        <>
            <button 
                onClick={handleInstall}
                className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-white/40 border border-white/40 rounded-2xl text-xs font-bold text-[#1A1A1A] hover:bg-white/60 transition-colors"
                type="button"
            >
                <Download size={14} />
                Install App for easier access
            </button>
            {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
        </>
    )
}

// Helper for formatting time
const formatTime = (dateString, timeString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

// Thai Date Helper
const formatDateThai = (date) => {
    return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    })
}

export default function StaffOrderPage() {
    const { toast } = useToast()
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null, isDangerous: false })
    
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isSoundChecked, setIsSoundChecked] = useState(false) 
    const [pinInput, setPinInput] = useState('')
    
    // Data State
    const [activeTab, setActiveTab] = useState('live') // 'live' | 'history'
    const [orders, setOrders] = useState([]) // Live pending orders
    const [historyOrders, setHistoryOrders] = useState([]) // History orders
    const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]) // YYYY-MM-DD
    const [loading, setLoading] = useState(true)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [isConnected, setIsConnected] = useState(true) 
    
    // Printing
    const [printModal, setPrintModal] = useState({ isOpen: false, booking: null })

    const { isSupported, isLocked, request, release } = useWakeLock({
        onRequest: () => console.log('Screen locked!'),
        onRelease: () => console.log('Screen unlocked!'),
        onError: () => console.error('Wake Lock error')
    })
    
    // Audio Refs
    const audioRef = useRef(new Audio())
    const [soundUrl, setSoundUrl] = useState(null)
    const [isPlaying, setIsPlaying] = useState(false)

    // Init
    useEffect(() => {
        const init = async () => {
            const savedAuth = localStorage.getItem('staff_auth')
            if (savedAuth === 'true') setIsAuthenticated(true)

            const { data } = await supabase.from('app_settings').select('value').eq('key', 'alert_sound_url').single()
            if (data?.value) {
                setSoundUrl(data.value)
                audioRef.current.src = data.value
                audioRef.current.loop = true
            }
        }
        init()
    }, [])

    // Authenticated Setup
    useEffect(() => {
        let pollInterval
        if (isAuthenticated && isSoundChecked) {
            fetchLiveOrders()
            const channel = subscribeRealtime()
            if (isSupported) request()

            // Poll every 10s
            pollInterval = setInterval(() => {
                fetchLiveOrders(true)
            }, 10000)

            return () => {
                supabase.removeChannel(channel)
                if (isLocked) release()
                stopAlarm()
                clearInterval(pollInterval)
            }
        }
    }, [isAuthenticated, isSoundChecked])

    // Load History when tab/date changes
    useEffect(() => {
        if (isAuthenticated && activeTab === 'history') {
            fetchHistoryOrders()
        }
    }, [isAuthenticated, activeTab, historyDate])

    // Alarm Logic
    useEffect(() => {
        if (!isAuthenticated || !isSoundChecked) return
        if (orders.some(o => o.status === 'pending')) {
            if (!isPlaying && soundUrl) playAlarm()
        } else {
            stopAlarm()
        }
    }, [orders, isAuthenticated, isSoundChecked, soundUrl])

    // --- Audio Control ---
    const playAlarm = () => {
        if (!audioRef.current.src && soundUrl) audioRef.current.src = soundUrl
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
             playPromise.then(() => setIsPlaying(true)).catch(e => console.error(e))
        }
    }

    const stopAlarm = () => {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
    }

    // --- Notification ---
    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) return
        if (Notification.permission === 'default') await Notification.requestPermission()
    }

    const showSystemNotification = (title, body) => {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: '/icons/icon-192x192.png',
                vibrate: [200, 100, 200]
            })
        }
    }

    // --- Data Fetching ---
    const subscribeRealtime = () => {
         const channel = supabase
            .channel('staff-orders')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, 
                async (payload) => {
                    const newOrder = payload.new
                    if (newOrder.status === 'pending') {
                        playAlarm()
                        showSystemNotification('มีรายการใหม่', `โต๊ะ: ${newOrder.table_id || '?'} - ${newOrder.total_amount}.-`)
                        toast.success('มีออเดอร์ใหม่เข้ามา!')
                        // Optimistic Update
                        setOrders(prev => {
                            if (prev.find(o => o.id === newOrder.id)) return prev
                            return [...prev, { ...newOrder, isOptimistic: true }]
                        })
                        fetchLiveOrders()
                    }
                }
            )
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, () => fetchLiveOrders(true))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, () => {
                fetchLiveOrders(true)
                if (activeTab === 'history') fetchHistoryOrders()
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setIsConnected(true)
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false)
            })
         return channel
    }

    const fetchLiveOrders = async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`*, tables_layout (table_name), order_items (quantity, selected_options, price_at_time, menu_items (name))`)
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
            if (error) throw error
            setOrders(data || [])
        } catch (err) {
            console.error(err)
        } finally {
            if (!silent) setLoading(false)
        }
    }

    const fetchHistoryOrders = async () => {
        setHistoryLoading(true)
        try {
            // Filter by selected Date
            const start = new Date(historyDate)
            start.setHours(0,0,0,0)
            const end = new Date(historyDate)
            end.setHours(23,59,59,999)

            const { data, error } = await supabase
                .from('bookings')
                .select(`*, tables_layout (table_name), order_items (quantity, selected_options, price_at_time, menu_items (name))`)
                .neq('status', 'pending') // Not Pending
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .order('created_at', { ascending: false }) // Newest first for history
            
            if (error) throw error
            setHistoryOrders(data || [])
        } catch (err) {
            toast.error('โหลดประวัติไม่สำเร็จ')
        } finally {
            setHistoryLoading(false)
        }
    }

    // --- Actions ---
    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'staff_pin_code').single()
            const correctPin = data?.value || '0000'
            if (pinInput === correctPin) {
                setIsAuthenticated(true)
                localStorage.setItem('staff_auth', 'true')
            } else {
                toast.error('รหัส PIN ไม่ถูกต้อง')
                setPinInput('')
            }
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
        const isConfirm = newStatus === 'confirmed'
        setConfirmModal({
            isOpen: true,
            title: isConfirm ? 'รับออเดอร์?' : 'ปฏิเสธรายการ?',
            message: isConfirm ? 'ส่งรายการเข้าครัว' : 'ยกเลิกรายการนี้ถาวร',
            confirmText: isConfirm ? 'ยืนยัน (Accept)' : 'ปฏิเสธ (Reject)',
            isDangerous: !isConfirm,
            action: async () => {
                try {
                    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', id)
                    if (error) throw error
                    
                    setOrders(prev => prev.filter(o => o.id !== id))
                    toast.success(isConfirm ? 'รับออเดอร์เรียบร้อย' : 'ปฏิเสธรายการแล้ว')
                    // Refresh history if open
                    if (activeTab === 'history') fetchHistoryOrders()
                } catch (err) {
                    toast.error(err.message)
                }
            }
        })
    }

    // --- VIEWS ---

    // 1. Sound Check (Sage Theme)
    if (isAuthenticated && !isSoundChecked) {
        return (
            <div className="min-h-screen bg-[#BFCBC2] flex flex-col items-center justify-center p-4 font-sans text-[#1A1A1A] safe-area-inset-bottom">
                <div className="bg-white/60 backdrop-blur-xl border border-white/50 p-8 rounded-3xl w-full max-w-sm text-center shadow-xl relative overflow-hidden">
                    <Volume2 className="w-16 h-16 text-[#DFFF00] drop-shadow-sm mx-auto mb-6" fill="#1A1A1A" />
                    <h1 className="text-2xl font-bold mb-2">ตรวจสอบเสียงแจ้งเตือน</h1>
                    <p className="text-gray-600 mb-6 text-sm">
                        กรุณาเปิดเสียงอุปกรณ์ให้ดังกว่า 50%<br/>
                        กดทดสอบเพื่อฟังเสียงและอนุญาตการแจ้งเตือน
                    </p>

                    <div className="space-y-3">
                         <button 
                            onClick={() => { playAlarm(); requestNotificationPermission(); }}
                            className="w-full bg-white border border-gray-200 text-[#1A1A1A] font-bold py-3 rounded-xl hover:bg-gray-50 transition"
                        >
                            🔊 ทดสอบเสียง & เปิดแจ้งเตือน
                        </button>
                        <button 
                            onClick={() => { stopAlarm(); setIsSoundChecked(true); }}
                            className="w-full bg-[#1A1A1A] text-white font-bold py-4 rounded-xl hover:bg-black transition shadow-lg"
                        >
                            ได้ยินชัดเจน - เริ่มงาน
                        </button>
                    </div>
                    
                    <InstallPrompt />
                </div>
            </div>
        )
    }

    // 2. Login (Sage Theme)
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#BFCBC2] flex flex-col items-center justify-center p-4 font-sans text-[#1A1A1A] safe-area-inset-bottom">
                <div className="bg-white/60 backdrop-blur-xl border border-white/50 p-8 rounded-3xl w-full max-w-sm text-center shadow-xl">
                    <div className="w-16 h-16 bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-6">
                         <ChefHat className="w-8 h-8 text-[#DFFF00]" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">เข้าสู่ระบบพนักงาน</h1>
                    <p className="text-gray-600 mb-8 text-sm">กรอกรหัส PIN 4 หลัก</p>
                    
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input 
                            type="number" 
                            className="w-full bg-white/50 border border-white/60 rounded-2xl p-4 text-center text-3xl font-bold text-[#1A1A1A] tracking-[1em] outline-none focus:border-[#1A1A1A] transition-colors appearance-none placeholder:tracking-normal placeholder:font-normal placeholder:text-gray-400"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            maxLength={6}
                            placeholder="••••"
                        />
                         <button 
                            type="submit"
                            className="w-full bg-[#1A1A1A] text-white font-bold py-4 rounded-2xl hover:bg-black active:scale-95 transition-all"
                        >
                            {loading ? 'กำลังตรวจสอบ...' : 'เข้าใช้งาน'}
                        </button>
                    </form>

                    <InstallPrompt />
                </div>
            </div>
        )
    }

    // 3. Main Dashboard (Sage Theme)
    return (
        <div className="min-h-screen bg-[#BFCBC2] text-[#1A1A1A] p-4 pb-20 font-sans">
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
            <div className="flex flex-col gap-4 mb-6 sticky top-0 z-20 pt-2 bg-[#BFCBC2]/90 backdrop-blur-sm -mx-4 px-4 pb-4 border-b border-white/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#1A1A1A] text-[#DFFF00] rounded-full flex items-center justify-center">
                            <ChefHat className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">จัดการออเดอร์</h1>
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                                 <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-500'}`} />
                                {isConnected ? 'ระบบออนไลน์' : 'ขาดการเชื่อมต่อ'}
                            </div>
                        </div>
                    </div>
                     <button onClick={handleLogout} className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-white/40 p-1 rounded-2xl backdrop-blur-sm">
                    <button 
                        onClick={() => setActiveTab('live')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'live' ? 'bg-[#1A1A1A] text-white shadow-md' : 'text-gray-600 hover:bg-white/50'}`}
                    >
                        <List className="w-4 h-4" />
                        รายการสด 
                        {orders.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full ml-1">{orders.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-[#1A1A1A] text-white shadow-md' : 'text-gray-600 hover:bg-white/50'}`}
                    >
                        <HistoryIcon className="w-4 h-4" />
                        ประวัติวันนี้
                    </button>
                </div>
            </div>

            {/* LIVE ORDERS VIEW */}
            {activeTab === 'live' && (
                <>
                    {/* Manual Refresh & Alert Control */}
                    <div className="flex justify-end mb-4 gap-2">
                        {isPlaying && (
                            <button onClick={stopAlarm} className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-bold animate-pulse flex items-center gap-1">
                                <Volume2 className="w-3 h-3" /> ปิดเสียง
                            </button>
                        )}
                        <button onClick={() => fetchLiveOrders()} className="px-3 py-1 bg-white/50 hover:bg-white text-gray-600 rounded-full text-xs font-bold flex items-center gap-1">
                            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> รีเฟรช
                        </button>
                    </div>

                    {orders.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 gap-4">
                            <div className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center">
                                <Bell className="w-10 h-10 opacity-30" />
                            </div>
                            <p className="text-lg font-medium">ยังไม่มีออเดอร์ใหม่</p>
                            <p className="text-xs opacity-60">ระบบกำลังรอรับรายการ...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {orders.map(order => (
                                <div key={order.id} className={`bg-white/70 backdrop-blur-md border ${order.isOptimistic ? 'border-orange-500/50' : 'border-white/60'} rounded-3xl p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden`}>
                                     {/* Flashing Border for new orders */}
                                     {order.status === 'pending' && <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-100 animate-pulse" />}
                                     
                                    {/* Card Header */}
                                    <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200">
                                        <div>
                                            <div className="text-2xl font-black text-[#1A1A1A] mb-1 flex items-center gap-2">
                                                {order.tables_layout?.table_name || `โต๊ะ ${order.table_id || '?'}`}
                                                {order.status === 'pending' && <span className="flex h-3 w-3 relative">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                                </span>}
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                                <Clock className="w-4 h-4" />
                                                {formatTime(order.booking_date, order.booking_time)}
                                                {order.isOptimistic && <span className="text-orange-500 text-[10px] animate-pulse ml-2">(กำลังโหลด...)</span>}
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <div className="text-xs text-gray-400 mb-2">#{order.id.slice(0, 4)}</div>
                                            <button 
                                                onClick={() => setPrintModal({ isOpen: true, booking: order })}
                                                disabled={order.isOptimistic}
                                                className="px-3 py-1.5 bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 rounded-lg text-[#1A1A1A] transition-colors flex items-center gap-1.5 text-xs font-bold disabled:opacity-50"
                                            >
                                                <Printer size={14} /> พิมพ์ใบครัว
                                            </button>
                                        </div>
                                    </div>

                                    {/* Order Items */}
                                    <div className="space-y-3 mb-6">
                                        {order.order_items?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start text-sm">
                                                <div className="flex gap-3">
                                                    <div className="bg-[#1A1A1A] w-6 h-6 flex items-center justify-center rounded text-xs font-bold shrink-0 text-white">
                                                        {item.quantity}x
                                                    </div>
                                                    <div>
                                                        <div className="text-[#1A1A1A] font-bold">{item.menu_items?.name}</div>
                                                        {item.selected_options && (
                                                            <div className="text-gray-500 text-xs mt-0.5">
                                                                {item.selected_options.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {(!order.order_items || order.order_items.length === 0) && (
                                            <div className="text-gray-400 text-sm italic py-2 text-center">
                                                {order.isOptimistic ? 'กำลังดึงรายการอาหาร...' : 'ไม่มีรายการอาหาร'}
                                            </div>
                                        )}
                                        {order.customer_note && (
                                            <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-red-600 text-xs mt-3 flex gap-2">
                                                <span className="font-bold">หมายเหตุ:</span> {order.customer_note}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => updateStatus(order.id, 'cancelled')}
                                            className="py-4 rounded-xl bg-gray-200 text-gray-600 font-bold flex items-center justify-center gap-2 hover:bg-gray-300 active:scale-95 transition-all text-sm"
                                        >
                                            <X className="w-5 h-5" />
                                            ปฏิเสธ
                                        </button>
                                        <button 
                                            onClick={() => updateStatus(order.id, 'confirmed')}
                                            className="py-4 rounded-xl bg-[#1A1A1A] text-white font-bold flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all shadow-lg shadow-black/10 animate-pulse-slow text-sm"
                                        >
                                            <Check className="w-5 h-5" />
                                            รับออเดอร์
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* HISTORY VIEW */}
            {activeTab === 'history' && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                    {/* Date Picker */}
                    <div className="bg-white/60 backdrop-blur-lg p-4 rounded-2xl mb-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2 text-[#1A1A1A] font-bold">
                            <Calendar className="w-5 h-5" />
                            <span>{formatDateThai(new Date(historyDate))}</span>
                        </div>
                        <input 
                            type="date"
                            value={historyDate}
                            onChange={(e) => setHistoryDate(e.target.value)}
                            className="bg-transparent text-right outline-none font-medium text-gray-600"
                        />
                    </div>

                    {historyLoading ? (
                        <div className="text-center py-20 opacity-50"><RefreshCw className="animate-spin w-8 h-8 mx-auto" /></div>
                    ) : historyOrders.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">ไม่พบประวัติรายการในวันนี้</div>
                    ) : (
                        <div className="space-y-3">
                            {historyOrders.map(order => (
                                <div key={order.id} className="bg-white/50 border border-white/60 p-4 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-lg mb-0.5">
                                            {order.tables_layout?.table_name || 'Pickup'}
                                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${order.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {order.status === 'confirmed' ? 'รับแล้ว' : 'ยกเลิก'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {formatTime(order.booking_date, order.booking_time)} • {order.total_amount}.-
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setPrintModal({ isOpen: true, booking: order })}
                                        className="p-3 bg-white rounded-xl shadow-sm hover:bg-gray-50 transition text-[#1A1A1A]"
                                    >
                                        <Printer size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
