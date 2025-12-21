import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useOrderSubmission() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState(null)

    const submitOrder = async ({
        bookingPayload,
        orderItemsPayload,
        slipFile,
        lineIdToken = null,
        onSuccess
    }) => {
        setIsSubmitting(true)
        setError(null)
        try {
            // 1. Upload Slip (if provided)
            let finalSlipUrl = bookingPayload.payment_slip_url
            
            if (slipFile) {
                const fileExt = slipFile.name.split('.').pop()
                const fileName = `slip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
                const { error: uploadError } = await supabase.storage.from('slips').upload(fileName, slipFile)
                
                if (uploadError) throw new Error('Upload Slip Failed: ' + uploadError.message)
                finalSlipUrl = fileName
            }

            // 2. Prepare Final Payload
            const finalBookingPayload = {
                ...bookingPayload,
                payment_slip_url: finalSlipUrl
            }

            // 3. Check Auth & Submit
            const { data: { user } } = await supabase.auth.getUser()
            
            let resultData = null
            let trackingToken = bookingPayload.tracking_token

            if (user) {
                // --- AUTHENTICATED USER (Direct Insert) ---
                console.log("Submitting as Authenticated User:", user.id)
                
                // Safety: Check availability if it's dine_in and has table (optional, but good practice if redundant with UI)
                // We skip specific checks here and rely on DB constraints or UI checks passed in? 
                // Let's assume UI did checks. But for concurrency, we might want to catch DB errors.

                const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert({
                    ...finalBookingPayload,
                    user_id: user.id
                }).select().single()

                if (bookingError) throw bookingError
                resultData = bookingData
                trackingToken = bookingData.tracking_token

                if (orderItemsPayload && orderItemsPayload.length > 0) {
                    const items = orderItemsPayload.map(item => ({
                        booking_id: bookingData.id,
                        ...item
                    }))
                    const { error: itemsError } = await supabase.from('order_items').insert(items)
                    if (itemsError) throw itemsError // Rolling back would be ideal but simple throw is OK for now
                }

            } else if (lineIdToken) {
                // --- LINE USER (Edge Function) ---
                console.warn("Submitting via Edge Function (No Supabase Session)...")
                const { data, error: fnError } = await supabase.functions.invoke('manage-booking', {
                    body: { 
                        action: 'create_booking', 
                        idToken: lineIdToken,
                        bookingData: { ...finalBookingPayload, orderItems: orderItemsPayload }
                    }
                })

                if (fnError) throw fnError
                if (!data.success) throw new Error(data.error || 'Booking Failed')
                resultData = data.data
                trackingToken = data.data?.tracking_token

            } else {
                throw new Error("User not authenticated.")
            }

            if (onSuccess) onSuccess(resultData)
            return { success: true, data: resultData, trackingToken }

        } catch (err) {
            console.error("Submission Error:", err)
            setError(err.message)
            return { success: false, error: err.message }
        } finally {
            setIsSubmitting(false)
        }
    }

    return { submitOrder, isSubmitting, error }
}
