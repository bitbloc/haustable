/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Layers, Calculator, FlaskConical, BookOpen, Utensils, Award } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'

import OptionGroupList from './components/OptionGroupList'
import MenuCategoryList from './components/MenuCategoryList'
import MenuItemList from './components/MenuItemList'
import MenuCostPage from '../components/admin/MenuCostPage'
import RecipeLabPage from '../components/admin/RecipeLabPage'
import SOPEditorPage from '../components/admin/SOPEditorPage'

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
        { id: 'costing', label: 'Food Costing', icon: Calculator },
        { id: 'lab', label: 'Recipe Lab', icon: FlaskConical },
        { id: 'sop', label: 'Kitchen & Bar SOP', icon: BookOpen },
    ]

    return (
        <div className="flex flex-col min-h-[calc(100vh-140px)] font-sans pb-16">
            {/* Header & Sub-Tab Bar */}
            <div className="flex flex-col gap-4 mb-5 pb-4 border-b border-[oklch(85%_0.012_28)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.02_28)] px-2 py-0.5 rounded-sm border border-[oklch(85%_0.012_28)]">
                                CULINARY & BEVERAGE WORKBENCH
                            </span>
                        </div>
                        <h1 className="font-mono text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)] uppercase mt-1">
                            Menu & Kitchen Lab Hub
                        </h1>
                        <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                            ศูนย์กลางบริหารเมนูอาหาร เครื่องดื่ม ตัวเลือกเสริม คำนวณต้นทุน GP% และมาตรฐานสูตร SOP
                        </p>
                    </div>

                    {/* Quick Metric Badges */}
                    <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-xs">
                        <div className="bg-white border border-[oklch(85%_0.012_28)] px-3 py-1.5 rounded-sm shadow-2xs">
                            <span className="text-[oklch(55%_0.010_28)] text-[10px] block">IN STOCK</span>
                            <span className="font-bold text-[oklch(18%_0.012_28)]">{stats.availableItems} / {stats.totalItems} เมนู</span>
                        </div>
                        <div className="bg-white border border-[oklch(85%_0.012_28)] px-3 py-1.5 rounded-sm shadow-2xs">
                            <span className="text-[oklch(55%_0.010_28)] text-[10px] block">CATEGORIES</span>
                            <span className="font-bold text-[oklch(18%_0.012_28)]">{stats.totalCategories} หมวดหมู่</span>
                        </div>
                    </div>
                </div>

                {/* Sub-tab Switcher (Dieter Rams Tabular division) */}
                <div className="flex bg-[oklch(94%_0.010_28)] p-1 rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-xs overflow-x-auto no-scrollbar gap-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                    isActive
                                        ? 'bg-[oklch(18%_0.012_28)] text-white shadow-sm'
                                        : 'text-[oklch(42%_0.010_28)] hover:text-black hover:bg-[oklch(90%_0.012_28)]'
                                }`}
                            >
                                <Icon size={14} />
                                <span>{tab.label}</span>
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-xs font-mono ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-[oklch(88%_0.012_28)] text-[oklch(42%_0.010_28)]'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
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
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                    >
                        {activeTab === 'items' && <MenuItemList />}
                        {activeTab === 'categories' && <MenuCategoryList />}
                        {activeTab === 'options' && <OptionGroupList />}
                        {activeTab === 'costing' && <MenuCostPage isEmbedded={true} />}
                        {activeTab === 'lab' && <RecipeLabPage isEmbedded={true} />}
                        {activeTab === 'sop' && <SOPEditorPage isEmbedded={true} />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
