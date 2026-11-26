// Labour vs sales on the overview (owner request 2026-11-26): the average leads,
// the single day follows, so one quiet day does not look alarming on its own.
// Labour comes from the HR system (admin only); the card hides itself when it
// cannot read it.
// Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
import { useEffect, useState } from 'react'
import { fetchHrLabor, fetchMonthDailySales, laborVsSales } from '../../../utils/monthlyOwnerReport'

const pct = (n) => (n === null || n === undefined ? '—' : `${n.toLocaleString('th-TH', { maximumFractionDigits: 1 })}%`)
const baht = (n) => `฿${Math.round(Number(n) || 0).toLocaleString('th-TH')}`

export default function LaborVsSalesCard({ selectedDate }) {
    const [state, setState] = useState({ status: 'loading', data: null })

    useEffect(() => {
        let alive = true
        const ym = String(selectedDate || '').slice(0, 7)
        if (!/^\d{4}-\d{2}$/.test(ym)) return undefined
        setState({ status: 'loading', data: null })
        Promise.all([fetchHrLabor(ym), fetchMonthDailySales(ym)])
            .then(([labor, sales]) => {
                if (!alive) return
                const data = laborVsSales(sales, labor, selectedDate)
                setState({ status: data ? 'ready' : 'hidden', data })
            })
            .catch(() => alive && setState({ status: 'hidden', data: null }))
        return () => { alive = false }
    }, [selectedDate])

    if (state.status === 'hidden') return null
    const d = state.data

    return (
        <section className="font-sans border border-[var(--color-rule)] bg-[var(--color-paper)] mb-6" aria-label="ค่าแรงเทียบยอดขาย">
            <div className="flex items-baseline justify-between gap-4 px-4 py-3 border-b border-[var(--color-rule)]">
                <h2 className="text-base font-semibold leading-7 text-[var(--color-ink)]">ค่าแรงเทียบยอดขาย</h2>
                <span className="text-xs leading-5 text-[var(--color-neutral)]">ค่าแรงจากระบบ HR ดูค่าเฉลี่ยเป็นหลัก</span>
            </div>
            {state.status === 'loading' ? (
                <p className="px-4 py-3 text-sm leading-6 text-[var(--color-neutral)]">กำลังโหลดค่าแรง…</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-rule)]">
                    <div className="p-4">
                        <span className="block text-xs leading-5 text-[var(--color-neutral)]">เฉลี่ยเดือนนี้</span>
                        <span className="block mt-1 text-2xl leading-8 font-semibold tabular-nums text-[var(--brand-plum)]">{pct(d.monthToDate?.pct)}</span>
                        <span className="block mt-1 text-xs leading-5 text-[var(--color-neutral)] tabular-nums">
                            {d.monthToDate ? `${d.monthToDate.days} วันที่มียอดขาย` : 'ยังไม่มียอดขาย'}
                        </span>
                    </div>
                    <div className="p-4">
                        <span className="block text-xs leading-5 text-[var(--color-neutral)]">เฉลี่ย 7 วันล่าสุด</span>
                        <span className="block mt-1 text-2xl leading-8 font-semibold tabular-nums text-[var(--color-ink)]">{pct(d.last7?.pct)}</span>
                        <span className="block mt-1 text-xs leading-5 text-[var(--color-neutral)] tabular-nums">
                            {d.last7 ? `ค่าแรง ${baht(d.last7.labor)} จากยอดขาย ${baht(d.last7.sales)}` : '—'}
                        </span>
                    </div>
                    <div className="p-4">
                        <span className="block text-xs leading-5 text-[var(--color-neutral)]">วันที่เลือก</span>
                        <span className="block mt-1 text-2xl leading-8 font-semibold tabular-nums text-[var(--color-muted)]">{pct(d.day?.pct)}</span>
                        <span className="block mt-1 text-xs leading-5 text-[var(--color-neutral)] tabular-nums">
                            {d.day ? `ค่าแรง ${baht(d.day.labor)} จากยอดขาย ${baht(d.day.sales)}` : 'ยังไม่มีข้อมูล'}
                        </span>
                    </div>
                </div>
            )}
            <p className="px-4 pb-3 text-xs leading-5 text-[var(--color-neutral)]">
                รายวันขึ้นลงตามยอดขาย วันเงียบจะดูสูงเป็นปกติ ค่าแรงรายวันเป็นค่าประมาณ (ค่าแรงกะคิดตามวันที่ทำงาน ส่วนเงินเดือนประจำเฉลี่ยทั้งเดือน)
            </p>
        </section>
    )
}
