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
        // Only these columns are sent, so an existing icon value in the database is left as is.
        const { error } = await supabase.from('stock_categories').upsert({ id, label, sort_order: order });
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

    const field = 'w-full px-3 py-2 bg-white border border-[oklch(85%_0.012_28)] text-[14px] leading-6 text-[oklch(18%_0.012_28)] outline-none focus:border-[oklch(18%_0.012_28)] disabled:bg-[oklch(94%_0.010_28)] disabled:text-[oklch(55%_0.010_28)]';
    const label = 'block mb-1 text-[12px] leading-5 font-bold text-[oklch(42%_0.010_28)]';

    return createPortal(
        <div className="fixed inset-0 z-[60] bg-black/50 flex justify-end" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="cat-manager-title" onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-md h-full flex flex-col bg-[oklch(97%_0.008_28)] border-l border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-sans">
                <header className="shrink-0 grid grid-cols-[1fr_auto] border-b border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]">
                    <div className="px-4 py-3 min-w-0">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">CATEGORIES · {categories.length}</span>
                        <h2 id="cat-manager-title" className="font-bold text-lg leading-7">หมวดหมู่วัตถุดิบ</h2>
                    </div>
                    <button type="button" onClick={onClose} className="px-4 font-bold text-[13px] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">
                        ปิด
                    </button>
                </header>

                <form onSubmit={handleSave} className="shrink-0 px-4 py-3 border-b border-[oklch(85%_0.012_28)] grid grid-cols-[1fr_5rem] gap-x-2 gap-y-3">
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
                            className="py-2.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold text-[14px] leading-6 hover:bg-black disabled:opacity-60 cursor-pointer">
                            {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มหมวด'}
                        </button>
                        {editingId && (
                            <button type="button" onClick={reset}
                                className="px-4 border border-[oklch(85%_0.012_28)] bg-white font-bold text-[14px] leading-6 text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">
                                ยกเลิก
                            </button>
                        )}
                    </div>
                </form>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {loading ? (
                        <p className="p-6 text-[14px] text-[oklch(55%_0.010_28)]">กำลังโหลด...</p>
                    ) : categories.length === 0 ? (
                        <p className="p-6 text-[14px] text-[oklch(42%_0.010_28)]">ยังไม่มีหมวด</p>
                    ) : (
                        <ul className="divide-y divide-[oklch(90%_0.008_28)] bg-white border-b border-[oklch(85%_0.012_28)]">
                            {categories.map(cat => (
                                <li key={cat.id} className={`grid grid-cols-[2.5rem_1fr_auto] items-center ${editingId === cat.id ? 'bg-[oklch(94%_0.010_28)]' : ''}`}>
                                    <span className="px-3 py-2 font-mono text-[12px] text-[oklch(55%_0.010_28)] tabular-nums">{cat.sort_order ?? '—'}</span>
                                    <span className="min-w-0 py-2">
                                        <span className="block font-bold text-[14px] leading-6 break-words">{cat.label}</span>
                                        <span className="block font-mono text-[12px] leading-5 text-[oklch(55%_0.010_28)] break-all">{cat.id}</span>
                                    </span>
                                    <span className="flex self-stretch divide-x divide-[oklch(90%_0.008_28)] border-l border-[oklch(90%_0.008_28)]">
                                        <button type="button" onClick={() => startEdit(cat)}
                                            className="px-3 text-[13px] leading-5 font-bold text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">
                                            แก้
                                        </button>
                                        {!LOCKED.has(cat.id) && (
                                            <button type="button" onClick={() => handleDelete(cat)}
                                                className="px-3 text-[13px] leading-5 font-bold text-[oklch(52%_0.16_28)] hover:bg-[oklch(95%_0.025_28)] cursor-pointer">
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
