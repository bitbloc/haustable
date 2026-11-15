/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useMenuData } from '../hooks/useMenuData'
import { useStaffBill } from '../hooks/useStaffBill'
import OptionSelectionModal from '../components/shared/OptionSelectionModal'
import { formatOrderItemOptions } from '../utils/menuHelper'
import {
    toCartLine, addCartLine, changeCartQty, cartCount, cartTotal,
    buildOrderItemsPayload, readSubmitResult, formatBaht,
} from '../utils/staffOrder'
import '../StaffDashboard.css'
import './StaffRemote.css'

const OPTION_LABELS = {
    specialNote: 'หมายเหตุถึงครัว',
    optional: 'ไม่บังคับ',
    notePlaceholder: 'เช่น เผ็ดน้อย ไม่ใส่ผักชี',
    quantity: 'จำนวน',
    addToOrder: 'ใส่ตะกร้า',
    required: 'ต้องเลือก',
    pickOne: 'เลือก 1',
    pickMax: 'เลือกได้หลายอย่าง', // the sheet prints "0" for groups with no limit; the limit itself is still enforced
    toastMax: 'เลือกได้สูงสุด {n} อย่าง',
    soldOut: 'หมด',
}

const cartKey = (tableId) => `staff_remote_cart_${tableId}`
const newRequestId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

function readSavedCart(tableId) {
    try {
        const saved = JSON.parse(sessionStorage.getItem(cartKey(tableId)) || 'null')
        if (saved && Array.isArray(saved.lines) && saved.requestId) return saved
    } catch { /* a broken draft is dropped */ }
    return { lines: [], requestId: newRequestId() }
}

/* Take an order at the table. Nothing is written until "send"; the send goes through submit_staff_order. */
export default function StaffOrderPage() {
    const { tableId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { table, bill, loading: billLoading, error: billError } = useStaffBill(tableId)
    const { menuItems, categories, loading: menuLoading, error: menuError } = useMenuData()

    const [draft, setDraft] = useState(() => readSavedCart(tableId))
    const [category, setCategory] = useState('all')
    const [query, setQuery] = useState('')
    const [picking, setPicking] = useState(null)
    const [reviewOpen, setReview] = useState(false)
    const [sending, setSending] = useState(false)
    const [problem, setProblem] = useState(null)
    // The bill this order was started for. null = the table was empty; undefined = not known yet.
    const expectedRef = useRef(location.state && 'bookingId' in location.state ? location.state.bookingId : undefined)

    const cart = draft.lines
    const count = cartCount(cart)
    const total = cartTotal(cart)

    useEffect(() => {
        try { sessionStorage.setItem(cartKey(tableId), JSON.stringify(draft)) } catch { /* storage full or blocked: the cart stays in memory */ }
    }, [draft, tableId])

    useEffect(() => {
        if (expectedRef.current === undefined && !billLoading && !billError) expectedRef.current = bill?.id || null
    }, [bill, billLoading, billError])

    // An emptied cart has nothing to review: fall back to the menu
    const review = reviewOpen && count > 0

    const available = useMemo(() => menuItems.filter(i => i.is_available !== false), [menuItems])
    const usedCategories = useMemo(
        () => categories.filter(c => available.some(i => i.category_id === c.id)),
        [categories, available]
    )
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase()
        return available.filter(i => {
            if (q) return `${i.name || ''} ${i.name_en || ''}`.toLowerCase().includes(q)
            return category === 'all' || i.category_id === category
        })
    }, [available, category, query])
    const inCart = useMemo(() => {
        const map = new Map()
        cart.forEach(l => map.set(l.id, (map.get(l.id) || 0) + l.qty))
        return map
    }, [cart])

    const setLines = (update) => {
        setProblem(null)
        setDraft(d => ({ ...d, lines: update(d.lines) }))
    }

    const handleConfirm = (confirmed) => {
        setLines(lines => addCartLine(lines, toCartLine(confirmed)))
        setPicking(null)
    }

    const send = async ({ openNewBill = false } = {}) => {
        if (sending || count === 0) return
        setSending(true)
        setProblem(null)
        const result = readSubmitResult(await supabase
            .rpc('submit_staff_order', {
                p_table_id: Number(tableId),
                p_items: buildOrderItemsPayload(cart),
                p_expected_booking_id: openNewBill ? null : (expectedRef.current || null),
                p_pax: null,
                p_request_id: draft.requestId,
            })
            .then(res => res, err => ({ data: null, error: err })))
        setSending(false)

        if (!result.ok) {
            setProblem(result)
            return
        }
        try { sessionStorage.removeItem(cartKey(tableId)) } catch { /* nothing to clear */ }
        navigate(`/staff/tables/${tableId}`, { replace: true, state: { sent: { count } } })
    }

    const title = table ? `สั่ง · โต๊ะ ${table.table_name}` : 'สั่งอาหาร'
    // The review step exists only on narrow screens; wide screens show menu and cart side by side
    const back = () => {
        const narrow = window.matchMedia('(max-width: 899px)').matches
        if (review && narrow) setReview(false)
        else navigate(`/staff/tables/${tableId}`)
    }
    const tidy = (text) => text.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')

    const cartPanel = (
        <section className="sd-panel">
            <div className="sd-panel__head">
                <h2>ตะกร้า</h2>
                <span className="sd-count">{count} รายการ</span>
            </div>
            {count === 0 ? (
                <p className="sd-note">ยังไม่มีรายการ แตะเมนูเพื่อใส่ตะกร้า</p>
            ) : (
                <>
                    <ul className="sd-rows">
                        {cart.map(line => {
                            const options = formatOrderItemOptions(line.selected_options)
                            return (
                                <li key={line.key} className="sd-row sr-line">
                                    <span className="sd-row__main">
                                        <span className="sr-line__name">{line.name}</span>
                                        {options.length > 0 && <span className="sr-line__sub">{tidy(options.join(' · '))}</span>}
                                        <span className="sr-line__sub sr-num">{formatBaht(line.unitPrice * line.qty)}</span>
                                    </span>
                                    <span className="sr-stepper">
                                        <button type="button" aria-label={`ลด ${line.name}`} onClick={() => setLines(l => changeCartQty(l, line.key, -1))}>−</button>
                                        <span>{line.qty}</span>
                                        <button type="button" aria-label={`เพิ่ม ${line.name}`} onClick={() => setLines(l => changeCartQty(l, line.key, 1))}>+</button>
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                    <div className="sr-cart__total">
                        <span>รวมรายการที่จะส่ง</span>
                        <strong>{formatBaht(total)}</strong>
                    </div>
                </>
            )}

            {problem && (
                <div className="sr-notice is-warn" role="alert" style={{ marginBottom: 12 }}>
                    {problem.message}
                    {problem.code === 'BILL_CLOSED' && (
                        <div className="sr-notice__actions">
                            <button type="button" className="sr-btn sr-btn--ghost" disabled={sending} onClick={() => send({ openNewBill: true })}>
                                เปิดบิลใหม่และส่ง
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="sr-cart__actions">
                <button type="button" className="sr-btn sr-btn--send sr-btn--block" disabled={sending || count === 0} onClick={() => send()}>
                    <span>{sending ? 'กำลังส่ง' : 'ส่งเข้าครัว'}</span>
                    <span className="sr-num">{formatBaht(total)}</span>
                </button>
                <p className="sr-foot-note">สลิปครัวและบาร์พิมพ์ที่เครื่อง POS ราคาคิดจากเมนูในระบบ</p>
            </div>
        </section>
    )

    return (
        <div className="staff-dash staff-remote">
            <header className="sd-top">
                <div className="sd-wrap sd-top__row">
                    <div className="sd-brand">
                        <button type="button" className="sd-quiet sd-top__back" onClick={back}>กลับ</button>
                        <h1 className="sd-top__title">
                            {review ? (
                                <>
                                    <span className="sr-only-narrow">ตรวจรายการ</span>
                                    <span className="sr-only-wide">{title}</span>
                                </>
                            ) : title}
                        </h1>
                    </div>
                </div>
            </header>

            <main className="sd-wrap sr-main sr-main--order">
                {billError === 'TABLE_NOT_FOUND' ? (
                    <div className="sr-notice is-warn" role="alert">
                        ไม่พบโต๊ะนี้
                        <div className="sr-notice__actions">
                            <button type="button" className="sr-btn sr-btn--ghost" onClick={() => navigate('/staff/tables')}>กลับไปหน้าโต๊ะ</button>
                        </div>
                    </div>
                ) : (
                    <div className={`sr-order ${review ? 'is-review' : ''}`}>
                        <div className="sr-menu">
                            <div className="sd-tools">
                                <label className="sd-search">
                                    <span className="sd-search__label">ค้นหาเมนู</span>
                                    <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาเมนู" />
                                </label>
                                <div className="sd-tabs" role="tablist" aria-label="หมวดเมนู">
                                    <button type="button" role="tab" aria-selected={category === 'all'} className={`sd-tab ${category === 'all' ? 'is-active' : ''}`} onClick={() => { setCategory('all'); setQuery('') }}>ทั้งหมด</button>
                                    {usedCategories.map(c => (
                                        <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={`sd-tab ${category === c.id ? 'is-active' : ''}`} onClick={() => { setCategory(c.id); setQuery('') }}>
                                            {c.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <section className="sd-panel" aria-busy={menuLoading}>
                                {menuLoading && [0, 1, 2, 3].map(i => (
                                    <div key={i} className="sr-item"><span className="sr-item__main"><span className="sd-bar sd-bar--line" /></span></div>
                                ))}
                                {!menuLoading && menuError && <p className="sd-note">โหลดเมนูไม่ได้ ตรวจสัญญาณอินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่</p>}
                                {!menuLoading && !menuError && shown.length === 0 && (
                                    <p className="sd-note">{query.trim() ? `ไม่พบเมนูที่มีคำว่า "${query.trim()}"` : 'หมวดนี้ไม่มีเมนูที่เปิดขาย'}</p>
                                )}
                                {!menuLoading && !menuError && shown.map(item => {
                                    const qty = inCart.get(item.id) || 0
                                    const hasOptions = (item.menu_item_options || []).length > 0
                                    return (
                                        <button key={item.id} type="button" className="sr-item" onClick={() => setPicking(item)}>
                                            <span className="sr-item__main">
                                                <span className="sr-item__name">{item.name}</span>
                                                {hasOptions && <span className="sr-item__sub">มีตัวเลือก</span>}
                                            </span>
                                            <span className="sr-item__side">
                                                {qty > 0 && <span className="sr-chip is-cart">{qty} ในตะกร้า</span>}
                                                <span className="sr-item__price">{formatBaht(item.price)}</span>
                                            </span>
                                        </button>
                                    )
                                })}
                            </section>
                        </div>

                        <aside className="sr-cart">{cartPanel}</aside>
                    </div>
                )}
            </main>

            {!review && billError !== 'TABLE_NOT_FOUND' && (
                <div className="sr-dock sr-dock--order">
                    <div className="sd-wrap sr-dock__row">
                        <span className="sr-dock__sum">
                            <span>{count} รายการในตะกร้า</span>
                            <span>{formatBaht(total)}</span>
                        </span>
                        <button type="button" className="sr-btn" disabled={count === 0} onClick={() => setReview(true)}>ตรวจรายการ</button>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {picking && (
                    <OptionSelectionModal
                        key={picking.id}
                        item={picking}
                        labels={OPTION_LABELS}
                        onClose={() => setPicking(null)}
                        onConfirm={handleConfirm}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
