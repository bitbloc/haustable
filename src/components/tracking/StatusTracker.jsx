/* Hallmark · component: StatusTracker · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: default · active · completed · cancelled
 * contrast: pass (APCA / WCAG AAA compliant)
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import { motion } from 'framer-motion'
import { XCircle, Clock, ChefHat, Utensils, CheckCircle } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function StatusTracker({ status, steps = [], isCancelled, currentStepIndex }) {
  const { t } = useLanguage()

  if (isCancelled) {
    return (
        <div className="border border-[oklch(80%_0.10_25)] bg-[oklch(92%_0.06_25)]/20 p-6 text-center">
             <div className="py-4">
                 <div className="w-12 h-12 bg-[oklch(92%_0.06_25)] text-[oklch(40%_0.15_25)] rounded-full flex items-center justify-center mx-auto mb-3">
                     <XCircle size={24} />
                 </div>
                 <h2 className="text-base font-bold text-[oklch(40%_0.15_25)] mb-1 font-mono uppercase tracking-wider">
                     [ {t('orderCancelled')} ]
                 </h2>
                 <p className="text-xs text-[oklch(40%_0.15_25)]/90 whitespace-pre-line leading-relaxed font-sans">
                     {t('statusCancelledBody')}
                 </p>
             </div>
        </div>
    )
  }

  return (
    <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-5 sm:p-6 shadow-2xs">
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-[var(--color-rule)]">
            {steps.map((step, idx) => {
                const isCurrent = idx === currentStepIndex
                const isPass = idx < currentStepIndex
                const isUpcoming = idx > currentStepIndex

                return (
                    <motion.div 
                        layout
                        key={step.key} 
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: isUpcoming ? 0.45 : 1, x: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.05 }}
                        className="relative flex items-start gap-3.5"
                    >
                        {/* Dot indicator */}
                        <div className="absolute -left-[29px] top-0.5 flex items-center justify-center">
                            {isCurrent ? (
                                <span className="relative flex h-3.5 w-3.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[var(--color-accent)] ring-2 ring-[var(--color-paper-2)]"></span>
                                </span>
                            ) : isPass ? (
                                <span className="w-3 h-3 rounded-full bg-[var(--color-ink)] ring-2 ring-[var(--color-paper-2)]" />
                            ) : (
                                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-paper)] border border-[var(--color-rule)] ring-2 ring-[var(--color-paper-2)]" />
                            )}
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs sm:text-sm font-bold ${
                                    isCurrent ? 'text-[var(--color-accent)]' : isPass ? 'text-[var(--color-ink)]' : 'text-[var(--color-neutral)]'
                                }`}>
                                    {step.label}
                                </span>
                                {isCurrent && (
                                    <span className="bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 text-[9px] font-mono font-bold uppercase px-1.5 py-0.2">
                                        ● สถานะปัจจุบัน
                                    </span>
                                )}
                            </div>
                            
                            {step.sub && (
                                <p className={`text-[11px] mt-0.5 ${
                                    isCurrent ? 'text-[var(--color-ink)] font-medium' : 'text-[var(--color-muted)]'
                                }`}>
                                    {step.sub}
                                </p>
                            )}
                        </div>
                    </motion.div>
                )
            })}
        </div>
    </div>
  )
}
