import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Info, Plus, Minus, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useBookingContext } from '../../context/BookingContext'

// --- Internal Component: MeatSelectionCard ---
const MeatSelectionCard = ({ item, onAdd, onRemove, qty, donenessOptions, sideDishes, sideDishEnabled }) => {
    const isSoldOut = item.is_sold_out
    const [showDoneness, setShowDoneness] = useState(false)
    const [selectedDoneness, setSelectedDoneness] = useState(null)

    const handleAddClick = () => {
        if (isSoldOut) return
        setShowDoneness(true)
    }

    const confirmAdd = (doneness) => {
        onAdd({ ...item, doneness, quantity: 1 })
        setSelectedDoneness(null) // reset for new add? or keep? 
        setShowDoneness(false)
    }

    return (
        <div className={`group relative bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 transition-all duration-300 ${isSoldOut ? 'opacity-60 grayscale' : 'hover:shadow-md'}`}>
            {/* Image & Sides Container (Bento) */}
            <div className="flex flex-col gap-2 p-1">
                {/* Main Image */}
                <div className="aspect-[4/3] relative rounded-xl overflow-hidden bg-gray-100">
                    <img src={item.image_url || 'https://placehold.co/600x400'} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    {isSoldOut && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white font-bold tracking-widest border-2 border-white px-4 py-1 text-sm uppercase">หมด (Sold Out)</span>
                        </div>
                    )}
                    {/* Qty Badge */}
                    {qty > 0 && (
                        <div className="absolute top-3 right-3 bg-[#DFFF00] text-black font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg text-sm z-10">
                            {qty}
                        </div>
                    )}
                </div>

                {/* Side Dishes Bento Row */}
                {sideDishEnabled && sideDishes && sideDishes.length > 0 && (
                     <div className="grid grid-cols-4 gap-2 px-1">
                        {sideDishes.map((sd) => (
                            <div key={sd.id} className="aspect-square relative group/sd cursor-help">
                                {/* Thumbnail */}
                                <div className="w-full h-full rounded-lg bg-gray-100 overflow-hidden border border-gray-100 shadow-sm transition-transform hover:scale-105 relative z-10">
                                    <img src={sd.url} alt={sd.name} className="w-full h-full object-cover" />
                                </div>
                                
                                {/* Tooltip (Popping UP) */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[120px] pointer-events-none opacity-0 group-hover/sd:opacity-100 transition-all duration-300 transform translate-y-2 group-hover/sd:translate-y-0 text-center z-50">
                                    <div className="bg-black/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1.5 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.2)] whitespace-nowrap border border-white/10">
                                        {sd.name}
                                        {/* Arrow */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-black/90"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                     </div>
                )}
            </div>

            {/* Content */}
            <div className="p-5">
                <div className="flex justify-between items-start gap-4">
                    <div>
                        <h3 className="font-serif text-xl font-bold leading-tight mb-1">{item.name}</h3>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{item.description}</p>
                        <p className="font-mono text-lg font-bold">฿{item.price.toLocaleString()}</p>
                    </div>
                    {/* Interaction */}
                    {!isSoldOut && (
                         <button 
                            onClick={handleAddClick} 
                            className="bg-black text-white px-4 py-2 rounded-full text-xs font-bold shrink-0 hover:bg-gray-800 transition-colors"
                        >
                            + เพิ่ม (Add)
                        </button>
                    )}
                </div>
            </div>

            {/* Doneness Modal (Inline or Global? Inline for simplicity in this dedicated component) */}
            <AnimatePresence>
                {showDoneness && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                        className="absolute inset-0 bg-white/95 backdrop-blur-md z-20 p-5 flex flex-col"
                    >
                        <h4 className="text-sm font-bold text-gray-400 uppercase mb-4">เลือกระดับความสุก (Select Doneness)</h4>
                        <div className="flex-1 overflow-y-auto space-y-2">
                             {donenessOptions.map(opt => (
                                 <button 
                                    key={opt.id}
                                    onClick={() => confirmAdd(opt)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left"
                                 >
                                    <div className={`w-3 h-3 rounded-full ${
                                        (opt.name === 'Rare' || opt.name === 'Blue Rare') ? 'bg-red-600' : 
                                        opt.name === 'Medium Rare' ? 'bg-red-400' : 
                                        opt.name === 'Medium' ? 'bg-pink-400' : 
                                        opt.name === 'Medium Well' ? 'bg-amber-600' :
                                        opt.name === 'Well Done' ? 'bg-amber-900' :
                                        'bg-gray-400' // Fallback
                                    }`} />
                                    <span className="font-medium text-sm">{opt.name}</span>
                                    {item.is_recommended && opt.name === 'Medium Rare' && <span className="ml-auto text-[10px] bg-black text-white px-2 py-0.5 rounded">Chef's Rec</span>}
                                 </button>
                             ))}
                        </div>
                        <button onClick={() => setShowDoneness(false)} className="mt-4 text-xs text-center text-gray-400 underline">ยกเลิก (Cancel)</button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// --- Main Step Component ---
export default function StepSteakSelection({ state, dispatch, onNext }) {
    const [steaks, setSteaks] = useState([])
    const [donenessOpts, setDonenessOpts] = useState([])
    const [loading, setLoading] = useState(true)
    const { state: { settings } } = useBookingContext() // Get Settings

    // Load Data
    useEffect(() => {
        const load = async () => {
            try {
                // Fetch Category ID "Steak Pre-order"
                const { data: cat } = await supabase.from('menu_categories').select('id').eq('name', 'Steak Pre-order').single()
                
                if (cat) {
                     const { data: items } = await supabase.from('menu_items')
                        .select('*')
                        .eq('category', 'Steak Pre-order') // Or use ID if consistent
                        .order('price', { ascending: false })
                    setSteaks(items || [])
                } else {
                    // Fallback search by category string if mapped
                    const { data: items } = await supabase.from('menu_items').select('*').eq('category', 'Steak Pre-order')
                    setSteaks(items || [])
                }

                // Fetch Doneness Options
                const { data: group } = await supabase.from('option_groups').select('id, selection_type').eq('name', 'Doneness').single()
                if (group) {
                    const { data: opts } = await supabase.from('option_choices').select('*').eq('group_id', group.id)
                    setDonenessOpts(opts || [])
                }

            } catch (e) {
                console.error("Load steaks failed", e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const totalQty = state.cart.reduce((a, b) => a + b.quantity, 0)
    const totalPrice = state.cart.reduce((a, b) => a + (b.price * b.quantity), 0)

    // Helper: Calculate qty for specific item (ignoring doneness differentiation for badge count on card)
    const getItemQty = (id) => state.cart.filter(i => i.id === id).reduce((a,b) => a + b.quantity, 0)

    if (loading) return <div className="p-12 text-center text-gray-400">Loading Premium Cuts...</div>

    return (
        <div className="flex-1 flex flex-col min-h-0 pb-32">
            <h2 className="text-xl font-light mb-6 px-1 flex items-center gap-2">
                เลือกเนื้อที่คุณต้องการ <span className="text-sm text-gray-400 font-normal hidden sm:inline">(Choose your cut)</span>
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 overflow-y-auto px-1 pb-4">
                {steaks.map(item => (
                    <MeatSelectionCard 
                        key={item.id} 
                        item={item} 
                        donenessOptions={donenessOpts}
                        qty={getItemQty(item.id)}
                        onAdd={(payload) => dispatch({ type: 'ADD_TO_CART', payload })}
                        sideDishes={settings.sideDishes}
                        sideDishEnabled={settings.sideDishEnabled}
                    />
                ))}
            </div>

            {/* Cart Summary / Next */}
            {totalQty > 0 && (
                 <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-gray-200 z-50">
                    <div className="max-w-2xl mx-auto flex items-center justify-between">
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">ยอดรวม (Total)</div>
                            <div className="text-xl font-mono font-bold">฿{totalPrice.toLocaleString()}</div>
                            <div className="text-xs text-gray-400">{totalQty} ชิ้น (Items)</div>
                        </div>
                        <button
                            onClick={onNext}
                            className="bg-[#1a1a1a] text-[#DFFF00] px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                        >
                            เลือกประสบการณ์ต่อ <span className="text-xs opacity-70 font-normal ml-1">(Next)</span> <Check size={16} />
                        </button>
                    </div>
                 </div>
            )}
        </div>
    )
}
