// A simple gauge for labour as a share of sales (owner request 2026-11-26).
// Reads the AVERAGE, never one day: a quiet day always looks high.
//
// Zones from restaurant industry references:
// - most full-service restaurants run labour at 25 to 35% of sales (Toast)
// - US full-service median 36.5% incl. benefits in 2024 (National Restaurant Association)
// Thai wages are lower, so the shop's own bands are: up to 30% safe, 30 to 35% watch,
// above 35% high. Change LABOR_BANDS if the owner sets different targets.
// Colours follow brand v2: plum shades only; red stays for errors.
// Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5

export const LABOR_BANDS = { safe: 30, watch: 35, scaleMax: 50 }

export function laborZone(pct) {
    if (pct === null || pct === undefined || !Number.isFinite(pct)) return null
    if (pct <= LABOR_BANDS.safe) return { key: 'safe', label: 'ปลอดภัย', note: `ไม่เกิน ${LABOR_BANDS.safe}% ตามเกณฑ์ร้านอาหารทั่วไป` }
    if (pct <= LABOR_BANDS.watch) return { key: 'watch', label: 'เฝ้าระวัง', note: `${LABOR_BANDS.safe} ถึง ${LABOR_BANDS.watch}% ยังอยู่ในช่วงปกติของร้านนั่งทาน ควรดูกะช่วงเงียบ` }
    return { key: 'high', label: 'สูง', note: `เกิน ${LABOR_BANDS.watch}% ควรปรับกะหรือเพิ่มยอดขายช่วงเงียบ` }
}

export default function LaborGauge({ pct, caption = 'ค่าเฉลี่ยทั้งเดือน' }) {
    const zone = laborZone(pct)
    if (!zone) return null
    const max = LABOR_BANDS.scaleMax
    const at = (v) => `${Math.min(100, (v / max) * 100)}%`
    const pos = Math.max(0, Math.min(100, (pct / max) * 100))
    const tone = {
        safe: 'bg-[var(--color-paper-2)] text-[var(--brand-plum)] border-[var(--color-rule)]',
        watch: 'bg-[var(--on-plum-2)] text-[var(--brand-plum)] border-[var(--on-plum-2)]',
        high: 'bg-[var(--brand-plum)] text-[var(--cream)] border-[var(--brand-plum)]',
    }[zone.key]

    return (
        <figure className="font-sans" aria-label={`ค่าแรงต่อยอดขาย ${caption} ${pct}% ระดับ${zone.label}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <figcaption className="text-xs leading-5 text-[var(--color-neutral)]">{caption}</figcaption>
                <span className={`inline-block border px-2 text-sm leading-6 font-semibold ${tone}`}>{zone.label}</span>
            </div>
            <div className="relative mt-2 h-3" aria-hidden="true">
                <div className="absolute inset-y-0 left-0 bg-[var(--color-paper-3)]" style={{ width: at(LABOR_BANDS.safe) }} />
                <div className="absolute inset-y-0 bg-[var(--on-plum-2)]" style={{ left: at(LABOR_BANDS.safe), width: `calc(${at(LABOR_BANDS.watch)} - ${at(LABOR_BANDS.safe)})` }} />
                <div className="absolute inset-y-0 right-0 bg-[var(--brand-plum-3)]" style={{ left: at(LABOR_BANDS.watch) }} />
                <div className="absolute -top-1 -bottom-1 w-1 bg-[var(--color-ink)]" style={{ left: `calc(${pos}% - 2px)` }} />
            </div>
            <div className="relative mt-1 h-5 text-xs leading-5 text-[var(--color-neutral)] tabular-nums" aria-hidden="true">
                <span className="absolute left-0">0%</span>
                <span className="absolute -translate-x-1/2" style={{ left: at(LABOR_BANDS.safe) }}>{LABOR_BANDS.safe}%</span>
                <span className="absolute -translate-x-1/2" style={{ left: at(LABOR_BANDS.watch) }}>{LABOR_BANDS.watch}%</span>
                <span className="absolute right-0">{max}%+</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--color-neutral)]">{zone.note}</p>
        </figure>
    )
}
