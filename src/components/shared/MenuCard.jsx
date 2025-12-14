
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'

// Using Lucide 'Plus' instead of custom SVG for better consistency if possible, 
// but sticking to the custom one to preserve exact look if preferred. 
// The user used a custom one, let's include it here locally.

const PlusIcon = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
)

const MenuCard = ({ item, mode, onAdd, onRemove, qty, t }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`group bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-black/20 transition-all ${mode === 'list' ? 'flex flex-row items-center p-3 gap-4 h-24' : 'flex flex-col h-full'}`}
        >
            <div className={`bg-gray-100 overflow-hidden relative ${mode === 'list' ? 'w-20 h-full rounded-lg shrink-0' : 'w-full aspect-square'}`}>
                {item.image_url ? (
                    <img src={item.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.name} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Image</div>
                )}
            </div>

            <div className={`flex flex-col justify-between ${mode === 'list' ? 'flex-1 py-1' : 'p-4 flex-1'}`}>
                <div>
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.name}</h3>
                        {mode === 'list' && <span className="font-mono text-sm font-bold ml-2">{item.price}.-</span>}
                    </div>
                    {mode === 'grid' && <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider">{item.category}</p>}
                </div>

                <div className={`flex items-end justify-between ${mode === 'grid' ? 'mt-3' : 'mt-0'}`}>
                    {mode === 'grid' && <span className="font-mono text-sm font-bold">{item.price}.-</span>}

                    {/* Quantity Control */}
                    {qty > 0 ? (
                        <div className={`flex items-center bg-black text-white rounded-full shadow-lg overflow-hidden ${mode === 'list' ? 'h-8' : 'h-8'}`}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(item); }}
                                className="w-8 h-full flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all text-lg font-bold pb-1"
                            >
                                -
                            </button>
                            <span className="font-bold text-sm min-w-[20px] text-center">{qty}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onAdd(item); }}
                                className="w-8 h-full flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all text-lg font-bold pb-1"
                            >
                                +
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => onAdd(item)}
                            className={`active:scale-95 transition-transform flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-black group-hover:bg-[#DFFF00] group-hover:text-black ${mode === 'list' ? 'px-4 py-1.5 rounded-full text-xs font-bold' : 'w-8 h-8 rounded-full'}`}
                        >
                            {mode === 'list' ? t('addToCart') : <PlusIcon size={16} />}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

export default MenuCard
