/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, X, GripVertical } from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'
import { toast } from 'sonner'

// --- Reusable Rams Confirmation Dialog ---
function ConfirmModal({ isOpen, title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', isDanger = false, onConfirm, onCancel }) {
    if (!isOpen) return null
    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[10000] flex items-center justify-center p-4">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] max-w-sm w-full p-5 rounded-sm shadow-xl font-sans">
                <h3 className="tabular-nums text-sm font-bold tracking-tight text-[var(--color-ink)]">{title}</h3>
                <p className="text-[13px] text-[var(--color-muted)] font-sans mt-2 whitespace-pre-line leading-relaxed">{message}</p>
                <div className="flex gap-2 mt-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="admin-btn h-9 flex-1"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`flex-1 px-3 py-2 text-xs tabular-nums font-bold rounded-sm transition-colors duration-150 cursor-pointer text-[var(--color-paper)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] ${
                            isDanger
                                ? 'bg-red-700 hover:bg-red-800'
                                : 'bg-[var(--color-ink)] hover:bg-[var(--color-ink)]'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

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

    // Custom confirm dialog state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'ยืนยัน',
        isDanger: false,
        onConfirm: () => {}
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

    const handleDelete = (cat) => {
        const count = itemCounts[cat.id] || 0
        const message = count > 0
            ? `หมวดหมู่ "${cat.name}" มีเมนูอยู่ ${count} รายการ\nการลบหมวดหมู่นี้อาจทำให้เมนูดังกล่าวกลายเป็น Uncategorized ยืนยันการลบหรือไม่?`
            : `คุณต้องการลบหมวดหมู่ "${cat.name}" ใช่หรือไม่?`

        setConfirmModal({
            isOpen: true,
            title: 'ยืนยันการลบหมวดหมู่',
            message,
            confirmText: 'ลบหมวดหมู่',
            isDanger: true,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }))
                try {
                    const { data: delCat, error } = await supabase.from('menu_categories').delete().eq('id', cat.id).select('id')
                    if (error) throw error
                    if (!delCat || delCat.length === 0) {
                        throw new Error('ไม่มีสิทธิ์ในการลบหมวดหมู่ (Permission Denied ในระบบ RLS)')
                    }
                    setCategories(prev => prev.filter(c => c.id !== cat.id))
                    toast.success(`ลบหมวดหมู่ "${cat.name}" สำเร็จ`)
                } catch (err) {
                    console.error('Delete category error:', err)
                    toast.error('ลบหมวดหมู่ไม่สำเร็จ: ' + err.message)
                }
            }
        })
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
                display_order: parseInt(formData.display_order, 10) || 0,
                is_drink_stamp_eligible: formData.is_drink_stamp_eligible === true,
                hide_on_kitchen_close: formData.hide_on_kitchen_close === true
            }

            if (editingCategory) {
                const { data: updatedCat, error } = await supabase
                    .from('menu_categories')
                    .update(payload)
                    .eq('id', editingCategory.id)
                    .select('id')
                if (error) throw error
                if (!updatedCat || updatedCat.length === 0) {
                    throw new Error('ไม่มีสิทธิ์ในการแก้ไขหมวดหมู่ (Permission Denied ในระบบ RLS)')
                }

                // Many screens (Menu cost, Recipe Lab, SOP, reports) still read the item's text
                // category, so a rename must reach the items too or they keep showing the old name
                if (editingCategory.name !== trimmedName) {
                    const { error: renameErr } = await supabase
                        .from('menu_items')
                        .update({ category: trimmedName })
                        .eq('category_id', editingCategory.id)
                    if (renameErr) toast.warning('เปลี่ยนชื่อหมวดแล้ว แต่อัปเดตชื่อหมวดในเมนูไม่สำเร็จ: ' + renameErr.message)
                }

                if (editingCategory.is_drink_stamp_eligible !== formData.is_drink_stamp_eligible) {
                    await supabase
                        .from('menu_items')
                        .update({ is_drink_stamp_eligible: formData.is_drink_stamp_eligible })
                        .eq('category_id', editingCategory.id)
                }

                toast.success('อัปเดตหมวดหมู่สำเร็จ')
            } else {
                const { data: insertedCat, error } = await supabase
                    .from('menu_categories')
                    .insert(payload)
                    .select('id')
                if (error) throw error
                if (!insertedCat || insertedCat.length === 0) {
                    throw new Error('ไม่มีสิทธิ์ในการสร้างหมวดหมู่ (Permission Denied ในระบบ RLS)')
                }
                toast.success('สร้างหมวดหมู่ใหม่สำเร็จ')
            }

            setIsModalOpen(false)
            fetchData()
        } catch (error) {
            toast.error('บันทึกไม่สำเร็จ: ' + error.message)
        }
    }

    // --- Drag & Drop Reordering (Silent Success) ---
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

            const { data: upsertedCats, error } = await supabase.from('menu_categories').upsert(updates, { onConflict: 'id' }).select('id')
            if (error) throw error
            if (!upsertedCats || upsertedCats.length === 0) {
                throw new Error('ไม่มีสิทธิ์ในการบันทึกลำดับหมวดหมู่ (Permission Denied ในระบบ RLS)')
            }
            // Silent success: visual position + header indicator already provide feedback
        } catch (err) {
            console.error('Failed to save order', err)
            toast.error('บันทึกลำดับไม่สำเร็จ')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="text-[var(--color-ink)] pb-12 animate-fade-in font-sans">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <p className="text-[13px] leading-5 text-[var(--color-muted)] min-w-0">
                    <span className="text-[var(--color-ink)] font-medium tabular-nums">{categories.length} หมวดหมู่</span>
                    <span> · จัดลำดับหมวดหมู่แสดงผลบน POS, Customer Menu และตั้งค่าเครื่องดื่มสะสมแก้ว 10 แถม 1</span>
                    {isSaving && <span className="ml-2 text-[var(--brand-plum)]">กำลังบันทึกลำดับ...</span>}
                </p>

                <button 
                    onClick={handleCreate} 
                    className="admin-btn is-primary h-9"
                >
                    <Plus size={15} /> เพิ่มหมวดหมู่
                </button>
            </div>

            {/* Reorderable Categories List */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-16 bg-[var(--color-paper-2)] rounded-sm border border-[var(--color-rule)]" />
                    ))}
                </div>
            ) : categories.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-[var(--color-rule)] rounded-sm bg-[var(--color-paper)] text-[var(--color-neutral)] tabular-nums text-xs">
                    ยังไม่มีหมวดหมู่เมนู คลิก "เพิ่มหมวดหมู่" เพื่อเริ่มต้น
                </div>
            ) : (
                <Reorder.Group axis="y" values={categories} onReorder={handleReorder} className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
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

            {/* Create / Edit Planar Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
                    <div className="bg-[var(--color-paper)] w-full max-w-md rounded-sm border border-[var(--color-rule)] shadow-2xl p-6 font-sans">
                        <div className="flex justify-between items-center mb-5 pb-3 border-b border-[var(--color-rule)]">
                            <div>
                                <h3 className="tabular-nums text-base font-bold tracking-tight text-[var(--color-ink)]">
                                    {editingCategory ? 'แก้ไขหมวดหมู่' : 'สร้างหมวดหมู่ใหม่'}
                                </h3>
                                <p className="text-[13px] text-[var(--color-neutral)] tabular-nums mt-0.5">
                                    กำหนดชื่อและสิทธิ์ร่วมรายการสะสมแต้ม
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-xs cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs tabular-nums font-bold text-[var(--color-muted)] mb-1.5">
                                    ชื่อหมวดหมู่ (Category Name) *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="เช่น Coffee, Signature Drinks, Pasta, Bakery"
                                    className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xs p-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--brand-plum)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] transition-colors duration-150"
                                    autoFocus
                                    required
                                />
                            </div>

                            {/* Drink Stamp Punchcard Toggle (Planar Row) */}
                            <label className="p-3 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xs flex items-start justify-between gap-3 cursor-pointer hover:bg-[var(--color-paper-2)] transition-colors duration-150">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="tabular-nums text-[11px] font-bold bg-[oklch(96%_0.03_80)] text-[oklch(35%_0.08_60)] border border-[oklch(88%_0.06_80)] px-1.5 py-0.2 rounded-xs">
                                            10 ฟรี 1
                                        </span>
                                        <span className="tabular-nums text-xs font-bold text-[var(--color-ink)]">
                                            ร่วมรายการเครื่องดื่ม 10 แถม 1
                                        </span>
                                    </div>
                                    <p className="text-[13px] text-[var(--color-neutral)] tabular-nums leading-relaxed">
                                        เปิดสิทธิ์ให้เมนูในหมวดนี้สะสมแก้วอัตโนมัติเมื่อลูกค้าสั่งซื้อ
                                    </p>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={formData.is_drink_stamp_eligible}
                                    onChange={e => setFormData({ ...formData, is_drink_stamp_eligible: e.target.checked })}
                                    className="w-4 h-4 accent-[var(--brand-plum)] cursor-pointer mt-1"
                                />
                            </label>

                            {/* Kitchen Cutoff Toggle (Planar Row, No Emoji) */}
                            <label className="p-3 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xs flex items-start justify-between gap-3 cursor-pointer hover:bg-[var(--color-paper-2)] transition-colors duration-150">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="tabular-nums text-[11px] font-bold bg-[oklch(95%_0.03_25)] text-[oklch(42%_0.14_25)] border border-[oklch(88%_0.05_25)] px-1.5 py-0.2 rounded-xs">
                                            KITCHEN CUTOFF
                                        </span>
                                        <span className="tabular-nums text-xs font-bold text-[var(--color-ink)]">
                                            ซ่อนหมวดหมู่นี้เมื่อครัวปิด
                                        </span>
                                    </div>
                                    <p className="text-[13px] text-[var(--color-neutral)] tabular-nums leading-relaxed">
                                        เมื่อถึงเวลาปิดรับออเดอร์ครัว จะซ่อนหมวดหมู่นี้และเมนูทั้งหมดในหมวดไม่ให้สั่งผ่าน QR
                                    </p>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={formData.hide_on_kitchen_close}
                                    onChange={e => setFormData({ ...formData, hide_on_kitchen_close: e.target.checked })}
                                    className="w-4 h-4 accent-rose-700 cursor-pointer mt-1"
                                />
                            </label>

                            {/* Modal Actions */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="admin-btn h-9 flex-1"
                                >
                                    ยกเลิก
                                </button>
                                <button 
                                    type="submit" 
                                    className="admin-btn is-primary h-9 flex-1"
                                >
                                    บันทึกหมวดหมู่
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Reusable Confirm Dialog */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDanger={confirmModal.isDanger}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
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
            className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-sm flex items-center justify-between group relative select-none hover:border-[var(--brand-plum)] transition-colors duration-150 "
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
                    className="bg-[var(--color-paper-2)] w-8 h-8 rounded-xs flex items-center justify-center text-[var(--color-neutral)] cursor-grab active:cursor-grabbing hover:bg-[var(--color-paper-3)] hover:text-[var(--color-ink)] transition-colors duration-150 touch-none border border-[var(--color-rule)] shrink-0"
                    style={{ touchAction: 'none' }}
                    title="ลากเพื่อเปลี่ยนลำดับ"
                >
                    <GripVertical size={15} />
                </div>

                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className=" text-xs font-bold text-[var(--color-neutral)] tabular-nums">
                            #{index + 1}
                        </span>
                        <h4 className="font-bold text-base text-[var(--color-ink)] truncate">
                            {category.name}
                        </h4>
                        {category.is_drink_stamp_eligible && (
                            <span className="tabular-nums text-[11px] font-bold bg-[oklch(96%_0.03_80)] text-[oklch(35%_0.08_60)] border border-[oklch(88%_0.06_80)] px-1.5 py-0.2 rounded-xs">
                                10 ฟรี 1
                            </span>
                        )}
                        {category.hide_on_kitchen_close && (
                            <span className="tabular-nums text-[11px] font-bold bg-[oklch(95%_0.03_25)] text-[oklch(42%_0.14_25)] border border-[oklch(88%_0.05_25)] px-1.5 py-0.2 rounded-xs">
                                ซ่อนเมื่อครัวปิด
                            </span>
                        )}
                    </div>
                    <p className="text-[13px] text-[var(--color-neutral)] mt-0.5 tabular-nums">
                        {itemCount} เมนูในหมวดนี้
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                <button 
                    onClick={onEdit} 
                    className="p-1.5 text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-xs transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                    title="แก้ไขหมวดหมู่"
                >
                    <Edit2 size={14} />
                </button>
                <button 
                    onClick={onDelete} 
                    className="p-1.5 text-[var(--color-neutral)] hover:text-red-700 hover:bg-red-50 rounded-xs transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                    title="ลบหมวดหมู่"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </Reorder.Item>
    )
}
