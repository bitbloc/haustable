/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import AdminPageHeader, { AdminTabs } from '../../components/admin/AdminPageHeader'
import { AdminTabPanel } from '../../components/admin/AdminKit'
import { useSearchParams } from 'react-router-dom'
import { Users, Tag, Gift, Trophy, Music, Award, RefreshCw, MousePointerClick } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

import AdminMembers from '../../AdminMembers'
import PromoVoucherManager from '../../components/admin/marketing/PromoVoucherManager'
import RewardsManager from '../../components/admin/marketing/RewardsManager'
import DrinkStampManager from '../../components/admin/marketing/DrinkStampManager'
import AdminArcade from '../../components/admin/AdminArcade'
import AdminSongRequests from '../AdminSongRequests'
import AdLandingAnalyticsTab from '../../components/admin/marketing/AdLandingAnalyticsTab'

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
        { id: 'ads_landing', label: 'Ad Analytics (/link)', icon: MousePointerClick },
        { id: 'promotions', label: 'Promo Vouchers', icon: Tag, count: stats.activeVouchers },
        { id: 'rewards', label: 'xhaus Rewards', icon: Gift, count: stats.activeRewards },
        { id: 'stamps', label: 'Drink Stamps (10+1)', icon: Award, count: stats.stampsEligible },
        { id: 'arcade', label: 'Arcade Drawing', icon: Trophy },
        { id: 'songs', label: 'Song Requests', icon: Music, count: stats.pendingSongs, alert: stats.pendingSongs > 0 },
    ]

    return (
        <div className="flex flex-col min-h-[calc(100vh-140px)] font-sans pb-16">
            <AdminPageHeader
                title="Marketing & Loyalty"
                description="สมาชิกร้าน PIN พนักงาน โค้ดส่วนลด ของรางวัลแต้มสะสม สะสมแก้ว 10 แถม 1 และคิวขอเพลง"
                meta={<>{stats.totalMembers} สมาชิก (พนักงาน {stats.staffCount}) · {stats.activeVouchers} โค้ดส่วนลดที่ใช้งานอยู่</>}
            >
                <AdminTabs
                    ariaLabel="Marketing & Loyalty"
                    layoutId="marketing-tabs"
                    tabs={tabs.map(t => ({ id: t.id, label: t.label, count: t.count, alert: t.alert }))}
                    active={activeTab}
                    onChange={handleTabChange}
                />
            </AdminPageHeader>

            {/* Content Display Area */}
            <div className="flex-1 bg-[oklch(98%_0.006_28)] rounded-sm border border-[oklch(85%_0.012_28)] p-4 md:p-6 overflow-hidden">
                <AdminTabPanel id={activeTab}>
                        {activeTab === 'members' && <AdminMembers />}
                        {activeTab === 'ads_landing' && <AdLandingAnalyticsTab />}
                        {activeTab === 'promotions' && <PromoVoucherManager />}
                        {activeTab === 'rewards' && <RewardsManager />}
                        {activeTab === 'stamps' && <DrinkStampManager />}
                        {activeTab === 'arcade' && <AdminArcade />}
                        {activeTab === 'songs' && <AdminSongRequests />}
                    </AdminTabPanel>
            </div>
        </div>
    )
}
