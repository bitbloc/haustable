import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useHausmadeShop } from '../hooks/useHausmadeShop'
import { useServiceGuard } from '../hooks/useServiceGuard'
import HausmadeProductModal from '../components/hausmade/HausmadeProductModal'
import HausmadeCartDrawer from '../components/hausmade/HausmadeCartDrawer'

export default function HausmadeShopPage() {
    const isChecking = useServiceGuard('shop_mode_hausmade')
    const shopState = useHausmadeShop()
    const {
        loading,
        displayedItems,
        subCategories,
        activeSubCategory,
        setActiveSubCategory,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        cartItemCount,
        totalAmount,
        addToCart,
        settings,
        isFreeShipping
    } = shopState

    const [selectedProduct, setSelectedProduct] = useState(null)
    const [isCartOpen, setIsCartOpen] = useState(false)

    if (isChecking) {
        return (
            <div className="min-h-screen bg-[oklch(97%_0.008_28)] flex flex-col items-center justify-center text-[oklch(18%_0.012_28)] font-mono text-xs uppercase tracking-widest gap-3 select-none">
                <div className="w-6 h-6 rounded-full border-2 border-[oklch(85%_0.012_28)] border-t-[oklch(18%_0.012_28)] animate-spin" />
                <span>CHECKING HAUSMADE SHOP STATUS...</span>
            </div>
        )
    }

    const handleProductAction = (product) => {
        const optionGroups = product.menu_item_options?.map(o => o.option_groups).filter(Boolean) || []
        if (optionGroups.length > 0) {
            setSelectedProduct(product)
        } else {
            addToCart(product, {}, 1, 0, '')
            setIsCartOpen(true)
        }
    }

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
                                🚚 ค่าจัดส่ง {settings.shippingFee}.- {settings.freeShippingMinItems > 0 ? `(ซื้อครบ ${settings.freeShippingMinItems} ชิ้น จัดส่งฟรีทั่วประเทศ!)` : ''}
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

                {/* Cart Action Button */}
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="relative px-3.5 py-2 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-[oklch(52%_0.16_28)] transition-colors font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-2.5 border border-[oklch(18%_0.012_28)] shadow-xs"
                >
                    <span>[ CART ({cartItemCount}) ]</span>
                    {cartItemCount > 0 && (
                        <span className="border-l border-[oklch(85%_0.012_28)]/30 pl-2.5 text-[oklch(52%_0.16_28)]">
                            ฿{totalAmount.toLocaleString()}.-
                        </span>
                    )}
                </button>
            </nav>

            {/* 3. Hero & Instrument Panel Header */}
            <header className="w-full bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] px-6 py-10 md:py-14">
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    <div className="flex flex-col gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-widest block">
                            // CRAFT & RETAIL GOODS BRAND // IN THE HAUS
                        </span>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[oklch(18%_0.012_28)] tracking-tight uppercase">
                            HAUSMADE STORE
                        </h1>
                        <p className="text-xs sm:text-sm text-[oklch(42%_0.010_28)] max-w-xl leading-relaxed mt-1">
                            สินค้าของฝาก เมล็ดกาแฟคั่วสด เครื่องดื่มบรรจุขวด ซอสสูตรพิเศษ และ Goods ส่งตรงจาก IN THE HAUS นครพนม
                        </p>
                    </div>

                    {/* Instrument Panel Info Bar */}
                    <div className="p-4 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                        <div className="flex flex-col gap-1 border-b sm:border-b-0 sm:border-r border-[oklch(85%_0.012_28)] pb-2 sm:pb-0 sm:pr-4">
                            <span className="text-[oklch(55%_0.010_28)] text-[10px] uppercase">[ SHIPPING STATUS ]</span>
                            <span className="font-bold text-[oklch(18%_0.012_28)]">จัดส่งพัสดุทั่วประเทศไทย 🇹🇭</span>
                        </div>
                        <div className="flex flex-col gap-1 border-b sm:border-b-0 sm:border-r border-[oklch(85%_0.012_28)] pb-2 sm:pb-0 sm:pr-4">
                            <span className="text-[oklch(55%_0.010_28)] text-[10px] uppercase">[ PROMOTION ]</span>
                            <span className="font-bold text-[oklch(52%_0.16_28)]">
                                {settings.freeShippingMinItems > 0 ? `ซื้อครบ ${settings.freeShippingMinItems} ชิ้น จัดส่งฟรี!` : 'ค่าจัดส่งเหมาจ่าย'}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[oklch(55%_0.010_28)] text-[10px] uppercase">[ FULFILMENT OPTIONS ]</span>
                            <span className="font-bold text-[oklch(18%_0.012_28)]">จัดส่งพัสดุเอกชน / รับหน้าร้าน</span>
                        </div>
                    </div>
                </div>
            </header>

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
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] uppercase"
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
                                    className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${
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
                                className={`relative px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase transition-all whitespace-nowrap border ${
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
                                className="px-3 py-1 bg-[oklch(18%_0.012_28)] text-white font-mono text-[10px] font-bold uppercase"
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

                            return (
                                <motion.div
                                    key={product.id}
                                    whileHover={{ y: -3 }}
                                    transition={{ duration: 0.2 }}
                                    className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] flex flex-col justify-between overflow-hidden group shadow-2xs hover:border-[oklch(52%_0.16_28)] transition-colors"
                                >
                                    {/* Product Image */}
                                    <div className="relative w-full h-56 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] overflow-hidden">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase gap-1 p-4 text-center">
                                                <span className="font-bold text-[oklch(18%_0.012_28)]">// HAUSMADE</span>
                                                <span>[ NAKHON PHANOM CRAFT ]</span>
                                            </div>
                                        )}

                                        {/* Monospace In-Stock Badge */}
                                        <div className="absolute top-3 left-3 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider">
                                            [ IN STOCK ]
                                        </div>
                                    </div>

                                    {/* Product Info Body */}
                                    <div className="p-5 flex flex-col gap-3 flex-grow justify-between">
                                        <div>
                                            <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block mb-1">
                                                // {product.menu_categories?.name || product.category || 'HAUSMADE'}
                                            </span>
                                            <h3 className="text-lg font-bold text-[oklch(18%_0.012_28)] tracking-tight leading-snug">
                                                {product.name}
                                            </h3>
                                            {product.description && (
                                                <p className="text-xs text-[oklch(42%_0.010_28)] mt-1.5 line-clamp-2 leading-relaxed">
                                                    {product.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between border-t border-[oklch(85%_0.012_28)] pt-4 mt-2">
                                            <div className="font-mono text-base font-bold text-[oklch(18%_0.012_28)]">
                                                ฿{product.price.toLocaleString()}.-
                                            </div>
                                            <button
                                                onClick={() => handleProductAction(product)}
                                                className="px-3.5 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(18%_0.012_28)] text-[oklch(18%_0.012_28)] hover:text-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-[11px] font-bold uppercase tracking-wider transition-colors"
                                            >
                                                {hasOptions ? '[ SELECT OPTIONS ]' : '[ + ADD TO CART ]'}
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
                            className="w-full py-3.5 px-5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] shadow-2xl flex items-center justify-between font-mono text-xs font-bold uppercase"
                        >
                            <span>[ VIEW CART // ตะกร้า ({cartItemCount}) ]</span>
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

