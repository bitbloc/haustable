import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useHausmadeShop } from '../hooks/useHausmadeShop'
import HausmadeProductModal from '../components/hausmade/HausmadeProductModal'
import HausmadeCartDrawer from '../components/hausmade/HausmadeCartDrawer'

export default function HausmadeShopPage() {
    const shopState = useHausmadeShop()
    const {
        loading,
        displayedItems,
        subCategories,
        activeSubCategory,
        setActiveSubCategory,
        cartItemCount,
        totalAmount,
        addToCart,
        settings,
        isFreeShipping
    } = shopState

    const [selectedProduct, setSelectedProduct] = useState(null)
    const [isCartOpen, setIsCartOpen] = useState(false)

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
                                CRAFTED IN NAKHON PHANOM
                            </span>
                            <span>
                                🚚 ค่าจัดส่ง {settings.shippingFee}.- {settings.freeShippingMinItems > 0 ? `(ซื้อครบ ${settings.freeShippingMinItems} ชิ้น จัดส่งฟรีทั่วประเทศ!)` : ''}
                            </span>
                            <span className="w-1.5 h-1.5 bg-[oklch(52%_0.16_28)]" />
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* 2. Top Navigation Bar */}
            <nav className="sticky top-0 z-30 bg-[oklch(97%_0.008_28)]/90 backdrop-blur-md border-b border-[oklch(85%_0.012_28)] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/" className="font-mono text-xs font-bold text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors">
                        [ ← HOME / หน้าหลัก ]
                    </Link>
                    <span className="font-mono text-xs text-[oklch(85%_0.012_28)]">/</span>
                    <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                        HAUSMADE SHOP
                    </span>
                </div>

                {/* Cart Action Button */}
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="relative px-4 py-2 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-[oklch(52%_0.16_28)] transition-colors font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-3 border border-[oklch(18%_0.012_28)]"
                >
                    <span>[ CART ({cartItemCount}) ]</span>
                    {cartItemCount > 0 && (
                        <span className="border-l border-[oklch(85%_0.012_28)]/30 pl-3 text-[oklch(52%_0.16_28)]">
                            ฿{totalAmount.toLocaleString()}.-
                        </span>
                    )}
                </button>
            </nav>

            {/* 3. Hero & Instrument Panel Header */}
            <header className="w-full bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] px-6 py-12 md:py-16">
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <span className="font-mono text-[11px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-widest block">
                            // CRAFT & RETAIL GOODS BRAND
                        </span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-[oklch(18%_0.012_28)] tracking-tight uppercase">
                            HAUSMADE
                        </h1>
                        <p className="text-sm md:text-base text-[oklch(42%_0.010_28)] max-w-xl leading-relaxed mt-1">
                            สินค้าของฝาก เมล็ดกาแฟคั่วสด เครื่องดื่มบรรจุขวด ซอสสูตรพิเศษ และ Merch ส่งตรงจาก IN THE HAUS นครพนม
                        </p>
                    </div>

                    {/* Instrument Panel Info Bar */}
                    <div className="p-4 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                        <div className="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-[oklch(85%_0.012_28)] pb-2 md:pb-0 md:pr-4">
                            <span className="text-[oklch(55%_0.010_28)] text-[10px] uppercase">[ SHIPPING STATUS ]</span>
                            <span className="font-bold text-[oklch(18%_0.012_28)]">จัดส่งพัสดุทั่วประเทศไทย 🇹🇭</span>
                        </div>
                        <div className="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-[oklch(85%_0.012_28)] pb-2 md:pb-0 md:pr-4">
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

            {/* 4. Main Catalog Section */}
            <main className="max-w-6xl w-full mx-auto px-6 py-10 flex-grow flex flex-col gap-8">
                {/* Sub-Category Tab Filter Rail */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[oklch(85%_0.012_28)] scrollbar-none">
                    {subCategories.map((subCat) => {
                        const isActive = activeSubCategory === subCat
                        return (
                            <button
                                key={subCat}
                                onClick={() => setActiveSubCategory(subCat)}
                                className={`relative px-4 py-2 font-mono text-[11px] font-bold uppercase transition-all whitespace-nowrap border ${
                                    isActive
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                        : 'bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                }`}
                            >
                                [ {subCat} ]
                            </button>
                        )
                    })}
                </div>

                {/* Product Grid */}
                {loading ? (
                    <div className="py-20 text-center font-mono text-xs text-[oklch(55%_0.010_28)] uppercase tracking-widest">
                        [ LOADING HAUSMADE CATALOG... ]
                    </div>
                ) : displayedItems.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(55%_0.010_28)] uppercase">
                        [ NO ITEMS FOUND IN CATEGORY: {activeSubCategory} ]
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayedItems.map((product) => (
                            <motion.div
                                key={product.id}
                                whileHover={{ y: -3 }}
                                transition={{ duration: 0.2 }}
                                className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] flex flex-col justify-between overflow-hidden group"
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
                                        <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase">
                                            [ NO IMAGE AVAILABLE ]
                                        </div>
                                    )}

                                    {/* Monospace Badge */}
                                    <div className="absolute top-3 left-3 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider">
                                        [ IN STOCK ]
                                    </div>
                                </div>

                                {/* Product Info Body */}
                                <div className="p-5 flex flex-col gap-3 flex-grow justify-between">
                                    <div>
                                        <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block mb-1">
                                            // {product.category || 'HAUSMADE'}
                                        </span>
                                        <h3 className="text-lg font-bold text-[oklch(18%_0.012_28)] tracking-tight leading-snug">
                                            {product.name}
                                        </h3>
                                        {product.description && (
                                            <p className="text-xs text-[oklch(42%_0.010_28)] mt-1 line-clamp-2 leading-relaxed">
                                                {product.description}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between border-t border-[oklch(85%_0.012_28)] pt-4 mt-2">
                                        <div className="font-mono text-base font-bold text-[oklch(18%_0.012_28)]">
                                            ฿{product.price.toLocaleString()}.-
                                        </div>
                                        <button
                                            onClick={() => setSelectedProduct(product)}
                                            className="px-3.5 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(18%_0.012_28)] text-[oklch(18%_0.012_28)] hover:text-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-[11px] font-bold uppercase tracking-wider transition-colors"
                                        >
                                            [ ORDER / สั่งซื้อ ]
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

            {/* 5. Product Selection Modal & Cart Drawer */}
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

            {/* 6. Footer Section */}
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
