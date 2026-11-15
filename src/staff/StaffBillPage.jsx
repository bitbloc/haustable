/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useStaffBill } from '../hooks/useStaffBill'
import { billSummary, formatBaht, isAwaitingPrint, isPrintOverdue } from '../utils/staffOrder'
import { formatOrderItemOptions } from '../utils/menuHelper'
import '../StaffDashboard.css'
import './StaffRemote.css'

const clock = (date) => date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

/* One table's open bill on a waiter's phone. Read and add only: the bill is closed, paid and printed at the POS. */
export default function StaffBillPage() {
    const { tableId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { table, bill, loading, error, live, updatedAt, reload } = useStaffBill(tableId)
    const [sent] = useState(() => location.state?.sent || null)
    const [now, setNow] = useState(() => new Date())

    // Re-check "waiting for its slip" against the clock, so a stuck order turns up without a reload
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 15000)
        return () => clearInterval(timer)
    }, [])

    const items = bill?.order_items || []
    const summary = billSummary(bill)
    const waiting = items.filter(isAwaitingPrint)
    const overdue = waiting.filter(i => isPrintOverdue(i, now))
    const title = table ? `โต๊ะ ${table.table_name}` : 'โต๊ะ'

    const goOrder = () => navigate(`/staff/tables/${tableId}/order`, { state: { bookingId: bill?.id || null } })

    let lede = null
    if (overdue.length > 0) {
        lede = { warn: true, text: `${overdue.length} รายการยังไม่พิมพ์สลิปเกิน 1 นาที ตรวจว่าเครื่อง POS เปิดอยู่ แล้วแจ้งครัวหรือบาร์` }
    } else if (waiting.length > 0) {
        lede = { warn: false, text: `${waiting.length} รายการกำลังรอพิมพ์สลิปที่เครื่อง POS` }
    } else if (bill) {
        lede = { warn: false, text: 'ทุกรายการพิมพ์สลิปแล้ว' }
    }

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
                {sent && (
                    <p className="sr-notice" role="status">
                        ส่ง {sent.count} รายการแล้ว สลิปครัวและบาร์พิมพ์ที่เครื่อง POS
                    </p>
                )}

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
                                <span className="sr-figure__label">{summary.discount > 0 ? 'ยอดหลังส่วนลด' : 'ยอดตามรายการ'}</span>
                                <span className="sr-figure__n">{formatBaht(summary.net)}</span>
                            </div>
                            <div className="sr-figure">
                                <span className="sr-figure__label">จำนวน</span>
                                <span className="sr-figure__n">{summary.itemCount} รายการ</span>
                            </div>
                            {summary.discount > 0 && (
                                <div className="sr-figure">
                                    <span className="sr-figure__label">ส่วนลดที่บันทึกแล้ว</span>
                                    <span className="sr-figure__n">−{formatBaht(summary.discount)}</span>
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
                                        const sub = [options.join(' · '), item.ordered_by_name ? `สั่งโดย ${item.ordered_by_name}` : ''].filter(Boolean).join(' · ')
                                        return (
                                            <li key={item.id} className="sd-row sr-line">
                                                <span className="sr-line__qty">{item.quantity}×</span>
                                                <span className="sd-row__main">
                                                    <span className="sr-line__name">{item.custom_name || item.menu_items?.name || 'รายการ'}</span>
                                                    {sub && <span className="sr-line__sub">{sub}</span>}
                                                </span>
                                                <span className="sr-line__side">
                                                    <span className="sr-line__price">{formatBaht(Number(item.price_at_time || 0) * Number(item.quantity || 0))}</span>
                                                    {isAwaitingPrint(item) && (
                                                        <span className={`sr-chip ${isPrintOverdue(item, now) ? 'is-warn' : ''}`}>รอพิมพ์</span>
                                                    )}
                                                </span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </section>

                        <p className="sr-foot-note">
                            ยอดนี้ยังไม่รวมส่วนลดที่แคชเชียร์ใส่ที่เครื่อง POS การปิดบิล รับเงิน และใบเสร็จ ทำที่เครื่อง POS
                        </p>
                    </>
                )}
            </main>

            {!loading && !error && (
                <div className="sr-dock">
                    <div className="sd-wrap sr-dock__row sr-main--bill">
                        <button type="button" className="sr-btn" onClick={goOrder}>
                            {bill ? 'สั่งเพิ่ม' : 'เปิดบิลและสั่ง'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
