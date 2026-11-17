/**
 * LINE Flex message for a new online order (food pickup, table booking, Hausmade).
 * Lives in an underscore file so Vercel does not deploy it as its own function.
 *
 * Design: Rams-style receipt card. No emoji, no decoration; hierarchy comes from size,
 * weight and the warm Thai Modern palette (hex approximations of the OKLCH tokens).
 */

const C = {
    ink: '#1E1918',      // --color-ink
    muted: '#5A5452',    // --color-muted
    neutral: '#7C7472',  // --color-neutral
    rule: '#D6CFCC',     // --color-rule
    paper: '#F8F4F2',    // --color-paper
    accent: '#B8432F',   // --color-accent (clay terracotta)
}

const MAX_ITEM_ROWS = 15
const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`
// LINE rejects empty text components; keep every string non-empty and bounded
const t = (v, max = 300) => {
    const s = String(v ?? '').replace(/\s+/g, ' ').trim()
    return (s || '-').slice(0, max)
}
const isHttps = (u) => typeof u === 'string' && /^https:\/\/\S+$/.test(u)

export function formatThaiDateTime(value) {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    const date = d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })
    const time = d.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
    return `${date} ${time} น.`
}

const row = (label, value, opts = {}) => ({
    type: 'box',
    layout: 'baseline',
    spacing: 'md',
    contents: [
        { type: 'text', text: t(label, 40), size: 'sm', color: C.neutral, flex: 3 },
        {
            type: 'text', text: t(value), size: 'sm', color: opts.color || C.ink, flex: 7, wrap: true,
            ...(opts.bold ? { weight: 'bold' } : {}),
        },
    ],
})

const sumRow = (label, value, opts = {}) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
        { type: 'text', text: t(label, 40), size: opts.big ? 'md' : 'sm', color: opts.big ? C.ink : C.neutral, ...(opts.big ? { weight: 'bold' } : {}) },
        { type: 'text', text: t(value, 40), size: opts.big ? 'lg' : 'sm', color: opts.color || C.ink, align: 'end', ...(opts.big ? { weight: 'bold' } : {}) },
    ],
})

const itemRow = (it) => {
    const contents = [{
        type: 'box',
        layout: 'horizontal',
        spacing: 'md',
        contents: [
            { type: 'text', text: `${it.qty}×`, size: 'sm', color: C.neutral, flex: 0 },
            { type: 'text', text: t(it.name, 120), size: 'sm', color: C.ink, flex: 1, wrap: true },
            { type: 'text', text: baht(it.lineTotal), size: 'sm', color: C.ink, flex: 0, align: 'end' },
        ],
    }]
    if (it.options) {
        contents.push({ type: 'text', text: t(it.options, 200), size: 'xs', color: C.neutral, wrap: true, margin: 'xs', offsetStart: '24px' })
    }
    return { type: 'box', layout: 'vertical', contents }
}

/**
 * @param {object} o
 * @param {'pickup'|'dine_in'|'hausmade_pickup'|'hausmade_shipping'|'other'} o.kind
 * @param {string} o.shortId
 * @param {string} o.customerName
 * @param {string} o.customerPhone
 * @param {string} [o.when]           ISO time of pickup / reservation
 * @param {number|string} [o.pax]
 * @param {string} [o.shippingAddress]
 * @param {string} [o.note]
 * @param {Array<{name:string, qty:number, unitPrice:number, options?:string}>} o.items
 * @param {number} o.total
 * @param {number} [o.discount]
 * @param {number} [o.shippingFee]
 * @param {number} [o.deposit]
 * @param {string} [o.adminUrl]
 * @param {string} [o.trackingUrl]
 * @param {string} [o.slipUrl]
 * @param {string} o.altText          plain-text fallback shown in chat lists and notifications
 */
export function buildOrderFlexMessage(o) {
    const KIND = {
        pickup: { tag: 'FOOD PICKUP', title: 'ออเดอร์สั่งกลับบ้าน', whenLabel: 'เวลารับ' },
        dine_in: { tag: 'TABLE BOOKING', title: 'จองโต๊ะทานที่ร้าน', whenLabel: 'เวลาจอง' },
        hausmade_pickup: { tag: 'HAUSMADE', title: 'ออเดอร์ HAUSMADE · รับที่ร้าน', whenLabel: 'เวลารับ' },
        hausmade_shipping: { tag: 'HAUSMADE', title: 'ออเดอร์ HAUSMADE · จัดส่ง', whenLabel: 'เวลา' },
        other: { tag: 'ORDER', title: 'ออเดอร์ใหม่', whenLabel: 'เวลา' },
    }[o.kind] || { tag: 'ORDER', title: 'ออเดอร์ใหม่', whenLabel: 'เวลา' }

    // --- Header
    const header = {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        paddingBottom: '16px',
        backgroundColor: C.paper,
        contents: [
            {
                type: 'box', layout: 'horizontal', contents: [
                    { type: 'text', text: KIND.tag, size: 'xxs', weight: 'bold', color: C.accent, flex: 1 },
                    { type: 'text', text: `#${t(o.shortId, 20)}`, size: 'xxs', weight: 'bold', color: C.neutral, align: 'end', flex: 0 },
                ],
            },
            { type: 'text', text: KIND.title, size: 'lg', weight: 'bold', color: C.ink, margin: 'sm', wrap: true },
        ],
    }

    // --- Details
    const when = formatThaiDateTime(o.when)
    const details = [row('ลูกค้า', o.customerName, { bold: true }), row('โทร', o.customerPhone)]
    if (when) details.push(row(KIND.whenLabel, when, { bold: true, color: C.accent }))
    if (o.pax) details.push(row('จำนวน', `${o.pax} ท่าน`))
    if (o.kind === 'hausmade_shipping' && o.shippingAddress) details.push(row('จัดส่ง', o.shippingAddress))
    if (o.note && o.note !== '-') details.push(row('หมายเหตุ', o.note))

    // --- Items
    const items = (o.items || []).map(i => ({
        name: i.name,
        qty: Number(i.qty) || 1,
        lineTotal: (Number(i.unitPrice) || 0) * (Number(i.qty) || 1),
        options: i.options || '',
    }))
    const shown = items.slice(0, MAX_ITEM_ROWS)
    const itemBoxes = shown.map(itemRow)
    if (items.length > shown.length) {
        itemBoxes.push({ type: 'text', text: `และอีก ${items.length - shown.length} รายการ`, size: 'xs', color: C.neutral })
    }

    // --- Totals
    const totals = []
    if (o.discount > 0) totals.push(sumRow('ส่วนลด', `-${baht(o.discount)}`))
    if (o.kind === 'hausmade_shipping' && o.shippingFee > 0) totals.push(sumRow('ค่าจัดส่ง', baht(o.shippingFee)))
    if (o.kind === 'dine_in' && o.deposit > 0 && o.deposit !== o.total) totals.push(sumRow('มัดจำ', baht(o.deposit)))
    totals.push(sumRow('ยอดสุทธิ', baht(o.total), { big: true }))

    const body = {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        spacing: 'md',
        contents: [
            { type: 'box', layout: 'vertical', spacing: 'sm', contents: details },
            { type: 'separator', margin: 'lg', color: C.rule },
            ...(itemBoxes.length
                ? [{ type: 'box', layout: 'vertical', spacing: 'sm', margin: 'lg', contents: itemBoxes }, { type: 'separator', margin: 'lg', color: C.rule }]
                : []),
            { type: 'box', layout: 'vertical', spacing: 'xs', margin: 'lg', contents: totals },
        ],
    }

    // --- Footer: only https links (LINE rejects the whole message on a bad URI)
    const buttons = []
    if (isHttps(o.adminUrl)) buttons.push({ type: 'button', style: 'primary', color: C.ink, height: 'sm', action: { type: 'uri', label: 'เปิดในระบบ', uri: o.adminUrl } })
    if (isHttps(o.slipUrl)) buttons.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'ดูสลิป', uri: o.slipUrl } })
    if (isHttps(o.trackingUrl)) buttons.push({ type: 'button', style: 'link', color: C.muted, height: 'sm', action: { type: 'uri', label: 'หน้าติดตามออเดอร์', uri: o.trackingUrl } })

    const bubble = {
        type: 'bubble',
        size: 'mega',
        header,
        body,
        ...(buttons.length ? { footer: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px', contents: buttons } } : {}),
        styles: { footer: { separator: true, separatorColor: C.rule } },
    }

    return {
        type: 'flex',
        altText: t(o.altText, 400),
        contents: bubble,
    }
}
