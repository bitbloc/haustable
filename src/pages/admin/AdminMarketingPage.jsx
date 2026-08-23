/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users, Tag, Gift, Trophy, Music, Award, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'

import AdminMembers from '../../AdminMembers'
import PromoVoucherManager from '../../components/admin/marketing/PromoVoucherManager'
import RewardsManager from '../../components/admin/marketing/RewardsManager'
import DrinkStampManager from '../../components/admin/marketing/DrinkStampManager'
import AdminArcade from '../../components/admin/AdminArcade'
import AdminSongRequests from '../AdminSongRequests'

export default function AdminMarketingPage({ defaultTab = 'members' }) {
    const [searchParams, setSearchParams] = useSearchParams()
    const currentTab = searchParams.get('tab') || defaultTab
    const [activeTab, setActiveTab] = useState(currentTab)

    // Dynamic Header Stats
    const [stats, setStats] = useState({
        totalMembers: 0,
        staffCount: 0,
        activeVouchers: 0,
        activeRewards: 0,
        stampsEligible: 0,
        pendingSongs: 0
    })

    useEffect(() => {
        const tabParam = searchParams.get('tab')
        if (tabParam && tabParam !== activeTab) {
            setActiveTab(tabParam)
        }
    }, [searchParams])

    useEffect(() => {
        fetchMarketingStats()

        let debounceTimer = null
        const debouncedFetchStats = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                fetchMarketingStats()
            }, 400)
        }

        const channel = supabase
            .channel('admin-marketing-page-stats-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, debouncedFetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'promotion_codes' }, debouncedFetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'xhaus_rewards' }, debouncedFetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, debouncedFetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests' }, debouncedFetchStats)
            .subscribe()

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
        }
    }, [activeTab])

    const fetchMarketingStats = async () => {
        try {
            const [profilesRes, vouchersRes, rewardsRes, itemsRes, songsRes] = await Promise.all([
                supabase.from('profiles').select('id, role'),
                supabase.from('promotion_codes').select('id, is_active, end_date'),
                supabase.from('xhaus_rewards').select('id', { count: 'exact', head: true }).eq('is_active', true),
                supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('is_drink_stamp_eligible', true),
                supabase.from('song_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
            ])

            const profiles = profilesRes.data || []
            const vouchers = vouchersRes.data || []
            const activeVouchers = vouchers.filter(v => v.is_active && new Date(v.end_date) >= new Date()).length
            const staffCount = profiles.filter(p => p.role === 'staff' || p.role === 'admin').length

            setStats({
                totalMembers: profiles.length,
                staffCount,
                activeVouchers,
                activeRewards: rewardsRes.count || 0,
                stampsEligible: itemsRes.count || 0,
                pendingSongs: songsRes.count || 0
            })
        } catch (err) {
            console.warn('Failed to load marketing summary stats:', err)
        }
    }

    const handleTabChange = (tabId) => {
        setActiveTab(tabId)
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.set('tab', tabId)
            return next
        }, { replace: true })
    }

    const tabs = [
        { id: 'members', label: 'Members & CRM', icon: Users, count: stats.totalMembers },
        { id: 'promotions', label: 'Promo Vouchers', icon: Tag, count: stats.activeVouchers },
        { id: 'rewards', label: 'xhaus Rewards', icon: Gift, count: stats.activeRewards },
        { id: 'stamps', label: 'Drink Stamps (10+1)', icon: Award, count: stats.stampsEligible },
        { id: 'arcade', label: 'Arcade Drawing', icon: Trophy },
        { id: 'songs', label: 'Song Requests', icon: Music, count: stats.pendingSongs, alert: stats.pendingSongs > 0 },
    ]

    return (
        <div className="flex flex-col min-h-[calc(100vh-140px)] font-sans pb-16">
            {/* Header & Sub-Tab Bar */}
            <div className="flex flex-col gap-4 mb-5 pb-4 border-b border-[oklch(85%_0.012_28)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.02_28)] px-2 py-0.5 rounded-sm border border-[oklch(85%_0.012_28)]">
                                CUSTOMER CRM & GROWTH HUB
                            </span>
                        </div>
                        <h1 className="font-mono text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)] uppercase mt-1">
                            Marketing & Loyalty
                        </h1>
                        <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                            ศูนย์กลางบริหารสมาชิกร้าน, PIN พนักงาน, โค้ดส่วนลด, ของรางวัลแต้มสะสม, สะสมแก้ว 10 แถม 1 และคิวขอเพลง
                        </p>
                    </div>

                    {/* Quick Hub Badges */}
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto font-mono text-xs">
                        <div className="bg-white border border-[oklch(85%_0.012_28)] px-3 py-1.5 rounded-sm shadow-2xs">
                            <span className="text-[oklch(55%_0.010_28)] text-[10px] block">MEMBERS CRM</span>
                            <span className="font-bold text-[oklch(18%_0.012_28)]">{stats.totalMembers} คน (Staff {stats.staffCount})</span>
                        </div>
                        <div className="bg-white border border-[oklch(85%_0.012_28)] px-3 py-1.5 rounded-sm shadow-2xs">
                            <span className="text-[oklch(55%_0.010_28)] text-[10px] block">ACTIVE PROMO</span>
                            <span className="font-bold text-[oklch(52%_0.16_28)]">{stats.activeVouchers} โค้ดส่วนลด</span>
                        </div>
                    </div>
                </div>

                {/* Sub-tab Navigation */}
                <div className="flex bg-[oklch(94%_0.010_28)] p-1 rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-xs overflow-x-auto no-scrollbar gap-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                    isActive
                                        ? 'bg-[oklch(18%_0.012_28)] text-white shadow-sm'
                                        : 'text-[oklch(42%_0.010_28)] hover:text-black hover:bg-[oklch(90%_0.012_28)]'
                                }`}
                            >
                                <Icon size={14} />
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span className={`px-1.5 py-0.5 text-[10px] rounded-xs font-bold ${
                                        isActive
                                            ? tab.alert 
                                                ? 'bg-[oklch(52%_0.16_28)] text-white' 
                                                : 'bg-white/20 text-white'
                                            : tab.alert 
                                                ? 'bg-[oklch(52%_0.16_28)] text-white animate-pulse' 
                                                : 'bg-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Content Display Area */}
            <div className="flex-1 bg-[oklch(98%_0.006_28)] rounded-sm border border-[oklch(85%_0.012_28)] p-4 md:p-6 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                    >
                        {activeTab === 'members' && <AdminMembers />}
                        {activeTab === 'promotions' && <PromoVoucherManager />}
                        {activeTab === 'rewards' && <RewardsManager />}
                        {activeTab === 'stamps' && <DrinkStampManager />}
                        {activeTab === 'arcade' && <AdminArcade />}
                        {activeTab === 'songs' && <AdminSongRequests />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
