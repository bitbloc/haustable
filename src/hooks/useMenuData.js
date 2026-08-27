import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchAndSortMenu, invalidateMenuCache } from '../utils/menuHelper'
import { supabase } from '../lib/supabaseClient'

export function useMenuData() {
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const isMountedRef = useRef(true)

    const loadMenu = useCallback(async (force = false) => {
        try {
            if (force) invalidateMenuCache()
            const { menuItems: sorted, categories: cats } = await fetchAndSortMenu(force)
            if (isMountedRef.current) {
                setMenuItems(sorted || [])
                setCategories(cats || [])
            }
        } catch (err) {
            console.error("Failed to load menu:", err)
            if (isMountedRef.current) setError(err)
        } finally {
            if (isMountedRef.current) setLoading(false)
        }
    }, [])

    useEffect(() => {
        isMountedRef.current = true
        loadMenu(false)

        let debounceTimer = null
        const handleRealtimeChange = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                if (isMountedRef.current) {
                    loadMenu(true)
                }
            }, 300)
        }

        // Realtime Subscription on Menu Tables
        const channelId = `menu-data-sync-${Math.random().toString(36).slice(2, 8)}`
        const channel = supabase.channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_item_options' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'option_groups' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'option_choices' }, handleRealtimeChange)
            .subscribe()

        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible' && isMountedRef.current) {
                loadMenu(true)
            }
        }

        window.addEventListener('focus', handleVisibilityOrFocus)
        document.addEventListener('visibilitychange', handleVisibilityOrFocus)

        return () => {
            isMountedRef.current = false
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
            window.removeEventListener('focus', handleVisibilityOrFocus)
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
        }
    }, [loadMenu])

    return { menuItems, categories, loading, error, refreshMenu: () => loadMenu(true) }
}
