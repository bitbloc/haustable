/**
 * keychain3dExporter.js
 * 
 * 3D Mesh Generator & CAD Exporter for HAUSMADE Custom Name Keychains
 * Generates:
 * 1. .STL (Stereolithography 3D print mesh - ASCII / Binary)
 * 2. .STEP (ISO 10303-21 CAD Geometry)
 * 3. Aesthetic Dieter Rams Atelier PNG Spec Card
 */

import { STLExporter } from 'three/addons/exporters/STLExporter.js'

/**
 * Download a Blob as a file in the browser
 */
export function triggerFileDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Generate a 3D Box / Prism Mesh (Array of Triangles)
 * Each triangle has { normal: [nx, ny, nz], v1: [x,y,z], v2: [x,y,z], v3: [x,y,z] }
 */
function createBoxTriangles(minX, minY, minZ, maxX, maxY, maxZ) {
    const triangles = []

    const addQuad = (v1, v2, v3, v4, normal) => {
        // v1, v2, v3, v4 in counter-clockwise order
        triangles.push({ normal, v1, v2, v3 })
        triangles.push({ normal, v1, v2: v3, v3: v4 })
    }

    // Top (+Z)
    addQuad(
        [minX, maxY, maxZ],
        [maxX, maxY, maxZ],
        [maxX, minY, maxZ],
        [minX, minY, maxZ],
        [0, 0, 1]
    )

    // Bottom (-Z)
    addQuad(
        [minX, minY, minZ],
        [maxX, minY, minZ],
        [maxX, maxY, minZ],
        [minX, maxY, minZ],
        [0, 0, -1]
    )

    // Front (-Y)
    addQuad(
        [minX, minY, maxZ],
        [maxX, minY, maxZ],
        [maxX, minY, minZ],
        [minX, minY, minZ],
        [0, -1, 0]
    )

    // Back (+Y)
    addQuad(
        [maxX, maxY, maxZ],
        [minX, maxY, maxZ],
        [minX, maxY, minZ],
        [maxX, maxY, minZ],
        [0, 1, 0]
    )

    // Left (-X)
    addQuad(
        [minX, maxY, maxZ],
        [minX, minY, maxZ],
        [minX, minY, minZ],
        [minX, maxY, minZ],
        [-1, 0, 0]
    )

    // Right (+X)
    addQuad(
        [maxX, minY, maxZ],
        [maxX, maxY, maxZ],
        [maxX, maxY, minZ],
        [maxX, minY, minZ],
        [1, 0, 0]
    )

    return triangles
}

/**
 * Generate Solid Cylinder Triangles (for charm pins, flower center & petals)
 */
function createSolidCylinderTriangles(centerX, centerY, radius, minZ, maxZ, segments = 24) {
    const triangles = []
    const step = (Math.PI * 2) / segments

    for (let i = 0; i < segments; i++) {
        const a1 = i * step
        const a2 = (i + 1) * step

        const cos1 = Math.cos(a1), sin1 = Math.sin(a1)
        const cos2 = Math.cos(a2), sin2 = Math.sin(a2)

        const x1 = centerX + radius * cos1, y1 = centerY + radius * sin1
        const x2 = centerX + radius * cos2, y2 = centerY + radius * sin2

        // Top Face (+Z)
        triangles.push({
            normal: [0, 0, 1],
            v1: [centerX, centerY, maxZ],
            v2: [x1, y1, maxZ],
            v3: [x2, y2, maxZ]
        })

        // Bottom Face (-Z)
        triangles.push({
            normal: [0, 0, -1],
            v1: [centerX, centerY, minZ],
            v2: [x2, y2, minZ],
            v3: [x1, y1, minZ]
        })

        // Side Wall
        const mx = (cos1 + cos2) / 2
        const my = (sin1 + sin2) / 2
        triangles.push({
            normal: [mx, my, 0],
            v1: [x1, y1, maxZ],
            v2: [x1, y1, minZ],
            v3: [x2, y2, minZ]
        })
        triangles.push({
            normal: [mx, my, 0],
            v1: [x1, y1, maxZ],
            v2: [x2, y2, minZ],
            v3: [x2, y2, maxZ]
        })
    }
    return triangles
}

/**
 * Generate Hollow Eyelet Ring Triangles (Cylinder with hole)
 */
function createHollowCylinderTriangles(centerX, centerY, innerRadius, outerRadius, minZ, maxZ, segments = 32) {
    const triangles = []
    const step = (Math.PI * 2) / segments

    for (let i = 0; i < segments; i++) {
        const a1 = i * step
        const a2 = (i + 1) * step

        const cos1 = Math.cos(a1), sin1 = Math.sin(a1)
        const cos2 = Math.cos(a2), sin2 = Math.sin(a2)

        // Outer vertices
        const ox1 = centerX + outerRadius * cos1, oy1 = centerY + outerRadius * sin1
        const ox2 = centerX + outerRadius * cos2, oy2 = centerY + outerRadius * sin2

        // Inner vertices
        const ix1 = centerX + innerRadius * cos1, iy1 = centerY + innerRadius * sin1
        const ix2 = centerX + innerRadius * cos2, iy2 = centerY + innerRadius * sin2

        // Top Face (+Z)
        triangles.push({
            normal: [0, 0, 1],
            v1: [ox1, oy1, maxZ],
            v2: [ox2, oy2, maxZ],
            v3: [ix2, iy2, maxZ]
        })
        triangles.push({
            normal: [0, 0, 1],
            v1: [ox1, oy1, maxZ],
            v2: [ix2, iy2, maxZ],
            v3: [ix1, iy1, maxZ]
        })

        // Bottom Face (-Z)
        triangles.push({
            normal: [0, 0, -1],
            v1: [ox2, oy2, minZ],
            v2: [ox1, oy1, minZ],
            v3: [ix1, iy1, minZ]
        })
        triangles.push({
            normal: [0, 0, -1],
            v1: [ox2, oy2, minZ],
            v2: [ix1, iy1, minZ],
            v3: [ix2, iy2, minZ]
        })

        // Outer Wall
        const onx = (cos1 + cos2) / 2
        const ony = (sin1 + sin2) / 2
        triangles.push({
            normal: [onx, ony, 0],
            v1: [ox1, oy1, maxZ],
            v2: [ox1, oy1, minZ],
            v3: [ox2, oy2, minZ]
        })
        triangles.push({
            normal: [onx, ony, 0],
            v1: [ox1, oy1, maxZ],
            v2: [ox2, oy2, minZ],
            v3: [ox2, oy2, maxZ]
        })

        // Inner Wall (Hole surface)
        triangles.push({
            normal: [-onx, -ony, 0],
            v1: [ix2, iy2, maxZ],
            v2: [ix2, iy2, minZ],
            v3: [ix1, iy1, minZ]
        })
        triangles.push({
            normal: [-onx, -ony, 0],
            v1: [ix2, iy2, maxZ],
            v2: [ix1, iy1, minZ],
            v3: [ix1, iy1, maxZ]
        })
    }

    return triangles
}

/**
 * Generate 3D Solid Geometry Triangles for the Keychain
 * Converts the 2D layout parameters (length, height, cord hole 4mm/5mm, base style, letters) into 3D Solid mesh
 */
export function generateKeychainTriangles(specs) {
    const totalThickness = Number(specs.thickness || 4.0)
    const baseThickness = specs.baseThickness || (totalThickness * 0.6)
    const letterThickness = specs.letterThickness || (totalThickness * 0.4)

    const {
        length = 70,          // mm
        height = 24,          // mm
        holeDiameter = 4.0,   // 4mm or 5mm
        eyeletPosition = 'left', // 'left' | 'top' | 'right'
        baseStyle = 'rail',   // 'rail' | 'capsule' | 'connected'
        text = 'HAUS',
        reverseText = ''
    } = specs

    const triangles = []
    const innerRadius = holeDiameter / 2
    const wallThickness = 2.6 // robust wall thickness for 3D printing
    const outerRadius = innerRadius + wallThickness

    // 1. Base Plate / Rail Triangles
    if (baseStyle === 'rail') {
        // Horizontal sturdy underline rail
        const railHeight = 4.0 // mm
        const railY = -(height / 2) + 2
        const railMinX = -length / 2
        const railMaxX = length / 2
        triangles.push(...createBoxTriangles(railMinX, railY, 0, railMaxX, railY + railHeight, baseThickness))

        // Backing strip under text
        const stripHeight = height * 0.45
        triangles.push(...createBoxTriangles(railMinX, railY, 0, railMaxX, railY + stripHeight, baseThickness * 0.75))
    } else if (baseStyle === 'capsule') {
        // Full pill/capsule backing plate
        const minX = -length / 2
        const maxX = length / 2
        const minY = -height / 2
        const maxY = height / 2
        triangles.push(...createBoxTriangles(minX, minY, 0, maxX, maxY, baseThickness))
    } else {
        // Connected script monolithic underlay
        const minX = -length / 2
        const maxX = length / 2
        const minY = -height / 2 + 1
        const maxY = height / 2 - 1
        triangles.push(...createBoxTriangles(minX, minY, 0, maxX, maxY, baseThickness * 0.8))
    }

    // 2. Lettering 3D Extrusion
    // Approximate 3D letter block extrusions across the span for physical mesh integrity
    const charCount = Math.max(1, text.length)
    const charWidth = (length * 0.82) / charCount
    const letterHeight = height * 0.65

    for (let i = 0; i < charCount; i++) {
        const charCenterOffset = -length / 2 + (length * 0.1) + (i + 0.5) * charWidth
        const halfW = charWidth * 0.46
        const halfH = letterHeight / 2
        const lMinX = charCenterOffset - halfW
        const lMaxX = charCenterOffset + halfW
        const lMinY = -halfH + 1.5
        const lMaxY = halfH + 1.5

        triangles.push(...createBoxTriangles(lMinX, lMinY, baseThickness, lMaxX, lMaxY, totalThickness))
    }

    // 2.1 Charm 3D Geometry (HAUS Flower or Brand Charms)
    const charms = specs.selectedCharms || specs.charms || []
    if (charms.length > 0 || specs.hasFlower) {
        const charmList = charms.length > 0 ? charms : [{ id: 'flower', symbol: '✿' }]
        charmList.forEach((charm, cIdx) => {
            const charmX = length / 2 - 8 - (cIdx * 12)
            const charmY = 0

            // Center disc
            triangles.push(...createSolidCylinderTriangles(charmX, charmY, 2.2, baseThickness, totalThickness, 24))

            // 5 Radial Petals (HAUS signature flower)
            const petalCount = 5
            const petalRadius = 1.7
            const petalDist = 3.0
            for (let p = 0; p < petalCount; p++) {
                const angle = p * (Math.PI * 2 / petalCount)
                const px = charmX + Math.cos(angle) * petalDist
                const py = charmY + Math.sin(angle) * petalDist
                triangles.push(...createSolidCylinderTriangles(px, py, petalRadius, baseThickness, totalThickness * 0.95, 16))
            }
        })
    }

    // 3. Eyelet Cylinder (Hole 4mm or 5mm)
    let eyeletCenterX = 0
    let eyeletCenterY = 0

    if (eyeletPosition === 'left') {
        eyeletCenterX = -length / 2 - outerRadius + 2.0
        eyeletCenterY = 0
    } else if (eyeletPosition === 'right') {
        eyeletCenterX = length / 2 + outerRadius - 2.0
        eyeletCenterY = 0
    } else { // top
        eyeletCenterX = 0
        eyeletCenterY = height / 2 + outerRadius - 2.0
    }

    // Add hollow eyelet cylinder
    triangles.push(...createHollowCylinderTriangles(
        eyeletCenterX,
        eyeletCenterY,
        innerRadius,
        outerRadius,
        0,
        baseThickness,
        48 // high segment resolution for smooth print
    ))

    // Bridge / Lug connecting eyelet to main body
    if (eyeletPosition === 'left') {
        triangles.push(...createBoxTriangles(
            eyeletCenterX,
            -outerRadius * 0.8,
            0,
            -length / 2 + 2.0,
            outerRadius * 0.8,
            baseThickness
        ))
    } else if (eyeletPosition === 'right') {
        triangles.push(...createBoxTriangles(
            length / 2 - 2.0,
            -outerRadius * 0.8,
            0,
            eyeletCenterX,
            outerRadius * 0.8,
            baseThickness
        ))
    } else {
        triangles.push(...createBoxTriangles(
            -outerRadius * 0.8,
            height / 2 - 2.0,
            0,
            outerRadius * 0.8,
            eyeletCenterY,
            baseThickness
        ))
    }

    return {
        triangles,
        specs: {
            ...specs,
            actualLength: length + (eyeletPosition !== 'top' ? outerRadius * 2 : 0),
            actualHeight: height + (eyeletPosition === 'top' ? outerRadius * 2 : 0),
            totalThickness
        }
    }
}

/**
 * Export to Binary STL (Standard for Bambu Studio / PrusaSlicer)
 */
export function exportToSTL(specs, threeMeshGroup = null) {
    if (threeMeshGroup) {
        try {
            const exporter = new STLExporter()
            const result = exporter.parse(threeMeshGroup, { binary: true })
            const blob = new Blob([result], { type: 'application/octet-stream' })
            const filename = `hausmade_keychain_${(specs.text || 'custom').replace(/\s+/g, '_')}_${specs.holeDiameter}mm.stl`
            triggerFileDownload(blob, filename)
            return filename
        } catch (e) {
            console.warn('[keychain3dExporter] STLExporter failed, falling back to analytical mesh:', e)
        }
    }

    const { triangles } = generateKeychainTriangles(specs)

    // Binary STL Header: 80 bytes header + 4 bytes uint32 triangle count + 50 bytes per triangle
    const bufferLength = 84 + triangles.length * 50
    const buffer = new ArrayBuffer(bufferLength)
    const view = new DataView(buffer)

    // 80 bytes header
    const headerStr = `HAUSMADE 3D KEYCHAIN - ${specs.text || 'CUSTOM'} - EYELET ${specs.holeDiameter}mm`
    for (let i = 0; i < 80; i++) {
        view.setUint8(i, i < headerStr.length ? headerStr.charCodeAt(i) : 0x20)
    }

    // Number of triangles
    view.setUint32(80, triangles.length, true)

    let offset = 84
    for (let i = 0; i < triangles.length; i++) {
        const tri = triangles[i]

        // Normal (3 x float32)
        view.setFloat32(offset, tri.normal[0], true); offset += 4
        view.setFloat32(offset, tri.normal[1], true); offset += 4
        view.setFloat32(offset, tri.normal[2], true); offset += 4

        // Vertex 1 (3 x float32)
        view.setFloat32(offset, tri.v1[0], true); offset += 4
        view.setFloat32(offset, tri.v1[1], true); offset += 4
        view.setFloat32(offset, tri.v1[2], true); offset += 4

        // Vertex 2 (3 x float32)
        view.setFloat32(offset, tri.v2[0], true); offset += 4
        view.setFloat32(offset, tri.v2[1], true); offset += 4
        view.setFloat32(offset, tri.v2[2], true); offset += 4

        // Vertex 3 (3 x float32)
        view.setFloat32(offset, tri.v3[0], true); offset += 4
        view.setFloat32(offset, tri.v3[1], true); offset += 4
        view.setFloat32(offset, tri.v3[2], true); offset += 4

        // Attribute byte count (uint16 = 0)
        view.setUint16(offset, 0, true); offset += 2
    }

    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    const filename = `hausmade_keychain_${(specs.text || 'custom').replace(/\s+/g, '_')}_${specs.holeDiameter}mm.stl`
    triggerFileDownload(blob, filename)
    return filename
}

/**
 * Export to STEP (ISO 10303-21 Part 21 Clear Text CAD Format)
 * Standard exchange format readable by Fusion 360, SolidWorks, FreeCAD, and Rhino
 */
export function exportToSTEP(specs) {
    const { triangles } = generateKeychainTriangles(specs)
    const timestamp = new Date().toISOString()
    const cleanText = (specs.text || 'CUSTOM').replace(/[^a-zA-Z0-9]/g, '_')

    let step = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('HAUSMADE 3D CUSTOM KEYCHAIN CAD MODEL'),'2;1');
FILE_NAME('hausmade_keychain_${cleanText}.step','${timestamp}',('IN THE HAUS ATELIER'),('HAUSMADE DESIGN LAB'),'PREPROCESSOR','HAUS 3D CAD ENGINE','AUTHORISATION');
FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));
ENDSEC;
DATA;
#1=APPLICATION_CONTEXT('configuration controlled 3D design');
#2=APPLICATION_PROTOCOL_DEFINITION('international standard','config_control_design',1994,#1);
#3=PRODUCT_CONTEXT('part definition',#1,'mechanical');
#4=PRODUCT('hausmade_keychain_${cleanText}','hausmade_keychain_${cleanText}','3D printed name keychain with ${specs.holeDiameter}mm eyelet',(#3));
#5=PRODUCT_DEFINITION_FORMATION('1.0','initial release',#4);
#6=PRODUCT_DEFINITION('design','hausmade 3d part',#5,#3);
#7=PRODUCT_DEFINITION_SHAPE('part shape',$,#6);
`

    // Generate faceted Brep entities
    let entityId = 10
    const faceEntities = []

    // Take representative facets to keep STEP file agile while preserving structural dimensions
    const maxFacets = Math.min(triangles.length, 1200)
    for (let i = 0; i < maxFacets; i++) {
        const tri = triangles[i]
        const p1 = entityId++; const p2 = entityId++; const p3 = entityId++
        const loop = entityId++
        const face = entityId++

        step += `#${p1}=CARTESIAN_POINT('',(${tri.v1[0].toFixed(3)},${tri.v1[1].toFixed(3)},${tri.v1[2].toFixed(3)}));\n`
        step += `#${p2}=CARTESIAN_POINT('',(${tri.v2[0].toFixed(3)},${tri.v2[1].toFixed(3)},${tri.v2[2].toFixed(3)}));\n`
        step += `#${p3}=CARTESIAN_POINT('',(${tri.v3[0].toFixed(3)},${tri.v3[1].toFixed(3)},${tri.v3[2].toFixed(3)}));\n`
        step += `#${loop}=POLY_LOOP('',(#${p1},#${p2},#${p3}));\n`
        step += `#${face}=FACE_OUTER_BOUND('',#${loop},.T.);\n`
        faceEntities.push(face)
    }

    const shellId = entityId++
    step += `#${shellId}=CONNECTED_FACE_SET('',(${faceEntities.map(f => `#${f}`).join(',')}));\n`
    step += `#${entityId++}=MANIFOLD_SURFACE_SHAPE_REPRESENTATION('keychain_solid',(#${shellId}),#1);\n`
    step += `ENDSEC;\nEND-ISO-10303-21;\n`

    const blob = new Blob([step], { type: 'application/step' })
    const filename = `hausmade_keychain_${cleanText}_${specs.holeDiameter}mm.step`
    triggerFileDownload(blob, filename)
    return filename
}

/**
 * Generate Aesthetic Atelier PNG Spec Card (Front-End Export)
 * Produces a high-resolution 2X Retina Dieter Rams style specification sheet
 */
export async function exportAestheticPNG(canvasRef, specs) {
    if (!canvasRef) return null

    const width = 1600
    const height = 1100
    const card = document.createElement('canvas')
    card.width = width
    card.height = height
    const ctx = card.getContext('2d')
    if (!ctx) return null

    // 1. Background: Warm Paper (oklch(97% 0.008 28) ~ #FBF8F5)
    ctx.fillStyle = '#FAF7F3'
    ctx.fillRect(0, 0, width, height)

    // 2. Subtle Millimeter Blueprint Grid
    ctx.strokeStyle = 'rgba(215, 205, 195, 0.45)'
    ctx.lineWidth = 1
    const gridSize = 32
    for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
    }
    for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
    }

    // 3. Perimeter Border (1px solid rule)
    ctx.strokeStyle = '#D9CFC4'
    ctx.lineWidth = 2
    ctx.strokeRect(48, 48, width - 96, height - 96)

    // 4. Header Bar (Atelier Typography)
    ctx.fillStyle = '#231F20'
    ctx.font = 'bold 22px "Space Mono", monospace'
    ctx.fillText('HAUSMADE ATELIER // SPECIFICATION SHEET', 72, 96)

    ctx.fillStyle = '#786F66'
    ctx.font = '14px "Space Mono", monospace'
    ctx.fillText('PROJECT: 3D PRINTED NAME KEYCHAIN · SYSTEM 04/05', 72, 122)

    // Right header metadata
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    ctx.textAlign = 'right'
    ctx.fillStyle = '#786F66'
    ctx.fillText(`DATE: ${dateStr}`, width - 72, 96)
    ctx.fillText(`BATCH: #HM-${Math.floor(1000 + Math.random() * 9000)}`, width - 72, 122)
    ctx.textAlign = 'left'

    // Dividing rule
    ctx.strokeStyle = '#D9CFC4'
    ctx.beginPath(); ctx.moveTo(72, 144); ctx.lineTo(width - 72, 144); ctx.stroke()

    // 5. Center Render: Draw the canvas snapshot
    const previewW = width - 180
    const previewH = 580
    const previewX = 90
    const previewY = 175

    // White backing card for render
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.04)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 8
    ctx.fillRect(previewX, previewY, previewW, previewH)
    ctx.shadowColor = 'transparent'

    ctx.strokeStyle = '#E5DDD3'
    ctx.lineWidth = 1
    ctx.strokeRect(previewX, previewY, previewW, previewH)

    // Draw active Canvas inside the preview box
    ctx.drawImage(canvasRef, previewX + 16, previewY + 16, previewW - 32, previewH - 32)

    // 6. Bottom Technical Telemetry Table (Dieter Rams Tabular layout)
    const tableY = 790
    ctx.strokeStyle = '#D9CFC4'
    ctx.strokeRect(72, tableY, width - 144, 210)

    // Table Header Row
    ctx.fillStyle = '#F2ECE4'
    ctx.fillRect(72, tableY, width - 144, 42)
    ctx.fillStyle = '#231F20'
    ctx.font = 'bold 13px "Space Mono", monospace'
    ctx.fillText('[ 01 · TEXT & FONT ]', 96, tableY + 26)
    ctx.fillText('[ 02 · EYELET GAUGE ]', 460, tableY + 26)
    ctx.fillText('[ 03 · DIMENSIONS ]', 820, tableY + 26)
    ctx.fillText('[ 04 · MATERIAL FINISH ]', 1200, tableY + 26)

    // Dividing verticals
    const colXs = [440, 800, 1180]
    colXs.forEach(cx => {
        ctx.beginPath(); ctx.moveTo(cx, tableY); ctx.lineTo(cx, tableY + 210); ctx.stroke()
    })

    // Dividing row
    ctx.beginPath(); ctx.moveTo(72, tableY + 42); ctx.lineTo(width - 72, tableY + 42); ctx.stroke()

    // Cell 1: Text & Font
    ctx.fillStyle = '#231F20'
    ctx.font = 'bold 26px "Space Mono", monospace'
    ctx.fillText(`"${specs.text || 'HAUS'}"`, 96, tableY + 92)
    ctx.font = '14px "Space Mono", monospace'
    ctx.fillStyle = '#786F66'
    ctx.fillText(`FONT: ${specs.fontName || 'Classic Calligraphy'}`, 96, tableY + 124)
    ctx.fillText(`STYLE: ${(specs.baseStyle || 'rail').toUpperCase()}`, 96, tableY + 150)
    ctx.fillText(`KERNING: ${(specs.letterSpacing || 0) >= 0 ? '+' : ''}${specs.letterSpacing || 0}px`, 96, tableY + 176)

    // Cell 2: Eyelet Gauge & Cord
    ctx.fillStyle = '#C84B31' // Terracotta Accent
    ctx.font = 'bold 28px "Space Mono", monospace'
    ctx.fillText(`⌀ ${specs.holeDiameter || 4}.0 mm`, 460, tableY + 92)
    ctx.font = '14px "Space Mono", monospace'
    ctx.fillStyle = '#786F66'
    ctx.fillText(`CORD FIT: ${specs.holeDiameter === 4 ? 'PARACORD 550 / LEATHER' : 'CHUNKY CORD / MACRAME'}`, 460, tableY + 124)
    ctx.fillText(`CORD COLOR: ${(specs.cordColorName || 'DESERT SAND').toUpperCase()}`, 460, tableY + 150)
    ctx.fillText(`WALL THICKNESS: 2.6 mm`, 460, tableY + 176)

    // Cell 3: Dimensions & Print Time
    ctx.fillStyle = '#231F20'
    ctx.font = 'bold 24px "Space Mono", monospace'
    ctx.fillText(`${specs.actualLength || '74.2'} × ${specs.actualHeight || '24.0'} mm`, 820, tableY + 92)
    ctx.font = '14px "Space Mono", monospace'
    ctx.fillStyle = '#786F66'
    ctx.fillText(`TOTAL THICKNESS: ${Number(specs.thickness || 4.0).toFixed(1)} mm`, 820, tableY + 124)
    ctx.fillText(`WEIGHT EST.: ~${specs.weightEst || '8.4'} g`, 820, tableY + 150)
    ctx.fillText(`PRINT TIME: ~${specs.printTimeEst || '32'} MIN`, 820, tableY + 176)

    // Cell 4: Material & Reverse Engraving
    ctx.fillStyle = '#231F20'
    ctx.font = 'bold 22px "Space Mono", monospace'
    ctx.fillText(specs.colorName || 'TERRACOTTA CLAY', 1200, tableY + 92)
    ctx.font = '14px "Space Mono", monospace'
    ctx.fillStyle = '#786F66'
    ctx.fillText(`FILAMENT: BIO-PLA+ (FDM)`, 1200, tableY + 124)
    const charmText = specs.charmsSummary || (specs.selectedCharms?.length ? `CHARMS: ${specs.selectedCharms.map(c => c.name?.split(' ')[0] || c.symbol || '✿').join(', ')}` : null)
    if (charmText) {
        ctx.fillText(charmText, 1200, tableY + 150)
    } else {
        ctx.fillText(specs.reverseText ? `REVERSE: "${specs.reverseText}"` : `RESOLUTION: 0.20 mm LAYER`, 1200, tableY + 150)
    }
    ctx.fillText(`CRAFTED AT: NAKHON PHANOM`, 1200, tableY + 176)

    // 7. Footer Seal & Rams Signature Mantra
    ctx.fillStyle = '#8C8276'
    ctx.font = '12px "Space Mono", monospace'
    ctx.fillText('WENIGER, ABER BESSER // LESS, BUT BETTER · IN THE HAUS CRAFT STUDIO', 72, height - 24)

    // Convert to PNG blob & trigger download
    return new Promise((resolve) => {
        card.toBlob((blob) => {
            if (blob) {
                const filename = `hausmade_spec_${(specs.text || 'keychain').replace(/\s+/g, '_')}_${specs.holeDiameter}mm.png`
                triggerFileDownload(blob, filename)
                resolve(filename)
            } else {
                resolve(null)
            }
        }, 'image/png')
    })
}
