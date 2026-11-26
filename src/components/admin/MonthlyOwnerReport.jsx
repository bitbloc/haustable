// /admin/monthly-report: one month of sales, costs and stock loss on one page,
// with an AI write-up for the owner (owner request 2026-11-26).
// Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import AdminPageHeader from './AdminPageHeader'
import { AdminStatStrip, AdminSkeletonRows } from './AdminKit'
import { bangkokMonthNow, buildMonthlyOwnerReport, buildReportPrompt, fetchMonthlyStock, splitStockLoss, stepMonth } from '../../utils/monthlyOwnerReport'
import { callGemini } from '../../utils/geminiOcrHelper'
import { exportElementImage, downloadDataUrl } from '../../utils/reportImageExport'

const baht = (n) => `฿${Math.round(Number(n) || 0).toLocaleString('th-TH')}`
const pctText = (n) => (n === null || n === undefined ? '—' : `${n.toLocaleString('th-TH', { maximumFractionDigits: 1 })}%`)
const signed = (n, partial) => (n === null || n === undefined ? 'ไม่มีข้อมูลเดือนก่อน' : `${n > 0 ? '+' : ''}${n.toLocaleString('th-TH', { maximumFractionDigits: 1 })}% จากเดือนก่อน${partial ? ' (เดือนนี้ยังไม่จบ)' : ''}`)

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const monthLabel = (ym) => {
    const [y, m] = ym.split('-').map(Number)
    return `${THAI_MONTHS[m - 1]} ${y + 543}`
}

function Section({ title, note, children }) {
    return (
        <section className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
            <div className="flex items-baseline justify-between gap-4 px-4 py-3 border-b border-[var(--color-rule)]">
                <h2 className="text-base font-semibold leading-7 text-[var(--color-ink)]">{title}</h2>
                {note && <span className="text-xs leading-5 text-[var(--color-neutral)] tabular-nums">{note}</span>}
            </div>
            <div className="p-4">{children}</div>
        </section>
    )
}

function Rows({ rows, empty }) {
    if (!rows.length) return <p className="text-sm leading-6 text-[var(--color-neutral)]">{empty}</p>
    return (
        <dl className="divide-y divide-[var(--color-rule)]">
            {rows.map((r) => (
                <div key={r.key || r.label} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-sm leading-6 text-[var(--color-ink)] min-w-0">{r.label}</dt>
                    <dd className={`text-sm leading-6 tabular-nums font-mono shrink-0 ${r.tone === 'plum' ? 'text-[var(--brand-plum)] font-semibold' : 'text-[var(--color-ink)]'}`}>{r.value}</dd>
                </div>
            ))}
        </dl>
    )
}

export default function MonthlyOwnerReport() {
    const [month, setMonth] = useState(() => stepMonth(bangkokMonthNow(), 0))
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [analysis, setAnalysis] = useState('')
    const [aiLoading, setAiLoading] = useState(false)
    const [stock, setStock] = useState(null)
    const [stockState, setStockState] = useState('idle') // idle | loading | done | error
    const reportRef = useRef(null)

    const load = useCallback(async (ym) => {
        setLoading(true)
        setError('')
        setAnalysis('')
        setStock(null)
        setStockState('loading')
        // Stock loss is slow (one reconciliation per counted day): it fills in after the rest.
        fetchMonthlyStock(ym)
            .then((st) => { setStock({ ym, ...st }); setStockState('done') })
            .catch((err) => { console.error('Monthly stock error:', err); setStockState('error') })
        try {
            setReport(await buildMonthlyOwnerReport(ym))
        } catch (err) {
            console.error('Monthly report error:', err)
            setError(err.message || 'โหลดข้อมูลไม่สำเร็จ')
            setReport(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load(month) }, [month, load])

    const generate = async () => {
        if (!report) return
        setAiLoading(true)
        try {
            const withStock = { ...report, stock: stockView || 'ยังโหลดข้อมูลสต็อกไม่เสร็จ' }
            const res = await callGemini('gemini-4-argon', {
                contents: [{ role: 'user', parts: [{ text: buildReportPrompt(withStock) }] }],
                generationConfig: { maxOutputTokens: 4096 },
            })
            if (!res.ok) throw new Error(res.error === 'MISSING_API_KEY' ? 'ยังไม่ได้ตั้งค่า AI key' : (res.error || 'AI ไม่ตอบ'))
            const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
            setAnalysis(text.replace(/\*\*/g, '').trim())
        } catch (err) {
            toast.error(`สร้างบทวิเคราะห์ไม่สำเร็จ: ${err.message}`)
        } finally {
            setAiLoading(false)
        }
    }

    const savePng = async () => {
        try {
            const url = await exportElementImage(reportRef.current, 1000)
            if (url) downloadDataUrl(url, `monthly-report-${month}.png`)
        } catch (err) {
            toast.error(`บันทึกรูปไม่สำเร็จ: ${err.message}`)
        }
    }

    const s = report?.sales
    const stockView = stock && report && stock.ym === month ? splitStockLoss(stock, report) : null
    const isFuture = month > bangkokMonthNow()

    return (
        <div className="max-w-6xl mx-auto font-sans text-[var(--color-ink)]">
            <AdminPageHeader
                title="รายงานประจำเดือน"
                description="ยอดขาย ต้นทุน และสต็อกที่หายของเดือน พร้อมบทวิเคราะห์จาก AI สำหรับเจ้าของร้าน"
                meta={report ? `${monthLabel(month)}${report.partial ? ` · ${report.partial.daysSoFar} จาก ${report.partial.daysInMonth} วัน` : ''} · ข้อมูลถึง ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })}` : monthLabel(month)}
                actions={(
                    <>
                        <div className="inline-flex items-stretch border border-[var(--color-rule)] bg-[var(--color-paper-2)] min-h-12">
                            <button type="button" onClick={() => setMonth((m) => stepMonth(m, -1))} aria-label="เดือนก่อนหน้า"
                                className="px-4 text-sm font-semibold hover:bg-[var(--color-paper)] border-r border-[var(--color-rule)] transition-colors cursor-pointer">ก่อนหน้า</button>
                            <input type="month" value={month} max={bangkokMonthNow()} onChange={(e) => e.target.value && setMonth(e.target.value)}
                                className="px-3 bg-transparent tabular-nums font-mono text-sm focus:outline-none" aria-label="เลือกเดือน" />
                            <button type="button" onClick={() => setMonth((m) => stepMonth(m, 1))} disabled={month >= bangkokMonthNow()} aria-label="เดือนถัดไป"
                                className="px-4 text-sm font-semibold hover:bg-[var(--color-paper)] border-l border-[var(--color-rule)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">ถัดไป</button>
                        </div>
                        <button type="button" onClick={savePng} disabled={!report || loading} data-export-hide
                            className="min-h-12 px-4 text-sm font-semibold border border-[var(--brand-plum)] text-[var(--brand-plum)] hover:bg-[var(--color-paper-2)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                            บันทึกเป็นรูป
                        </button>
                    </>
                )}
            />

            {loading && <AdminSkeletonRows rows={8} />}
            {!loading && error && (
                <p className="border border-[var(--error-red)] text-[var(--error-red)] p-4 text-sm leading-6">โหลดข้อมูลไม่สำเร็จ: {error}</p>
            )}
            {!loading && !error && isFuture && (
                <p className="text-sm leading-6 text-[var(--color-neutral)]">ยังไม่ถึงเดือนนี้</p>
            )}

            {!loading && report && (
                <div ref={reportRef} className="space-y-6 bg-[var(--color-paper)]">
                    <AdminStatStrip items={[
                        { label: 'ยอดขายสุทธิ', value: baht(s.net), note: signed(report.change.netPct, report.partial) },
                        { label: 'จำนวนบิล', value: s.bills.toLocaleString('th-TH'), note: signed(report.change.billsPct, report.partial) },
                        { label: 'ลูกค้า', value: `${s.pax.toLocaleString('th-TH')} ท่าน`, note: `เฉลี่ย ${baht(s.perHead)} ต่อหัว` },
                        { label: 'ค่าใช้จ่ายที่บันทึก', value: baht(report.expenses.total), note: `${pctText(report.ratios.expensesPct)} ของยอดขาย` },
                        { label: 'ยอดขาย − ค่าใช้จ่าย', value: baht(report.result), tone: 'accent', note: 'ก่อนค่าแรงจากระบบ HR' },
                    ]} className="mb-0" />

                    <section className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-rule)]">
                            <div>
                                <h2 className="text-base font-semibold leading-7">บทวิเคราะห์สำหรับเจ้าของร้าน</h2>
                                <p className="text-xs leading-5 text-[var(--color-neutral)]">AI อ่านจากตัวเลขในหน้านี้เท่านั้น ใช้เวลาประมาณ 20–40 วินาที</p>
                            </div>
                            <button type="button" onClick={generate} disabled={aiLoading} data-export-hide
                                className="min-h-12 px-5 text-sm font-semibold bg-[var(--action-primary)] text-[var(--on-action,var(--cream))] hover:bg-[var(--action-primary-hover)] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait">
                                {aiLoading ? 'กำลังวิเคราะห์…' : analysis ? 'วิเคราะห์ใหม่' : 'สร้างบทวิเคราะห์'}
                            </button>
                        </div>
                        <div className="p-4">
                            {analysis
                                ? <div className="text-base leading-7 whitespace-pre-wrap break-words [line-break:strict]">{analysis}</div>
                                : <p className="text-sm leading-6 text-[var(--color-neutral)]">{aiLoading ? 'กำลังอ่านตัวเลขของเดือนนี้…' : 'กดสร้างบทวิเคราะห์เมื่อต้องการ (เรียก AI 1 ครั้งต่อการกด)'}</p>}
                        </div>
                    </section>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Section title="ยอดขาย" note={`เปิดขาย ${s.openDays} วัน`}>
                            <Rows rows={[
                                { label: 'ยอดขายก่อนส่วนลด', value: baht(s.gross) },
                                { label: 'ส่วนลด', value: baht(s.discount) },
                                { label: 'เฉลี่ยต่อบิล', value: baht(s.perBill) },
                                { label: 'เฉลี่ยต่อวันที่เปิด', value: baht(s.perOpenDay) },
                                { label: 'ทานที่ร้าน', value: baht(s.dineIn) },
                                { label: 'ซื้อกลับ', value: baht(s.takeaway) },
                                { label: 'โอน / QR', value: baht(s.payments.qr) },
                                { label: 'เงินสด', value: baht(s.payments.cash) },
                                { label: 'บัตร', value: baht(s.payments.credit) },
                                { label: 'กระเป๋าสมาชิก', value: baht(s.payments.wallet) },
                            ]} />
                        </Section>

                        <Section title="ขายตามวันในสัปดาห์" note="เฉลี่ยต่อวันที่เปิด">
                            <Rows rows={s.weekday.filter((w) => w.days > 0).map((w) => ({ label: `วัน${w.label}`, value: `${baht(w.avg)} · ${w.days} วัน` }))}
                                empty="ยังไม่มียอดขายในเดือนนี้" />
                        </Section>

                        <Section title="เมนูทำเงิน 10 อันดับ" note="ยอดขาย · กำไรขั้นต้น">
                            <Rows rows={s.topItems.map((it, i) => ({
                                key: it.name,
                                label: `${i + 1}. ${it.name} (${it.units.toLocaleString('th-TH')})`,
                                value: `${baht(it.revenue)} · ${it.marginPct === null ? '—' : `${it.marginPct}%`}`,
                                tone: it.marginPct !== null && it.marginPct < 50 ? 'plum' : undefined,
                            }))} empty="ยังไม่มีรายการขาย" />
                        </Section>

                        <Section title="ค่าใช้จ่ายตามหมวด" note={`${report.expenses.count} รายการ`}>
                            <Rows rows={[
                                ...report.expenses.byCategory.map((c) => ({ key: c.id, label: c.label, value: baht(c.amount) })),
                                { key: 'raw', label: 'วัตถุดิบต่อยอดขาย', value: pctText(report.ratios.rawMaterialPct), tone: 'plum' },
                                { key: 'wage', label: 'ค่าแรงที่บันทึกต่อยอดขาย', value: pctText(report.ratios.wagesPct), tone: 'plum' },
                            ]} empty="ยังไม่มีค่าใช้จ่ายที่บันทึก" />
                        </Section>

                        <Section title="สต็อกที่หาย" note={stockView ? `นับจริง ${stockView.countDays} วัน · ${stockView.countedItems} รายการ` : undefined}>
                            {stockState === 'loading' && <p className="text-sm leading-6 text-[var(--color-neutral)]">กำลังเทียบยอดนับกับยอดที่ควรเหลือ…</p>}
                            {stockState === 'error' && <p className="text-sm leading-6 text-[var(--error-red)]">โหลดข้อมูลสต็อกไม่สำเร็จ</p>}
                            {stockView && (
                                <>
                                    <Rows rows={[
                                        { key: 'short', label: 'มูลค่าของที่ขาดจากที่ควรเหลือ', value: baht(stockView.shortValue), tone: 'plum' },
                                        ...stockView.worst.map((w) => ({ key: w.name, label: `${w.name} (ผิดปกติ ${w.abnormalDays}/${w.daysCounted} วัน)`, value: baht(w.shortValue) })),
                                    ]} />
                                    {stockView.suspect.length > 0 && (
                                        <div className="mt-4 border-t border-[var(--color-rule)] pt-3">
                                            <p className="text-sm leading-6 font-semibold text-[var(--brand-plum)]">ตัวเลขผิดปกติ ควรตรวจหน่วยหรือต้นทุนต่อหน่วย ({stockView.suspect.length} รายการ)</p>
                                            <p className="text-xs leading-5 text-[var(--color-neutral)]">หายเกิน {baht(stockView.limit)} ต่อรายการ จึงไม่นับรวมในยอดด้านบน</p>
                                            <Rows rows={stockView.suspect.map((w) => ({ key: `s-${w.name}`, label: w.name, value: baht(w.shortValue) }))} />
                                        </div>
                                    )}
                                    {stockView.countDays === 0 && (
                                        <p className="mt-2 text-sm leading-6 text-[var(--color-neutral)]">เดือนนี้ยังไม่มีการนับสต็อก จึงยังคำนวณของที่หายไม่ได้</p>
                                    )}
                                </>
                            )}
                        </Section>

                        <Section title="ของเสียที่ทิ้ง" note="เบิกออกด้วยเหตุผลของเสีย">
                            {stockView
                                ? <Rows rows={stockView.topWaste.map((w) => ({ key: w.name, label: w.name, value: `${w.waste.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${w.unit || ''}`.trim() }))}
                                    empty="ไม่มีการบันทึกของเสียในเดือนนี้" />
                                : <p className="text-sm leading-6 text-[var(--color-neutral)]">{stockState === 'error' ? 'โหลดข้อมูลไม่สำเร็จ' : 'กำลังโหลด…'}</p>}
                        </Section>
                    </div>

                    <ul className="text-xs leading-5 text-[var(--color-neutral)] list-disc pl-5 space-y-1">
                        {report.notes.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                </div>
            )}
        </div>
    )
}
