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
                supabase.from('app_settings').select('*')
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
                    senderTaxId: map.sender_tax_id || '0485566001234'
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

            const { error } = await supabase
                .from('bookings')
                .update(payload)
                .eq('id', orderId)

            if (error) throw error

            // Refresh orders list
            await fetchAdminData()
            return { success: true }
        } catch (err) {
            console.error('[useHausmadeAdmin] Error updating order status:', err)
            return { success: false, error: err.message }
        }
    }

    return {
        loading,
        orders,
        settings,
        fetchAdminData,
        updateSettings,
        updateOrderStatus
    }
}
