import { describe, it, expect } from 'vitest'
import { generateKeychainTriangles } from '../keychain3dExporter'

describe('keychain3dExporter', () => {
    it('generates 3D solid geometry triangles for 4mm and 5mm cord eyelet', () => {
        const specs4mm = {
            text: 'HAUS',
            length: 68,
            height: 22,
            baseThickness: 2.4,
            letterThickness: 1.6,
            holeDiameter: 4.0,
            eyeletPosition: 'left',
            baseStyle: 'rail'
        }

        const res4mm = generateKeychainTriangles(specs4mm)
        expect(res4mm.triangles).toBeDefined()
        expect(res4mm.triangles.length).toBeGreaterThan(50)
        expect(res4mm.specs.holeDiameter).toBe(4.0)
        expect(res4mm.specs.totalThickness).toBe(4.0)

        // Check 5mm eyelet
        const specs5mm = { ...specs4mm, holeDiameter: 5.0 }
        const res5mm = generateKeychainTriangles(specs5mm)
        expect(res5mm.specs.holeDiameter).toBe(5.0)
        expect(res5mm.specs.actualLength).toBeGreaterThan(res4mm.specs.actualLength)
    })

    it('handles different base styles: rail, capsule, connected', () => {
        ['rail', 'capsule', 'connected'].forEach(baseStyle => {
            const res = generateKeychainTriangles({
                text: 'KEY',
                baseStyle,
                holeDiameter: 4.0
            })
            expect(res.triangles.length).toBeGreaterThan(0)
            res.triangles.forEach(tri => {
                expect(tri.normal).toHaveLength(3)
                expect(tri.v1).toHaveLength(3)
                expect(tri.v2).toHaveLength(3)
                expect(tri.v3).toHaveLength(3)
            })
        })
    })
})
