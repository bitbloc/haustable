import { describe, it, expect } from 'vitest'
import { buildOrderFlexMessage, formatThaiDateTime } from '../../../api/_orderFlex.js'

const base = {
    shortId: 'T-0001',
    customerName: 'ทดสอบระบบ',
    customerPhone: '0812345678',
    items: [{ name: 'หมูวิหก', qty: 7, unitPrice: 99, options: 'เผ็ดน้อย' }],
    total: 693,
    adminUrl: 'https://inthehaus.co/pos?view=online',
    trackingUrl: 'https://inthehaus.co/track/T-0001',
    altText: 'FOOD PICKUP #T-0001',
}

// Walk the bubble and collect every text / uri, to check LINE's hard rules
function collect(node, out = { texts: [], uris: [] }) {
    if (!node || typeof node !== 'object') return out
    if (node.type === 'text') out.texts.push(node.text)
    if (node.action?.uri) out.uris.push(node.action.uri)
    for (const v of Object.values(node)) {
        if (Array.isArray(v)) v.forEach(c => collect(c, out))
        else if (v && typeof v === 'object') collect(v, out)
    }
    return out
}

describe('LINE order Flex card', () => {
    it('pickup card carries header, items, total and https buttons only', () => {
        const msg = buildOrderFlexMessage({ ...base, kind: 'pickup', when: '2026-11-17T05:30:00Z' })
        expect(msg.type).toBe('flex')
        expect(msg.altText).toBe('FOOD PICKUP #T-0001')
        const { texts, uris } = collect(msg.contents)
        expect(texts).toContain('FOOD PICKUP')
        expect(texts).toContain('ออเดอร์สั่งกลับบ้าน')
        expect(texts).toContain('7×')
        expect(texts).toContain('หมูวิหก')
        expect(texts).toContain('เผ็ดน้อย')
        expect(texts.some(s => s.includes('693'))).toBe(true)
        expect(texts).toContain('17 พ.ย. 12:30 น.')
        expect(formatThaiDateTime('not a date')).toBe('')
        expect(uris).toEqual(['https://inthehaus.co/pos?view=online', 'https://inthehaus.co/track/T-0001'])
    })

    it('never emits an empty text and has no emoji', () => {
        const msg = buildOrderFlexMessage({ ...base, kind: 'pickup', customerName: '', customerPhone: '   ', note: '' })
        const { texts } = collect(msg.contents)
        for (const s of texts) {
            expect(typeof s).toBe('string')
            expect(s.trim().length).toBeGreaterThan(0)
            expect(/\p{Extended_Pictographic}/u.test(s)).toBe(false)
        }
    })

    it('booking card shows reservation time and party size', () => {
        const msg = buildOrderFlexMessage({ ...base, kind: 'dine_in', when: '2026-11-17T12:00:00Z', pax: 4, deposit: 200, total: 693 })
        const { texts } = collect(msg.contents)
        expect(texts).toContain('TABLE BOOKING')
        expect(texts).toContain('เวลาจอง')
        expect(texts).toContain('4 ท่าน')
        expect(texts).toContain('มัดจำ')
    })

    it('drops non-https links instead of breaking the message', () => {
        const msg = buildOrderFlexMessage({ ...base, kind: 'pickup', adminUrl: 'http://localhost:5173/pos', trackingUrl: '', slipUrl: 'javascript:alert(1)' })
        expect(collect(msg.contents).uris).toEqual([])
        expect(msg.contents.footer).toBeUndefined()
    })

    it('caps long orders and the alt text', () => {
        const items = Array.from({ length: 25 }, (_, i) => ({ name: `เมนู ${i + 1}`, qty: 1, unitPrice: 50 }))
        const msg = buildOrderFlexMessage({ ...base, kind: 'pickup', items, altText: 'x'.repeat(1000) })
        const { texts } = collect(msg.contents)
        expect(texts).toContain('และอีก 10 รายการ')
        expect(msg.altText.length).toBeLessThanOrEqual(400)
        expect(JSON.stringify(msg).length).toBeLessThan(30000)
    })
})
