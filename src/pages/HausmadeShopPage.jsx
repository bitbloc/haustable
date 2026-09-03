import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useHausmadeShop, isPreOrderItem, getPreOrderEta, getProductImages } from '../hooks/useHausmadeShop'
import { useServiceGuard } from '../hooks/useServiceGuard'
import HausmadeProductModal from '../components/hausmade/HausmadeProductModal'
import HausmadeCartDrawer from '../components/hausmade/HausmadeCartDrawer'
import AuthModal from '../components/AuthModal'

/**
 * Format product craft release date or batch identifier
 */
function getCraftDateTag(product) {
    if (!product) return '09.02.26'
    if (product.created_at) {
        try {
            const d = new Date(product.created_at)
            const day = String(d.getDate()).padStart(2, '0')
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const year = String(d.getFullYear()).slice(-2)
            return `${day}.${month}.${year}`
        } catch {
            // fallback
        }
    }
    const idSnippet = String(product.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()
    return idSnippet ? `BATCH #${idSnippet}` : '09.02.26'
}

export default function HausmadeShopPage() {
    const isChecking = useServiceGuard('shop_mode_hausmade')
    const shopState = useHausmadeShop()
    const {
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
        cartItemCount,
        hasPreOrderInCart,
        totalAmount,
        addToCart,
        settings,
        memberProfile,
        isMember,
        activeOrders,
        hasActiveOrders,
        memberTierInfo,
        availableXhausBalance
    } = shopState

    const navigate = useNavigate()
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [showAuthModal, setShowAuthModal] = useState(false)
    const [heroSlideIdx, setHeroSlideIdx] = useState(0)

    // Quick Order Tracking State
    const [quickTrackQuery, setQuickTrackQuery] = useState('')
    const [quickTrackLoading, setQuickTrackLoading] = useState(false)
    const [quickTrackError, setQuickTrackError] = useState('')

    const handleQuickTrack = async (e) => {
        e.preventDefault()
        const clean = quickTrackQuery.trim()
        if (!clean) return

        setQuickTrackLoading(true)
        setQuickTrackError('')

        try {
            // Search for matching booking by tracking_token, pickup_contact_phone, or phone
            const { data: match, error } = await supabase
                .from('bookings')
                .select('tracking_token, id')
                .or(`tracking_token.ilike.%${clean}%,pickup_contact_phone.ilike.%${clean}%,phone.ilike.%${clean}%`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (match && (match.tracking_token || match.id)) {
                navigate(`/tracking/${match.tracking_token || match.id}`)
            } else if (clean.length >= 4) {
                // If it looks like a direct token, attempt direct route
                navigate(`/tracking/${clean}`)
            } else {
                setQuickTrackError('ไม่พบข้อมูลคำสั่งซื้อ กรุณาตรวจสอบรหัส Token หรือเบอร์โทรศัพท์อีกครั้ง')
            }
        } catch (err) {
            console.warn('Quick track lookup error:', err)
            setQuickTrackError('เกิดข้อผิดพลาดในการตรวจสอบ กรุณาลองใหม่อีกครั้ง')
        } finally {
            setQuickTrackLoading(false)
        }
    }

    // Featured Hero Items (items marked is_featured or first 4 items with images)
    const heroItems = useMemo(() => {
        const withImg = menuItems.filter(i => i.image_url)
        const featured = withImg.filter(i => i.is_featured === true || i.is_recommended === true || i.is_hero_featured === true)
        return (featured.length > 0 ? featured : withImg).slice(0, 4)
    }, [menuItems])

    // Other featured releases (all items excluding the current hero item)
    const featuredSidebarItems = useMemo(() => {
        const currentHero = heroItems[heroSlideIdx] || heroItems[0]
        const available = menuItems.filter(i => i.image_url && i.id !== currentHero?.id)
        if (available.length > 0) return available.slice(0, 3)
        // If only 1 item total in catalog, fallback to showing other menu items
        return menuItems.filter(i => i.id !== currentHero?.id).slice(0, 3)
    }, [menuItems, heroItems, heroSlideIdx])

    // Spotlight mid-page item
    const spotlightItem = useMemo(() => {
        return menuItems.find(i => isPreOrderItem(i) && i.image_url) || menuItems[menuItems.length - 1] || heroItems[0]
    }, [menuItems, heroItems])

    // Auto-advance hero carousel every 8s
    useEffect(() => {
        if (heroItems.length <= 1) return
        const timer = setInterval(() => {
            setHeroSlideIdx(prev => (prev + 1) % heroItems.length)
        }, 8000)
        return () => clearInterval(timer)
    }, [heroItems.length])

    if (isChecking) {
        return (
            <div className="min-h-screen bg-[var(--color-paper)] flex flex-col items-center justify-center text-[var(--color-ink)] font-mono text-xs uppercase tracking-widest gap-3 select-none">
                <div className="w-6 h-6 rounded-full border-2 border-[var(--color-rule)] border-t-[var(--color-ink)] animate-spin" />
                <span>CHECKING HAUSMADE SHOP STATUS...</span>
            </div>
        )
    }

    /**
     * Corrected Product Action Handler
     * Fixed the null <= 0 coercion bug so options modal opens reliably!
     */
    const handleProductAction = (product) => {
        if (!product) return

        const isSoldOut = product.is_available === false || 
            (product.stock_quantity !== null && product.stock_quantity !== undefined && product.stock_quantity <= 0) || 
            (product.remaining_stock !== null && product.remaining_stock !== undefined && product.remaining_stock <= 0)
        
        if (isSoldOut) return

        const optionGroups = product.menu_item_options?.map(o => o.option_groups).filter(Boolean) || []
        if (optionGroups.length > 0) {
            setSelectedProduct(product)
        } else {
            addToCart(product, {}, 1, 0, '')
            setIsCartOpen(true)
        }
    }

    const currentHeroItem = heroItems[heroSlideIdx] || heroItems[0]

    // Split displayed items into latest grid (first 4 items) and remaining catalog
    const latestItems = displayedItems.slice(0, 4)
    const remainingItems = displayedItems.slice(4)

    return (
        <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] font-sans flex flex-col selection:bg-[var(--color-accent-yellow)] selection:text-[var(--color-ink)]">
            
            {/* 1. Top Ticker Marquee Announcement */}
            <div className="bg-[var(--color-ink)] text-[var(--color-paper)] border-b border-[var(--color-rule)] h-8 flex items-center overflow-hidden z-20">
                <motion.div
                    className="whitespace-nowrap flex gap-12 font-mono text-[9px] uppercase tracking-normal"
                    animate={{ x: ['0%', '-50%'] }}
                    transition={{ repeat: Infinity, duration: 24, ease: 'linear' }}
                >
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-6">
                            <span className="text-[var(--color-accent-yellow)] font-bold">
                                // HAUSMADE ONLINE STORE
                            </span>
                            <span>
                                CRAFTED & ROASTED IN NAKHON PHANOM, THAILAND
                            </span>
                            <span>
                                🚚 ค่าจัดส่ง ฿{settings.shippingFee}.- {settings.freeShippingMinItems > 0 ? `(ซื้อครบ ${settings.freeShippingMinItems} ชิ้น ส่งฟรี!)` : ''}
                            </span>
                            <span className="w-1.5 h-1.5 bg-[var(--color-accent-yellow)]" />
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* 2. Top Brutalist Navigation Bar */}
            <nav className="sticky top-0 z-30 bg-[var(--color-paper)]/95 backdrop-blur-md border-b border-[var(--color-rule)] px-4 sm:px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        to="/"
                        className="font-mono text-xs font-bold text-[var(--color-neutral)] hover:text-[var(--color-ink)] transition-colors px-2.5 py-1 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                    >
                        [ ← HOME // หน้าหลัก ]
                    </Link>
                    <span className="font-mono text-xs text-[var(--color-rule)] hidden sm:inline">/</span>
                    <span className="font-mono text-[11px] font-bold text-[var(--color-neutral)] uppercase tracking-wider hidden sm:inline">
                        IN THE HAUS ATELIER
                    </span>
                </div>

                {/* Center Title on mobile */}
                <img
                    src="/hausmade-logo.png"
                    alt="hausmade."
                    className="h-4.5 w-auto object-contain sm:hidden"
                />

                {/* Member CRM Status & Cart Trigger */}
                <div className="flex items-center gap-3">
                    {isMember ? (
                        <Link
                            to="/member-card"
                            className="hidden md:flex items-center gap-2 font-mono text-[11px] px-3 py-1.5 border border-[var(--color-rule)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] transition-colors text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                        >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: memberTierInfo?.color_accent || '#C84B31' }} />
                            <span className="font-bold">{memberProfile?.display_name || memberProfile?.nickname || memberTierInfo?.name || 'MEMBER'}</span>
                            <span className="text-[var(--color-neutral)]">({(memberProfile?.xhaus_balance ?? availableXhausBalance).toLocaleString()} xhaus)</span>
                        </Link>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowAuthModal(true)}
                            className="hidden md:block font-mono text-[11px] text-[var(--color-ink)] hover:underline uppercase font-bold cursor-pointer px-2 py-1 border border-transparent hover:border-[var(--color-rule)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                        >
                            [ 🔑 LOG IN / สมาชิก ]
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setIsCartOpen(true)}
                        className="relative px-3.5 py-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-accent-yellow)] hover:text-[var(--color-ink)] transition-colors font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-2.5 border border-[var(--color-ink)] shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                    >
                        <span>[ CART ({cartItemCount}) ]</span>
                        {cartItemCount > 0 && (
                            <span className="border-l border-[var(--color-paper)]/30 pl-2 text-[var(--color-accent-yellow)] group-hover:text-[var(--color-ink)]">
                                ฿{totalAmount.toLocaleString()}.-
                            </span>
                        )}
                    </button>
                </div>
            </nav>

            {/* Active Orders In Progress Notification Bar */}
            {hasActiveOrders && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 sm:px-8 py-2.5 font-mono text-xs text-amber-950 flex items-center justify-between">
                    <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span>📦</span>
                            <span className="font-bold">[ คุณมีคำสั่งซื้อที่กำลังดำเนินการ {activeOrders.length} รายการ ]</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCartOpen(true)}
                            className="underline font-bold text-[var(--color-ink)] hover:text-[var(--color-accent)] cursor-pointer text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                        >
                            [ ดูสถานะคำสั่งซื้อ ➔ ]
                        </button>
                    </div>
                </div>
            )}

            {/* 3. Massive Official Logo Masthead */}
            <header className="w-full bg-[var(--color-paper)] pt-8 pb-6 px-4 sm:px-8 text-center border-b border-[var(--color-rule)]">
                <div className="max-w-6xl mx-auto flex flex-col items-center">
                    <img
                        src="/hausmade-logo.png"
                        alt="hausmade."
                        className="h-14 sm:h-20 md:h-26 w-auto max-w-full object-contain select-none transition-transform"
                    />
                    <div className="mt-3 flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-[var(--color-neutral)]">
                        <span>// CRAFT & SPECIALTY ATELIER</span>
                        <span>·</span>
                        <span>CRAFTED IN NAKHON PHANOM, THAILAND</span>
                    </div>
                </div>
            </header>

            {/* 4. High-Contrast Sunny Yellow Topics / Category Filter Pill Bar */}
            <section className="w-full bg-[var(--color-accent-yellow)] border-b border-[var(--color-ink)]/20 px-4 sm:px-8 py-2.5 z-20">
                <div className="max-w-6xl mx-auto flex items-center gap-3 overflow-x-auto scrollbar-none">
                    <span className="font-mono text-xs font-extrabold text-[var(--color-ink)] tracking-wider uppercase whitespace-nowrap">
                        TOPICS:
                    </span>
                    <div className="flex items-center gap-2 flex-nowrap">
                        {subCategories.map((subCat) => {
                            const isActive = activeSubCategory === subCat.name
                            return (
                                <button
                                    key={subCat.name}
                                    type="button"
                                    onClick={() => setActiveSubCategory(subCat.name)}
                                    className={`px-3.5 py-1 rounded-full font-mono text-[11px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 ${
                                        isActive
                                            ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-xs'
                                            : 'bg-transparent text-[var(--color-ink)] border border-[var(--color-ink)]/40 hover:border-[var(--color-ink)] hover:bg-black/5'
                                    }`}
                                >
                                    {subCat.name}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* 5. Main Content Area */}
            <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-12 flex-grow">

                {/* SECTION A: Split Featured Hero Showcase & Curated Drops */}
                {currentHeroItem && (
                    <section className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] overflow-hidden shadow-2xs">
                        <div className="grid grid-cols-1 lg:grid-cols-12">
                            
                            {/* Left Hero Story Box (Yellow Block Split with Photo) */}
                            <div className={`${featuredSidebarItems.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'} grid grid-cols-1 md:grid-cols-12 border-b lg:border-b-0 ${featuredSidebarItems.length > 0 ? 'lg:border-r' : ''} border-[var(--color-rule)]`}>
                                
                                {/* Yellow Editorial Tag Block (Full Bilingual Description Display) */}
                                <div className="md:col-span-5 bg-[var(--color-accent-yellow)] p-6 sm:p-8 flex flex-col justify-between gap-5 border-b md:border-b-0 md:border-r border-[var(--color-ink)]/15">
                                    <div className="flex flex-col gap-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-[10px] font-extrabold text-[var(--color-ink)]/80 uppercase">
                                                {getCraftDateTag(currentHeroItem)}
                                            </span>
                                            {isPreOrderItem(currentHeroItem) ? (
                                                <span className="font-mono text-[9px] font-bold bg-[var(--color-ink)] text-[var(--color-paper)] px-2 py-0.5 rounded-sm uppercase tracking-wider">
                                                    ⏳ PRE-ORDER
                                                </span>
                                            ) : (
                                                <span className="font-mono text-[9px] font-bold bg-[var(--color-ink)]/10 text-[var(--color-ink)] px-2 py-0.5 rounded-sm uppercase tracking-wider">
                                                    ● IN STOCK
                                                </span>
                                            )}
                                        </div>

                                        <h2
                                            onClick={() => setSelectedProduct(currentHeroItem)}
                                            className="font-sans text-xl sm:text-2xl font-black text-[var(--color-ink)] uppercase tracking-tight leading-snug cursor-pointer hover:underline"
                                        >
                                            {currentHeroItem.name}
                                        </h2>

                                        <span className="font-mono text-[10px] text-[var(--color-ink)]/70 uppercase tracking-wider font-bold">
                                            // {currentHeroItem.menu_categories?.name || currentHeroItem.category || 'HAUSMADE.'}
                                        </span>

                                        {/* Full Bilingual Description (Thai + English preserved with line breaks) */}
                                        {currentHeroItem.description && (
                                            <div className="font-sans text-xs sm:text-[13px] text-[var(--color-ink)]/90 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                                                {currentHeroItem.description}
                                            </div>
                                        )}

                                        {/* Pre-Order ETA Box if applicable */}
                                        {isPreOrderItem(currentHeroItem) && (
                                            <div className="p-2 bg-[var(--color-ink)]/10 border border-[var(--color-ink)]/20 font-mono text-[10px] text-[var(--color-ink)] font-bold flex items-center gap-1.5 mt-1">
                                                <span>📦</span>
                                                <span>รอบส่ง: {getPreOrderEta(currentHeroItem)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom Action Bar */}
                                    <div className="flex flex-col gap-3 pt-3 border-t border-[var(--color-ink)]/20">
                                        <div className="flex items-baseline justify-between">
                                            <span className="font-mono text-xl font-black text-[var(--color-ink)]">
                                                ฿{Number(currentHeroItem.price || 0).toLocaleString()}.-
                                            </span>
                                            <span className="font-mono text-[9px] text-[var(--color-ink)]/70 uppercase font-bold">
                                                BY: HAUS TEAM
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleProductAction(currentHeroItem)}
                                            className="w-full py-2.5 px-4 bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[oklch(12%_0.012_28)] font-mono text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                                        >
                                            {isPreOrderItem(currentHeroItem)
                                                ? '[ ⏳ สั่งจอง / PRE-ORDER ➔ ]'
                                                : '[ SELECT / สั่งซื้อ ➔ ]'
                                            }
                                        </button>
                                    </div>
                                </div>

                                {/* Hero Main Photo & Multi-Angle Thumbnails */}
                                <div className="md:col-span-7 relative bg-[var(--color-paper-2)] flex flex-col items-center justify-center overflow-hidden min-h-[300px] p-4 gap-2">
                                    <motion.img
                                        key={`${currentHeroItem.id}-${heroSlideIdx}`}
                                        initial={{ opacity: 0, scale: 0.97 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.35 }}
                                        loading="lazy"
                                        src={getProductImages(currentHeroItem)[0] || currentHeroItem.image_url}
                                        alt={currentHeroItem.name}
                                        onClick={() => setSelectedProduct(currentHeroItem)}
                                        className="w-full h-64 md:h-76 object-cover cursor-pointer hover:scale-102 transition-transform duration-500 shadow-xs"
                                    />

                                    {/* Multi-angle preview thumbnails */}
                                    {getProductImages(currentHeroItem).length > 1 && (
                                        <div className="flex items-center gap-1.5 self-start pt-1">
                                            <span className="font-mono text-[9px] text-[var(--color-neutral)] uppercase font-bold">
                                                [ {getProductImages(currentHeroItem).length} ANGLES ]:
                                            </span>
                                            {getProductImages(currentHeroItem).map((img, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setSelectedProduct(currentHeroItem)}
                                                    className="w-8 h-8 border border-[var(--color-rule)] overflow-hidden hover:border-[var(--color-ink)] cursor-pointer"
                                                >
                                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Slide switchers if multiple hero items */}
                                    {heroItems.length > 1 && (
                                        <div className="absolute top-3 right-3 bg-[var(--color-ink)]/80 backdrop-blur-xs text-[var(--color-paper)] px-2 py-1 font-mono text-[10px] flex gap-1 items-center">
                                            {heroItems.map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setHeroSlideIdx(idx)}
                                                    className={`w-3.5 h-1.5 transition-all cursor-pointer focus-visible:outline-none ${
                                                        idx === heroSlideIdx ? 'bg-[var(--color-accent-yellow)] w-6' : 'bg-white/50'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Hero Sidebar: Featured Releases / Curated Drops */}
                            {featuredSidebarItems.length > 0 && (
                                <div className="lg:col-span-4 p-5 sm:p-6 bg-[var(--color-paper)] flex flex-col justify-start gap-4">
                                    <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2.5">
                                        <span className="font-mono text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider">
                                            FEATURED RELEASES
                                        </span>
                                        <span className="font-mono text-[10px] text-[var(--color-neutral)]">
                                            [ {featuredSidebarItems.length} DROPS ]
                                        </span>
                                    </div>

                                    {/* Rich, Content-Packed Featured Cards */}
                                    <div className="flex flex-col gap-4">
                                        {featuredSidebarItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="group border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] p-3 flex flex-col gap-2.5 transition-all cursor-pointer"
                                                onClick={() => setSelectedProduct(item)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-20 h-20 bg-[var(--color-paper)] border border-[var(--color-rule)] flex-shrink-0 overflow-hidden">
                                                        <img
                                                            src={item.image_url}
                                                            alt={item.name}
                                                            loading="lazy"
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1 min-w-0 flex-grow">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className="font-mono text-[9px] text-[var(--color-neutral)] uppercase font-bold truncate">
                                                                // {item.menu_categories?.name || item.category || 'HAUSMADE.'}
                                                            </span>
                                                            {isPreOrderItem(item) && (
                                                                <span className="font-mono text-[8px] font-bold bg-[var(--color-ink)] text-[var(--color-paper)] px-1 py-0.2 rounded-xs uppercase">
                                                                    PRE-ORDER
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="font-sans text-xs font-bold text-[var(--color-ink)] uppercase tracking-tight line-clamp-1 group-hover:text-[var(--color-accent)]">
                                                            {item.name}
                                                        </h4>
                                                        <div className="font-mono text-xs font-bold text-[var(--color-ink)]">
                                                            ฿{Number(item.price || 0).toLocaleString()}.-
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Description Preview & Action */}
                                                {item.description && (
                                                    <p className="font-sans text-[11px] text-[var(--color-muted)] line-clamp-2 leading-relaxed">
                                                        {item.description}
                                                    </p>
                                                )}

                                                <div className="flex items-center justify-between pt-1 border-t border-[var(--color-rule)]/60 text-[10px] font-mono font-bold text-[var(--color-ink)]">
                                                    <span>{getCraftDateTag(item)}</span>
                                                    <span className="text-[var(--color-accent)] group-hover:translate-x-0.5 transition-transform">
                                                        [ SELECT OPTIONS ➔ ]
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* SECTION B: "THE LATEST" Header & Controls */}
                <section className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--color-rule)] pb-4">
                        <div>
                            <h3 className="font-mono text-sm sm:text-base font-extrabold text-[var(--color-ink)] uppercase tracking-wider">
                                THE LATEST
                            </h3>
                            <span className="font-mono text-[10px] text-[var(--color-neutral)] uppercase">
                                [ {displayedItems.length} ITEMS AVAILABLE ]
                            </span>
                        </div>

                        {/* Search & Sort Inline Controls */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="SEARCH / ค้นหา..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="px-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-mono text-[11px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] w-44 sm:w-56"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[var(--color-neutral)] hover:text-[var(--color-ink)] uppercase cursor-pointer"
                                    >
                                        [✕]
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-0.5">
                                {[
                                    { id: 'featured', label: 'RECOMMENDED' },
                                    { id: 'price_asc', label: 'PRICE: LOW' },
                                    { id: 'price_desc', label: 'PRICE: HIGH' },
                                    { id: 'name_asc', label: 'A-Z' }
                                ].map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setSortBy(s.id)}
                                        className={`px-2 py-1 font-mono text-[9px] font-bold uppercase transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)] ${
                                            sortBy === s.id
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                        }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 4-Column Product Grid for "THE LATEST" */}
                    {loading ? (
                        <div className="py-20 text-center font-mono text-xs text-[var(--color-neutral)] uppercase tracking-widest flex flex-col items-center gap-3">
                            <div className="w-5 h-5 rounded-full border-2 border-[var(--color-rule)] border-t-[var(--color-ink)] animate-spin" />
                            <span>[ LOADING HAUSMADE CATALOG... ]</span>
                        </div>
                    ) : latestItems.length === 0 ? (
                        <div className="py-16 text-center border border-dashed border-[var(--color-rule)] font-mono text-xs text-[var(--color-neutral)] uppercase flex flex-col items-center gap-3">
                            <span>[ NO ITEMS FOUND // ไม่พบสินค้าที่ค้นหา ]</span>
                            {(searchQuery || activeSubCategory !== 'ALL') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('')
                                        setActiveSubCategory('ALL')
                                    }}
                                    className="px-3 py-1 bg-[var(--color-ink)] text-[var(--color-paper)] font-mono text-[10px] font-bold uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                                >
                                    [ RESET FILTERS // แสดงทั้งหมด ]
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {latestItems.map((product) => (
                                <EditorialProductCard
                                    key={product.id}
                                    product={product}
                                    onSelectProduct={setSelectedProduct}
                                    onQuickAction={handleProductAction}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* SECTION C: Mid-Page Editorial Spotlight Banner (Matching Smalls Feature Banner) */}
                {spotlightItem && (
                    <section className="w-full relative border border-[var(--color-rule)] overflow-hidden shadow-2xs group bg-[var(--color-paper-2)]">
                        <div className="relative h-80 sm:h-96 w-full overflow-hidden">
                            <img
                                src={spotlightItem.image_url || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80'}
                                alt={spotlightItem.name}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-[var(--color-ink)]/25" />

                            {/* Floating Organic Yellow Card Badge Overlay */}
                            <div className="absolute top-6 left-6 max-w-xs sm:max-w-sm bg-[var(--color-accent-yellow)] p-6 sm:p-7 rounded-3xl shadow-xl flex flex-col gap-3 text-[var(--color-ink)]">
                                <div className="flex items-center justify-between font-mono text-[10px] font-bold">
                                    <span>{getCraftDateTag(spotlightItem)}</span>
                                    {isPreOrderItem(spotlightItem) && (
                                        <span className="bg-[var(--color-ink)] text-[var(--color-paper)] px-2 py-0.5 rounded-full text-[9px]">
                                            PRE-ORDER
                                        </span>
                                    )}
                                </div>

                                <h3 className="font-sans text-lg sm:text-xl font-black uppercase tracking-tight leading-tight">
                                    {spotlightItem.name}
                                </h3>

                                <p className="font-sans text-xs line-clamp-3 leading-relaxed text-[var(--color-ink)]/80 whitespace-pre-line">
                                    {spotlightItem.description || 'งานคราฟต์ต้นตำรับและรสชาติเอกลักษณ์ เสิร์ฟตรงจากริมแม่น้ำโขง นครพนม'}
                                </p>

                                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-ink)]/15">
                                    <span className="font-mono text-xs font-bold text-[var(--color-ink)]/70">
                                        BY: HAUS ATELIER
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleProductAction(spotlightItem)}
                                        className="px-3 py-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] font-mono text-[10px] font-bold uppercase rounded-full hover:bg-[oklch(12%_0.012_28)] cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                                    >
                                        [ ฿{spotlightItem.price}.- ORDER ➔ ]
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* SECTION D: Additional Catalog Grid */}
                {remainingItems.length > 0 && (
                    <section className="flex flex-col gap-6">
                        <div className="border-b border-[var(--color-rule)] pb-2 flex items-center justify-between">
                            <h3 className="font-mono text-xs sm:text-sm font-extrabold text-[var(--color-ink)] uppercase tracking-wider">
                                MORE FROM HAUSMADE
                            </h3>
                            <span className="font-mono text-[10px] text-[var(--color-neutral)]">
                                [ {remainingItems.length} ITEMS ]
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {remainingItems.map((product) => (
                                <EditorialProductCard
                                    key={product.id}
                                    product={product}
                                    onSelectProduct={setSelectedProduct}
                                    onQuickAction={handleProductAction}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* SECTION E: Dual Workbench — xhaus Membership Perks & Quick Order Tracking */}
                <section className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] grid grid-cols-1 md:grid-cols-12 overflow-hidden shadow-2xs">
                    
                    {/* Left Column: xhaus Club Membership & Loyalty Perks */}
                    <div className="md:col-span-6 p-6 sm:p-10 border-b md:border-b-0 md:border-r border-[var(--color-rule)] flex flex-col justify-between gap-6 bg-[var(--color-paper)]">
                        <div className="flex flex-col gap-3">
                            <span className="font-mono text-[10px] font-extrabold text-[var(--color-accent)] uppercase tracking-wider">
                                // XHAUS MEMBERSHIP & REWARDS
                            </span>
                            <h3 className="font-['Instrument_Serif',Georgia,serif] text-3xl sm:text-4xl text-[var(--color-ink)] tracking-tight font-normal lowercase leading-none">
                                join the haus club.
                            </h3>
                            <p className="font-sans text-xs sm:text-[13px] text-[var(--color-muted)] leading-relaxed mt-1">
                                ระบบสะสมแต้มและสิทธิประโยชน์สำหรับสมาชิกคนพิเศษของ IN THE HAUS เพลิดเพลินกับส่วนลดเงินสดและสิทธิสั่งจองสินค้าลิมิเต็ดก่อนใคร
                            </p>

                            <div className="grid grid-cols-1 gap-2.5 pt-2">
                                <div className="flex items-start gap-3 p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                                    <span className="text-base">🪙</span>
                                    <div className="flex flex-col">
                                        <span className="font-mono text-xs font-bold text-[var(--color-ink)] uppercase">
                                            สะสมแต้ม xhaus ทุกออเดอร์
                                        </span>
                                        <span className="text-[11px] text-[var(--color-muted)] mt-0.5 leading-normal font-sans">
                                            ทุก 1 บาท = 1 xhaus coin ใช้แลกส่วนลดเงินสดได้ทันทีในออเดอร์ถัดไป
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                                    <span className="text-base">📦</span>
                                    <div className="flex flex-col">
                                        <span className="font-mono text-xs font-bold text-[var(--color-ink)] uppercase">
                                            Early Access Pre-Orders
                                        </span>
                                        <span className="text-[11px] text-[var(--color-muted)] mt-0.5 leading-normal font-sans">
                                            รับสิทธิ์เปิดสั่งจองคอลเลกชันพิเศษและเมล็ดกาแฟล็อตหายากก่อนวางจำหน่ายทั่วไป
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Member Action Card */}
                        <div className="pt-4 border-t border-[var(--color-rule)]">
                            {isMember ? (
                                <div className="flex items-center justify-between gap-3 p-3 bg-[var(--color-accent-yellow)] border border-[var(--color-ink)]/15">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-[10px] uppercase font-bold text-[var(--color-ink)]/75">
                                            STATUS: {memberTierInfo?.name || 'MEMBER'}
                                        </span>
                                        <span className="font-mono text-sm font-bold text-[var(--color-ink)]">
                                            {(memberProfile?.xhaus_balance ?? availableXhausBalance).toLocaleString()} xhaus coins
                                        </span>
                                    </div>
                                    <Link
                                        to="/member-card"
                                        className="px-3.5 py-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] font-mono text-[11px] font-bold uppercase hover:bg-[oklch(12%_0.012_28)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                                    >
                                        [ 💳 บัตรสมาชิกของฉัน ➔ ]
                                    </Link>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowAuthModal(true)}
                                    className="w-full py-3 px-4 bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-accent-yellow)] hover:text-[var(--color-ink)] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-[var(--color-ink)] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 shadow-xs"
                                >
                                    <span>[ 🔑 เข้าสู่ระบบ / สมัครสมาชิกรับ 10 xhaus ➔ ]</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Realtime Order & Parcel Tracking Search */}
                    <div className="md:col-span-6 p-6 sm:p-10 flex flex-col justify-between gap-6 bg-[var(--color-paper-warm)] relative">
                        <div className="flex flex-col gap-3">
                            <span className="font-mono text-[10px] font-extrabold text-[var(--color-ink)]/80 uppercase tracking-wider">
                                // REALTIME LOGISTICS & TRACKING
                            </span>
                            <h3 className="font-['Instrument_Serif',Georgia,serif] text-3xl sm:text-4xl text-[var(--color-ink)] tracking-tight font-normal lowercase leading-none">
                                track your order.
                            </h3>
                            <p className="font-sans text-xs sm:text-[13px] text-[var(--color-ink)]/80 leading-relaxed mt-1">
                                กรอกรหัสติดตามคำสั่งซื้อ (เช่น <strong className="font-mono">HM-XXXX</strong>) หรือเบอร์โทรศัพท์ที่ใช้สั่งซื้อ เพื่อตรวจสอบขั้นตอนการผลิตและเลขพัสดุขนส่งแบบเรียลไทม์
                            </p>

                            <form onSubmit={handleQuickTrack} className="flex flex-col gap-2 pt-2">
                                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                                    <input
                                        type="text"
                                        required
                                        placeholder="รหัสออเดอร์ เช่น HM-XXXX หรือ เบอร์โทร..."
                                        value={quickTrackQuery}
                                        onChange={(e) => setQuickTrackQuery(e.target.value)}
                                        className="flex-1 px-3.5 py-2.5 bg-[var(--color-paper)] border border-[var(--color-ink)]/30 font-mono text-xs text-[var(--color-ink)] placeholder:text-[var(--color-neutral)] focus:outline-none focus:border-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] uppercase"
                                    />
                                    <button
                                        type="submit"
                                        disabled={quickTrackLoading}
                                        className="px-5 py-2.5 bg-[var(--color-ink)] hover:bg-[oklch(12%_0.012_28)] text-[var(--color-paper)] font-mono text-xs font-bold uppercase transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                        {quickTrackLoading ? (
                                            <span>[ ⏳ ตรวจสอบ... ]</span>
                                        ) : (
                                            <span>[ 🔍 ค้นหา ➔ ]</span>
                                        )}
                                    </button>
                                </div>
                                {quickTrackError && (
                                    <span className="font-mono text-[11px] text-red-700 font-bold bg-red-100/80 p-2 border border-red-300">
                                        ✕ {quickTrackError}
                                    </span>
                                )}
                            </form>
                        </div>

                        {/* Quick Links for Active Orders if any */}
                        {hasActiveOrders && (
                            <div className="pt-4 border-t border-[var(--color-ink)]/15 flex flex-col gap-2 font-mono text-xs">
                                <span className="font-bold text-[10px] text-[var(--color-ink)] uppercase">
                                    [ ออเดอร์ล่าสุดของคุณ // RECENT ORDERS ]:
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {activeOrders.slice(0, 2).map((ord) => (
                                        <Link
                                            key={ord.id}
                                            to={`/track/${ord.tracking_token || ord.id}`}
                                            className="px-2.5 py-1 bg-[var(--color-paper)] border border-[var(--color-ink)]/30 hover:border-[var(--color-ink)] text-[var(--color-ink)] text-[10px] font-bold uppercase flex items-center gap-1.5 transition-colors"
                                        >
                                            <span>📦</span>
                                            <span>#{(ord.tracking_token || String(ord.id)).slice(-6).toUpperCase()}</span>
                                            <span>({ord.status}) ➔</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Playful Cat / Mascot Line Art */}
                        <div className="absolute right-4 bottom-2 font-mono text-xs text-[var(--color-ink)]/40 select-none">
                            ( ฅ^•ﻌ•^ฅ )
                        </div>
                    </div>
                </section>

            </main>

            {/* 6. Free Shipping Promo Blue Strip */}
            <div className="w-full bg-[var(--color-accent-sky)] border-t border-b border-[var(--color-ink)]/20 py-2 px-4 text-center font-mono text-[11px] font-bold text-[var(--color-ink)] uppercase tracking-wider flex items-center justify-center gap-2">
                <span>🚚 FREE SHIPPING ON ORDERS OVER {settings.freeShippingMinItems || 3} ITEMS · SHIPPED DIRECTLY FROM NAKHON PHANOM</span>
                <span>➔</span>
            </div>

            {/* 7. Vibrant Yellow Multi-Column Footer */}
            <footer className="w-full bg-[var(--color-accent-yellow)] text-[var(--color-ink)] border-t border-[var(--color-ink)]/20 pt-10 pb-12 px-6 sm:px-12 font-mono text-xs">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-[var(--color-ink)]/20">
                    
                    {/* Left Col: Contact Info */}
                    <div className="md:col-span-4 flex flex-col gap-2">
                        <span className="font-black text-sm uppercase">IN THE HAUS · HAUSMADE</span>
                        <span className="text-[10px] text-[var(--color-ink)]/80 uppercase">
                            TEL: {settings.storePhone || '098-528-4217'}
                        </span>
                        <span className="text-[10px] text-[var(--color-ink)]/80 uppercase">
                            EMAIL: CONTACT@INTHEHAUS.CO
                        </span>
                        <span className="text-[10px] text-[var(--color-ink)]/80 uppercase">
                            LOCATION: RIVERSIDE, NAKHON PHANOM
                        </span>
                    </div>

                    {/* Middle Col 1: About */}
                    <div className="md:col-span-3 flex flex-col gap-2">
                        <span className="font-bold text-[11px] uppercase">[ ABOUT ]</span>
                        <span className="text-[10px] hover:underline cursor-pointer">WHY HAUSMADE?</span>
                        <span className="text-[10px] hover:underline cursor-pointer">BEHIND OUR CRAFT</span>
                        <span className="text-[10px] hover:underline cursor-pointer">SPECIALTY ROASTERY</span>
                        <span className="text-[10px] hover:underline cursor-pointer">COMMUNITY STORIES</span>
                    </div>

                    {/* Middle Col 2: Services */}
                    <div className="md:col-span-3 flex flex-col gap-2">
                        <span className="font-bold text-[11px] uppercase">[ CUSTOMER CARE ]</span>
                        <span className="text-[10px] hover:underline cursor-pointer">ORDER TRACKING</span>
                        <span className="text-[10px] hover:underline cursor-pointer">SHIPPING & PRE-ORDERS</span>
                        <span className="text-[10px] hover:underline cursor-pointer">FAQS & RETURNS</span>
                        <span className="text-[10px] hover:underline cursor-pointer">PRIVACY POLICY</span>
                    </div>

                    {/* Right Col: Socials */}
                    <div className="md:col-span-2 flex flex-col gap-2">
                        <span className="font-bold text-[11px] uppercase">[ CONNECT ]</span>
                        <a href="https://instagram.com" target="_blank" rel="noreferrer" className="text-[10px] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]">INSTAGRAM</a>
                        <span className="text-[10px] hover:underline cursor-pointer">LINE OA (@inthehaus)</span>
                        <a href="https://tiktok.com" target="_blank" rel="noreferrer" className="text-[10px] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]">TIKTOK</a>
                        <a href="https://facebook.com" target="_blank" rel="noreferrer" className="text-[10px] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]">FACEBOOK</a>
                    </div>
                </div>

                {/* Bottom Copyright */}
                <div className="max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-[10px] text-[var(--color-ink)]/70">
                    <span>© IN THE HAUS 2026. ALL RIGHTS RESERVED.</span>
                    <span>ATELIER SYSTEM OPERATIONAL // NAKHON PHANOM</span>
                </div>
            </footer>

            {/* Floating Mobile Cart Bar */}
            <AnimatePresence>
                {cartItemCount > 0 && !isCartOpen && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto sm:hidden"
                    >
                        <button
                            type="button"
                            onClick={() => setIsCartOpen(true)}
                            className="w-full py-3.5 px-5 bg-[var(--color-ink)] text-[var(--color-paper)] border border-[var(--color-rule)] shadow-2xl flex items-center justify-between font-mono text-xs font-bold uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-paper)]"
                        >
                            <div className="flex items-center gap-2">
                                <span>[ VIEW CART // ตะกร้า ({cartItemCount}) ]</span>
                                {hasPreOrderInCart && (
                                    <span className="px-1.5 py-0.5 bg-[var(--color-accent-yellow)] text-[var(--color-ink)] text-[9px] font-bold">
                                        ⏳ PRE-ORDER
                                    </span>
                                )}
                            </div>
                            <span className="text-[var(--color-accent-yellow)]">฿{totalAmount.toLocaleString()}.-</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Product Selection Modal */}
            <HausmadeProductModal
                product={selectedProduct}
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onAddToCart={(product, opts, qty, extraPrice, optText) => {
                    addToCart(product, opts, qty, extraPrice, optText)
                    setIsCartOpen(true)
                }}
            />

            {/* Cart Drawer */}
            <HausmadeCartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                shopState={shopState}
            />

            {/* Member Authentication Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
            />
        </div>
    )
}

/**
 * Editorial Magazine Product Card (Matching "THE LATEST" 4-Column Layout from Reference)
 */
function EditorialProductCard({ product, onSelectProduct, onQuickAction }) {
    const [activeIdx, setActiveIdx] = useState(0)
    const images = useMemo(() => getProductImages(product), [product])
    const hasMultiple = images.length > 1

    const optionGroups = product.menu_item_options?.map(o => o.option_groups).filter(Boolean) || []
    const hasOptions = optionGroups.length > 0
    
    // Proper Stock Evaluation without null coercion bug
    const stockNum = product.stock_quantity ?? product.remaining_stock ?? null
    const isSoldOut = product.is_available === false || (stockNum !== null && stockNum <= 0)
    const isLowStock = stockNum !== null && stockNum > 0 && stockNum <= 5

    const currentImg = images[activeIdx] || product.image_url

    return (
        <motion.div
            whileHover={isSoldOut ? {} : { y: -3 }}
            transition={{ duration: 0.2 }}
            className={`bg-[var(--color-paper)] border border-[var(--color-rule)] flex flex-col justify-between overflow-hidden group shadow-2xs transition-colors ${
                isSoldOut
                    ? 'opacity-65 border-dashed'
                    : 'hover:border-[var(--color-ink)]'
            }`}
        >
            {/* Top: Product Image */}
            <div className="relative w-full aspect-[4/3] bg-[var(--color-paper-2)] overflow-hidden select-none">
                {currentImg ? (
                    <img
                        src={currentImg}
                        alt={product.name}
                        loading="lazy"
                        onClick={() => onSelectProduct(product)}
                        className={`w-full h-full object-cover cursor-pointer transition-transform duration-500 ${
                            isSoldOut ? 'grayscale contrast-75' : 'group-hover:scale-104'
                        }`}
                    />
                ) : (
                    <div
                        onClick={() => onSelectProduct(product)}
                        className="w-full h-full flex flex-col items-center justify-center font-mono text-[10px] text-[var(--color-neutral)] uppercase gap-1 p-4 text-center cursor-pointer"
                    >
                        <span className="font-bold text-[var(--color-ink)]">// HAUSMADE.</span>
                        <span>[ NAKHON PHANOM CRAFT ]</span>
                    </div>
                )}

                {/* Pre-Order / Sold Out Badge (Top Left) */}
                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
                    {isSoldOut ? (
                        <div className="bg-red-700 text-[var(--color-paper)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider">
                            [ SOLD OUT ]
                        </div>
                    ) : isPreOrderItem(product) ? (
                        <div className="bg-[var(--color-ink)] text-[var(--color-accent-yellow)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs">
                            <span>⏳ PRE-ORDER</span>
                        </div>
                    ) : isLowStock ? (
                        <div className="bg-[var(--color-accent)] text-[var(--color-paper)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider">
                            [ เหลือ {stockNum} ชิ้น ]
                        </div>
                    ) : null}
                </div>

                {/* Multi-Photo Count Badge */}
                {hasMultiple && (
                    <div className="absolute top-2.5 right-2.5 bg-[var(--color-ink)]/85 text-[var(--color-paper)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider backdrop-blur-xs flex items-center gap-1 z-10">
                        <span>📷</span>
                        <span>{activeIdx + 1}/{images.length}</span>
                    </div>
                )}

                {/* Angle Thumbnails / Dots on Hover */}
                {hasMultiple && (
                    <div
                        className="absolute bottom-2 inset-x-2 flex items-center justify-center gap-1.5 p-1 bg-[var(--color-ink)]/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {images.map((_, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setActiveIdx(idx)}
                                className={`h-1.5 rounded-full transition-all cursor-pointer focus-visible:outline-none ${
                                    idx === activeIdx ? 'w-5 bg-[var(--color-accent-yellow)]' : 'w-2 bg-white/70 hover:bg-white'
                                }`}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Signature Yellow Strip Tag under Photo (Matching Reference Bar) */}
            <div className="bg-[var(--color-accent-yellow)] px-3.5 py-1.5 border-t border-b border-[var(--color-ink)]/15 flex items-center justify-between font-mono text-[9px] font-extrabold text-[var(--color-ink)] uppercase">
                <span>{getCraftDateTag(product)} · ฿{Number(product.price || 0).toLocaleString()}.-</span>
                <span className="truncate max-w-[120px]">
                    {product.menu_categories?.name || product.category || (isPreOrderItem(product) ? 'PRE-ORDER' : 'HAUSMADE.')}
                </span>
            </div>

            {/* Product Body Information */}
            <div className="p-4 flex flex-col gap-2.5 flex-grow justify-between">
                <div>
                    <h4
                        onClick={() => onSelectProduct(product)}
                        className="font-sans text-sm font-bold text-[var(--color-ink)] uppercase tracking-tight leading-snug cursor-pointer hover:text-[var(--color-accent)] transition-colors line-clamp-2"
                    >
                        {product.name}
                    </h4>

                    {/* Preserved Bilingual Description */}
                    {product.description && (
                        <p className="font-sans text-xs text-[var(--color-muted)] mt-1 line-clamp-3 leading-relaxed whitespace-pre-line">
                            {product.description}
                        </p>
                    )}

                    {/* Pre-Order ETA Info Box */}
                    {isPreOrderItem(product) && (
                        <div className="mt-2 p-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-mono text-[9px] text-[var(--color-ink)] font-bold flex items-center gap-1">
                            <span>📦</span>
                            <span>รอบส่ง: {getPreOrderEta(product)}</span>
                        </div>
                    )}
                </div>

                {/* Bottom CTA Button */}
                <div className="pt-2 border-t border-[var(--color-rule)]">
                    <button
                        type="button"
                        disabled={isSoldOut}
                        onClick={() => onQuickAction(product)}
                        className={`w-full py-2 px-3 border font-mono text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 ${
                            isSoldOut
                                ? 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] border-[var(--color-rule)] cursor-not-allowed'
                                : isPreOrderItem(product)
                                    ? 'bg-[var(--color-ink)] hover:bg-[var(--color-accent-yellow)] text-[var(--color-accent-yellow)] hover:text-[var(--color-ink)] border-[var(--color-ink)]'
                                    : 'bg-[var(--color-paper-2)] hover:bg-[var(--color-ink)] text-[var(--color-ink)] hover:text-[var(--color-paper)] border-[var(--color-rule)]'
                        }`}
                    >
                        <span>฿{Number(product.price || 0).toLocaleString()}.-</span>
                        <span>
                            {isSoldOut
                                ? '[ SOLD OUT ]'
                                : hasOptions
                                    ? (isPreOrderItem(product) ? '[ ⏳ สั่งจอง / OPTIONS ➔ ]' : '[ SELECT OPTIONS ➔ ]')
                                    : (isPreOrderItem(product) ? '[ ⏳ สั่งจองล่วงหน้า ➔ ]' : '[ + ADD TO CART ➔ ]')
                            }
                        </span>
                    </button>
                </div>
            </div>
        </motion.div>
    )
}
