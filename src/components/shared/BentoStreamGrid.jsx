import { motion } from 'framer-motion'
import { Heart, ArrowUpRight } from 'lucide-react'

const COLORS = [
    'bg-[#B4AEDC]', // Soft Purple
    'bg-[#E06132]', // Burnt Orange
    'bg-[#C3D2C4]', // Sage Green
    'bg-[#E9F344]', // Bright Yellow
]

const TEXT_COLORS = [
    'text-[#23201D]', // Dark Ink for Purple
    'text-white',     // White for Orange
    'text-[#23201D]', // Dark Ink for Green
    'text-[#23201D]', // Dark Ink for Yellow
]

// Determine bento spans based on index (Repeating pattern of 6)
const getBentoClasses = (index) => {
    const pattern = index % 6
    switch (pattern) {
        case 0:
            return 'md:col-span-1 md:row-span-2' // Tall (Purple)
        case 1:
            return 'md:col-span-2 md:row-span-2' // Large wide (Image)
        case 2:
            return 'md:col-span-1 md:row-span-2' // Tall (Orange)
        case 3:
            return 'md:col-span-1 md:row-span-2' // Tall (Purple with half img)
        case 4:
            return 'md:col-span-1 md:row-span-2' // Tall (Green with half img)
        case 5:
            return 'md:col-span-3 md:row-span-2 lg:col-span-2' // Large wide (Image) + Yellow in next row... wait, let's keep it simple
        default:
            return 'md:col-span-1 md:row-span-2'
    }
}

const BentoCard = ({ item, index, onItemClick, likedIds, onLikeToggle }) => {
    const isLiked = likedIds?.includes(item.id)
    const colorIndex = index % COLORS.length
    const bgColor = COLORS[colorIndex]
    const textColor = TEXT_COLORS[colorIndex]
    
    // Customize the pattern specifically for the image reference
    let bentoSpan = 'md:col-span-1 md:row-span-2' // Default tall
    let showFullImage = false
    let showHalfImage = false

    const pattern = index % 6
    if (pattern === 0) {
        bentoSpan = 'col-span-1 md:col-span-1 row-span-2'
    } else if (pattern === 1) {
        bentoSpan = 'col-span-1 md:col-span-2 row-span-2'
        showFullImage = true
    } else if (pattern === 2) {
        bentoSpan = 'col-span-1 md:col-span-1 row-span-2'
        showHalfImage = true
    } else if (pattern === 3) {
        bentoSpan = 'col-span-1 md:col-span-1 row-span-2'
        showHalfImage = true
    } else if (pattern === 4) {
        bentoSpan = 'col-span-1 md:col-span-1 row-span-2'
        showHalfImage = true
    } else if (pattern === 5) {
        bentoSpan = 'col-span-1 md:col-span-2 row-span-2'
        showFullImage = true
    }

    const hasValidImage = item.image_url && item.image_url !== 'text_only'
    
    if (!hasValidImage) {
        showFullImage = false
        showHalfImage = false
    }

    // Badges based on source
    let badgeText = 'SOCIAL POST'
    if (item.source === 'google') badgeText = 'GOOGLE REVIEW'
    else if (item.source === 'note') badgeText = 'GUEST NOTE'
    else if (item.source === 'instagram') badgeText = 'INSTAGRAM'
    else if (item.source === 'facebook') badgeText = 'FACEBOOK'

    return (
        <motion.div
            layoutId={`card-${item.id}`}
            onClick={() => onItemClick?.(item)}
            whileHover={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`relative group overflow-hidden rounded-[32px] cursor-pointer shadow-sm hover:shadow-lg transition-shadow duration-300 ${bentoSpan} ${showFullImage ? 'bg-[#1a1a1a]' : bgColor} min-h-[420px] flex flex-col border border-black/5`}
        >
            {/* Background Image Layer */}
            {hasValidImage && (
                <div className={`absolute inset-0 z-0 ${showFullImage ? 'opacity-100' : (showHalfImage ? 'opacity-100 mt-[45%] rounded-t-[24px] overflow-hidden' : 'hidden')}`}>
                    <img 
                        src={item.image?.src || item.image_url} 
                        alt={item.text || "Check-in image"} 
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        loading="lazy"
                    />
                    {showFullImage && <div className="absolute inset-0 bg-black/30 transition-opacity group-hover:bg-black/40" />}
                </div>
            )}

            {/* Content Overlay */}
            <div className="relative z-10 flex flex-col h-full p-8 justify-between">
                
                {/* Top Section: Badge & Rating */}
                <div className="flex justify-between items-start">
                    <span className={`px-4 py-1.5 text-[10px] font-sans font-extrabold tracking-wide uppercase border rounded-full backdrop-blur-md 
                        ${showFullImage || textColor === 'text-white' 
                            ? 'border-white/40 text-white bg-black/20' 
                            : 'border-black/20 text-black bg-white/30'}`}>
                        {badgeText}
                    </span>

                    {item.rating && (
                        <div className={`flex gap-0.5 text-sm ${showFullImage || textColor === 'text-white' ? 'text-white' : 'text-black'}`}>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <span key={i}>{i < item.rating ? '★' : '☆'}</span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Middle/Bottom Section: Text & Actions */}
                <div className={`mt-auto ${showFullImage ? 'text-white' : textColor}`}>
                    <h3 className="text-3xl md:text-[32px] font-bold leading-[1.1] mb-6 line-clamp-4" style={{ fontFamily: "Inter, 'IBM Plex Sans Thai', sans-serif", letterSpacing: "-0.03em" }}>
                        {item.text ? `"${item.text}"` : `@${item.user?.name || item.user_name || "Guest"}`}
                    </h3>

                    <div className="flex items-end justify-between mt-6">
                        {/* User Info */}
                        <div className="flex flex-col">
                            <span className="text-[10px] font-mono tracking-widest uppercase opacity-70 mb-1 font-bold">
                                BY {item.user?.name || item.user_name || "GUEST"}
                            </span>
                            <span className="text-[10px] font-mono tracking-widest uppercase opacity-50">
                                {item.date || 'Recently'}
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            {onLikeToggle && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onLikeToggle(e, item.id)
                                    }}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 active:scale-95 cursor-pointer
                                        ${showFullImage || textColor === 'text-white' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/5 text-black hover:bg-black/10'}`}
                                >
                                    <Heart
                                        size={18}
                                        className={isLiked ? "fill-red-500 text-red-500" : ""}
                                    />
                                </button>
                            )}
                            
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:rotate-45
                                ${showFullImage || textColor === 'text-white' ? 'bg-white text-black' : 'bg-[#23201D] text-white'}`}>
                                <ArrowUpRight size={22} strokeWidth={2.5} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export default function BentoStreamGrid({ items, onItemClick, likedIds, onLikeToggle }) {
    if (!items || items.length === 0) return null

    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 md:px-8 pt-32 pb-24">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 auto-rows-[minmax(200px,auto)]">
                {items.map((item, index) => (
                    <BentoCard 
                        key={item.id || index}
                        item={item}
                        index={index}
                        onItemClick={onItemClick}
                        likedIds={likedIds}
                        onLikeToggle={onLikeToggle}
                    />
                ))}
            </div>
        </div>
    )
}
