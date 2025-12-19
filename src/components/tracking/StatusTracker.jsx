import { motion } from 'framer-motion'
import { XCircle } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function StatusTracker({ status, steps, isCancelled, currentStepIndex }) {
  const { t } = useLanguage()

  if (isCancelled) {
    return (
        <div className="rounded-3xl p-6 shadow-sm border bg-red-50 border-red-100">
             <div className="text-center py-8">
                 <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                     <XCircle size={32} />
                 </div>
                 <h2 className="text-xl font-bold text-red-700 mb-2">{t('orderCancelled')}</h2>
                 <p className="text-sm text-red-600/80 whitespace-pre-line">
                     {t('statusCancelledBody')}
                 </p>
             </div>
        </div>
    )
  }

  return (
    <div className="rounded-3xl p-6 shadow-sm border bg-white border-gray-100">
        <div className="relative pl-2">
            {/* Timeline Line */}
            <div className="absolute left-[19px] top-2 bottom-4 w-[2px] bg-gray-100 rounded-full"/>
            
            <div className="space-y-6">
                {steps.map((step, idx) => {
                    const isCurrent = idx === currentStepIndex
                    const isActive = idx <= currentStepIndex
                    const isPass = idx < currentStepIndex

                    return (
                        <motion.div 
                            layout
                            key={step.key} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: isActive ? 1 : 0.4, x: 0 }}
                            transition={{ duration: 0.3, delay: idx * 0.1 }}
                            className={`relative flex items-center gap-4`}
                        >
                            <motion.div 
                                className={`
                                    w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 border-white shadow-sm transition-colors duration-500
                                    ${isActive ? step.bg + ' ' + step.color : 'bg-gray-100 text-gray-300'}
                                    ${isCurrent ? 'ring-2 ring-offset-2 ring-blackScale' : ''}
                                `}
                                animate={isCurrent ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                                transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
                            >
                                <step.icon size={16} />
                            </motion.div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">{step.label}</p>
                                {isCurrent && (
                                    <motion.p 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="text-xs text-orange-500 font-medium mt-0.5"
                                    >
                                        {step.sub}
                                    </motion.p>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    </div>
  )
}
