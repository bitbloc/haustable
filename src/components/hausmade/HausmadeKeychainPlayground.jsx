/* Hallmark · component: HausmadeKeychainPlayground · theme: Atelier (Dieter Rams + Thai Modern OKLCH)
 * features: Photorealistic 3D Isometric View, 2D Blueprint Mat, Smart Style Presets,
 *           Procedural Braided Paracord Colorways, Interactive Click-to-Nudge,
 *           Thickness Gauge, Reverse Engraving, 60 FPS Offscreen Grid Caching,
 *           Aesthetic PNG Spec Card, and Admin-Only STL/STEP CAD Exporters.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { exportToSTL, exportToSTEP, exportAestheticPNG } from '../../utils/keychain3dExporter'
import { supabase } from '../../lib/supabaseClient'
import HausmadeKeychain3DViewer from './HausmadeKeychain3DViewer'

// Default 3D Keychain Pricing & Physical Boundaries (Syncs with Admin Settings)
export const DEFAULT_KEYCHAIN_PRICING = {
    basePrice: 180,
    baseCharLimit: 4,
    extraCharPrice: 15,
    maxChars: 10,
    maxElements: 2,
    elementPrice: 20,
    dualTonePrice: 30,
    reverseEngravePrice: 35,
    heavyDutyPrice: 20
}

// Brand Charms Catalog (Default: Flower ✿ Signature)
export const DEFAULT_BRAND_CHARMS = [
    { id: 'flower', name: 'HAUS Flower (ดอกไม้เอกลักษณ์)', symbol: '✿', is_default: true, price: 20, stl_url: null }
]

// Curated Calligraphy & Script Fonts with Google Font families
export const CURATED_FONTS = [
    { id: 'great-vibes', name: 'Great Vibes', family: "'Great Vibes', cursive", google: 'Great+Vibes', desc: 'คลาสสิก ลายเส้นตวัดพลิ้ว' },
    { id: 'alex-brush', name: 'Alex Brush', family: "'Alex Brush', cursive", google: 'Alex+Brush', desc: 'ลายมืออ่อนช้อย หรูหรา' },
    { id: 'pacifico', name: 'Pacifico', family: "'Pacifico', cursive", google: 'Pacifico', desc: 'เส้นหนา แข็งแรง พิมพ์ง่าย' },
    { id: 'dancing-script', name: 'Dancing Script', family: "'Dancing Script', cursive", google: 'Dancing+Script:wght@700', desc: 'ลายมือสดใส โมเดิร์น' },
    { id: 'charm', name: 'Charm (TH/EN)', family: "'Charm', cursive", google: 'Charm:wght@700', desc: 'ลายมือไทย/อังกฤษ มีหัวเรียบหรู' },
    { id: 'sarabun', name: 'Sarabun (TH/EN)', family: "'Sarabun', sans-serif", google: 'Sarabun:wght@700', desc: 'โมเดิร์นทางการ อ่านง่าย คมชัด' },
    { id: 'space-mono', name: 'Space Mono', family: "'Space Mono', monospace", google: 'Space+Mono:wght@700', desc: 'ตัวพิมพ์โมเดิร์น Brutalist' }
]

// Thai Modern OKLCH Inspired Filament Presets
export const FILAMENT_COLORS = [
    { id: 'terracotta', name: 'Terracotta Clay (แดงดินเผา)', hex: '#C84B31', textHex: '#FAF7F3', desc: 'Signature HAUS Shade' },
    { id: 'charcoal', name: 'Matte Charcoal (ดำหมึกคาร์บอน)', hex: '#1C1A19', textHex: '#FAF7F3', desc: 'High Contrast Minimalist' },
    { id: 'cream', name: 'Warm Sand (นวลทรายครีม)', hex: '#F4ECE1', textHex: '#1C1A19', desc: 'Clean Natural Atelier' },
    { id: 'olive', name: 'Banana-Leaf (เขียวตองแห้ง)', hex: '#5E6B4F', textHex: '#FAF7F3', desc: 'Organic Herb Tone' },
    { id: 'mustard', name: 'Mustard Ochre (เหลืองมัสตาร์ด)', hex: '#CBA135', textHex: '#1C1A19', desc: 'Warm Radiant Accent' }
]

// Paracord 550 Colorways
export const PARACORD_COLORS = [
    { id: 'sand', name: 'Desert Sand (ทรายทะเลทราย)', hex: '#D2B48C', weaveHex: '#B5946E' },
    { id: 'olive', name: 'Olive Forest (เขียวป่าทหาร)', hex: '#556B2F', weaveHex: '#3E4F22' },
    { id: 'terracotta', name: 'Terracotta (ส้มดินเผา)', hex: '#C84B31', weaveHex: '#9B331D' },
    { id: 'carbon', name: 'Stealth Carbon (ดำคาร์บอน)', hex: '#222222', weaveHex: '#3E3E3E' },
    { id: 'neon', name: 'Neon Volt (เหลืองสะท้อน)', hex: '#DFFF00', weaveHex: '#B8D400' }
]

// Smart Style Presets (1-Click Inspiration)
export const STYLE_PRESETS = [
    {
        id: 'signature',
        name: '01 · SIGNATURE ATELIER',
        desc: 'สีดินเผา + เชือกทรายครีม สไตล์ต้นตำรับ',
        text: 'haus',
        fontId: 'great-vibes',
        baseColorId: 'terracotta',
        letterColorId: 'cream',
        isDualTone: false,
        holeDiameter: 4.0,
        baseStyle: 'rail',
        thickness: 4.0,
        cordColorId: 'sand'
    },
    {
        id: 'tactical',
        name: '02 · TACTICAL OUTDOOR',
        desc: 'ดำด้านคาร์บอน + เชือกเขียวโอลีฟ แข็งแกร่ง 5mm',
        text: 'HAUS',
        fontId: 'space-mono',
        baseColorId: 'charcoal',
        letterColorId: 'cream',
        isDualTone: false,
        holeDiameter: 5.0,
        baseStyle: 'capsule',
        thickness: 5.0,
        cordColorId: 'olive'
    },
    {
        id: 'minimalist',
        name: '03 · CAFE MINIMALIST',
        desc: 'ครีมนวลทราย + ตัวหนังสือดินเผา Dual-tone',
        text: 'joy',
        fontId: 'charm',
        baseColorId: 'cream',
        letterColorId: 'terracotta',
        isDualTone: true,
        holeDiameter: 4.0,
        baseStyle: 'capsule',
        thickness: 3.2,
        cordColorId: 'terracotta'
    },
    {
        id: 'brutalist',
        name: '04 · BRUTALIST NEON',
        desc: 'ดำคาร์บอน + เหลืองนีออน คอนทราสต์จัดจ้าน',
        text: 'cafe',
        fontId: 'pacifico',
        baseColorId: 'charcoal',
        letterColorId: 'mustard',
        isDualTone: true,
        holeDiameter: 5.0,
        baseStyle: 'rail',
        thickness: 4.0,
        cordColorId: 'neon'
    }
]

export default function HausmadeKeychainPlayground({
    onAddToCart,
    isAdmin = false,
    initialText = 'haus',
    onClose = null
}) {
    // 0. Dynamic Pricing & Brand Charms State
    const [pricing, setPricing] = useState(DEFAULT_KEYCHAIN_PRICING)
    const [availableCharms, setAvailableCharms] = useState(DEFAULT_BRAND_CHARMS)
    const [selectedCharms, setSelectedCharms] = useState([])

    // 1. Text & Font State
    const [text, setText] = useState(initialText)
    const [selectedFont, setSelectedFont] = useState(CURATED_FONTS[0])
    const [customFontFamily, setCustomFontFamily] = useState(null)
    const [customFontName, setCustomFontName] = useState(null)
    const [fontSize, setFontSize] = useState(46) // pt scale
    const [globalKerning, setGlobalKerning] = useState(2) // px
    const [charOffsets, setCharOffsets] = useState({}) // { [index]: xOffsetInPx }
    const [selectedCharIndex, setSelectedCharIndex] = useState(null)
    const [reverseText, setReverseText] = useState('')

    // 2. View Mode & Presentation State
    const [viewMode, setViewMode] = useState('3d') // '2d' (Blueprint) | '3d' (Isometric Perspective)
    const [showGrid, setShowGrid] = useState(true)
    const [gridStep, setGridStep] = useState(5) // 1mm, 5mm, 10mm
    const [showLayerTexture, setShowLayerTexture] = useState(true)
    const [zoom, setZoom] = useState(1.0)

    // 3. Eyelet, Cord & Structural State
    const [holeDiameter, setHoleDiameter] = useState(4.0) // 4.0 or 5.0 mm
    const [eyeletPosition, setEyeletPosition] = useState('left') // 'left' | 'top' | 'right'
    const [baseStyle, setBaseStyle] = useState('rail') // 'rail' | 'capsule' | 'connected'
    const [showCordPreview, setShowCordPreview] = useState(true)
    const [cordColor, setCordColor] = useState(PARACORD_COLORS[0])
    const [thickness, setThickness] = useState(4.0) // 3.2mm, 4.0mm, 5.0mm

    // 4. Color & Filament State
    const [baseColor, setBaseColor] = useState(FILAMENT_COLORS[0])
    const [letterColor, setLetterColor] = useState(FILAMENT_COLORS[2])
    const [isDualTone, setIsDualTone] = useState(false)

    // 5. UI Navigation Tabs: 'presets' | 'text' | 'charms' | 'structure' | 'kerning' | 'filament'
    const [activeTab, setActiveTab] = useState('presets')
    const [isExporting, setIsExporting] = useState(false)

    // Canvas References & 3D Mesh Cache
    const canvasRef = useRef(null)
    const threeMeshRef = useRef(null)
    const [customFontBuffer, setCustomFontBuffer] = useState(null)
    const [hardwareType, setHardwareType] = useState('ring') // 'ring' (metal split ring) | 'cord' (paracord) | 'none'
    const [hardwareFinish, setHardwareFinish] = useState('brass') // 'brass' | 'chrome' | 'carbon'
    const offscreenGridRef = useRef(null)
    const rafIdRef = useRef(null)
    const charBoxesRef = useRef([])

    // Load Pricing & Charms from Database (app_settings)
    useEffect(() => {
        let isMounted = true
        async function loadConfig() {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['hausmade_3d_keychain_config', 'hausmade_3d_keychain_charms'])

                if (isMounted && data) {
                    const configRow = data.find(d => d.key === 'hausmade_3d_keychain_config')
                    if (configRow?.value) {
                        try {
                            const parsed = JSON.parse(configRow.value)
                            setPricing(prev => ({ ...prev, ...parsed }))
                        } catch {}
                    }

                    const charmsRow = data.find(d => d.key === 'hausmade_3d_keychain_charms')
                    if (charmsRow?.value) {
                        try {
                            const parsed = JSON.parse(charmsRow.value)
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                setAvailableCharms(parsed)
                            }
                        } catch {}
                    }
                }
            } catch (err) {
                console.warn('[HausmadeKeychainPlayground] Settings fetch error:', err)
            }
        }
        loadConfig()
        return () => { isMounted = false }
    }, [])

    // Charm Selection Handler (Enforces Safe Manufacturing Boundary: maxElements)
    const toggleCharm = (charm) => {
        const isSelected = selectedCharms.some(c => c.id === charm.id)
        if (isSelected) {
            setSelectedCharms(prev => prev.filter(c => c.id !== charm.id))
        } else {
            const maxAllowed = pricing.maxElements ?? 2
            if (selectedCharms.length >= maxAllowed) {
                toast.warning(`สามารถเลือกชาร์มได้สูงสุด ${maxAllowed} ชิ้น เพื่อความแข็งแรงของข้อต่อ 3D Print`)
                return
            }
            setSelectedCharms(prev => [...prev, charm])
            toast.success(`เพิ่มชาร์ม "${charm.name}" (+฿${charm.price || pricing.elementPrice || 20})`)
        }
    }

    // Dynamic Live Pricing Engine (Transparent Itemized Breakdown)
    const priceCalculation = useMemo(() => {
        const base = pricing.basePrice ?? 180
        const limit = pricing.baseCharLimit ?? 4
        const charCount = text.trim().length
        const extraCharCount = Math.max(0, charCount - limit)
        const extraCharTotal = extraCharCount * (pricing.extraCharPrice ?? 15)

        const charmsTotal = selectedCharms.reduce((acc, c) => acc + (c.price || pricing.elementPrice || 20), 0)
        const dualToneTotal = isDualTone ? (pricing.dualTonePrice ?? 30) : 0
        const reverseEngraveTotal = (reverseText && reverseText.trim().length > 0) ? (pricing.reverseEngravePrice ?? 35) : 0
        const heavyDutyTotal = (thickness >= 5.0) ? (pricing.heavyDutyPrice ?? 20) : 0

        const total = base + extraCharTotal + charmsTotal + dualToneTotal + reverseEngraveTotal + heavyDutyTotal

        return {
            base,
            limit,
            charCount,
            extraCharCount,
            extraCharTotal,
            charmsTotal,
            dualToneTotal,
            reverseEngraveTotal,
            heavyDutyTotal,
            total
        }
    }, [text, pricing, selectedCharms, isDualTone, reverseText, thickness])

    // Dynamic Google Font Injection
    useEffect(() => {
        if (selectedFont?.google) {
            const fontUrl = `https://fonts.googleapis.com/css2?family=${selectedFont.google}&display=swap`
            const linkId = `gfont-${selectedFont.id}`
            if (!document.getElementById(linkId)) {
                const link = document.createElement('link')
                link.id = linkId
                link.rel = 'stylesheet'
                link.href = fontUrl
                document.head.appendChild(link)
            }
        }
    }, [selectedFont])

    // Load custom font file
    const handleFontUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        const ext = file.name.split('.').pop()?.toLowerCase()
        if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
            toast.error('กรุณาอัปโหลดไฟล์ฟอนต์นามสกุล .ttf, .otf, หรือ .woff')
            return
        }

        try {
            const arrayBuffer = await file.arrayBuffer()
            const cleanFontName = 'Custom_' + file.name.replace(/[^a-zA-Z0-9]/g, '_')
            const fontFace = new FontFace(cleanFontName, arrayBuffer)
            await fontFace.load()
            document.fonts.add(fontFace)

            setCustomFontFamily(`"${cleanFontName}", sans-serif`)
            setCustomFontName(file.name)
            setCustomFontBuffer(arrayBuffer)
            setSelectedFont(null)
            toast.success(`โหลดฟอนต์ "${file.name}" สำเร็จพร้อมใช้งาน!`)
        } catch (err) {
            console.error('Failed to load custom font:', err)
            toast.error('ไม่สามารถโหลดฟอนต์ได้: ' + err.message)
        }
    }

    // Apply Smart Style Preset
    const applyPreset = (preset) => {
        setText(preset.text)
        const font = CURATED_FONTS.find(f => f.id === preset.fontId) || CURATED_FONTS[0]
        setSelectedFont(font)
        setCustomFontFamily(null)
        setCustomFontName(null)
        setCustomFontBuffer(null)
        const bCol = FILAMENT_COLORS.find(c => c.id === preset.baseColorId) || FILAMENT_COLORS[0]
        const lCol = FILAMENT_COLORS.find(c => c.id === preset.letterColorId) || FILAMENT_COLORS[2]
        setBaseColor(bCol)
        setLetterColor(lCol)
        setIsDualTone(preset.isDualTone)
        setHoleDiameter(preset.holeDiameter)
        setBaseStyle(preset.baseStyle)
        setThickness(preset.thickness)
        const cord = PARACORD_COLORS.find(c => c.id === preset.cordColorId) || PARACORD_COLORS[0]
        setCordColor(cord)
        setCharOffsets({})
        toast.info(`เปิดใช้สไตล์ "${preset.name}"`)
    }

    // Reset character offsets when text changes
    useEffect(() => {
        setCharOffsets(prev => {
            const next = {}
            for (let i = 0; i < text.length; i++) {
                if (prev[i] !== undefined) next[i] = prev[i]
            }
            return next
        })
    }, [text])

    // Active font family string
    const activeFontFamily = customFontFamily || selectedFont?.family || 'sans-serif'

    // Compute Physical Metrics in Millimeters
    const metrics = useMemo(() => {
        const charLen = Math.max(1, text.length)
        const charmsCount = selectedCharms.length
        const approxLetterWidth = (charLen * (fontSize * 0.42)) + (charLen * (globalKerning * 0.5)) + (charmsCount * 22)
        const lengthMm = Math.round(Math.max(48, Math.min(145, approxLetterWidth + 24)))
        const heightMm = Math.round(Math.max(20, Math.min(36, fontSize * 0.48 + (baseStyle === 'rail' ? 6 : 4))))

        // Weight estimation: approx 1.24 g/cm^3 PLA density, 25% infill
        const volumeCm3 = (lengthMm * heightMm * thickness * 0.45) / 1000
        const weightEst = (volumeCm3 * 1.24).toFixed(1)
        const printTimeEst = Math.round(16 + lengthMm * 0.20 + (charmsCount * 5) + (thickness > 4 ? 6 : 0))

        return {
            lengthMm,
            heightMm,
            thicknessMm: thickness,
            weightEst,
            printTimeEst
        }
    }, [text, fontSize, globalKerning, baseStyle, thickness, selectedCharms])

    // Performance Optimization: Cache Offscreen Millimeter Grid
    const updateOffscreenGrid = useCallback((width, height, dpr) => {
        let offscreen = offscreenGridRef.current
        if (!offscreen || offscreen.width !== width * dpr || offscreen.height !== height * dpr) {
            offscreen = document.createElement('canvas')
            offscreen.width = width * dpr
            offscreen.height = height * dpr
            offscreenGridRef.current = offscreen
        }

        const ctx = offscreen.getContext('2d')
        ctx.save()
        ctx.scale(dpr, dpr)

        // Background Warm Mat
        ctx.fillStyle = '#F8F5F0'
        ctx.fillRect(0, 0, width, height)

        if (showGrid) {
            const centerX = width / 2
            const centerY = height / 2
            const mmScale = 3.6 * zoom
            const stepPx = gridStep * mmScale

            // Sub-grid
            ctx.strokeStyle = 'rgba(210, 200, 190, 0.45)'
            ctx.lineWidth = 0.5
            for (let x = centerX % stepPx; x < width; x += stepPx) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
            }
            for (let y = centerY % stepPx; y < height; y += stepPx) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
            }

            // Major grid & numbers
            const majorStepPx = 10 * mmScale
            ctx.strokeStyle = 'rgba(180, 168, 155, 0.7)'
            ctx.lineWidth = 1.0
            ctx.fillStyle = '#8C8276'
            ctx.font = '9px "Space Mono", monospace'

            for (let x = centerX % majorStepPx; x < width; x += majorStepPx) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
                const distMm = Math.round((x - centerX) / mmScale)
                if (Math.abs(distMm) % 20 === 0) {
                    ctx.fillText(`${distMm}`, x + 2, 12)
                }
            }
            for (let y = centerY % majorStepPx; y < height; y += majorStepPx) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
                const distMm = Math.round((y - centerY) / mmScale)
                if (Math.abs(distMm) % 20 === 0 && distMm !== 0) {
                    ctx.fillText(`${-distMm}`, 4, y - 2)
                }
            }

            // Origin Crosshair
            ctx.strokeStyle = '#C84B31'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(centerX - 10, centerY); ctx.lineTo(centerX + 10, centerY)
            ctx.moveTo(centerX, centerY - 10); ctx.lineTo(centerX, centerY + 10)
            ctx.stroke()
        }

        ctx.restore()
    }, [showGrid, gridStep, zoom])

    // Draw Procedural Braided Paracord 550 Rope
    const drawBraidedParacord = (ctx, startX, startY, eyeletX, eyeletY, endX, endY, radius, zoomScale) => {
        ctx.save()
        const primaryColor = cordColor.hex
        const weaveColor = cordColor.weaveHex

        // Outer braid curve
        ctx.lineWidth = radius * 2
        ctx.strokeStyle = primaryColor
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.shadowColor = 'rgba(0,0,0,0.22)'
        ctx.shadowBlur = 8 * zoomScale
        ctx.shadowOffsetY = 4 * zoomScale

        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.quadraticCurveTo(eyeletX, eyeletY - 14 * zoomScale, eyeletX, eyeletY)
        ctx.quadraticCurveTo(eyeletX, eyeletY + 14 * zoomScale, endX, endY)
        ctx.stroke()
        ctx.shadowColor = 'transparent'

        // Braided herringbone cross-weave pattern
        ctx.strokeStyle = weaveColor
        ctx.lineWidth = 1.5 * zoomScale
        const segments = 12
        for (let i = 1; i < segments; i++) {
            const t = i / segments
            // Sample quadratic bezier point
            const px1 = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * eyeletX + t * t * eyeletX
            const py1 = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * (eyeletY - 14 * zoomScale) + t * t * eyeletY
            ctx.beginPath()
            ctx.moveTo(px1 - 4 * zoomScale, py1 - 4 * zoomScale)
            ctx.lineTo(px1 + 4 * zoomScale, py1 + 4 * zoomScale)
            ctx.stroke()
        }

        // Loop Barrel Crimp / Paracord Knot
        ctx.fillStyle = '#181818'
        ctx.beginPath()
        ctx.roundRect((startX + endX) / 2 - 6 * zoomScale, eyeletY - 6 * zoomScale, 12 * zoomScale, 12 * zoomScale, 3 * zoomScale)
        ctx.fill()

        ctx.restore()
    }

    // Master Render Loop (60 FPS with requestAnimationFrame)
    const renderScene = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        const width = rect.width
        const height = rect.height

        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr
            canvas.height = height * dpr
        }

        ctx.save()
        ctx.scale(dpr, dpr)

        // 1. Blit Cached Offscreen Grid Background
        updateOffscreenGrid(width, height, dpr)
        if (offscreenGridRef.current) {
            ctx.drawImage(offscreenGridRef.current, 0, 0, width, height)
        }

        const centerX = width / 2
        const centerY = height / 2

        // 2. Measure Custom Text Dimensions with Kerning
        ctx.font = `bold ${fontSize * zoom}px ${activeFontFamily}`
        ctx.textBaseline = 'middle'

        const chars = text ? text.split('') : ['H', 'A', 'U', 'S']
        let totalTextWidth = 0
        const charMetrics = chars.map((ch, idx) => {
            const w = ctx.measureText(ch).width
            const nudge = (charOffsets[idx] || 0) * zoom
            const spacing = idx > 0 ? (globalKerning * zoom) : 0
            totalTextWidth += w + spacing + nudge
            return { ch, w, nudge, spacing }
        })

        const mmToPx = 3.6 * zoom
        const charmsExtraWidth = selectedCharms.length * 24 * zoom
        const bodyWidth = Math.max(totalTextWidth + charmsExtraWidth + 28 * zoom, metrics.lengthMm * mmToPx * 0.8)
        const bodyHeight = metrics.heightMm * mmToPx

        // Save character bounding boxes for interactive click selection
        const clickBoxes = []
        let currentX = centerX - totalTextWidth / 2
        charMetrics.forEach(({ ch, w, nudge, spacing }, idx) => {
            currentX += spacing + nudge
            clickBoxes.push({
                idx,
                ch,
                minX: currentX,
                maxX: currentX + w,
                minY: centerY - bodyHeight / 2,
                maxY: centerY + bodyHeight / 2
            })
            currentX += w
        })
        charBoxesRef.current = clickBoxes

        // Eyelet geometry in pixels
        const innerHoleRadius = (holeDiameter / 2) * mmToPx
        const outerWallThickness = 2.6 * mmToPx
        const outerEyeletRadius = innerHoleRadius + outerWallThickness

        let eyeletX = centerX - bodyWidth / 2 - outerEyeletRadius + 6 * zoom
        let eyeletY = centerY

        if (eyeletPosition === 'right') {
            eyeletX = centerX + bodyWidth / 2 + outerEyeletRadius - 6 * zoom
            eyeletY = centerY
        } else if (eyeletPosition === 'top') {
            eyeletX = centerX
            eyeletY = centerY - bodyHeight / 2 - outerEyeletRadius + 6 * zoom
        }

        // ==========================================
        // 3D ISOMETRIC VIEW VS 2D BLUEPRINT VIEW
        // ==========================================
        ctx.save()

        if (viewMode === '3d') {
            // Isometric Tilt Transform: Rotate -8deg, Shear 18deg
            ctx.translate(centerX, centerY)
            ctx.transform(1, 0, -0.32, 0.85, 0, 0)
            ctx.rotate(-0.08)
            ctx.translate(-centerX, -centerY)
        }

        // 3. Draw Paracord Underlay Loop
        if (showCordPreview) {
            const cordRadius = (holeDiameter * 0.38) * mmToPx
            const startX = eyeletPosition === 'left' ? eyeletX - outerEyeletRadius - 40 * zoom : eyeletX - 30 * zoom
            const startY = eyeletPosition === 'top' ? eyeletY - outerEyeletRadius - 40 * zoom : eyeletY - 26 * zoom
            const endX = eyeletPosition === 'right' ? eyeletX + outerEyeletRadius + 40 * zoom : eyeletX - 30 * zoom
            const endY = eyeletPosition === 'top' ? eyeletY - outerEyeletRadius - 40 * zoom : eyeletY + 26 * zoom
            drawBraidedParacord(ctx, startX, startY, eyeletX, eyeletY, endX, endY, cordRadius, zoom)
        }

        // 4. Base Plate / Chassis Elevation Stack (Extrusion Layers)
        const extrusionSteps = viewMode === '3d' ? 8 : 1

        // Drop Shadow for Isometric Floating Feel
        if (viewMode === '3d') {
            ctx.shadowColor = 'rgba(20, 16, 12, 0.35)'
            ctx.shadowBlur = 18 * zoom
            ctx.shadowOffsetY = 12 * zoom
        }

        // Draw Extrusion Stack (Simulating 3D Solid Depth)
        for (let step = extrusionSteps; step >= 0; step--) {
            const yOff = step * 1.2
            ctx.fillStyle = step === 0 ? baseColor.hex : '#111010' // dark bevel for extrusion sides
            ctx.globalAlpha = step === 0 ? 1.0 : 0.85

            if (baseStyle === 'capsule') {
                const capX = centerX - bodyWidth / 2
                const capY = centerY - bodyHeight / 2 + yOff
                const radius = bodyHeight / 2
                ctx.beginPath()
                ctx.roundRect(capX, capY, bodyWidth, bodyHeight, radius)
                ctx.fill()
            } else if (baseStyle === 'rail') {
                const railY = centerY + bodyHeight * 0.18 + yOff
                ctx.beginPath()
                ctx.roundRect(centerX - bodyWidth / 2, railY, bodyWidth, 6 * zoom, 3 * zoom)
                ctx.fill()

                ctx.beginPath()
                ctx.roundRect(centerX - bodyWidth / 2, centerY - bodyHeight * 0.35 + yOff, bodyWidth, bodyHeight * 0.65, 8 * zoom)
                ctx.fill()
            } else {
                ctx.beginPath()
                ctx.roundRect(centerX - bodyWidth / 2, centerY - bodyHeight * 0.4 + yOff, bodyWidth, bodyHeight * 0.8, 12 * zoom)
                ctx.fill()
            }

            // Eyelet Outer Ring
            ctx.beginPath()
            ctx.arc(eyeletX, eyeletY + yOff, outerEyeletRadius, 0, Math.PI * 2)
            ctx.fill()
        }

        ctx.globalAlpha = 1.0
        ctx.shadowColor = 'transparent'

        // Punch Eyelet Center Hole
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        ctx.arc(eyeletX, eyeletY, innerHoleRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // 5. 3D FDM Layer Texture Shading
        if (showLayerTexture) {
            ctx.save()
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
            ctx.lineWidth = 1.0
            const layerSpacing = 3 * zoom
            for (let y = centerY - bodyHeight; y < centerY + bodyHeight; y += layerSpacing) {
                ctx.beginPath()
                ctx.moveTo(centerX - bodyWidth / 2, y)
                ctx.lineTo(centerX + bodyWidth / 2, y)
                ctx.stroke()
            }
            ctx.restore()
        }

        // 6. Raised Lettering Extrusion (+1.6mm elevation)
        const textFill = isDualTone ? letterColor.hex : (baseColor.textHex || '#FFFFFF')
        const letterExtrusionSteps = viewMode === '3d' ? 4 : 2

        for (let lStep = letterExtrusionSteps; lStep >= 0; lStep--) {
            const lOffset = lStep * 1.0
            ctx.fillStyle = lStep === 0 ? textFill : 'rgba(0, 0, 0, 0.35)'

            let cX = centerX - totalTextWidth / 2
            charMetrics.forEach(({ ch, w, nudge, spacing }, idx) => {
                cX += spacing + nudge
                const isSelected = selectedCharIndex === idx
                if (isSelected && lStep === 0) {
                    ctx.save()
                    ctx.fillStyle = '#C84B31' // Highlight selected character in terracotta
                    ctx.fillText(ch, cX, centerY + lOffset)
                    ctx.restore()
                } else {
                    ctx.fillText(ch, cX, centerY + lOffset)
                }
                cX += w
            })
        }

        // 6.1 Raised Charms Extrusion (HAUS Flower & Brand STL Charms)
        if (selectedCharms.length > 0) {
            for (let cStep = letterExtrusionSteps; cStep >= 0; cStep--) {
                const cOffset = cStep * 1.0
                ctx.fillStyle = cStep === 0 ? textFill : 'rgba(0, 0, 0, 0.35)'

                selectedCharms.forEach((charm, cIdx) => {
                    const charmCenterX = (centerX + totalTextWidth / 2) + 14 * zoom + (cIdx * 24 * zoom)
                    const charmCenterY = centerY + cOffset
                    const flowerRadius = 8.5 * zoom

                    if (charm.id === 'flower' || charm.symbol === '✿') {
                        // 5 Radial Petals (HAUS signature flower)
                        const petalDist = flowerRadius * 0.58
                        const petalRad = flowerRadius * 0.42
                        for (let p = 0; p < 5; p++) {
                            const ang = p * (Math.PI * 2 / 5) - Math.PI / 2
                            const px = charmCenterX + Math.cos(ang) * petalDist
                            const py = charmCenterY + Math.sin(ang) * petalDist
                            ctx.beginPath()
                            ctx.arc(px, py, petalRad, 0, Math.PI * 2)
                            ctx.fill()
                        }
                        // Center Core
                        ctx.save()
                        ctx.fillStyle = cStep === 0 ? (isDualTone ? baseColor.hex : '#C84B31') : 'rgba(0, 0, 0, 0.4)'
                        ctx.beginPath()
                        ctx.arc(charmCenterX, charmCenterY, flowerRadius * 0.28, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.restore()
                    } else {
                        // Custom Brand STL Charm Symbol Tag
                        ctx.save()
                        ctx.font = `bold ${fontSize * 0.65 * zoom}px sans-serif`
                        ctx.textAlign = 'center'
                        ctx.textBaseline = 'middle'
                        ctx.fillText(charm.symbol || '✦', charmCenterX, charmCenterY)
                        ctx.restore()
                    }
                })
            }
        }

        // Reverse Engraving Text Preview (if set)
        if (reverseText) {
            ctx.save()
            ctx.font = `bold ${10 * zoom}px "Space Mono", monospace`
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
            ctx.textAlign = 'center'
            ctx.fillText(`[ REV: ${reverseText} ]`, centerX, centerY + bodyHeight * 0.36)
            ctx.restore()
        }

        ctx.restore() // End 3D Transform

        // 7. Technical Dimension Annotations (In 2D Mode only for precision)
        if (viewMode === '2d') {
            ctx.save()
            // Gauge indicator
            ctx.strokeStyle = '#C84B31'
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(eyeletX - innerHoleRadius, eyeletY + outerEyeletRadius + 10 * zoom)
            ctx.lineTo(eyeletX + innerHoleRadius, eyeletY + outerEyeletRadius + 10 * zoom)
            ctx.stroke()

            ctx.fillStyle = '#C84B31'
            ctx.font = 'bold 9px "Space Mono", monospace'
            ctx.textAlign = 'center'
            ctx.fillText(`⌀ ${holeDiameter}.0mm CORD`, eyeletX, eyeletY + outerEyeletRadius + 24 * zoom)

            // Length Line
            const bottomLineY = centerY + bodyHeight / 2 + 36 * zoom
            ctx.strokeStyle = '#8C8276'
            ctx.lineWidth = 0.8
            ctx.fillStyle = '#5A524A'
            ctx.font = '10px "Space Mono", monospace'
            ctx.beginPath()
            ctx.moveTo(centerX - bodyWidth / 2, bottomLineY)
            ctx.lineTo(centerX + bodyWidth / 2, bottomLineY)
            ctx.stroke()
            ctx.fillText(`[ LENGTH: ~${metrics.lengthMm} mm · THICKNESS: ${thickness}mm ]`, centerX, bottomLineY + 14 * zoom)
            ctx.restore()
        }

        ctx.restore()
    }, [
        text,
        activeFontFamily,
        fontSize,
        globalKerning,
        charOffsets,
        selectedCharIndex,
        holeDiameter,
        eyeletPosition,
        baseStyle,
        thickness,
        baseColor,
        letterColor,
        isDualTone,
        cordColor,
        showGrid,
        gridStep,
        showLayerTexture,
        showCordPreview,
        viewMode,
        zoom,
        reverseText,
        metrics,
        selectedCharms,
        updateOffscreenGrid
    ])

    // Schedule RAF Render
    const scheduleRender = useCallback(() => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = requestAnimationFrame(renderScene)
    }, [renderScene])

    useEffect(() => {
        scheduleRender()
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
        }
    }, [scheduleRender])

    // Window resize handler
    useEffect(() => {
        const handleResize = () => scheduleRender()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [scheduleRender])

    // Canvas Interactive Click Selection
    const handleCanvasClick = (e) => {
        if (viewMode !== '2d') return // Only in 2D blueprint mode for pixel precision
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top

        const clicked = charBoxesRef.current.find(b =>
            clickX >= b.minX && clickX <= b.maxX && clickY >= b.minY && clickY <= b.maxY
        )

        if (clicked) {
            setSelectedCharIndex(clicked.idx)
            setActiveTab('kerning')
            toast.info(`เลือกตัวอักษร #${clicked.idx + 1} "${clicked.ch}" พร้อมปรับระยะ`)
        } else {
            setSelectedCharIndex(null)
        }
    }

    // Per-Character Kerning Nudge Handler
    const handleCharNudge = (idx, delta) => {
        setCharOffsets(prev => ({
            ...prev,
            [idx]: (prev[idx] || 0) + delta
        }))
    }

    // Export Aesthetic PNG (Front-End)
    const handleExportPNG = async () => {
        try {
            setIsExporting(true)
            toast.info('กำลังเรนเดอร์ภาพการ์ดสเปกความละเอียดสูง...')
            const filename = await exportAestheticPNG(canvasRef.current, {
                text,
                fontName: customFontName || selectedFont?.name || 'Calligraphy',
                holeDiameter,
                eyeletPosition,
                baseStyle,
                letterSpacing: globalKerning,
                actualLength: metrics.lengthMm,
                actualHeight: metrics.heightMm,
                colorName: baseColor.name,
                cordColorName: cordColor.name,
                thickness,
                reverseText,
                selectedCharms,
                charmsSummary: selectedCharms.map(c => c.name).join(', '),
                weightEst: metrics.weightEst,
                printTimeEst: metrics.printTimeEst
            })
            if (filename) {
                toast.success(`บันทึกภาพการ์ด "${filename}" เรียบร้อยแล้ว`)
            }
        } catch (err) {
            console.error('PNG export error:', err)
            toast.error('ไม่สามารถบันทึกภาพได้: ' + err.message)
        } finally {
            setIsExporting(false)
        }
    }

    // Export STL for Bambu/Prusa (Admin Only)
    const handleExportSTL = () => {
        try {
            const filename = exportToSTL({
                text,
                length: metrics.lengthMm,
                height: metrics.heightMm,
                holeDiameter,
                eyeletPosition,
                baseStyle,
                thickness,
                reverseText,
                selectedCharms,
                hasFlower: selectedCharms.some(c => c.id === 'flower' || c.symbol === '✿')
            }, threeMeshRef.current?.group)
            toast.success(`ส่งออกโมเดล 3D STL "${filename}" สำเร็จ!`)
        } catch (err) {
            console.error('STL export error:', err)
            toast.error('ส่งออก STL ล้มเหลว: ' + err.message)
        }
    }

    // Export STEP for CAD (Admin Only)
    const handleExportSTEP = () => {
        try {
            const filename = exportToSTEP({
                text,
                length: metrics.lengthMm,
                height: metrics.heightMm,
                holeDiameter,
                eyeletPosition,
                baseStyle,
                thickness,
                reverseText,
                selectedCharms,
                hasFlower: selectedCharms.some(c => c.id === 'flower' || c.symbol === '✿')
            })
            toast.success(`ส่งออกโมเดล CAD STEP "${filename}" สำเร็จ!`)
        } catch (err) {
            console.error('STEP export error:', err)
            toast.error('ส่งออก STEP ล้มเหลว: ' + err.message)
        }
    }

    // Add to Cart Trigger (With Dynamic Pricing & Charms)
    const handleOrderKeychain = () => {
        if (!text.trim()) {
            toast.error('กรุณาระบุชื่อที่ต้องการสั่งทำ')
            return
        }

        const snapshotDataUrl = canvasRef.current?.toDataURL('image/png') || null
        const fontName = customFontName || selectedFont?.name || 'Calligraphy'
        const charmTags = selectedCharms.length > 0 ? selectedCharms.map(c => c.symbol || '✿').join(' ') : ''

        const customProductPayload = {
            id: 'hausmade-3d-custom-keychain',
            name: `พวงกุญแจชื่อ 3D Print: "${text.trim()}"${charmTags ? ` + ชาร์ม ${charmTags}` : ''}`,
            price: priceCalculation.total,
            image_url: snapshotDataUrl,
            custom_specs: {
                text: text.trim(),
                font: fontName,
                holeDiameter,
                eyeletPosition,
                baseStyle,
                color: baseColor.name,
                cordColor: cordColor.name,
                thickness: `${thickness}mm`,
                reverseText: reverseText || null,
                charms: selectedCharms.map(c => `${c.name} (+฿${c.price || 20})`).join(', ') || 'ไม่มี',
                dimensions: `${metrics.lengthMm} × ${metrics.heightMm} × ${thickness} mm`,
                weight: `~${metrics.weightEst}g`,
                printTime: `~${metrics.printTimeEst}m`
            }
        }

        const optionsText = `ชื่อ: "${text.trim()}" | รูเชือก: ${holeDiameter}mm (${cordColor.name}) | ฟอนต์: ${fontName} | ทรง: ${baseStyle.toUpperCase()} | หนา: ${thickness}mm | สี: ${baseColor.name}${charmTags ? ` | ชาร์ม: ${charmTags}` : ''}${reverseText ? ` | สลักหลัง: "${reverseText}"` : ''}`

        if (onAddToCart) {
            onAddToCart(
                customProductPayload,
                customProductPayload.custom_specs,
                1,
                0,
                optionsText
            )
            toast.success(`เพิ่ม "${customProductPayload.name}" ลงในตะกร้าแล้ว (฿${priceCalculation.total})!`)
        }
    }

    return (
        <div className="w-full flex flex-col bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-sans antialiased overflow-hidden select-none">
            {/* 1. Header Bar (Dieter Rams Neo-Brutalist Grid) */}
            <div className="flex flex-wrap items-center justify-between border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] px-4 py-2.5 font-mono text-xs gap-3">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[oklch(52%_0.16_28)]" />
                    <span className="font-bold tracking-wider uppercase text-[oklch(18%_0.012_28)]">
                        HAUSMADE // 3D KEYCHAIN ATELIER
                    </span>
                    <span className="text-[oklch(55%_0.010_28)] hidden sm:inline">
                        · SYSTEM 04/05
                    </span>
                </div>

                {/* Live Telemetry Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] font-bold text-[11px]">
                        CORD: ⌀{holeDiameter}mm
                    </span>
                    <span className="px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] text-[11px]">
                        {metrics.lengthMm}×{metrics.heightMm}×{thickness}mm
                    </span>
                    <span className="px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] text-[11px]">
                        ~{metrics.weightEst}g
                    </span>
                    <span className="px-2 py-0.5 border border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] font-bold text-[11px] tabular-nums">
                        ฿{priceCalculation.total}.-
                    </span>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-2.5 py-0.5 border border-[oklch(85%_0.012_28)] hover:bg-[oklch(18%_0.012_28)] hover:text-[oklch(97%_0.008_28)] transition-colors cursor-pointer font-bold"
                        >
                            [ X ]
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Quick Presets Bar (1-Click Inspiration) */}
            <div className="flex items-center gap-2 px-4 py-2 bg-[oklch(99%_0.005_28)] border-b border-[oklch(85%_0.012_28)] overflow-x-auto scrollbar-none font-mono text-[11px]">
                <span className="text-[oklch(55%_0.010_28)] font-bold whitespace-nowrap uppercase">
                    PRESETS:
                </span>
                {STYLE_PRESETS.map(preset => (
                    <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="px-2.5 py-1 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:border-[oklch(18%_0.012_28)] text-[oklch(18%_0.012_28)] whitespace-nowrap font-bold text-[10px] uppercase transition-all cursor-pointer shadow-2xs"
                        title={preset.desc}
                    >
                        {preset.name}
                    </button>
                ))}
            </div>

            {/* 3. Main Studio Grid (2-Column Layout: Canvas on Left, Controls on Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
                {/* LEFT: Canvas Stage (8 Cols) */}
                <div className="lg:col-span-8 flex flex-col relative border-b lg:border-b-0 lg:border-r border-[oklch(85%_0.012_28)] bg-[#F8F5F0]">
                    {/* Canvas Toolbar with 2D / 3D Switcher */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]/90 font-mono text-[11px] gap-2 flex-wrap z-10">
                        {/* 2D Blueprint vs 3D Isometric Switcher */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[oklch(55%_0.010_28)] font-bold">VIEW:</span>
                            <div className="flex border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('3d')}
                                    className={`px-2 py-0.5 text-[10px] font-bold transition-all ${
                                        viewMode === '3d'
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] shadow-2xs'
                                            : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                    }`}
                                >
                                    [ 3D ISOMETRIC ]
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('2d')}
                                    className={`px-2 py-0.5 text-[10px] font-bold transition-all ${
                                        viewMode === '2d'
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] shadow-2xs'
                                            : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                    }`}
                                >
                                    [ 2D BLUEPRINT ]
                                </button>
                            </div>
                        </div>

                        {/* Toggles & Grid Resolution */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[oklch(55%_0.010_28)]">GRID:</span>
                            <button
                                type="button"
                                onClick={() => setShowGrid(!showGrid)}
                                className={`px-2 py-0.5 border text-[10px] font-bold transition-all ${
                                    showGrid
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                        : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                }`}
                            >
                                {showGrid ? '[ ON ]' : '[ OFF ]'}
                            </button>

                            {showGrid && (
                                <div className="flex items-center border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                                    {[1, 5, 10].map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setGridStep(s)}
                                            className={`px-1.5 py-0.5 text-[10px] font-bold ${
                                                gridStep === s
                                                    ? 'bg-[oklch(52%_0.16_28)] text-white'
                                                    : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                            }`}
                                        >
                                            {s}mm
                                        </button>
                                    ))}
                                </div>
                            )}

                            <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]">
                                <input
                                    type="checkbox"
                                    checked={showCordPreview}
                                    onChange={(e) => setShowCordPreview(e.target.checked)}
                                    className="accent-[oklch(52%_0.16_28)] cursor-pointer"
                                />
                                <span>PARACORD</span>
                            </label>

                            <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]">
                                <input
                                    type="checkbox"
                                    checked={showLayerTexture}
                                    onChange={(e) => setShowLayerTexture(e.target.checked)}
                                    className="accent-[oklch(52%_0.16_28)] cursor-pointer"
                                />
                                <span>3D LAYERS</span>
                            </label>
                        </div>

                        {/* Zoom Controls */}
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setZoom(z => Math.max(0.6, z - 0.1))}
                                className="w-5 h-5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] font-bold leading-none flex items-center justify-center hover:bg-[oklch(18%_0.012_28)] hover:text-white"
                            >
                                -
                            </button>
                            <span className="w-8 text-center text-[10px] font-bold tabular-nums">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={() => setZoom(z => Math.min(1.8, z + 0.1))}
                                className="w-5 h-5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] font-bold leading-none flex items-center justify-center hover:bg-[oklch(18%_0.012_28)] hover:text-white"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Canvas / 3D WebGL Stage */}
                    {viewMode === '3d' ? (
                        <div className="flex-1 w-full relative min-h-[460px] sm:min-h-[520px] flex flex-col">
                            <HausmadeKeychain3DViewer
                                text={text}
                                fontId={selectedFont?.id || 'great-vibes'}
                                customFontBuffer={customFontBuffer}
                                baseStyle={baseStyle}
                                holeDiameter={holeDiameter}
                                eyeletPosition={eyeletPosition}
                                thickness={thickness}
                                baseColor={baseColor.hex}
                                letterColor={letterColor.hex}
                                isDualTone={isDualTone}
                                hasFlower={selectedCharms.some(c => c.id === 'flower' || c.symbol === '✿')}
                                hardwareType={hardwareType}
                                cordColor={cordColor.hex}
                                hardwareFinish={hardwareFinish}
                                onMeshReady={(meshInfo) => { threeMeshRef.current = meshInfo }}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 w-full h-[390px] sm:h-[460px] relative overflow-hidden flex items-center justify-center">
                            <canvas
                                ref={canvasRef}
                                onClick={handleCanvasClick}
                                className="w-full h-full block cursor-crosshair"
                            />
                            <div className="absolute bottom-2 left-3 font-mono text-[9px] text-[oklch(55%_0.010_28)] pointer-events-none">
                                💡 คลิกที่ตัวอักษรบน Canvas เพื่อเลือกปรับ Nudge ได้ทันที
                            </div>
                        </div>
                    )}

                    {/* Bottom Quick-Action Status Bar */}
                    <div className="border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] px-4 py-2 flex items-center justify-between font-mono text-[11px] gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)]" />
                            <span className="text-[oklch(42%_0.010_28)]">
                                READY TO PRINT · 3D PRINT DURATION ~{metrics.printTimeEst} MIN · RIGIDITY: {thickness}mm
                            </span>
                        </div>

                        {/* Front-End Aesthetic PNG Export Button */}
                        <button
                            type="button"
                            disabled={isExporting}
                            onClick={handleExportPNG}
                            className="px-3 py-1 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] hover:border-[oklch(18%_0.012_28)] font-bold text-[oklch(18%_0.012_28)] transition-all cursor-pointer shadow-2xs"
                        >
                            {isExporting ? '[ RENDERING SPEC CARD... ]' : '[ EXPORT AESTHETIC PNG // บันทึกการ์ดสเปก ]'}
                        </button>
                    </div>
                </div>

                {/* RIGHT: Studio Controls (4 Cols) */}
                <div className="lg:col-span-4 flex flex-col bg-[oklch(97%_0.008_28)]">
                    {/* Tab Navigation (Tabular Cells) */}
                    <div className="grid grid-cols-6 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] font-mono text-[9px] sm:text-[10px]">
                        {[
                            { id: 'presets', label: 'PRESET' },
                            { id: 'text', label: '1. TEXT' },
                            { id: 'charms', label: '2. CHARM' },
                            { id: 'structure', label: '3. HOLE' },
                            { id: 'kerning', label: '4. NUDGE' },
                            { id: 'filament', label: '5. COLOR' }
                        ].map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveTab(t.id)}
                                className={`py-2.5 font-bold uppercase transition-colors border-r last:border-r-0 border-[oklch(85%_0.012_28)] ${
                                    activeTab === t.id
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                        : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(92%_0.010_28)]'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Panels */}
                    <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto max-h-[460px]">
                        {/* TAB 0: SMART PRESETS */}
                        {activeTab === 'presets' && (
                            <div className="flex flex-col gap-3">
                                <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                    [ CURATED ATELIER PRESETS // สไตล์สำเร็จรูป ]
                                </span>
                                <div className="flex flex-col gap-2">
                                    {STYLE_PRESETS.map(preset => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => applyPreset(preset)}
                                            className="p-3 border border-[oklch(85%_0.012_28)] bg-[oklch(99%_0.005_28)] hover:bg-[oklch(94%_0.010_28)] text-left flex flex-col gap-1 transition-all cursor-pointer shadow-2xs"
                                        >
                                            <div className="flex justify-between items-center font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                                                <span>{preset.name}</span>
                                                <span className="text-[oklch(52%_0.16_28)]">⌀{preset.holeDiameter}mm</span>
                                            </div>
                                            <p className="text-[11px] text-[oklch(42%_0.010_28)] font-sans">
                                                {preset.desc}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TAB 1: TEXT & FONTS */}
                        {activeTab === 'text' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center font-mono text-[10px] font-bold">
                                        <span className="text-[oklch(55%_0.010_28)] uppercase">[ KEYCHAIN TEXT // ข้อความบนพวงกุญแจ ]</span>
                                        <span className={text.length >= (pricing.maxChars || 10) ? 'text-[oklch(52%_0.16_28)] font-bold' : 'text-[oklch(55%_0.010_28)]'}>
                                            {text.length}/{pricing.maxChars || 10} ตัว
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={pricing.maxChars || 10}
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        placeholder="พิมพ์ชื่อของคุณ (เช่น haus, Joy)"
                                        className="w-full px-3 py-2 border border-[oklch(85%_0.012_28)] bg-[oklch(99%_0.005_28)] text-base font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                    />
                                    <div className="flex flex-col gap-1 font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                        <span>* ราคาตั้งต้นรวม {pricing.baseCharLimit} ตัวแรก (ตัวอักษรส่วนเกิน +฿{pricing.extraCharPrice}/ตัว)</span>
                                    </div>
                                    {text.length >= (pricing.maxChars || 10) && (
                                        <div className="p-2 border border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] text-[10px] font-mono font-bold flex items-center justify-between">
                                            <span>[ SAFE BOUNDARY REACHED ]</span>
                                            <span>ครบขีดจำกัด {pricing.maxChars || 10} ตัวสูงสุดเพื่อความแข็งแรง</span>
                                        </div>
                                    )}
                                </div>

                                {/* Reverse Sub-text Engraving */}
                                <div className="flex flex-col gap-1.5 border-t border-[oklch(85%_0.012_28)] pt-3">
                                    <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase flex justify-between">
                                        <span>[ REVERSE ENGRAVING // สลักข้อความเสริม/เบอร์โทร ]</span>
                                        <span className="text-[oklch(55%_0.010_28)] font-normal">OPTIONAL</span>
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={20}
                                        value={reverseText}
                                        onChange={(e) => setReverseText(e.target.value)}
                                        placeholder="เช่น TEL: 098-XXX-XXXX หรือ EST. 2026"
                                        className="w-full px-3 py-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(99%_0.005_28)] text-xs font-mono focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                    />
                                </div>

                                {/* Font Size Slider */}
                                <div className="flex flex-col gap-1.5 border-t border-[oklch(85%_0.012_28)] pt-3">
                                    <div className="flex justify-between font-mono text-[10px] font-bold">
                                        <span className="text-[oklch(55%_0.010_28)] uppercase">[ FONT SIZE SCALE ]</span>
                                        <span>{fontSize} pt</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={32}
                                        max={64}
                                        value={fontSize}
                                        onChange={(e) => setFontSize(Number(e.target.value))}
                                        className="accent-[oklch(52%_0.16_28)] cursor-pointer"
                                    />
                                </div>

                                {/* Curated Calligraphy Font Picker */}
                                <div className="flex flex-col gap-2">
                                    <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                        [ CURATED CALLIGRAPHY // เลือกฟอนต์ลายมือ ]
                                    </label>
                                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                                        {CURATED_FONTS.map(f => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFont(f)
                                                    setCustomFontFamily(null)
                                                    setCustomFontName(null)
                                                }}
                                                className={`p-2 border text-left flex items-center justify-between transition-all ${
                                                    selectedFont?.id === f.id && !customFontFamily
                                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                        : 'bg-[oklch(99%_0.005_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-sm" style={{ fontFamily: f.family }}>
                                                        {f.name}
                                                    </span>
                                                    <span className="font-mono text-[9px] opacity-70">
                                                        {f.desc}
                                                    </span>
                                                </div>
                                                {selectedFont?.id === f.id && !customFontFamily && (
                                                    <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)]">
                                                        [ ACTIVE ]
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Font File Uploader */}
                                <div className="border-t border-[oklch(85%_0.012_28)] pt-3 flex flex-col gap-2">
                                    <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase flex items-center justify-between">
                                        <span>[ UPLOAD FONT // ใส่ฟอนต์ของคุณเอง ]</span>
                                        <span className="text-[oklch(52%_0.16_28)] font-normal">.ttf / .otf / .woff</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept=".ttf,.otf,.woff,.woff2"
                                        onChange={handleFontUpload}
                                        className="font-mono text-xs file:mr-2 file:py-1 file:px-2.5 file:border file:border-[oklch(85%_0.012_28)] file:bg-[oklch(94%_0.010_28)] file:font-mono file:text-[10px] file:font-bold file:uppercase hover:file:bg-[oklch(18%_0.012_28)] hover:file:text-white cursor-pointer"
                                    />
                                    {customFontName && (
                                        <div className="p-2 bg-[oklch(45%_0.08_140)]/15 border border-[oklch(45%_0.08_140)] font-mono text-[10px] text-[oklch(35%_0.08_140)] font-bold flex justify-between items-center">
                                            <span>ACTIVE: {customFontName}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCustomFontFamily(null)
                                                    setCustomFontName(null)
                                                    setSelectedFont(CURATED_FONTS[0])
                                                }}
                                                className="underline hover:text-red-600"
                                            >
                                                [ ล้าง ]
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 2: BRAND 3D CHARMS */}
                        {activeTab === 'charms' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase">
                                    <span className="text-[oklch(55%_0.010_28)]">[ BRAND 3D CHARMS // ชาร์มแบรนด์ ]</span>
                                    <span className="text-[oklch(52%_0.16_28)]">
                                        {selectedCharms.length}/{pricing.maxElements ?? 2} ชิ้น
                                    </span>
                                </div>

                                <p className="text-[11px] text-[oklch(42%_0.010_28)] leading-relaxed">
                                    เลือกติดชาร์มโมเดล 3D เอกลักษณ์ของแบรนด์ HAUS หรือดีไซน์พิเศษจากคลังแบรนด์ (จำกัดสูงสุด {pricing.maxElements ?? 2} ชิ้น เพื่อความแข็งแรงของข้อต่อ 3D Print)
                                </p>

                                <div className="grid grid-cols-1 gap-2">
                                    {availableCharms.map(charm => {
                                        const isSelected = selectedCharms.some(c => c.id === charm.id)
                                        return (
                                            <button
                                                key={charm.id}
                                                type="button"
                                                onClick={() => toggleCharm(charm)}
                                                className={`p-3 border text-left flex items-center justify-between transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)] shadow-2xs'
                                                        : 'bg-[oklch(99%_0.005_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 flex items-center justify-center text-lg font-serif border ${
                                                        isSelected
                                                            ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)]'
                                                            : 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                                    }`}>
                                                        {charm.symbol || '✿'}
                                                    </span>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-xs">{charm.name}</span>
                                                            {charm.is_default && (
                                                                <span className="text-[9px] px-1 py-0.2 bg-[oklch(52%_0.16_28)] text-white uppercase font-mono">
                                                                    SIGNATURE
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="font-mono text-[10px] opacity-75">
                                                            {charm.stl_url ? 'โมเดล STL แบรนด์แท้' : 'โมเดลดอกไม้ 3D แท้'} · +฿{charm.price || pricing.elementPrice || 20}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="font-mono text-xs font-bold">
                                                    {isSelected ? (
                                                        <span className="text-[oklch(88%_0.18_95)]">[ เลือกแล้ว ]</span>
                                                    ) : (
                                                        <span className="text-[oklch(55%_0.010_28)]">+ ฿{charm.price || pricing.elementPrice || 20}</span>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>

                                {selectedCharms.length >= (pricing.maxElements ?? 2) && (
                                    <div className="p-2.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-mono text-[10px] text-[oklch(55%_0.010_28)] flex items-center justify-between">
                                        <span>[ MAX CHARMS REACHED ]</span>
                                        <span>ครบโควตา {pricing.maxElements ?? 2} ชิ้น</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 3: EYELET, CORD & STRUCTURE */}
                        {activeTab === 'structure' && (
                            <div className="flex flex-col gap-4">
                                {/* Hardware Attachment Type */}
                                <div className="flex flex-col gap-2">
                                    <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                        [ HARDWARE ATTACHMENT // อุปกรณ์คล้อง ]
                                    </label>
                                    <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                                        {[
                                            { id: 'ring', label: 'METALLIC RING', desc: 'ห่วงโลหะสปลิตริง' },
                                            { id: 'cord', label: 'PARACORD 550', desc: 'เชือกถักแคมปิ้ง' },
                                            { id: 'none', label: 'NO HARDWARE', desc: 'เฉพาะชิ้นงาน 3D' }
                                        ].map(h => (
                                            <button
                                                key={h.id}
                                                type="button"
                                                onClick={() => setHardwareType(h.id)}
                                                className={`p-2 border text-center font-bold flex flex-col gap-0.5 cursor-pointer transition-all ${
                                                    hardwareType === h.id
                                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                        : 'bg-[oklch(99%_0.005_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                <span>{h.label}</span>
                                                <span className="text-[9px] opacity-75 font-normal">{h.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Metal Finish Options (if ring selected) */}
                                {hardwareType === 'ring' && (
                                    <div className="flex flex-col gap-1.5 border-t border-[oklch(85%_0.012_28)] pt-3">
                                        <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                            [ RING FINISH // สีห่วงโลหะ ]
                                        </label>
                                        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                                            {[
                                                { id: 'brass', name: 'VINTAGE BRASS', hex: '#D4AF37' },
                                                { id: 'chrome', name: 'CHROME SILVER', hex: '#E2E4E6' },
                                                { id: 'carbon', name: 'STEALTH BLACK', hex: '#242424' }
                                            ].map(f => (
                                                <button
                                                    key={f.id}
                                                    type="button"
                                                    onClick={() => setHardwareFinish(f.id)}
                                                    className={`p-2 border flex items-center justify-center gap-1.5 font-bold cursor-pointer ${
                                                        hardwareFinish === f.id
                                                            ? 'border-[oklch(18%_0.012_28)] bg-[oklch(94%_0.010_28)]'
                                                            : 'border-[oklch(85%_0.012_28)] bg-[oklch(99%_0.005_28)]'
                                                    }`}
                                                >
                                                    <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: f.hex }} />
                                                    <span className="text-[10px]">{f.name.split(' ')[1]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Paracord Colorway Picker (if cord selected) */}
                                {hardwareType === 'cord' && (
                                    <div className="flex flex-col gap-2 border-t border-[oklch(85%_0.012_28)] pt-3">
                                        <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                            [ PARACORD COLOR // สีเชือกร้อยพวงกุญแจ ]
                                        </label>
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {PARACORD_COLORS.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setCordColor(c)}
                                                    className={`p-2 border text-left flex items-center justify-between transition-all cursor-pointer ${
                                                        cordColor.id === c.id
                                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                            : 'bg-[oklch(99%_0.005_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ backgroundColor: c.hex }} />
                                                        <span className="font-bold text-xs">{c.name}</span>
                                                    </div>
                                                    {cordColor.id === c.id && (
                                                        <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)]">
                                                            [ ACTIVE ]
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Eyelet Cord Hole Size (4mm vs 5mm) */}
                                <div className="flex flex-col gap-2 border-t border-[oklch(85%_0.012_28)] pt-3">
                                    <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                        [ CORD HOLE GAUGE // ขนาดรูร้อยเชือก ]
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setHoleDiameter(4.0)}
                                            className={`p-3 border font-mono text-left transition-all cursor-pointer ${
                                                holeDiameter === 4.0
                                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                    : 'bg-[oklch(99%_0.005_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                            }`}
                                        >
                                            <div className="font-bold text-sm text-[oklch(52%_0.16_28)]">⌀ 4.0 MM</div>
                                            <div className="text-[10px] opacity-80 mt-1">Paracord 550 / ห่วงโลหะ / มาตรฐาน</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHoleDiameter(5.0)}
                                            className={`p-3 border font-mono text-left transition-all cursor-pointer ${
                                                holeDiameter === 5.0
                                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                    : 'bg-[oklch(99%_0.005_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                            }`}
                                        >
                                            <div className="font-bold text-sm text-[oklch(52%_0.16_28)]">⌀ 5.0 MM</div>
                                            <div className="text-[10px] opacity-80 mt-1">เชือกหนา / Macrame / คล้องสายกระเป๋า</div>
                                        </button>
                                    </div>
                                </div>

                                {/* Base Structure Style */}
                                <div className="flex flex-col gap-2 border-t border-[oklch(85%_0.012_28)] pt-3">
                                    <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                        [ 3D PRINT BASE STYLE // ทรงแผ่นรองฐาน ]
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                                        {[
                                            { id: 'capsule', title: 'CAPSULE PILL', desc: 'แคปซูลมน สไตล์ Vega' },
                                            { id: 'badge', title: 'ATELIER BADGE', desc: 'ป้าย Chamfer Dieter Rams' },
                                            { id: 'rail', title: 'UNDERLINE RAIL', desc: 'คานบาร์รองรับมินิมอล' },
                                            { id: 'tag', title: 'INDUSTRIAL TAG', desc: 'แท็กขอบมนอุตสาหกรรม' }
                                        ].map(st => (
                                            <button
                                                key={st.id}
                                                type="button"
                                                onClick={() => setBaseStyle(st.id)}
                                                className={`p-2.5 border text-left transition-all cursor-pointer ${
                                                    baseStyle === st.id
                                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                        : 'bg-[oklch(99%_0.005_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                <div className="font-bold text-[11px]">{st.title}</div>
                                                <div className="text-[9px] opacity-75 mt-0.5">{st.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Thickness Gauge */}
                                <div className="flex flex-col gap-2 border-t border-[oklch(85%_0.012_28)] pt-3">
                                    <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                        [ RIGIDITY & THICKNESS // ความหนาชิ้นงาน ]
                                    </label>
                                    <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                                        {[
                                            { val: 3.2, title: 'SLIM (3.2mm)', desc: 'เบา พกง่าย' },
                                            { val: 4.0, title: 'STD (4.0mm)', desc: 'มาตรฐาน แข็งแรง' },
                                            { val: 5.0, title: 'HEAVY (5.0mm)', desc: 'แกร่ง ลุยแค้มป์' }
                                        ].map(t => (
                                            <button
                                                key={t.val}
                                                type="button"
                                                onClick={() => setThickness(t.val)}
                                                className={`p-2 border text-center font-bold flex flex-col gap-0.5 cursor-pointer ${
                                                    thickness === t.val
                                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                        : 'bg-[oklch(99%_0.005_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                                }`}
                                            >
                                                <span>{t.title}</span>
                                                <span className="text-[9px] opacity-75 font-normal">{t.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: KERNING & PER-LETTER NUDGE */}
                        {activeTab === 'kerning' && (
                            <div className="flex flex-col gap-4">
                                <div className="p-3 bg-[oklch(52%_0.16_28)]/10 border border-[oklch(52%_0.16_28)] font-mono text-[11px] text-[oklch(52%_0.16_28)]">
                                    <strong>KERNING CALIBRATION:</strong> ปรับแต่งระยะห่างตัวอักษรเพื่อให้เส้นตวัดเชื่อมต่อกัน (Weld) สมบูรณ์แบบสำหรับการพิมพ์ 3D ไม่ให้ตัวอักษรหลุดออกจากกัน
                                </div>

                                {/* Global Kerning Slider */}
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between font-mono text-[10px] font-bold">
                                        <span className="text-[oklch(55%_0.010_28)] uppercase">[ GLOBAL KERNING / TRACKING ]</span>
                                        <span className="tabular-nums">{globalKerning >= 0 ? `+${globalKerning}` : globalKerning} px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={-8}
                                        max={24}
                                        value={globalKerning}
                                        onChange={(e) => setGlobalKerning(Number(e.target.value))}
                                        className="accent-[oklch(52%_0.16_28)] cursor-pointer"
                                    />
                                </div>

                                {/* Per-Character Fine Nudge */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                        <span>[ PER-LETTER FINE NUDGE // ขยับตัวอักษรเดี่ยว ]</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCharOffsets({})
                                                setSelectedCharIndex(null)
                                            }}
                                            className="text-[oklch(52%_0.16_28)] hover:underline"
                                        >
                                            [ รีเซ็ต ]
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                                        {text.split('').map((ch, idx) => {
                                            const offset = charOffsets[idx] || 0
                                            const isSelected = selectedCharIndex === idx
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => setSelectedCharIndex(idx)}
                                                    className={`flex items-center justify-between p-1.5 border font-mono text-xs transition-colors cursor-pointer ${
                                                        isSelected
                                                            ? 'border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10'
                                                            : 'border-[oklch(85%_0.012_28)] bg-[oklch(99%_0.005_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[oklch(55%_0.010_28)] text-[10px]">#{idx + 1}</span>
                                                        <span className={`font-bold text-sm px-2 py-0.5 border ${
                                                            isSelected
                                                                ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)]'
                                                                : 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                                        }`}>
                                                            {ch}
                                                        </span>
                                                        <span className="text-[10px] tabular-nums text-[oklch(55%_0.010_28)]">
                                                            ({offset >= 0 ? `+${offset}` : offset}px)
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleCharNudge(idx, -1)
                                                            }}
                                                            className="w-6 h-6 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(18%_0.012_28)] hover:text-white font-bold flex items-center justify-center cursor-pointer"
                                                        >
                                                            -
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleCharNudge(idx, 1)
                                                            }}
                                                            className="w-6 h-6 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(18%_0.012_28)] hover:text-white font-bold flex items-center justify-center cursor-pointer"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: FILAMENT & COLORS */}
                        {activeTab === 'filament' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                        [ BASE FILAMENT // สีแผ่นฐาน BIO-PLA+ ]
                                    </label>
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {FILAMENT_COLORS.map(col => (
                                            <button
                                                key={col.id}
                                                type="button"
                                                onClick={() => setBaseColor(col)}
                                                className={`p-2.5 border text-left flex items-center justify-between transition-all ${
                                                    baseColor.id === col.id
                                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                        : 'bg-[oklch(99%_0.005_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-black/20"
                                                        style={{ backgroundColor: col.hex }}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs">{col.name}</span>
                                                        <span className="font-mono text-[9px] opacity-70">{col.desc}</span>
                                                    </div>
                                                </div>
                                                {baseColor.id === col.id && (
                                                    <span className="font-mono text-[10px] text-[oklch(52%_0.16_28)] font-bold">
                                                        [ ACTIVE ]
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Dual-Tone Accent Toggle */}
                                <div className="border-t border-[oklch(85%_0.012_28)] pt-3 flex flex-col gap-2">
                                    <label className="flex items-center justify-between font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase cursor-pointer">
                                        <span>[ DUAL-TONE PRINTING // แยกสีตัวหนังสือ ]</span>
                                        <input
                                            type="checkbox"
                                            checked={isDualTone}
                                            onChange={(e) => setIsDualTone(e.target.checked)}
                                            className="accent-[oklch(52%_0.16_28)] cursor-pointer"
                                        />
                                    </label>

                                    {isDualTone && (
                                        <div className="grid grid-cols-5 gap-1.5 p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                                            {FILAMENT_COLORS.map(col => (
                                                <button
                                                    key={col.id}
                                                    type="button"
                                                    title={col.name}
                                                    onClick={() => setLetterColor(col)}
                                                    className={`h-8 border flex items-center justify-center ${
                                                        letterColor.id === col.id
                                                            ? 'ring-2 ring-[oklch(18%_0.012_28)]'
                                                            : ''
                                                    }`}
                                                    style={{ backgroundColor: col.hex }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Order & Admin Actions */}
                    <div className="border-t border-[oklch(85%_0.012_28)] p-4 bg-[oklch(94%_0.010_28)] flex flex-col gap-2.5">
                        {/* Live Transparent Price Breakdown Bar */}
                        <div className="flex flex-col gap-1 p-2.5 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] font-mono text-[10px]">
                            <div className="flex justify-between items-center text-[oklch(42%_0.010_28)]">
                                <span>ราคาตั้งต้น (รวม {priceCalculation.limit} ตัว):</span>
                                <span className="font-bold text-[oklch(18%_0.012_28)]">฿{priceCalculation.base}</span>
                            </div>
                            {priceCalculation.extraCharCount > 0 && (
                                <div className="flex justify-between items-center text-[oklch(42%_0.010_28)]">
                                    <span>ตัวอักษรเกิน ({priceCalculation.extraCharCount} × ฿{pricing.extraCharPrice ?? 15}):</span>
                                    <span className="font-bold text-[oklch(52%_0.16_28)]">+฿{priceCalculation.extraCharTotal}</span>
                                </div>
                            )}
                            {selectedCharms.length > 0 && (
                                <div className="flex justify-between items-center text-[oklch(42%_0.010_28)]">
                                    <span>ชาร์มแบรนด์ ({selectedCharms.map(c => c.symbol || '✿').join(' ')}):</span>
                                    <span className="font-bold text-[oklch(52%_0.16_28)]">+฿{priceCalculation.charmsTotal}</span>
                                </div>
                            )}
                            {isDualTone && (
                                <div className="flex justify-between items-center text-[oklch(42%_0.010_28)]">
                                    <span>พิมพ์สองสี (Dual-Tone):</span>
                                    <span className="font-bold text-[oklch(52%_0.16_28)]">+฿{priceCalculation.dualToneTotal}</span>
                                </div>
                            )}
                            {priceCalculation.reverseEngraveTotal > 0 && (
                                <div className="flex justify-between items-center text-[oklch(42%_0.010_28)]">
                                    <span>สลักหลัง (Reverse Text):</span>
                                    <span className="font-bold text-[oklch(52%_0.16_28)]">+฿{priceCalculation.reverseEngraveTotal}</span>
                                </div>
                            )}
                            {priceCalculation.heavyDutyTotal > 0 && (
                                <div className="flex justify-between items-center text-[oklch(42%_0.010_28)]">
                                    <span>ความหนา 5.0mm (Heavy-Duty):</span>
                                    <span className="font-bold text-[oklch(52%_0.16_28)]">+฿{priceCalculation.heavyDutyTotal}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center border-t border-[oklch(85%_0.012_28)] pt-1.5 mt-0.5 font-bold">
                                <span className="text-xs uppercase text-[oklch(18%_0.012_28)]">ยอดรวมชิ้นงาน:</span>
                                <span className="text-sm text-[oklch(52%_0.16_28)] tabular-nums">฿{priceCalculation.total}.-</span>
                            </div>
                        </div>

                        {/* Primary Order Action (Front-End) */}
                        <button
                            type="button"
                            onClick={handleOrderKeychain}
                            className="w-full py-3 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-xs font-bold uppercase tracking-wider hover:bg-[oklch(52%_0.16_28)] transition-colors cursor-pointer border border-[oklch(18%_0.012_28)] text-center shadow-xs"
                        >
                            [ สั่งทำพวงกุญแจ ฿{priceCalculation.total} // ADD TO CART ]
                        </button>

                        {/* ADMIN-ONLY 3D EXPORT TOOLS (.STL / .STEP) */}
                        {isAdmin && (
                            <div className="p-2.5 bg-[oklch(52%_0.16_28)]/10 border border-[oklch(52%_0.16_28)] flex flex-col gap-1.5 font-mono">
                                <div className="flex items-center justify-between text-[10px] text-[oklch(52%_0.16_28)] font-bold uppercase">
                                    <span>[ ADMIN 3D PRINT EXPORTER ]</span>
                                    <span>BAMBU / PRUSA</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={handleExportSTL}
                                        className="py-1.5 bg-[oklch(99%_0.005_28)] border border-[oklch(52%_0.16_28)] hover:bg-[oklch(52%_0.16_28)] hover:text-white font-bold text-[10px] uppercase transition-colors text-center cursor-pointer"
                                    >
                                        [ EXPORT .STL ]
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportSTEP}
                                        className="py-1.5 bg-[oklch(99%_0.005_28)] border border-[oklch(52%_0.16_28)] hover:bg-[oklch(52%_0.16_28)] hover:text-white font-bold text-[10px] uppercase transition-colors text-center cursor-pointer"
                                    >
                                        [ EXPORT .STEP ]
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
