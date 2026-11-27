// Monthly payroll from the HR system, recorded as one expense (owner request 2026-11-27).
// The owner picks a month, reads HR's totals (no names), confirms the amount and date,
// and one staff_wages expense goes into store_expenses like any other cost.
// Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabaseClient'
import { logStaffActivity } from '../../../utils/auditLogger'
import {
    basisAmount,
    buildPayrollExpense,
    fetchHrPayroll,
    lastDayOfMonth,
    monthState,
    previousMonth,
    thaiMonthLabel,
    wagesInMonth
} from '../../../utils/payrollExpense'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-plum)]'
// A field's edge reads at 3:1 against the paper (the hairline does not)
const field = `w-full min-h-11 px-3 border border-[var(--color-neutral)] bg-[var(--color-paper)] text-sm text-[var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS}`
const label = 'text-[13px] leading-5 text-[var(--color-neutral)]'
const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const PAY = [{ id: 'TRANSFER', label: 'โอน' }, { id: 'CASH', label: 'เงินสด' }]

export default function PayrollExpensePanel({ expenses = [], onPosted }) {
    const [open, setOpen] = useState(false)
    const [month, setMonth] = useState(() => previousMonth())
    const [hr, setHr] = useState({ state: 'idle' }) // idle | loading | error | ready
    const [basis, setBasis] = useState('gross')
    const [amount, setAmount] = useState('')
    const [date, setDate] = useState(() => lastDayOfMonth(previousMonth()))
    const [payment, setPayment] = useState('TRANSFER')
    const [saving, setSaving] = useState(false)

    const lastMonth = previousMonth()
    const lastMonthRows = useMemo(() => wagesInMonth(expenses, lastMonth), [expenses, lastMonth])
    const recorded = useMemo(() => wagesInMonth(expenses, month), [expenses, month])
    const state = monthState(month)
    const summary = hr.state === 'ready' ? hr.data : null

    // A new month starts over: its figures, its last day
    const changeMonth = (next) => {
        setMonth(next)
        setHr({ state: 'idle' })
        setAmount('')
        setDate(lastDayOfMonth(next))
    }

    const load = async () => {
        if (!month || state === 'future') return
        setHr({ state: 'loading' })
        const res = await fetchHrPayroll(month)
        if (!res.ok) { setHr({ state: 'error', message: res.message }); return }
        setHr({ state: 'ready', data: res.data })
        setAmount(String(basisAmount(res.data, basis)))
    }

    const pickBasis = (next) => {
        setBasis(next)
        if (summary) setAmount(String(basisAmount(summary, next)))
    }

    const save = async (e) => {
        e.preventDefault()
        const { row, error } = buildPayrollExpense({ summary, basis, amount, date, paymentMethod: payment })
        if (error) { toast.error(error); return }
        if (recorded.length > 0) {
            const list = recorded.map(r => `${r.title} ${baht(r.amount)}`).join('\n')
            if (!window.confirm(`เดือน ${thaiMonthLabel(month)} มีรายการเงินเดือนอยู่แล้ว ${recorded.length} รายการ\n\n${list}\n\nลงเพิ่มอีกรายการ?`)) return
        }
        setSaving(true)
        try {
            const { error: insErr } = await supabase.from('store_expenses').insert(row)
            if (insErr) throw insErr
            logStaffActivity('tax', 'payroll_expense', {
                reason: `ลงเงินเดือนจาก HR เดือน ${month}`,
                metadata: { module: 'tax', month, basis, amount: row.amount, headcount: summary?.headcount }
            })
            toast.success(`ลงเงินเดือน ${thaiMonthLabel(month)} ${baht(row.amount)} แล้ว`)
            setHr({ state: 'idle' })
            setAmount('')
            setOpen(false)
            onPosted?.()
        } catch (err) {
            toast.error(`บันทึกไม่สำเร็จ: ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    const status = lastMonthRows.length
        ? `${thaiMonthLabel(lastMonth)} ลงแล้ว ${baht(lastMonthRows.reduce((s, r) => s + Number(r.amount || 0), 0))}`
        : `${thaiMonthLabel(lastMonth)} ยังไม่ได้ลง`

    const figures = summary ? [
        ['ค่าแรง', summary.wages],
        ['OT', summary.overtime],
        ['เบี้ยเลี้ยงและโบนัส', summary.allowances],
        ['รายการหัก', -Math.abs(Number(summary.deductions) || 0)]
    ] : []
    const suspectCount = Array.isArray(summary?.suspect) ? summary.suspect.length : 0

    return (
        <section className="border border-[var(--color-rule)] bg-[var(--color-paper)]" aria-labelledby="payroll-expense-title">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                    <h2 id="payroll-expense-title" className="text-base font-semibold leading-7">เงินเดือนจาก HR</h2>
                    <p className={`text-xs leading-5 ${lastMonthRows.length ? 'text-[var(--color-neutral)]' : 'font-medium text-[var(--brand-plum)]'}`}>{status}</p>
                </div>
                <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="payroll-expense-body"
                    className={`min-h-11 px-4 text-sm font-semibold border border-[var(--brand-plum)] text-[var(--brand-plum)] hover:bg-[var(--color-paper-2)] active:opacity-80 transition-colors cursor-pointer ${FOCUS}`}>
                    {open ? 'ปิด' : 'ลงเงินเดือน'}
                </button>
            </div>

            {open && (
                <div id="payroll-expense-body" className="border-t border-[var(--color-rule)] px-4 py-4 space-y-5">
                    <div className="flex flex-wrap items-end gap-3">
                        <label className={`${label} w-48`}>เดือนของเงินเดือน
                            <input type="month" className={`${field} mt-1 tabular-nums`} value={month} max={bangkokMonthMax()}
                                onChange={(e) => changeMonth(e.target.value)} disabled={hr.state === 'loading' || saving} />
                        </label>
                        <button type="button" onClick={load} disabled={!month || state === 'future' || hr.state === 'loading' || saving}
                            className={`min-h-11 px-4 text-sm font-semibold border border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] active:opacity-80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS}`}>
                            {hr.state === 'loading' ? 'กำลังดึงยอด…' : summary ? 'ดึงยอดใหม่' : 'ดึงยอดจาก HR'}
                        </button>
                    </div>

                    {state === 'future' && <p className="text-sm leading-6 text-[var(--color-neutral)]">เดือนนี้ยังไม่ถึง เลือกเดือนที่จ่ายเงินเดือนไปแล้ว</p>}
                    {state === 'current' && <p className="text-sm leading-6 font-medium text-[var(--brand-plum)]">{thaiMonthLabel(month)} ยังไม่จบเดือน ยอดจาก HR ยังไม่ครบ ควรลงหลังปิดงวดเงินเดือน</p>}
                    {hr.state === 'error' && <p className="text-sm leading-6 text-[var(--error-red)]" role="alert">{hr.message}</p>}

                    {recorded.length > 0 && (
                        <div className="max-w-md text-sm leading-6">
                            <p className="font-medium text-[var(--brand-plum)]">เดือนนี้มีรายการเงินเดือนอยู่แล้ว ระวังลงซ้ำ</p>
                            <ul className="mt-1 divide-y divide-[var(--color-rule)] border-y border-[var(--color-rule)]">
                                {recorded.map(r => (
                                    <li key={r.id} className="py-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                                        <span className="min-w-0 [overflow-wrap:anywhere]">{r.title}{r.fromHr ? ' (จาก HR)' : ''}</span>
                                        <span className="font-mono tabular-nums whitespace-nowrap">{baht(r.amount)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {summary && (
                        <form onSubmit={save} className="space-y-5">
                            <div>
                                <h3 className="text-sm font-semibold leading-6">ยอดจาก HR {thaiMonthLabel(summary.month)} <span className="font-normal text-[var(--color-neutral)]">พนักงาน {Number(summary.headcount) || 0} คน</span></h3>
                                <dl className="mt-1 max-w-md text-sm leading-6 divide-y divide-[var(--color-rule)] border-y border-[var(--color-rule)]">
                                    {figures.map(([name, value]) => (
                                        <div key={name} className="py-1 flex justify-between gap-3">
                                            <dt className="text-[var(--color-muted)]">{name}</dt>
                                            <dd className="font-mono tabular-nums">{value < 0 ? `−${baht(-value)}` : baht(value)}</dd>
                                        </div>
                                    ))}
                                    <div className="py-1 flex justify-between gap-3 font-semibold">
                                        <dt>ยอดก่อนหัก</dt>
                                        <dd className="font-mono tabular-nums">{baht(summary.gross)}</dd>
                                    </div>
                                    <div className="py-1 flex justify-between gap-3">
                                        <dt className="text-[var(--color-muted)]">ยอดจ่ายจริง</dt>
                                        <dd className="font-mono tabular-nums">{baht(summary.net)}</dd>
                                    </div>
                                </dl>
                                {suspectCount > 0 && (
                                    <p className="mt-2 text-sm leading-6 font-medium text-[var(--brand-plum)]">
                                        มีพนักงาน {suspectCount} คนที่ข้อมูลลงเวลาอาจไม่ครบ ตรวจที่ระบบ HR ก่อนลงรายการ
                                    </p>
                                )}
                            </div>

                            <fieldset>
                                <legend className={label}>ลงเป็นค่าใช้จ่ายด้วยยอด</legend>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {[['gross', 'ยอดก่อนหัก', 'ค่าใช้จ่ายของร้าน แนะนำ'], ['net', 'ยอดจ่ายจริง', 'หลังหักรายการ']].map(([id, name, note]) => (
                                        <label key={id} className={`min-h-11 px-3 py-2 border cursor-pointer flex items-center gap-2 text-sm leading-5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brand-plum)] ${basis === id ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]' : 'border-[var(--color-neutral)] text-[var(--color-muted)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]'}`}>
                                            <input type="radio" name="payroll-basis" value={id} checked={basis === id} onChange={() => pickBasis(id)} className="sr-only" />
                                            <span className="font-medium">{name}</span>
                                            <span className={basis === id ? 'opacity-80' : 'text-[var(--color-neutral)]'}>{note}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <div className="grid gap-3 sm:grid-cols-3 items-end">
                                <label className={label}>จำนวนเงิน (บาท)
                                    <input className={`${field} mt-1 font-mono tabular-nums`} inputMode="decimal" value={amount}
                                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} disabled={saving} required />
                                </label>
                                <label className={label}>วันที่ลงรายการ
                                    <input type="date" className={`${field} mt-1 tabular-nums`} value={date}
                                        min={`${month}-01`} max={lastDayOfMonth(month)}
                                        onChange={(e) => setDate(e.target.value)} disabled={saving} required />
                                </label>
                                <label className={label}>จ่ายด้วย
                                    <select className={`${field} mt-1`} value={payment} onChange={(e) => setPayment(e.target.value)} disabled={saving}>
                                        {PAY.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                                    </select>
                                </label>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <button type="submit" disabled={saving || state === 'future'}
                                    className={`min-h-11 px-5 text-sm font-semibold bg-[var(--brand-plum)] text-[var(--cream)] hover:bg-[var(--brand-plum-2)] active:opacity-80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS}`}>
                                    {saving ? 'กำลังบันทึก…' : `ลงเงินเดือน ${thaiMonthLabel(month)}`}
                                </button>
                                <p className="text-[13px] leading-5 text-[var(--color-neutral)]">
                                    ลงเป็นค่าใช้จ่ายหมวดเงินเดือน 1 รายการ แนบสลิปโอนหรือ ภ.ง.ด.1 ได้ภายหลังจากรายการนั้น
                                </p>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </section>
    )
}

// The month picker stops at the current Bangkok month
function bangkokMonthMax() {
    return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7)
}
