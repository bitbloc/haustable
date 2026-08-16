import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { safeTimestampUrl } from '../utils/urlHelper'

export function useHausmadeShop() {
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [activeSubCategory, setActiveSubCategory] = useState('ALL')
    const [loading, setLoading] = useState(true)
    const [settings, setSettings] = useState({
        shippingFee: 50,
        freeShippingMinItems: 3,
        freeShippingMinAmount: 0,
        paymentQrUrl: '',
        bankAccountName: 'IN THE HAUS',
        bankAccountNo: '',
        bankName: 'Kasikorn Bank (KBank)'
    })

    // Cart State
    const [cart, setCart] = useState([])

    // Load HAUSMADE Items & Settings
    useEffect(() => {
        let isMounted = true
        async function fetchShopData() {
            try {
                setLoading(true)

                // 1. Fetch Categories & Menu Items
                const [catsRes, itemsRes, settingsRes] = await Promise.all([
                    supabase.from('menu_categories').select('*').order('display_order', { ascending: true }),
                    supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true),
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

                // Find category ID for "hausmade"
                const hausmadeCat = allCats.find(c => c.name.toLowerCase().includes('hausmade'))
                const hausmadeCatId = hausmadeCat ? hausmadeCat.id : null

                // Filter items that belong to hausmade category OR have is_hausmade tag
                const filteredItems = allItems.filter(item => {
                    if (hausmadeCatId && item.category_id === hausmadeCatId) return true
                    if (item.category && item.category.toLowerCase().includes('hausmade')) return true
                    if (item.is_hausmade === true) return true
                    return false
                })

                setCategories(allCats)
                setMenuItems(filteredItems.length > 0 ? filteredItems : allItems) // Fallback to all if category not tagged yet
            } catch (err) {
                console.error('[useHausmadeShop] Error loading shop data:', err)
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchShopData()
        return () => { isMounted = false }
    }, [])

    // Derive Sub-Categories (e.g., Coffee, Bottled, Merch, Sauces, All)
    const subCategories = useMemo(() => {
        const set = new Set()
        menuItems.forEach(item => {
            if (item.sub_category) set.add(item.sub_category)
            else if (item.tags && Array.isArray(item.tags)) item.tags.forEach(t => set.add(t))
        })
        const list = Array.from(set)
        return ['ALL', ...list]
    }, [menuItems])

    // Filtered Items by Sub-Category
    const displayedItems = useMemo(() => {
        if (activeSubCategory === 'ALL') return menuItems
        return menuItems.filter(item => {
            if (item.sub_category === activeSubCategory) return true
            if (item.tags && Array.isArray(item.tags) && item.tags.includes(activeSubCategory)) return true
            return false
        })
    }, [menuItems, activeSubCategory])

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

    // Calculate Dynamic Shipping Fee
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

    const totalAmount = useMemo(() => {
        return cartSubtotal + calculatedShippingFee
    }, [cartSubtotal, calculatedShippingFee])

    // Cart Actions
    const addToCart = (product, selectedOptions = {}, quantity = 1, optionsPrice = 0, optionsText = '') => {
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
    }

    const updateQuantity = (cartKey, delta) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.cartKey === cartKey) {
                    const newQty = item.quantity + delta
                    return newQty > 0 ? { ...item, quantity: newQty } : null
                }
                return item
            }).filter(Boolean)
        })
    }

    const removeFromCart = (cartKey) => {
        setCart(prev => prev.filter(i => i.cartKey !== cartKey))
    }

    const clearCart = () => {
        setCart([])
    }

    return {
        loading,
        menuItems,
        displayedItems,
        subCategories,
        activeSubCategory,
        setActiveSubCategory,
        settings,
        
        // Cart state & actions
        cart,
        cartItemCount,
        cartSubtotal,
        calculatedShippingFee,
        isFreeShipping,
        itemsNeededForFreeShipping,
        totalAmount,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart
    }
}
