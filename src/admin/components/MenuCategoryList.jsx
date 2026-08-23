/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, X, GripVertical, Check, AlertCircle, Coffee } from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'
import { toast } from 'sonner'

export default function MenuCategoryList() {
    const [categories, setCategories] = useState([])
    const [itemCounts, setItemCounts] = useState({})
    const [isSaving, setIsSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState(null)
    const [formData, setFormData] = useState({ 
        name: '', 
        display_order: 0,
        is_drink_stamp_eligible: false,
        hide_on_kitchen_close: false 
    })

    useEffect(() => {
        fetchData(true)

        let debounceTimer = null
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                if (!isModalOpen && !isSaving) {
                    fetchData(false)
                }
            }, 400)
        }

        const channel = supabase
            .channel('admin-menu-categories-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, debouncedFetch)
            .subscribe()

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
        }
    }, [isModalOpen, isSaving])

    const fetchData = async (showLoadingState = false) => {
        if (showLoadingState) setLoading(true)
        try {
            const [catRes, itemsRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('display_order', { ascending: true }),
                supabase.from('menu_items').select('id, category_id, category')
            ])

            if (catRes.error) throw catRes.error

            const cats = catRes.data || []
            setCategories(cats)

            // Compute counts
            const counts = {}
            if (itemsRes.data) {
                itemsRes.data.forEach(item => {
                    const key = item.category_id || item.category || 'uncategorized'
                    counts[key] = (counts[key] || 0) + 1
                })
            }
            setItemCounts(counts)
        } catch (error) {
            console.error('Fetch categories error:', error)
            if (showLoadingState) toast.error('ไม่สามารถโหลดหมวดหมู่ได้')
        } finally {
            if (showLoadingState) setLoading(false)
        }
    }

    const handleCreate = () => {
        setEditingCategory(null)
        const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.display_order || 0)) : 0
        setFormData({ 
            name: '', 
            display_order: maxOrder + 1,
            is_drink_stamp_eligible: false,
            hide_on_kitchen_close: true 
        })
        setIsModalOpen(true)
    }

    const handleEdit = (cat) => {
        setEditingCategory(cat)
        setFormData({ 
            name: cat.name, 
            display_order: cat.display_order || 0,
            is_drink_stamp_eligible: cat.is_drink_stamp_eligible === true,
            hide_on_kitchen_close: cat.hide_on_kitchen_close === true
        })
        setIsModalOpen(true)
    }

    const handleDelete = async (cat) => {
        const count = itemCounts[cat.id] || 0
        if (count > 0) {
            const msg = `หมวดหมู่ "${cat.name}" มีเมนูอยู่ ${count} รายการ\nการลบหมวดหมู่นี้อาจทำให้เมนูดังกล่าวกลายเป็น Uncategorized ยืนยันการลบหรือไม่?`
            if (!confirm(msg)) return
        } else {
            if (!confirm(`คุณต้องการลบหมวดหมู่ "${cat.name}" ใช่หรือไม่?`)) return
        }

        try {
            const { error } = await supabase.from('menu_categories').delete().eq('id', cat.id)
            if (error) throw error
            setCategories(prev => prev.filter(c => c.id !== cat.id))
            toast.success(`ลบหมวดหมู่ "${cat.name}" สำเร็จ`)
        } catch (err) {
            console.error('Delete category error:', err)
            toast.error('ลบหมวดหมู่ไม่สำเร็จ: ' + err.message)
        }
    }

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault()
        const trimmedName = (formData.name || '').trim()
        if (!trimmedName) {
            toast.error('กรุณาระบุชื่อหมวดหมู่')
            return
        }

        try {
            const payload = {
                name: trimmedName,
                display_order: parseInt(formData.display_order) || 0,
                is_drink_stamp_eligible: formData.is_drink_stamp_eligible === true,
                hide_on_kitchen_close: formData.hide_on_kitchen_close === true
            }

            if (editingCategory) {
                const { error } = await supabase
                    .from('menu_categories')
                    .update(payload)
                    .eq('id', editingCategory.id)
                if (error) throw error

                // If drink stamp eligibility changed, update linked items
                if (editingCategory.is_drink_stamp_eligible !== formData.is_drink_stamp_eligible) {
                    await supabase
                        .from('menu_items')
                        .update({ is_drink_stamp_eligible: formData.is_drink_stamp_eligible })
                        .eq('category_id', editingCategory.id)
                }

                toast.success('อัปเดตหมวดหมู่สำเร็จ')
            } else {
                const { data: newCat, error } = await supabase
                    .from('menu_categories')
                    .insert(payload)
                    .select()
                    .single()
                if (error) throw error
                toast.success('สร้างหมวดหมู่ใหม่สำเร็จ')
            }

            setIsModalOpen(false)
            fetchData()
        } catch (error) {
            toast.error('บันทึกไม่สำเร็จ: ' + error.message)
        }
    }

    // --- Drag & Drop Reordering ---
    const handleReorder = (newOrder) => {
        setCategories(newOrder)
    }

    const saveOrder = async () => {
        setIsSaving(true)
        try {
            const updates = categories.map((cat, index) => ({
                id: cat.id,
                name: cat.name,
                is_drink_stamp_eligible: cat.is_drink_stamp_eligible,
                hide_on_kitchen_close: cat.hide_on_kitchen_close,
                display_order: index + 1
            }))

            const { error } = await supabase.from('menu_categories').upsert(updates, { onConflict: 'id' })
            if (error) throw error
            toast.success('บันทึกลำดับหมวดหมู่แล้ว', { duration: 1500 })
        } catch (err) {
            console.error('Failed to save order', err)
            toast.error('บันทึกลำดับไม่สำเร็จ')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="text-[oklch(18%_0.012_28)] pb-12 animate-fade-in font-sans">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-[oklch(85%_0.012_28)]">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold font-mono uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                            Menu Categories
                        </h2>
                        <span className="font-mono text-xs text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)] px-2 py-0.5 rounded-sm border border-[oklch(85%_0.012_28)]">
                            {categories.length} หมวดหมู่
                        </span>
                        {isSaving && (
                            <span className="text-xs font-mono text-[oklch(52%_0.16_28)] animate-pulse font-bold">
                                กำลังบันทึกลำดับ...
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                        จัดลำดับหมวดหมู่แสดงผลบน POS, Customer Menu และตั้งค่าเครื่องดื่มสะสมแก้ว 10 แถม 1
                    </p>
                </div>

                <button 
                    onClick={handleCreate} 
                    className="bg-[oklch(18%_0.012_28)] text-white px-4 py-2 rounded-sm font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-black transition-colors shadow-sm cursor-pointer"
                >
                    <Plus size={15} /> เพิ่มหมวดหมู่ (New Category)
                </button>
            </div>

            {/* Reorderable Categories List */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-16 bg-[oklch(94%_0.010_28)] animate-pulse rounded-sm border border-[oklch(85%_0.012_28)]" />
                    ))}
                </div>
            ) : categories.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-[oklch(85%_0.012_28)] rounded-sm bg-[oklch(97%_0.008_28)] text-[oklch(55%_0.010_28)] font-mono text-xs">
                    ยังไม่มีหมวดหมู่เมนู คลิก "เพิ่มหมวดหมู่" เพื่อเริ่มต้น
                </div>
            ) : (
                <Reorder.Group axis="y" values={categories} onReorder={handleReorder} className="grid gap-2.5">
                    {categories.map((cat, index) => (
                        <CategoryItem 
                            key={cat.id} 
                            category={cat} 
                            index={index}
                            itemCount={itemCounts[cat.id] || 0}
                            onEdit={() => handleEdit(cat)} 
                            onDelete={() => handleDelete(cat)}
                            onDragEnd={saveOrder}
                        />
                    ))}
                </Reorder.Group>
            )}

            {/* Create / Edit Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-[oklch(97%_0.008_28)] w-full max-w-md rounded-sm border border-[oklch(85%_0.012_28)] shadow-2xl p-6 font-sans">
                        <div className="flex justify-between items-center mb-6 pb-3 border-b border-[oklch(85%_0.012_28)]">
                            <div>
                                <h3 className="font-mono text-base font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                                    {editingCategory ? 'แก้ไขหมวดหมู่' : 'สร้างหมวดหมู่ใหม่'}
                                </h3>
                                <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                                    กำหนดชื่อและสิทธิ์ร่วมรายการสะสมแต้ม
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-black hover:bg-[oklch(90%_0.012_28)] rounded-sm cursor-pointer transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase mb-1.5">
                                    ชื่อหมวดหมู่ (Category Name) *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="เช่น Coffee, Signature Drinks, Pasta, Bakery"
                                    className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-3 text-sm text-[oklch(18%_0.012_28)] font-bold focus:border-[oklch(52%_0.16_28)] outline-none transition-colors"
                                    autoFocus
                                    required
                                />
                            </div>

                            {/* Drink Stamp Punchcard Toggle */}
                            <div className="p-3.5 bg-white border border-[oklch(85%_0.012_28)] rounded-sm flex items-start justify-between gap-3">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-sm">
                                            10 FREE 1
                                        </span>
                                        <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                                            ร่วมรายการเครื่องดื่ม 10 แถม 1
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-[oklch(55%_0.010_28)] font-mono leading-relaxed">
                                        เปิดสิทธิ์ให้เมนูในหมวดนี้สะสมแก้วอัตโนมัติเมื่อลูกค้าสั่งซื้อ
                                    </p>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={formData.is_drink_stamp_eligible}
                                    onChange={e => setFormData({ ...formData, is_drink_stamp_eligible: e.target.checked })}
                                    className="w-5 h-5 accent-[oklch(52%_0.16_28)] cursor-pointer mt-1"
                                />
                            </div>

                            {/* Kitchen Cutoff 22:00 Toggle */}
                            <div className="p-3.5 bg-white border border-[oklch(85%_0.012_28)] rounded-sm flex items-start justify-between gap-3">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded-sm">
                                            KITCHEN CUTOFF
                                        </span>
                                        <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                                            ซ่อนหมวดหมู่นี้เมื่อครัวปิด (22:00 น.)
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-[oklch(55%_0.010_28)] font-mono leading-relaxed">
                                        เมื่อถึงเวลาปิดรับออเดอร์ครัว จะซ่อนหมวดหมู่นี้และเมนูทั้งหมดในหมวดไม่ให้สั่งผ่าน QR
                                    </p>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={formData.hide_on_kitchen_close}
                                    onChange={e => setFormData({ ...formData, hide_on_kitchen_close: e.target.checked })}
                                    className="w-5 h-5 accent-rose-600 cursor-pointer mt-1"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold text-xs uppercase py-2.5 rounded-sm hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer"
                                >
                                    ยกเลิก
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 bg-[oklch(18%_0.012_28)] text-white font-mono font-bold text-xs uppercase py-2.5 rounded-sm hover:bg-black transition-colors shadow-sm cursor-pointer"
                                >
                                    บันทึกหมวดหมู่
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

function CategoryItem({ category, index, itemCount, onEdit, onDelete, onDragEnd }) {
    const controls = useDragControls()

    return (
        <Reorder.Item 
            value={category} 
            dragListener={false} 
            dragControls={controls}
            onDragEnd={onDragEnd}
            className="bg-white border border-[oklch(85%_0.012_28)] p-3.5 rounded-sm flex items-center justify-between group relative select-none hover:border-[oklch(52%_0.16_28)] transition-colors shadow-sm"
        >
            <div className="flex items-center gap-3.5 min-w-0">
                {/* Drag Handle */}
                <div 
                    onPointerDown={(e) => {
                        e.preventDefault()
                        controls.start(e)
                    }}
                    onTouchStart={(e) => {
                        e.preventDefault()
                        controls.start(e)
                    }}
                    className="bg-[oklch(94%_0.010_28)] w-9 h-9 rounded-sm flex items-center justify-center text-[oklch(55%_0.010_28)] cursor-grab active:cursor-grabbing hover:bg-[oklch(90%_0.012_28)] hover:text-black transition-colors touch-none border border-[oklch(85%_0.012_28)]"
                    style={{ touchAction: 'none' }}
                    title="ลากเพื่อเปลี่ยนลำดับ"
                >
                    <GripVertical size={16} />
                </div>

                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[oklch(55%_0.010_28)]">
                            #{index + 1}
                        </span>
                        <h4 className="font-bold text-base text-[oklch(18%_0.012_28)] truncate">
                            {category.name}
                        </h4>
                        {category.is_drink_stamp_eligible && (
                            <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                10 FREE 1
                            </span>
                        )}
                        {category.hide_on_kitchen_close && (
                            <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                🍳 ปิดครัว 22:00
                            </span>
                        )}
                    </div>
                    <p className="text-xs font-mono text-[oklch(55%_0.010_28)] mt-0.5">
                        {itemCount} เมนูในหมวดนี้
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
                <button 
                    onClick={onEdit} 
                    className="p-2 text-[oklch(55%_0.010_28)] hover:text-black hover:bg-[oklch(94%_0.010_28)] rounded-sm transition-colors border border-transparent hover:border-[oklch(85%_0.012_28)] cursor-pointer"
                    title="แก้ไขหมวดหมู่"
                >
                    <Edit2 size={15} />
                </button>
                <button 
                    onClick={onDelete} 
                    className="p-2 text-[oklch(55%_0.010_28)] hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors border border-transparent hover:border-red-200 cursor-pointer"
                    title="ลบหมวดหมู่"
                >
                    <Trash2 size={15} />
                </button>
            </div>
        </Reorder.Item>
    )
}
