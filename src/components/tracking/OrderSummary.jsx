import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function OrderSummary({ data }) {
  const { t } = useLanguage()
  const [isAccordionOpen, setIsAccordionOpen] = useState(true)

  return (
    <div className="bg-gray-50 rounded-xl overflow-hidden">
        <button 
            onClick={() => setIsAccordionOpen(!isAccordionOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors"
        >
             <span className="font-bold text-sm text-gray-700">{t('orderItems')} ({data.items?.length || 0})</span>
             <ArrowRight size={16} className={`text-gray-400 transition-transform duration-300 ${isAccordionOpen ? 'rotate-90' : ''}`}/>
        </button>
        <AnimatePresence initial={false}>
            {isAccordionOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                    <div className="p-4 pt-0 border-t border-gray-100">
                        <div className="space-y-3 mt-3">
                            {data.items?.map((item, i) => (
                                <div key={i} className="flex justify-between items-start text-sm group">
                                    <div className="flex gap-3">
                                        <div className="font-bold text-gray-400 w-4">{item.quantity}x</div>
                                        <div>
                                            <div className="text-gray-900 font-medium group-hover:text-black transition-colors">{item.name}</div>
                                            {item.options && (
                                                <div className="text-[10px] text-gray-500 mt-0.5">
                                                    {Object.values(item.options).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-gray-500 font-mono">{item.price * item.quantity}.-</div>
                                </div>
                            ))}
                        </div>
                        {data.discount_amount > 0 && (
                            <div className="flex justify-between items-center px-3 py-2 text-sm text-green-600 border-t border-dashed border-gray-200 mt-2">
                                <span>Discount ({data.promotion_codes?.code || 'PROMO'})</span>
                                <span className="font-bold">-{data.discount_amount.toLocaleString()}.-</span>
                            </div>
                        )}
                        <div className="border-t border-dashed border-gray-300 mt-4 pt-4 flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                             <span className="text-sm font-bold text-gray-900">{t('totalPrice')}</span>
                             <span className="text-lg font-bold text-green-600">{data.total_amount.toLocaleString()}.-</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  )
}
