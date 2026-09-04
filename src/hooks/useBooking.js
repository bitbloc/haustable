import { useCallback } from 'react'
import { useBookingContext } from '../context/BookingContext'
import { supabase } from '../lib/supabaseClient'
import { toThaiISO } from '../utils/timeUtils'
import { useOrderSubmission } from './useOrderSubmission'

export function useBooking() {
    const { state, dispatch } = useBookingContext()
    const { submitOrder } = useOrderSubmission()

    // --- Actions ---
    const setStep = useCallback((step) => dispatch({ type: 'GO_TO_STEP', payload: step }), [dispatch])
    const nextStep = useCallback(() => dispatch({ type: 'NEXT_STEP' }), [dispatch])
    const prevStep = useCallback(() => dispatch({ type: 'PREV_STEP' }), [dispatch])

    const setDate = useCallback((date) => dispatch({ type: 'SET_DATE', payload: date }), [dispatch])
    const setTime = useCallback((time) => dispatch({ type: 'SET_TIME', payload: time }), [dispatch])
    const setPax = useCallback((pax) => dispatch({ type: 'SET_PAX', payload: pax }), [dispatch])

    const selectTable = useCallback((table) => dispatch({ type: 'SELECT_TABLE', payload: table }), [dispatch])

    // Cart Actions
    const addToCart = useCallback((item) => {
        if (item.menu_item_options && item.menu_item_options.length > 0) {
            dispatch({ type: 'OPEN_OPTION_MODAL', payload: item })
        } else {
            dispatch({ type: 'ADD_TO_CART', payload: item })
        }
    }, [dispatch])
    
    const removeFromCart = useCallback((item) => dispatch({ type: 'REMOVE_FROM_CART', payload: item }), [dispatch])
    const openOptionModal = useCallback((item) => dispatch({ type: 'OPEN_OPTION_MODAL', payload: item }), [dispatch])
    const closeOptionModal = useCallback(() => dispatch({ type: 'CLOSE_OPTION_MODAL' }), [dispatch])
    const confirmOptionSelection = useCallback((item) => {
        dispatch({ type: 'ADD_CUSTOM_ITEM', payload: item })
        closeOptionModal()
    }, [dispatch, closeOptionModal])

    const setCheckoutMode = useCallback((isCheckout) => dispatch({ type: 'SET_CHECKOUT_MODE', payload: isCheckout }), [dispatch])

    const updateForm = useCallback((field, value) => dispatch({ type: 'UPDATE_FORM', payload: { field, value } }), [dispatch])

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
            const requestedTime = toThaiISO(state.date, state.time)
            // Default block duration for online bookings is 2 hours if not specified
            const requestedStart = new Date(requestedTime)
            const requestedEnd = new Date(requestedStart.getTime() + (2 * 60 * 60 * 1000))

            // Fetch ALL active bookings for this date (Simple optimized fetch)
            // We fetch the whole day to ensure we catch any overlapping "Long" bookings or "Multi-slot" bookings
            const dateStr = state.date // YYYY-MM-DD
            const dayStart = `${dateStr}T00:00:00+07:00`
            const dayEnd = `${dateStr}T23:59:59+07:00`

            const { data, error } = await supabase
                .from('bookings')
                .select('table_id, booking_time, end_time, booking_type')
                .in('status', ['pending', 'confirmed', 'seated', 'ready', 'approved', 'paid'])
                .gte('booking_time', dayStart)
                .lte('booking_time', dayEnd)

            if (error) throw error

            const bookedIds = []
            const statuses = {}

            data.forEach(b => {
                const bStart = new Date(b.booking_time)
                // If end_time exists use it, else default to 2 hours
                const bEnd = b.end_time ? new Date(b.end_time) : new Date(bStart.getTime() + (2 * 60 * 60 * 1000))

                // Overlap Check: (StartA < EndB) && (EndA > StartB)
                if ((requestedStart < bEnd) && (requestedEnd > bStart)) {
                    bookedIds.push(b.table_id)
                    // Priority: Walk-in overrides Online (for display purpose if multiple? actually just taking last one is fine or first)
                    // If multiple bookings overlap (rare but possible), just take one.
                    statuses[b.table_id] = { type: b.booking_type }
                }
            })

            dispatch({ type: 'SET_BOOKED_TABLES', payload: { ids: bookedIds, statuses } })
        } catch (err) {
            console.error("Availability Check Failed", err)
        }
    }

    // Submit Booking
    const submitBooking = async (promotionData = null, depositAmount = 0, overrides = {}) => { // Modified to accept promotion, deposit, and overrides
        try {
            const finalContactName = (overrides.contactName || state.contactName || '').trim()
            const finalContactPhone = (overrides.contactPhone || state.contactPhone || '').trim()
            const cleanPhone = finalContactPhone.replace(/\D/g, '')
            const finalSlipFile = overrides.slipFile || state.slipFile

            if (!finalContactName) throw new Error('กรุณาระบุชื่อผู้จองโต๊ะ (Customer Name is required)')
            if (!finalContactPhone || cleanPhone.length < 9) throw new Error('กรุณาระบุเบอร์โทรศัพท์ติดต่อที่ถูกต้องอย่างน้อย 9-10 หลัก (Valid Phone Number is required)')
            if (!state.isAgreed) throw new Error('Please agree to terms')
            if (!finalSlipFile) throw new Error('Please upload payment slip')
            if (!state.selectedTable?.id) throw new Error('กรุณาเลือกโต๊ะที่ต้องการจอง')

            // Security Check: Blocked Date
            const { count: blockedCount } = await supabase
                .from('blocked_dates')
                .select('id', { count: 'exact', head: true })
                .eq('blocked_date', state.date)

            if (blockedCount > 0) {
                throw new Error('ขออภัย วันดังกล่าวเพิ่งถูกปิดรับจอง (This date is now closed)')
            }

            // Min Spend Check
            const cartTotal = state.cart.reduce((sum, item) => sum + ((item.totalPricePerUnit || item.price) * item.qty), 0)
            const MIN_SPEND_PER_PAX = 150;
            const requiredSpend = MIN_SPEND_PER_PAX * state.pax;
            
            if (cartTotal < requiredSpend) {
                throw new Error(`ยอดขั้นต่ำต่อท่านคือ ${MIN_SPEND_PER_PAX} บาท (ขาดอีก ${requiredSpend - cartTotal} บาท)`)
            }

            // Pre-flight Conflict Check (Double-Booking Prevention)
            const bookingDateTime = toThaiISO(state.date, state.time)
            const requestedStart = new Date(bookingDateTime)
            const requestedEnd = new Date(requestedStart.getTime() + (2 * 60 * 60 * 1000))

            const { data: conflictBookings } = await supabase
                .from('bookings')
                .select('id, booking_time, end_time')
                .eq('table_id', state.selectedTable.id)
                .in('status', ['pending', 'confirmed', 'seated', 'ready', 'approved', 'paid'])
                .gte('booking_time', `${state.date}T00:00:00+07:00`)
                .lte('booking_time', `${state.date}T23:59:59+07:00`)

            if (conflictBookings && conflictBookings.length > 0) {
                const hasOverlap = conflictBookings.some(b => {
                    const bStart = new Date(b.booking_time)
                    const bEnd = b.end_time ? new Date(b.end_time) : new Date(bStart.getTime() + (2 * 60 * 60 * 1000))
                    return (requestedStart < bEnd) && (requestedEnd > bStart)
                })
                if (hasOverlap) {
                    throw new Error('ขออภัย โต๊ะนี้เพิ่งมีผู้ทำรายการจองเข้ามาในช่วงเวลาดังกล่าว กรุณาเลือกโต๊ะอื่น (Table was just reserved by another guest)')
                }
            }
            
            const customerNoteContent = `Booking ${state.selectedTable?.table_name || ''} (${state.pax} Pax)` + (state.specialRequest ? `\nNote: ${state.specialRequest}` : '')

            const discountAmount = promotionData?.discountAmount || 0
            const finalTotal = Math.max(0, cartTotal - discountAmount)

            const isAutoVerified = Boolean(overrides.slipVerifyResult?.verified)
            const bookingPayload = {
                source: 'online',
                booking_type: 'dine_in',
                status: isAutoVerified ? 'confirmed' : 'pending',
                booking_time: bookingDateTime,
                table_id: state.selectedTable.id,
                total_amount: finalTotal,
                payment_slip_url: null, // Will be handled by submitOrder
                pickup_contact_name: finalContactName,
                pickup_contact_phone: finalContactPhone,
                customer_note: customerNoteContent,
                staff_remark: isAutoVerified
                    ? `[ONLINE] จองโต๊ะล่วงหน้า (ตรวจมัดจำ Auto EasySlip ✓ ${typeof overrides.slipVerifyResult?.bankName === 'object' ? (overrides.slipVerifyResult?.bankName?.th || overrides.slipVerifyResult?.bankName?.en || '') : (overrides.slipVerifyResult?.bankName || '')})`
                    : '[ONLINE] จองโต๊ะล่วงหน้า',
                pax: state.pax,
                promotion_code_id: promotionData?.id || null, 
                discount_amount: promotionData?.discountAmount || 0,
                deposit_amount: depositAmount,
                tracking_token: crypto.randomUUID(),
                slip_verified: isAutoVerified,
                slip_provider: overrides.slipVerifyResult?.provider || overrides.paymentMethod || 'bank',
                slip_trans_ref: overrides.slipVerifyResult?.transRef || null,
                slip_verification_status: isAutoVerified ? 'auto_verified' : (overrides.slipVerifyResult ? 'manual_pending' : 'pending'),
                slip_verified_data: overrides.slipVerifyResult?.rawSlip || null
            }

            const orderItemsPayload = state.cart.map(item => ({
                menu_item_id: item.id,
                name: item.name || item.title || item.custom_name || 'รายการอาหาร',
                quantity: item.qty,
                price_at_time: item.totalPricePerUnit || item.price,
                price: item.totalPricePerUnit || item.price,
                selected_options: item.selectedOptions || {}
            }))

            // Resolve Line Token
            const { data: { user } } = await supabase.auth.getUser()
            const lineIdToken = !user && (state.lineIdToken || (window.liff?.isLoggedIn() ? window.liff.getIDToken() : null))

            const result = await submitOrder({
                bookingPayload,
                orderItemsPayload,
                slipFile: finalSlipFile,
                lineIdToken
            })
            
            if (!result.success) throw new Error(result.error)

            return { success: true, data: result.data }

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
        setCheckoutMode, updateForm, // Added updateForm to return

        // Async
        refreshAvailability,
        submitBooking
    }
}
