// Recurring fixed costs inside Tax & Invoices -> ค่าใช้จ่าย (owner request 2026-11-26).
// Set rent, monthly ads or subscriptions once; they post into store_expenses each
// month on their day. A month's posted expense can be deleted like any other and
// will not come back.
// Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EXPENSE_CATEGORIES, getCleanCategoryLabel } from '../../../utils/expenseConstants'
import { listRecurringExpenses, saveRecurringExpense, setRecurringActive, postRecurringExpenses, bangkokMonth } from '../../../utils/recurringExpenses'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-plum)]'
const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`
const EMPTY = { title: '', category: 'rent', amount: '', day_of_month: 1, vendor_name: '', payment_method: 'TRANSFER' }
const PAY = [{ id: 'TRANSFER', label: 'โอน' }, { id: 'CASH', label: 'เงินสด' }, { id: 'CREDIT', label: 'บัตร' }]

const field = `w-full min-h-11 px-3 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm text-[var(--color-ink)] ${FOCUS}`

export default function RecurringExpensesPanel({ onPosted }) {
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState([])
    const [state, setState] = useState('loading') // loading | ready | error
    const [form, setForm] = useState(EMPTY)
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        try {
            setItems(await listRecurringExpenses())
            setState('ready')
        } catch (err) {
            console.error('Recurring expenses load error:', err)
            setState('error')
        }
    }, [])

    useEffect(() => { load() }, [load])

    const active = items.filter((i) => i.active)
    const monthlyTotal = active.reduce((s, i) => s + Number(i.amount || 0), 0)

    const submit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await saveRecurringExpense(form)
            const posted = await postRecurringExpenses(bangkokMonth())
            toast.success(posted ? `บันทึกแล้ว และลงรายการเดือนนี้ ${posted} รายการ` : (form.id ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกแล้ว จะลงให้เมื่อถึงวันที่ตั้งไว้'))
            setForm(EMPTY)
            await load()
            if (posted && onPosted) onPosted()
        } catch (err) {
            toast.error(`บันทึกไม่สำเร็จ: ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    const toggle = async (item) => {
        try {
            await setRecurringActive(item.id, !item.active)
            toast.success(item.active ? `หยุด "${item.title}" แล้ว` : `เปิด "${item.title}" อีกครั้ง`)
            await load()
        } catch (err) {
            toast.error(`เปลี่ยนสถานะไม่สำเร็จ: ${err.message}`)
        }
    }

    return (
        <section className="border border-[var(--color-rule)] bg-[var(--color-paper)]" aria-label="ค่าใช้จ่ายประจำ">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-7">ค่าใช้จ่ายประจำ</h2>
                    <p className="text-xs leading-5 text-[var(--color-neutral)]">
                        {state === 'ready'
                            ? (active.length ? `${active.length} รายการ รวม ${baht(monthlyTotal)} ต่อเดือน ลงให้อัตโนมัติเมื่อถึงวัน` : 'ค่าเช่า ค่าโฆษณารายเดือน ค่าบริการ ตั้งครั้งเดียว ลงให้ทุกเดือน')
                            : state === 'error' ? 'โหลดไม่สำเร็จ' : 'กำลังโหลด…'}
                    </p>
                </div>
                <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                    className={`min-h-11 px-4 text-sm font-semibold border border-[var(--brand-plum)] text-[var(--brand-plum)] hover:bg-[var(--color-paper-2)] active:opacity-80 transition-colors cursor-pointer ${FOCUS}`}>
                    {open ? 'ปิด' : 'จัดการ'}
                </button>
            </div>

            {open && (
                <div className="border-t border-[var(--color-rule)] px-4 py-4 space-y-5">
                    {state === 'error' && <p className="text-sm leading-6 text-[var(--error-red)]">โหลดรายการไม่สำเร็จ ลองรีเฟรชหน้า</p>}
                    {state === 'ready' && items.length === 0 && (
                        <p className="text-sm leading-6 text-[var(--color-neutral)]">ยังไม่มีค่าใช้จ่ายประจำ เพิ่มรายการแรกด้านล่าง เช่น ค่าเช่าร้าน</p>
                    )}
                    {items.length > 0 && (
                        <table className="w-full text-sm leading-6">
                            <thead>
                                <tr className="text-xs leading-5 text-[var(--color-neutral)] text-left">
                                    <th className="font-normal pb-1">รายการ</th>
                                    <th className="font-normal pb-1 hidden sm:table-cell">หมวด</th>
                                    <th className="font-normal pb-1">ลงทุกวันที่</th>
                                    <th className="font-normal pb-1 text-right">ต่อเดือน</th>
                                    <th className="pb-1"><span className="sr-only">จัดการ</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-rule)]">
                                {items.map((it) => (
                                    <tr key={it.id} className={it.active ? '' : 'text-[var(--color-neutral)]'}>
                                        <td className="py-2 pr-2 align-top [overflow-wrap:anywhere]">
                                            {it.title}{!it.active && ' (หยุดอยู่)'}
                                            {it.vendor_name && <span className="block text-xs leading-5 text-[var(--color-neutral)]">{it.vendor_name}</span>}
                                        </td>
                                        <td className="py-2 pr-2 align-top hidden sm:table-cell">{getCleanCategoryLabel(it.category)}</td>
                                        <td className="py-2 pr-2 align-top tabular-nums">{it.day_of_month}</td>
                                        <td className="py-2 text-right align-top font-mono tabular-nums whitespace-nowrap">{baht(it.amount)}</td>
                                        <td className="py-2 pl-3 align-top text-right whitespace-nowrap">
                                            <button type="button" onClick={() => setForm({ ...it, amount: String(it.amount) })}
                                                className={`min-h-11 px-2 text-sm underline underline-offset-4 text-[var(--brand-plum)] cursor-pointer active:opacity-80 ${FOCUS}`}>แก้ไข</button>
                                            <button type="button" onClick={() => toggle(it)}
                                                className={`min-h-11 px-2 text-sm underline underline-offset-4 text-[var(--color-muted)] cursor-pointer active:opacity-80 ${FOCUS}`}>{it.active ? 'หยุด' : 'เปิดอีกครั้ง'}</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
                        <h3 className="sm:col-span-2 lg:col-span-6 text-sm font-semibold leading-6">{form.id ? `แก้ไข "${form.title}"` : 'เพิ่มค่าใช้จ่ายประจำ'}</h3>
                        <label className="lg:col-span-2 text-xs leading-5 text-[var(--color-neutral)]">ชื่อรายการ
                            <input className={`${field} mt-1`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ค่าเช่าร้าน" required />
                        </label>
                        <label className="text-xs leading-5 text-[var(--color-neutral)]">หมวด
                            <select className={`${field} mt-1`} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.shortLabel || c.label}</option>)}
                            </select>
                        </label>
                        <label className="text-xs leading-5 text-[var(--color-neutral)]">ต่อเดือน (บาท)
                            <input className={`${field} mt-1 font-mono tabular-nums`} type="number" inputMode="decimal" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                        </label>
                        <label className="text-xs leading-5 text-[var(--color-neutral)]">ลงทุกวันที่
                            <input className={`${field} mt-1 tabular-nums`} type="number" min="1" max="31" value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} required />
                        </label>
                        <label className="text-xs leading-5 text-[var(--color-neutral)]">จ่ายด้วย
                            <select className={`${field} mt-1`} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                                {PAY.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </label>
                        <label className="sm:col-span-2 lg:col-span-4 text-xs leading-5 text-[var(--color-neutral)]">ผู้รับเงิน (ไม่บังคับ)
                            <input className={`${field} mt-1`} value={form.vendor_name || ''} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} placeholder="เจ้าของที่ / Facebook Ads" />
                        </label>
                        <div className="sm:col-span-2 lg:col-span-2 flex gap-2">
                            <button type="submit" disabled={saving}
                                className={`flex-1 min-h-11 px-4 text-sm font-semibold bg-[var(--brand-plum)] text-[var(--cream)] hover:bg-[var(--brand-plum-2)] active:opacity-80 transition-colors cursor-pointer disabled:opacity-60 ${FOCUS}`}>
                                {saving ? 'กำลังบันทึก…' : form.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
                            </button>
                            {form.id && (
                                <button type="button" onClick={() => setForm(EMPTY)}
                                    className={`min-h-11 px-4 text-sm border border-[var(--color-rule)] hover:bg-[var(--color-paper-2)] active:opacity-80 cursor-pointer ${FOCUS}`}>ยกเลิก</button>
                            )}
                        </div>
                    </form>
                    <p className="text-xs leading-5 text-[var(--color-neutral)]">
                        ระบบลงรายการให้ในหน้าค่าใช้จ่ายเมื่อถึงวันที่ตั้งไว้ของแต่ละเดือน (เดือนที่สั้นกว่าจะลงวันสุดท้ายของเดือน) ถ้าเดือนไหนไม่ได้จ่าย ลบรายการของเดือนนั้นได้ตามปกติ ระบบจะไม่ลงซ้ำ ยอดใหม่หรือการหยุดมีผลกับเดือนถัดไปที่ยังไม่ได้ลง
                    </p>
                </div>
            )}
        </section>
    )
}
