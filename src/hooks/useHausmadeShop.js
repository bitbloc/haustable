import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { safeTimestampUrl } from '../utils/urlHelper'

const CART_STORAGE_KEY = 'hausmade_cart_items_v2'

export function useHausmadeShop() {
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [activeSubCategory, setActiveSubCategory] = useState('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('featured') // 'featured' | 'price_asc' | 'price_desc' | 'name_asc'
    const [loading, setLoading] = useState(true)
    const [settings, setSettings] = useState({
        shippingFee: 50,
        freeShippingMinItems: 3,
        freeShippingMinAmount: 0,
        paymentQrUrl: '',
        bankAccountName: 'IN THE HAUS',
        bankAccountNo: '',
        bankName: 'Kasikorn Bank (KBank)',
        storePhone: '098-528-4217'
    })

    // Cart State with LocalStorage initialization
    const [cart, setCart] = useState(() => {
        try {
            const saved = localStorage.getItem(CART_STORAGE_KEY)
            return saved ? JSON.parse(saved) : []
        } catch {
            return []
        }
    })

    // Sync Cart to LocalStorage
    useEffect(() => {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
        } catch (e) {
            console.error('Failed to sync cart to localStorage:', e)
        }
    }, [cart])

    // Load HAUSMADE Items & Settings
    useEffect(() => {
        let isMounted = true
        async function fetchShopData() {
            try {
                setLoading(true)

                // 1. Fetch Categories, Menu Items with Options, and Settings
                const [catsRes, itemsRes, settingsRes] = await Promise.all([
                    supabase.from('menu_categories').select('*').order('display_order', { ascending: true }),
                    supabase.from('menu_items').select('*, menu_categories(*), menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true),
                    supabase.from('app_settings').select('*')
                ])

                if (!isMounted) return

                const allCats = catsRes.data || []
                const allItems = itemsRes.data || []
                const allSettings = settingsRes.data || []

                // Map settings
                const settingsMap = allSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                setSettings({
                    shippingFee: Number(settingsMap.hausmade_shipping_fee ?? 50),
                    freeShippingMinItems: Number(settingsMap.hausmade_free_shipping_min_items ?? 3),
                    freeShippingMinAmount: Number(settingsMap.hausmade_free_shipping_min_amount ?? 0),
                    paymentQrUrl: safeTimestampUrl(settingsMap.payment_qr_url) || '',
                    bankAccountName: settingsMap.bank_account_name || 'IN THE HAUS',
                    bankAccountNo: settingsMap.bank_account_no || '123-4-56789-0',
                    bankName: settingsMap.bank_name || 'กสิกรไทย (KBank)',
                    storePhone: settingsMap.store_phone || '098-528-4217'
                })

                // Identify category IDs for "hausmade", "retail", "craft", etc.
                const hausmadeCatIds = new Set(
                    allCats
                        .filter(c => {
                            const name = (c.name || '').toLowerCase()
                            return name.includes('hausmade') || name.includes('retail') || name.includes('ของฝาก') || name.includes('สินค้า')
                        })
                        .map(c => c.id)
                )

                // Filter items that belong to hausmade category OR have is_hausmade tag OR match retail keywords
                const filteredItems = allItems.filter(item => {
                    if (item.is_hausmade === true) return true
                    if (item.category_id && hausmadeCatIds.has(item.category_id)) return true
                    const catName = ((item.menu_categories?.name || item.category || '')).toLowerCase()
                    if (catName.includes('hausmade') || catName.includes('retail') || catName.includes('ของฝาก')) return true
                    return false
                })

                setCategories(allCats)
                // Fallback to all items if specific hausmade tags are not yet configured in DB
                setMenuItems(filteredItems.length > 0 ? filteredItems : allItems)
            } catch (err) {
                console.error('[useHausmadeShop] Error loading shop data:', err)
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchShopData()
        return () => { isMounted = false }
    }, [])

    // Derive Sub-Categories with item counts
    const subCategories = useMemo(() => {
        const counts = { ALL: menuItems.length }
        const tags = new Set()

        menuItems.forEach(item => {
            const sub = item.sub_category || item.menu_categories?.name || item.category
            if (sub) {
                tags.add(sub)
                counts[sub] = (counts[sub] || 0) + 1
            }
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach(t => {
                    tags.add(t)
                    counts[t] = (counts[t] || 0) + 1
                })
            }
        })

        const list = ['ALL', ...Array.from(tags)]
        return list.map(name => ({
            name,
            count: counts[name] || 0
        }))
    }, [menuItems])

    // Filtered & Sorted Items
    const displayedItems = useMemo(() => {
        let result = [...menuItems]

        // 1. Subcategory filter
        if (activeSubCategory !== 'ALL') {
            result = result.filter(item => {
                const sub = item.sub_category || item.menu_categories?.name || item.category
                if (sub === activeSubCategory) return true
                if (item.tags && Array.isArray(item.tags) && item.tags.includes(activeSubCategory)) return true
                return false
            })
        }

        // 2. Search query filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim()
            result = result.filter(item => {
                const name = (item.name || '').toLowerCase()
                const desc = (item.description || '').toLowerCase()
                const cat = (item.menu_categories?.name || item.category || '').toLowerCase()
                return name.includes(q) || desc.includes(q) || cat.includes(q)
            })
        }

        // 3. Sorting
        if (sortBy === 'price_asc') {
            result.sort((a, b) => (a.price || 0) - (b.price || 0))
        } else if (sortBy === 'price_desc') {
            result.sort((a, b) => (b.price || 0) - (a.price || 0))
        } else if (sortBy === 'name_asc') {
            result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'))
        }

        return result
    }, [menuItems, activeSubCategory, searchQuery, sortBy])

    // Cart Calculations
    const cartItemCount = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.quantity, 0)
    }, [cart])

    const cartSubtotal = useMemo(() => {
        return cart.reduce((sum, item) => {
            const itemPrice = item.price + (item.optionsPrice || 0)
            return sum + (itemPrice * item.quantity)
        }, 0)
    }, [cart])

    // Dynamic Shipping Fee
    const calculatedShippingFee = useMemo(() => {
        if (cartItemCount === 0) return 0
        
        // Free shipping if item count reaches threshold
        if (settings.freeShippingMinItems > 0 && cartItemCount >= settings.freeShippingMinItems) {
            return 0
        }
        
        // Free shipping if amount reaches threshold
        if (settings.freeShippingMinAmount > 0 && cartSubtotal >= settings.freeShippingMinAmount) {
            return 0
        }

        return settings.shippingFee
    }, [cartItemCount, cartSubtotal, settings])

    const isFreeShipping = useMemo(() => {
        if (cartItemCount === 0) return false
        return calculatedShippingFee === 0
    }, [cartItemCount, calculatedShippingFee])

    const itemsNeededForFreeShipping = useMemo(() => {
        if (settings.freeShippingMinItems <= 0) return 0
        const diff = settings.freeShippingMinItems - cartItemCount
        return diff > 0 ? diff : 0
    }, [cartItemCount, settings.freeShippingMinItems])

    const amountNeededForFreeShipping = useMemo(() => {
        if (settings.freeShippingMinAmount <= 0) return 0
        const diff = settings.freeShippingMinAmount - cartSubtotal
        return diff > 0 ? diff : 0
    }, [cartSubtotal, settings.freeShippingMinAmount])

    const totalAmount = useMemo(() => {
        return cartSubtotal + calculatedShippingFee
    }, [cartSubtotal, calculatedShippingFee])

    // Cart Actions
    const addToCart = useCallback((product, selectedOptions = {}, quantity = 1, optionsPrice = 0, optionsText = '') => {
        const cartKey = `${product.id}-${JSON.stringify(selectedOptions)}`
        
        setCart(prev => {
            const existingIndex = prev.findIndex(i => i.cartKey === cartKey)
            if (existingIndex > -1) {
                const next = [...prev]
                next[existingIndex].quantity += quantity
                return next
            } else {
                return [...prev, {
                    cartKey,
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image_url: product.image_url,
                    selectedOptions,
                    optionsPrice,
                    optionsText,
                    quantity
                }]
            }
        })
    }, [])

    const updateQuantity = useCallback((cartKey, delta) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.cartKey === cartKey) {
                    const newQty = item.quantity + delta
                    return newQty > 0 ? { ...item, quantity: newQty } : null
                }
                return item
            }).filter(Boolean)
        })
    }, [])

    const removeFromCart = useCallback((cartKey) => {
        setCart(prev => prev.filter(i => i.cartKey !== cartKey))
    }, [])

    const clearCart = useCallback(() => {
        setCart([])
        try {
            localStorage.removeItem(CART_STORAGE_KEY)
        } catch {}
    }, [])

    return {
        loading,
        menuItems,
        displayedItems,
        subCategories,
        activeSubCategory,
        setActiveSubCategory,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        settings,
        
        // Cart state & actions
        cart,
        cartItemCount,
        cartSubtotal,
        calculatedShippingFee,
        isFreeShipping,
        itemsNeededForFreeShipping,
        amountNeededForFreeShipping,
        totalAmount,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart
    }
}

