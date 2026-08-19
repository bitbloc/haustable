/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isOnline, kdsCache, addToOfflineQueue, syncOfflineQueue } from '../utils/offlineHelper'
import { toast } from 'sonner'

const OrderContext = createContext()

const initialLiveOrders = kdsCache.getLiveOrders()
const initialScheduleOrders = kdsCache.getScheduleOrders()

const initialState = {
    orders: initialLiveOrders, // Live pending orders (Instant Cache Hydration)
    scheduleOrders: initialScheduleOrders, // Confirmed / Seated / Ready orders
    historyOrders: [],
    loading: initialLiveOrders.length === 0 && initialScheduleOrders.length === 0,
    connectionState: isOnline() ? 'reconnecting' : 'offline', // 'live' | 'polling' | 'offline' | 'reconnecting'
    isConnected: isOnline(), // Backward compatibility boolean
    lastSyncTime: null,
    missedOrdersCount: 0,
    soundUrl: null,
    kdsSoundUrl: null
}

function orderReducer(state, action) {
    switch(action.type) {
        case 'SET_ORDERS': {
            const orders = action.payload || []
            kdsCache.setLiveOrders(orders)
            return { ...state, orders, lastSyncTime: new Date().toISOString() }
        }
        case 'SET_SCHEDULE': {
            const scheduleOrders = action.payload || []
            kdsCache.setScheduleOrders(scheduleOrders)
            return { ...state, scheduleOrders, lastSyncTime: new Date().toISOString() }
        }
        case 'SET_HISTORY': return { ...state, historyOrders: action.payload }
        case 'SET_LOADING': return { ...state, loading: action.payload }
        case 'SET_CONNECTION_STATE': {
            const connectionState = action.payload
            const isConnected = ['live', 'polling'].includes(connectionState)
            return { ...state, connectionState, isConnected }
        }
        case 'SET_MISSED_COUNT': return { ...state, missedOrdersCount: action.payload }
        case 'SET_SOUND_URL': return { ...state, soundUrl: action.payload.pos, kdsSoundUrl: action.payload.kds }
        case 'UPDATE_ORDER_STATUS': {
            const { id, status } = action.payload
            const isFinished = ['completed', 'cancelled', 'void'].includes(status)
            const updatedOrders = state.orders.filter(o => o.id !== id)
            const updatedSchedule = isFinished 
                ? state.scheduleOrders.filter(o => o.id !== id)
                : state.scheduleOrders.map(o => o.id === id ? { ...o, status } : o)
            
            kdsCache.setLiveOrders(updatedOrders)
            kdsCache.setScheduleOrders(updatedSchedule)
            return {
                ...state,
                orders: updatedOrders,
                scheduleOrders: updatedSchedule
            }
        }
        case 'TOGGLE_ITEM_CHECK': {
            const { itemId, isChecked } = action.payload
            const updateList = (list) => list.map(order => ({
                ...order,
                order_items: order.order_items?.map(item => item.id === itemId ? { ...item, is_checked: isChecked } : item)
            }))
            const updatedOrders = updateList(state.orders)
            const updatedSchedule = updateList(state.scheduleOrders)
            kdsCache.setLiveOrders(updatedOrders)
            kdsCache.setScheduleOrders(updatedSchedule)
            return {
                ...state,
                orders: updatedOrders,
                scheduleOrders: updatedSchedule
            }
        }
        default: return state
    }
}

export function OrderProvider({ children }) {
    const [state, dispatch] = useReducer(orderReducer, initialState)
    const fetchDebounceRef = useRef({})
    const stateRef = useRef(state)
    const channelRef = useRef(null)
    const pollingTimerRef = useRef(null)
    const reconnectTimerRef = useRef(null)
    const retryCountRef = useRef(0)
    const alertCallbackRef = useRef(null)
    const knownOrderIdsRef = useRef(new Set([
        ...initialLiveOrders.map(o => o.id),
        ...initialScheduleOrders.map(o => o.id)
    ]))

    useEffect(() => { 
        stateRef.current = state 
        const currentIds = new Set([
            ...state.orders.map(o => o.id),
            ...state.scheduleOrders.map(o => o.id)
        ])
        knownOrderIdsRef.current = currentIds
    }, [state])


    // --- Actions ---
    const fetchLiveOrders = useCallback(async (silent = false) => {
        if (!silent) dispatch({ type: 'SET_LOADING', payload: true })
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`*, tables_layout (table_name), promotion_codes (code), order_items (id, quantity, selected_options, price_at_time, is_checked, menu_items (name, category_id))`)
                .eq('status', 'pending')
                .order('booking_time', { ascending: true })
            
            if (error) throw error
            const liveOrders = data || []
            dispatch({ type: 'SET_ORDERS', payload: liveOrders })
            return liveOrders
        } catch (err) {
            console.error('Error fetching live orders:', err)
            return null
        } finally {
            if (!silent) dispatch({ type: 'SET_LOADING', payload: false })
        }
    }, [])

    const fetchScheduleOrders = useCallback(async (silent = false) => {
        if (!silent) dispatch({ type: 'SET_LOADING', payload: true })
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`*, tables_layout (table_name), promotion_codes (code), order_items (id, quantity, selected_options, price_at_time, is_checked, menu_items (name, category_id))`)
                .in('status', ['confirmed', 'ready', 'seated'])
                .order('booking_time', { ascending: true })
            
            if (error) throw error
            const scheduleOrders = data || []
            dispatch({ type: 'SET_SCHEDULE', payload: scheduleOrders })
            return scheduleOrders
        } catch (err) {
            console.error('Error fetching schedule orders:', err)
            return null
        } finally {
            if (!silent) dispatch({ type: 'SET_LOADING', payload: false })
        }
    }, [])

    const fetchHistoryOrders = useCallback(async (dateStr) => {
        if (!dateStr) return
        dispatch({ type: 'SET_LOADING', payload: true })
        try {
            const start = `${dateStr}T00:00:00+07:00`
            const end = `${dateStr}T23:59:59+07:00`

            const { data, error } = await supabase
                .from('bookings')
                .select(`*, tables_layout (table_name), promotion_codes (code), order_items (id, quantity, selected_options, price_at_time, is_checked, menu_items (name, category_id))`)
                .in('status', ['completed', 'cancelled', 'void'])
                .gte('booking_time', start)
                .lte('booking_time', end)
                .order('booking_time', { ascending: false })
            
            if (error) throw error
            dispatch({ type: 'SET_HISTORY', payload: data || [] })
        } catch (err) {
            console.error('Error fetching history orders:', err)
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false })
        }
    }, [])

    // --- Realtime Single-Record Sync Helper ---
    const fetchAndAddOrder = useCallback(async (orderId, isNew, triggerAlertCallback) => {
        try {
            const { data: fullOrder } = await supabase
                .from('bookings')
                .select(`*, tracking_token, tables_layout (table_name), promotion_codes (code), order_items (id, quantity, selected_options, price_at_time, is_checked, menu_items (name, category_id))`)
                .eq('id', orderId)
                .single()

            if (!fullOrder) return

            const isPending = fullOrder.status === 'pending'
            const isSchedule = ['confirmed', 'ready', 'seated'].includes(fullOrder.status)
            const isFinished = ['completed', 'cancelled', 'void'].includes(fullOrder.status)

            if (isPending) {
                const currentOrders = stateRef.current.orders
                const updated = [...currentOrders.filter(o => o.id !== fullOrder.id), fullOrder].sort((a,b) => (a.booking_time || '').localeCompare(b.booking_time || ''))
                dispatch({ type: 'SET_ORDERS', payload: updated })
            } else {
                dispatch({ 
                    type: 'SET_ORDERS', 
                    payload: stateRef.current.orders.filter(o => o.id !== fullOrder.id) 
                })
            }

            if (isSchedule) {
                const currentSchedule = stateRef.current.scheduleOrders
                const updated = [...currentSchedule.filter(o => o.id !== fullOrder.id), fullOrder].sort((a,b) => (a.booking_time || '').localeCompare(b.booking_time || ''))
                dispatch({ type: 'SET_SCHEDULE', payload: updated })
            } else if (isFinished) {
                dispatch({ 
                    type: 'SET_SCHEDULE', 
                    payload: stateRef.current.scheduleOrders.filter(o => o.id !== fullOrder.id) 
                })
            }

            if (isNew) {
                // Synchronously add to known IDs to prevent polling race condition
                knownOrderIdsRef.current.add(fullOrder.id)
                if (triggerAlertCallback) {
                    triggerAlertCallback(fullOrder)
                }
            }
        } catch (err) {
            console.error('fetchAndAddOrder error:', err)
        }
    }, [])

    // --- Dual-Rail Polling & Realtime Connection Engine ---
    const stopPolling = useCallback(() => {
        if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current)
            pollingTimerRef.current = null
        }
    }, [])

    const startPolling = useCallback(() => {
        stopPolling()
        // Run silent polling every 8 seconds
        pollingTimerRef.current = setInterval(async () => {
            if (!isOnline()) return
            try {
                const [liveData, scheduleData] = await Promise.all([
                    fetchLiveOrders(true),
                    fetchScheduleOrders(true)
                ])

                // Check for new orders during polling
                if (liveData && alertCallbackRef.current) {
                    const newOrders = liveData.filter(o => !knownOrderIdsRef.current.has(o.id))
                    if (newOrders.length > 0) {
                        newOrders.forEach(o => {
                            knownOrderIdsRef.current.add(o.id)
                            alertCallbackRef.current(o)
                        })
                    }
                }
            } catch (pollErr) {
                console.warn('[Adaptive Polling Error]:', pollErr)
            }
        }, 8000)
    }, [fetchLiveOrders, fetchScheduleOrders, stopPolling])

    const cleanupChannel = useCallback(() => {
        if (channelRef.current) {
            try {
                supabase.removeChannel(channelRef.current)
            } catch (e) {
                console.warn('Error removing channel:', e)
            }
            channelRef.current = null
        }
    }, [])

    const setupRealtimeChannel = useCallback((triggerAlertCallback) => {
        if (triggerAlertCallback) {
            alertCallbackRef.current = triggerAlertCallback
        }
        cleanupChannel()

        if (!isOnline()) {
            dispatch({ type: 'SET_CONNECTION_STATE', payload: 'offline' })
            stopPolling()
            return
        }

        const channelName = `staff-kds-${Date.now()}`
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, 
                async (payload) => {
                    const { eventType, new: newRecord } = payload
                    if (eventType === 'INSERT') {
                        // Immediately register ID to prevent polling race
                        knownOrderIdsRef.current.add(newRecord.id)
                        if (fetchDebounceRef.current[newRecord.id]) clearTimeout(fetchDebounceRef.current[newRecord.id].timeout)
                        fetchDebounceRef.current[newRecord.id] = {
                            isNew: true,
                            timeout: setTimeout(() => fetchAndAddOrder(newRecord.id, true, alertCallbackRef.current), 250)
                        }
                    } else if (eventType === 'UPDATE') {
                        if (['completed', 'cancelled', 'void'].includes(newRecord.status)) {
                            dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: newRecord.id, status: newRecord.status } })
                        } else {
                            if (fetchDebounceRef.current[newRecord.id]) clearTimeout(fetchDebounceRef.current[newRecord.id].timeout)
                            fetchDebounceRef.current[newRecord.id] = {
                                isNew: false,
                                timeout: setTimeout(() => fetchAndAddOrder(newRecord.id, false, alertCallbackRef.current), 250)
                            }
                        }
                    }
                }
            )
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, payload => {
                const bookingId = payload.new?.booking_id || payload.old?.booking_id
                if (bookingId) {
                    const isNewItem = payload.eventType === 'INSERT'
                    if (fetchDebounceRef.current[bookingId]) clearTimeout(fetchDebounceRef.current[bookingId].timeout)
                    const isNew = isNewItem || fetchDebounceRef.current[bookingId]?.isNew || false
                    fetchDebounceRef.current[bookingId] = {
                        isNew,
                        timeout: setTimeout(() => fetchAndAddOrder(bookingId, isNew, alertCallbackRef.current), 250)
                    }
                }
            })
            .subscribe(status => {
                console.log(`[KDS Realtime Status]: ${status}`)
                if (status === 'SUBSCRIBED') {
                    retryCountRef.current = 0
                    dispatch({ type: 'SET_CONNECTION_STATE', payload: 'live' })
                    stopPolling()
                    // Re-sync in case an order arrived right before channel subscribed
                    fetchLiveOrders(true)
                    fetchScheduleOrders(true)
                } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
                    if (isOnline()) {
                        console.warn(`[KDS Realtime] WebSocket ${status}. Activating adaptive polling fallback.`);
                        dispatch({ type: 'SET_CONNECTION_STATE', payload: 'polling' })
                        startPolling()

                        // Schedule auto-reconnect with exponential backoff & jitter
                        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
                        const backoff = Math.min(1000 * Math.pow(1.5, retryCountRef.current) + Math.random() * 500, 15000)
                        retryCountRef.current += 1
                        reconnectTimerRef.current = setTimeout(() => {
                            setupRealtimeChannel(alertCallbackRef.current)
                        }, backoff)
                    } else {
                        dispatch({ type: 'SET_CONNECTION_STATE', payload: 'offline' })
                        stopPolling()
                    }
                }
            })

        channelRef.current = channel
        return channel
    }, [cleanupChannel, fetchAndAddOrder, fetchLiveOrders, fetchScheduleOrders, startPolling, stopPolling])

    // Manual Reconnect Trigger
    const reconnect = useCallback(async () => {
        dispatch({ type: 'SET_CONNECTION_STATE', payload: 'reconnecting' })
        retryCountRef.current = 0
        if (isOnline()) {
            await syncOfflineQueue()
            setupRealtimeChannel(alertCallbackRef.current)
            await Promise.all([fetchLiveOrders(true), fetchScheduleOrders(true)])
            toast.success('เชื่อมต่อระบบและซิงค์ออเดอร์ล่าสุดเรียบร้อยแล้ว')
        } else {
            dispatch({ type: 'SET_CONNECTION_STATE', payload: 'offline' })
            toast.warning('ยังไม่มีสัญญาณอินเทอร์เน็ต กำลังทำงานด้วยแคชในเครื่อง')
        }
    }, [fetchLiveOrders, fetchScheduleOrders, setupRealtimeChannel])

    // Online / Offline & Visibility Change Listeners
    useEffect(() => {
        const handleOnline = async () => {
            console.log('[KDS Network] Network restored online. Catch-up syncing...')
            dispatch({ type: 'SET_CONNECTION_STATE', payload: 'reconnecting' })
            await syncOfflineQueue()
            setupRealtimeChannel(alertCallbackRef.current)
            await Promise.all([fetchLiveOrders(true), fetchScheduleOrders(true)])
        }

        const handleOffline = () => {
            console.log('[KDS Network] Network disconnected. Working offline.')
            dispatch({ type: 'SET_CONNECTION_STATE', payload: 'offline' })
            stopPolling()
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isOnline()) {
                console.log('[KDS Focus] Tab became active. Refreshing live orders...')
                fetchLiveOrders(true)
                fetchScheduleOrders(true)
                if (stateRef.current.connectionState !== 'live') {
                    setupRealtimeChannel(alertCallbackRef.current)
                }
            }
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', handleVisibilityChange)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleVisibilityChange)
            stopPolling()
            cleanupChannel()
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        }
    }, [cleanupChannel, fetchLiveOrders, fetchScheduleOrders, setupRealtimeChannel, stopPolling])

    // --- Optimistic Actions (Offline-First) ---
    const performUpdateStatus = async (id, newStatus, staffRemark) => {
        // Immediate Optimistic Update
        dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id, status: newStatus } })

        if (!isOnline()) {
            addToOfflineQueue('update_order_status', { bookingId: id, status: newStatus, staffRemark })
            toast.info('บันทึกในเครื่องแล้ว (จะซิงค์ขึ้นระบบเมื่อออนไลน์)')
            return { success: true, offline: true }
        }

        try {
            const updatePayload = { status: newStatus }
            if (staffRemark) updatePayload.staff_remark = staffRemark
            const { error } = await supabase.from('bookings').update(updatePayload).eq('id', id)
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.warn('Status update network issue, adding to offline queue:', error)
            addToOfflineQueue('update_order_status', { bookingId: id, status: newStatus, staffRemark })
            toast.info('บันทึกในเครื่องแล้ว (จะซิงค์ขึ้นระบบอัตโนมัติ)')
            return { success: true, offline: true }
        }
    }

    const updateOrderItemCheck = async (itemId, isChecked) => {
        // Immediate Optimistic Update
        dispatch({ type: 'TOGGLE_ITEM_CHECK', payload: { itemId, isChecked } })

        if (!isOnline()) {
            addToOfflineQueue('toggle_item_check', { itemId, isChecked })
            return { success: true, offline: true }
        }

        try {
            const { error } = await supabase.from('order_items').update({ is_checked: isChecked }).eq('id', itemId)
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.warn('Item check network issue, adding to offline queue:', error)
            addToOfflineQueue('toggle_item_check', { itemId, isChecked })
            return { success: true, offline: true }
        }
    }

    const subscribeRealtime = useCallback((triggerAlertCallback) => {
        setupRealtimeChannel(triggerAlertCallback)
        return () => {
            cleanupChannel()
            stopPolling()
        }
    }, [cleanupChannel, setupRealtimeChannel, stopPolling])

    return (
        <OrderContext.Provider value={{
            ...state,
            fetchLiveOrders,
            fetchScheduleOrders,
            fetchHistoryOrders,
            subscribeRealtime,
            reconnect,
            updateStatus: performUpdateStatus,
            updateOrderItemCheck
        }}>
            {children}
        </OrderContext.Provider>
    )
}

export const useOrderContext = () => useContext(OrderContext)
