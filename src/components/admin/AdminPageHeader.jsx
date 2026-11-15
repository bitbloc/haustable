// eslint-disable-next-line no-unused-vars
import { motion, useReducedMotion } from 'framer-motion'

/**
 * One title row for every backoffice hub: a noun title, one line about the data,
 * real actions on the right, and (optionally) the hub's tabs on a full-width hairline.
 * Buttons inside `actions` use the .admin-btn classes from AdminLayout.css.
 */
export default function AdminPageHeader({ title, description, meta, actions, children, className = 'mb-6' }) {
    return (
        <header className={`font-sans text-[oklch(18%_0.012_28)] ${className}`}>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold leading-9 text-[oklch(18%_0.012_28)]">{title}</h1>
                    {description && (
                        <p className="mt-1 text-sm leading-6 text-[oklch(42%_0.010_28)] max-w-[72ch]">{description}</p>
                    )}
                    {meta && (
                        <p className="mt-1 text-[13px] leading-5 text-[oklch(50%_0.010_28)] tabular-nums">{meta}</p>
                    )}
                </div>
                {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
            </div>
            {children && <div className="mt-4">{children}</div>}
        </header>
    )
}

/**
 * Underline tabs. `tabs`: [{ id, label, count?, alert? }]. Scrolls sideways inside
 * its own row on narrow screens; the page never does.
 */
export function AdminTabs({ tabs, active, onChange, layoutId = 'admin-tabs-underline', trailing = null, ariaLabel }) {
    const reduceMotion = useReducedMotion()
    return (
        <div className="flex items-end gap-6 border-b border-[oklch(88%_0.012_28)] font-sans">
            <div className="flex gap-6 overflow-x-auto no-scrollbar min-w-0 flex-1" role="tablist" aria-label={ariaLabel}>
                {tabs.map((tab) => {
                    const on = active === tab.id
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            onClick={() => onChange(tab.id)}
                            className={`relative h-11 flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)] focus-visible:-outline-offset-2 ${
                                on ? 'text-[oklch(18%_0.012_28)] font-medium' : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                            }`}
                        >
                            <span>{tab.label}</span>
                            {tab.count !== undefined && tab.count !== null && (
                                <span className={`text-xs tabular-nums ${tab.alert ? 'text-[oklch(52%_0.16_28)] font-semibold' : 'text-[oklch(55%_0.010_28)] font-normal'}`}>
                                    {tab.count}
                                </span>
                            )}
                            {on && (
                                <motion.span
                                    layoutId={layoutId}
                                    className="absolute left-0 right-0 bottom-0 h-0.5 bg-[oklch(18%_0.012_28)]"
                                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42, mass: 0.6 }}
                                />
                            )}
                        </button>
                    )
                })}
            </div>
            {trailing && <div className="hidden md:flex items-center h-11 shrink-0">{trailing}</div>}
        </div>
    )
}
