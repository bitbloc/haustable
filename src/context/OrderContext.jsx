/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'

const OrderContext = createContext()

const initialState = {
    orders: [], // Live pending orders
    scheduleOrders: [], // Confirmed / Seated / Ready orders
    historyOrders: [],
    loading: true,
    isConnected: false,
    soundUrl: null,
    kdsSoundUrl: null
}

function orderReducer(state, action) {
    switch(action.type) {
        case 'SET_ORDERS': return { ...state, orders: action.payload }
        case 'SET_SCHEDULE': return { ...state, scheduleOrders: action.payload }
        case 'SET_HISTORY': return { ...state, historyOrders: action.payload }
        case 'SET_LOADING': return { ...state, loading: action.payload }
        case 'SET_CONNECTED': return { ...state, isConnected: action.payload }
        case 'SET_SOUND_URL': return { ...state, soundUrl: action.payload.pos, kdsSoundUrl: action.payload.kds }
        case 'UPDATE_ORDER_STATUS': {
            const { id, status } = action.payload
            const isFinished = ['completed', 'cancelled', 'void'].includes(status)
            return {
                ...state,
                orders: state.orders.filter(o => o.id !== id),
                scheduleOrders: isFinished 
                    ? state.scheduleOrders.filter(o => o.id !== id)
                    : state.scheduleOrders.map(o => o.id === id ? { ...o, status } : o)
            }
        }
        case 'TOGGLE_ITEM_CHECK': {
            const { itemId, isChecked } = action.payload
            const updateList = (list) => list.map(order => ({
                ...order,
                order_items: order.order_items?.map(item => item.id === itemId ? { ...item, is_checked: isChecked } : item)
            }))
            return {
                ...state,
                orders: updateList(state.orders),
                scheduleOrders: updateList(state.scheduleOrders)
            }
        }
        default: return state
    }
}

export function OrderProvider({ children }) {
    const [state, dispatch] = useReducer(orderReducer, initialState)
    const fetchDebounceRef = useRef({})
    const stateRef = useRef(state)
    useEffect(() => { stateRef.current = state }, [state])

    // Init Sound URLs
    useEffect(() => {
        const init = async () => {
            const { data } = await supabase.from('app_settings').select('key, value').in('key', ['alert_sound_url', 'kds_alert_sound_url'])
            if (data) {
                const posSound = data.find(d => d.key === 'alert_sound_url')?.value
                const kdsSound = data.find(d => d.key === 'kds_alert_sound_url')?.value
                dispatch({ type: 'SET_SOUND_URL', payload: { pos: posSound, kds: kdsSound } })
            }
        }
        init()
    }, [])

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
            dispatch({ type: 'SET_ORDERS', payload: data || [] })
        } catch (err) {
            console.error('Error fetching live orders:', err)
        } finally {
            if (!silent) dispatch({ type: 'SET_LOADING', payload: false })
        }
    }, [])

    const fetchScheduleOrders = useCallback(async () => {
        dispatch({ type: 'SET_LOADING', payload: true })
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`*, tables_layout (table_name), promotion_codes (code), order_items (id, quantity, selected_options, price_at_time, is_checked, menu_items (name, category_id))`)
                .in('status', ['confirmed', 'ready', 'seated'])
                .order('booking_time', { ascending: true })
            
            if (error) throw error
            dispatch({ type: 'SET_SCHEDULE', payload: data || [] })
        } catch (err) {
            console.error('Error fetching schedule orders:', err)
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false })
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

    // --- Realtime Logic ---
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
                dispatch({ 
                    type: 'SET_ORDERS', 
                    payload: [...currentOrders.filter(o => o.id !== fullOrder.id), fullOrder].sort((a,b) => a.booking_time.localeCompare(b.booking_time)) 
                })
            } else {
                dispatch({ 
                    type: 'SET_ORDERS', 
                    payload: stateRef.current.orders.filter(o => o.id !== fullOrder.id) 
                })
            }

            if (isSchedule) {
                const currentSchedule = stateRef.current.scheduleOrders
                dispatch({ 
                    type: 'SET_SCHEDULE', 
                    payload: [...currentSchedule.filter(o => o.id !== fullOrder.id), fullOrder].sort((a,b) => a.booking_time.localeCompare(b.booking_time)) 
                })
            } else if (isFinished) {
                dispatch({ 
                    type: 'SET_SCHEDULE', 
                    payload: stateRef.current.scheduleOrders.filter(o => o.id !== fullOrder.id) 
                })
            }

            if (isNew && triggerAlertCallback) {
                triggerAlertCallback(fullOrder)
            }
        } catch (err) {
            console.error('fetchAndAddOrder error:', err)
        }
    }, [])

    const subscribeRealtime = useCallback((triggerAlertCallback) => {
        const channel = supabase
           .channel('staff-kds-realtime')
           .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, 
               async (payload) => {
                   const { eventType, new: newRecord } = payload
                   if (eventType === 'INSERT') {
                       if (fetchDebounceRef.current[newRecord.id]) clearTimeout(fetchDebounceRef.current[newRecord.id].timeout)
                       fetchDebounceRef.current[newRecord.id] = {
                           isNew: true,
                           timeout: setTimeout(() => fetchAndAddOrder(newRecord.id, true, triggerAlertCallback), 250)
                       }
                   } else if (eventType === 'UPDATE') {
                        if (['completed', 'cancelled', 'void'].includes(newRecord.status)) {
                            dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: newRecord.id, status: newRecord.status } })
                        } else {
                            if (fetchDebounceRef.current[newRecord.id]) clearTimeout(fetchDebounceRef.current[newRecord.id].timeout)
                            fetchDebounceRef.current[newRecord.id] = {
                               isNew: false,
                               timeout: setTimeout(() => fetchAndAddOrder(newRecord.id, false, triggerAlertCallback), 250)
                            }
                        }
                   }
               }
           )
           .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, payload => {
               const bookingId = payload.new?.booking_id || payload.old?.booking_id
               if (bookingId) {
                   if (fetchDebounceRef.current[bookingId]) clearTimeout(fetchDebounceRef.current[bookingId].timeout)
                   const isNew = fetchDebounceRef.current[bookingId]?.isNew || false
                   fetchDebounceRef.current[bookingId] = {
                       isNew,
                       timeout: setTimeout(() => fetchAndAddOrder(bookingId, isNew, triggerAlertCallback), 250)
                   }
               }
           })
           .subscribe(status => {
               if (status === 'SUBSCRIBED') dispatch({ type: 'SET_CONNECTED', payload: true })
               else dispatch({ type: 'SET_CONNECTED', payload: false })
           })
        return channel
    }, [fetchAndAddOrder])

    const performUpdateStatus = async (id, newStatus) => {
        // Immediate Optimistic Update
        dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id, status: newStatus } })

        try {
            const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', id)
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.error('Status update failed:', error)
            toast.error('Failed to update status: ' + error.message)
            fetchLiveOrders(true)
            fetchScheduleOrders()
            return { success: false, error: error.message }
        }
    }

    const updateOrderItemCheck = async (itemId, isChecked) => {
        // Immediate Optimistic Update
        dispatch({ type: 'TOGGLE_ITEM_CHECK', payload: { itemId, isChecked } })

        try {
            const { error } = await supabase.from('order_items').update({ is_checked: isChecked }).eq('id', itemId)
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.error('Order item check failed:', error)
            // Rollback
            dispatch({ type: 'TOGGLE_ITEM_CHECK', payload: { itemId, isChecked: !isChecked } })
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
            updateStatus: performUpdateStatus,
            updateOrderItemCheck
        }}>
            {children}
        </OrderContext.Provider>
    )
}

export const useOrderContext = () => useContext(OrderContext)
