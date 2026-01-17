import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'

const OrderContext = createContext()

const initialState = {
    orders: [], // Live pending orders
    scheduleOrders: [], // Confirmed/Seated/Ready
    historyOrders: [],
    loading: true,
    isConnected: false,
    soundUrl: null
}

function orderReducer(state, action) {
    switch(action.type) {
        case 'SET_ORDERS': return { ...state, orders: action.payload }
        case 'SET_SCHEDULE': return { ...state, scheduleOrders: action.payload }
        case 'SET_HISTORY': return { ...state, historyOrders: action.payload }
        case 'SET_LOADING': return { ...state, loading: action.payload }
        case 'SET_CONNECTED': return { ...state, isConnected: action.payload }
        case 'SET_SOUND_URL': return { ...state, soundUrl: action.payload }
        case 'UPDATE_ORDER_STATUS': {
            const { id, status } = action.payload
            // Simple optimistic update helper if needed, but we usually fetch fresh
            return state 
        }
        default: return state
    }
}

export function OrderProvider({ children }) {
    const [state, dispatch] = useReducer(orderReducer, initialState)
    const fetchDebounceRef = useRef({})

    // Init Sound URL
    useEffect(() => {
        const init = async () => {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'alert_sound_url').single()
            if (data?.value) dispatch({ type: 'SET_SOUND_URL', payload: data.value })
        }
        init()
    }, [])

    // --- Actions ---
    const fetchLiveOrders = useCallback(async (silent = false) => {
        if (!silent) dispatch({ type: 'SET_LOADING', payload: true })
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`*, promotion_codes (code), order_items (quantity, selected_options, price_at_time, menu_items (name))`)
                .eq('status', 'pending')
                .order('booking_time', { ascending: true })
            
            if (error) throw error
            dispatch({ type: 'SET_ORDERS', payload: data || [] })
        } catch (err) {
            console.error(err)
        } finally {
            if (!silent) dispatch({ type: 'SET_LOADING', payload: false })
        }
    }, [])

    const fetchScheduleOrders = useCallback(async () => {
        dispatch({ type: 'SET_LOADING', payload: true })
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`*, promotion_codes (code), order_items (quantity, selected_options, price_at_time, menu_items (name))`)
                .in('status', ['confirmed', 'ready', 'seated'])
                .order('booking_time', { ascending: true })
            
            if (error) throw error
            dispatch({ type: 'SET_SCHEDULE', payload: data || [] })
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false })
        }
    }, [])

    const fetchHistoryOrders = useCallback(async (dateStr) => {
        // dateStr format: YYYY-MM-DD
        if (!dateStr) return
        dispatch({ type: 'SET_LOADING', payload: true })
        try {
            // Start of day
            const start = `${dateStr}T00:00:00`
            // End of day
            const end = `${dateStr}T23:59:59`

            const { data, error } = await supabase
                .from('bookings')
                .select(`*, promotion_codes (code), order_items (quantity, selected_options, price_at_time, menu_items (name))`)
                .in('status', ['completed', 'cancelled', 'void']) // Include COMPLETED as requested
                .gte('booking_time', start)
                .lte('booking_time', end)
                .order('booking_time', { ascending: false })
            
            if (error) throw error
            dispatch({ type: 'SET_HISTORY', payload: data || [] })
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false })
        }
    }, [])
    
    const stateRef = useRef(state)
    useEffect(() => { stateRef.current = state }, [state])

    // --- Realtime Logic ---
    const fetchAndAddOrder = async (orderId, isNew, triggerAlertCallback) => {
        const { data: fullOrder } = await supabase
            .from('bookings')
            .select(`*, tracking_token, tables_layout (table_name), promotion_codes (code), order_items (quantity, selected_options, price_at_time, menu_items (name))`)
            .eq('id', orderId)
            .single()

        if (!fullOrder) return

        const currentOrders = stateRef.current.orders
        dispatch({ type: 'SET_ORDERS', payload: [...currentOrders.filter(o => o.id !== fullOrder.id), fullOrder].sort((a,b) => a.booking_time.localeCompare(b.booking_time)) })
        
        // Refresh Schedule if needed
        if (['confirmed', 'ready', 'seated'].includes(fullOrder.status)) fetchScheduleOrders()

        if (isNew && fullOrder.status === 'pending' && triggerAlertCallback) {
             triggerAlertCallback(fullOrder)
        }
    }

    const subscribeRealtime = (triggerAlertCallback) => {
        const channel = supabase
           .channel('staff-orders')
           .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, 
               async (payload) => {
                   const { eventType, new: newRecord, old: oldRecord } = payload
                   if (eventType === 'INSERT') {
                       // Debounce queue with isNew=true
                       if (fetchDebounceRef.current[newRecord.id]) clearTimeout(fetchDebounceRef.current[newRecord.id].timeout)
                       fetchDebounceRef.current[newRecord.id] = {
                           isNew: true,
                           timeout: setTimeout(() => fetchAndAddOrder(newRecord.id, true, triggerAlertCallback), 800)
                       }
                   } else if (eventType === 'UPDATE') {
                        // Check if status changed to cancelled/completed -> remove from local
                        if (['completed', 'cancelled', 'void'].includes(newRecord.status)) {
                            const currentOrders = stateRef.current.orders
                            dispatch({ type: 'SET_ORDERS', payload: currentOrders.filter(o => o.id !== newRecord.id) })
                            fetchScheduleOrders()
                        } else {
                            if (fetchDebounceRef.current[newRecord.id]) clearTimeout(fetchDebounceRef.current[newRecord.id].timeout)
                            fetchDebounceRef.current[newRecord.id] = {
                               isNew: false,
                               timeout: setTimeout(() => fetchAndAddOrder(newRecord.id, false, triggerAlertCallback), 800)
                            }
                        }
                   }
               }
           )
           .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, payload => {
               const bookingId = payload.new?.booking_id || payload.old?.booking_id
               if (bookingId) {
                   if (fetchDebounceRef.current[bookingId]) clearTimeout(fetchDebounceRef.current[bookingId].timeout)
                   // Inherit isNew if exists
                   const isNew = fetchDebounceRef.current[bookingId]?.isNew || false
                   fetchDebounceRef.current[bookingId] = {
                       isNew,
                       timeout: setTimeout(() => fetchAndAddOrder(bookingId, isNew, triggerAlertCallback), 800)
                   }
               }
           })
           .subscribe(status => {
               if (status === 'SUBSCRIBED') dispatch({ type: 'SET_CONNECTED', payload: true })
               else dispatch({ type: 'SET_CONNECTED', payload: false })
           })
        return channel
    }

    const performUpdateStatus = async (id, newStatus) => {
        try {
            const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', id)
            if (error) throw error
            
            // Optimistic update
            const isFinished = ['completed', 'cancelled', 'void'].includes(newStatus)
            
            const newOrders = state.orders.filter(o => o.id !== id)
            const newSchedule = state.scheduleOrders.map(o => o.id === id ? { ...o, status: newStatus } : o).filter(o => !isFinished || newStatus === 'completed' && false /* Actually schedule removes completed too? in Logic yes */)

            // If confirmed, move from Live to Schedule logic handled by fetch or re-fetch
            // For now, simpler to jus re-fetch or let realtime handle it?
            // Let's rely on fetch for data consistency
            fetchLiveOrders(true)
            fetchScheduleOrders()

            return { success: true }
        } catch (error) {
            console.error(error)
            return { success: false, error: error.message }
        }
    }

    return (
        <OrderContext.Provider value={{
            ...state,
            fetchLiveOrders,
            fetchScheduleOrders,
            fetchHistoryOrders,
            subscribeRealtime,
            updateStatus: performUpdateStatus
        }}>
            {children}
        </OrderContext.Provider>
    )
}

export const useOrderContext = () => useContext(OrderContext)
