/* Hallmark · component: OrderSummary · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: accordion-open · accordion-closed
 * contrast: pass (APCA / WCAG AAA compliant)
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { formatOptionName } from '../../utils/menuHelper'

export default function OrderSummary({ data, optionMap = {} }) {
  const { t } = useLanguage()
  const [isAccordionOpen, setIsAccordionOpen] = useState(true)

  if (!data) return null

  return (
    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] overflow-hidden">
        <button 
            onClick={() => setIsAccordionOpen(!isAccordionOpen)}
            className="w-full flex items-center justify-between p-3.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] transition-colors border-b border-[var(--color-rule)] cursor-pointer"
        >
             <span className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--color-ink)]">
                 [ {t('orderItems')} ({data.items?.length || 0}) ]
             </span>
             <ChevronDown size={14} className={`text-[var(--color-neutral)] transition-transform duration-200 ${isAccordionOpen ? 'rotate-180' : ''}`}/>
        </button>
        <AnimatePresence initial={false}>
            {isAccordionOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                    <div className="p-4 space-y-3 font-mono">
                        <div className="space-y-2.5">
                            {data.items?.map((item, i) => {
                                // Resolve Options
                                let optionsList = []
                                if (item.options) {
                                    if (Array.isArray(item.options)) {
                                         optionsList = item.options.map(opt => typeof opt === 'object' ? opt.name : opt)
                                    } else if (typeof item.options === 'object') {
                                        const ids = Object.values(item.options).flat()
                                        optionsList = ids.map(id => optionMap[id] || id)
                                    }
                                }
                                
                                return (
                                <div key={i} className="flex justify-between items-start text-xs border-b border-[var(--color-rule)]/60 pb-2.5 last:border-b-0 last:pb-0">
                                    <div className="flex gap-2">
                                        <span className="font-bold text-[var(--color-accent)] w-5 shrink-0">x{item.quantity}</span>
                                        <div>
                                            <span className="text-[var(--color-ink)] font-bold block">{item.name}</span>
                                            {optionsList.length > 0 && (
                                                <div className="text-[10px] text-[var(--color-muted)] mt-0.5 flex flex-col gap-0.5">
                                                    {optionsList.map((opt, idx) => (
                                                        <span key={idx} className="block">+ {formatOptionName(opt)}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[var(--color-ink)] font-bold shrink-0 ml-2">
                                        ฿{((item.price || 0) * (item.quantity || 1)).toLocaleString()}.-
                                    </span>
                                </div>
                                )
                            })}
                        </div>

                        {data.discount_amount > 0 && (
                            <div className="flex justify-between items-center px-3 py-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 mt-2">
                                <span>Discount ({data.promotion_codes?.code || 'PROMO'})</span>
                                <span className="font-bold">-฿{Number(data.discount_amount).toLocaleString()}.-</span>
                            </div>
                        )}

                        <div className="border-t border-[var(--color-rule)] mt-3 pt-3 flex justify-between items-baseline">
                             <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-neutral)]">{t('totalPrice')}</span>
                             <span className="text-base sm:text-lg font-black text-[var(--color-ink)]">
                                ฿{(
                                    data.total_amount || 
                                    (data.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) - (data.discount_amount || 0))
                                ).toLocaleString()}.-
                             </span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  )
}
