import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'
import SlipModal from './components/shared/SlipModal'
import ViewSlipModal from './components/shared/ViewSlipModal'
import { Clock, Check, X, Bell, RefreshCw, ChefHat, Volume2, Printer, Calendar, List, History as HistoryIcon, LogOut, Download, Share, Home, Image as ImageIcon, Phone } from 'lucide-react'
import { useWakeLock } from './hooks/useWakeLock'
import { useAudioAlert } from './hooks/useAudioAlert'
import { toast } from 'sonner'
import ConfirmationModal from './components/ConfirmationModal'
import { formatThaiTimeOnly, formatThaiDateLong, formatThaiTime } from './utils/timeUtils'
import { usePushNotifications } from './hooks/usePushNotifications'

// --- PWA Components ---
const IOSInstallModal = ({ onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-[#1A1A1A] text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto">
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

// Global capture of install prompt
let globalDeferredPrompt = null

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        globalDeferredPrompt = e
    })
}

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(globalDeferredPrompt)
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

        // Android Prompt (Runtime Update)
        const handler = (e) => {
            e.preventDefault()
            setDeferredPrompt(e)
            globalDeferredPrompt = e
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
                className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 border border-transparent rounded-xl text-xs font-bold text-[#1A1A1A] transition-colors"
                type="button"
            >
                <Download size={14} />
                Install App
            </button>
            {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
        </>
    )
}

// Helper for formatting time (Moved to utils but kept here for existing render references if any, mapped to util)
// Helper Component for Options
// Helper Component for Options
const renderOrderOptions = (item, optionMap) => {
    let options = [];
    
    if (Array.isArray(item.selected_options)) {
        // [{name: 'Sweet', price: 0}, ...]
        options = item.selected_options.map(opt => 
            typeof opt === 'object' ? opt.name : opt
        );
    } else if (item.selected_options && typeof item.selected_options === 'object') {
        // Map of IDs
        const ids = Object.values(item.selected_options).flat();
        options = ids.map(id => optionMap[id] || id);
    }

    if (options.length === 0) return null;

    return (
        <div className="text-gray-500 text-sm mt-1 font-medium flex flex-col gap-0.5">
            {options.map((opt, i) => (
                <div key={i}>└ {opt}</div>
            ))}
        </div>
    );
};

// Helper for formatting time
const formatTime = (dateString, timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
}

// Thai Date Helper (Mapped to util)
const formatDateThai = (date) => formatThaiDateLong(date.toISOString())

export default function StaffOrderPage() {
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null, isDangerous: false })
    
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isSoundChecked, setIsSoundChecked] = useState(false) 
    const [pinInput, setPinInput] = useState('')
    
    // Data State
    const [activeTab, setActiveTab] = useState('live') // 'live' | 'history' | 'schedule'
    const [orders, setOrders] = useState([]) // Live pending orders
    const [scheduleOrders, setScheduleOrders] = useState([]) // Upcoming confirmed orders
    const [historyOrders, setHistoryOrders] = useState([]) // History orders
    const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]) // YYYY-MM-DD
    const [loading, setLoading] = useState(true)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [isConnected, setIsConnected] = useState(true) 
    
    // Printing
    const [printModal, setPrintModal] = useState({ isOpen: false, booking: null })
    const [viewSlipUrl, setViewSlipUrl] = useState(null)

    // Locked Handlers
    const onLockRequest = useCallback(() => console.log('Screen locked!'), [])
    const onLockError = useCallback(() => console.error('Wake Lock error'), [])

    const { isSupported, isLocked, request, release } = useWakeLock({
        onRequest: onLockRequest,
        onError: onLockError
    })
    
    // Audio Hook
    const [soundUrl, setSoundUrl] = useState(null)
    const { play, stop, isPlaying, error: audioError } = useAudioAlert(soundUrl)
    const { isSubscribed, subscribeToPush, permission } = usePushNotifications()

    // Init Logic to get Sound URL
    useEffect(() => {
        const init = async () => {
            const savedAuth = localStorage.getItem('staff_auth')
            if (savedAuth === 'true') setIsAuthenticated(true)

            const { data } = await supabase.from('app_settings').select('value').eq('key', 'alert_sound_url').single()
            if (data?.value) {
                setSoundUrl(data.value)
            }
        }
        init()
    }, [])

    // --- Title Flashing for Background ---
    useEffect(() => {
        let interval
        if (orders.some(o => o.status === 'pending') && document.hidden) {
             let toggle = false
             interval = setInterval(() => {
                 document.title = toggle ? "🔔 🔔 🔔" : `(${orders.length}) New Order!`
                 toggle = !toggle
             }, 1000)
        } else {
            document.title = "Staff View | In The Haus"
        }
        return () => {
            if (interval) clearInterval(interval)
            document.title = "Staff View | In The Haus"
        }
    }, [orders]) // document.hidden is not reactive, but visibilitychange listener below can handle reset if needed, or rely on orders update.
    // Actually, we need to LISTEN to visibility change to start/stop flashing if orders exist.
    
    useEffect(() => {
        const handleVis = () => {
            if (!document.hidden) {
                document.title = "Staff View | In The Haus"
            }
        }
        document.addEventListener("visibilitychange", handleVis)
        return () => document.removeEventListener("visibilitychange", handleVis)
    }, [])

    // --- Debounce Helper ---
    const debounceRef = useRef(null)
    const debouncedFetchLiveOrders = (silent = false) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            fetchLiveOrders(silent)
        }, 500)
    }

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
                stop()
                clearInterval(pollInterval)
            }
        }
    }, [isAuthenticated, isSoundChecked]) 

    // Alarm Logic
    useEffect(() => {
        if (!isAuthenticated || !isSoundChecked) return
        if (orders.some(o => o.status === 'pending')) {
            play()
        } else {
            stop()
        }
    }, [orders, isAuthenticated, isSoundChecked, soundUrl, play, stop])
    
    // Handle Audio Error (Permissions)
    useEffect(() => {
        if (audioError) {
             toast.error(audioError, {
                 description: "Tap here to unmute",
                 action: { label: "Unmute", onClick: () => play() },
                 duration: Infinity
             })
        }
    }, [audioError, play])

    // Load History or Schedule when tab changes
    useEffect(() => {
        if (isAuthenticated) {
            if (activeTab === 'history') fetchHistoryOrders()
            if (activeTab === 'schedule') fetchScheduleOrders()
        }
    }, [isAuthenticated, activeTab, historyDate])




    // --- Notification ---
    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) return
        if (Notification.permission === 'default') await Notification.requestPermission()
    }

    const showSystemNotification = (title, body) => {
        if (Notification.permission === 'granted') {
            try {
                // Aggressive Notification Options for background visibility
                const options = {
                    body: body,
                    icon: '/icons/icon-192x192.png',
                    tag: 'new-order', // Replaces previous notification with same tag
                    renotify: true,   // Play sound/vibrate again even if replacing
                    requireInteraction: true, // Keep on screen until clicked (Chrome)
                    silent: false
                }

                // If Service Worker Registration is available, use it (More robust on Android)
                if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                     navigator.serviceWorker.ready.then(registration => {
                         registration.showNotification(title, options)
                     })
                } else {
                    // Fallback to standard API
                    const n = new Notification(title, options)
                    n.onclick = function(e) {
                        e.preventDefault()
                        window.focus()
                        n.close()
                    }
                }

            } catch (e) {
                console.error("Notification Error:", e)
            }
        }
    }

    // iOS Background Warning
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
                // We cannot send a toast while hidden effectively, but we can set title 
                console.log("App hidden: WebSocket may pause on iOS")
            }
        }
        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
    }, [])

    // --- Data Fetching ---
    const [optionMap, setOptionMap] = useState({})

    useEffect(() => {
        const fetchOptions = async () => {
            const { data } = await supabase.from('option_choices').select('id, name')
            if (data) {
                const map = data.reduce((acc, opt) => ({ ...acc, [opt.id]: opt.name }), {})
                setOptionMap(map)
            }
        }
        fetchOptions()
    }, [])

    const subscribeRealtime = () => {
         const channel = supabase
            .channel('staff-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, 
                async (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload
                    
                    if (eventType === 'INSERT') {
                        // New Order: Fetch & Add
                        await fetchAndAddOrder(newRecord.id, true)
                    } else if (eventType === 'UPDATE') {
                        // Status or Info Update: Fetch Single & Merge
                        // Optimisation: Only fetch if we are tracking this order or it should be in the list
                        // If status changed to something we don't show (e.g. cancelled/completed) -> Remove
                        if (['completed', 'cancelled', 'void'].includes(newRecord.status)) {
                            setOrders(prev => prev.filter(o => o.id !== newRecord.id))
                        } else {
                            // Status is pending/confirmed, update it
                            await fetchAndAddOrder(newRecord.id, false)
                        }
                    } else if (eventType === 'DELETE') {
                        setOrders(prev => prev.filter(o => o.id !== oldRecord.id))
                    }
                }
            )
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, () => {
                // If items added, we might need to refresh totals or item lists.
                // We can't easily know which booking ID from here without fetch.
                // Fallback to debounced refresh for item changes.
                debouncedFetchLiveOrders(true)
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setIsConnected(true)
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false)
            })
         return channel
    }

    const fetchAndAddOrder = async (orderId, isNew = false) => {
        const { data: fullOrder, error } = await supabase
            .from('bookings')
            .select(`*, tracking_token, tables_layout (table_name), promotion_codes (code), profiles (display_name, phone_number), order_items (quantity, selected_options, price_at_time, menu_items (name))`)
            .eq('id', orderId)
            .single()

        if (error || !fullOrder) return

        // Update State & Re-sort
        setOrders(prev => {
            let newOrders = [];
            const exists = prev.find(o => o.id === fullOrder.id)
            
            if (exists) {
                // Update existing
                // If status changed to confirmed, remove from 'orders' (Live) because it's now in Schedule
                if (fullOrder.status === 'confirmed') {
                    newOrders = prev.filter(o => o.id !== fullOrder.id)
                } else {
                    newOrders = prev.map(o => o.id === fullOrder.id ? fullOrder : o)
                }
            } else {
                // Add new
                if (['pending', 'confirmed', 'ready', 'seated'].includes(fullOrder.status)) {
                    newOrders = [...prev, fullOrder]
                } else {
                    return prev
                }
            }
            
            // Sort to ensure order
            return newOrders.sort((a, b) => a.booking_time.localeCompare(b.booking_time))
        })

        if (isNew && fullOrder.status === 'pending') {
             triggerNewOrderAlert(fullOrder)
        }
        
        // Refresh Schedule if confirmed or ready or seated
        if (['confirmed', 'ready', 'seated'].includes(fullOrder.status)) {
            fetchScheduleOrders()
        }
    }

    const triggerNewOrderAlert = (order) => {
        play() 
        const tableName = order.tables_layout?.table_name || 'Pickup'
        const price = order.total_amount
        showSystemNotification('มีรายการใหม่', `โต๊ะ: ${tableName} - ${price}.-`)
        toast.message(`โต๊ะ ${tableName} สั่งอาหารใหม่!`, {
            description: `${price} บาท`,
            duration: Infinity, 
            action: {
                label: 'รับออเดอร์ (Accept)',
                onClick: () => updateStatus(order.id, 'confirmed')
            },
        })
    }

    const fetchLiveOrders = async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            console.log("Fetching Live orders (pending only)...")

            const { data, error } = await supabase
                .from('bookings')
                .select(`*, tracking_token, tables_layout (table_name), promotion_codes (code), profiles (display_name, phone_number), order_items (quantity, selected_options, price_at_time, menu_items (name))`)
                .eq('status', 'pending')
                .order('booking_time', { ascending: true })
            
            if (error) {
                console.error("Supabase Fetch Error:", error)
                throw error
            }
            console.log("Pending Orders found:", data?.length, data)
            setOrders(data || [])
        } catch (err) {
            console.error(err)
            // Optional: toast.error("Unable to sync orders")
        } finally {
            if (!silent) setLoading(false)
        }
    }

    const fetchHistoryOrders = async () => {
        setHistoryLoading(true)
        try {
            const start = new Date(historyDate)
            start.setHours(0,0,0,0)
            const end = new Date(historyDate)
            end.setHours(23,59,59,999)

            const { data, error } = await supabase
                .from('bookings')
                .select(`*, tracking_token, tables_layout (table_name), promotion_codes (code), profiles (display_name), order_items (quantity, selected_options, price_at_time, menu_items (name))`)
                .neq('status', 'pending')
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .order('created_at', { ascending: false })
            
            if (error) throw error
            setHistoryOrders(data || [])
        } catch (err) {
            toast.error('โหลดประวัติไม่สำเร็จ')
        } finally {
            setHistoryLoading(false)
        }
    }

    const fetchScheduleOrders = async () => {
        setLoading(true)
        try {
            // Fetch all confirmed orders (active tables)
            const { data, error } = await supabase
                .from('bookings')
                .select(`*, tracking_token, tables_layout (table_name), promotion_codes (code), profiles (display_name, phone_number), order_items (quantity, selected_options, price_at_time, menu_items (name))`)
                .in('status', ['confirmed', 'ready', 'seated'])
                .order('booking_time', { ascending: true })
            
            if (error) throw error
            setScheduleOrders(data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
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
        stop()
    }

    const updateStatus = async (id, newStatus) => {
        // If clicking Accept from toast, we might not need modal if we want speed.
        // But let's keep modal logic for manual clicks. 
        // Logic: if called from toast, it's instant? No, `updateStatus` opens modal.
        // Let's modify: `updateStatus` opens modal. 
        // If we want instant accept from Toast, we need a separate function or param.
        // Let's keep safety for now: even from Toast, open the modal or just do it?
        // User said: "Press Accept immediately". Usually implies direct action.
        // I will make a separate `quickConfirm` function for the Toast.
        
        const isConfirm = newStatus === 'confirmed'
        const isReady = newStatus === 'ready'
        const isSeated = newStatus === 'seated'
        const isComplete = newStatus === 'completed' 
        const isDangerous = newStatus === 'cancelled' || newStatus === 'void'

        setConfirmModal({
            isOpen: true,
            title: isConfirm ? 'รับออเดอร์?' : (isReady ? 'ออเดอร์พร้อมส่ง?' : (isSeated ? 'ลูกค้าเข้าโต๊ะ (Check-in)?' : (isComplete ? 'จบรายการ (Complete)?' : 'ปฏิเสธรายการ?'))),
            message: isConfirm ? 'ส่งรายการเข้าครัว' : (isReady ? 'แจ้งลูกค้าว่าอาหารพร้อมแล้ว' : (isSeated ? 'เริ่มจับเวลาโต๊ะ' : (isComplete ? 'จบรายการและเคลียร์โต๊ะ/ส่งมอบอาหาร' : 'ยกเลิกรายการนี้ถาวร'))),
            confirmText: isConfirm ? 'ยืนยัน (Accept)' : (isReady ? 'พร้อมส่ง (Ready)' : (isSeated ? 'เช็คอิน (Check-in)' : (isComplete ? 'จบรายการ (Complete)' : 'ปฏิเสธ (Reject)'))),
            isDangerous: isDangerous,
            action: async () => {
                await performUpdate(id, newStatus, isConfirm)
            }
        })
    }

    const performUpdate = async (id, newStatus, isConfirm) => {
        try {
            const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', id)
            if (error) throw error
            
            setOrders(prev => prev.filter(o => o.id !== id))
            // Instant update for Schedule view as well
            if (newStatus === 'completed' || newStatus === 'cancelled' || newStatus === 'void') {
                setScheduleOrders(prev => prev.filter(o => o.id !== id))
            } else {
                 // If status updated to something else (e.g. ready), update the item in schedule
                 setScheduleOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))
            }
            
            toast.success(isConfirm ? 'รับออเดอร์เรียบร้อย' : 'บันทึกสถานะเรียบร้อย')
            if (activeTab === 'history') fetchHistoryOrders()
        } catch (err) {
            toast.error(err.message)
        }
    }

    // Quick Accept for Toast (Bypasses Modal if desired, currently sticking to modal to be safe, 
    // OR calling performUpdate directly)
    // The Toast action `onClick` calls `updateStatus`. 
    // If we want direct accept:
    // Change Toast action to `() => performUpdate(newOrder.id, 'confirmed', true)`
    // Let's do direct accept for speed as requested.
    
    // Update subscribeRealtime logic above ^ to use performUpdate? 
    // Wait, performUpdate needs to be defined before usage or use `useCallback` / be available in scope.
    // It's inside the component, so it's fine. 
    // CAREFUL: subscribeRealtime is defined BEFORE performUpdate in current code flow if I copy-paste sequentially.
    // I need to hoist `performUpdate` or move `subscribeRealtime` down. Or use function declarations.
    // I'll move `performUpdate` up.

    // --- VIEWS ---

    // 1. Sound Check
    if (isAuthenticated && !isSoundChecked) {
        return (
            <div className="min-h-screen bg-[#F4F4F4] flex flex-col items-center justify-center p-6 font-sans text-[#1A1A1A] safe-area-inset-bottom">
                <div className="bg-white border border-gray-200 p-8 rounded-2xl w-full max-w-sm text-center shadow-sm relative overflow-hidden">
                     <button 
                         onClick={() => {
                                sessionStorage.setItem('skip_staff_redirect', 'true')
                                window.location.href = '/'
                         }}
                         className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors z-10"
                         title="Exit to Customer View"
                     >
                         <Home className="w-5 h-5" />
                     </button>

                    <Volume2 className="w-16 h-16 text-[#1A1A1A] mx-auto mb-6" />
                    <h1 className="text-2xl font-bold mb-2">Sound Check</h1>
                    <p className="text-gray-500 mb-8 text-sm">
                        กรุณาเปิดเสียงอุปกรณ์ให้ดังที่สุด<br/>
                        System Notification requires permission.
                    </p>

                    <div className="space-y-3">
                         <button 
                            onClick={() => { play(); requestNotificationPermission(); }}
                            className="w-full bg-white border border-gray-200 text-[#1A1A1A] font-bold py-3 rounded-xl hover:bg-gray-50 transition"
                        >
                            Test Sound & Permission
                        </button>
                        <button 
                            onClick={() => { stop(); setIsSoundChecked(true); }}
                            className="w-full bg-[#1A1A1A] text-white font-bold py-4 rounded-xl hover:bg-black transition shadow-lg shadow-black/10"
                        >
                            Start Work
                        </button>
                    </div>

                    <div className="mt-8 text-left space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="flex gap-2 items-start">
                            <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">iOS</span>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                <strong>ระวังจอดับ:</strong> หากพับหน้าจอ Apple จะตัดการเชื่อมต่อ แนะนำให้เปิดจิค้างไว้ หรือใช้โหมด <em>Guided Access</em>
                            </p>
                        </div>
                        <div className="flex gap-2 items-start">
                            <span className="text-xs font-bold bg-red-100 text-red-800 px-1.5 py-0.5 rounded">Sound</span>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                <strong>ปิดโหมดเงียบ (Silent Mode):</strong> บน iPhone ต้องสับสวิตช์ข้างเครื่องให้เป็นโหมดเปิดเสียง จึงจะได้ยินเสียงแจ้งเตือน
                            </p>
                        </div>
                        <div className="flex gap-2 items-start">
                             <span className="text-xs font-bold bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Android</span>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                ระบบทำงานเบื้องหลังได้ดี แต่ควรปิดโหมดประหยัดพลังงาน
                            </p>
                        </div>
                    </div>
                    
                    <InstallPrompt />
                </div>
            </div>
        )
    }

    // 2. Login
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#F4F4F4] flex flex-col items-center justify-center p-6 font-sans text-[#1A1A1A] safe-area-inset-bottom">
                <div className="bg-white border border-gray-200 p-8 rounded-2xl w-full max-w-sm text-center shadow-sm relative overflow-hidden">
                     <button 
                         onClick={() => {
                                sessionStorage.setItem('skip_staff_redirect', 'true')
                                window.location.href = '/'
                         }}
                         className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors z-10"
                         title="Exit to Customer View"
                     >
                         <Home className="w-5 h-5" />
                     </button>

                    <div className="w-12 h-12 bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-6">
                         <ChefHat className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Staff Login</h1>
                    <p className="text-gray-500 mb-8 text-sm">Enter Access PIN</p>
                    
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input 
                            type="number" 
                            className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-gray-200 rounded-xl p-4 text-center text-3xl font-bold text-[#1A1A1A] tracking-[1em] outline-none transition-all placeholder:tracking-normal placeholder:font-normal placeholder:text-gray-300"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            maxLength={6}
                            placeholder="••••"
                        />
                         <button 
                            type="submit"
                            className="w-full bg-[#1A1A1A] text-white font-bold py-4 rounded-xl hover:bg-black active:scale-95 transition-all shadow-md shadow-black/10"
                        >
                            {loading ? 'Verifying...' : 'Access'}
                        </button>
                    </form>

                    <InstallPrompt />
                </div>
            </div>
        )
    }

    // 3. Main Dashboard
    return (
        <div className="min-h-screen bg-[#F4F4F4] text-[#1A1A1A] p-4 pb-20 font-sans">
            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.action}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDangerous={confirmModal.isDangerous}
            />

            {/* Offline Sticky Banner */}
            {!isConnected && (
                <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 z-[9999] font-bold text-sm shadow-md flex items-center justify-center gap-2">
                    <X className="w-4 h-4" />
                    OFFLINE: Check Internet Connection
                </div>
            )}
            
            {/* AUDITORY & VISUAL ALERT OVERLAY */}
            {isAuthenticated && orders.some(o => o.status === 'pending') && (
                <div className="fixed inset-0 pointer-events-none z-[50] flex items-center justify-center">
                    <div className="absolute inset-0 bg-red-500/10 animate-pulse border-[6px] border-red-500/50"></div>
                </div>
            )}

            {printModal.isOpen && (
                <SlipModal 
                    booking={printModal.booking} 
                    type="kitchen"
                    onClose={() => setPrintModal({ isOpen: false, booking: null })}
                />
            )}

            {viewSlipUrl && (
                <ViewSlipModal 
                    url={viewSlipUrl.startsWith('http') ? viewSlipUrl : supabase.storage.from('slips').getPublicUrl(viewSlipUrl).data.publicUrl} 
                    onClose={() => setViewSlipUrl(null)} 
                />
            )}

            {/* Header */}
            <div className={`flex flex-col gap-4 mb-6 sticky z-20 pt-2 bg-[#F4F4F4]/95 backdrop-blur-sm -mx-4 px-4 pb-4 border-b border-gray-200 ${!isConnected ? 'top-8' : 'top-0'} transition-all`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#1A1A1A] text-white rounded-full flex items-center justify-center shadow-md">
                            <ChefHat className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Orders</h1>
                        </div>
                    </div>
                     <div className="flex gap-2">
                        {!isSubscribed && (
                            <button
                                onClick={subscribeToPush}
                                className="p-2.5 bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-600 text-gray-600 rounded-full transition-colors relative"
                                title="Enable Notifications"
                            >
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>
                        )}
                        <button 
                             onClick={() => {
                                    sessionStorage.setItem('skip_staff_redirect', 'true')
                                    window.location.href = '/'
                             }}
                             className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-full transition-colors"
                             title="Home"
                        >
                            <Home className="w-5 h-5" />
                        </button>
                        <button onClick={handleLogout} className="p-2.5 bg-white border border-gray-200 hover:bg-red-50 hover:border-red-100 hover:text-red-600 text-gray-600 rounded-full transition-colors">
                            <LogOut className="w-5 h-5" />
                        </button>
                     </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-200 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('live')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'live' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-[#1A1A1A]'}`}
                    >
                        <List className="w-4 h-4" />
                        Live
                        {orders.length > 0 && <span className="bg-[#1A1A1A] text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{orders.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('schedule')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'schedule' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-[#1A1A1A]'}`}
                    >
                        <Calendar className="w-4 h-4" />
                        Schedule
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-[#1A1A1A]'}`}
                    >
                        <HistoryIcon className="w-4 h-4" />
                        History
                    </button>
                </div>
            </div>

            {/* LIVE ORDERS VIEW */}
            {activeTab === 'live' && (
                <>
                    {/* Manual Refresh & Alert Control */}
                    <div className="flex justify-end mb-4 gap-2">
                        {isPlaying && (
                            <button onClick={stop} className="px-4 py-2 bg-[#1A1A1A] text-[#DFFF00] rounded-full text-xs font-bold animate-pulse flex items-center gap-2 shadow-md">
                                <Volume2 className="w-3 h-3" /> Stop Sound
                            </button>
                        )}
                        <button onClick={() => fetchLiveOrders()} className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-full text-xs font-bold flex items-center gap-1 transition-colors">
                            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Sync
                        </button>
                    </div>

                    {orders.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400 gap-4">
                            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                                <Bell className="w-10 h-10 opacity-40" />
                            </div>
                            <p className="text-lg font-medium text-gray-500">No Active Orders</p>
                            <p className="text-xs">Waiting for today's bookings...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {orders.map(order => (
                                <div key={order.id} className={`bg-white border-2 ${order.status === 'confirmed' ? 'border-[#1A1A1A]' : 'border-gray-200'} rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden group`}>
                                     {/* Flashing Border for new orders */}
                                     {order.status === 'pending' && <div className="absolute inset-x-0 top-0 h-1.5 bg-[#DFFF00] animate-pulse" />}
                                     
                                    {/* Card Header */}
                                    {/* Card Header Configured as requested: Short ID : Type */}
                                    <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
                                        <div>
                                            <div className="text-3xl font-black text-[#1A1A1A] mb-2 flex flex-wrap items-center gap-3">
                                                <span className="font-mono">
                                                    #{order.tracking_token ? order.tracking_token.slice(-4).toUpperCase() : order.id.slice(0, 4)}
                                                </span>
                                                <span className="text-gray-300">|</span>
                                                {order.booking_type === 'pickup' ? (
                                                     <span className="text-blue-600 flex items-center gap-2">
                                                        Pickup ({order.profiles?.display_name || order.profiles?.first_name ? `คุณ ${order.profiles.display_name || order.profiles.first_name}` : order.pickup_contact_name})
                                                     </span>
                                                ) : (
                                                    <span className="text-[#1A1A1A]">
                                                        Table {order.tables_layout?.table_name || order.table_id || '?'}
                                                    </span>
                                                )}
                                                
                                                {order.status === 'pending' && <span className="flex h-3 w-3 relative ml-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                                </span>}
                                                {order.status === 'confirmed' && <span className="bg-black text-white text-xs px-2 py-1 rounded-full font-bold ml-2">Active</span>}
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4" />
                                                    {formatTime(order.booking_date, order.booking_time)}
                                                </div>
                                                {(order.profiles?.phone_number || order.pickup_contact_phone) && (
                                                    <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs">
                                                        <Phone className="w-3 h-3" />
                                                        <a href={`tel:${order.profiles?.phone_number || order.pickup_contact_phone}`} className="hover:underline">
                                                            {order.profiles?.phone_number || order.pickup_contact_phone}
                                                        </a>
                                                    </div>
                                                )}
                                                
                                                {order.isOptimistic && <span className="text-orange-500 text-[10px] animate-pulse ml-2">(Syncing...)</span>}
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            {/* Removed old Short ID location */}
                                            <div className="flex gap-2">
                                                {order.payment_slip_url && (
                                                    <button 
                                                        onClick={() => setViewSlipUrl(order.payment_slip_url)}
                                                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full transition-colors flex items-center gap-2 text-xs font-bold"
                                                    >
                                                        <ImageIcon size={14} /> View Slip
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => setPrintModal({ isOpen: true, booking: order })}
                                                    disabled={order.isOptimistic}
                                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-[#1A1A1A] transition-colors flex items-center gap-2 text-xs font-bold disabled:opacity-50"
                                                >
                                                    <Printer size={14} /> Print Slip
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order Items */}
                                    <div className="space-y-4 mb-8">
                                        {order.order_items?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start text-sm">
                                                <div className="flex gap-4 w-full">
                                                    <div className="bg-[#1A1A1A] text-white w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold shrink-0 shadow-sm">
                                                        {item.quantity}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-[#1A1A1A] font-bold text-lg leading-tight">{item.menu_items?.name}</div>
                                                        {renderOrderOptions(item, optionMap)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {(!order.order_items || order.order_items.length === 0) && (
                                            <div className="text-gray-400 text-sm italic py-4 text-center bg-gray-50 rounded-xl">
                                                {order.isOptimistic ? 'Loading items...' : 'No items found'}
                                            </div>
                                        )}
                                        {order.customer_note && (
                                            <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl text-orange-800 text-sm mt-4 flex gap-3 items-start">
                                                <span className="font-bold shrink-0">Note:</span> {order.customer_note}
                                            </div>
                                        )}
                                        {/* Discount Display */}
                                        {(order.discount_amount > 0 || order.promotion_codes?.code) && (
                                            <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-green-800 text-sm mt-2 flex justify-between items-center">
                                                <span className="font-bold flex items-center gap-2">
                                                    <span className="bg-green-200 px-2 py-0.5 rounded text-xs">Promo</span>
                                                    {order.promotion_codes?.code || 'DISCOUNT'}
                                                </span>
                                                <span className="font-bold">-{order.discount_amount?.toLocaleString()}.-</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            onClick={() => updateStatus(order.id, 'cancelled')}
                                            className="py-4 rounded-xl bg-gray-100 text-gray-500 font-bold flex items-center justify-center gap-2 hover:bg-gray-200 hover:text-gray-700 active:scale-95 transition-all text-sm"
                                        >
                                            <X className="w-5 h-5" />
                                            Reject
                                        </button>
                                        <button 
                                            onClick={() => updateStatus(order.id, 'confirmed')}
                                            className="py-4 rounded-xl bg-[#1A1A1A] text-white font-bold flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all shadow-lg shadow-black/20 animate-pulse-slow text-sm"
                                        >
                                            <Check className="w-5 h-5" />
                                            Accept Order
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* SCHEDULE VIEW */}
            {activeTab === 'schedule' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 pb-20">
                     <div className="flex justify-between items-center mb-4 px-2">
                        <h2 className="font-bold text-lg">Upcoming Bookings</h2>
                        <button onClick={() => fetchScheduleOrders()} className="p-2 bg-white rounded-full border border-gray-200">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-20 opacity-50"><RefreshCw className="animate-spin w-8 h-8 mx-auto" /></div>
                    ) : scheduleOrders.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">No upcoming bookings</div>
                    ) : (
                        <div className="space-y-4">
                            {scheduleOrders.map((order, index) => {
                                const prevDate = index > 0 ? new Date(scheduleOrders[index-1].booking_time).toDateString() : null
                                const currDateObj = new Date(order.booking_time)
                                const currDate = currDateObj.toDateString()
                                const showHeader = prevDate !== currDate

                                return (
                                    <div key={order.id}>
                                        {showHeader && (
                                            <div className="sticky top-[140px] z-10 bg-[#E5E5E5]/95 backdrop-blur px-4 py-2 rounded-lg font-bold text-[#1A1A1A] text-sm mb-3 shadow-sm mx-4 border border-white/20">
                                                <Calendar className="inline-block w-4 h-4 mr-2 mb-0.5" />
                                                {formatDateThai(currDateObj)}
                                            </div>
                                        )}
                                        
                                        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:border-[#1A1A1A] transition-all duration-300">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                     <div className="text-3xl font-black text-[#1A1A1A] mb-1">
                                                        #{order.tracking_token ? order.tracking_token.slice(-4).toUpperCase() : order.id.slice(0, 4)}
                                                     </div>
                                                     <div className="text-lg font-bold text-gray-700 mb-2">
                                                         {order.profiles?.display_name || order.pickup_contact_name || order.customer_name || 'Guest User'}
                                                     </div>
                                                     
                                                     <div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-600 mb-3 space-y-1">
                                                         <div className="flex justify-between">
                                                             <span className="text-gray-400">Created:</span>
                                                             <span className="font-mono font-medium">{formatThaiTime(order.created_at)}</span>
                                                         </div>
                                                         <div className="flex justify-between">
                                                             <span className="text-gray-400">Scheduled:</span>
                                                             <span className="font-mono font-bold text-[#1A1A1A]">{formatThaiTime(order.booking_time)}</span>
                                                         </div>
                                                         <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                                                             <span className="text-gray-400">Location:</span>
                                                             <span className="font-bold text-[#1A1A1A]">
                                                                 {order.booking_type === 'pickup' ? 'Pickup Order' : `Table ${order.tables_layout?.table_name || '?'}`}
                                                             </span>
                                                         </div>
                                                     </div>

                                                     {(order.profiles?.phone_number || order.pickup_contact_phone) && (
                                                        <div className="flex items-center gap-1 text-blue-600 text-xs mb-3 font-medium">
                                                            <Phone className="w-3 h-3" />
                                                            <a href={`tel:${order.profiles?.phone_number || order.pickup_contact_phone}`} className="hover:underline">
                                                                {order.profiles?.phone_number || order.pickup_contact_phone}
                                                            </a>
                                                        </div>
                                                     )}
                                                     
                                                     <div className="flex flex-wrap gap-2">
                                                         {order.booking_type === 'pickup' ? (
                                                             <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded-md border border-blue-100">
                                                                 Pickup
                                                             </span>
                                                         ) : (
                                                             <>
                                                                <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded-md border border-gray-200">
                                                                    Dine-in
                                                                </span>
                                                                {order.pax && (
                                                                     <span className="bg-orange-50 text-orange-700 text-xs font-bold px-2 py-1 rounded-md border border-orange-100">
                                                                         {order.pax} Guests
                                                                     </span>
                                                                )}
                                                             </>
                                                         )}
                                                         <span className={`${['ready', 'seated'].includes(order.status) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'} text-xs font-bold px-2 py-1 rounded-md border`}>
                                                             {order.status === 'ready' ? 'READY' : (order.status === 'seated' ? 'SEATED' : (order.status === 'confirmed' ? 'CONFIRMED' : order.status))}
                                                         </span>
                                                     </div>
                                                </div>
                                                
                                                <div className="flex flex-col gap-2">
                                                    {order.booking_type === 'pickup' ? (
                                                        // 2-Step for Pickup
                                                        <>
                                                            {order.status === 'confirmed' && (
                                                                <button 
                                                                    onClick={() => updateStatus(order.id, 'ready')}
                                                                    className="p-3 bg-orange-100 rounded-xl hover:bg-orange-200 transition-colors text-orange-700 font-bold shadow-sm active:scale-95 border border-orange-200"
                                                                    title="Mark as Ready (Cooking Done)"
                                                                >
                                                                    <ChefHat size={18} />
                                                                </button>
                                                            )}
                                                            {order.status === 'ready' && (
                                                                <button 
                                                                    onClick={() => updateStatus(order.id, 'completed')}
                                                                    className="p-3 bg-green-100 rounded-xl hover:bg-green-200 transition-colors text-green-700 font-bold shadow-sm active:scale-95 border border-green-200 animate-pulse"
                                                                    title="Complete Order (Picked Up)"
                                                                >
                                                                    <Check size={18} />
                                                                </button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        // 2-Step for Dine-in
                                                        <>
                                                            {order.status === 'confirmed' && (
                                                                <button 
                                                                    onClick={() => updateStatus(order.id, 'seated')}
                                                                    className="p-3 bg-blue-100 rounded-xl hover:bg-blue-200 transition-colors text-blue-700 font-bold shadow-sm active:scale-95 border border-blue-200"
                                                                    title="Check-in Customer (Seated)"
                                                                >
                                                                    <Check size={18} />
                                                                </button>
                                                            )}
                                                            {order.status === 'seated' && (
                                                                <button 
                                                                    onClick={() => updateStatus(order.id, 'completed')}
                                                                    className="p-3 bg-[#DFFF00] rounded-xl hover:bg-[#ccff00] transition-colors text-[#1A1A1A] font-bold shadow-md active:scale-95 border border-black/5"
                                                                    title="Clear Table / Complete Order"
                                                                >
                                                                    <LogOut size={18} />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    
                                                    <button 
                                                        onClick={() => setPrintModal({ isOpen: true, booking: order })}
                                                        className="p-3 bg-gray-50 rounded-xl hover:bg-[#1A1A1A] hover:text-white transition-colors text-gray-600 shadow-sm"
                                                    >
                                                        <Printer size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Pre-order items summary if needed */}
                                            {order.order_items?.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-gray-100">
                                                    <div className="text-xs text-gray-400 font-bold mb-2 uppercase tracking-wider">Pre-order Items</div>
                                                    <div className="space-y-1">
                                                        {order.order_items.map((item, i) => (
                                                        <div key={i} className="flex flex-col text-sm text-gray-600 mb-2">
                                                            <div className="flex justify-between">
                                                                <span>{item.quantity}x {item.menu_items?.name}</span>
                                                            </div>
                                                            {renderOrderOptions(item, optionMap)}
                                                        </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'history' && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                    {/* Date Picker */}
                    <div className="bg-white border border-gray-200 p-4 rounded-2xl mb-4 flex items-center justify-between shadow-sm">
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
                        <div className="text-center py-20 text-gray-400">No finished orders</div>
                    ) : (
                        <div className="space-y-3">
                            {historyOrders.map(order => (
                                <div key={order.id} className="bg-white border border-gray-200 p-4 rounded-2xl flex items-center justify-between group hover:border-[#1A1A1A] transition-colors">
                                    <div>
                                        <div className="font-bold text-lg mb-0.5 flex items-center gap-2">
                                            {order.tables_layout?.table_name || 'Pickup'}
                                            <span className="text-xs font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                                 #{order.tracking_token ? order.tracking_token.slice(-4).toUpperCase() : order.id.slice(0, 4)}
                                            </span>
                                            {(() => {
                                                const getStatusConfig = (s) => {
                                                    switch(s) {
                                                        case 'completed': return { label: 'Completed', color: 'bg-green-100 text-green-800' }
                                                        case 'cancelled': return { label: 'Cancel', color: 'bg-red-100 text-red-800' }
                                                        case 'void': return { label: 'VOID', color: 'bg-red-100 text-red-800 font-black' }
                                                        case 'confirmed': return { label: 'Active', color: 'bg-blue-100 text-blue-800' }
                                                        default: return { label: s, color: 'bg-gray-100 text-gray-600' }
                                                    }
                                                }
                                                const config = getStatusConfig(order.status)
                                                return (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wide ${config.color}`}>
                                                        {config.label}
                                                    </span>
                                                )
                                            })()}
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono">
                                            {formatTime(order.booking_date, order.booking_time)} • {order.total_amount}.-
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {order.payment_slip_url && (
                                            <button 
                                                onClick={() => setViewSlipUrl(order.payment_slip_url)}
                                                className="p-3 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-colors text-blue-600"
                                            >
                                                <ImageIcon size={18} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setPrintModal({ isOpen: true, booking: order })}
                                            className="p-3 bg-gray-50 rounded-xl hover:bg-[#1A1A1A] hover:text-white transition-colors text-gray-600"
                                        >
                                            <Printer size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}


            <div className="mt-8 mb-4 max-w-sm mx-auto">
                <InstallPrompt />
            </div>
        </div>
    )
}
