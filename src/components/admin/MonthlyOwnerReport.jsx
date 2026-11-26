// /admin/monthly-report: one month of sales, costs and stock loss on one page,
// with an AI write-up for the owner (owner request 2026-11-26).
// Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import AdminPageHeader from './AdminPageHeader'
import { AdminSkeletonRows } from './AdminKit'
import { bangkokMonthNow, buildMonthlyOwnerReport, buildReportPrompt, fetchHrLabor, fetchMonthDailySales, fetchMonthlyStock, laborVsSales, splitStockLoss, stepMonth } from '../../utils/monthlyOwnerReport'
import { callGemini } from '../../utils/geminiOcrHelper'
import LaborGauge from './LaborGauge'
import { exportElementImage, downloadDataUrl } from '../../utils/reportImageExport'

const baht = (n) => `฿${Math.round(Number(n) || 0).toLocaleString('th-TH')}`
const pctText = (n) => (n === null || n === undefined ? '—' : `${n.toLocaleString('th-TH', { maximumFractionDigits: 1 })}%`)
const signed = (n, partial) => (n === null || n === undefined ? 'ไม่มีข้อมูลเดือนก่อน' : `${n > 0 ? '+' : ''}${n.toLocaleString('th-TH', { maximumFractionDigits: 1 })}% จากเดือนก่อน${partial ? ' (เดือนนี้ยังไม่จบ)' : ''}`)

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const monthLabel = (ym) => {
    const [y, m] = ym.split('-').map(Number)
    return `${THAI_MONTHS[m - 1]} ${y + 543}`
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-plum)] active:opacity-80'

/** A top-level group (sales, costs and labour, stock): display-face title over a 2px ink rule,
 *  its key figure on the right, so the groups read apart at a glance. */
function Group({ title, figure, figureNote, children }) {
    return (
        <section className="pt-4 border-t-2 border-[var(--color-ink)]">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-4">
                <h2 className="font-[family-name:var(--font-display)] font-normal text-[28px] leading-9 text-[var(--color-ink)] min-w-0 [overflow-wrap:break-word]">{title}</h2>
                {figure && (
                    <div className="text-right">
                        <span className="block font-mono tabular-nums text-2xl leading-8 font-medium text-[var(--color-ink)]">{figure}</span>
                        {figureNote && <span className="block text-xs leading-5 text-[var(--color-neutral)]">{figureNote}</span>}
                    </div>
                )}
            </div>
            <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">{children}</div>
        </section>
    )
}

/** One panel inside a group. Never nested in another panel. */
function Panel({ title, note, wide = false, children }) {
    return (
        <div className={`border border-[var(--color-rule)] bg-[var(--color-paper)] ${wide ? 'lg:col-span-2' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 pt-3 pb-2">
                <h3 className="text-sm font-semibold leading-6 text-[var(--color-ink)]">{title}</h3>
                {note && <span className="text-xs leading-5 text-[var(--color-neutral)]">{note}</span>}
            </div>
            <div className="px-4 pb-4">{children}</div>
        </div>
    )
}

function Note({ children, tone }) {
    return <p className={`text-sm leading-6 ${tone === 'error' ? 'text-[var(--error-red)]' : 'text-[var(--color-neutral)]'}`}>{children}</p>
}

function Rows({ rows, empty }) {
    if (!rows.length) return <Note>{empty}</Note>
    return (
        <dl className="divide-y divide-[var(--color-rule)]">
            {rows.map((r) => (
                <div key={r.key || r.label} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-sm leading-6 text-[var(--color-ink)] min-w-0">{r.label}</dt>
                    <dd className={`text-sm leading-6 tabular-nums font-mono shrink-0 ${r.tone === 'plum' ? 'text-[var(--brand-plum)] font-medium' : 'text-[var(--color-ink)]'}`}>{r.value}</dd>
                </div>
            ))}
        </dl>
    )
}

/** Rows with a share bar under each, so categories compare by eye before reading numbers. */
function ShareRows({ rows, empty, max }) {
    if (!rows.length) return <Note>{empty}</Note>
    const top = max || Math.max(...rows.map((r) => Math.abs(r.amount) || 0), 1)
    return (
        <ul className="space-y-3">
            {rows.map((r) => (
                <li key={r.key || r.label}>
                    <div className="flex items-baseline justify-between gap-4">
                        <span className="text-sm leading-6 text-[var(--color-ink)] min-w-0">{r.label}</span>
                        <span className="text-sm leading-6 tabular-nums font-mono shrink-0 text-[var(--color-ink)]">{r.value}</span>
                    </div>
                    <div className="mt-1 h-1.5 bg-[var(--color-paper-3)]" aria-hidden="true">
                        <div className={`h-full ${r.tone === 'muted' ? 'bg-[var(--color-neutral)]' : 'bg-[var(--brand-plum)]'}`} style={{ width: `${Math.max(2, Math.min(100, (Math.abs(r.amount) / top) * 100))}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    )
}

/** The month as one sum: sales minus costs minus labour equals what is left. */
function BottomLine({ sales, expenses, labor, left, laborPending }) {
    const term = (label, value, sign) => (
        <div className="min-w-0">
            <span className="block text-xs leading-5 text-[var(--on-plum-2)]">{label}</span>
            <span className="block font-mono tabular-nums text-xl leading-8 text-[var(--cream)]">{sign}{value}</span>
        </div>
    )
    return (
        <section aria-label="สรุปเดือนนี้" className="bg-[var(--brand-plum)] text-[var(--cream)] p-5 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 items-end">
                {term('ยอดขายสุทธิ', sales, '')}
                {term('ค่าใช้จ่ายที่บันทึก', expenses, '− ')}
                {labor ? term('ค่าแรงจากระบบ HR', labor, '− ') : (
                    <div className="min-w-0">
                        <span className="block text-xs leading-5 text-[var(--on-plum-2)]">ค่าแรงจากระบบ HR</span>
                        <span className="block text-sm leading-8 text-[var(--on-plum-2)]">{laborPending ? 'กำลังโหลด…' : 'ยังไม่รวม (อ่าน HR ไม่ได้)'}</span>
                    </div>
                )}
                <div className="min-w-0 col-span-2 sm:col-span-1 sm:border-l sm:border-[var(--brand-plum-3)] sm:pl-6">
                    <span className="block text-xs leading-5 text-[var(--on-plum-2)]">เหลือ</span>
                    <span className="block font-mono tabular-nums text-[32px] leading-10 font-medium text-[var(--cream)]">{left}</span>
                </div>
            </div>
        </section>
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
    const [labor, setLabor] = useState(null) // { ym, hr, daily } from the HR system
    const [laborState, setLaborState] = useState('idle')
    const reportRef = useRef(null)

    const load = useCallback(async (ym) => {
        setLoading(true)
        setError('')
        setAnalysis('')
        setStock(null)
        setStockState('loading')
        // Stock loss is slow (one reconciliation per counted day): it fills in after the rest.
        setLabor(null)
        setLaborState('loading')
        Promise.all([fetchHrLabor(ym), fetchMonthDailySales(ym)])
            .then(([hr, daily]) => { setLabor(hr ? { ym, hr, daily } : null); setLaborState(hr ? 'done' : 'unavailable') })
            .catch(() => setLaborState('unavailable'))
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
            const withStock = {
                ...report,
                stock: stockView || 'ยังโหลดข้อมูลสต็อกไม่เสร็จ',
                hrLabor: hr
                    ? { gross: hr.gross, net: hr.net, headcount: hr.headcount, overtime: hr.overtime, laborPctMonth: laborRatio?.monthToDate?.pct ?? null, laborPctLast7: laborRatio?.last7?.pct ?? null, salesMinusExpensesAndHrLabor: resultAfterLabor }
                    : 'ไม่มีข้อมูลค่าแรงจากระบบ HR',
            }
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
    const hr = labor && labor.ym === month ? labor.hr : null
    const lastDayWithData = report ? `${month}-${String(report.partial?.daysSoFar || new Date(Date.UTC(...month.split('-').map(Number), 0)).getUTCDate()).padStart(2, '0')}` : null
    const laborRatio = hr && labor?.daily ? laborVsSales(labor.daily, hr, lastDayWithData) : null
    // With HR labour: wages recorded as expenses are replaced by HR's figure, not counted twice.
    const recordedWages = report?.expenses?.byCategory?.find((c) => c.id === 'staff_wages')?.amount || 0
    const resultAfterLabor = report && hr ? Math.round((report.result + recordedWages - hr.gross) * 100) / 100 : null
    const isFuture = month > bangkokMonthNow()

    return (
        <div className="max-w-6xl mx-auto font-sans text-[var(--color-ink)]">
            <AdminPageHeader
                title="รายงานประจำเดือน"
                description="ยอดขาย ต้นทุน และสต็อกที่หายของเดือน พร้อมบทวิเคราะห์จาก AI สำหรับเจ้าของร้าน"
                meta={report ? `${monthLabel(month)}${report.partial ? ` (ข้อมูล ${report.partial.daysSoFar} จาก ${report.partial.daysInMonth} วัน)` : ''}, อัปเดต ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })}` : monthLabel(month)}
                actions={(
                    <>
                        <div className="inline-flex items-stretch border border-[var(--color-rule)] bg-[var(--color-paper-2)] min-h-12">
                            <button type="button" onClick={() => setMonth((m) => stepMonth(m, -1))} aria-label="เดือนก่อนหน้า"
                                className={`px-4 text-sm font-semibold hover:bg-[var(--color-paper)] border-r border-[var(--color-rule)] transition-colors cursor-pointer ${FOCUS}`}>ก่อนหน้า</button>
                            <input type="month" value={month} max={bangkokMonthNow()} onChange={(e) => e.target.value && setMonth(e.target.value)}
                                className={`px-3 bg-transparent tabular-nums font-mono text-sm focus:outline-none ${FOCUS}`} aria-label="เลือกเดือน" />
                            <button type="button" onClick={() => setMonth((m) => stepMonth(m, 1))} disabled={month >= bangkokMonthNow()} aria-label="เดือนถัดไป"
                                className={`px-4 text-sm font-semibold hover:bg-[var(--color-paper)] border-l border-[var(--color-rule)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`}>ถัดไป</button>
                        </div>
                        <button type="button" onClick={savePng} disabled={!report || loading} data-export-hide
                            className={`min-h-12 px-4 text-sm font-semibold border border-[var(--brand-plum)] text-[var(--brand-plum)] hover:bg-[var(--color-paper-2)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`}>
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
                <div ref={reportRef} className="space-y-10 bg-[var(--color-paper)]">
                    <BottomLine
                        sales={baht(s.net)}
                        expenses={baht(hr ? report.expenses.total - recordedWages : report.expenses.total)}
                        labor={hr ? baht(hr.gross) : null}
                        left={baht(hr ? resultAfterLabor : report.result)}
                        laborPending={laborState === 'loading'}
                    />

                    <section className="border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
                            <div>
                                <h2 className="text-base font-semibold leading-7">บทวิเคราะห์สำหรับเจ้าของร้าน</h2>
                                <p className="text-xs leading-5 text-[var(--color-neutral)]">AI อ่านจากตัวเลขในหน้านี้เท่านั้น ใช้เวลาประมาณ 20 ถึง 40 วินาที</p>
                            </div>
                            <button type="button" onClick={generate} disabled={aiLoading} data-export-hide
                                className={`min-h-12 px-5 text-sm font-semibold bg-[var(--action-primary)] text-[var(--on-action)] hover:bg-[var(--action-primary-hover)] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait ${FOCUS}`}>
                                {aiLoading ? 'กำลังวิเคราะห์…' : analysis ? 'วิเคราะห์ใหม่' : 'สร้างบทวิเคราะห์'}
                            </button>
                        </div>
                        {(analysis || aiLoading) && (
                            <div className="px-4 pb-4">
                                {analysis
                                    ? <div className="max-w-[72ch] text-base leading-7 whitespace-pre-wrap break-words [line-break:strict]">{analysis}</div>
                                    : <Note>กำลังอ่านตัวเลขของเดือนนี้…</Note>}
                            </div>
                        )}
                    </section>

                    <Group title="ยอดขาย" figure={baht(s.net)} figureNote={signed(report.change.netPct, report.partial)}>
                        <Panel title="ภาพรวม" note={`เปิดขาย ${s.openDays} วัน`}>
                            <Rows rows={[
                                { label: 'จำนวนบิล', value: s.bills.toLocaleString('th-TH') },
                                { label: 'ลูกค้า', value: `${s.pax.toLocaleString('th-TH')} ท่าน` },
                                { label: 'เฉลี่ยต่อหัว', value: baht(s.perHead) },
                                { label: 'เฉลี่ยต่อบิล', value: baht(s.perBill) },
                                { label: 'เฉลี่ยต่อวันที่เปิด', value: baht(s.perOpenDay) },
                                { label: 'ยอดก่อนส่วนลด', value: baht(s.gross) },
                                { label: 'ส่วนลด', value: baht(s.discount) },
                            ]} />
                        </Panel>
                        <Panel title="ช่องทางขายและการชำระ">
                            <ShareRows rows={[
                                { key: 'dine', label: 'ทานที่ร้าน', amount: s.dineIn, value: baht(s.dineIn) },
                                { key: 'take', label: 'ซื้อกลับ', amount: s.takeaway, value: baht(s.takeaway) },
                            ]} max={s.net} />
                            <div className="mt-5">
                                <ShareRows rows={[
                                    { key: 'qr', label: 'โอน / QR', amount: s.payments.qr, value: baht(s.payments.qr) },
                                    { key: 'cash', label: 'เงินสด', amount: s.payments.cash, value: baht(s.payments.cash) },
                                    { key: 'card', label: 'บัตร', amount: s.payments.credit, value: baht(s.payments.credit) },
                                    { key: 'wallet', label: 'กระเป๋าสมาชิก', amount: s.payments.wallet, value: baht(s.payments.wallet) },
                                ].filter((r) => r.amount > 0)} max={s.net} empty="ยังไม่มีการชำระ" />
                            </div>
                        </Panel>
                        <Panel title="ขายตามวันในสัปดาห์" note="เฉลี่ยต่อวันที่เปิด">
                            <ShareRows rows={s.weekday.filter((w) => w.days > 0).map((w) => ({ key: w.label, label: `วัน${w.label} (${w.days} วัน)`, amount: w.avg, value: baht(w.avg) }))}
                                empty="ยังไม่มียอดขายในเดือนนี้" />
                        </Panel>
                        <Panel title="เมนูทำเงิน 10 อันดับ">
                            {s.topItems.length === 0 ? <Note>ยังไม่มีรายการขาย</Note> : (
                                <table className="w-full text-sm leading-6">
                                    <thead>
                                        <tr className="text-xs leading-5 text-[var(--color-neutral)] text-left">
                                            <th className="font-normal pb-1">เมนู</th>
                                            <th className="font-normal pb-1 text-right">ยอดขาย</th>
                                            <th className="font-normal pb-1 text-right pl-3">กำไรขั้นต้น</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-rule)]">
                                        {s.topItems.map((it) => (
                                            <tr key={it.name}>
                                                <td className="py-2 pr-3 align-top [overflow-wrap:anywhere]">{it.name} <span className="text-[var(--color-neutral)] tabular-nums">({it.units.toLocaleString('th-TH')})</span></td>
                                                <td className="py-2 text-right font-mono tabular-nums align-top whitespace-nowrap">{baht(it.revenue)}</td>
                                                <td className={`py-2 pl-3 text-right font-mono tabular-nums align-top ${it.marginPct !== null && it.marginPct < 50 ? 'text-[var(--brand-plum)] font-medium' : ''}`}>{it.marginPct === null ? '—' : `${it.marginPct}%`}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </Panel>
                    </Group>

                    <Group title="ต้นทุนและค่าแรง"
                        figure={baht(hr ? report.expenses.total - recordedWages + hr.gross : report.expenses.total)}
                        figureNote={hr ? `ค่าแรงเฉลี่ย ${pctText(laborRatio?.monthToDate?.pct)} ของยอดขาย` : `${pctText(report.ratios.expensesPct)} ของยอดขาย`}>
                        <Panel title="ค่าใช้จ่ายตามหมวด" note={`${report.expenses.count} รายการ`}>
                            <ShareRows rows={report.expenses.byCategory.map((c) => ({ key: c.id, label: c.label, amount: c.amount, value: baht(c.amount) }))}
                                empty="ยังไม่มีค่าใช้จ่ายที่บันทึก" />
                            <div className="mt-4">
                                <Rows rows={[{ key: 'raw', label: 'วัตถุดิบต่อยอดขาย', value: pctText(report.ratios.rawMaterialPct), tone: 'plum' }]} />
                            </div>
                        </Panel>
                        <Panel title="ค่าแรงจากระบบ HR" note={hr ? `${hr.headcount} คน` : undefined}>
                            {laborState === 'loading' && <Note>กำลังโหลดเงินเดือนจากระบบ HR…</Note>}
                            {laborState === 'unavailable' && <Note>อ่านข้อมูลจากระบบ HR ไม่ได้ในตอนนี้ ยอดสรุปด้านบนจึงยังไม่รวมค่าแรง</Note>}
                            {hr && (
                                <>
                                    <div className="pb-3 mb-3 border-b border-[var(--color-rule)]">
                                        <LaborGauge pct={laborRatio?.monthToDate?.pct} caption={`ค่าเฉลี่ยทั้งเดือน ${pctText(laborRatio?.monthToDate?.pct)}`} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pb-3 mb-1 border-b border-[var(--color-rule)]">
                                        <div>
                                            <span className="block text-xs leading-5 text-[var(--color-neutral)]">เฉลี่ยทั้งเดือน</span>
                                            <span className="block font-mono tabular-nums text-2xl leading-8 text-[var(--brand-plum)]">{pctText(laborRatio?.monthToDate?.pct)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs leading-5 text-[var(--color-neutral)]">เฉลี่ย 7 วันล่าสุด</span>
                                            <span className="block font-mono tabular-nums text-2xl leading-8 text-[var(--color-ink)]">{pctText(laborRatio?.last7?.pct)}</span>
                                        </div>
                                    </div>
                                    <Rows rows={[
                                        { key: 'gross', label: 'ค่าแรงรวม (ต้นทุนของร้าน)', value: baht(hr.gross) },
                                        { key: 'wages', label: 'ค่าจ้างและเงินเดือน', value: baht(hr.wages) },
                                        { key: 'ot', label: 'ค่าล่วงเวลา', value: baht(hr.overtime) },
                                        { key: 'allow', label: 'เบี้ยเลี้ยงและโบนัส', value: baht(hr.allowances) },
                                        { key: 'ded', label: 'หักจากพนักงาน (ประกันสังคม ภาษี ขาด/สาย)', value: baht(hr.deductions) },
                                        { key: 'net', label: 'จ่ายจริงให้พนักงาน', value: baht(hr.net) },
                                    ]} />
                                    <div className="mt-4">
                                        <ShareRows rows={hr.byPosition.map((pos) => ({ key: pos.position, label: `${pos.position} (${pos.headcount} คน)`, amount: pos.gross, value: baht(pos.gross), tone: 'muted' }))} />
                                    </div>
                                    <p className="mt-3 text-xs leading-5 text-[var(--color-neutral)]">รายวันขึ้นลงตามยอดขาย วันเงียบดูสูงเป็นปกติ ดูค่าเฉลี่ยเป็นหลัก{recordedWages ? ` ค่าใช้จ่ายหมวดเงินเดือนที่บันทึกในหลังบ้าน (${baht(recordedWages)}) ไม่นับซ้ำ` : ''}</p>
                                </>
                            )}
                        </Panel>
                    </Group>

                    <Group title="สต็อก"
                        figure={stockView ? baht(stockView.shortValue) : null}
                        figureNote={stockView ? `ของขาดจากที่ควรเหลือ นับจริง ${stockView.countDays} วัน` : null}>
                        <Panel title="ของที่หายมากที่สุด">
                            {stockState === 'loading' && <Note>กำลังเทียบยอดนับกับยอดที่ควรเหลือ…</Note>}
                            {stockState === 'error' && <Note tone="error">โหลดข้อมูลสต็อกไม่สำเร็จ ลองเปลี่ยนเดือนแล้วกลับมาใหม่</Note>}
                            {stockView && (stockView.countDays === 0
                                ? <Note>เดือนนี้ยังไม่มีการนับสต็อก จึงยังคำนวณของที่หายไม่ได้</Note>
                                : <ShareRows rows={stockView.worst.map((w) => ({ key: w.name, label: `${w.name} (ผิดปกติ ${w.abnormalDays} จาก ${w.daysCounted} วัน)`, amount: w.shortValue, value: baht(w.shortValue) }))}
                                    empty="ไม่มีของขาด" />)}
                        </Panel>
                        <Panel title="ของเสียที่ทิ้ง" note="เบิกออกด้วยเหตุผลของเสีย">
                            {stockView
                                ? <Rows rows={stockView.topWaste.map((w) => ({ key: w.name, label: w.name, value: `${w.waste.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${w.unit || ''}`.trim() }))}
                                    empty="ไม่มีการบันทึกของเสียในเดือนนี้" />
                                : <Note tone={stockState === 'error' ? 'error' : undefined}>{stockState === 'error' ? 'โหลดข้อมูลไม่สำเร็จ' : 'กำลังโหลด…'}</Note>}
                        </Panel>
                        {stockView?.suspect?.length > 0 && (
                            <Panel title={`ควรตรวจหน่วยหรือต้นทุนต่อหน่วย (${stockView.suspect.length} รายการ)`} note={`หายเกิน ${baht(stockView.limit)} ต่อรายการ ไม่นับในยอดรวม`} wide>
                                <Rows rows={stockView.suspect.map((w) => ({ key: `s-${w.name}`, label: w.name, value: baht(w.shortValue), tone: 'plum' }))} />
                            </Panel>
                        )}
                    </Group>

                    <ul className="text-xs leading-5 text-[var(--color-neutral)] list-disc pl-5 space-y-1">
                        {report.notes.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                </div>
            )}
        </div>
    )
}
