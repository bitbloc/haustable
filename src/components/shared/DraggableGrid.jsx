"use client"

import { motion, useMotionValue, animate } from "framer-motion"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { Heart } from "lucide-react"

const defaultItems = [
    {
        image: {
            src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/612d1402-0ad9-4135-3bbc-a30a6a252b00/w=800",
        },
        alt: "",
    },
    {
        image: {
            src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/6d2ad64a-102d-4eab-0efe-31479e34b500/w=800",
        },
        alt: "",
    },
    {
        image: {
            src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/be854dd1-37aa-4fc7-f569-fdb948109300/w=800",
        },
        alt: "",
    },
    {
        image: {
            src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/51984031-9176-484b-f5e0-4af9a8e9ed00/w=800",
        },
        alt: "",
    },
    {
        image: {
            src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/34ce1842-4b7a-4d52-0302-38582c341700/w=800",
        },
        alt: "",
    },
    {
        image: {
            src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/88369c6d-00cc-4ac9-74ca-0f0965e06300/w=800",
        },
        alt: "",
    },
    {
        image: {
            src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/aeaa0756-9647-4f6c-d900-204bd25e4a00/w=800",
        },
        alt: "",
    },
    {
        image: {
            src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/316d1761-fd79-4ca9-b8d4-f2bb20521a00/w=800",
        },
        alt: "",
    },
]

const COMPONENT_DEFAULTS = {
    items: defaultItems,
    columns: 15,
    imageWidth: 200,
    imageHeight: 200,
    rounded: 3,
    gap: 5,
    enableWheel: false,
    placeholderColor: "#1a1a1f",
    rotation: 0, // Set to 0 to keep the grid and photos upright (no tilt)
}

const getProxiedImageUrl = (url) => {
    if (!url) return ''
    if (
        url.startsWith('/') || 
        url.startsWith('data:') || 
        url.includes('images.weserv.nl') || 
        url.includes('wsrv.nl') || 
        url.includes('supabase.co')
    ) {
        return url
    }
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`
}

// Distinct visible color per tile (golden-angle hue rotation) so the grid is
// always visible even when images don't load.
function getItemColor(index) {
    const hue = (index * 137.508) % 360
    return `hsl(${hue}, 45%, 40%)` // Slightly deeper saturation for contrast
}

// Fill a target length by repeating items, prioritizing placing the newest items (first in list)
// at the center of the grid (index 0,0 and surrounding cells) and moving progressively outwards.
// This naturally prevents duplicate items from being adjacent to each other.
function fillChronological(items, target, columns) {
    if (items.length === 0) return []
    const N = items.length
    const rows = Math.ceil(target / columns)
    const out = new Array(target)
    
    // Find center cell of the base grid
    const cx = Math.floor(columns / 2)
    const cy = Math.floor(rows / 2)
    
    // Create all cell positions and calculate distance to center
    const cells = []
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            const dx = c - cx
            const dy = r - cy
            const dist = dx * dx + dy * dy
            const angle = Math.atan2(dy, dx)
            cells.push({ r, c, dist, angle })
        }
    }
    
    // Sort cells: closest to center first.
    // If distances are equal, sort by angle to distribute them in a spiral/circle.
    cells.sort((a, b) => {
        if (Math.abs(a.dist - b.dist) < 0.001) {
            return a.angle - b.angle
        }
        return a.dist - b.dist
    })
    
    // Assign items (newest first) to cells closest to center
    cells.forEach((cell, idx) => {
        const itemIdx = idx % N
        const flatIdx = cell.r * columns + cell.c
        out[flatIdx] = items[itemIdx]
    })
    
    return out
}

// Viewport-aware lazy loaded card to prevent memory leaks and slow down loading for 1000+ items
function LazyCard({
    item,
    index,
    safeImageWidth,
    safeImageHeight,
    radius,
    isDragging,
    failed,
    getProxiedImageUrl,
    handleImageError,
    handlePointerDown,
    handlePointerUp,
    rotation,
    likedIds,
    onLikeToggle,
}) {
    const cardRef = useRef(null)
    const overlayRef = useRef(null)
    const [isVisible, setIsVisible] = useState(false)
    const [hasBeenVisible, setHasBeenVisible] = useState(false)

    useEffect(() => {
        if (isVisible) {
            setHasBeenVisible(true)
        }
    }, [isVisible])

    useEffect(() => {
        const el = overlayRef.current
        if (!el) return

        const stop = (e) => {
            e.stopPropagation()
        }

        // Native DOM interception before Framer Motion grabs the event
        el.addEventListener('pointerdown', stop, { capture: true })
        el.addEventListener('mousedown', stop, { capture: true })
        el.addEventListener('touchstart', stop, { capture: true, passive: true })

        return () => {
            el.removeEventListener('pointerdown', stop, { capture: true })
            el.removeEventListener('mousedown', stop, { capture: true })
            el.removeEventListener('touchstart', stop, { capture: true })
        }
    }, [isVisible])

    useEffect(() => {
        const el = cardRef.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting)
            },
            {
                root: el.closest('.draggable-container-viewport') || null,
                rootMargin: '450px', // Fetch 450px before entering viewport for smooth experience
            }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const src = item?.image?.src
    const alt = item?.alt ?? item?.image?.alt ?? ""
    const isNote = item?.source === 'note' || !src || item?.image_url === 'text_only' || item?.image_url?.startsWith('text_only')

    if (isNote) {
        return (
            <motion.div
                ref={cardRef}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                whileHover={(isVisible || hasBeenVisible) ? { scale: 1.03, y: -3 } : undefined}
                whileTap={(isVisible || hasBeenVisible) ? { scale: 0.97 } : undefined}
                transition={{ type: "spring", stiffness: 350, damping: 22 }}
                className={`select-none flex flex-col justify-between p-3 text-left ${(isVisible || hasBeenVisible) ? "border border-[var(--color-rule)] shadow-sm" : ""}`}
                style={{
                    position: "relative",
                    width: safeImageWidth,
                    height: safeImageHeight,
                    borderRadius: 2, // Minimalist Rams clean rounding (rounded-xs)
                    backgroundColor: (isVisible || hasBeenVisible) ? "var(--color-paper, #FAF9F5)" : "oklch(15% 0.005 28)", // Warm paper color when visible, carbon cell when hidden
                    color: "var(--color-ink, #1a1a1a)", // Deep hallmark ink
                    cursor: isDragging ? "grabbing" : "pointer",
                    transformOrigin: "center center",
                    boxSizing: "border-box",
                }}
            >
                {(isVisible || hasBeenVisible) && (
                    <>
                        {/* Header label in typewriter style */}
                        <div className="flex flex-col gap-1 select-none pointer-events-none w-full">
                            <div className="flex justify-between items-center text-[7px] font-mono tracking-widest text-neutral-400 uppercase">
                                <span>{item.source === 'google' ? '// GOOGLE REVIEW' : '// GUEST NOTE'}</span>
                                <span>POSTED</span>
                            </div>
                            {item.rating && (
                                <div className="flex gap-0.5 mt-0.5 text-amber-500 justify-start select-none">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <span key={i} className="text-[10px] leading-none">
                                            {i < item.rating ? '★' : '☆'}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Central body text in center-aligned slab mono */}
                        <div className="flex-grow flex items-center justify-center p-1 select-none pointer-events-none">
                            <p 
                                className="font-mono text-center break-words w-full"
                                style={{
                                    display: "-webkit-box",
                                    WebkitLineClamp: 8,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    fontFamily: "Space Mono, Courier New, Courier, monospace",
                                    fontWeight: 500,
                                     fontSize: (item.text || "").length <= 15 ? "20px" : ((item.text || "").length <= 30 ? "16px" : ((item.text || "").length <= 50 ? "13.5px" : "11px")),
                                    lineHeight: (item.text || "").length <= 15 ? "1.3" : ((item.text || "").length <= 30 ? "1.35" : ((item.text || "").length <= 50 ? "1.4" : "1.45")),
                                    color: "#262626",
                                }}
                            >
                                {item.text || "Hello IN THE HAUS!"}
                            </p>
                        </div>
 
                        {/* Footer label with guest user name */}
                        <div className="text-[7px] font-mono tracking-wider text-neutral-400 text-center uppercase border-t border-neutral-200/50 pt-2 truncate select-none pointer-events-none">
                            BY {item.user?.name || item.user_name || "GUEST"}
                        </div>
                    </>
                )}
            </motion.div>
        )
    }
 
    return (
        <motion.div
            ref={cardRef}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            whileHover={(isVisible || hasBeenVisible) ? { scale: 1.03, y: -3 } : undefined}
            whileTap={(isVisible || hasBeenVisible) ? { scale: 0.97 } : undefined}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
            style={{
                position: "relative",
                width: safeImageWidth,
                height: safeImageHeight,
                overflow: "hidden",
                borderRadius: radius,
                backgroundColor: (isVisible || hasBeenVisible) && src && !failed ? "#111111" : "oklch(15% 0.005 28)",
                color: "rgba(255,255,255,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                fontSize: Math.max(
                    14,
                    Math.round(Math.min(safeImageWidth, safeImageHeight) * 0.16)
                ),
                fontWeight: 600,
                cursor: isDragging ? "grabbing" : "pointer",
                transformOrigin: "center center",
                isolation: "isolate",
                WebkitMaskImage: "-webkit-radial-gradient(white, black)",
            }}
        >
            {(isVisible || hasBeenVisible) && (
                <>
                    {/* Hidden index helper, overlays check-in type if loaded */}
                    <div className="absolute inset-0 bg-black/10 flex flex-col justify-between p-3 z-10 text-white select-none pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-mono opacity-80 uppercase tracking-widest">{item.source || 'tag'}</span>
                    </div>
                    
                    {src && !failed ? (
                        <>
                            <img
                                src={getProxiedImageUrl(src)}
                                alt={alt}
                                draggable={false}
                                crossOrigin="anonymous"
                                onError={handleImageError}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    pointerEvents: "none",
                                    userSelect: "none",
                                    display: "block",
                                    zIndex: 1,
                                    animation: "lazyCardFadeIn 0.3s ease-out forwards",
                                }}
                            />
                            
                            {/* Minimalist Rams Caption & Interactive Likes overlay */}
                            <div 
                                ref={overlayRef}
                                className="absolute bottom-0 left-0 right-0 z-10 bg-[#111111]/90 border-t border-white/5 px-4 pt-2.5 pb-3.5 flex items-center justify-between gap-2 pointer-events-auto select-none"
                                style={{ 
                                    boxSizing: "border-box",
                                    borderBottomLeftRadius: radius,
                                    borderBottomRightRadius: radius,
                                }}
                            >
                                <div className="flex-1 min-w-0">
                                    {/* Short caption text */}
                                    <p className="font-mono text-[8px] text-neutral-300 leading-tight truncate">
                                        {item.text ? item.text : `@${item.user?.name || item.user_name || "Customer"}`}
                                    </p>
                                    {/* Platform source */}
                                    <span className="font-mono text-[7px] text-neutral-500 uppercase tracking-widest block mt-0.5">
                                        {item.source || "post"}
                                    </span>
                                </div>

                                {/* Interactive heart button */}
                                {onLikeToggle && (
                                    <button
                                        onClick={(e) => onLikeToggle(e, item.id)}
                                        className="flex items-center gap-1 hover:scale-110 active:scale-95 transition-all text-neutral-400 hover:text-white cursor-pointer bg-transparent border-0 p-1 outline-none select-none animate-fade-in"
                                    >
                                        <Heart
                                            size={10}
                                            className={likedIds && likedIds.includes(item.id) ? "text-[#E1306C] fill-[#E1306C]" : "text-neutral-400"}
                                        />
                                        <span className={`font-mono text-[8px] ${likedIds && likedIds.includes(item.id) ? "text-[#E1306C] font-bold" : "text-neutral-400"}`}>
                                            {item.likes || 0}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center select-none font-mono">
                            <span className="text-xl">📸</span>
                            <span className="text-[9px] uppercase tracking-wider mt-2 opacity-80">{item.user?.name || item.user_name || "Check-in"}</span>
                        </div>
                    )}
                </>
            )}
        </motion.div>
    )
}

export default function DraggableGrid(props) {
    const finalProps = { ...COMPONENT_DEFAULTS, ...props }
    const {
        items,
        columns,
        imageWidth,
        imageHeight,
        rounded,
        gap,
        enableWheel,
        onItemClick,
        style,
        rotation,
        likedIds,
        onLikeToggle,
    } = finalProps

    const containerRef = useRef(null)
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const [containerSize, setContainerSize] = useState({ w: 800, h: 600 })
    const [isDragging, setIsDragging] = useState(false)
    const initializedRef = useRef(false)

    const pointerDownPos = useRef(null)
    const wheelAnimX = useRef(null)
    const wheelAnimY = useRef(null)
    const failedImages = useRef(new Set())
    const [, forceRender] = useState(0)



    const safeItems =
        Array.isArray(items) && items.length > 0 ? items : defaultItems
    const safeColumns = useMemo(() => {
        const count = safeItems.length
        if (count === 0) return 4
        // Dynamically reduce column count for low number of uploaded images
        // so that they look like a nice, filled collage instead of a massive matrix of duplicates
        let cols = columns || 14
        if (count <= 3) cols = 3
        else if (count <= 8) cols = 4
        else if (count <= 15) cols = 6
        else if (count <= 30) cols = 10
        return Math.max(1, Math.min(20, Math.floor(cols)))
    }, [safeItems.length, columns])
    // Image dimensions match CurveGallery (px, clamped 20–4000).
    const safeImageWidth = Math.max(20, Math.min(4000, imageWidth ?? 150))
    const safeImageHeight = Math.max(20, Math.min(4000, imageHeight ?? 210))
    // Gap matches CurveGallery: control is 0–100, ×4 → px. Same value spaces
    // tiles from each other AND the grid edge from the boundary (padding).
    const safeGap = Math.max(0, Math.min(100, gap ?? 4)) * 4
    // Rounded matches CurveGallery: 0 = square … 20 = circle (on short side).
    const r = Math.max(0, Math.min(20, rounded ?? 3))
    const radius = (r / 20) * (Math.min(safeImageWidth, safeImageHeight) / 2)

    // Calculate grid rows dynamically to fit all loaded items (at least safeColumns size)
    const rows = Math.max(safeColumns, Math.ceil(safeItems.length / safeColumns))
    const totalCells = safeColumns * rows
    const displayItems = useMemo(
        () => fillChronological(safeItems, totalCells, safeColumns),
        [safeItems, totalCells, safeColumns]
    )

    const extendedColumns = safeColumns * 3
    const extendedRows = rows * 3
    const expandedGridW = extendedColumns * safeImageWidth + (extendedColumns - 1) * safeGap
    const expandedGridH = extendedRows * safeImageHeight + (extendedRows - 1) * safeGap

    const displayItemsExtended = useMemo(() => {
        const out = []
        const baseLen = displayItems.length
        if (baseLen === 0) return []
        
        for (let r_ext = 0; r_ext < extendedRows; r_ext++) {
            for (let c_ext = 0; c_ext < extendedColumns; c_ext++) {
                const r_base = r_ext % rows
                const c_base = c_ext % safeColumns
                const baseIdx = r_base * safeColumns + c_base
                out.push(displayItems[baseIdx % baseLen])
            }
        }
        return out
    }, [displayItems, safeColumns, rows, extendedColumns, extendedRows])

    const gridW = safeColumns * safeImageWidth + (safeColumns - 1) * safeGap
    const gridH = rows * safeImageHeight + (rows - 1) * safeGap

    // Measure container with ResizeObserver
    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const measure = () => {
            const rect = el.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
                setContainerSize({ w: rect.width, h: rect.height })
            }
        }
        measure()

        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // Drag constraints: at either extreme the edge images stop exactly one
    // gap from the container border — no overshoot into empty space.
    // maxX/maxY: grid pinned `gap` from the top-left border.
    // minX/minY: grid's far edge `gap` from the bottom-right border.
    // When the grid is smaller than the container the range collapses to the
    // top-left position (min clamped to max), so it can't drift.


    // Scale boundaries and cycles for infinite loops
    const cycleW = gridW + safeGap
    const cycleH = gridH + safeGap

    // Infinite wrapping logic centered around the middle copy
    useEffect(() => {
        let isWrappingX = false
        let isWrappingY = false

        const unsubscribeX = x.onChange((latest) => {
            if (isWrappingX) return
            const half = 0.5 * cycleW
            const center = -cycleW
            const minLimit = center - half
            const maxLimit = center + half

            if (latest > maxLimit) {
                isWrappingX = true
                x.set(latest - cycleW)
                isWrappingX = false
            } else if (latest < minLimit) {
                isWrappingX = true
                x.set(latest + cycleW)
                isWrappingX = false
            }
        })

        const unsubscribeY = y.onChange((latest) => {
            if (isWrappingY) return
            const half = 0.5 * cycleH
            const center = -cycleH
            const minLimit = center - half
            const maxLimit = center + half

            if (latest > maxLimit) {
                isWrappingY = true
                y.set(latest - cycleH)
                isWrappingY = false
            } else if (latest < minLimit) {
                isWrappingY = true
                y.set(latest + cycleH)
                isWrappingY = false
            }
        })

        return () => {
            unsubscribeX()
            unsubscribeY()
        }
    }, [cycleW, cycleH, x, y])

    // Center the grid initially (focusing on the middle repeat copy aligned to viewport center)
    useEffect(() => {
        if (initializedRef.current) return
        if (containerSize.w === 0 || containerSize.h === 0) return

        const initialX = -cycleW + (containerSize.w - safeImageWidth) / 2
        const initialY = -cycleH + (containerSize.h - safeImageHeight) / 2
        x.set(initialX)
        y.set(initialY)
        initializedRef.current = true
    }, [containerSize.w, containerSize.h, cycleW, safeImageWidth, safeImageHeight, x, y])



    // Global listener to ensure isDragging is reset to false even if drag events
    // are canceled or bubble out of the container (critical for mobile browsers).
    useEffect(() => {
        const handleGlobalRelease = () => {
            setIsDragging(false)
        }
        window.addEventListener('pointerup', handleGlobalRelease)
        window.addEventListener('touchend', handleGlobalRelease)
        return () => {
            window.removeEventListener('pointerup', handleGlobalRelease)
            window.removeEventListener('touchend', handleGlobalRelease)
        }
    }, [])

    // Disable native viewport zooming and overscroll bouncing on mobile device gestures
    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const handleTouchMove = (e) => {
            // Prevent all native touch actions (overscroll, body scroll bounce, standard gestures)
            e.preventDefault()
        }

        const handleGesture = (e) => {
            e.preventDefault()
        }

        el.addEventListener('touchmove', handleTouchMove, { passive: false })
        el.addEventListener('gesturestart', handleGesture, { passive: false })
        el.addEventListener('gesturechange', handleGesture, { passive: false })

        return () => {
            el.removeEventListener('touchmove', handleTouchMove)
            el.removeEventListener('gesturestart', handleGesture)
            el.removeEventListener('gesturechange', handleGesture)
        }
    }, [])


    // Wheel scrolling
    useEffect(() => {
        if (!enableWheel) return
        const el = containerRef.current
        if (!el) return

        const onWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault()
                return // Block trackpad pinch-to-zoom completely
            }
            e.preventDefault()
            const curX = x.get()
            const curY = y.get()
            const targetX = curX - e.deltaX
            const targetY = curY - e.deltaY
            if (wheelAnimX.current) wheelAnimX.current.stop()
            if (wheelAnimY.current) wheelAnimY.current.stop()
            wheelAnimX.current = animate(x, targetX, {
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1],
            })
            wheelAnimY.current = animate(y, targetY, {
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1],
            })
        }

        el.addEventListener("wheel", onWheel, { passive: false })
        return () => {
            el.removeEventListener("wheel", onWheel)
            if (wheelAnimX.current) wheelAnimX.current.stop()
            if (wheelAnimY.current) wheelAnimY.current.stop()
        }
    }, [enableWheel, x, y])

    const handlePointerDown = useCallback((e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    }, [])

    const handlePointerUp = useCallback(
        (e, item, index) => {
            const start = pointerDownPos.current
            pointerDownPos.current = null
            if (!start) return
            const dx = e.clientX - start.x
            const dy = e.clientY - start.y
            const moved = Math.hypot(dx, dy)
            if (moved < 5) {
                onItemClick?.(item, index)
            }
        },
        [onItemClick]
    )

    const handleImageError = useCallback((index) => {
        failedImages.current.add(index)
        forceRender((n) => n + 1)
    }, [])

    const wrapperStyle = {
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: "100%",
        minHeight: "100%",
        margin: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        cursor: isDragging ? "grabbing" : "grab",
        ...style,
    }

    const gridStyle = {
        position: "absolute",
        top: 0,
        left: 0,
        width: expandedGridW,
        height: expandedGridH,
        boxSizing: "border-box",
        display: "grid",
        gridTemplateColumns: `repeat(${extendedColumns}, ${safeImageWidth}px)`,
        gridAutoRows: `${safeImageHeight}px`,
        gap: `${safeGap}px`,
        willChange: "transform",
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "0 0",
    }

    return (
        <div ref={containerRef} className="draggable-container-viewport" style={wrapperStyle}>
            <style>{`
                @keyframes lazyCardFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
            <motion.div
                style={{ ...gridStyle, x, y }}
                drag={true}
                dragElastic={0}
                dragMomentum={true}
                onDragStart={() => {
                    setIsDragging(true)
                }}
                onDragEnd={() => setIsDragging(false)}
            >
                {displayItemsExtended.map((item, index) => {
                    const failed = failedImages.current.has(index)
                    return (
                        <LazyCard
                            key={`${item.id || index}-${index}`}
                            item={item}
                            index={index}
                            safeImageWidth={safeImageWidth}
                            safeImageHeight={safeImageHeight}
                            radius={radius}
                            isDragging={isDragging}
                            failed={failed}
                            getProxiedImageUrl={getProxiedImageUrl}
                            handleImageError={() => handleImageError(index)}
                            handlePointerDown={handlePointerDown}
                            handlePointerUp={(e) => handlePointerUp(e, item, index)}
                            rotation={rotation}
                            likedIds={likedIds}
                            onLikeToggle={onLikeToggle}
                        />
                    )
                })}
            </motion.div>
        </div>
    )
}
