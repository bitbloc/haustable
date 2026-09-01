import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { safeTimestampUrl } from '../utils/urlHelper'
import {
    calculateCoinsEarned,
    calculateCoinsDiscount,
    calculateMemberTier,
    parseTiersConfig,
    DEFAULT_CRM_TIERS,
    DEFAULT_CRM_SETTINGS
} from '../utils/crmHelper'

const CART_STORAGE_KEY = 'hausmade_cart_items_v2'

export function isPreOrderItem(item) {
    if (!item) return false
    if (item.is_preorder === true) return true
    if (item.preorder_eta || item.preorder_release_date || item.preorder_delivery_date) return true
    const tags = Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : [])
    if (tags.some(t => {
        const s = String(t).toLowerCase()
        return s.includes('preorder') || s.includes('pre-order') || s.includes('พรีออเดอร์') || s.includes('เปิดจอง')
    })) return true
    const sub = (item.sub_category || '').toLowerCase()
    if (sub.includes('preorder') || sub.includes('pre-order') || sub.includes('พรีออเดอร์') || sub.includes('เปิดจอง')) return true
    const name = (item.name || '').toLowerCase()
    if (name.includes('[pre-order]') || name.includes('pre-order') || name.includes('พรีออเดอร์') || name.includes('เปิดจอง')) return true
    const desc = (item.description || '').toLowerCase()
    if (desc.includes('[pre-order') || desc.includes('พรีออเดอร์') || desc.includes('เปิดจอง')) return true
    return false
}

export function getPreOrderEta(item) {
    if (!item) return ''
    if (item.preorder_eta || item.preorder_release_date || item.preorder_delivery_date || item.metadata?.preorder_eta) {
        return item.preorder_eta || item.preorder_release_date || item.preorder_delivery_date || item.metadata?.preorder_eta
    }
    if (item.description) {
        const match = item.description.match(/\[PRE-ORDER\s+รอบส่ง:\s*([^\]]+)\]/i) || 
                      item.description.match(/\[รอบส่ง:\s*([^\]]+)\]/i) || 
                      item.description.match(/\[ETA:\s*([^\]]+)\]/i)
        if (match) return match[1].trim()
    }
    return 'จัดส่งตามรอบการผลิต (ภายใน 5-7 วันทำการ)'
}

export function useHausmadeShop() {
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [activeSubCategory, setActiveSubCategory] = useState('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('featured') // 'featured' | 'price_asc' | 'price_desc' | 'name_asc' | 'preorder'
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

    // CRM Settings & Member Profile State
    const [crmSettings, setCrmSettings] = useState(DEFAULT_CRM_SETTINGS)
    const [crmTiers, setCrmTiers] = useState(DEFAULT_CRM_TIERS)
    const [memberProfile, setMemberProfile] = useState(null)
    const [redeemedCoinsInput, setRedeemedCoinsInput] = useState(0)

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

    // Load HAUSMADE Items & Settings + Member CRM Profile
    useEffect(() => {
        let isMounted = true

        async function fetchShopData() {
            try {
                // 1. Fetch Categories, Menu Items with Options, Settings, and Current User Profile
                const [catsRes, itemsRes, settingsRes, authUserRes] = await Promise.all([
                    supabase.from('menu_categories').select('*').order('display_order', { ascending: true }),
                    supabase.from('menu_items').select('*, menu_categories(*), menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true),
                    supabase.from('app_settings').select('key, value').not('key', 'in', '("tax_signature_image")'),
                    supabase.auth.getUser()
                ])

                if (!isMounted) return

                const allCats = catsRes.data || []
                const allItems = itemsRes.data || []
                const allSettings = settingsRes.data || []

                // Map general & CRM settings
                const settingsMap = allSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                setSettings({
                    shippingFee: Number(settingsMap.hausmade_shipping_fee ?? 50),
                    freeShippingMinItems: Number(settingsMap.hausmade_free_shipping_min_items ?? 3),
                    freeShippingMinAmount: Number(settingsMap.hausmade_free_shipping_min_amount ?? 0),
                    paymentQrUrl: safeTimestampUrl(settingsMap.payment_qr_url) || '',
                    promptpayId: settingsMap.promptpay_id || '',
                    promptpayName: settingsMap.promptpay_name || settingsMap.bank_account_name || 'IN THE HAUS',
                    trueWalletPhone: settingsMap.truewallet_phone || '',
                    trueWalletName: settingsMap.truewallet_account_name || '',
                    trueWalletQrUrl: safeTimestampUrl(settingsMap.truewallet_qr_url) || '',
                    easySlipEnabled: settingsMap.easyslip_enabled_pickup !== 'false',
                    bankAccountName: settingsMap.bank_account_name || 'IN THE HAUS',
                    bankAccountNo: settingsMap.bank_account_no || '123-4-56789-0',
                    bankName: settingsMap.bank_name || 'กสิกรไทย (KBank)',
                    storePhone: settingsMap.store_phone || '098-528-4217'
                })

                setCrmSettings({
                    crm_welcome_xhaus: settingsMap.crm_welcome_xhaus || DEFAULT_CRM_SETTINGS.crm_welcome_xhaus,
                    crm_redeem_rate_xhaus: settingsMap.crm_redeem_rate_xhaus || DEFAULT_CRM_SETTINGS.crm_redeem_rate_xhaus,
                    crm_min_redeem_xhaus: settingsMap.crm_min_redeem_xhaus || DEFAULT_CRM_SETTINGS.crm_min_redeem_xhaus,
                    crm_base_spend_amount: settingsMap.crm_base_spend_amount || DEFAULT_CRM_SETTINGS.crm_base_spend_amount,
                    crm_max_redeem_percent: settingsMap.crm_max_redeem_percent || DEFAULT_CRM_SETTINGS.crm_max_redeem_percent,
                    crm_tier_eval_months: settingsMap.crm_tier_eval_months || DEFAULT_CRM_SETTINGS.crm_tier_eval_months,
                    crm_grace_period_days: settingsMap.crm_grace_period_days || DEFAULT_CRM_SETTINGS.crm_grace_period_days
                })

                if (settingsMap.crm_tiers_config) {
                    setCrmTiers(parseTiersConfig(settingsMap.crm_tiers_config))
                }

                // Fetch Profile for CRM if logged in
                const user = authUserRes.data?.user
                if (user) {
                    const { data: prof } = await supabase
                        .from('profiles')
                        .select('id, display_name, nickname, phone_number, current_tier, xhaus_balance, total_spent_12m, total_spent_13m')
                        .eq('id', user.id)
                        .single()

                    if (prof && isMounted) {
                        setMemberProfile(prof)
                    }
                }

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
                setMenuItems(filteredItems.length > 0 ? filteredItems : allItems)
            } catch (err) {
                console.error('[useHausmadeShop] Error loading shop data:', err)
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchShopData()

        let debounceTimer = null
        const handleRealtimeSync = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                if (isMounted) fetchShopData()
            }, 300)
        }

        const channelId = `hausmade-shop-live-${Math.random().toString(36).slice(2, 8)}`
        const channel = supabase.channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, handleRealtimeSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, handleRealtimeSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_item_options' }, handleRealtimeSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'option_groups' }, handleRealtimeSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'option_choices' }, handleRealtimeSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, handleRealtimeSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleRealtimeSync)
            .subscribe()

        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible' && isMounted) {
                fetchShopData()
            }
        }

        window.addEventListener('focus', handleVisibilityOrFocus)
        document.addEventListener('visibilitychange', handleVisibilityOrFocus)

        return () => {
            isMounted = false
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
            window.removeEventListener('focus', handleVisibilityOrFocus)
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
        }
    }, [])

    // Derive Sub-Categories with item counts
    const subCategories = useMemo(() => {
        const counts = { ALL: menuItems.length }
        const tags = new Set()
        let preOrderCount = 0

        menuItems.forEach(item => {
            if (isPreOrderItem(item)) {
                preOrderCount++
            }
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

        const baseList = ['ALL']
        if (preOrderCount > 0) {
            baseList.push('PRE-ORDER')
            counts['PRE-ORDER'] = preOrderCount
        }

        const tagList = Array.from(tags).filter(t => t !== 'PRE-ORDER')
        const list = [...baseList, ...tagList]
        
        return list.map(name => ({
            name,
            count: counts[name] || 0
        }))
    }, [menuItems])

    // Filtered & Sorted Items
    const displayedItems = useMemo(() => {
        let result = [...menuItems]

        // 1. Subcategory filter
        if (activeSubCategory === 'PRE-ORDER') {
            result = result.filter(item => isPreOrderItem(item))
        } else if (activeSubCategory !== 'ALL') {
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
        } else if (sortBy === 'preorder') {
            result.sort((a, b) => (isPreOrderItem(b) ? 1 : 0) - (isPreOrderItem(a) ? 1 : 0))
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

    // Pre-order detection in cart
    const hasPreOrderInCart = useMemo(() => {
        return cart.some(i => i.isPreOrder || isPreOrderItem(i))
    }, [cart])

    const preOrderItemsInCart = useMemo(() => {
        return cart.filter(i => i.isPreOrder || isPreOrderItem(i))
    }, [cart])

    // Dynamic Shipping Fee Calculation
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

    // --- CRM xhaus Loyalty Calculations ---
    const memberTierInfo = useMemo(() => {
        if (!memberProfile) return null
        return calculateMemberTier(
            memberProfile.total_spent_12m || 0,
            memberProfile.total_spent_13m || 0,
            crmTiers
        )
    }, [memberProfile, crmTiers])

    const memberMultiplier = memberTierInfo?.multiplier || 1.0
    const availableXhausBalance = Number(memberProfile?.xhaus_balance || 0)

    // Projected coins customer will earn on this order
    const projectedCoinsEarned = useMemo(() => {
        if (cartSubtotal <= 0) return 0
        return calculateCoinsEarned(
            cartSubtotal,
            memberMultiplier,
            Number(crmSettings.crm_base_spend_amount || 100)
        )
    }, [cartSubtotal, memberMultiplier, crmSettings])

    // xhaus coins discount calculation
    const xhausDiscountCalculation = useMemo(() => {
        if (!memberProfile || redeemedCoinsInput <= 0) {
            return { discountAmount: 0, effectiveCoinsRedeemed: 0, maxRedeemableCoins: 0, error: null }
        }

        return calculateCoinsDiscount(
            Math.min(redeemedCoinsInput, availableXhausBalance),
            Number(crmSettings.crm_redeem_rate_xhaus || 1.0),
            Number(crmSettings.crm_max_redeem_percent || 100),
            cartSubtotal,
            Number(crmSettings.crm_min_redeem_xhaus || 10)
        )
    }, [memberProfile, redeemedCoinsInput, availableXhausBalance, crmSettings, cartSubtotal])

    const xhausDiscountAmount = xhausDiscountCalculation.discountAmount || 0
    const effectiveXhausRedeemed = xhausDiscountCalculation.effectiveCoinsRedeemed || 0

    const totalAmount = useMemo(() => {
        const netAfterXhaus = Math.max(0, cartSubtotal - xhausDiscountAmount)
        return netAfterXhaus + calculatedShippingFee
    }, [cartSubtotal, xhausDiscountAmount, calculatedShippingFee])

    // Cart Actions
    const addToCart = useCallback((product, selectedOptions = {}, quantity = 1, optionsPrice = 0, optionsText = '') => {
        const cartKey = `${product.id}-${JSON.stringify(selectedOptions)}`
        const isPreOrder = isPreOrderItem(product)
        const preOrderEta = isPreOrder ? getPreOrderEta(product) : ''

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
                    quantity,
                    isPreOrder,
                    preOrderEta
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
        setRedeemedCoinsInput(0)
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
        hasPreOrderInCart,
        preOrderItemsInCart,
        calculatedShippingFee,
        isFreeShipping,
        itemsNeededForFreeShipping,
        amountNeededForFreeShipping,
        totalAmount,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,

        // CRM Loyalty & xhaus state
        memberProfile,
        memberTierInfo,
        availableXhausBalance,
        projectedCoinsEarned,
        redeemedCoinsInput,
        setRedeemedCoinsInput,
        xhausDiscountAmount,
        effectiveXhausRedeemed,
        xhausDiscountCalculation,

        // Helper functions
        isPreOrderItem,
        getPreOrderEta
    }
}
