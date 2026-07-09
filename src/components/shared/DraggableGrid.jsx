"use client"

import { motion, useMotionValue, animate } from "framer-motion"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"

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

// Deterministic PRNG (mulberry32) so the shuffle is stable across renders
// once seeded — no flicker on every re-render.
function mulberry32(seed) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// Fill a target length by repeating items, shuffled so neighbors don't
// duplicate the same source item in a 3x3 grid neighborhood where possible.
function fillAndShuffle(items, target, columns, seed) {
    if (items.length === 0) return []
    const rand = mulberry32(seed)
    const cols = columns || 14
    const out = []
    
    const getAt = (r, c) => {
        if (r < 0 || c < 0 || c >= cols) return null
        const idx = r * cols + c
        return idx < out.length ? out[idx] : null
    }

    // Check if an item exists in the immediate 2D neighborhood (up, left, and diagonals)
    const hasDuplicateInNeighborhood = (item, r, c) => {
        // Check horizontally left (c-1, c-2)
        if (getAt(r, c - 1) === item || getAt(r, c - 2) === item) return true
        
        // Check vertically up (r-1, r-2)
        if (getAt(r - 1, c) === item || getAt(r - 2, c) === item) return true
        
        // Check diagonals up-left/up-right (r-1, c-1), (r-1, c+1)
        if (getAt(r - 1, c - 1) === item || getAt(r - 1, c + 1) === item) return true
        if (getAt(r - 2, c - 1) === item || getAt(r - 2, c + 1) === item) return true
        
        return false
    }

    const refill = () => {
        const pool = items.slice()
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1))
            ;[pool[i], pool[j]] = [pool[j], pool[i]]
        }
        return pool
    }

    let pool = refill()

    for (let idx = 0; idx < target; idx++) {
        const r = Math.floor(idx / cols)
        const c = idx % cols

        let foundIdx = -1
        // Look through the pool for a non-conflicting item
        for (let p = pool.length - 1; p >= 0; p--) {
            if (!hasDuplicateInNeighborhood(pool[p], r, c)) {
                foundIdx = p
                break
            }
        }

        // If not found in the current pool, try refilling and searching in a fresh pool
        if (foundIdx === -1) {
            const extraPool = refill()
            for (let p = extraPool.length - 1; p >= 0; p--) {
                if (!hasDuplicateInNeighborhood(extraPool[p], r, c)) {
                    pool.push(...extraPool.slice(0, p), ...extraPool.slice(p + 1))
                    out.push(extraPool[p])
                    foundIdx = -2 // Mark as found in extraPool
                    break
                }
            }
        }

        if (foundIdx >= 0) {
            const next = pool[foundIdx]
            pool.splice(foundIdx, 1)
            out.push(next)
        } else if (foundIdx === -1) {
            // Hard fallback to avoid infinite loops: grab the last pool item
            if (pool.length === 0) pool = refill()
            out.push(pool.pop())
        }

        if (pool.length === 0) {
            pool = refill()
        }
    }

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
}) {
    const cardRef = useRef(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const el = cardRef.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                    observer.disconnect()
                }
            },
            {
                root: el.closest('.draggable-container-viewport') || null,
                rootMargin: '250px', // Fetch 250px before entering viewport for smooth experience
            }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const src = item?.image?.src
    const alt = item?.alt ?? item?.image?.alt ?? ""

    return (
        <div
            ref={cardRef}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            style={{
                position: "relative",
                width: safeImageWidth,
                height: safeImageHeight,
                overflow: "hidden",
                borderRadius: radius,
                backgroundColor: getItemColor(index),
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
                transform: `rotate(${-rotation}deg)`,
                transformOrigin: "center center",
            }}
        >
            {/* Hidden index helper, overlays check-in type if loaded */}
            <div className="absolute inset-0 bg-black/10 flex flex-col justify-between p-3 z-10 text-white select-none pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-mono opacity-80 uppercase tracking-widest">{item.source || 'tag'}</span>
            </div>
            
            {isVisible && src && !failed ? (
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
                    }}
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center select-none font-mono">
                    <span className="text-xl">📸</span>
                    <span className="text-[9px] uppercase tracking-wider mt-2 opacity-80">{item.user?.name || "Check-in"}</span>
                </div>
            )}
        </div>
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
    } = finalProps

    const containerRef = useRef(null)
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const [containerSize, setContainerSize] = useState({ w: 800, h: 600 })
    const [isDragging, setIsDragging] = useState(false)
    const [zoomScale, setZoomScale] = useState(1.0)
    const touchStartDist = useRef(0)
    const touchStartScale = useRef(1.0)
    const initializedRef = useRef(false)

    const pointerDownPos = useRef(null)
    const wheelAnimX = useRef(null)
    const wheelAnimY = useRef(null)
    const failedImages = useRef(new Set())
    const [, forceRender] = useState(0)

    // Screensaver drift speed (px per frame) - matching magnitudes make the diagonal angle exactly 45 degrees
    const driftX = useRef(0.15) 
    const driftY = useRef(-0.15)
    const isInteracting = useRef(false)
    const interactionTimeout = useRef(null)

    const triggerInteraction = useCallback(() => {
        isInteracting.current = true
        if (interactionTimeout.current) clearTimeout(interactionTimeout.current)
        interactionTimeout.current = setTimeout(() => {
            isInteracting.current = false
        }, 2000) // Resume drift after 2 seconds of inactivity
    }, [])

    const safeItems =
        Array.isArray(items) && items.length > 0 ? items : defaultItems
    const safeColumns = Math.max(1, Math.min(20, Math.floor(columns || 5)))
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
        () => fillAndShuffle(safeItems, totalCells, safeColumns, 0xc0ffee),
        [safeItems, totalCells, safeColumns]
    )

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
    // Calculate the minimum scale dynamically to ensure the grid always fills the container
    const minScale = useMemo(() => {
        const scaleX = containerSize.w / (gridW + safeGap * 2)
        const scaleY = containerSize.h / (gridH + safeGap * 2)
        // Ensure we don't divide by zero and provide a 5% safety margin
        return Math.max(0.1, Math.max(scaleX, scaleY)) * 1.05
    }, [containerSize.w, containerSize.h, gridW, gridH, safeGap])

    // Keep zoomScale constrained to minScale
    useEffect(() => {
        if (zoomScale < minScale) {
            setZoomScale(minScale)
        }
    }, [minScale, zoomScale])

    // Scale boundaries: adjust maxX/minX/maxY/minY for zoomScale.
    // Origin is at "0 0" (top left), so scale moves the right and bottom boundaries accordingly.
    const maxX = safeGap * zoomScale
    const minX = Math.min(maxX, containerSize.w - gridW * zoomScale - safeGap * zoomScale)
    const maxY = safeGap * zoomScale
    const minY = Math.min(maxY, containerSize.h - gridH * zoomScale - safeGap * zoomScale)

    const dragConstraints = {
        left: minX,
        right: maxX,
        top: minY,
        bottom: maxY,
    }

    // Center the grid initially and start the auto-drift screensaver loop
    useEffect(() => {
        if (initializedRef.current) return
        if (containerSize.w === 0 || containerSize.h === 0) return

        const initialX = minX + (maxX - minX) / 2
        const initialY = minY + (maxY - minY) / 2
        x.set(initialX)
        y.set(initialY)
        initializedRef.current = true
    }, [containerSize.w, containerSize.h, minX, maxX, minY, maxY, x, y])

    // Auto-drift screensaver effect loop
    useEffect(() => {
        let animationFrameId
        
        const updateDrift = () => {
            if (!isDragging && !isInteracting.current) {
                const curX = x.get()
                const curY = y.get()
                
                let nextX = curX + driftX.current
                let nextY = curY + driftY.current

                // Bounce off boundaries in X direction
                if (minX < maxX) {
                    if (nextX >= maxX) {
                        nextX = maxX
                        driftX.current = -Math.abs(driftX.current)
                    } else if (nextX <= minX) {
                        nextX = minX
                        driftX.current = Math.abs(driftX.current)
                    }
                    x.set(nextX)
                }

                // Bounce off boundaries in Y direction
                if (minY < maxY) {
                    if (nextY >= maxY) {
                        nextY = maxY
                        driftY.current = -Math.abs(driftY.current)
                    } else if (nextY <= minY) {
                        nextY = minY
                        driftY.current = Math.abs(driftY.current)
                    }
                    y.set(nextY)
                }
            }
            animationFrameId = requestAnimationFrame(updateDrift)
        }

        animationFrameId = requestAnimationFrame(updateDrift)
        return () => {
            cancelAnimationFrame(animationFrameId)
            if (interactionTimeout.current) clearTimeout(interactionTimeout.current)
        }
    }, [isDragging, minX, maxX, minY, maxY, x, y])

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

    // Pinch-to-zoom and Trackpad zoom gestures (clamped 0.4x to 2.5x)
    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const handleTouchStart = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault()
                triggerInteraction()
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                )
                touchStartDist.current = dist
                touchStartScale.current = zoomScale
            }
        }

        const handleTouchMove = (e) => {
            if (e.touches.length === 2 && touchStartDist.current > 0) {
                e.preventDefault()
                triggerInteraction()
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                )
                const factor = dist / touchStartDist.current
                let nextScale = touchStartScale.current * factor
                nextScale = Math.max(minScale, Math.min(2.5, nextScale))
                setZoomScale(nextScale)
            }
        }

        const handleTouchEnd = (e) => {
            if (e.touches.length < 2) {
                touchStartDist.current = 0
            }
        }

        const handleWheelZoom = (e) => {
            if (e.ctrlKey) {
                e.preventDefault()
                triggerInteraction()
                let nextScale = zoomScale - e.deltaY * 0.01
                nextScale = Math.max(minScale, Math.min(2.5, nextScale))
                setZoomScale(nextScale)
            }
        }

        el.addEventListener('touchstart', handleTouchStart, { passive: false })
        el.addEventListener('touchmove', handleTouchMove, { passive: false })
        el.addEventListener('touchend', handleTouchEnd)
        el.addEventListener('wheel', handleWheelZoom, { passive: false })

        return () => {
            el.removeEventListener('touchstart', handleTouchStart)
            el.removeEventListener('touchmove', handleTouchMove)
            el.removeEventListener('touchend', handleTouchEnd)
            el.removeEventListener('wheel', handleWheelZoom)
        }
    }, [zoomScale, minScale, triggerInteraction])

    // Wheel scrolling
    useEffect(() => {
        if (!enableWheel) return
        const el = containerRef.current
        if (!el) return

        const clamp = (v, mn, mx) =>
            Math.min(Math.max(v, mn), mx)

        const onWheel = (e) => {
            if (e.ctrlKey) return // Skip if trackpad pinch-to-zoom is active
            e.preventDefault()
            triggerInteraction()
            const curX = x.get()
            const curY = y.get()
            const targetX = clamp(curX - e.deltaX, minX, maxX)
            const targetY = clamp(curY - e.deltaY, minY, maxY)
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
    }, [enableWheel, minX, maxX, minY, maxY, x, y, triggerInteraction])

    const handlePointerDown = useCallback((e) => {
        triggerInteraction()
        pointerDownPos.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    }, [triggerInteraction])

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
        width: gridW,
        height: gridH,
        boxSizing: "border-box",
        display: "grid",
        gridTemplateColumns: `repeat(${safeColumns}, ${safeImageWidth}px)`,
        gridAutoRows: `${safeImageHeight}px`,
        gap: `${safeGap}px`,
        willChange: "transform",
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "0 0",
    }

    return (
        <div ref={containerRef} className="draggable-container-viewport" style={wrapperStyle}>
            <motion.div
                style={{ ...gridStyle, x, y, scale: zoomScale }}
                drag
                dragConstraints={dragConstraints}
                dragElastic={0}
                dragMomentum={true}
                onDragStart={() => {
                    setIsDragging(true)
                    triggerInteraction()
                }}
                onDragEnd={() => setIsDragging(false)}
                onDrag={() => triggerInteraction()}
            >
                {displayItems.map((item, index) => {
                    const failed = failedImages.current.has(index)
                    return (
                        <LazyCard
                            key={index}
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
                        />
                    )
                })}
            </motion.div>
        </div>
    )
}
