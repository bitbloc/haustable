/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Search, Tag, Check, AlertCircle, Save, RotateCcw, Filter } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

export default function DrinkStampManager() {
    const [categoriesList, setCategoriesList] = useState([])
    const [allItemsList, setAllItemsList] = useState([])
    const [initialCategoriesList, setInitialCategoriesList] = useState([])
    const [initialAllItemsList, setInitialAllItemsList] = useState([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
    const [eligibilityFilter, setEligibilityFilter] = useState('all') // 'all' | 'eligible' | 'non-eligible'

    const fetchStampSettings = async (showLoadingState = false) => {
        if (showLoadingState) setLoading(true)
        try {
            const [catRes, itemRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('menu_items').select('*, menu_categories(name)').order('name')
            ])

            if (catRes.data) {
                setCategoriesList(catRes.data)
                setInitialCategoriesList(JSON.parse(JSON.stringify(catRes.data)))
            }
            if (itemRes.data) {
                setAllItemsList(itemRes.data)
                setInitialAllItemsList(JSON.parse(JSON.stringify(itemRes.data)))
            }
            setHasUnsavedChanges(false)
        } catch (err) {
            console.error('Error loading stamp settings:', err)
            if (showLoadingState) toast.error('ไม่สามารถโหลดข้อมูลตั้งค่าสะสมแก้วได้')
        } finally {
            if (showLoadingState) setLoading(false)
        }
    }

    useEffect(() => {
        fetchStampSettings(true)

        let debounceTimer = null
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                // Only reload if user hasn't made unsaved local toggles
                if (!hasUnsavedChanges && !isSaving) {
                    fetchStampSettings(false)
                }
            }, 400)
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
    }, [hasUnsavedChanges, isSaving])

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
        toast.info('คืนค่าการตั้งค่าเดิมเรียบร้อย')
    }

    // Batch Save Changes
    const handleSaveStampSettings = async () => {
        if (!hasUnsavedChanges) return
        setIsSaving(true)
        try {
            const changedCats = categoriesList.filter(c => 
                c.is_drink_stamp_eligible !== initialCategoriesList.find(ic => ic.id === c.id)?.is_drink_stamp_eligible
            )
            const changedItems = allItemsList.filter(c => 
                c.is_drink_stamp_eligible !== initialAllItemsList.find(ic => ic.id === c.id)?.is_drink_stamp_eligible
            )

            // 1. Update Categories
            for (const cat of changedCats) {
                const { error } = await supabase
                    .from('menu_categories')
                    .update({ is_drink_stamp_eligible: cat.is_drink_stamp_eligible })
                    .eq('id', cat.id)
                if (error) throw error
            }

            // 2. Update Items
            for (const item of changedItems) {
                const { error } = await supabase
                    .from('menu_items')
                    .update({ is_drink_stamp_eligible: item.is_drink_stamp_eligible })
                    .eq('id', item.id)
                if (error) throw error
            }

            setInitialCategoriesList(JSON.parse(JSON.stringify(categoriesList)))
            setInitialAllItemsList(JSON.parse(JSON.stringify(allItemsList)))
            setHasUnsavedChanges(false)
            toast.success('บันทึกการตั้งค่าสะสมแก้ว 10 แถม 1 สำเร็จแล้ว')
        } catch (err) {
            console.error('Failed to save stamp settings:', err)
            toast.error('บันทึกไม่สำเร็จ: ' + err.message)
            fetchStampSettings()
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
        <div className="space-y-6 font-mono">
            {/* Info Banner */}
            <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.02_28)] px-2 py-0.5 rounded-xs border border-[oklch(85%_0.012_28)]">
                            10+1 PUNCHCARD STAMP RULES
                        </span>
                    </div>
                    <h2 className="text-base font-bold uppercase text-[oklch(18%_0.012_28)] mt-1">
                        ระบบสะสมแก้ว 10 แถม 1 (Drink Stamp Punchcard)
                    </h2>
                    <p className="text-xs text-[oklch(55%_0.010_28)] mt-0.5">
                        กำหนดหมวดหมู่และเครื่องดื่มที่เข้าร่วมรายการสะสมแต้ม เมื่อลูกค้าสั่งซื้อครบ 10 แก้วจะได้รับสิทธิ์แลกฟรี 1 แก้วในระบบ
                    </p>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto shrink-0 bg-white border border-[oklch(85%_0.012_28)] px-3 py-2 rounded-sm text-xs">
                    <span className="text-[oklch(55%_0.010_28)] uppercase text-[10px]">สถานะ:</span>
                    <strong className="text-[oklch(52%_0.16_28)]">{totalEligibleItems} / {allItemsList.length} เมนูร่วมรายการ</strong>
                </div>
            </div>

            {/* Floating / Sticky Save Bar */}
            {hasUnsavedChanges && (
                <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-[oklch(94%_0.02_28)] border border-[oklch(52%_0.16_28)] rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                >
                    <div className="flex items-center gap-2 text-[oklch(52%_0.16_28)] font-bold text-xs">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก (Unsaved Changes)</span>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                            type="button"
                            onClick={handleDiscardChanges}
                            className="px-3 py-1.5 bg-white text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] rounded-sm border border-[oklch(85%_0.012_28)] text-xs font-bold cursor-pointer transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveStampSettings}
                            disabled={isSaving}
                            className="px-4 py-1.5 bg-[oklch(18%_0.012_28)] hover:bg-black text-white rounded-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 transition-colors"
                        >
                            <Save size={13} />
                            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า (Save Changes)'}
                        </button>
                    </div>
                </motion.div>
            )}

            {loading ? (
                <div className="text-center py-16 bg-white border border-[oklch(85%_0.012_28)] rounded-sm">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[oklch(85%_0.012_28)] border-b-[oklch(18%_0.012_28)] mb-2" />
                    <p className="text-xs uppercase tracking-wider text-[oklch(55%_0.010_28)]">กำลังโหลดการตั้งค่าสะสมแก้ว...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Category Master Toggles */}
                    <div className="bg-white border border-[oklch(85%_0.012_28)] p-4 rounded-sm shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-[oklch(85%_0.012_28)]">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                    📁 เปิด/ปิดสิทธิ์ระดับหมวดหมู่ (Category Master Toggles)
                                </h3>
                                <p className="text-[11px] text-[oklch(55%_0.010_28)] mt-0.5">
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
                                                ? 'bg-[oklch(97%_0.008_28)] border-[oklch(52%_0.16_28)]'
                                                : 'bg-white border-[oklch(85%_0.012_28)] opacity-75'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-xs text-[oklch(18%_0.012_28)] truncate">{cat.name}</p>
                                            <p className="text-[10px] text-[oklch(55%_0.010_28)] mt-0.5">
                                                {eligibleCount} / {catItems.length} เมนูร่วม
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => toggleCategoryEligibility(cat)}
                                            className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase transition-colors cursor-pointer shrink-0 border ${
                                                isEligible
                                                    ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)]'
                                                    : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:border-black'
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
                    <div className="bg-white border border-[oklch(85%_0.012_28)] p-4 rounded-sm shadow-2xs">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-[oklch(85%_0.012_28)]">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                    ☕ สิทธิ์รายเมนู (Individual Item Eligibility)
                                </h3>
                                <p className="text-[11px] text-[oklch(55%_0.010_28)] mt-0.5">
                                    เปิดหรือปิดสิทธิ์สะสมแต้ม 10 แถม 1 เฉพาะเมนูที่ต้องการ
                                </p>
                            </div>

                            {/* Filters Bar */}
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={selectedCategoryFilter}
                                    onChange={e => setSelectedCategoryFilter(e.target.value)}
                                    className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] px-2.5 py-1.5 rounded-sm text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black cursor-pointer font-bold"
                                >
                                    <option value="all">ทุกหมวดหมู่ (All Categories)</option>
                                    {categoriesList.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>

                                <select
                                    value={eligibilityFilter}
                                    onChange={e => setEligibilityFilter(e.target.value)}
                                    className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] px-2.5 py-1.5 rounded-sm text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black cursor-pointer font-bold"
                                >
                                    <option value="all">ทุกสถานะ (All Items)</option>
                                    <option value="eligible">เฉพาะที่เปิด 10 แถม 1</option>
                                    <option value="non-eligible">เฉพาะที่ไม่เข้าร่วม</option>
                                </select>

                                <div className="relative w-48">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)] w-3.5 h-3.5" />
                                    <input
                                        type="text"
                                        placeholder="ค้นชื่อเมนู..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm pl-8 pr-3 py-1.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                    />
                                </div>
                            </div>
                        </div>

                        {filteredItems.length === 0 ? (
                            <div className="text-center py-12 bg-[oklch(98%_0.006_28)] border border-dashed border-[oklch(85%_0.012_28)] rounded-sm text-xs text-[oklch(55%_0.010_28)]">
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
                                                    ? 'bg-white border-[oklch(52%_0.16_28)] shadow-2xs'
                                                    : 'bg-[oklch(98%_0.006_28)] border-[oklch(85%_0.012_28)] opacity-60'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className="text-[9px] uppercase px-1 py-0.2 rounded-xs bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border border-[oklch(85%_0.012_28)] truncate max-w-[100px]">
                                                        {item.menu_categories?.name || 'Category'}
                                                    </span>
                                                    {isEligible && (
                                                        <span className="text-[9px] font-bold px-1 py-0.2 rounded-xs bg-[oklch(94%_0.02_28)] text-[oklch(52%_0.16_28)] border border-[oklch(52%_0.16_28)]">
                                                            10+1
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-bold text-xs text-[oklch(18%_0.012_28)] truncate">{item.name}</p>
                                                <p className="text-[11px] text-[oklch(55%_0.010_28)]">฿{parseFloat(item.price || 0).toLocaleString()}</p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => toggleItemEligibility(item)}
                                                className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase transition-colors cursor-pointer shrink-0 border ${
                                                    isEligible
                                                        ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)]'
                                                        : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:border-black'
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
