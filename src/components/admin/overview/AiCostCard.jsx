// Estimated AI (Claude) spend for the month, for the owner to decide whether to stay on
// Claude after the Gemini suspension (owner request 2026-11-26). Built from logged
// tokens x Claude's price, not from Anthropic's bill. Admin only: hides otherwise.
// Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
import { useEffect, useState } from 'react'
import { getThaiDate } from '../../../utils/timeUtils'
import {
    compareToGemini, fetchAiUsage, fetchGeminiBaseline, saveGeminiBaseline, summarizeAiUsage,
} from '../../../utils/aiCost'

const baht = (n) => `฿${Math.round(Number(n) || 0).toLocaleString('th-TH')}`
const bahtFine = (n) => `฿${(Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const usd = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const count = (n) => (Number(n) || 0).toLocaleString('th-TH')

const label = 'block text-xs leading-5 text-[var(--color-neutral)]'
const figure = 'block mt-1 font-mono text-2xl leading-8 tabular-nums'
const note = 'block mt-1 text-xs leading-5 text-[var(--color-neutral)] tabular-nums'
// Instant focus ring, plum on paper (14:1).
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-plum)]'

function Breakdown({ title, rows }) {
    return (
        <div className="p-4">
            <h3 className="text-sm leading-6 font-semibold text-[var(--color-ink)]">{title}</h3>
            <ul className="mt-1">
                {rows.map((r) => (
                    <li key={r.key} className="flex items-baseline justify-between gap-4 py-1.5 border-b border-[var(--color-rule)] last:border-b-0">
                        <span className="text-sm leading-6 text-[var(--color-ink)]">{r.label}</span>
                        <span className="text-sm leading-6 whitespace-nowrap">
                            <span className="font-mono tabular-nums text-[var(--color-muted)]">{bahtFine(r.thb)}</span>
                            <span className="ml-2 text-xs text-[var(--color-neutral)]"><span className="font-mono tabular-nums">{count(r.calls)}</span> ครั้ง</span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function GeminiCompare({ projection, baseline, onSaved }) {
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const save = async (e) => {
        e.preventDefault()
        setSaving(true); setError('')
        try {
            onSaved(await saveGeminiBaseline(value))
            setEditing(false)
        } catch (err) {
            setError(err?.message || 'บันทึกไม่สำเร็จ')
        } finally {
            setSaving(false)
        }
    }

    if (!baseline || editing) {
        return (
            <form onSubmit={save} className="p-4">
                <label htmlFor="gemini-baseline" className={label}>ค่า Gemini เดิมต่อเดือน (จากบิล Google)</label>
                <div className="mt-1 flex gap-2">
                    <input
                        id="gemini-baseline"
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))}
                        placeholder="บาท"
                        aria-invalid={error ? true : undefined}
                        aria-describedby="gemini-baseline-help"
                        className={`min-w-0 flex-1 h-12 px-3 font-mono text-base tabular-nums bg-[var(--color-paper)] border border-[var(--color-rule)] hover:border-[var(--color-neutral)] text-[var(--color-ink)] placeholder:text-[var(--color-neutral)] ${focus}`}
                    />
                    <button
                        type="submit"
                        disabled={saving}
                        aria-busy={saving || undefined}
                        className={`h-12 px-4 text-sm font-semibold bg-[var(--brand-plum)] text-[var(--color-cream)] hover:bg-[var(--brand-plum-2)] active:bg-[var(--brand-plum-3)] cursor-pointer disabled:cursor-default ${focus}`}
                    >
                        {saving ? 'กำลังบันทึก…' : 'บันทึก'}
                    </button>
                </div>
                <span id="gemini-baseline-help" role={error ? 'alert' : undefined} className={error ? 'block mt-1 text-xs leading-5 text-[var(--error-red)]' : note}>
                    {error || 'ใส่ครั้งเดียว ใช้เทียบกับค่า Claude ที่คาดไว้'}
                </span>
            </form>
        )
    }

    const share = compareToGemini(projection, baseline)
    return (
        <div className="p-4">
            <span className={label}>เทียบค่า Gemini เดิม</span>
            <span className={`${figure} text-[var(--color-ink)]`}>{share === null ? '—' : `${share}%`}</span>
            <span className={note}>
                {share === null
                    ? `Gemini เดิม ${baht(baseline)} ต่อเดือน รอผลคาดการณ์ก่อน`
                    : `ของ ${baht(baseline)} ต่อเดือน ${projection <= baseline ? 'ถูกกว่า' : 'แพงกว่า'} ${baht(Math.abs(baseline - projection))}`}
            </span>
            <button
                type="button"
                onClick={() => { setValue(String(baseline)); setEditing(true) }}
                className={`mt-2 min-h-12 text-sm leading-6 underline underline-offset-4 text-[var(--brand-plum)] hover:decoration-2 active:opacity-80 cursor-pointer ${focus}`}
            >
                แก้ค่า Gemini
            </button>
        </div>
    )
}

export default function AiCostCard({ selectedDate }) {
    const [state, setState] = useState({ status: 'loading', data: null })
    const [baseline, setBaseline] = useState(null)

    useEffect(() => {
        let alive = true
        const ym = String(selectedDate || '').slice(0, 7)
        if (!/^\d{4}-\d{2}$/.test(ym)) return undefined
        setState({ status: 'loading', data: null })
        Promise.all([fetchAiUsage(ym), fetchGeminiBaseline().catch(() => null)])
            .then(([rows, base]) => {
                if (!alive) return
                setBaseline(base)
                setState({ status: 'ready', data: summarizeAiUsage(rows, ym, getThaiDate()) })
            })
            .catch(() => alive && setState({ status: 'hidden', data: null }))
        return () => { alive = false }
    }, [selectedDate])

    if (state.status === 'hidden') return null
    const d = state.data

    return (
        <section className="font-sans border border-[var(--color-rule)] bg-[var(--color-paper)]" aria-label="ค่า AI ประมาณการ">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 border-b border-[var(--color-rule)]">
                <h2 className="text-base font-semibold leading-7 text-[var(--color-ink)]">ค่า AI ประมาณการ</h2>
                <span className="text-xs leading-5 text-[var(--color-neutral)]">Claude ทั้งหลังบ้านและ Yuzu คิดจากจำนวน token ที่ใช้จริง</span>
            </div>

            {state.status === 'loading' && (
                <p className="px-4 py-3 text-sm leading-6 text-[var(--color-neutral)]">กำลังโหลดค่า AI…</p>
            )}

            {state.status === 'ready' && d.calls === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-rule)]">
                    <p className="p-4 sm:col-span-2 text-sm leading-6 text-[var(--color-muted)]">
                        เดือนนี้ยังไม่มีการเรียก AI ที่บันทึกไว้ ระบบเริ่มนับตั้งแต่ 26 พ.ย. 2569
                    </p>
                    <GeminiCompare projection={null} baseline={baseline} onSaved={setBaseline} />
                </div>
            )}

            {state.status === 'ready' && d.calls > 0 && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-rule)] border-b border-[var(--color-rule)]">
                        <div className="p-4">
                            <span className={label}>เดือนนี้ถึงวันนี้</span>
                            <span className={`${figure} text-[var(--brand-plum)]`}>{bahtFine(d.thb)}</span>
                            <span className={note}>{count(d.calls)} ครั้ง ({usd(d.usd)})</span>
                        </div>
                        <div className="p-4">
                            <span className={label}>คาดทั้งเดือน</span>
                            <span className={`${figure} text-[var(--color-ink)]`}>{d.projection === null ? '—' : baht(d.projection)}</span>
                            <span className={note}>
                                {d.projection === null
                                    ? `เก็บข้อมูลอีก ${d.daysUntilProjection} วันจึงคาดการณ์ได้`
                                    : `เฉลี่ยวันละ ${bahtFine(d.perDay)} จาก ${d.daysTracked} วัน`}
                            </span>
                        </div>
                        <GeminiCompare projection={d.projection} baseline={baseline} onSaved={setBaseline} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-rule)]">
                        <Breakdown title="แยกตามระบบ" rows={d.bySource} />
                        <Breakdown title="แยกตามรุ่น AI" rows={d.byModel} />
                    </div>
                </>
            )}

            <p className="px-4 py-3 border-t border-[var(--color-rule)] text-xs leading-5 text-[var(--color-neutral)]">
                เป็นค่าประมาณ ใช้ราคาต่อ token ของ Claude คูณจำนวนที่ใช้ และอัตราแลกเปลี่ยนของวันที่เรียก ยอดเรียกเก็บจริงดูได้ที่ Claude Console
            </p>
        </section>
    )
}
