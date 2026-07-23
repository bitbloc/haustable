"use client"

import { motion, useMotionValue, useTransform } from "framer-motion"
import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react"
import { Heart } from "lucide-react"

// Global set to track loaded image URLs for zero-flicker instant rendering
const LOADED_IMAGE_SET = new Set()

const defaultItems = [
    { image: { src: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop" }, alt: "Chef plating food" },
    { image: { src: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop" }, alt: "Dining atmosphere" },
    { image: { src: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop" }, alt: "Southern dish" },
    { image: { src: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop" }, alt: "Roast plate" },
    { image: { src: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800&auto=format&fit=crop" }, alt: "Pizza plate" },
    { image: { src: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=800&auto=format&fit=crop" }, alt: "Restaurant vibe" }
]

const COMPONENT_DEFAULTS = {
    items: defaultItems,
    columns: 14,
    imageWidth: 256,
    imageHeight: 320,
    rounded: 1,
    gap: 4,
    enableWheel: true,
    rotation: 0
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

function wrapOffset(val, cycle) {
    if (!cycle || cycle <= 0) return 0
    let rem = val % cycle
    if (rem > 0) rem -= cycle
    return rem
}

function fillChronological(items, target, columns) {
    if (items.length === 0) return []
    const N = items.length
    const rows = Math.ceil(target / columns)
    const out = new Array(target)
    
    const cx = Math.floor(columns / 2)
    const cy = Math.floor(rows / 2)
    
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
    
    cells.sort((a, b) => {
        if (Math.abs(a.dist - b.dist) < 0.001) {
            return a.angle - b.angle
        }
        return a.dist - b.dist
    })
    
    cells.forEach((cell, idx) => {
        const itemIdx = idx % N
        const flatIdx = cell.r * columns + cell.c
        out[flatIdx] = items[itemIdx]
    })
    
    return out
}

const GridCard = memo(function GridCard({
    item,
    safeImageWidth,
    safeImageHeight,
    radius,
    isDragging,
    handlePointerDown,
    handlePointerUp,
    likedIds,
    onLikeToggle
}) {
    const src = item?.image?.src
    const proxiedSrc = useMemo(() => getProxiedImageUrl(src), [src])
    const isAlreadyLoaded = proxiedSrc && LOADED_IMAGE_SET.has(proxiedSrc)
    const [imgLoaded, setImgLoaded] = useState(isAlreadyLoaded)
    const [imgFailed, setImgFailed] = useState(false)
    const overlayRef = useRef(null)

    useEffect(() => {
        const el = overlayRef.current
        if (!el) return
        const stop = (e) => e.stopPropagation()
        el.addEventListener('pointerdown', stop, { capture: true })
        el.addEventListener('mousedown', stop, { capture: true })
        el.addEventListener('touchstart', stop, { capture: true, passive: true })
        return () => {
            el.removeEventListener('pointerdown', stop, { capture: true })
            el.removeEventListener('mousedown', stop, { capture: true })
            el.removeEventListener('touchstart', stop, { capture: true })
        }
    }, [])

    const isNote = item?.source === 'note' || !src || item?.image_url === 'text_only' || item?.image_url?.startsWith('text_only')

    if (isNote) {
        return (
            <div
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                className="select-none flex flex-col justify-between p-3.5 text-left border border-[var(--color-rule)] shadow-sm hover:scale-[1.02] transition-transform duration-150"
                style={{
                    width: safeImageWidth,
                    height: safeImageHeight,
                    borderRadius: radius || 2,
                    backgroundColor: "var(--color-paper, #FAF9F5)",
                    color: "var(--color-ink, #1a1a1a)",
                    cursor: isDragging ? "grabbing" : "pointer",
                    boxSizing: "border-box"
                }}
            >
                {/* Header */}
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

                {/* Body */}
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

                {/* Footer */}
                <div className="text-[7px] font-mono tracking-wider text-neutral-400 text-center uppercase border-t border-neutral-200/50 pt-2 truncate select-none pointer-events-none">
                    BY {item.user?.name || item.user_name || "GUEST"}
                </div>
            </div>
        )
    }

    return (
        <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className="group relative overflow-hidden transition-transform duration-150 hover:scale-[1.02] hover:z-20"
            style={{
                width: safeImageWidth,
                height: safeImageHeight,
                borderRadius: radius || 2,
                backgroundColor: "#161714",
                boxSizing: "border-box",
                cursor: isDragging ? "grabbing" : "pointer"
            }}
        >
            {/* Image */}
            {proxiedSrc && !imgFailed ? (
                <img
                    src={proxiedSrc}
                    alt={item.text || item.user?.name || "Check-in"}
                    draggable={false}
                    decoding="async"
                    loading="eager"
                    onLoad={() => {
                        LOADED_IMAGE_SET.add(proxiedSrc)
                        setImgLoaded(true)
                    }}
                    onError={() => setImgFailed(true)}
                    className={`absolute inset-0 w-full h-full object-cover pointer-events-none select-none transition-opacity duration-200 ${
                        imgLoaded || isAlreadyLoaded ? "opacity-100" : "opacity-0"
                    }`}
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center select-none font-mono text-neutral-500">
                    <span className="text-xl">📸</span>
                    <span className="text-[9px] uppercase tracking-wider mt-2 opacity-80">{item.user?.name || item.user_name || "Check-in"}</span>
                </div>
            )}

            {/* Hover subtle dark vignette */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10" />

            {/* Caption & Like footer overlay */}
            <div 
                ref={overlayRef}
                className="absolute bottom-0 left-0 right-0 z-20 bg-[#0e0f0b]/90 border-t border-white/10 px-3 py-2 flex items-center justify-between gap-2 pointer-events-auto select-none backdrop-blur-xs"
            >
                <div className="flex-1 min-w-0 pointer-events-none">
                    <p className="font-mono text-[8px] text-neutral-300 leading-tight truncate">
                        {item.text ? item.text : `@${item.user?.name || item.user_name || "Customer"}`}
                    </p>
                    <span className="font-mono text-[7px] text-neutral-500 uppercase tracking-widest block mt-0.5">
                        {item.source || "post"}
                    </span>
                </div>

                {onLikeToggle && (
                    <button
                        onClick={(e) => onLikeToggle(e, item.id)}
                        className="flex items-center gap-1 hover:scale-110 active:scale-95 transition-all text-neutral-400 hover:text-white cursor-pointer bg-transparent border-0 p-1 outline-none select-none"
                    >
                        <Heart
                            size={11}
                            className={likedIds && likedIds.includes(item.id) ? "text-[#E1306C] fill-[#E1306C]" : "text-neutral-400"}
                        />
                        <span className={`font-mono text-[8px] ${likedIds && likedIds.includes(item.id) ? "text-[#E1306C] font-bold" : "text-neutral-400"}`}>
                            {item.likes || 0}
                        </span>
                    </button>
                )}
            </div>
        </div>
    )
})

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
        likedIds,
        onLikeToggle
    } = finalProps

    const containerRef = useRef(null)
    const [containerSize, setContainerSize] = useState({ w: 1000, h: 800 })
    const [isDragging, setIsDragging] = useState(false)
    const isPointerDown = useRef(false)
    const pointerDownPos = useRef(null)
    const lastPointer = useRef({ x: 0, y: 0, time: 0 })
    const velocity = useRef({ x: 0, y: 0 })
    const animFrame = useRef(null)

    const rawX = useMotionValue(0)
    const rawY = useMotionValue(0)
    const initializedRef = useRef(false)

    const safeItems = Array.isArray(items) && items.length > 0 ? items : defaultItems
    const safeColumns = useMemo(() => {
        const count = safeItems.length
        if (count === 0) return 4
        let cols = columns || 14
        if (count <= 3) cols = 3
        else if (count <= 8) cols = 4
        else if (count <= 15) cols = 6
        else if (count <= 30) cols = 10
        return Math.max(1, Math.min(20, Math.floor(cols)))
    }, [safeItems.length, columns])

    const safeImageWidth = Math.max(20, Math.min(4000, imageWidth ?? 256))
    const safeImageHeight = Math.max(20, Math.min(4000, imageHeight ?? 320))
    const safeGap = Math.max(0, Math.min(100, gap ?? 4)) * 4
    const r = Math.max(0, Math.min(20, rounded ?? 1))
    const radius = (r / 20) * (Math.min(safeImageWidth, safeImageHeight) / 2)

    const rows = Math.max(safeColumns, Math.ceil(safeItems.length / safeColumns))
    const totalCells = safeColumns * rows

    const displayItems = useMemo(
        () => fillChronological(safeItems, totalCells, safeColumns),
        [safeItems, totalCells, safeColumns]
    )

    const extendedColumns = safeColumns * 3
    const extendedRows = rows * 3

    const gridW = safeColumns * safeImageWidth + (safeColumns - 1) * safeGap
    const gridH = rows * safeImageHeight + (rows - 1) * safeGap

    const cycleW = gridW + safeGap
    const cycleH = gridH + safeGap

    const expandedGridW = extendedColumns * safeImageWidth + (extendedColumns - 1) * safeGap
    const expandedGridH = extendedRows * safeImageHeight + (extendedRows - 1) * safeGap

    const wrappedX = useTransform(rawX, (val) => wrapOffset(val, cycleW))
    const wrappedY = useTransform(rawY, (val) => wrapOffset(val, cycleH))

    // Measure container size
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

    // Set initial centered position
    useEffect(() => {
        if (initializedRef.current) return
        if (containerSize.w === 0 || containerSize.h === 0 || !cycleW || !cycleH) return

        const initialX = -cycleW + (containerSize.w - safeImageWidth) / 2
        const initialY = -cycleH + (containerSize.h - safeImageHeight) / 2
        rawX.set(initialX)
        rawY.set(initialY)
        initializedRef.current = true
    }, [containerSize.w, containerSize.h, cycleW, cycleH, safeImageWidth, safeImageHeight, rawX, rawY])

    // Momentum Inertia Decay Physics
    const stopInertia = useCallback(() => {
        if (animFrame.current) {
            cancelAnimationFrame(animFrame.current)
            animFrame.current = null
        }
    }, [])

    const startInertia = useCallback(() => {
        stopInertia()
        let vx = velocity.current.x * 14
        let vy = velocity.current.y * 14
        const friction = 0.94

        if (Math.hypot(vx, vy) < 0.5) return

        const step = () => {
            if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) {
                animFrame.current = null
                return
            }
            rawX.set(rawX.get() + vx)
            rawY.set(rawY.get() + vy)
            vx *= friction
            vy *= friction
            animFrame.current = requestAnimationFrame(step)
        }
        animFrame.current = requestAnimationFrame(step)
    }, [rawX, rawY, stopInertia])

    const handlePointerDownContainer = useCallback((e) => {
        if (e.button !== undefined && e.button !== 0) return
        stopInertia()
        isPointerDown.current = true
        pointerDownPos.current = { x: e.clientX, y: e.clientY, t: Date.now() }
        lastPointer.current = { x: e.clientX, y: e.clientY, time: performance.now() }
        velocity.current = { x: 0, y: 0 }
    }, [stopInertia])

    const handlePointerMoveContainer = useCallback((e) => {
        if (!isPointerDown.current) return
        const dx = e.clientX - lastPointer.current.x
        const dy = e.clientY - lastPointer.current.y

        if (pointerDownPos.current) {
            const totalDist = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y)
            if (totalDist > 6 && !isDragging) {
                setIsDragging(true)
            }
        }

        const now = performance.now()
        const dt = Math.max(1, now - lastPointer.current.time)
        velocity.current = {
            x: dx / dt,
            y: dy / dt
        }

        lastPointer.current = { x: e.clientX, y: e.clientY, time: now }

        rawX.set(rawX.get() + dx)
        rawY.set(rawY.get() + dy)
    }, [isDragging, rawX, rawY])

    const handlePointerUpContainer = useCallback(() => {
        if (!isPointerDown.current) return
        isPointerDown.current = false
        if (isDragging) {
            startInertia()
            setTimeout(() => setIsDragging(false), 50)
        }
    }, [isDragging, startInertia])

    useEffect(() => {
        const handleGlobalUp = () => {
            if (isPointerDown.current) {
                handlePointerUpContainer()
            }
        }
        window.addEventListener('pointerup', handleGlobalUp)
        window.addEventListener('pointercancel', handleGlobalUp)
        return () => {
            window.removeEventListener('pointerup', handleGlobalUp)
            window.removeEventListener('pointercancel', handleGlobalUp)
        }
    }, [handlePointerUpContainer])

    useEffect(() => {
        if (!enableWheel) return
        const el = containerRef.current
        if (!el) return

        const onWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault()
                return
            }
            e.preventDefault()
            stopInertia()
            const dx = -e.deltaX
            const dy = -e.deltaY
            rawX.set(rawX.get() + dx)
            rawY.set(rawY.get() + dy)
        }

        el.addEventListener("wheel", onWheel, { passive: false })
        return () => el.removeEventListener("wheel", onWheel)
    }, [enableWheel, rawX, rawY, stopInertia])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const preventTouch = (e) => {
            if (e.touches && e.touches.length > 1) {
                e.preventDefault()
            }
        }
        el.addEventListener('touchmove', preventTouch, { passive: false })
        return () => el.removeEventListener('touchmove', preventTouch)
    }, [])

    const handleCardPointerDown = useCallback((e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    }, [])

    const handleCardPointerUp = useCallback((e, item) => {
        if (!pointerDownPos.current) return
        const dx = e.clientX - pointerDownPos.current.x
        const dy = e.clientY - pointerDownPos.current.y
        const moved = Math.hypot(dx, dy)
        if (moved < 6 && !isDragging) {
            onItemClick?.(item)
        }
        pointerDownPos.current = null
    }, [isDragging, onItemClick])

    const displayItemsExtended = useMemo(() => {
        const out = []
        const baseLen = displayItems.length
        if (baseLen === 0) return []

        for (let r_ext = 0; r_ext < extendedRows; r_ext++) {
            for (let c_ext = 0; c_ext < extendedColumns; c_ext++) {
                const r_base = r_ext % rows
                const c_base = c_ext % safeColumns
                const baseIdx = r_base * safeColumns + c_base
                out.push({
                    item: displayItems[baseIdx % baseLen],
                    r_ext,
                    c_ext
                })
            }
        }
        return out
    }, [displayItems, safeColumns, rows, extendedColumns, extendedRows])

    const wrapperStyle = {
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        cursor: isDragging ? "grabbing" : "grab",
        ...style
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
        willChange: "transform"
    }

    return (
        <div
            ref={containerRef}
            className="draggable-container-viewport"
            style={wrapperStyle}
            onPointerDown={handlePointerDownContainer}
            onPointerMove={handlePointerMoveContainer}
            onPointerUp={handlePointerUpContainer}
        >
            <motion.div style={{ ...gridStyle, x: wrappedX, y: wrappedY }}>
                {displayItemsExtended.map(({ item, r_ext, c_ext }, index) => {
                    const stableKey = `card_${item.id || item.image_url || index}_r${r_ext}_c${c_ext}`
                    return (
                        <GridCard
                            key={stableKey}
                            item={item}
                            safeImageWidth={safeImageWidth}
                            safeImageHeight={safeImageHeight}
                            radius={radius}
                            isDragging={isDragging}
                            handlePointerDown={handleCardPointerDown}
                            handlePointerUp={(e) => handleCardPointerUp(e, item)}
                            likedIds={likedIds}
                            onLikeToggle={onLikeToggle}
                        />
                    )
                })}
            </motion.div>
        </div>
    )
}
