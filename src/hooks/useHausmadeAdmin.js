import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useHausmadeAdmin() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [settings, setSettings] = useState({
        shopModeHausmade: 'manual_close',
        shippingFee: 50,
        freeShippingMinItems: 3,
        freeShippingMinAmount: 0,
        senderName: 'HAUSMADE by IN THE HAUS',
        senderPhone: '098-528-4217',
        senderAddress: '430 ถนนสุนทรวิจิตร ตำบลในเมือง อำเภอเมือง จังหวัดนครพนม 48000',
        senderTaxId: '0485566001234'
    })

    // Fetch Orders & Settings
    const fetchAdminData = useCallback(async () => {
        try {
            setLoading(true)

            const [ordersRes, settingsRes] = await Promise.all([
                supabase
                    .from('bookings')
                    .select('*, order_items(*, menu_items(*))')
                    .or('order_type.eq.hausmade_shipping,order_type.eq.hausmade_pickup,booking_type.eq.hausmade')
                    .order('created_at', { ascending: false }),
                supabase.from('app_settings').select('key, value').not('key', 'in', '("tax_signature_image")')
            ])

            if (ordersRes.data) {
                setOrders(ordersRes.data)
            }

            if (settingsRes.data) {
                const map = settingsRes.data.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                setSettings({
                    shopModeHausmade: map.shop_mode_hausmade || 'manual_close',
                    shippingFee: Number(map.hausmade_shipping_fee ?? 50),
                    freeShippingMinItems: Number(map.hausmade_free_shipping_min_items ?? 3),
                    freeShippingMinAmount: Number(map.hausmade_free_shipping_min_amount ?? 0),
                    senderName: map.sender_name || 'HAUSMADE by IN THE HAUS',
                    senderPhone: map.sender_phone || '098-528-4217',
                    senderAddress: map.sender_address || '430 ถนนสุนทรวิจิตร ตำบลในเมือง อำเภอเมือง จังหวัดนครพนม 48000',
                    senderTaxId: map.sender_tax_id || '0485566001234',
                    promptpayId: map.promptpay_id || '0614232455',
                    promptpayName: map.promptpay_name || 'ธัญญธร ศรีวิเศษ',
                    paymentQrUrl: map.payment_qr_url || '',
                    bankAccountName: map.bank_account_name || map.promptpay_name || 'ธัญญธร ศรีวิเศษ',
                    bankAccountNo: map.bank_account_no || '123-4-56789-0',
                    bankName: map.bank_name || 'กสิกรไทย (KBank)'
                })
            }
        } catch (err) {
            console.error('[useHausmadeAdmin] Error fetching data:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchAdminData()

        let debounceTimer = null
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                fetchAdminData()
            }, 400)
        }

        const channel = supabase
            .channel('hausmade-admin-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, debouncedFetch)
            .subscribe()

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
        }
    }, [fetchAdminData])

    // Update Shipping & Sender Settings
    const updateSettings = async (newSettings) => {
        try {
            const updates = [
                { key: 'shop_mode_hausmade', value: newSettings.shopModeHausmade || 'manual_close' },
                { key: 'hausmade_shipping_fee', value: String(newSettings.shippingFee) },
                { key: 'hausmade_free_shipping_min_items', value: String(newSettings.freeShippingMinItems) },
                { key: 'hausmade_free_shipping_min_amount', value: String(newSettings.freeShippingMinAmount) },
                { key: 'sender_name', value: newSettings.senderName },
                { key: 'sender_phone', value: newSettings.senderPhone },
                { key: 'sender_address', value: newSettings.senderAddress },
                { key: 'sender_tax_id', value: newSettings.senderTaxId }
            ]

            const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' })
            if (error) throw error

            setSettings(newSettings)
            return { success: true }
        } catch (err) {
            console.error('[useHausmadeAdmin] Error updating settings:', err)
            return { success: false, error: err.message }
        }
    }

    // Update Order Status & Courier Tracking Info
    const updateOrderStatus = async (orderId, { status, courierName, trackingNumber }) => {
        try {
            const payload = { status }
            if (courierName !== undefined) payload.courier_name = courierName
            if (trackingNumber !== undefined) payload.tracking_number = trackingNumber

            let { error } = await supabase
                .from('bookings')
                .update(payload)
                .eq('id', orderId)

            if (error && error.message && error.message.includes('column')) {
                console.warn('[useHausmadeAdmin] Bookings column missing, updating status with staff_remark fallback:', error.message)
                const trackingRemark = `[COURIER: ${courierName || 'Flash Express'}] [TRACKING: ${trackingNumber || '-'}]`
                const fallbackRes = await supabase
                    .from('bookings')
                    .update({
                        status,
                        staff_remark: trackingRemark
                    })
                    .eq('id', orderId)

                if (fallbackRes.error) throw fallbackRes.error
            } else if (error) {
                throw error
            }

            // Restore stock if order is cancelled or voided
            if (status === 'cancelled' || status === 'void') {
                try {
                    const { error: rpcErr } = await supabase.rpc('restore_order_stock', { p_booking_id: orderId })
                    if (rpcErr) {
                        // Fallback client-side restore
                        const { data: items } = await supabase
                            .from('order_items')
                            .select('menu_item_id, quantity')
                            .eq('booking_id', orderId)
                        if (items && items.length > 0) {
                            for (const it of items) {
                                if (!it.menu_item_id) continue
                                const { data: mItem } = await supabase
                                    .from('menu_items')
                                    .select('remaining_stock, stock_quantity')
                                    .eq('id', it.menu_item_id)
                                    .maybeSingle()
                                if (mItem) {
                                    const curStock = mItem.remaining_stock ?? mItem.stock_quantity ?? 0
                                    await supabase
                                        .from('menu_items')
                                        .update({
                                            remaining_stock: curStock + (it.quantity || 1),
                                            stock_quantity: curStock + (it.quantity || 1),
                                            updated_at: new Date().toISOString()
                                        })
                                        .eq('id', it.menu_item_id)
                                }
                            }
                        }
                    }
                } catch (restErr) {
                    console.warn('[useHausmadeAdmin] Restock exception:', restErr)
                }
            }

            // Refresh orders list
            await fetchAdminData()
            return { success: true }
        } catch (err) {
            console.error('[useHausmadeAdmin] Error updating order status:', err)
            return { success: false, error: err.message }
        }
    }

    // Batch Update Multiple Order Statuses at once
    const updateBatchOrderStatus = async (orderIds, { status, courierName }) => {
        try {
            const idList = Array.from(orderIds)
            if (idList.length === 0) return { success: true }

            const payload = { status }
            if (courierName !== undefined) payload.courier_name = courierName

            const { error } = await supabase
                .from('bookings')
                .update(payload)
                .in('id', idList)

            if (error) throw error

            // If cancelled, restore stock for each order
            if (status === 'cancelled' || status === 'void') {
                for (const id of idList) {
                    try {
                        await supabase.rpc('restore_order_stock', { p_booking_id: id })
                    } catch (e) {}
                }
            }

            await fetchAdminData()
            return { success: true, count: idList.length }
        } catch (err) {
            console.error('[useHausmadeAdmin] Error batch updating orders:', err)
            return { success: false, error: err.message }
        }
    }

    return {
        loading,
        orders,
        settings,
        fetchAdminData,
        updateSettings,
        updateOrderStatus,
        updateBatchOrderStatus
    }
}
