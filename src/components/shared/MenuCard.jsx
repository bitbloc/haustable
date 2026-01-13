
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Star, Minus } from 'lucide-react'

// Using Lucide 'Plus' instead of custom SVG for better consistency if possible, 
// but sticking to the custom one to preserve exact look if preferred. 
// The user used a custom one, let's include it here locally.

const PlusIcon = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
)
// The custom PlusIcon component is no longer needed as Lucide's Plus and Minus are used directly.

const MenuCard = ({ item, mode, onAdd, onRemove, qty, t, sideDishes, sideDishEnabled }) => {
    const hasOptions = item.menu_item_options && item.menu_item_options.length > 0
    const [ripples, setRipples] = useState([])

    const createRipple = (e) => {
        const button = e.currentTarget.getBoundingClientRect()
        // Improve ripple positioning to be centered or click-relative? 
        // User asked for "spread out", centered on button/click is standard.
        // Let's make it emanate from the center of the button for a "scent" effect.
        const size = Math.max(button.width, button.height)
        const x = e.clientX - button.left - size / 2
        const y = e.clientY - button.top - size / 2
        
        // Actually, for "scent spreading out", maybe center of the button is best?
        // Let's stick to click position for interactivity, or center for "aura".
        // "Ripple effect" usually implies click feedback.
        
        const newRipple = {
            x,
            y,
            size,
            id: Date.now()
        }
        
        setRipples((prev) => [...prev, newRipple])
        
        // Clean up ripple after animation
        setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== newRipple.id))
        }, 1000)

        // Trigger the actual action
        onAdd(item)
    }

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
                <div className="absolute inset-0 cursor-pointer" onClick={(e) => {
                    // Start ripple if clicking image too?
                    // User said: Mouse over (image and button) > Click > Ripple.
                    // The button has its own click handler. This is for adding via image.
                    onAdd(item)
                }}></div>

                {item.is_recommended && (
                    <div className="absolute top-2 left-2 bg-[#DFFF00] text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm z-10">
                        <Star size={10} fill="currentColor" /> Recommended
                    </div>
                )}
                
                {/* Visual Balance: Side Dish Fix Thumbnails (Overlay at bottom) */}
                {sideDishEnabled && sideDishes && sideDishes.length > 0 && (
                     <div className="absolute bottom-2 left-2 right-2 flex gap-1.5 z-20 pointer-events-none">
                        {sideDishes.map((sd) => (
                            <div key={sd.id} className="relative group/sd pointer-events-auto cursor-help">
                                {/* Thumbnail */}
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded border border-white/30 overflow-hidden bg-black/20 backdrop-blur-sm shadow-sm transition-transform hover:scale-110">
                                    <img src={sd.url} alt={sd.name} className="w-full h-full object-cover opacity-90 hover:opacity-100" />
                                </div>
                                
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max max-w-[100px] pointer-events-none opacity-0 group-hover/sd:opacity-100 transition-all duration-300 transform translate-y-2 group-hover/sd:translate-y-0 text-center z-30">
                                    <div className="bg-black/80 backdrop-blur text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xl whitespace-nowrap">
                                        {sd.name}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-3 border-transparent border-t-black/80"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
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
                        <div className="relative overflow-visible"> 
                           {/* Ripples Container (Absolute to button/container) */}
                           {ripples.map((ripple) => (
                                <motion.span
                                    key={ripple.id}
                                    initial={{ transform: "scale(0)", opacity: 0.5 }}
                                    animate={{ transform: "scale(4)", opacity: 0 }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    style={{
                                        position: 'absolute',
                                        top: 0, 
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '9999px',
                                        backgroundColor: 'rgba(0,0,0, 0.1)', // Light spreading color
                                        pointerEvents: 'none',
                                        zIndex: 0
                                    }}
                                />
                            ))}

                            <button
                                onClick={createRipple}
                                className="relative overflow-hidden bg-black text-white h-8 pl-3 pr-3 rounded-full text-xs font-bold active:scale-95 transition-all duration-300 flex items-center gap-0 group-hover:pr-4 shadow-lg hover:bg-gray-800 z-10"
                                style={{ maxWidth: '100%' }}
                            >
                                <Plus size={16} className="shrink-0" />
                                <span className="max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 group-hover:ml-1 transition-all duration-300 whitespace-nowrap overflow-hidden">
                                    เลือกอร่อย
                                </span>
                            </button>
                        </div>
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
