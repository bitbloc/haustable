import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getAppOrigin } from '../utils/urlHelper'

export function useOrderSubmission() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState(null)

    const registerSlipSafely = async (bookingId, fileName, amount) => {
        if (!bookingId || !fileName) return
        try {
            const { error: slipErr } = await supabase.rpc('register_payment_slip', {
                p_booking_id: bookingId,
                p_file_name: fileName,
                p_amount: amount || 0
            })
            if (slipErr) {
                console.warn('Slips registry error:', slipErr)
            }
        } catch (err) {
            console.warn('Slips registry exception:', err)
        }
    }

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
                const { error: uploadError } = await supabase.storage.from('slips').upload(fileName, slipFile, {
                    cacheControl: '15552000'
                })
                
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

                const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert({
                    ...finalBookingPayload,
                    user_id: user.id
                }).select().single()

                if (bookingError) throw bookingError
                resultData = bookingData
                trackingToken = bookingData.tracking_token

                if (finalSlipUrl) {
                    await registerSlipSafely(bookingData.id, finalSlipUrl, bookingData.total_amount)
                }

                if (orderItemsPayload && orderItemsPayload.length > 0) {
                    const items = orderItemsPayload.map(item => ({
                        booking_id: bookingData.id,
                        ...item
                    }))
                    const { error: itemsError } = await supabase.from('order_items').insert(items)
                    if (itemsError) throw itemsError
                }

            } else if (lineIdToken) {
                // --- LINE USER (Edge Function) ---
                console.warn("Submitting via Edge Function (LINE LIFF Session)...")
                const { data, error: fnError } = await supabase.functions.invoke('manage-booking', {
                    body: { 
                        action: 'create_booking', 
                        idToken: lineIdToken,
                        bookingData: { ...finalBookingPayload, orderItems: orderItemsPayload }
                    }
                })

                if (fnError) throw fnError
                if (!data.success) throw new Error(data.error || 'Booking Failed')
                resultData = data.data || data.booking
                trackingToken = resultData?.tracking_token || bookingPayload.tracking_token

                if (finalSlipUrl && resultData?.id) {
                    await registerSlipSafely(resultData.id, finalSlipUrl, resultData.total_amount)
                }

            } else {
                // --- GUEST / DIRECT INSERT (Auto-linked by DB Trigger if phone matches member) ---
                console.log("Submitting as Guest Order...")
                const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert({
                    ...finalBookingPayload,
                    user_id: null
                }).select().single()

                if (bookingError) throw bookingError
                resultData = bookingData
                trackingToken = bookingData.tracking_token

                if (finalSlipUrl) {
                    await registerSlipSafely(bookingData.id, finalSlipUrl, bookingData.total_amount)
                }

                if (orderItemsPayload && orderItemsPayload.length > 0) {
                    const items = orderItemsPayload.map(item => ({
                        booking_id: bookingData.id,
                        ...item
                    }))
                    const { error: itemsError } = await supabase.from('order_items').insert(items)
                    if (itemsError) throw itemsError
                }
            }

            if (resultData) {
                try {
                    const profileId = resultData?.user_id
                    let lineUserId = null
                    let customerName = resultData?.customer_name || 'Guest'

                    if (profileId) {
                        const { data: profile } = await supabase.from('profiles').select('line_user_id, display_name').eq('id', profileId).single()
                        if (profile?.line_user_id) {
                            lineUserId = profile.line_user_id
                            customerName = profile.display_name || customerName
                        }
                    }

                    if (lineUserId) {
                        const origin = getAppOrigin()
                        const shopLogoUrl = `${origin}/logo.png`
                        const checkInUrl = `${origin}/staff/checkin?id=${resultData.tracking_token || resultData.id}`
                        
                        const itemsSummary = orderItemsPayload && orderItemsPayload.length > 0
                            ? orderItemsPayload.map(i => `${i.quantity}x ${i.name}`).join(', ') 
                            : 'No items'

                        await supabase.functions.invoke('send-booking-ticket', {
                            body: {
                                lineUserId,
                                bookingId: resultData.id,
                                trackingToken: resultData.tracking_token,
                                customerName,
                                dateTime: new Date(resultData.booking_time).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }),
                                tableName: resultData.table_name || 'TBA',
                                itemsSummary,
                                totalAmount: resultData.total_amount,
                                shopLogoUrl,
                                checkInUrl
                            }
                        })
                    }
                } catch(e) {
                    console.error("Failed to trigger ticket:", e)
                }
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
