/* Hallmark · component: HausmadeKeychain3DViewer · theme: Atelier (Dieter Rams + Thai Modern OKLCH)
 * features: Real WebGL 3D Engine (Three.js), PBR Materials, OrbitControls (360° rotation),
 *           Parametric Extruded Plates (Pill, Badge, Rail, Tag) with punched 4mm/5mm eyelets,
 *           Vector Glyph 3D Extrusion (opentype.js), Signature 3D HAUS Flower (✿),
 *           Metallic Split-Ring / Braided Cord Loop, Floating Rams HUD & High-Res PNG Capture.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as opentypeModule from 'opentype.js'

// In-memory cache for parsed opentype fonts
const fontCache = new Map()

// Local bundled font paths (verified & zero-latency)
const LOCAL_FONT_PATHS = {
    'great-vibes': '/fonts/great-vibes.ttf',
    'pacifico': '/fonts/pacifico.ttf',
    'charm': '/fonts/charm.ttf',
    'sarabun': '/fonts/sarabun.ttf',
    'space-mono': '/fonts/space-mono.ttf',
    'alex-brush': '/fonts/alex-brush.ttf',
    'dancing-script': '/fonts/dancing-script.ttf'
}

// Fallback CDN URLs if local font cannot be loaded
const FONT_TTF_URLS = {
    'great-vibes': 'https://fonts.gstatic.com/s/greatvibes/v21/RWmMoKWR9v4ksMfaWd_JN-XC.ttf',
    'pacifico': 'https://fonts.gstatic.com/s/pacifico/v23/FwZY7-Qmy14u9lezJ96A.ttf',
    'space-mono': 'https://fonts.gstatic.com/s/spacemono/v17/i7dPIFZifjKcF5UAWdDRUEY.ttf',
    'charm': 'https://fonts.gstatic.com/s/charm/v14/7cHmv4oii5K0MeYv.ttf',
    'sarabun': 'https://fonts.gstatic.com/s/sarabun/v17/DtVjJx26TKEr37c9WBI.ttf',
    'alex-brush': 'https://fonts.gstatic.com/s/alexbrush/v23/SZc83FzrJKuqFbwMKk6EtUI.ttf',
    'dancing-script': 'https://fonts.gstatic.com/s/dancingscript/v29/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSoHTQ.ttf'
}

/**
 * Universal safe opentype parser function
 */
function parseOpentypeFont(buffer) {
    const parse = opentypeModule.parse || opentypeModule.default?.parse || opentypeModule.default
    if (typeof parse !== 'function') {
        throw new Error('opentype parse function is unavailable')
    }
    return parse(buffer)
}

/**
 * Load and parse TTF font with opentype.js
 */
async function loadOpentypeFont(fontId, customArrayBuffer = null, text = '') {
    if (customArrayBuffer) {
        try {
            return parseOpentypeFont(customArrayBuffer)
        } catch (e) {
            console.warn('[3D Viewer] Failed to parse custom font buffer:', e)
            return null
        }
    }

    // Auto-detect Thai script: if text contains Thai glyphs and font is Latin-only, use 'charm'
    const hasThai = /[\u0E00-\u0E7F]/.test(text)
    const effectiveFontId = (hasThai && !['charm', 'sarabun'].includes(fontId)) ? 'charm' : (fontId || 'great-vibes')

    if (fontCache.has(effectiveFontId)) {
        return fontCache.get(effectiveFontId)
    }

    // 1. Try local verified font file
    const localPath = LOCAL_FONT_PATHS[effectiveFontId] || `/fonts/${effectiveFontId}.ttf`
    try {
        const res = await fetch(localPath)
        if (res.ok) {
            const buffer = await res.arrayBuffer()
            const font = parseOpentypeFont(buffer)
            fontCache.set(effectiveFontId, font)
            return font
        }
    } catch (err) {
        console.warn(`[3D Viewer] Local font fetch for "${effectiveFontId}" failed, trying CDN fallback:`, err)
    }

    // 2. Try online CDN fallback
    const cdnUrl = FONT_TTF_URLS[effectiveFontId] || FONT_TTF_URLS['great-vibes']
    try {
        const res = await fetch(cdnUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buffer = await res.arrayBuffer()
        const font = parseOpentypeFont(buffer)
        fontCache.set(effectiveFontId, font)
        return font
    } catch (err) {
        console.error(`[3D Viewer] All font loading attempts failed for "${effectiveFontId}":`, err)
        return null
    }
}

/**
 * Convert opentype glyph commands to Three.js ShapePath
 */
function opentypePathToShapes(opentypePath) {
    const shapePath = new THREE.ShapePath()
    opentypePath.commands.forEach(cmd => {
        switch (cmd.type) {
            case 'M':
                shapePath.moveTo(cmd.x, -cmd.y)
                break
            case 'L':
                shapePath.lineTo(cmd.x, -cmd.y)
                break
            case 'Q':
                shapePath.quadraticCurveTo(cmd.x1, -cmd.y1, cmd.x, -cmd.y)
                break
            case 'C':
                shapePath.bezierCurveTo(cmd.x1, -cmd.y1, cmd.x2, -cmd.y2, cmd.x, -cmd.y)
                break
            case 'Z':
                break
        }
    })
    return shapePath.toShapes(true)
}

export default function HausmadeKeychain3DViewer({
    text = 'haus',
    fontId = 'great-vibes',
    customFontBuffer = null,
    baseStyle = 'capsule', // 'capsule' | 'badge' | 'rail' | 'tag'
    holeDiameter = 4.0,    // 4.0 or 5.0 mm
    eyeletPosition = 'left', // 'left' | 'top' | 'right'
    thickness = 4.0,       // mm
    baseColor = '#C84B31',
    letterColor = '#FAF7F3',
    isDualTone = false,
    hasFlower = true,
    hardwareType = 'ring', // 'ring' (metal split-ring) | 'cord' (paracord) | 'none'
    cordColor = '#D2B48C',
    hardwareFinish = 'brass', // 'brass' | 'chrome' | 'carbon'
    onMeshReady = null
}) {
    const containerRef = useRef(null)
    const sceneRef = useRef(null)
    const rendererRef = useRef(null)
    const cameraRef = useRef(null)
    const controlsRef = useRef(null)
    const keychainGroupRef = useRef(null)
    const rafIdRef = useRef(null)

    // Viewer HUD States
    const [isAutoRotate, setIsAutoRotate] = useState(false)
    const [isWireframe, setIsWireframe] = useState(false)
    const [lightingMode, setLightingMode] = useState('atelier') // 'atelier' | 'neutral' | 'darkroom'
    const [isFontLoading, setIsFontLoading] = useState(false)

    // Studio Background Tints
    const studioThemes = {
        atelier: {
            bg: 0xF8F5F0,
            grid: 0xD9CFC4,
            lightKey: 0xFFF5EA,
            lightFill: 0xE8DFD5
        },
        neutral: {
            bg: 0xF0F0F0,
            grid: 0xD0D0D0,
            lightKey: 0xFFFFFF,
            lightFill: 0xE0E0E0
        },
        darkroom: {
            bg: 0x1A1918,
            grid: 0x33302C,
            lightKey: 0xFFE8D6,
            lightFill: 0x443D36
        }
    }

    // 1. Initialize Three.js WebGL Scene
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const width = container.clientWidth || 800
        const height = container.clientHeight || 560

        // Scene
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(studioThemes.atelier.bg)
        sceneRef.current = scene

        // Camera
        const camera = new THREE.PerspectiveCamera(38, width / height, 1, 1000)
        camera.position.set(0, 65, 105)
        cameraRef.current = camera

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
        })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.15
        rendererRef.current = renderer

        // Empty previous canvases
        while (container.firstChild) {
            container.removeChild(container.firstChild)
        }
        container.appendChild(renderer.domElement)

        // OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.07
        controls.maxPolarAngle = Math.PI / 2 - 0.02 // Prevent going completely below floor
        controls.minDistance = 35
        controls.maxDistance = 240
        controls.target.set(0, 0, 0)
        controlsRef.current = controls

        // Lights Setup
        const keyLight = new THREE.DirectionalLight(studioThemes.atelier.lightKey, 2.2)
        keyLight.position.set(45, 80, 55)
        keyLight.castShadow = true
        keyLight.shadow.mapSize.width = 2048
        keyLight.shadow.mapSize.height = 2048
        keyLight.shadow.camera.near = 10
        keyLight.shadow.camera.far = 250
        keyLight.shadow.camera.left = -80
        keyLight.shadow.camera.right = 80
        keyLight.shadow.camera.top = 80
        keyLight.shadow.camera.bottom = -80
        keyLight.shadow.bias = -0.0005
        scene.add(keyLight)

        const fillLight = new THREE.DirectionalLight(studioThemes.atelier.lightFill, 1.1)
        fillLight.position.set(-60, 40, -40)
        scene.add(fillLight)

        const rimLight = new THREE.DirectionalLight(0xFFFFFF, 0.9)
        rimLight.position.set(0, 30, -70)
        scene.add(rimLight)

        const hemiLight = new THREE.HemisphereLight(0xFFFBF7, 0x443D36, 0.85)
        scene.add(hemiLight)

        // Soft Shadow Ground Plane
        const shadowPlaneGeo = new THREE.PlaneGeometry(300, 300)
        const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.18 })
        const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat)
        shadowPlane.rotation.x = -Math.PI / 2
        shadowPlane.position.y = -0.02
        shadowPlane.receiveShadow = true
        scene.add(shadowPlane)

        // Architectural Millimeter Grid Helper
        const gridHelper = new THREE.GridHelper(160, 32, 0xC84B31, studioThemes.atelier.grid)
        gridHelper.position.y = -0.01
        scene.add(gridHelper)

        // Root Keychain Group
        const keychainGroup = new THREE.Group()
        scene.add(keychainGroup)
        keychainGroupRef.current = keychainGroup

        // Animation Loop
        const animate = () => {
            rafIdRef.current = requestAnimationFrame(animate)
            controls.update()
            renderer.render(scene, camera)
        }
        animate()

        // Responsive Resize Handler
        const handleResize = () => {
            if (!container || !renderer || !camera) return
            const w = container.clientWidth
            const h = container.clientHeight
            camera.aspect = w / h
            camera.updateProjectionMatrix()
            renderer.setSize(w, h)
        }

        const resizeObserver = new ResizeObserver(handleResize)
        resizeObserver.observe(container)

        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
            resizeObserver.disconnect()
            renderer.dispose()
            controls.dispose()
        }
    }, [])

    // 2. Update Lighting Theme & Background
    useEffect(() => {
        const scene = sceneRef.current
        if (!scene) return
        const theme = studioThemes[lightingMode] || studioThemes.atelier
        scene.background = new THREE.Color(theme.bg)
    }, [lightingMode])

    // 3. Update Auto-Rotate
    useEffect(() => {
        if (controlsRef.current) {
            controlsRef.current.autoRotate = isAutoRotate
            controlsRef.current.autoRotateSpeed = 2.4
        }
    }, [isAutoRotate])

    // 4. Procedural 3D Keychain Geometry Rebuild
    const rebuild3DModel = useCallback(async () => {
        const group = keychainGroupRef.current
        if (!group) return

        // Clear existing children meshes safely
        while (group.children.length > 0) {
            const child = group.children[0]
            group.remove(child)
            if (child.geometry) child.geometry.dispose()
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
                else child.material.dispose()
            }
        }

        setIsFontLoading(true)

        // PBR Material Definitions (Simulating Matte Bio-PLA+ FDM 3D print)
        const baseMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(baseColor),
            roughness: 0.38,
            metalness: 0.04,
            wireframe: isWireframe
        })

        const textHex = isDualTone ? letterColor : '#FAF7F3'
        const letterMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(textHex),
            roughness: 0.34,
            metalness: 0.05,
            wireframe: isWireframe
        })

        // Physical Dimensions in Millimeters
        const safeText = text.trim() || 'HAUS'
        const baseThickness = Number(thickness) * 0.62 // e.g. 2.5mm base plate
        const letterRaiseDepth = Number(thickness) * 0.38 // e.g. 1.5mm raised letter

        // Load opentype font with auto-Thai detection and local cache
        const font = await loadOpentypeFont(fontId, customFontBuffer, safeText)
        setIsFontLoading(false)

        const fontSize = 15 // mm
        let textShapes = []
        let rawTextWidth = 0

        if (font) {
            try {
                // 1. Attempt whole-string vector extraction first (preserves Thai tone mark stacking & cursive ligatures)
                let gPath = null
                try {
                    gPath = font.getPath(safeText, 0, 0, fontSize)
                } catch (bidiErr) {
                    // Fallback if opentype.js encounters unsupported GSUB/CCMP lookup format
                    gPath = null
                }

                if (gPath && gPath.commands && gPath.commands.length > 0) {
                    textShapes = opentypePathToShapes(gPath)
                    // Measure text width from path commands
                    let minX = Infinity
                    let maxX = -Infinity
                    gPath.commands.forEach(cmd => {
                        if (cmd.x !== undefined) {
                            if (cmd.x < minX) minX = cmd.x
                            if (cmd.x > maxX) maxX = cmd.x
                        }
                    })
                    if (isFinite(maxX) && isFinite(minX)) {
                        rawTextWidth = maxX - minX
                    }
                } else {
                    // 2. Fallback: glyph-by-glyph extraction (supports all TTF fonts)
                    const scale = (1 / font.unitsPerEm) * fontSize
                    let curX = 0

                    for (let i = 0; i < safeText.length; i++) {
                        const ch = safeText[i]
                        const glyph = font.charToGlyph(ch)
                        const charPath = glyph.getPath(curX, 0, fontSize)
                        const charShapes = opentypePathToShapes(charPath)
                        textShapes.push(...charShapes)

                        // Thai combining vowels and tone marks stack vertically and do not advance horizontal X
                        const isThaiCombining = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(ch)
                        if (!isThaiCombining) {
                            curX += (glyph.advanceWidth || font.unitsPerEm * 0.55) * scale
                        }
                    }
                    rawTextWidth = curX
                }
            } catch (err) {
                console.warn('[3D Viewer] Glyph extraction error:', err)
            }
        }

        // Compute Extruded Text Geometry & Accurate Dimensions
        let textMesh = null
        let textWidth = rawTextWidth || safeText.length * 11
        let textHeight = fontSize

        if (textShapes.length > 0) {
            const textGeometry = new THREE.ExtrudeGeometry(textShapes, {
                depth: letterRaiseDepth,
                bevelEnabled: true,
                bevelThickness: 0.2,
                bevelSize: 0.15,
                bevelSegments: 2
            })
            textGeometry.rotateX(-Math.PI / 2) // Orient flat on X-Z plane
            textGeometry.center() // Center geometry at (0, 0, 0)
            textGeometry.computeVertexNormals()
            textGeometry.computeBoundingBox()

            const bbox = textGeometry.boundingBox
            textWidth = bbox.max.x - bbox.min.x
            textHeight = bbox.max.z - bbox.min.z

            textMesh = new THREE.Mesh(textGeometry, letterMat)
            textMesh.castShadow = true
            textMesh.receiveShadow = true
        }

        // Determine Plate Dimensions dynamically to guarantee text fits with ample margin
        const flowerExtra = hasFlower ? 18 : 0
        const holeRadius = Number(holeDiameter) / 2
        const wallThickness = 2.6 // robust 3D print boundary
        const outerEyeletRadius = holeRadius + wallThickness

        const minPlateLength = Math.max(50, textWidth + flowerExtra + outerEyeletRadius * 2 + 16)
        const plateLength = Math.min(150, Math.round(minPlateLength))
        const plateHeight = Math.max(24, Math.round(textHeight + 10))

        // Eyelet Lug Placement
        let eyeletHoleX = -plateLength / 2 + outerEyeletRadius + 1.5
        let eyeletHoleY = 0

        if (eyeletPosition === 'right') {
            eyeletHoleX = plateLength / 2 - outerEyeletRadius - 1.5
            eyeletHoleY = 0
        } else if (eyeletPosition === 'top') {
            eyeletHoleX = 0
            eyeletHoleY = plateHeight / 2 - outerEyeletRadius - 1.5
        }

        // World coordinates of the eyelet hole in 3D
        const holeWorldX = eyeletHoleX
        const holeWorldY = baseThickness / 2
        const holeWorldZ = -eyeletHoleY

        // -------------------------------------------------------------
        // A. BUILD 3D BASE PLATE SHAPE WITH CSG PUNCHED HOLE
        // -------------------------------------------------------------
        const plateShape = new THREE.Shape()

        if (baseStyle === 'capsule') {
            // Capsule Pill Shape
            const radius = plateHeight / 2
            const innerW = plateLength - radius * 2
            plateShape.moveTo(-innerW / 2, -radius)
            plateShape.lineTo(innerW / 2, -radius)
            plateShape.absarc(innerW / 2, 0, radius, -Math.PI / 2, Math.PI / 2, false)
            plateShape.lineTo(-innerW / 2, radius)
            plateShape.absarc(-innerW / 2, 0, radius, Math.PI / 2, (3 * Math.PI) / 2, false)
        } else if (baseStyle === 'badge') {
            // Dieter Rams Atelier Chamfered Badge (45 deg beveled corners)
            const halfW = plateLength / 2
            const halfH = plateHeight / 2
            const chamfer = 3.5
            plateShape.moveTo(-halfW + chamfer, -halfH)
            plateShape.lineTo(halfW - chamfer, -halfH)
            plateShape.lineTo(halfW, -halfH + chamfer)
            plateShape.lineTo(halfW, halfH - chamfer)
            plateShape.lineTo(halfW - chamfer, halfH)
            plateShape.lineTo(-halfW + chamfer, halfH)
            plateShape.lineTo(-halfW, halfH - chamfer)
            plateShape.lineTo(-halfW, -halfH + chamfer)
        } else if (baseStyle === 'rail') {
            // Underline Rail Support Beam
            const halfW = plateLength / 2
            const railH = 4.5
            plateShape.moveTo(-halfW, -plateHeight / 2)
            plateShape.lineTo(halfW, -plateHeight / 2)
            plateShape.lineTo(halfW, -plateHeight / 2 + railH)
            plateShape.lineTo(-halfW, -plateHeight / 2 + railH)

            // Backing plate under text
            const textBackH = plateHeight * 0.58
            plateShape.moveTo(-halfW + 2, -plateHeight / 2)
            plateShape.lineTo(halfW - 2, -plateHeight / 2)
            plateShape.lineTo(halfW - 2, -plateHeight / 2 + textBackH)
            plateShape.lineTo(-halfW + 2, -plateHeight / 2 + textBackH)
        } else {
            // Classic Dog Tag (Rounded Corners)
            const halfW = plateLength / 2
            const halfH = plateHeight / 2
            const r = 3.5
            plateShape.moveTo(-halfW + r, -halfH)
            plateShape.lineTo(halfW - r, -halfH)
            plateShape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r)
            plateShape.lineTo(halfW, halfH - r)
            plateShape.quadraticCurveTo(halfW, halfH, halfW - r, halfH)
            plateShape.lineTo(-halfW + r, halfH)
            plateShape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r)
            plateShape.lineTo(-halfW, -halfH + r)
            plateShape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH)
        }

        // Punch cylindrical hole through solid
        const holePath = new THREE.Path()
        holePath.absarc(eyeletHoleX, eyeletHoleY, holeRadius, 0, Math.PI * 2, true)
        plateShape.holes.push(holePath)

        // Extrude Base Plate with Smooth Bevels
        const plateGeometry = new THREE.ExtrudeGeometry(plateShape, {
            depth: baseThickness,
            bevelEnabled: true,
            bevelThickness: 0.6,
            bevelSize: 0.5,
            bevelSegments: 3
        })
        plateGeometry.rotateX(-Math.PI / 2)
        plateGeometry.computeVertexNormals()

        const plateMesh = new THREE.Mesh(plateGeometry, baseMat)
        plateMesh.castShadow = true
        plateMesh.receiveShadow = true
        plateMesh.position.y = 0
        group.add(plateMesh)

        // -------------------------------------------------------------
        // B. POSITION 3D RAISED TEXT MESH (PROPERLY BALANCED ON PLATE)
        // -------------------------------------------------------------
        const minUsableX = (eyeletPosition === 'left' ? eyeletHoleX + outerEyeletRadius + 2.5 : -plateLength / 2 + 4)
        const maxUsableX = (eyeletPosition === 'right' ? eyeletHoleX - outerEyeletRadius - 2.5 : plateLength / 2 - (hasFlower ? 16 : 4))
        const textCenterX = (minUsableX + maxUsableX) / 2

        if (textMesh) {
            // Sit securely fused on plate surface (0.05mm embed for watertight 3D print)
            const textY = baseThickness + letterRaiseDepth / 2 - 0.05
            textMesh.position.set(textCenterX, textY, 0)
            group.add(textMesh)
        }

        // -------------------------------------------------------------
        // C. BUILD 3D SIGNATURE HAUS FLOWER (✿) CHARM
        // -------------------------------------------------------------
        if (hasFlower) {
            const flowerX = textCenterX + textWidth / 2 + 7
            const flowerZ = 0
            const flowerY = baseThickness - 0.02
            const petalCount = 5
            const petalRadius = 1.9
            const petalDist = 3.0
            const petalDepth = letterRaiseDepth * 0.95

            // Radial 5 Petals
            for (let p = 0; p < petalCount; p++) {
                const angle = p * (Math.PI * 2 / petalCount) - Math.PI / 2
                const px = flowerX + Math.cos(angle) * petalDist
                const pz = flowerZ + Math.sin(angle) * petalDist

                const petalGeo = new THREE.CylinderGeometry(petalRadius, petalRadius, petalDepth, 24)
                petalGeo.computeVertexNormals()
                const petalMesh = new THREE.Mesh(petalGeo, letterMat)
                petalMesh.castShadow = true
                petalMesh.position.set(px, flowerY + petalDepth / 2, pz)
                group.add(petalMesh)
            }

            // Central Core Button
            const coreMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(isDualTone ? baseColor : '#C84B31'),
                roughness: 0.32,
                metalness: 0.06
            })
            const coreGeo = new THREE.CylinderGeometry(1.5, 1.5, letterRaiseDepth * 1.1, 24)
            const coreMesh = new THREE.Mesh(coreGeo, coreMat)
            coreMesh.castShadow = true
            coreMesh.position.set(flowerX, flowerY + (letterRaiseDepth * 1.1) / 2, flowerZ)
            group.add(coreMesh)
        }

        // -------------------------------------------------------------
        // D. 3D KEYRING / HARDWARE ACCESSORY (PRECISELY THROUGH THE HOLE)
        // -------------------------------------------------------------
        if (hardwareType === 'ring') {
            // Metallic Split Ring
            const ringFinishColors = {
                brass: { color: 0xD4AF37, metalness: 0.95, roughness: 0.18 },
                chrome: { color: 0xE2E4E6, metalness: 0.98, roughness: 0.12 },
                carbon: { color: 0x242424, metalness: 0.88, roughness: 0.28 }
            }
            const finish = ringFinishColors[hardwareFinish] || ringFinishColors.brass

            const ringMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(finish.color),
                metalness: finish.metalness,
                roughness: finish.roughness
            })

            const ringRadius = 12.0 // mm outer radius
            const tubeRadius = 1.0 // mm wire thickness (standard 2mm split ring wire)
            const ringGeo = new THREE.TorusGeometry(ringRadius, tubeRadius, 24, 64)

            // Ring Pivot positioned EXACTLY at the center of the eyelet hole in 3D
            const ringPivot = new THREE.Group()
            ringPivot.position.set(holeWorldX, holeWorldY, holeWorldZ)

            const ringMesh = new THREE.Mesh(ringGeo, ringMat)
            ringMesh.castShadow = true

            // TorusGeometry is in the local X-Y plane with center at (0, 0, 0).
            // When eyelet is on the left, shift ring mesh by -ringRadius along X,
            // so the point at phi = 0 is at (0, 0, 0) of ringPivot (dead-center in hole)
            // with the tangent vector pointing vertically along the Y-axis.
            // The rest of the ring loops outward and cleanly arches over the bridge.
            if (eyeletPosition === 'right') {
                ringMesh.position.set(ringRadius, 0, 0)
                // Natural aesthetic tilt for studio display
                ringPivot.rotation.set(-0.22, 0, 0.08)
            } else if (eyeletPosition === 'top') {
                ringMesh.rotation.y = Math.PI / 2
                ringMesh.position.set(0, 0, -ringRadius)
                ringPivot.rotation.set(0.08, 0, 0.22)
            } else {
                // 'left' (default)
                ringMesh.position.set(-ringRadius, 0, 0)
                // Natural aesthetic tilt for studio display
                ringPivot.rotation.set(0.22, 0, -0.08)
            }

            ringPivot.add(ringMesh)
            group.add(ringPivot)
        } else if (hardwareType === 'cord') {
            // Braided Paracord 550 Loop
            const cordMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(cordColor),
                roughness: 0.85,
                metalness: 0.02
            })

            const dir = eyeletPosition === 'right' ? 1 : -1
            // Path enters cleanly through the hole, extends vertically out of the top,
            // then loops outward and around the bridge with zero mesh penetration
            const cordCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(holeWorldX, holeWorldY, holeWorldZ - 1.0),
                new THREE.Vector3(holeWorldX, baseThickness + 1.8, holeWorldZ - 1.0),
                new THREE.Vector3(holeWorldX + dir * 6, baseThickness + 2.5, holeWorldZ - 4),
                new THREE.Vector3(holeWorldX + dir * 26, baseThickness + 1.5, holeWorldZ),
                new THREE.Vector3(holeWorldX + dir * 6, baseThickness + 2.5, holeWorldZ + 4),
                new THREE.Vector3(holeWorldX, baseThickness + 1.8, holeWorldZ + 1.0),
                new THREE.Vector3(holeWorldX, holeWorldY, holeWorldZ + 1.0)
            ])

            const cordGeo = new THREE.TubeGeometry(cordCurve, 48, (Number(holeDiameter) * 0.36) / 2, 12, false)
            const cordMesh = new THREE.Mesh(cordGeo, cordMat)
            cordMesh.castShadow = true
            group.add(cordMesh)

            // Knot barrel
            const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1A1918, roughness: 0.4 })
            const barrelGeo = new THREE.CylinderGeometry(2.4, 2.4, 5, 16)
            const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat)
            barrelMesh.rotation.z = Math.PI / 2
            barrelMesh.position.set(holeWorldX + dir * 18, baseThickness + 1.8, holeWorldZ)
            barrelMesh.castShadow = true
            group.add(barrelMesh)
        }

        // Center whole keychain group at scene origin (0, 0, 0)
        group.position.set(0, 0, 0)

        // Notify parent that 3D mesh is ready for STL export
        if (onMeshReady) {
            onMeshReady({
                group,
                plateMesh,
                plateLength,
                plateHeight,
                thickness: Number(thickness)
            })
        }
    }, [
        text,
        fontId,
        customFontBuffer,
        baseStyle,
        holeDiameter,
        eyeletPosition,
        thickness,
        baseColor,
        letterColor,
        isDualTone,
        hasFlower,
        hardwareType,
        cordColor,
        hardwareFinish,
        isWireframe,
        onMeshReady
    ])

    // Trigger rebuild when dependencies change
    useEffect(() => {
        rebuild3DModel()
    }, [rebuild3DModel])

    // Reset Camera to Default Focus
    const handleResetCamera = () => {
        if (!cameraRef.current || !controlsRef.current) return
        cameraRef.current.position.set(0, 65, 105)
        controlsRef.current.target.set(0, 0, 0)
        controlsRef.current.update()
    }

    // High-Resolution 2X PNG Snapshot
    const handleSnapshot = () => {
        const renderer = rendererRef.current
        const scene = sceneRef.current
        const camera = cameraRef.current
        if (!renderer || !scene || !camera) return

        renderer.render(scene, camera)
        const dataUrl = renderer.domElement.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `hausmade_3d_${text.toLowerCase().replace(/\s+/g, '_')}.png`
        a.click()
    }

    return (
        <div className="relative w-full h-[460px] sm:h-[520px] lg:h-[600px] bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] overflow-hidden flex flex-col select-none group">
            {/* 3D WebGL Canvas Viewport */}
            <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Loading Indicator */}
            {isFontLoading && (
                <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-[oklch(18%_0.012_28)]/80 text-[oklch(97%_0.008_28)] font-mono text-[10px] tracking-widest uppercase flex items-center gap-2 backdrop-blur-xs">
                    <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)] animate-ping" />
                    GENERATING 3D VECTORS...
                </div>
            )}

            {/* Top Right: Status Telemetry Badges (Dieter Rams Style) */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 font-mono text-[10px] uppercase">
                <span className="px-2.5 py-1 bg-[oklch(97%_0.008_28)]/90 border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] backdrop-blur-xs hidden sm:inline">
                    PBR WEBGL · 60 FPS
                </span>
                <span className="px-2.5 py-1 bg-[oklch(97%_0.008_28)]/90 border border-[oklch(85%_0.012_28)] text-[oklch(52%_0.16_28)] font-bold backdrop-blur-xs">
                    ⌀ {holeDiameter}.0mm EYELET
                </span>
            </div>

            {/* Bottom Bar: Floating Minimalist Rams HUD Controls */}
            <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none font-mono text-xs">
                {/* Left Controls: Turntable, Reset View, Wireframe */}
                <div className="flex items-center gap-1.5 pointer-events-auto bg-[oklch(97%_0.008_28)]/90 p-1 border border-[oklch(85%_0.012_28)] backdrop-blur-sm shadow-xs">
                    <button
                        type="button"
                        onClick={() => setIsAutoRotate(prev => !prev)}
                        className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                            isAutoRotate
                                ? 'bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)]'
                                : 'hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)]'
                        }`}
                        title="หมุนโมเดล 360° อัตโนมัติ"
                    >
                        [ ⟳ ROTATE ]
                    </button>

                    <button
                        type="button"
                        onClick={handleResetCamera}
                        className="px-2.5 py-1 text-[11px] font-bold uppercase hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] transition-colors cursor-pointer"
                        title="รีเซ็ตมุมมองกล้อง"
                    >
                        [ ⊡ FIT ]
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsWireframe(prev => !prev)}
                        className={`px-2 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                            isWireframe
                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                : 'hover:bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)]'
                        }`}
                        title="แสดงโครงสร้างสามเหลี่ยมโพลีกอน"
                    >
                        [ ⛶ MESH ]
                    </button>
                </div>

                {/* Right Controls: Studio Lighting Preset & Snapshot PNG */}
                <div className="flex items-center gap-1.5 pointer-events-auto bg-[oklch(97%_0.008_28)]/90 p-1 border border-[oklch(85%_0.012_28)] backdrop-blur-sm shadow-xs">
                    <div className="flex items-center text-[10px] uppercase">
                        {['atelier', 'neutral', 'darkroom'].map(mode => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setLightingMode(mode)}
                                className={`px-2 py-1 font-bold cursor-pointer transition-colors ${
                                    lightingMode === mode
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                        : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                }`}
                            >
                                {mode === 'atelier' ? 'ATELIER' : mode === 'neutral' ? 'STUDIO' : 'DARK'}
                            </button>
                        ))}
                    </div>

                    <div className="w-[1px] h-4 bg-[oklch(85%_0.012_28)] mx-0.5" />

                    <button
                        type="button"
                        onClick={handleSnapshot}
                        className="px-2.5 py-1 text-[11px] font-bold uppercase bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-[oklch(52%_0.16_28)] transition-colors cursor-pointer flex items-center gap-1"
                        title="ถ่ายภาพโมเดล 3D แบบ High-Res PNG"
                    >
                        <span>📷 SNAP</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
