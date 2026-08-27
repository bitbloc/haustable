import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isValidUuid } from '../utils/urlHelper'

export function useUserHistory(session) {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Derived state
    const activeOrders = orders.filter(o => 
        ['pending', 'confirmed', 'preparing', 'seated', 'ready', 'approved', 'paid'].includes(o.status?.toLowerCase())
    )
    const pastOrders = orders.filter(o => 
        ['completed', 'cancelled', 'rejected', 'void'].includes(o.status?.toLowerCase())
    )
    const hasActiveOrder = activeOrders.length > 0

    useEffect(() => {
        const userId = session?.user?.id
        if (!userId || !isValidUuid(userId)) {
            setOrders([])
            setLoading(false)
            return
        }

        const fetchHistory = async () => {
            try {
                setLoading(true)
                const { data, error } = await supabase
                    .from('bookings')
                    .select(`
                        *,
                        order_items (
                            id,
                            quantity,
                            price_at_time,
                            custom_name,
                            selected_options,
                            menu_items (id, name, price)
                        )
                    `)
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })

                if (error) throw error

                setOrders(data || [])
            } catch (err) {
                console.error("Error fetching history:", err)
                setError(err)
            } finally {
                setLoading(false)
            }
        }

        fetchHistory()

        // Realtime subscription for updates with unique channel ID
        const channelId = `user-bookings-history-${userId.slice(0, 8)}-${Math.random().toString(36).slice(2, 6)}`
        const subscription = supabase
            .channel(channelId)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'bookings',
                filter: `user_id=eq.${userId}`
            }, (payload) => {
                // Determine action
                if (payload.eventType === 'INSERT') {
                    setOrders(prev => [payload.new, ...prev])
                } else if (payload.eventType === 'UPDATE') {
                    setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
                } else if (payload.eventType === 'DELETE') {
                    setOrders(prev => prev.filter(o => o.id !== payload.old.id))
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [session?.user?.id])

    return { 
        orders, 
        activeOrders, 
        pastOrders, 
        hasActiveOrder, 
        loading, 
        error 
    }
}
