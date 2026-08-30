/* Hallmark · page: HausmadeShopPage · theme: Atelier (Thai Modern OKLCH)
 * features: Hero Showcase Banner, Variant & Stock Badges, Member CRM Status, Filter Rail, Cart Drawer Integration
 */
import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useHausmadeShop, isPreOrderItem, getPreOrderEta } from '../hooks/useHausmadeShop'
import { useServiceGuard } from '../hooks/useServiceGuard'
import HausmadeProductModal from '../components/hausmade/HausmadeProductModal'
import HausmadeCartDrawer from '../components/hausmade/HausmadeCartDrawer'

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
        preOrderItemsInCart,
        totalAmount,
        addToCart,
        settings,
        isFreeShipping,
        memberProfile,
        memberTierInfo,
        availableXhausBalance
    } = shopState

    const [selectedProduct, setSelectedProduct] = useState(null)
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [heroSlideIdx, setHeroSlideIdx] = useState(0)

    // Featured Hero Items (items marked is_featured or first 4 items with images)
    const heroItems = useMemo(() => {
        const withImg = menuItems.filter(i => i.image_url)
        const featured = withImg.filter(i => i.is_featured === true || i.is_recommended === true)
        return (featured.length > 0 ? featured : withImg).slice(0, 4)
    }, [menuItems])

    // Auto-advance hero carousel every 6s
    useEffect(() => {
        if (heroItems.length <= 1) return
        const timer = setInterval(() => {
            setHeroSlideIdx(prev => (prev + 1) % heroItems.length)
        }, 6000)
        return () => clearInterval(timer)
    }, [heroItems.length])

    if (isChecking) {
        return (
            <div className="min-h-screen bg-[oklch(97%_0.008_28)] flex flex-col items-center justify-center text-[oklch(18%_0.012_28)] font-mono text-xs uppercase tracking-widest gap-3 select-none">
                <div className="w-6 h-6 rounded-full border-2 border-[oklch(85%_0.012_28)] border-t-[oklch(18%_0.012_28)] animate-spin" />
                <span>CHECKING HAUSMADE SHOP STATUS...</span>
            </div>
        )
    }

    const handleProductAction = (product) => {
        const isSoldOut = product.is_available === false || (product.stock_quantity !== undefined && product.stock_quantity <= 0) || (product.remaining_stock !== undefined && product.remaining_stock <= 0)
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

    return (
        <div className="min-h-screen bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-sans flex flex-col selection:bg-[oklch(52%_0.16_28)] selection:text-white">
            
            {/* 1. Ticker Header (Top Announcement Marquee) */}
            <div className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-b border-[oklch(85%_0.012_28)] h-9 flex items-center overflow-hidden z-20">
                <motion.div
                    className="whitespace-nowrap flex gap-12 font-mono text-[9px] uppercase tracking-normal"
                    animate={{ x: ['0%', '-50%'] }}
                    transition={{
                        repeat: Infinity,
                        duration: 25,
                        ease: 'linear'
                    }}
                >
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-6">
                            <span className="text-[oklch(52%_0.16_28)] font-bold">
                                // HAUSMADE ONLINE STORE
                            </span>
                            <span>
                                CRAFTED IN NAKHON PHANOM, THAILAND
                            </span>
                            <span>
                                🚚 ค่าจัดส่ง {settings.shippingFee}.- {settings.freeShippingMinItems > 0 ? `(ซื้อครบ ${settings.freeShippingMinItems} ชิ้น ส่งฟรี!)` : ''}
                            </span>
                            <span className="w-1.5 h-1.5 bg-[oklch(52%_0.16_28)]" />
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* 2. Top Navigation Bar (Neo-Brutalist Grid Header) */}
            <nav className="sticky top-0 z-30 bg-[oklch(97%_0.008_28)]/95 backdrop-blur-md border-b border-[oklch(85%_0.012_28)] px-4 sm:px-6 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/" className="font-mono text-xs font-bold text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors px-2 py-1 border border-transparent hover:border-[oklch(85%_0.012_28)] bg-transparent">
                        [ ← HOME // หน้าหลัก ]
                    </Link>
                    <span className="font-mono text-xs text-[oklch(85%_0.012_28)]">/</span>
                    <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                        HAUSMADE SHOP
                    </span>
                </div>

                {/* Member CRM Status & Cart Action */}
                <div className="flex items-center gap-3">
                    {memberProfile ? (
                        <div className="hidden md:flex items-center gap-2 font-mono text-[11px] px-3 py-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: memberTierInfo?.color_accent || '#C84B31' }} />
                            <span className="font-bold">{memberTierInfo?.name || 'MEMBER'}</span>
                            <span className="text-[oklch(55%_0.010_28)]">({availableXhausBalance.toLocaleString()} xhaus)</span>
                        </div>
                    ) : (
                        <Link
                            to="/member"
                            className="hidden md:block font-mono text-[10px] text-[oklch(52%_0.16_28)] hover:underline uppercase font-bold"
                        >
                            [ เข้าสู่ระบบสมาชิกรับ xhaus ]
                        </Link>
                    )}

                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="relative px-3.5 py-2 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-[oklch(52%_0.16_28)] transition-colors font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-2.5 border border-[oklch(18%_0.012_28)] shadow-xs cursor-pointer"
                    >
                        <span>[ CART ({cartItemCount}) ]</span>
                        {cartItemCount > 0 && (
                            <span className="border-l border-[oklch(85%_0.012_28)]/30 pl-2.5 text-[oklch(52%_0.16_28)]">
                                ฿{totalAmount.toLocaleString()}.-
                            </span>
                        )}
                    </button>
                </div>
            </nav>

            {/* 3. Hero Product Showcase Banner */}
            {currentHeroItem && (
                <section className="w-full bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] overflow-hidden">
                    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 min-h-[360px] border-x border-[oklch(85%_0.012_28)]">
                        
                        {/* Hero Left: Product Information */}
                        <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-between gap-6">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-widest px-2 py-0.5 border border-[oklch(52%_0.16_28)] bg-white">
                                        // NEW ARRIVAL & FEATURED
                                    </span>
                                    <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase">
                                        [ {heroSlideIdx + 1} / {heroItems.length} ]
                                    </span>
                                </div>

                                <h2 className="text-2xl sm:text-4xl font-extrabold text-[oklch(18%_0.012_28)] tracking-tight leading-tight uppercase">
                                    {currentHeroItem.name}
                                </h2>

                                <p className="text-xs sm:text-sm text-[oklch(42%_0.010_28)] leading-relaxed max-w-lg mt-1 line-clamp-3">
                                    {currentHeroItem.description || 'สินค้าคัดสรรคุณภาพและงานคราฟต์ต้นตำรับจากริมแม่น้ำโขง นครพนม'}
                                </p>
                            </div>

                            <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-[oklch(85%_0.012_28)]">
                                <div className="font-mono text-2xl font-bold text-[oklch(18%_0.012_28)]">
                                    ฿{Number(currentHeroItem.price || 0).toLocaleString()}.-
                                </div>

                                <button
                                    onClick={() => handleProductAction(currentHeroItem)}
                                    className="px-5 py-2.5 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                                >
                                    [ สั่งซื้อทันที // ORDER NOW ➔ ]
                                </button>

                                {/* Slide Selectors */}
                                {heroItems.length > 1 && (
                                    <div className="flex gap-1 ml-auto">
                                        {heroItems.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setHeroSlideIdx(idx)}
                                                className={`w-6 h-1.5 transition-all cursor-pointer ${
                                                    idx === heroSlideIdx
                                                        ? 'bg-[oklch(52%_0.16_28)] w-8'
                                                        : 'bg-[oklch(85%_0.012_28)] hover:bg-[oklch(55%_0.010_28)]'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Hero Right: High-Res Image Display */}
                        <div className="md:col-span-5 relative bg-[oklch(97%_0.008_28)] border-t md:border-t-0 md:border-l border-[oklch(85%_0.012_28)] overflow-hidden flex items-center justify-center p-6">
                            <motion.img
                                key={currentHeroItem.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4 }}
                                src={currentHeroItem.image_url}
                                alt={currentHeroItem.name}
                                className="w-full h-64 md:h-full object-cover shadow-xs"
                            />
                        </div>
                    </div>
                </section>
            )}

            {/* 4. Search & Controls Toolbar */}
            <section className="w-full bg-[oklch(97%_0.008_28)] border-b border-[oklch(85%_0.012_28)] px-6 py-4">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    {/* Search Input Bar */}
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="ค้นหาสินค้า HAUSMADE..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3.5 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] uppercase cursor-pointer"
                            >
                                [ CLEAR ]
                            </button>
                        )}
                    </div>

                    {/* Sorting Selector */}
                    <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-[oklch(55%_0.010_28)] text-[10px] uppercase">[ SORT BY ]:</span>
                        <div className="flex items-center border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-0.5">
                            {[
                                { id: 'featured', label: 'RECOMMENDED' },
                                { id: 'price_asc', label: 'PRICE: LOW' },
                                { id: 'price_desc', label: 'PRICE: HIGH' },
                                { id: 'name_asc', label: 'A-Z' }
                            ].map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSortBy(s.id)}
                                    className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                        sortBy === s.id
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                            : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. Main Catalog Section */}
            <main className="max-w-6xl w-full mx-auto px-6 py-8 flex-grow flex flex-col gap-6">
                {/* Sub-Category Tab Filter Rail */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[oklch(85%_0.012_28)] scrollbar-none">
                    {subCategories.map((subCat) => {
                        const isActive = activeSubCategory === subCat.name
                        return (
                            <button
                                key={subCat.name}
                                onClick={() => setActiveSubCategory(subCat.name)}
                                className={`relative px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase transition-all whitespace-nowrap border cursor-pointer ${
                                    isActive
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)] shadow-xs'
                                        : 'bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                }`}
                            >
                                [ {subCat.name} ({subCat.count}) ]
                            </button>
                        )
                    })}
                </div>

                {/* Product Grid */}
                {loading ? (
                    <div className="py-20 text-center font-mono text-xs text-[oklch(55%_0.010_28)] uppercase tracking-widest flex flex-col items-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-[oklch(85%_0.012_28)] border-t-[oklch(18%_0.012_28)] animate-spin" />
                        <span>[ LOADING HAUSMADE CATALOG... ]</span>
                    </div>
                ) : displayedItems.length === 0 ? (
                    <div className="py-16 text-center border border-dashed border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(55%_0.010_28)] uppercase flex flex-col items-center gap-3">
                        <span>[ NO ITEMS FOUND // ไม่พบสินค้าที่ค้นหา ]</span>
                        {(searchQuery || activeSubCategory !== 'ALL') && (
                            <button
                                onClick={() => {
                                    setSearchQuery('')
                                    setActiveSubCategory('ALL')
                                }}
                                className="px-3 py-1 bg-[oklch(18%_0.012_28)] text-white font-mono text-[10px] font-bold uppercase cursor-pointer"
                            >
                                [ RESET FILTERS // แสดงทั้งหมด ]
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayedItems.map((product) => {
                            const optionGroups = product.menu_item_options?.map(o => o.option_groups).filter(Boolean) || []
                            const hasOptions = optionGroups.length > 0
                            
                            // Stock evaluation
                            const stockNum = product.stock_quantity ?? product.remaining_stock ?? null
                            const isSoldOut = product.is_available === false || (stockNum !== null && stockNum <= 0)
                            const isLowStock = stockNum !== null && stockNum > 0 && stockNum <= 5

                            return (
                                <motion.div
                                    key={product.id}
                                    whileHover={isSoldOut ? {} : { y: -3 }}
                                    transition={{ duration: 0.2 }}
                                    className={`bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] flex flex-col justify-between overflow-hidden group shadow-2xs transition-colors ${
                                        isSoldOut
                                            ? 'opacity-65 border-dashed'
                                            : 'hover:border-[oklch(52%_0.16_28)]'
                                    }`}
                                >
                                    {/* Product Image */}
                                    <div className="relative w-full h-56 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] overflow-hidden">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className={`w-full h-full object-cover transition-transform duration-500 ${
                                                    isSoldOut ? 'grayscale contrast-75' : 'group-hover:scale-105'
                                                }`}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase gap-1 p-4 text-center">
                                                <span className="font-bold text-[oklch(18%_0.012_28)]">// HAUSMADE</span>
                                                <span>[ NAKHON PHANOM CRAFT ]</span>
                                            </div>
                                        )}

                                        {/* Status & Pre-Order Badges */}
                                        <div className="absolute top-3 left-3 flex flex-col gap-1">
                                            {isSoldOut ? (
                                                <div className="bg-red-700 text-white px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider shadow-sm">
                                                    [ SOLD OUT // สินค้าหมด ]
                                                </div>
                                            ) : isPreOrderItem(product) ? (
                                                <div className="bg-[oklch(45%_0.08_140)] text-white px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider shadow-sm border border-white/20 flex items-center gap-1">
                                                    <span>⏳ PRE-ORDER</span>
                                                </div>
                                            ) : isLowStock ? (
                                                <div className="bg-[oklch(52%_0.16_28)] text-white px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider shadow-sm">
                                                    [ เหลือ {stockNum} ชิ้น ]
                                                </div>
                                            ) : (
                                                <div className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider">
                                                    [ IN STOCK ]
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Product Info Body */}
                                    <div className="p-5 flex flex-col gap-3 flex-grow justify-between">
                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block mb-1">
                                                    // {product.menu_categories?.name || product.category || 'HAUSMADE'}
                                                </span>
                                                {isPreOrderItem(product) && (
                                                    <span className="font-mono text-[9px] text-[oklch(45%_0.08_140)] font-bold uppercase">
                                                        [ สินค้าเปิดจอง ]
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-lg font-bold text-[oklch(18%_0.012_28)] tracking-tight leading-snug">
                                                {product.name}
                                            </h3>

                                            {product.description && (
                                                <p className="text-xs text-[oklch(42%_0.010_28)] mt-1.5 line-clamp-2 leading-relaxed font-sans">
                                                    {product.description}
                                                </p>
                                            )}

                                            {/* Pre-Order ETA Info Box */}
                                            {isPreOrderItem(product) && (
                                                <div className="mt-2.5 p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-mono text-[10px] text-[oklch(45%_0.08_140)] font-bold flex items-center gap-1.5">
                                                    <span>📦</span>
                                                    <span>รอบส่ง: {getPreOrderEta(product)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between border-t border-[oklch(85%_0.012_28)] pt-4 mt-2">
                                            <div className="font-mono text-base font-bold text-[oklch(18%_0.012_28)]">
                                                ฿{Number(product.price || 0).toLocaleString()}.-
                                            </div>
                                            <button
                                                disabled={isSoldOut}
                                                onClick={() => handleProductAction(product)}
                                                className={`px-3.5 py-2 border font-mono text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                                                    isSoldOut
                                                        ? 'bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)] cursor-not-allowed'
                                                        : isPreOrderItem(product)
                                                            ? 'bg-[oklch(45%_0.08_140)] hover:bg-[oklch(38%_0.08_140)] text-white border-[oklch(45%_0.08_140)]'
                                                            : 'bg-[oklch(94%_0.010_28)] hover:bg-[oklch(18%_0.012_28)] text-[oklch(18%_0.012_28)] hover:text-[oklch(97%_0.008_28)] border-[oklch(85%_0.012_28)]'
                                                }`}
                                            >
                                                {isSoldOut 
                                                    ? '[ SOLD OUT ]' 
                                                    : hasOptions 
                                                        ? (isPreOrderItem(product) ? '[ ⏳ สั่งจอง / OPTIONS ]' : '[ SELECT OPTIONS ]')
                                                        : (isPreOrderItem(product) ? '[ ⏳ สั่งจองล่วงหน้า ]' : '[ + ADD TO CART ]')
                                                }
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </main>

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
                            onClick={() => setIsCartOpen(true)}
                            className="w-full py-3.5 px-5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] shadow-2xl flex items-center justify-between font-mono text-xs font-bold uppercase cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <span>[ VIEW CART // ตะกร้า ({cartItemCount}) ]</span>
                                {hasPreOrderInCart && (
                                    <span className="px-1.5 py-0.5 bg-[oklch(45%_0.08_140)] text-white text-[9px] font-bold">
                                        ⏳ PRE-ORDER
                                    </span>
                                )}
                            </div>
                            <span className="text-[oklch(52%_0.16_28)]">฿{totalAmount.toLocaleString()}.-</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 6. Product Selection Modal & Cart Drawer */}
            <HausmadeProductModal
                product={selectedProduct}
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onAddToCart={(product, opts, qty, extraPrice, optText) => {
                    addToCart(product, opts, qty, extraPrice, optText)
                    setIsCartOpen(true)
                }}
            />

            <HausmadeCartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                shopState={shopState}
            />

            {/* 7. Footer Section */}
            <footer className="w-full bg-[oklch(94%_0.010_28)] border-t border-[oklch(85%_0.012_28)] px-6 py-8 mt-12 font-mono text-xs text-[oklch(42%_0.010_28)]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">HAUSMADE BY IN THE HAUS</span>
                        <span className="ml-2">// NAKHON PHANOM, THAILAND</span>
                    </div>
                    <div>
                        [ SYSTEM STATUS: ONLINE // ALL SYSTEMS OPERATIONAL ]
                    </div>
                </div>
            </footer>
        </div>
    )
}
