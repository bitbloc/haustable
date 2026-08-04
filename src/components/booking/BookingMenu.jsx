import React, { useState } from 'react'
import { Search, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../../context/LanguageContext'
import { useBooking } from '../../hooks/useBooking'
import MenuCard from '../shared/MenuCard'
import ViewToggle from '../shared/ViewToggle'

export default function BookingMenu() {
    const { t } = useLanguage()
    const {
        menuItems, categories, cart,
        addToCart, removeFromCart,
        setCheckoutMode, settings, pax
    } = useBooking()

    const [activeCategory, setActiveCategory] = useState('All')
    const [searchTerm, setSearchTerm] = useState('')
    const [viewMode, setViewMode] = useState('grid')

    // Filter Logic
    const getFilteredMenu = () => {
        let items = menuItems
        if (activeCategory !== 'All') {
            const catObj = categories.find(c => c.name === activeCategory)
            if (catObj) {
                items = items.filter(i => i.category_id === catObj.id || i.category === activeCategory)
            } else {
                items = items.filter(i => i.category === activeCategory)
            }
        }
        if (searchTerm) {
            items = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
        }
        return items
    }
    const filteredMenu = getFilteredMenu()
    const cartTotal = cart.reduce((sum, item) => sum + ((item.totalPricePerUnit || item.price) * item.qty), 0)

    const handleNext = () => {
        // Pre-check Min Spend
        if (settings.minSpend > 0 && cartTotal < (settings.minSpend * pax)) {
            alert(`${t('minSpendError')} ${settings.minSpend}.- (${t('totalPrice')} ${settings.minSpend * pax}.-) \n${t('pleaseOrderMore')} ${(settings.minSpend * pax) - cartTotal}.-`)
            return
        }
        setCheckoutMode(true)
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Sticky Header: Search & Categories */}
            <div className="sticky top-0 bg-canvas z-30 pt-1 pb-4 space-y-3 shrink-0">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subInk" size={16} />
                        <input
                            type="text"
                            placeholder={t('searchMenu')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-paper pl-9 pr-4 py-2.5 rounded-rams border border-[var(--color-rule)] focus:border-ink outline-none text-sm transition-colors"
                        />
                    </div>
                    <ViewToggle mode={viewMode} setMode={setViewMode} />
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2 border-b border-[var(--color-rule)]">
                    <button
                        onClick={() => setActiveCategory('All')}
                        className={`whitespace-nowrap px-4 py-2 rounded-none text-xs font-mono font-bold transition-all border ${activeCategory === 'All' ? 'bg-ink text-paper border-ink' : 'bg-paper text-subInk border-[var(--color-rule)] hover:border-ink'}`}
                    >
                        All
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.name)}
                            className={`whitespace-nowrap px-4 py-2 rounded-none text-xs font-mono font-bold transition-all border ${activeCategory === cat.name ? 'bg-ink text-paper border-ink' : 'bg-paper text-subInk border-[var(--color-rule)] hover:border-ink'}`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Menu List */}
            <div className="flex-1 overflow-y-auto pr-1 pb-32">
                <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-1'} `}>
                    {filteredMenu.map(item => (
                        <MenuCard 
                            key={item.id} 
                            item={item} 
                            mode={viewMode} 
                            onAdd={addToCart} 
                            onRemove={removeFromCart} 
                            qty={cart.find(c => c.id === item.id)?.qty || 0} 
                            t={t}
                            sideDishes={item.category === 'Steak' ? settings.sideDishes : []}
                            sideDishEnabled={settings.sideDishEnabled}
                        />
                    ))}
                    {filteredMenu.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 text-sm flex flex-col items-center">
                            <span className="bg-gray-200 p-3 rounded-full mb-2"><Search size={20} /></span>
                            {t('noMenuItems')}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Cart Bar - Full Width Floating */}
            <AnimatePresence>
                {cart.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed bottom-0 left-0 right-0 bg-paper/90 backdrop-blur-md border-t border-[var(--color-rule)] p-4 pb-8 z-50"
                    >
                        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
                            {/* Left: Info */}
                            <div className="flex flex-col">
                                <div className="text-xs font-mono font-bold text-subInk uppercase tracking-wider mb-0.5">{t('cartTotal')}</div>
                                <div className="flex items-end gap-2">
                                    <span className="font-mono text-sm bg-ink text-paper px-2 py-0.5 border border-[var(--color-rule)]">{cart.reduce((a, b) => a + b.qty, 0)} {t('itemsCount')}</span>
                                    <motion.span
                                        key={cartTotal}
                                        initial={{ scale: 1.2, color: 'var(--color-accent)' }}
                                        animate={{ scale: 1, color: 'var(--color-ink)' }}
                                        className="font-mono font-bold text-2xl leading-none"
                                    >
                                        ฿{cartTotal}
                                    </motion.span>
                                </div>
                            </div>

                            {/* Right: Action */}
                            <button
                                onClick={handleNext}
                                className="bg-brand text-ink border border-ink px-8 py-3 rounded-none font-bold text-sm flex items-center gap-2 hover:bg-paper transition-all active:scale-95 uppercase tracking-widest font-mono"
                            >
                                {t('next')} <ArrowRight size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Skip Button (Only specific cases, mainly hidden if cart has items generally, but keeping for logic) */}
            {cart.length === 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--color-rule)] shrink-0 text-center">
                    <button
                        onClick={handleNext}
                        className="text-xs font-mono font-bold text-subInk hover:text-ink uppercase"
                    >
                        {t('payOnly')}
                    </button>
                </div>
            )}
        </div>
    )
}
