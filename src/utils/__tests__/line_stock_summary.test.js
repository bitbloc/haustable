import { describe, it, expect } from 'vitest'
import {
    quarterText, remainingText, changeText, unitLabel, categoryKey, summarize, buildStockSummaryMessage, buildRestockMessage,
} from '../../../supabase/functions/line-webhook/stockSummary.ts'

const tx = (name, category, change, type, current, extra = {}) => ({
    quantity_change: change,
    transaction_type: type,
    stock_items: { id: name, name, unit: extra.unit || 'bottle', category, current_quantity: current, min_stock_threshold: extra.min || 0, reorder_point: extra.reorder || 0 },
})

function texts(node, out = []) {
    if (!node || typeof node !== 'object') return out
    if (node.type === 'text') out.push(node.text)
    for (const v of Object.values(node)) {
        if (Array.isArray(v)) v.forEach(c => texts(c, out))
        else if (v && typeof v === 'object') texts(v, out)
    }
    return out
}

describe('quarter display', () => {
    it('rounds to the nearest quarter the eye can check', () => {
        expect(quarterText(1.65)).toBe('1 ¾')
        expect(quarterText(0.3)).toBe('¼')
        expect(quarterText(0.5)).toBe('½')
        expect(quarterText(0.1)).toBe('<¼')
        expect(quarterText(2.9)).toBe('3')
        expect(quarterText(3)).toBe('3')
    })

    it('says what is on the shelf', () => {
        expect(remainingText(0, 'bottle')).toBe('หมด')
        expect(remainingText(0.3, 'unit')).toBe('เปิดแล้ว ¼ หน่วย')
        expect(remainingText(1.35, 'box')).toBe('1 กล่อง + เปิด ¼')
        expect(remainingText(1.5, 'box')).toBe('1 กล่อง + เปิด ½')
        expect(remainingText(2, 'pack')).toBe('2 แพ็ค')
        expect(remainingText(1.95, 'bottle')).toBe('2 ขวด')
        expect(changeText(-0.65, 'box')).toBe('-¾ กล่อง')
        expect(changeText(2, 'unit')).toBe('+2 หน่วย')
    })

    it('says a crate of bottles in crates and bottles', () => {
        const singha = { unit: 'crate', pack_unit: 'crate', usage_unit: 'bottle', conversion_factor: 12 }
        expect(remainingText(1.4167, singha)).toBe('17 ขวด (1 ลัง + 5 ขวด)')
        expect(remainingText(0.4167, singha)).toBe('5 ขวด')
        expect(remainingText(5.0002, singha)).toBe('60 ขวด (5 ลัง)')
        expect(changeText(-0.0833, singha)).toBe('-1 ขวด')
        expect(changeText(2, singha)).toBe('+2 ลัง')
        expect(changeText(-1.0833, singha)).toBe('-1 ลัง + 1 ขวด')
        expect(unitLabel('crate')).toBe('ลัง')
    })

    it('speaks Thai units and categories', () => {
        expect(unitLabel('gallon')).toBe('แกลลอน')
        expect(unitLabel('portion')).toBe('สูตร')
        expect(unitLabel('ม้วน')).toBe('ม้วน')
        expect(categoryKey('Homemade').label).toBe('ทำเองในร้าน')
        expect(categoryKey(null).label).toBe('ไม่ระบุหมวด')
        expect(categoryKey('Seasonal').label).toBe('Seasonal')
    })
})

describe('summary card', () => {
    const rows = [
        tx('Asahi Draft', 'bar', 2, 'in', 1.35, { unit: 'unit' }),
        tx('Asahi Draft', 'bar', 0.35, 'set', 1.35, { unit: 'unit' }),
        tx('Asahi Draft', 'bar', -1, 'out', 1.35, { unit: 'unit' }),
        tx('นมข้นจืด', 'bar', -0.65, 'set', 0.85, { unit: 'box', reorder: 1 }),
        tx('น้ำยาเช็ดโต๊ะ', 'supplies', -0.7, 'set', 0.3, { unit: 'unit', min: 0.5 }),
        tx('ทิชชู่', 'supplies', -3, 'out', 0, { unit: 'แพ็ค' }),
    ]

    it('one line per item, grouped in shop order', () => {
        const groups = summarize(rows)
        expect(groups.map(g => g.label)).toEqual(['บาร์', 'ของใช้ในร้าน'])
        expect(groups[0].items.map(i => i.name)).toEqual(['นมข้นจืด', 'Asahi Draft']) // needs attention first
        const asahi = groups[0].items[1]
        expect(asahi.moves).toBe(3)
        expect(asahi.inQty).toBe(2)
        expect(asahi.outQty).toBe(-1)
        expect(asahi.counts).toBe(1)
    })

    it('builds an overview plus one page per category, no emoji, no empty text', () => {
        const msg = buildStockSummaryMessage(rows, 'อัพเดทสต๊อกวันนี้', '17 พฤศจิกายน 2569')
        expect(msg.type).toBe('flex')
        expect(msg.contents.type).toBe('carousel')
        expect(msg.contents.contents).toHaveLength(3)
        const all = texts(msg.contents)
        for (const s of all) {
            expect(String(s).trim().length).toBeGreaterThan(0)
            expect(/\p{Extended_Pictographic}/u.test(s)).toBe(false)
        }
        expect(all).toContain('ต้องดูแล')
        expect(all).toContain('1 หน่วย + เปิด ¼')
        expect(all).toContain('รับเข้า +2 หน่วย · ใช้ -1 หน่วย · นับแล้ว (+¼ หน่วย)')
        expect(all).toContain('เหลือน้อย')
        expect(all).toContain('หมด')
        expect(msg.altText).toContain('ต้องดูแล 3')
    })

    it('handles an empty day and stays inside LINE limits on a big day', () => {
        expect(buildStockSummaryMessage([], 'อัพเดทสต๊อกวันนี้', 'x').contents.type).toBe('bubble')
        const many = Array.from({ length: 400 }, (_, i) => tx(`ของ ${i}`, ['bar', 'sauce', 'veg', 'dry', 'meat'][i % 5], -0.25, 'set', 2))
        const msg = buildStockSummaryMessage(many, 'อัพเดทสต๊อกวันนี้', 'x')
        expect(msg.contents.contents.length).toBeLessThanOrEqual(12)
        expect(new TextEncoder().encode(JSON.stringify(msg.contents)).length).toBeLessThanOrEqual(49000)
    })
})

describe('restock card (stbuy)', () => {
    const item = (name, category, qty, extra = {}) => ({ id: name, name, category, unit: 'bottle', current_quantity: qty, min_stock_threshold: extra.min || 0, reorder_point: extra.reorder || 0 })

    it('lists only what needs buying, grouped by category, most urgent first', () => {
        const msg = buildRestockMessage([
            item('Gin', 'bar', 0),
            item('Tonic', 'bar', 3, { reorder: 4 }),
            item('Rum', 'bar', 1, { min: 2 }),
            item('Vodka', 'bar', 9, { reorder: 2 }),
            item('Pork', 'meat', 0),
        ], 'ของที่ต้องซื้อ (3 วัน)', '24 พฤศจิกายน 2569')
        const all = texts(msg.contents)
        expect(all).not.toContain('Vodka')
        expect(all).toContain('จุดสั่ง 4 ขวด')
        expect(all).toContain('ขั้นต่ำ 2 ขวด')
        expect(all).toContain('ควรสั่ง')
        expect(all.indexOf('Gin')).toBeLessThan(all.indexOf('Rum'))
        expect(all.indexOf('Rum')).toBeLessThan(all.indexOf('Tonic'))
        expect(msg.contents.contents.map(b => b.header.contents[0].text)).toEqual(['บาร์', 'เนื้อสัตว์'])
        expect(msg.altText).toContain('ต้องซื้อ 4 รายการ')
        expect(all.every(t => typeof t === 'string' && t.length > 0)).toBe(true)
        expect(JSON.stringify(msg)).not.toMatch(/\p{Extended_Pictographic}/u)
    })

    it('says so when nothing needs buying', () => {
        const msg = buildRestockMessage([item('Vodka', 'bar', 9, { reorder: 2 })], 'ของที่ต้องซื้อ (24 ชม.)', 'x')
        expect(msg.contents.type).toBe('bubble')
        expect(texts(msg.contents)).toContain('ไม่มีของต้องซื้อ ทุกรายการยังอยู่เหนือจุดสั่ง')
    })
})
