/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import AdminPageHeader, { AdminTabs } from '../components/admin/AdminPageHeader'
import { Link, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Layers, Calculator, ShoppingBag, ClipboardCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'

import OptionGroupList from './components/OptionGroupList'
import MenuCategoryList from './components/MenuCategoryList'
import MenuItemList from './components/MenuItemList'
import FoodDrinkPage from '../components/admin/FoodDrinkPage'
import StockReconciliationPage from '../components/admin/StockReconciliationPage'

// Food Costing, Recipe Lab and Kitchen & Bar SOP are one page now; old links still land on the right part.
const FOOD_TABS = { food: 'menus', costing: 'menus', lab: 'bases', sop: 'methods' }

export default function AdminMenuPage({ defaultTab = 'items' }) {
    const [searchParams, setSearchParams] = useSearchParams()
    const currentTab = searchParams.get('tab') || defaultTab
    const [activeTab, setActiveTab] = useState(currentTab)

    // Summary counts for header stats badge
    const [stats, setStats] = useState({
        totalItems: 0,
        availableItems: 0,
        totalCategories: 0,
        totalModifiers: 0
    })

    useEffect(() => {
        const tabParam = searchParams.get('tab')
        if (tabParam && tabParam !== activeTab) {
            setActiveTab(tabParam)
        }
    }, [searchParams])

    useEffect(() => {
        fetchHubStats()

        let debounceTimer = null
        const debouncedFetchStats = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                fetchHubStats()
            }, 400)
        }

        const channel = supabase
            .channel('admin-menu-page-stats-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, debouncedFetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, debouncedFetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'option_groups' }, debouncedFetchStats)
            .subscribe()

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
        }
    }, [activeTab])

    const fetchHubStats = async () => {
        try {
            const [itemsRes, catsRes, optsRes] = await Promise.all([
                supabase.from('menu_items').select('id, is_available'),
                supabase.from('menu_categories').select('id', { count: 'exact', head: true }),
                supabase.from('option_groups').select('id', { count: 'exact', head: true })
            ])

            const items = itemsRes.data || []
            setStats({
                totalItems: items.length,
                availableItems: items.filter(i => i.is_available !== false).length,
                totalCategories: catsRes.count || 0,
                totalModifiers: optsRes.count || 0
            })
        } catch (err) {
            console.warn('Failed to load hub stats:', err)
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
        { id: 'items', label: 'Menu Catalog', icon: LayoutGrid, count: stats.totalItems },
        { id: 'categories', label: 'Categories', icon: List, count: stats.totalCategories },
        { id: 'options', label: 'Modifiers & Options', icon: Layers, count: stats.totalModifiers },
        { id: 'food', label: 'Food & Drink', icon: Calculator },
        { id: 'stock', label: 'Stock Recon', icon: ClipboardCheck },
    ]

    return (
        <div className="flex flex-col min-h-[calc(100vh-140px)] font-sans pb-16">
            <AdminPageHeader
                title="Menu & Lab"
                description="เมนูอาหารและเครื่องดื่ม ตัวเลือกเสริม ต้นทุน GP% และมาตรฐานสูตร SOP"
                meta={<>{stats.availableItems} / {stats.totalItems} เมนูพร้อมขาย · {stats.totalCategories} หมวดหมู่</>}
            >
                <AdminTabs
                    ariaLabel="Menu & Lab"
                    layoutId="menu-tabs"
                    tabs={tabs.map(t => ({ id: t.id, label: t.label, count: t.count > 0 ? t.count : undefined }))}
                    active={FOOD_TABS[activeTab] ? 'food' : activeTab}
                    onChange={handleTabChange}
                    trailing={
                        <Link
                            to="/admin/hausmade?tab=catalog"
                            className="text-sm text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors whitespace-nowrap"
                            title="ไปที่ระบบจัดการสินค้าและ Pre-Order ของ HAUSMADE"
                        >
                            HAUSMADE catalog ↗
                        </Link>
                    }
                />
            </AdminPageHeader>

            {/* Content Area */}
            <div className="flex-1 bg-[oklch(98%_0.006_28)] rounded-sm border border-[oklch(85%_0.012_28)] p-4 md:p-6 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                    >
                        {activeTab === 'items' && <MenuItemList />}
                        {activeTab === 'categories' && <MenuCategoryList />}
                        {activeTab === 'options' && <OptionGroupList />}
                        {FOOD_TABS[activeTab] && <FoodDrinkPage key={activeTab} initialView={FOOD_TABS[activeTab]} />}
                        {activeTab === 'stock' && <StockReconciliationPage />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
