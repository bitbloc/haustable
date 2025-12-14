
import { motion } from 'framer-motion'
import { Plus, Star, Minus } from 'lucide-react'

// Using Lucide 'Plus' instead of custom SVG for better consistency if possible, 
// but sticking to the custom one to preserve exact look if preferred. 
// The user used a custom one, let's include it here locally.

const PlusIcon = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
)
// The custom PlusIcon component is no longer needed as Lucide's Plus and Minus are used directly.

const MenuCard = ({ item, mode, onAdd, onRemove, qty, t }) => {
    const hasOptions = item.menu_item_options && item.menu_item_options.length > 0

    return (
        <div className={`group bg-white rounded-2xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${mode === 'list' ? 'flex gap-4' : ''}`}>

            {/* Image */}
            <div className={`bg-gray-100 rounded-xl overflow-hidden shrink-0 ${mode === 'list' ? 'w-24 h-24' : 'aspect-square mb-3'} relative`}>
                {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <span className="text-xs">No Image</span>
                    </div>
                )}

                {mode !== 'list' && qty > 0 && (
                    <div className="absolute top-2 right-2 bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md z-10">
                        {qty}
                    </div>
                )}
                {/* Clickable Overlay */}
                <div className="absolute inset-0 cursor-pointer" onClick={() => onAdd(item)}></div>

                {item.is_recommended && (
                    <div className="absolute top-2 left-2 bg-[#DFFF00] text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm z-10">
                        <Star size={10} fill="currentColor" /> Recommended
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-900 truncate leading-snug">{item.name}</h3>
                    </div>
                    {item.description && <p className="text-xs text-gray-400 line-clamp-2 mt-1">{item.description}</p>}
                </div>

                <div className="flex items-end justify-between mt-2">
                    <span className="font-mono font-bold text-lg text-black">{item.price}.-</span>

                    {hasOptions ? (
                        <button
                            onClick={() => onAdd(item)}
                            className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-90 transition-transform flex items-center gap-1 shadow-lg hover:bg-gray-800"
                        >
                            <Plus size={14} /> Customize
                        </button>
                    ) : (
                        qty === 0 ? (
                            <button onClick={() => onAdd(item)} className="bg-gray-100 text-black w-8 h-8 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors active:scale-90">
                                <Plus size={16} />
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 bg-black text-white rounded-full px-2 py-1 shadow-lg">
                                <button onClick={(e) => { e.stopPropagation(); onRemove(item); }} className="w-6 h-6 flex items-center justify-center active:scale-90"><Minus size={14} /></button>
                                <span className="font-bold text-xs w-2 text-center">{qty}</span>
                                <button onClick={(e) => { e.stopPropagation(); onAdd(item); }} className="w-6 h-6 flex items-center justify-center active:scale-90"><Plus size={14} /></button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}

export default MenuCard
