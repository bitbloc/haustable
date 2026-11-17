// eslint-disable-next-line no-unused-vars
import { motion, useReducedMotion } from 'framer-motion'
import { Search, X } from 'lucide-react'

const INK = 'text-[var(--color-ink)]'
const MUTED = 'text-[var(--color-muted)]'
const SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.6 }

/**
 * Headline numbers as one container split by hairlines (no tile per number).
 * items: [{ key, label, value, note?, tone?: 'accent' | 'positive', onClick?, active? }]
 * A cell with onClick doubles as a filter for the list below it.
 */
export function AdminStatStrip({ items, className = 'mb-6' }) {
    const cols = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' }[items.length] || 'lg:grid-cols-4'
    return (
        <div className={`admin-stat-strip font-sans grid grid-cols-2 ${items.length > 4 ? 'sm:grid-cols-3' : ''} ${cols} border border-[var(--color-paper-3)] rounded-lg overflow-hidden bg-[var(--color-paper)] ${className}`}>
            {items.map((it) => {
                const valueTone = it.tone === 'accent' ? 'text-[var(--brand-plum)]' : INK
                const body = (
                    <>
                        <span className={`block text-xs leading-5 ${it.active ? `${INK} font-medium` : MUTED}`}>{it.label}</span>
                        <span className={`block mt-1 text-2xl leading-8 font-semibold tabular-nums ${valueTone}`}>{it.value}</span>
                        {it.note && (
                            <span className={`hidden sm:block mt-1 text-xs leading-5 ${it.tone === 'positive' ? 'text-[oklch(40%_0.08_140)]' : 'text-[var(--color-neutral)]'}`}>{it.note}</span>
                        )}
                    </>
                )
                const cell = 'admin-stat-cell relative flex flex-col justify-start text-left p-4 min-w-0'
                return it.onClick ? (
                    <button
                        key={it.key || it.label}
                        type="button"
                        onClick={it.onClick}
                        aria-pressed={Boolean(it.active)}
                        className={`${cell} cursor-pointer transition-colors hover:bg-[var(--color-paper)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] focus-visible:-outline-offset-2 ${it.active ? 'bg-[var(--color-paper)]' : ''}`}
                    >
                        {body}
                        {it.active && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-[var(--color-ink)]" />}
                    </button>
                ) : (
                    <div key={it.key || it.label} className={cell}>{body}</div>
                )
            })}
        </div>
    )
}

/**
 * Filter chips in one row that scrolls sideways inside itself. The selected chip
 * is a neutral pill that glides between options.
 * options: [{ key, label, count? }]
 */
export function AdminFilterChips({ options, value, onChange, layoutId, label, className = '' }) {
    const reduceMotion = useReducedMotion()
    return (
        <div className={`flex items-center gap-1 overflow-x-auto no-scrollbar font-sans min-w-0 ${className}`} role="group" aria-label={label}>
            {options.map((o) => {
                const on = value === o.key
                return (
                    <button
                        key={o.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange(o.key)}
                        className={`relative h-8 px-3 rounded-md text-[13px] whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] ${on ? `${INK} font-medium` : `${MUTED} hover:text-[var(--color-ink)]`}`}
                    >
                        {on && (
                            <motion.span
                                layoutId={layoutId}
                                className="absolute inset-0 rounded-md bg-[var(--color-paper-2)]"
                                transition={reduceMotion ? { duration: 0 } : SPRING}
                            />
                        )}
                        <span className="relative">{o.label}</span>
                        {o.count > 0 && <span className="relative text-xs tabular-nums text-[var(--color-neutral)] font-normal">{o.count}</span>}
                    </button>
                )
            })}
        </div>
    )
}

export function AdminSearch({ value, onChange, placeholder, className = '' }) {
    return (
        <label className={`flex items-center gap-2 h-10 px-3 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper)] font-sans focus-within:border-[var(--color-ink)] transition-colors ${className}`}>
            <Search size={16} strokeWidth={1.5} className="text-[var(--color-neutral)] shrink-0" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className={`w-full min-w-0 bg-transparent text-sm ${INK} placeholder:text-[var(--color-neutral)] focus:outline-none`}
            />
            {value && (
                <button type="button" onClick={() => onChange('')} aria-label="ล้างคำค้น" className="text-[var(--color-neutral)] hover:text-[var(--color-ink)] cursor-pointer shrink-0">
                    <X size={16} strokeWidth={1.5} />
                </button>
            )}
        </label>
    )
}

export function AdminSelect({ value, onChange, options, label, className = '' }) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className={`h-10 pl-3 pr-8 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper)] font-sans text-[13px] ${INK} cursor-pointer focus:outline-none focus:border-[var(--color-ink)] ${className}`}
        >
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
    )
}

/**
 * Placeholder rows in the shape of a list (time, name, amount), shown only while a list has
 * nothing to show yet. It holds the list's height so the page does not collapse and re-grow.
 */
export function AdminSkeletonRows({ rows = 6, className = '' }) {
    return (
        <div className={`admin-skel border border-[var(--color-paper-3)] rounded-lg divide-y divide-[var(--color-paper-3)] ${className}`} aria-busy="true" aria-label="กำลังโหลด">
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="h-12 px-4 flex items-center gap-4">
                    <span className="h-3 w-12 rounded-sm bg-[var(--color-paper-2)]" />
                    <span className="h-3 w-16 rounded-sm bg-[var(--color-paper-2)]" />
                    <span className="h-3 flex-1 max-w-[40%] rounded-sm bg-[var(--color-paper-2)]" />
                    <span className="h-3 w-14 ml-auto rounded-sm bg-[var(--color-paper-2)]" />
                </div>
            ))}
        </div>
    )
}

/** A hub's filter bar: one bordered panel, rows split by a hairline. */
export function AdminToolbar({ children, className = 'mb-4' }) {
    return (
        <div className={`font-sans border border-[var(--color-paper-3)] rounded-lg bg-[var(--color-paper)] divide-y divide-[var(--color-paper-3)] ${className}`}>
            {children}
        </div>
    )
}

/**
 * Tab body that settles in with a short fade and 4px rise. No exit animation and
 * no "wait" mode, so switching tabs never waits on the outgoing panel.
 */
export function AdminTabPanel({ id, children, className = '' }) {
    const reduceMotion = useReducedMotion()
    return (
        <motion.div
            key={id}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    )
}
