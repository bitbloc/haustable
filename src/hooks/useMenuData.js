import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchAndSortMenu, invalidateMenuCache } from '../utils/menuHelper'
import { supabase } from '../lib/supabaseClient'

// live: keep a realtime channel on the menu tables (only while the menu is on screen).
// The fetch itself is shared with BookingContext through menuHelper's cache / in-flight promise.
export function useMenuData({ live = true } = {}) {
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const isMountedRef = useRef(true)

    const loadMenu = useCallback(async (force = false) => {
        if (isMountedRef.current) setError(null)
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
        return () => { isMountedRef.current = false }
    }, [loadMenu])

    useEffect(() => {
        if (!live) return
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

        let focusDebounceTimer = null
        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible' && isMountedRef.current) {
                if (focusDebounceTimer) clearTimeout(focusDebounceTimer)
                focusDebounceTimer = setTimeout(() => {
                    if (isMountedRef.current) loadMenu(false)
                }, 500)
            }
        }

        window.addEventListener('focus', handleVisibilityOrFocus)
        document.addEventListener('visibilitychange', handleVisibilityOrFocus)

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            if (focusDebounceTimer) clearTimeout(focusDebounceTimer)
            supabase.removeChannel(channel)
            window.removeEventListener('focus', handleVisibilityOrFocus)
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
        }
    }, [loadMenu, live])

    return { menuItems, categories, loading, error, refreshMenu: () => { setLoading(true); return loadMenu(true) } }
}
