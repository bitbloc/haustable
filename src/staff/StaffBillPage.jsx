/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import generatePayload from 'promptpay-qr'
import { supabase } from '../lib/supabaseClient'
import { useStaffBill } from '../hooks/useStaffBill'
import { useShiftOpen, SHIFT_CLOSED_TEXT } from '../hooks/useShiftOpen'
import {
    billBalance, formatBaht, isAwaitingPrint, isPrintOverdue, isSentToKitchen,
    normalizePromptPayId, formatPromptPayId, readAdjustResult,
} from '../utils/staffOrder'
import { formatOrderItemOptions } from '../utils/menuHelper'
import { REMOVAL_REASONS } from '../utils/orderItemRemoval'
import { sendPOSBroadcast } from '../utils/realtimeNotifier'
import '../StaffDashboard.css'
import './StaffRemote.css'

const clock = (date) => date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
const itemName = (item) => item?.custom_name || item?.menu_items?.name || 'รายการ'
const tidy = (text) => text.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')

/* One table's open bill on a waiter's phone: look, add, correct, show a payment QR.
   The bill is closed, payment confirmed and the receipt printed at the POS. */
export default function StaffBillPage() {
    const { tableId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { table, bill, loading, error, live, updatedAt, reload } = useStaffBill(tableId)
    const [notice, setNotice] = useState(() => (location.state?.sent ? `ส่ง ${location.state.sent.count} รายการแล้ว สลิปครัวและบาร์พิมพ์ที่เครื่อง POS` : null))
    const [now, setNow] = useState(() => new Date())
    const shiftClosed = useShiftOpen() === false
    const [edit, setEdit] = useState(null) // { item, qty, reason, note, saving, problem }
    const [qr, setQr] = useState(null) // { loading, payeeId, problem }

    // Re-check "waiting for its slip" against the clock, so a stuck order turns up without a reload
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 15000)
        return () => clearInterval(timer)
    }, [])

    const items = useMemo(() => bill?.order_items || [], [bill])
    const balance = useMemo(() => billBalance(bill), [bill])
    const itemCount = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0)
    const waiting = items.filter(isAwaitingPrint)
    const overdue = waiting.filter(i => isPrintOverdue(i, now))
    const title = table ? `โต๊ะ ${table.table_name}` : 'โต๊ะ'

    const goOrder = () => navigate(`/staff/tables/${tableId}/order`, { state: { bookingId: bill?.id || null } })

    let lede = null
    if (overdue.length > 0) {
        lede = { warn: true, text: `${overdue.length} รายการยังไม่พิมพ์สลิปเกิน 1 นาที ตรวจว่าเครื่อง POS เปิดอยู่ แล้วแจ้งครัวหรือบาร์` }
    } else if (waiting.length > 0) {
        lede = { warn: false, text: `${waiting.length} รายการกำลังรอพิมพ์สลิปที่เครื่อง POS` }
    } else if (bill && items.length > 0) {
        lede = { warn: false, text: shiftClosed ? 'ทุกรายการพิมพ์สลิปแล้ว' : 'ทุกรายการพิมพ์สลิปแล้ว แตะรายการเพื่อลดจำนวนหรือยกเลิก' }
    }

    /* ── Correct a line: lower its quantity or remove it ── */
    const openEdit = (item) => setEdit({ item, qty: Math.max(0, Number(item.quantity || 1) - 1), reason: null, note: '', saving: false, problem: null })

    const saveEdit = async () => {
        if (!edit || edit.saving) return
        const sent = isSentToKitchen(edit.item)
        if (sent && !edit.reason) {
            setEdit(e => ({ ...e, problem: 'รายการนี้ส่งเข้าครัวแล้ว กรุณาเลือกเหตุผล' }))
            return
        }
        setEdit(e => ({ ...e, saving: true, problem: null }))
        const result = readAdjustResult(await supabase
            .rpc('staff_adjust_order_item', {
                p_order_item_id: edit.item.id,
                p_new_quantity: edit.qty,
                p_reason: sent ? edit.reason : null,
                p_note: edit.note.trim() || null,
            })
            .then(res => res, err => ({ data: null, error: err })))

        if (!result.ok) {
            setEdit(e => (e ? { ...e, saving: false, problem: result.message } : e))
            if (result.code === 'ITEM_GONE' || result.code === 'BILL_CLOSED') reload()
            return
        }
        const name = itemName(edit.item)
        const what = edit.qty === 0 ? `ยกเลิก "${name}" แล้ว` : `ลด "${name}" เหลือ ${edit.qty} แล้ว`
        setNotice(result.data.needs_slip ? `${what} ใบแจ้งครัวพิมพ์ที่เครื่อง POS` : what)
        setEdit(null)
        reload()
        if (result.data.needs_slip) {
            sendPOSBroadcast('staff_item_changed', { booking_id: result.data.booking_id, table_id: result.data.table_id })
        }
    }

    /* ── Payment QR for what is left to pay ── */
    const openQr = async () => {
        setQr({ loading: true, payeeId: null, problem: null })
        const { data, error: settingError } = await supabase.from('app_settings').select('value').eq('key', 'promptpay_id').maybeSingle()
        const payeeId = settingError ? null : normalizePromptPayId(data?.value)
        setQr({
            loading: false,
            payeeId,
            problem: settingError
                ? 'โหลดเลขพร้อมเพย์ไม่ได้ ตรวจสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง'
                : (payeeId ? null : 'ยังไม่ได้ตั้งเลขพร้อมเพย์ของร้านในหน้าตั้งค่า จึงสร้าง QR ไม่ได้'),
        })
    }
    const due = balance.remainingBalance
    const qrPayload = qr?.payeeId && due > 0 ? generatePayload(qr.payeeId, { amount: due }) : null

    const editSent = edit ? isSentToKitchen(edit.item) : false
    const editMax = edit ? Math.max(0, Number(edit.item.quantity || 1) - 1) : 0

    return (
        <div className="staff-dash staff-remote">
            <header className="sd-top">
                <div className="sd-wrap sd-top__row">
                    <div className="sd-brand">
                        <button type="button" className="sd-quiet sd-top__back" onClick={() => navigate('/staff/tables')}>กลับ</button>
                        <h1 className="sd-top__title">{title}</h1>
                    </div>
                    {updatedAt && (
                        <span className="sd-fresh">
                            <span className={`sd-fresh__dot ${live ? 'is-live' : ''}`} />
                            <span className="sd-fresh__time">{clock(updatedAt)}</span>
                        </span>
                    )}
                </div>
            </header>

            <main className="sd-wrap sr-main sr-main--bill">
                {shiftClosed && <p className="sr-notice is-warn" role="status">{SHIFT_CLOSED_TEXT}</p>}
                {notice && <p className="sr-notice" role="status">{notice}</p>}

                {loading && (
                    <section className="sd-panel" aria-busy="true">
                        <div className="sd-panel__head"><h2>รายการในบิล</h2></div>
                        <ul className="sd-rows">
                            {[0, 1, 2].map(i => (
                                <li key={i} className="sd-row">
                                    <span className="sd-row__main"><span className="sd-bar sd-bar--line" /><span className="sd-bar sd-bar--sub" /></span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {!loading && error && (
                    <div className="sr-notice is-warn" role="alert">
                        {error === 'TABLE_NOT_FOUND' ? 'ไม่พบโต๊ะนี้' : 'โหลดบิลไม่ได้ ตรวจสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง'}
                        <div className="sr-notice__actions">
                            {error !== 'TABLE_NOT_FOUND' && <button type="button" className="sr-btn sr-btn--ghost" onClick={reload}>ลองอีกครั้ง</button>}
                            <button type="button" className="sr-btn sr-btn--ghost" onClick={() => navigate('/staff/tables')}>กลับไปหน้าโต๊ะ</button>
                        </div>
                    </div>
                )}

                {!loading && !error && !bill && (
                    <section className="sd-panel">
                        <div className="sd-panel__head"><h2>รายการในบิล</h2></div>
                        <p className="sd-note">โต๊ะนี้ยังไม่มีบิลเปิดอยู่ รายการแรกที่ส่งจะเปิดบิลใหม่ให้โต๊ะนี้</p>
                    </section>
                )}

                {!loading && !error && bill && (
                    <>
                        {lede && <p className={`sr-lede ${lede.warn ? 'is-warn' : ''}`}>{lede.text}</p>}

                        <div className="sr-figures">
                            <div className="sr-figure is-lead">
                                <span className="sr-figure__label">ยอดที่ต้องชำระ</span>
                                <span className="sr-figure__n">{formatBaht(due)}</span>
                            </div>
                            <div className="sr-figure">
                                <span className="sr-figure__label">จำนวน</span>
                                <span className="sr-figure__n">{itemCount} รายการ</span>
                            </div>
                            {balance.discountAmount > 0 && (
                                <div className="sr-figure">
                                    <span className="sr-figure__label">ส่วนลดที่บันทึกแล้ว</span>
                                    <span className="sr-figure__n">−{formatBaht(balance.discountAmount)}</span>
                                </div>
                            )}
                            {balance.alreadyPaid > 0 && (
                                <div className="sr-figure">
                                    <span className="sr-figure__label">ชำระแล้ว (มัดจำ แบ่งจ่าย)</span>
                                    <span className="sr-figure__n">−{formatBaht(balance.alreadyPaid)}</span>
                                </div>
                            )}
                        </div>

                        <section className="sd-panel">
                            <div className="sd-panel__head"><h2>รายการในบิล</h2></div>
                            {items.length === 0 ? (
                                <p className="sd-note">บิลนี้ยังไม่มีรายการ</p>
                            ) : (
                                <ul className="sd-rows">
                                    {items.map(item => {
                                        const options = formatOrderItemOptions(item.selected_options)
                                        const sub = [tidy(options.join(' · ')), item.ordered_by_name ? `สั่งโดย ${item.ordered_by_name}` : ''].filter(Boolean).join(' · ')
                                        return (
                                            <li key={item.id}>
                                                <button type="button" className="sd-row sr-line sr-line--tap" disabled={shiftClosed} onClick={() => openEdit(item)} aria-label={`แก้ ${itemName(item)}`}>
                                                    <span className="sr-line__qty">{item.quantity}×</span>
                                                    <span className="sd-row__main">
                                                        <span className="sr-line__name">{itemName(item)}</span>
                                                        {sub && <span className="sr-line__sub">{sub}</span>}
                                                    </span>
                                                    <span className="sr-line__side">
                                                        <span className="sr-line__price">{formatBaht(Number(item.price_at_time || 0) * Number(item.quantity || 0))}</span>
                                                        {isAwaitingPrint(item) && (
                                                            <span className={`sr-chip ${isPrintOverdue(item, now) ? 'is-warn' : ''}`}>รอพิมพ์</span>
                                                        )}
                                                    </span>
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </section>

                        <p className="sr-foot-note">
                            ยอดนี้ยังไม่รวมส่วนลดที่แคชเชียร์ใส่ที่เครื่อง POS แต่ยังไม่ได้บันทึก การปิดบิล ยืนยันรับเงิน และใบเสร็จ ทำที่เครื่อง POS
                        </p>
                    </>
                )}
            </main>

            {!loading && !error && (
                <div className="sr-dock">
                    <div className="sd-wrap sr-dock__row sr-main--bill">
                        {bill && items.length > 0 && (
                            <button type="button" className="sr-btn sr-btn--ghost" disabled={shiftClosed} onClick={openQr}>QR รับเงิน</button>
                        )}
                        <button type="button" className="sr-btn" disabled={shiftClosed} onClick={goOrder}>
                            {bill ? 'สั่งเพิ่ม' : 'เปิดบิลและสั่ง'}
                        </button>
                    </div>
                </div>
            )}

            {edit && (
                <div className="sr-sheet" role="dialog" aria-modal="true" aria-labelledby="sr-edit-title">
                    <button type="button" className="sr-sheet__veil" aria-label="ปิด" onClick={() => !edit.saving && setEdit(null)} />
                    <div className="sr-sheet__body">
                        <div className="sr-sheet__head">
                            <div>
                                <h2 id="sr-edit-title">{itemName(edit.item)}</h2>
                                <p>ตอนนี้ {edit.item.quantity} · {editSent ? 'ส่งเข้าครัวแล้ว' : 'ยังไม่พิมพ์สลิป'}</p>
                            </div>
                            <button type="button" className="sd-quiet" disabled={edit.saving} onClick={() => setEdit(null)}>ปิด</button>
                        </div>

                        <div className="sr-field">
                            <span className="sr-field__label">จำนวนใหม่</span>
                            <span className="sr-stepper">
                                <button type="button" aria-label="ลด" disabled={edit.qty <= 0} onClick={() => setEdit(e => ({ ...e, qty: Math.max(0, e.qty - 1), problem: null }))}>−</button>
                                <span>{edit.qty}</span>
                                <button type="button" aria-label="เพิ่ม" disabled={edit.qty >= editMax} onClick={() => setEdit(e => ({ ...e, qty: Math.min(editMax, e.qty + 1), problem: null }))}>+</button>
                            </span>
                        </div>

                        {editSent && (
                            <fieldset className="sr-choices">
                                <legend className="sr-field__label">เหตุผล</legend>
                                {REMOVAL_REASONS.map(r => (
                                    <label key={r.key} className={`sr-choice ${edit.reason === r.key ? 'is-on' : ''}`}>
                                        <input type="radio" name="sr-reason" checked={edit.reason === r.key} onChange={() => setEdit(e => ({ ...e, reason: r.key, problem: null }))} />
                                        <span className="sr-choice__main">
                                            <span>{r.label}</span>
                                            <span className="sr-choice__hint">{r.hint}</span>
                                        </span>
                                    </label>
                                ))}
                            </fieldset>
                        )}

                        <label className="sr-field sr-field--stack">
                            <span className="sr-field__label">หมายเหตุ (ไม่บังคับ)</span>
                            <input type="text" value={edit.note} maxLength={120} onChange={e => setEdit(s => ({ ...s, note: e.target.value }))} placeholder="เช่น ลูกค้าเปลี่ยนใจ" />
                        </label>

                        {edit.problem && <p className="sr-notice is-warn" role="alert">{edit.problem}</p>}

                        <button type="button" className="sr-btn sr-btn--block" disabled={edit.saving} onClick={saveEdit}>
                            {edit.saving ? 'กำลังบันทึก' : (edit.qty === 0 ? 'ยกเลิกรายการนี้' : `ลดเหลือ ${edit.qty}`)}
                        </button>
                        <p className="sr-foot-note">
                            {editSent ? 'ใบแจ้งยกเลิกหรือลดจำนวนจะพิมพ์ที่เครื่อง POS' : 'รายการนี้ยังไม่พิมพ์สลิป จึงไม่มีใบแจ้งยกเลิก'} · ถ้าจะเปลี่ยนเมนู ให้ยกเลิกรายการนี้แล้วกดสั่งเพิ่ม
                        </p>
                    </div>
                </div>
            )}

            {qr && (
                <div className="sr-sheet" role="dialog" aria-modal="true" aria-labelledby="sr-qr-title">
                    <button type="button" className="sr-sheet__veil" aria-label="ปิด" onClick={() => setQr(null)} />
                    <div className="sr-sheet__body">
                        <div className="sr-sheet__head">
                            <div>
                                <h2 id="sr-qr-title">พร้อมเพย์ · {title}</h2>
                                <p>ยอด ณ {clock(updatedAt || now)}</p>
                            </div>
                            <button type="button" className="sd-quiet" onClick={() => setQr(null)}>ปิด</button>
                        </div>

                        {qr.loading && <p className="sd-note">กำลังสร้าง QR</p>}
                        {!qr.loading && qr.problem && <p className="sr-notice is-warn" role="alert">{qr.problem}</p>}
                        {!qr.loading && !qr.problem && due <= 0 && <p className="sr-notice">บิลนี้ไม่มียอดค้างชำระ</p>}
                        {qrPayload && (
                            <div className="sr-qr">
                                <div className="sr-qr__code"><QRCodeSVG value={qrPayload} size={232} level="M" bgColor="#ffffff" fgColor="#1b1d1a" /></div>
                                <p className="sr-qr__amount">{formatBaht(due)}</p>
                                <p className="sr-qr__payee">พร้อมเพย์ {formatPromptPayId(qr.payeeId)}</p>
                            </div>
                        )}
                        <p className="sr-foot-note">
                            QR นี้คิดจากรายการในบิลตอนนี้ ถ้าสั่งเพิ่ม แก้รายการ หรือแคชเชียร์ใส่ส่วนลด ยอดจะเปลี่ยน ให้เปิด QR ใหม่ หลังลูกค้าโอนแล้ว แจ้งแคชเชียร์ให้ตรวจยอดและปิดบิลที่เครื่อง POS
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
