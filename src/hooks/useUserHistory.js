import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useUserHistory(session) {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Derived state
    const activeOrders = orders.filter(o => 
        ['pending', 'confirmed', 'preparing', 'seated', 'ready'].includes(o.status?.toLowerCase())
    )
    const pastOrders = orders.filter(o => 
        ['completed', 'cancelled', 'rejected', 'void'].includes(o.status?.toLowerCase())
    )
    const hasActiveOrder = activeOrders.length > 0

    useEffect(() => {
        if (!session?.user) {
            setOrders([])
            setLoading(false)
            return
        }

        const fetchHistory = async () => {
            try {
                setLoading(true)
                // Corrected: Use 'user_id' instead of 'customer_id' as per schema
                const { data, error } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('user_id', session.user.id)
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

        // Realtime subscription for updates
        const subscription = supabase
            .channel('public:bookings:history')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'bookings',
                filter: `user_id=eq.${session.user.id}`
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
