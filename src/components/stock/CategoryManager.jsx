/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Ledger drawer · theme: Thai Modern OKLCH */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';

const EMPTY = { id: '', label: '', sort_order: '' };
const LOCKED = new Set(['restock', 'all']);

/** Stock categories: name, code and order. Text only, no icons. */
export default function CategoryManager({ onClose, onUpdate }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    const fetchCategories = async () => {
        const { data } = await supabase.from('stock_categories').select('id, label, sort_order').order('sort_order');
        setCategories(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchCategories(); }, []);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const reset = () => { setEditingId(null); setForm(EMPTY); };

    const handleSave = async (e) => {
        e.preventDefault();
        const id = form.id.trim();
        const label = form.label.trim();
        if (!id || !label) { toast.error('ใส่ชื่อหมวดและรหัสก่อน'); return; }
        if (!editingId && categories.some(c => c.id === id)) { toast.error('รหัสนี้มีอยู่แล้ว'); return; }
        const order = form.sort_order === '' ? (categories.length ? Math.max(...categories.map(c => Number(c.sort_order) || 0)) + 1 : 1) : Number(form.sort_order);
        setSaving(true);
        const { error } = editingId
            ? await supabase.from('stock_categories').update({ label, sort_order: order }).eq('id', editingId)
            : await supabase.from('stock_categories').insert({ id, label, icon: '', sort_order: order });
        setSaving(false);
        if (error) { toast.error(`บันทึกไม่สำเร็จ: ${error.message}`); return; }
        toast.success(editingId ? 'แก้หมวดแล้ว' : 'เพิ่มหมวดแล้ว');
        reset();
        fetchCategories();
        onUpdate?.();
    };

    const handleDelete = async (cat) => {
        if (!confirm(`ลบหมวด "${cat.label}"?\nวัตถุดิบในหมวดนี้ไม่ถูกลบ แต่จะไม่ขึ้นในแท็บหมวดนี้`)) return;
        const { error } = await supabase.from('stock_categories').delete().eq('id', cat.id);
        if (error) { toast.error(`ลบไม่สำเร็จ: ${error.message}`); return; }
        toast.success('ลบหมวดแล้ว');
        if (editingId === cat.id) reset();
        fetchCategories();
        onUpdate?.();
    };

    const startEdit = (cat) => {
        setEditingId(cat.id);
        setForm({ id: cat.id, label: cat.label || '', sort_order: cat.sort_order ?? '' });
    };

    const field = 'w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-base leading-6 text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] disabled:bg-[var(--color-paper-2)] disabled:text-[var(--color-neutral)]';
    const label = 'block mb-1 text-[12px] leading-5 font-bold text-[var(--color-muted)]';

    return createPortal(
        <div className="fixed inset-0 z-[60] bg-[var(--color-veil)] flex justify-end" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="cat-manager-title" onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-md h-full flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-rule)] text-[var(--color-ink)] font-sans">
                <header className="shrink-0 grid grid-cols-[1fr_auto] border-b border-[var(--color-rule)] divide-x divide-[var(--color-rule)]">
                    <div className="px-4 py-3 min-w-0">
                        <h2 id="cat-manager-title" className="font-bold text-xl leading-7">หมวดหมู่วัตถุดิบ</h2>
                    </div>
                    <button type="button" onClick={onClose} className="px-4 font-bold text-[14px] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] active:translate-y-px cursor-pointer transition-colors">
                        ปิด
                    </button>
                </header>

                <form onSubmit={handleSave} className="shrink-0 px-4 py-3 border-b border-[var(--color-rule)] grid grid-cols-[1fr_5rem] gap-x-2 gap-y-3">
                    <label className="col-span-2">
                        <span className={label}>{editingId ? `แก้หมวด "${editingId}"` : 'ชื่อหมวด'}</span>
                        <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="เช่น ผัก" className={field} />
                    </label>
                    <label>
                        <span className={label}>รหัส (อังกฤษ ใช้ในระบบ)</span>
                        <input value={form.id} onChange={e => setForm({ ...form, id: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                            disabled={!!editingId} placeholder="veg" className={`${field} font-mono`} />
                    </label>
                    <label>
                        <span className={label}>ลำดับ</span>
                        <input type="number" inputMode="numeric" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })}
                            placeholder="ท้ายสุด" className={`${field} font-mono`} />
                    </label>
                    <div className={`col-span-2 grid ${editingId ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'} gap-2`}>
                        <button type="submit" disabled={saving}
                            className="py-2.5 bg-[var(--color-ink)] text-[var(--color-paper)] font-bold text-[14px] leading-6 hover:bg-[var(--action-primary-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] focus-visible:outline-offset-2 active:translate-y-px disabled:opacity-60 cursor-pointer transition-colors">
                            {saving ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มหมวด'}
                        </button>
                        {editingId && (
                            <button type="button" onClick={reset}
                                className="px-4 border border-[var(--color-rule)] bg-[var(--color-paper)] font-bold text-[14px] leading-6 text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] active:translate-y-px cursor-pointer transition-colors">
                                ยกเลิก
                            </button>
                        )}
                    </div>
                </form>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {loading ? (
                        <p className="p-6 text-[14px] text-[var(--color-neutral)]">กำลังโหลด…</p>
                    ) : categories.length === 0 ? (
                        <p className="p-6 text-[14px] text-[var(--color-muted)]">ยังไม่มีหมวด</p>
                    ) : (
                        <ul className="divide-y divide-[var(--color-paper-3)] bg-[var(--color-paper)] border-b border-[var(--color-rule)]">
                            {categories.map(cat => (
                                <li key={cat.id} className={`grid grid-cols-[2.5rem_1fr_auto] items-center ${editingId === cat.id ? 'bg-[var(--color-paper-2)]' : ''}`}>
                                    <span className="px-3 py-2 text-[12px] text-[var(--color-neutral)] tabular-nums">{cat.sort_order ?? '-'}</span>
                                    <span className="min-w-0 py-2">
                                        <span className="block font-bold text-[14px] leading-6 break-words">{cat.label}</span>
                                        <span className="block font-mono text-[12px] leading-5 text-[var(--color-neutral)] break-all">{cat.id}</span>
                                    </span>
                                    <span className="flex self-stretch divide-x divide-[var(--color-paper-3)] border-l border-[var(--color-paper-3)]">
                                        <button type="button" onClick={() => startEdit(cat)}
                                            className="px-3 text-[14px] leading-5 font-bold text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] active:translate-y-px cursor-pointer transition-colors">
                                            แก้
                                        </button>
                                        {!LOCKED.has(cat.id) && (
                                            <button type="button" onClick={() => handleDelete(cat)}
                                                className="px-3 text-[14px] leading-5 font-bold text-[var(--error-red)] hover:bg-[var(--color-plum-pale)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] active:translate-y-px cursor-pointer transition-colors">
                                                ลบ
                                            </button>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
