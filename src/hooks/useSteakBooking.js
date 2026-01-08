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
    winePreference: 'none', // none, bin2, corkage
    specialRequest: '',
    dietaryRestrictions: '',
    cakeRequest: '',
    contactName: '',
    contactPhone: '',
    isAgreed: false,
    slipFile: null,
    isLoading: false,
    error: null,
    bookedTableIds: [] // For preventing double booking on table selection step
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
            return { ...state, [action.payload.field]: action.payload.value }
            
        case 'SET_LOADING': return { ...state, isLoading: action.payload }
        case 'SET_ERROR': return { ...state, error: action.payload }
        case 'SET_BOOKED_TABLES': return { ...state, bookedTableIds: action.payload }
        
        default: return state
    }
}

export function useSteakBooking() {
    const [state, dispatch] = useReducer(steakBookingReducer, initialState)

    // Helper: Validate Next Day (Advance Booking)
    const isDateValid = (dateStr) => {
        if (!dateStr) return false
        const selected = new Date(dateStr)
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0, 0, 0, 0)
        // Set selected time to midnight for comparison
        const selectedMidnight = new Date(selected)
        selectedMidnight.setHours(0, 0, 0, 0)
        
        return selectedMidnight >= tomorrow
    }

    // Load Stock / Menu Logic could go here or in the component using React Query / useEffect
    // For MVP, we pass menu items in from the Page.

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

            // 2. Construct Customer Note with details
            const details = [
                `[Steak Pre-order]`,
                `Occasion: ${state.occasion}`,
                `Wine: ${state.winePreference}`,
                state.cakeRequest ? `Cake: ${state.cakeRequest}` : null,
                state.dietaryRestrictions ? `Allergies: ${state.dietaryRestrictions}` : null,
                state.specialRequest ? `Note: ${state.specialRequest}` : null
            ].filter(Boolean).join('\n')

            // 3. Create Booking
            const bookingPayload = {
                booking_type: 'dine_in', // Or 'steak_preorder' if schema allows, but 'dine_in' is safer for now
                status: 'pending', // Pending payment check
                booking_time: toThaiISO(state.date, state.time),
                table_id: state.selectedTable.id,
                total_amount: state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0),
                payment_slip_url: slipUrl,
                pickup_contact_name: state.contactName,
                pickup_contact_phone: state.contactPhone,
                customer_note: details,
                pax: state.pax,
                tracking_token: crypto.randomUUID()
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
