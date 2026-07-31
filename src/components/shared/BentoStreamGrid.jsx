import { motion } from 'framer-motion'
import { Heart, ArrowUpRight, Instagram, Facebook, MapPin, MessageSquare } from 'lucide-react'

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



const BentoCard = ({ item, index, onItemClick, likedIds, onLikeToggle }) => {
    const isLiked = likedIds?.includes(item.id)
    const colorIndex = index % COLORS.length
    const bgColor = COLORS[colorIndex]
    const textColor = TEXT_COLORS[colorIndex]
    
    // Make grid denser and images smaller (more frequent)
    const pattern = index % 10
    let bentoSpan = 'col-span-1 sm:col-span-1 md:col-span-1 row-span-1'
    
    // Occasionally make some cards larger for bento effect
    if (pattern === 0 || pattern === 5) {
        bentoSpan = 'col-span-1 sm:col-span-2 md:col-span-2 row-span-2'
    } else if (pattern === 3) {
        bentoSpan = 'col-span-1 sm:col-span-2 md:col-span-2 row-span-1'
    }

    const hasValidImage = item.image_url && item.image_url !== 'text_only'
    
    // Always emphasize clear pictures with full bleed if an image exists
    const showFullImage = hasValidImage

    // Badges based on source
    let badgeText = 'SOCIAL POST'
    let BadgeIcon = MessageSquare
    let badgeColorClass = showFullImage || textColor === 'text-white' ? 'border-white/40 text-white bg-black/20' : 'border-black/20 text-black bg-white/30'
    
    if (item.source === 'google') {
        badgeText = 'GOOGLE REVIEW'
        BadgeIcon = MapPin
        badgeColorClass = 'text-[#23201D] bg-[#E9F344]/90 border-[#E9F344]/50'
    } else if (item.source === 'note') {
        badgeText = 'GUEST NOTE'
        BadgeIcon = MessageSquare
        badgeColorClass = 'text-[#23201D] bg-white/90 border-white/50'
    } else if (item.source === 'instagram') {
        badgeText = 'INSTAGRAM'
        BadgeIcon = Instagram
        badgeColorClass = 'text-white bg-pink-500/90 border-pink-400/50'
    } else if (item.source === 'facebook') {
        badgeText = 'FACEBOOK'
        BadgeIcon = Facebook
        badgeColorClass = 'text-white bg-blue-500/90 border-blue-400/50'
    }

    return (
        <motion.div
            layoutId={`card-${item.id}`}
            onClick={() => onItemClick?.(item)}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            whileHover={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, opacity: { duration: 0.4 } }}
            className={`relative group overflow-hidden rounded-[28px] cursor-pointer shadow-sm hover:shadow-lg transition-shadow duration-300 ${bentoSpan} ${showFullImage ? 'bg-[#1a1a1a]' : bgColor} min-h-[280px] flex flex-col border border-black/5`}
        >
            {/* Background Image Layer */}
            {hasValidImage && (
                <div className="absolute inset-0 z-0 opacity-100">
                    <img 
                        src={item.image?.src || item.image_url} 
                        alt={item.text || "Check-in image"} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        crossOrigin="anonymous"
                        loading="lazy"
                    />
                    {/* Dark gradient from bottom to make text readable but keep image very clear at the top */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity group-hover:from-black/90" />
                </div>
            )}

            {/* Content Overlay */}
            <div className="relative z-10 flex flex-col h-full p-8 justify-between">
                
                {/* Top Section: Badge & Rating */}
                <div className="flex justify-between items-start">
                    <span className={`px-3 py-1.5 text-[9px] font-sans font-bold tracking-wide uppercase border rounded-full backdrop-blur-md flex items-center gap-1.5 ${badgeColorClass}`}>
                        <BadgeIcon size={12} />
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
                    <h3 className={`${bentoSpan.includes('row-span-2') ? 'text-xl md:text-2xl' : 'text-lg'} font-bold leading-[1.25] mb-4 line-clamp-[5]`} style={{ fontFamily: "Inter, 'IBM Plex Sans Thai', sans-serif", letterSpacing: "-0.01em" }}>
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
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 pt-28 pb-24">
            <div className="grid grid-flow-dense grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 auto-rows-[minmax(280px,auto)]">
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
