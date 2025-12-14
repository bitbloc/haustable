import { useBookingContext } from '../context/BookingContext'
import { supabase } from '../lib/supabaseClient'
import { toThaiISO } from '../utils/timeUtils'

export function useBooking() {
    const { state, dispatch } = useBookingContext()

    // --- Actions ---
    const setStep = (step) => dispatch({ type: 'GO_TO_STEP', payload: step })
    const nextStep = () => dispatch({ type: 'NEXT_STEP' })
    const prevStep = () => dispatch({ type: 'PREV_STEP' })

    const setDate = (date) => dispatch({ type: 'SET_DATE', payload: date })
    const setTime = (time) => dispatch({ type: 'SET_TIME', payload: time })
    const setPax = (pax) => dispatch({ type: 'SET_PAX', payload: pax })

    const selectTable = (table) => dispatch({ type: 'SELECT_TABLE', payload: table })

    // Cart Actions
    const addToCart = (item) => dispatch({ type: 'ADD_TO_CART', payload: item })
    const removeFromCart = (item) => dispatch({ type: 'REMOVE_FROM_CART', payload: item })
    const openOptionModal = (item) => dispatch({ type: 'OPEN_OPTION_MODAL', payload: item })
    const closeOptionModal = () => dispatch({ type: 'CLOSE_OPTION_MODAL' })
    const confirmOptionSelection = (item) => {
        dispatch({ type: 'ADD_CUSTOM_ITEM', payload: item })
        closeOptionModal()
    }

    const setCheckoutMode = (isCheckout) => dispatch({ type: 'SET_CHECKOUT_MODE', payload: isCheckout })

    const updateForm = (field, value) => dispatch({ type: 'UPDATE_FORM', payload: { field, value } })

    // --- Side Effects (Business Logic) ---

    // Check Availability for a specific table (used in Floorplan)
    const checkTableAvailability = async (tableId, date, time) => {
        // Stub: Implement real check if needed, or rely on `bookedTableIds`
        // The reducer/context usually loads `bookedTableIds` for the whole floorplan.
        // This function might be for specific double-checks.
        console.log("Checking...", tableId)
    }

    // Refresh Availability (Booked Tables)
    const refreshAvailability = async () => {
        if (!state.date || !state.time) return

        try {
            const bookingDateTime = toThaiISO(state.date, state.time)
            const { data, error } = await supabase
                .from('bookings')
                .select('table_id')
                .eq('booking_time', bookingDateTime)
                .in('status', ['pending', 'confirmed'])

            if (error) throw error

            // We need a way to store this in state.
            // I should add 'SET_BOOKED_TABLES' to reducer.
            // For now, let's assume we might need to add that action.
            // Wait, I missed `bookedTableIds` in the initialState! 
            // I should update reducer to have `bookedTableIds`.
            dispatch({ type: 'SET_BOOKED_TABLES', payload: data.map(b => b.table_id) })
        } catch (err) {
            console.error("Availability Check Failed", err)
        }
    }

    // Submit Booking
    const submitBooking = async () => {
        try {
            if (!state.contactName || !state.contactPhone) throw new Error('กรุณากรอกข้อมูลให้ครบ')
            if (!state.isAgreed) throw new Error('Please agree to terms')
            if (!state.slipFile) throw new Error('Please upload payment slip')

            // Min Spend Check
            const cartTotal = state.cart.reduce((sum, item) => sum + ((item.totalPricePerUnit || item.price) * item.qty), 0)
            if (state.settings.minSpend > 0) {
                const requiredSpend = state.settings.minSpend * state.pax
                if (cartTotal < requiredSpend) {
                    throw new Error(`ยอดขั้นต่ำต่อท่านคือ ${state.settings.minSpend} บาท (ขาดอีก ${requiredSpend - cartTotal} บาท)`)
                }
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Please Login')

            const bookingDateTime = toThaiISO(state.date, state.time)

            // Double Check
            const { count, error: checkError } = await supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('booking_time', bookingDateTime)
                .eq('table_id', state.selectedTable.id)
                .in('status', ['pending', 'confirmed'])

            if (checkError) throw checkError
            if (count > 0) throw new Error('This table was just taken! Please select another.')

            // Upload Slip
            const fileExt = state.slipFile.name.split('.').pop()
            const fileName = `booking_${Math.random()}.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('slips').upload(fileName, state.slipFile)
            if (uploadError) throw uploadError

            // Insert Booking
            const customerNoteContent = `Booking ${state.selectedTable.table_name} (${state.pax} Pax)` + (state.specialRequest ? `\nNote: ${state.specialRequest}` : '')

            const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert({
                user_id: user.id,
                booking_type: 'dine_in',
                status: 'pending',
                booking_time: bookingDateTime,
                table_id: state.selectedTable.id,
                total_amount: cartTotal,
                payment_slip_url: fileName,
                pickup_contact_name: state.contactName,
                pickup_contact_phone: state.contactPhone,
                customer_note: customerNoteContent,
                pax: state.pax
            }).select().single()

            if (bookingError) throw bookingError

            // Order Items
            if (state.cart.length > 0) {
                const orderItems = state.cart.map(item => ({
                    booking_id: bookingData.id,
                    menu_item_id: item.id,
                    quantity: item.qty,
                    price_at_time: item.totalPricePerUnit || item.price,
                    selected_options: item.selectedOptions || {}
                }))
                await supabase.from('order_items').insert(orderItems)
            }

            return { success: true }

        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    return {
        // State Shortcuts
        ...state,
        dispatch, // escape hatch

        // Actions
        setStep, nextStep, prevStep,
        setDate, setTime, setPax,
        selectTable,
        addToCart, removeFromCart, openOptionModal, closeOptionModal, confirmOptionSelection,
        setCheckoutMode, updateForm,

        // Async
        refreshAvailability,
        submitBooking
    }
}
