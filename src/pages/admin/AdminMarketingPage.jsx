/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react'
import { Users, Tag, Gift, Trophy, Music } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import AdminMembers from '../../AdminMembers'
import AdminPromotions from '../../components/admin/AdminPromotions'
import AdminArcade from '../../components/admin/AdminArcade'
import AdminSongRequests from '../AdminSongRequests'

export default function AdminMarketingPage({ defaultTab = 'members' }) {
    const [activeTab, setActiveTab] = useState(defaultTab)

    const tabs = [
        { id: 'members', label: 'Members & CRM', icon: Users },
        { id: 'promotions', label: 'Promo Vouchers', icon: Tag },
        { id: 'rewards', label: 'xhaus Rewards', icon: Gift },
        { id: 'arcade', label: 'Arcade Drawing', icon: Trophy },
        { id: 'songs', label: 'Song Requests', icon: Music },
    ]

    return (
        <div className="flex flex-col min-h-[calc(100vh-140px)] font-sans pb-16">
            {/* Header & Sub-Tab Bar */}
            <div className="flex flex-col gap-4 mb-6 pb-4 border-b border-[oklch(85%_0.012_28)]">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.02_28)] px-2 py-0.5 rounded-sm">
                                CUSTOMER & GROWTH HUB
                            </span>
                        </div>
                        <h1 className="font-mono text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)] uppercase mt-1">
                            Marketing & Loyalty
                        </h1>
                        <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                            Customer profiles, loyalty rewards, promotional campaigns, arcade drawings, and live song requests
                        </p>
                    </div>
                </div>

                {/* Sub-tab Switcher */}
                <div className="flex bg-[oklch(94%_0.010_28)] p-1 rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-xs overflow-x-auto no-scrollbar gap-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                                    isActive
                                        ? 'bg-[oklch(18%_0.012_28)] text-white shadow-sm'
                                        : 'text-[oklch(42%_0.010_28)] hover:text-black hover:bg-[oklch(90%_0.012_28)]'
                                }`}
                            >
                                <Icon size={14} />
                                <span>{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-[oklch(98%_0.006_28)] rounded-sm border border-[oklch(85%_0.012_28)] p-4 md:p-6 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                    >
                        {activeTab === 'members' && <AdminMembers />}
                        {activeTab === 'promotions' && <AdminPromotions defaultTab="promo" />}
                        {activeTab === 'rewards' && <AdminPromotions defaultTab="rewards" />}
                        {activeTab === 'arcade' && <AdminArcade />}
                        {activeTab === 'songs' && <AdminSongRequests />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
