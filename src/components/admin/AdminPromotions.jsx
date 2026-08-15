/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { Tag, Gift, Award } from 'lucide-react'
import PromoVoucherManager from './marketing/PromoVoucherManager'
import RewardsManager from './marketing/RewardsManager'
import DrinkStampManager from './marketing/DrinkStampManager'

export default function AdminPromotions({ defaultTab = 'promo' }) {
    const [activeTab, setActiveTab] = useState(defaultTab) // 'promo' | 'rewards' | 'stamps'

    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab)
        }
    }, [defaultTab])

    return (
        <div className="space-y-6">
            {/* Inner Sub-tab Switcher if accessed directly */}
            <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-xs w-full sm:w-max overflow-x-auto gap-1">
                <button
                    type="button"
                    onClick={() => setActiveTab('promo')}
                    className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === 'promo'
                            ? 'bg-[oklch(18%_0.012_28)] text-white shadow-2xs'
                            : 'text-[oklch(42%_0.010_28)] hover:text-black'
                    }`}
                >
                    <Tag size={13} />
                    <span>โค้ดส่วนลด (Vouchers)</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('rewards')}
                    className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === 'rewards'
                            ? 'bg-[oklch(18%_0.012_28)] text-white shadow-2xs'
                            : 'text-[oklch(42%_0.010_28)] hover:text-black'
                    }`}
                >
                    <Gift size={13} />
                    <span>ของรางวัล (xhaus Rewards)</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('stamps')}
                    className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === 'stamps'
                            ? 'bg-[oklch(18%_0.012_28)] text-white shadow-2xs'
                            : 'text-[oklch(42%_0.010_28)] hover:text-black'
                    }`}
                >
                    <Award size={13} />
                    <span>สะสมแก้ว (10 แถม 1)</span>
                </button>
            </div>

            {/* Active Content */}
            {activeTab === 'promo' && <PromoVoucherManager />}
            {activeTab === 'rewards' && <RewardsManager />}
            {activeTab === 'stamps' && <DrinkStampManager />}
        </div>
    )
}
