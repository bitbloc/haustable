import { useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getAppOrigin } from '../utils/urlHelper'
import { sendPOSBroadcast } from '../utils/realtimeNotifier'
import { sendOrderNotificationEmail } from '../utils/orderNotificationHelper'

export function useOrderSubmission() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const submittingRef = useRef(false)
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

    const deductStockSafely = async (bookingId, orderItems) => {
        if (!orderItems || orderItems.length === 0) return
        try {
            // 1. Try atomic RPC if available in database
            if (bookingId) {
                const { error: rpcErr } = await supabase.rpc('deduct_order_stock', { p_booking_id: bookingId })
                if (!rpcErr) return
                console.warn('[useOrderSubmission] deduct_order_stock RPC fallback to client-side decrement:', rpcErr.message)
            }

            // 2. Resilient Client-Side stock deduction
            for (const item of orderItems) {
                const menuItemId = item.menu_item_id || item.id
                const qty = Number(item.quantity) || 1
                if (!menuItemId) continue

                const { data: currentItem } = await supabase
                    .from('menu_items')
                    .select('id, stock_quantity, remaining_stock, is_preorder')
                    .eq('id', menuItemId)
                    .maybeSingle()

                if (currentItem) {
                    const currentStock = currentItem.remaining_stock ?? currentItem.stock_quantity
                    if (currentStock !== null && currentStock !== undefined) {
                        const newStock = Math.max(0, currentStock - qty)
                        await supabase
                            .from('menu_items')
                            .update({
                                remaining_stock: newStock,
                                stock_quantity: newStock,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', menuItemId)
                    }
                }
            }
        } catch (err) {
            console.warn('[useOrderSubmission] Stock deduction exception:', err)
        }
    }

    const insertBookingWithFallback = async (payload) => {
        let { data, error } = await supabase.from('bookings').insert(payload).select().single()
        if (error && error.message && error.message.includes('column')) {
            console.warn('[useOrderSubmission] bookings column missing, using resilient fallback insert:', error.message)
            
            let extraNote = ''
            if (payload.shipping_address) extraNote += ` [ที่อยู่: ${payload.shipping_address}]`
            if (payload.shipping_fee) extraNote += ` [ค่าส่ง: ฿${payload.shipping_fee}]`
            if (payload.order_type) extraNote += ` [ประเภท: ${payload.order_type}]`

            const fallbackPayload = {
                user_id: payload.user_id || null,
                booking_type: payload.booking_type || 'hausmade',
                status: payload.status || 'pending',
                table_id: payload.table_id || null,
                booking_time: payload.booking_time,
                total_amount: payload.total_amount,
                deposit_amount: payload.deposit_amount !== undefined ? payload.deposit_amount : payload.total_amount,
                discount_amount: payload.discount_amount || 0,
                promotion_code_id: payload.promotion_code_id || null,
                pickup_contact_name: payload.pickup_contact_name,
                pickup_contact_phone: payload.pickup_contact_phone,
                customer_note: ((payload.customer_note || '') + extraNote).trim(),
                staff_remark: payload.staff_remark || null,
                payment_slip_url: payload.payment_slip_url,
                tracking_token: payload.tracking_token,
                xhaus_earned: payload.xhaus_earned || 0,
                xhaus_redeemed: payload.xhaus_redeemed || 0,
                xhaus_discount: payload.xhaus_discount || 0
            }

            // Include slip verification columns if present and avoid failing if column not migrated
            if (payload.slip_verified !== undefined) fallbackPayload.slip_verified = payload.slip_verified
            if (payload.slip_trans_ref) fallbackPayload.slip_trans_ref = payload.slip_trans_ref
            if (payload.slip_provider) fallbackPayload.slip_provider = payload.slip_provider
            if (payload.slip_verification_status) fallbackPayload.slip_verification_status = payload.slip_verification_status
            if (payload.slip_verified_data) fallbackPayload.slip_verified_data = payload.slip_verified_data

            const fallbackRes = await supabase.from('bookings').insert(fallbackPayload).select().single()
            if (fallbackRes.error) {
                // If slip columns caused error, retry without slip columns
                const { slip_verified, slip_trans_ref, slip_provider, slip_verification_status, slip_verified_data, ...safePayload } = fallbackPayload
                const safeRes = await supabase.from('bookings').insert(safePayload).select().single()
                if (safeRes.error) throw safeRes.error
                return safeRes.data
            }
            return fallbackRes.data
        }
        if (error) throw error
        return data
    }

    const submitOrder = async ({
        bookingPayload,
        orderItemsPayload,
        slipFile,
        lineIdToken = null,
        onSuccess
    }) => {
        if (submittingRef.current || isSubmitting) return { success: false, error: 'In progress' }
        submittingRef.current = true
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

                const bookingData = await insertBookingWithFallback({
                    ...finalBookingPayload,
                    user_id: user.id
                })

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

                    // Immediate Stock Deduction (ตัดสต๊อกทันที)
                    await deductStockSafely(bookingData.id, orderItemsPayload)
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

                if (resultData?.id && orderItemsPayload && orderItemsPayload.length > 0) {
                    await deductStockSafely(resultData.id, orderItemsPayload)
                }

            } else {
                // --- GUEST / DIRECT INSERT (Auto-linked by DB Trigger if phone matches member) ---
                console.log("Submitting as Guest Order...")
                const bookingData = await insertBookingWithFallback({
                    ...finalBookingPayload,
                    user_id: null
                })

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

                    // Immediate Stock Deduction (ตัดสต๊อกทันที)
                    await deductStockSafely(bookingData.id, orderItemsPayload)
                }
            }

            if (resultData) {
                // Instantly broadcast to all connected POS terminals (< 50ms)
                try {
                    const custName = resultData.pickup_contact_name || resultData.customer_name || 'Guest'
                    const custPhone = resultData.pickup_contact_phone || resultData.customer_phone || ''
                    sendPOSBroadcast('online_order_created', {
                        booking_id: resultData.id,
                        booking_type: resultData.booking_type,
                        table_id: resultData.table_id || null,
                        customer_name: custName,
                        phone: custPhone,
                        total_amount: resultData.total_amount || 0,
                        has_slip: !!finalSlipUrl,
                        slip_verified: Boolean(resultData.slip_verified),
                        slip_provider: resultData.slip_provider || null,
                        booking_time: resultData.booking_time,
                        items_count: orderItemsPayload?.length || 0
                    })

                    if (finalSlipUrl) {
                        sendPOSBroadcast('payment_slip_uploaded', {
                            booking_id: resultData.id,
                            booking_type: resultData.booking_type,
                            slip_url: finalSlipUrl,
                            slip_verified: Boolean(resultData.slip_verified),
                            slip_provider: resultData.slip_provider || null,
                            total_amount: resultData.total_amount || 0
                        })
                    }
                } catch (bErr) {
                    console.warn('[useOrderSubmission] POS broadcast error:', bErr)
                }

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

                // Automatically trigger email notification to Rithawat@gmail.com for Hausmade orders
                try {
                    const isHausmadeOrder = resultData.booking_type === 'hausmade' || 
                        resultData.order_type?.includes('hausmade') || 
                        resultData.shipping_address !== undefined
                    
                    if (isHausmadeOrder) {
                        sendOrderNotificationEmail(resultData, orderItemsPayload)
                    }
                } catch (emailErr) {
                    console.warn('[useOrderSubmission] Failed to dispatch email notification:', emailErr)
                }
            }

            if (onSuccess) onSuccess(resultData)
            return { success: true, data: resultData, trackingToken }

        } catch (err) {
            console.error("Submission Error:", err)
            setError(err.message)
            return { success: false, error: err.message }
        } finally {
            submittingRef.current = false
            setIsSubmitting(false)
        }
    }

    return { submitOrder, isSubmitting, error }
}
