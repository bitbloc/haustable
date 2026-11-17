/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Search, Save, RotateCcw, Filter, AlertCircle, Check, CheckCircle2, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { logStaffActivity } from '../../../utils/auditLogger'

export default function DrinkStampManager() {
    const [categoriesList, setCategoriesList] = useState([])
    const [allItemsList, setAllItemsList] = useState([])
    const [initialCategoriesList, setInitialCategoriesList] = useState([])
    const [initialAllItemsList, setInitialAllItemsList] = useState([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    // Refs for stable Realtime handler access without re-triggering effect
    const hasUnsavedChangesRef = useRef(false)
    hasUnsavedChangesRef.current = hasUnsavedChanges
    const isSavingRef = useRef(false)
    isSavingRef.current = isSaving

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
    const [eligibilityFilter, setEligibilityFilter] = useState('all') // 'all' | 'eligible' | 'non-eligible'

    const fetchStampSettings = useCallback(async (showLoadingState = false) => {
        if (showLoadingState) setLoading(true)
        try {
            const [catRes, itemRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('menu_items').select('*, menu_categories(name)').order('name')
            ])

            if (catRes.error) throw catRes.error
            if (itemRes.error) throw itemRes.error

            const cats = catRes.data || []
            const items = itemRes.data || []

            setCategoriesList(cats)
            setInitialCategoriesList(JSON.parse(JSON.stringify(cats)))
            setAllItemsList(items)
            setInitialAllItemsList(JSON.parse(JSON.stringify(items)))
            setHasUnsavedChanges(false)
        } catch (err) {
            console.error('Error loading stamp settings:', err)
            if (showLoadingState) toast.error('ไม่สามารถโหลดข้อมูลตั้งค่าสะสมแก้วได้: ' + (err.message || ''))
        } finally {
            if (showLoadingState) setLoading(false)
        }
    }, [])

    // Fetch once on mount & set up single realtime subscription
    useEffect(() => {
        fetchStampSettings(true)

        let debounceTimer = null
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                // Only reload if user does NOT have unsaved local edits
                if (!hasUnsavedChangesRef.current && !isSavingRef.current) {
                    fetchStampSettings(false)
                }
            }, 600)
        }

        const channel = supabase
            .channel('admin-drink-stamps-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, debouncedFetch)
            .subscribe()

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
        }
    }, [fetchStampSettings])

    // Category Level Master Toggle
    const toggleCategoryEligibility = (category) => {
        const newStatus = !category.is_drink_stamp_eligible
        setCategoriesList(prev => prev.map(c => c.id === category.id ? { ...c, is_drink_stamp_eligible: newStatus } : c))
        setAllItemsList(prev => prev.map(i => i.category_id === category.id ? { ...i, is_drink_stamp_eligible: newStatus } : i))
        setHasUnsavedChanges(true)
    }

    // Individual Item Toggle
    const toggleItemEligibility = (item) => {
        const newStatus = !item.is_drink_stamp_eligible
        setAllItemsList(prev => prev.map(i => i.id === item.id ? { ...i, is_drink_stamp_eligible: newStatus } : i))
        setHasUnsavedChanges(true)
    }

    // Discard Unsaved Changes
    const handleDiscardChanges = () => {
        setCategoriesList(JSON.parse(JSON.stringify(initialCategoriesList)))
        setAllItemsList(JSON.parse(JSON.stringify(initialAllItemsList)))
        setHasUnsavedChanges(false)
        toast.info('คืนค่าการตั้งค่าเดิมเรียบร้อยแล้ว')
    }

    // Batch Save Changes
    const handleSaveStampSettings = async () => {
        setIsSaving(true)
        try {
            const changedCats = categoriesList.filter(c => {
                const initial = initialCategoriesList.find(ic => ic.id === c.id)
                return Boolean(c.is_drink_stamp_eligible) !== Boolean(initial?.is_drink_stamp_eligible)
            })
            const changedItems = allItemsList.filter(i => {
                const initial = initialAllItemsList.find(ic => ic.id === i.id)
                return Boolean(i.is_drink_stamp_eligible) !== Boolean(initial?.is_drink_stamp_eligible)
            })

            const promises = []

            // 1. Update Categories
            for (const cat of changedCats) {
                promises.push(
                    supabase
                        .from('menu_categories')
                        .update({ is_drink_stamp_eligible: Boolean(cat.is_drink_stamp_eligible) })
                        .eq('id', cat.id)
                )
            }

            // 2. Update Items efficiently by grouping true and false IDs
            const trueItemIds = changedItems.filter(i => i.is_drink_stamp_eligible).map(i => i.id)
            const falseItemIds = changedItems.filter(i => !i.is_drink_stamp_eligible).map(i => i.id)

            if (trueItemIds.length > 0) {
                promises.push(
                    supabase
                        .from('menu_items')
                        .update({ is_drink_stamp_eligible: true })
                        .in('id', trueItemIds)
                )
            }
            if (falseItemIds.length > 0) {
                promises.push(
                    supabase
                        .from('menu_items')
                        .update({ is_drink_stamp_eligible: false })
                        .in('id', falseItemIds)
                )
            }

            if (promises.length > 0) {
                const results = await Promise.all(promises)
                for (const res of results) {
                    if (res.error) throw res.error
                }
            }

            setInitialCategoriesList(JSON.parse(JSON.stringify(categoriesList)))
            setInitialAllItemsList(JSON.parse(JSON.stringify(allItemsList)))
            setHasUnsavedChanges(false)
            logStaffActivity('admin', 'stamp_settings_update', {
                reason: `ปรับการสะสมแต้มเครื่องดื่ม (${changedCats.length} หมวด, ${changedItems.length} เมนู)`,
                metadata: {
                    categories_changed: changedCats.length,
                    items_changed: changedItems.length
                }
            })
            toast.success(`บันทึกการตั้งค่าสะสมแก้ว 10 แถม 1 เรียบร้อยแล้ว (อัปเดต ${changedCats.length} หมวดหมู่, ${changedItems.length} เมนู)`)
        } catch (err) {
            console.error('Failed to save stamp settings:', err)
            toast.error('บันทึกไม่สำเร็จ: ' + (err.message || 'เกิดข้อผิดพลาดในการบันทึก'))
        } finally {
            setIsSaving(false)
        }
    }

    // Filter Logic
    const filteredItems = useMemo(() => {
        return allItemsList.filter(item => {
            const matchesSearch = 
                (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.menu_categories?.name || '').toLowerCase().includes(searchTerm.toLowerCase())

            if (!matchesSearch) return false

            if (selectedCategoryFilter !== 'all' && item.category_id !== selectedCategoryFilter) {
                return false
            }

            if (eligibilityFilter === 'eligible') {
                return item.is_drink_stamp_eligible
            }
            if (eligibilityFilter === 'non-eligible') {
                return !item.is_drink_stamp_eligible
            }

            return true
        })
    }, [allItemsList, searchTerm, selectedCategoryFilter, eligibilityFilter])

    const totalEligibleItems = allItemsList.filter(i => i.is_drink_stamp_eligible).length

    return (
        <div className="space-y-6 tabular-nums">
            {/* Info & Action Header */}
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-4 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-[11px] text-[var(--brand-plum)] bg-[var(--color-paper-2)] px-2 py-0.5 rounded-xs border border-[var(--color-rule)]">
                            10+1 PUNCHCARD STAMP RULES
                        </span>
                    </div>
                    <h2 className="text-base font-bold text-[var(--color-ink)] mt-1">
                        ระบบสะสมแก้ว 10 แถม 1 (Drink Stamp Punchcard)
                    </h2>
                    <p className="text-[13px] text-[var(--color-neutral)] mt-0.5">
                        กำหนดหมวดหมู่และเครื่องดื่มที่เข้าร่วมรายการสะสมแต้ม เมื่อลูกค้าสั่งซื้อครบ 10 แก้วจะได้รับสิทธิ์แลกฟรี 1 แก้ว
                    </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] px-3 py-2 rounded-sm text-xs">
                        <span className="text-[var(--color-neutral)] text-xs mr-1">สถานะ:</span>
                        <strong className="text-[var(--brand-plum)]">{totalEligibleItems} / {allItemsList.length} เมนูร่วม</strong>
                    </div>

                    <button
                        type="button"
                        onClick={handleSaveStampSettings}
                        disabled={isSaving || !hasUnsavedChanges}
                        className={`px-4 py-2 rounded-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                            hasUnsavedChanges
                                ? 'bg-[var(--brand-plum)] hover:bg-[var(--brand-plum)] text-[var(--color-paper)] ring-2 ring-[var(--brand-plum)]/30'
                                : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] border border-[var(--color-rule)] cursor-not-allowed opacity-70'
                        }`}
                    >
                        <Save size={14} />
                        {isSaving ? 'กำลังบันทึก...' : hasUnsavedChanges ? 'บันทึกการตั้งค่า *' : 'บันทึกแล้ว'}
                    </button>
                </div>
            </div>

            {/* Floating / Sticky Save Bar on Changes */}
            <AnimatePresence>
                {hasUnsavedChanges && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="p-3.5 bg-[var(--color-paper-2)] border-2 border-[var(--brand-plum)] rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md sticky top-4 z-20"
                    >
                        <div className="flex items-center gap-2 text-[var(--brand-plum)] font-bold text-xs">
                            <AlertCircle size={18} className="shrink-0 animate-pulse" />
                            <span>มีการปรับเปลี่ยนสิทธิ์สะสมแก้วที่ยังไม่ได้บันทึก (Unsaved Changes)</span>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                                type="button"
                                onClick={handleDiscardChanges}
                                disabled={isSaving}
                                className="px-3.5 py-1.5 bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-sm border border-[var(--color-rule)] text-xs font-bold cursor-pointer transition-colors"
                            >
                                <RotateCcw size={12} className="inline mr-1" /> ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveStampSettings}
                                disabled={isSaving}
                                className="px-4.5 py-1.5 bg-[var(--color-ink)] hover:bg-[var(--color-ink)] text-[var(--color-paper)] rounded-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                            >
                                <Save size={13} />
                                {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า (Save Changes)'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {loading ? (
                <div className="text-center py-16 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[var(--color-rule)] border-b-[var(--color-ink)] mb-2" />
                    <p className="text-[13px] text-[var(--color-neutral)]">กำลังโหลดการตั้งค่าสะสมแก้ว...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Category Master Toggles */}
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-4 rounded-sm ">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-[var(--color-rule)]">
                            <div>
                                <h3 className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                                    📁 เปิด/ปิดสิทธิ์ระดับหมวดหมู่ (CATEGORY MASTER TOGGLES)
                                </h3>
                                <p className="text-[13px] text-[var(--color-neutral)] mt-0.5">
                                    คลิกปุ่มเพื่อเปิดหรือปิดสิทธิ์สะสม 10 แถม 1 ทั้งหมวดหมู่ในครั้งเดียว
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                            {categoriesList.map(cat => {
                                const isEligible = cat.is_drink_stamp_eligible
                                const catItems = allItemsList.filter(i => i.category_id === cat.id)
                                const eligibleCount = catItems.filter(i => i.is_drink_stamp_eligible).length

                                return (
                                    <div
                                        key={cat.id}
                                        className={`p-3 rounded-sm border transition-all flex items-center justify-between gap-2 ${
                                            isEligible
                                                ? 'bg-[var(--color-paper)] border-[var(--brand-plum)]'
                                                : 'bg-[var(--color-paper)] border-[var(--color-rule)] opacity-75'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-[13px] text-[var(--color-ink)] truncate">{cat.name}</p>
                                            <p className="text-[13px] text-[var(--color-neutral)] mt-0.5 tabular-nums">
                                                {eligibleCount} / {catItems.length} เมนูร่วม
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => toggleCategoryEligibility(cat)}
                                            className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-colors cursor-pointer shrink-0 border ${
                                                isEligible
                                                    ? 'bg-[var(--brand-plum)] text-[var(--color-paper)] border-[var(--brand-plum)] '
                                                    : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)] hover:border-[var(--color-ink)]'
                                            }`}
                                        >
                                            {isEligible ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Individual Item Toggles */}
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-4 rounded-sm ">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--color-rule)]">
                            <div>
                                <h3 className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                                    ☕ สิทธิ์รายเมนู (INDIVIDUAL ITEM ELIGIBILITY)
                                </h3>
                                <p className="text-[13px] text-[var(--color-neutral)] mt-0.5">
                                    เปิดหรือปิดสิทธิ์สะสมแต้ม 10 แถม 1 เฉพาะเมนูที่ต้องการ
                                </p>
                            </div>

                            {/* Filters Bar */}
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={selectedCategoryFilter}
                                    onChange={e => setSelectedCategoryFilter(e.target.value)}
                                    className="bg-[var(--color-paper)] border border-[var(--color-rule)] px-2.5 py-1.5 rounded-sm text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] cursor-pointer font-bold"
                                >
                                    <option value="all">ทุกหมวดหมู่ (All Categories)</option>
                                    {categoriesList.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>

                                <select
                                    value={eligibilityFilter}
                                    onChange={e => setEligibilityFilter(e.target.value)}
                                    className="bg-[var(--color-paper)] border border-[var(--color-rule)] px-2.5 py-1.5 rounded-sm text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] cursor-pointer font-bold"
                                >
                                    <option value="all">ทุกสถานะ (All Items)</option>
                                    <option value="eligible">เฉพาะที่เปิด 10 แถม 1</option>
                                    <option value="non-eligible">เฉพาะที่ไม่เข้าร่วม</option>
                                </select>

                                <div className="relative w-48">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral)] w-3.5 h-3.5" />
                                    <input
                                        type="text"
                                        placeholder="ค้นชื่อเมนู..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm pl-8 pr-3 py-1.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] tabular-nums"
                                    />
                                </div>
                            </div>
                        </div>

                        {filteredItems.length === 0 ? (
                            <div className="text-center py-12 bg-[var(--color-paper)] border border-dashed border-[var(--color-rule)] rounded-sm text-xs text-[var(--color-neutral)]">
                                ไม่พบรายการเมนูที่ตรงกับเงื่อนไขค้นหา
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                {filteredItems.map(item => {
                                    const isEligible = item.is_drink_stamp_eligible
                                    return (
                                        <div
                                            key={item.id}
                                            className={`p-3 rounded-sm border transition-all flex items-center justify-between gap-2.5 ${
                                                isEligible
                                                    ? 'bg-[var(--color-paper)] border-[var(--brand-plum)] '
                                                    : 'bg-[var(--color-paper)] border-[var(--color-rule)] opacity-60'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className="text-[11px] px-1 py-0.2 rounded-xs bg-[var(--color-paper-2)] text-[var(--color-muted)] border border-[var(--color-rule)] truncate max-w-[100px]">
                                                        {item.menu_categories?.name || 'Category'}
                                                    </span>
                                                    {isEligible && (
                                                        <span className="text-[11px] font-bold px-1 py-0.2 rounded-xs bg-[var(--color-paper-2)] text-[var(--brand-plum)] border border-[var(--brand-plum)]">
                                                            10+1
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-bold text-[13px] text-[var(--color-ink)] truncate">{item.name}</p>
                                                <p className="text-[13px] text-[var(--color-neutral)] tabular-nums">฿{parseFloat(item.price || 0).toLocaleString()}</p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => toggleItemEligibility(item)}
                                                className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-colors cursor-pointer shrink-0 border ${
                                                    isEligible
                                                        ? 'bg-[var(--brand-plum)] text-[var(--color-paper)] border-[var(--brand-plum)] '
                                                        : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)] hover:border-[var(--color-ink)]'
                                                }`}
                                            >
                                                {isEligible ? 'ON' : 'OFF'}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
