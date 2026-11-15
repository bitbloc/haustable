// Pure helpers for the staff phone remote (/staff/tables/:tableId).
// The phone only adds order_items to a table's open bill through the submit_staff_order RPC;
// closing the bill, payment and receipts stay on the POS terminal.

// Same list the POS and the customer QR page use to route drinks to the bar printer.
export const BAR_CATEGORY_IDS = [
    '7524bb8a-4698-45c6-aa17-d8ccc296f667',
    '912683ef-fdc3-40a3-8dd8-b09507791240',
    'b441665e-2f23-4df3-a11d-63485e1690dc',
    'a2c783fc-975b-4779-b9eb-67391eeafd1f',
    '1983955d-5787-4351-b729-51b95761f125',
    '1407d869-4eed-489e-aeeb-ba7ef19f57bd',
    '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd',
]

const OPEN_STATUSES = ['pending', 'confirmed', 'seated', 'ready']
const SESSION_MAX_AGE_MS = 16 * 60 * 60 * 1000
export const PRINT_OVERDUE_MS = 60 * 1000

/** Kitchen or bar slip: mirrors CustomerOrderLanding's rule so the POS prints on the same printer. */
export function resolveDestination(item) {
    if (BAR_CATEGORY_IDS.includes(item?.category_id || '')) return 'bar'
    if (item?.destination === 'bar' || item?.destination === 'drinks') return 'bar'
    if (item?.destination === 'other') return 'other'
    const options = Array.isArray(item?.selected_options) ? item.selected_options : []
    if (options.some(o => String(o?.name || '').includes('บาร์') || o?.destination === 'bar')) return 'bar'
    return 'kitchen'
}

/** Two cart lines are the same line when the item, its choices and its note all match. */
export function cartLineKey(line) {
    const options = (Array.isArray(line?.selected_options) ? line.selected_options : [])
        .map(o => `${o.group_id ?? o.group_name ?? ''}:${o.choice_id ?? o.name ?? ''}`)
        .sort()
        .join('|')
    return `${line?.id}#${options}`
}

/** Turn what OptionSelectionModal confirms into a compact cart line (safe to keep in sessionStorage). */
export function toCartLine(confirmed) {
    const selected_options = Array.isArray(confirmed?.selected_options) ? confirmed.selected_options : []
    const line = {
        id: confirmed.id,
        name: confirmed.name,
        category_id: confirmed.category_id || null,
        destination: confirmed.destination || null,
        qty: Math.max(1, Number(confirmed.qty || confirmed.quantity || 1)),
        unitPrice: Number(confirmed.totalPricePerUnit ?? confirmed.price ?? 0),
        selected_options,
    }
    return { ...line, key: cartLineKey(line) }
}

export function addCartLine(cart, line) {
    const existing = cart.find(l => l.key === line.key)
    if (!existing) return [...cart, line]
    return cart.map(l => (l.key === line.key ? { ...l, qty: l.qty + line.qty } : l))
}

/** Change a line's quantity by delta; a line that reaches zero leaves the cart. */
export function changeCartQty(cart, key, delta) {
    return cart
        .map(l => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter(l => l.qty > 0)
}

export function cartCount(cart) {
    return cart.reduce((sum, l) => sum + l.qty, 0)
}

export function cartTotal(cart) {
    return cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0)
}

/** Items for submit_staff_order. The server re-prices from the menu; price_at_time is only what the phone showed. */
export function buildOrderItemsPayload(cart) {
    return cart.map(l => ({
        menu_item_id: l.id,
        quantity: l.qty,
        price_at_time: l.unitPrice,
        destination: resolveDestination(l),
        selected_options: l.selected_options,
    }))
}

/**
 * The table's live bill among its open bookings. Same rule as submit_staff_order:
 * open status, under 16 hours old, not an unseated advance reservation; a seated bill wins, then the newest.
 */
export function pickOpenBill(candidates, now = new Date()) {
    const live = (candidates || []).filter(b => {
        if (!b || !OPEN_STATUSES.includes(b.status)) return false
        if (['pending', 'confirmed'].includes(b.status) && (b.booking_type || '') === 'dine_in') return false
        const started = b.booking_time || b.created_at
        if (started && now.getTime() - new Date(started).getTime() > SESSION_MAX_AGE_MS) return false
        return true
    })
    const newestFirst = (a, b) => new Date(b.booking_time || b.created_at || 0) - new Date(a.booking_time || a.created_at || 0)
    return live.filter(b => b.status === 'seated').sort(newestFirst)[0] || live.sort(newestFirst)[0] || null
}

/** Figures the phone can know: item lines and the discount already saved on the bill. Never adds VAT. */
export function billSummary(booking) {
    const items = Array.isArray(booking?.order_items) ? booking.order_items : []
    const subtotal = items.reduce((sum, i) => sum + Number(i.price_at_time || 0) * Number(i.quantity || 0), 0)
    const discount = Math.min(subtotal, Math.max(0, Number(booking?.discount_amount || 0)))
    return {
        itemCount: items.reduce((sum, i) => sum + Number(i.quantity || 0), 0),
        subtotal,
        discount,
        net: subtotal - discount,
    }
}

/** An item the POS has not printed a kitchen/bar slip for yet. */
export function isAwaitingPrint(item) {
    return !item?.kitchen_printed_at
}

/** Waiting for its slip for over a minute: the POS terminal is probably off or offline. */
export function isPrintOverdue(item, now = new Date()) {
    if (!isAwaitingPrint(item) || !item?.created_at) return false
    return now.getTime() - new Date(item.created_at).getTime() > PRINT_OVERDUE_MS
}

const SUBMIT_MESSAGES = {
    NOT_SIGNED_IN: 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่',
    NOT_STAFF: 'บัญชีนี้ไม่มีสิทธิ์สั่งอาหารแทนลูกค้า',
    TABLE_NOT_FOUND: 'ไม่พบโต๊ะนี้',
    EMPTY_ORDER: 'ยังไม่มีรายการในตะกร้า',
    BILL_CLOSED: 'บิลของโต๊ะนี้ถูกปิดไปแล้ว',
    WAITING_APPROVAL: 'บิลนี้รออนุมัติที่เครื่อง POS ก่อน จึงจะสั่งเพิ่มได้',
    ITEM_UNAVAILABLE: 'มีรายการที่หมดหรือถูกปิดขาย',
    CHOICE_UNAVAILABLE: 'มีตัวเลือกที่หมด',
    NOT_INSTALLED: 'ระบบสั่งจากมือถือยังไม่ได้เปิดใช้ในฐานข้อมูล',
    OFFLINE: 'ส่งไม่ได้ เพราะไม่มีสัญญาณอินเทอร์เน็ต รายการยังอยู่ในตะกร้า',
    UNKNOWN: 'ส่งไม่สำเร็จ รายการยังอยู่ในตะกร้า ลองส่งอีกครั้ง',
}

/**
 * Normalise an RPC answer into { ok, code, message, detail, data }.
 * `error` is the supabase-js error (network, missing function); `data` is the function's JSON.
 */
export function readSubmitResult({ data, error }) {
    if (error) {
        const text = `${error.code || ''} ${error.message || ''}`
        let code = 'UNKNOWN'
        if (error.code === 'PGRST202' || /could not find the function/i.test(text)) code = 'NOT_INSTALLED'
        else if (/failed to fetch|network|load failed/i.test(text)) code = 'OFFLINE'
        return { ok: false, code, message: SUBMIT_MESSAGES[code], detail: null, data: null }
    }
    if (data?.success) return { ok: true, code: 'OK', message: '', detail: null, data }
    const code = SUBMIT_MESSAGES[data?.code] ? data.code : 'UNKNOWN'
    const detail = data?.detail || null
    return { ok: false, code, message: detail ? `${SUBMIT_MESSAGES[code]}: ${detail}` : SUBMIT_MESSAGES[code], detail, data: data || null }
}

export function formatBaht(amount) {
    return `฿${Number(amount || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`
}
