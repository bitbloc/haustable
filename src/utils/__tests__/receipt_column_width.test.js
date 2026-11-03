import { describe, it, expect, vi, beforeEach } from 'vitest'

// Encodes a small receipt and returns the printed width of its widest divider line (margin + rule)
async function dividerWidth(printerConfig, tab = 'receipt') {
    vi.resetModules()
    localStorage.setItem('onhaus_printer_config', JSON.stringify(printerConfig))
    const { encodeReceiptData } = await import('../printerHelper')
    const booking = {
        id: 'b1', created_at: '2026-11-03T10:00:00+07:00', booking_type: 'walk_in', status: 'seated', total_amount: 120,
        order_items: [{ quantity: 1, price_at_time: 120, custom_name: 'ข้าวผัด', destination: 'kitchen', menu_items: { name: 'ข้าวผัด' } }]
    }
    const bytes = encodeReceiptData(booking, tab, 'cash', {}, '80mm', { kitchen_categories: [], bar_categories: [] }, 'sunmi')
    const text = Array.from(bytes || [], b => (b === 0x0a ? '\n' : b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '\u0000')).join('')
    const rules = text.split('\n').map(l => l.replace(/^[^ -]*/, '')).filter(l => /-{6,}|(- ){6,}/.test(l) && /^[ -]+$/.test(l))
    return Math.max(...rules.map(l => l.length))
}

describe('receipt column width (80mm)', () => {
    beforeEach(() => localStorage.clear())

    it('keeps the 36-column default centred on the 48-column head', async () => {
        expect(await dividerWidth({ cashier_paper_size: '80mm' })).toBe(42) // 6-space margin + 36
    })

    it('uses the full 48 columns when the cashier printer is set to 48', async () => {
        expect(await dividerWidth({ cashier_paper_size: '80mm', cashier_max_cols: 48 })).toBe(48)
    })

    it('never exceeds the 48-column head, even if a wider value is saved', async () => {
        expect(await dividerWidth({ cashier_paper_size: '80mm', cashier_max_cols: 64 })).toBe(48)
    })

    it('drops the kitchen gutter at full width so kitchen lines do not wrap', async () => {
        expect(await dividerWidth({ kitchen_paper_size: '80mm', kitchen_max_cols: 48 }, 'kitchen')).toBe(48)
        expect(await dividerWidth({ kitchen_paper_size: '80mm' }, 'kitchen')).toBe(38) // 2-space gutter + 36
    })
})
