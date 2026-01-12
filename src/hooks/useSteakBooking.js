import { useReducer, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { toThaiISO } from '../utils/timeUtils'

const initialState = {
    step: 1,
    date: null,
    time: null,
    pax: 2,
    selectedTable: null,
    cart: [], // { id, name, price, doneness: { name, id }, quantity, options: {} }
    occasion: 'general', // general, birthday, anniversary, business
    winePreference: null, // { id, name, price, description } or null
    addCake: false,
    cakeDetail: '',
    addFlower: false,
    flowerDetail: '',
    
    specialRequest: '',
    dietaryRestrictions: '',
    
    // Config Prices (Loaded on mount/step)
    config: {
        cakePrice: 0,
        flowerPrice: 0
    },
    contactName: '',
    contactPhone: '',
    isAgreed: false,
    slipFile: null,
    isLoading: false,
    error: null,
    bookedTableIds: [], // For preventing double booking on table selection step
    bookedTableStatuses: {}, // Map of ID -> { type: 'walk_in'|'online' }
    tables: [] // [NEW] Store fetched tables
}

function steakBookingReducer(state, action) {
    switch (action.type) {
        case 'SET_STEP': return { ...state, step: action.payload }
        case 'NEXT_STEP': return { ...state, step: state.step + 1 }
        case 'PREV_STEP': return { ...state, step: Math.max(1, state.step - 1) }
        
        case 'SET_DATE_TIME': 
            return { ...state, date: action.payload.date, time: action.payload.time }
        case 'SET_PAX': return { ...state, pax: action.payload }
        case 'SELECT_TABLE': return { ...state, selectedTable: action.payload }
        
        case 'ADD_TO_CART': {
            // Check if same item + same doneness exists
            const existingIndex = state.cart.findIndex(i => 
                i.id === action.payload.id && 
                i.doneness?.id === action.payload.doneness?.id
            )
            if (existingIndex > -1) {
                const newCart = [...state.cart]
                newCart[existingIndex].quantity += action.payload.quantity
                return { ...state, cart: newCart }
            }
            return { ...state, cart: [...state.cart, action.payload] }
        }
        case 'REMOVE_FROM_CART': 
            return { ...state, cart: state.cart.filter((_, i) => i !== action.payload) } // Payload is index
        case 'UPDATE_ITEM_QUANTITY': {
             const newCart = [...state.cart]
             if (action.payload.quantity <= 0) {
                 newCart.splice(action.payload.index, 1)
             } else {
                 newCart[action.payload.index].quantity = action.payload.quantity
             }
             return { ...state, cart: newCart }
        }

        case 'UPDATE_FORM':
            // Merge config if passed
            if (action.payload.field === 'config') {
                 return { ...state, config: { ...state.config, ...action.payload.value } }
            }
            return { ...state, [action.payload.field]: action.payload.value }
            
        case 'SET_LOADING': return { ...state, isLoading: action.payload }
        case 'SET_ERROR': return { ...state, error: action.payload }
        case 'SET_BOOKED_TABLES': 
            return { 
                ...state, 
                bookedTableIds: action.payload.ids,
                bookedTableStatuses: action.payload.statuses
            }
        
        default: return state
    }
}

export function useSteakBooking() {
    const [state, dispatch] = useReducer(steakBookingReducer, initialState)

    // Helper: Validate Date 
    // Logic: 
    // 1. Must be >= Tomorrow (1 day advance)
    // 2. Closed on Sat (6) and Sun (0)
    // 3. Cutoff: If Now > 18:00, Tomorrow is invalid (Must be DayAfterTomorrow)
    const isDateValid = (dateStr) => {
        if (!dateStr) return false
        const selected = new Date(dateStr)
        const now = new Date()
        const cutoffHour = 18

        // Check Day of Week (0=Sun, 6=Sat)
        const day = selected.getDay()
        if (day === 0 || day === 6) return false

        // Min Date Logic
        const minDate = new Date()
        minDate.setDate(minDate.getDate() + 1) // Default: Tomorrow
        minDate.setHours(0,0,0,0)

        // If after 18:00, move minDate to DayAfterTomorrow
        if (now.getHours() >= cutoffHour) {
            minDate.setDate(minDate.getDate() + 1)
        }

        const selectedMidnight = new Date(selected)
        selectedMidnight.setHours(0, 0, 0, 0)
        
        return selectedMidnight >= minDate
    }

    // --- Table Fetching & Logic ---
    const fetchTables = async () => {
         const { data, error } = await supabase
            .from('tables_layout')
            .select('*')
            .order('table_name')
         if (error) console.error(error)
         else dispatch({ type: 'UPDATE_FORM', payload: { field: 'tables', value: data || [] } })
    }

    const checkAvailability = async (date, time) => {
        if (!date || !time) return
        
        dispatch({ type: 'SET_LOADING', payload: true })
        
        // Logic similar to standard booking: Check overlaps
        // Assume 2 hour slots
        const start = toThaiISO(date, time)
        const endDate = new Date(start)
        endDate.setHours(endDate.getHours() + 2)
        const end = endDate.toISOString() // simplified for query

        // Rough query: Get bookings that overlap
        /*
          Input: req_start, req_end
          Overlap: (b.start < req_end) AND (b.end > req_start)
        */
        
        // We need booked table IDs
        // Simplification: We fetch all bookings for that DAY to avoid complex TZ queries for now, filtering in JS if needed or range query
        const dayStart = new Date(date)
        dayStart.setHours(0,0,0,0)
        const dayEnd = new Date(date)
        dayEnd.setHours(23,59,59,999)

        const { data: bookings } = await supabase
            .from('bookings')
            .select('table_id, booking_time, booking_type')
            .in('status', ['pending', 'confirmed', 'seated', 'ready', 'approved', 'paid'])
            .gte('booking_time', dayStart.toISOString())
            .lte('booking_time', dayEnd.toISOString())
        
        if (bookings) {
             const bookedIds = []
             const statuses = {}

             bookings.forEach(b => {
                 const bStart = new Date(b.booking_time)
                 const bEnd = new Date(bStart)
                 bEnd.setHours(bEnd.getHours() + 2) // Assume 2hr duration

                 const reqStart = new Date(start)
                 const reqEnd = new Date(start)
                 reqEnd.setHours(reqEnd.getHours() + 2)

                 if (bStart < reqEnd && bEnd > reqStart) {
                     bookedIds.push(b.table_id)
                     statuses[b.table_id] = { type: b.booking_type }
                 }
             })

             dispatch({ type: 'SET_BOOKED_TABLES', payload: { ids: bookedIds, statuses } })
        }
        dispatch({ type: 'SET_LOADING', payload: false })
    }

    useEffect(() => {
        fetchTables()
    }, [])
    
    // Auto-check availability when date/time changes
    useEffect(() => {
        if (state.date && state.time) {
            checkAvailability(state.date, state.time)
        }
    }, [state.date, state.time])


    const submitSteakOrder = async () => {
        dispatch({ type: 'SET_LOADING', payload: true })
        try {
            if (!state.contactName || !state.contactPhone) throw new Error('Please fill in contact details')
            if (!state.selectedTable) throw new Error('Please select a table')
            if (state.cart.length === 0) throw new Error('Please select at least one steak')

            // 1. Upload Slip (Reuse logic or do it here)
            let slipUrl = null
            if (state.slipFile) {
                 const fileName = `slip_steak_${Date.now()}_${Math.random().toString(36).substring(7)}`
                 const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('slips')
                    .upload(fileName, state.slipFile)
                 if (uploadError) throw uploadError
                 const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(fileName)
                 slipUrl = publicUrl
            }

            // 2. Add-ons Calculation
            const cartTotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0)
            const cakeTotal = state.addCake ? (state.config.cakePrice || 0) : 0
            const flowerTotal = state.addFlower ? (state.config.flowerPrice || 0) : 0
            const wineTotal = state.winePreference?.price || 0
            
            const totalAmount = cartTotal + cakeTotal + flowerTotal + wineTotal

            // 3. Construct Customer Note
            const wineText = state.winePreference ? `${state.winePreference.name}${state.winePreference.price > 0 ? ` (+${state.winePreference.price})` : ''}` : 'No Wine'
            
            const details = [
                `[Steak Pre-order]`,
                `Occasion: ${state.occasion}`,
                `Wine: ${wineText}`,
                state.addCake ? `[ADD-ON] Cake (+${cakeTotal}): ${state.cakeDetail}` : null,
                state.addFlower ? `[ADD-ON] Flower (+${flowerTotal}): ${state.flowerDetail}` : null,
                state.dietaryRestrictions ? `Allergies: ${state.dietaryRestrictions}` : null,
                state.specialRequest ? `Note: ${state.specialRequest}` : null
            ].filter(Boolean).join('\n')

            // 3. Create Booking
            // Get Current User
            const { data: { user } } = await supabase.auth.getUser()

            const bookingPayload = {
                booking_type: 'steak', // Changed from 'dine_in' to 'steak' for explicit tracking
                status: 'pending', // Pending payment check
                booking_time: toThaiISO(state.date, state.time),
                table_id: state.selectedTable.id,
                total_amount: totalAmount,
                payment_slip_url: slipUrl,
                pickup_contact_name: state.contactName,
                pickup_contact_phone: state.contactPhone,
                customer_note: details,
                pax: state.pax,
                tracking_token: crypto.randomUUID(),
                user_id: user?.id || null // Link to user if logged in
            }

            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .insert(bookingPayload)
                .select()
                .single()
            
            if (bookingError) throw bookingError

            // 4. Create Order Items
            const orderItems = state.cart.map(item => ({
                booking_id: booking.id,
                menu_item_id: item.id,
                quantity: item.quantity,
                price_at_time: item.price,
                selected_options: item.doneness ? { 'Doneness': item.doneness.name } : {}
            }))

            const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
            if (itemsError) throw itemsError

            return { success: true, trackingToken: booking.tracking_token }

        } catch (error) {
            console.error(error)
            dispatch({ type: 'SET_ERROR', payload: error.message })
            return { success: false, error: error.message }
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false })
        }
    }

    return {
        state,
        dispatch,
        isDateValid,
        submitSteakOrder
    }
}
