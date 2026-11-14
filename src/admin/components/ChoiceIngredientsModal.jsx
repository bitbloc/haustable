/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabaseClient'
import { ITEM_TYPE_LABELS, getItemType } from '../../utils/recipeGraph'
import { planChoiceIngredientSave, validateChoiceIngredients } from '../../utils/optionIngredients'

const INK = 'text-[oklch(18%_0.012_28)]'
const MUTED = 'text-[oklch(42%_0.010_28)]'
const NEUTRAL = 'text-[oklch(55%_0.010_28)]'
const RULE = 'border-[oklch(85%_0.012_28)]'
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-[oklch(60%_0.15_28)]'

let keySeq = 0
const nextKey = () => `row_${++keySeq}`

const toDraft = (row) => ({
    key: nextKey(),
    id: row.id || null,
    stock_item_id: row.stock_item_id || '',
    menu_item_id: row.menu_item_id ?? null,
    sign: Number(row.quantity) < 0 ? 'minus' : 'plus',
    amount: row.quantity ? String(Math.abs(Number(row.quantity))) : ''
})

/**
 * Edit what one option choice adds to or takes from stock per ordered item.
 * Rows are saved to option_choice_ingredients; sales pick them up through the shadow ledger.
 */
export default function ChoiceIngredientsModal({ choice, group, onClose, onSaved }) {
    const [loading, setLoading] = useState(true)
    const [missing, setMissing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [stockItems, setStockItems] = useState([])
    const [menus, setMenus] = useState([])
    const [existing, setExisting] = useState([])
    const [draft, setDraft] = useState([])
    const [errors, setErrors] = useState({})
    const [search, setSearch] = useState('')
    const searchRef = useRef(null)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            const [rowsRes, itemsRes, linkRes] = await Promise.all([
                supabase.from('option_choice_ingredients').select('id, choice_id, menu_item_id, stock_item_id, quantity').eq('choice_id', choice.id),
                supabase.from('stock_items').select('*').order('name'),
                supabase.from('menu_item_options').select('menu_item_id').eq('option_group_id', group.id)
            ])
            if (cancelled) return
            if (rowsRes.error) {
                const msg = `${rowsRes.error.code} ${rowsRes.error.message}`
                if (/42P01|PGRST205|does not exist|Could not find/i.test(msg)) setMissing(true)
                else toast.error('โหลดวัตถุดิบของตัวเลือกไม่ได้')
                setLoading(false)
                return
            }
            const menuIds = [...new Set((linkRes.data || []).map(l => l.menu_item_id).filter(Boolean))]
            let menuRows = []
            if (menuIds.length) {
                const { data } = await supabase.from('menu_items').select('id, name').in('id', menuIds).order('name')
                menuRows = data || []
            }
            if (cancelled) return
            setExisting(rowsRes.data || [])
            setDraft((rowsRes.data || []).map(toDraft))
            setStockItems(itemsRes.data || [])
            setMenus(menuRows)
            setLoading(false)
        }
        load()
        return () => { cancelled = true }
    }, [choice.id, group.id])

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose, saving])

    const itemsById = useMemo(() => new Map(stockItems.map(i => [i.id, i])), [stockItems])

    const matches = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return []
        return stockItems.filter(i => String(i.name || '').toLowerCase().includes(q)).slice(0, 8)
    }, [search, stockItems])

    const updateRow = (key, patch) => {
        setDraft(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))
        setErrors(prev => {
            if (!prev[key]) return prev
            const next = { ...prev }
            delete next[key]
            return next
        })
    }

    const addItem = (item) => {
        setDraft(prev => [...prev, { ...toDraft({ stock_item_id: item.id }), sign: 'plus' }])
        setSearch('')
        searchRef.current?.focus()
    }

    const removeRow = (key) => setDraft(prev => prev.filter(r => r.key !== key))

    const handleSave = async () => {
        const { rows, errors: found } = validateChoiceIngredients(draft)
        setErrors(found)
        if (Object.keys(found).length) {
            toast.error('ยังมีแถวที่ต้องแก้')
            return
        }
        const plan = planChoiceIngredientSave(choice.id, existing, rows)
        if (!plan.deletes.length && !plan.updates.length && !plan.inserts.length) {
            onClose()
            return
        }
        setSaving(true)
        try {
            if (plan.deletes.length) {
                const { error } = await supabase.from('option_choice_ingredients').delete().in('id', plan.deletes)
                if (error) throw error
            }
            for (const u of plan.updates) {
                const { id, ...payload } = u
                const { error } = await supabase.from('option_choice_ingredients').update(payload).eq('id', id)
                if (error) throw error
            }
            if (plan.inserts.length) {
                const { error } = await supabase.from('option_choice_ingredients').insert(plan.inserts)
                if (error) throw error
            }
            toast.success('บันทึกวัตถุดิบของตัวเลือกแล้ว')
            onSaved?.()
            onClose()
        } catch (error) {
            console.error('Save option ingredients error:', error)
            toast.error(error?.code === '23505' ? 'วัตถุดิบซ้ำในขอบเขตเดียวกัน' : 'บันทึกไม่สำเร็จ')
        } finally {
            setSaving(false)
        }
    }

    return createPortal(
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[10000] flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => { if (!saving) onClose() }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="choice-ingredients-title"
                className={`bg-[oklch(98%_0.004_28)] border ${RULE} w-full sm:max-w-xl max-h-[92vh] flex flex-col rounded-t-sm sm:rounded-sm shadow-xl font-sans`}
                onClick={e => e.stopPropagation()}
            >
                <div className={`px-5 pt-5 pb-4 border-b ${RULE}`}>
                    <p className={`font-mono text-[10px] tracking-wider ${NEUTRAL}`}>วัตถุดิบของตัวเลือก · {group.name}</p>
                    <h3 id="choice-ingredients-title" className={`text-lg font-bold leading-snug mt-1 ${INK}`}>{choice.name}</h3>
                    <p className={`text-xs leading-relaxed mt-2 ${MUTED}`}>
                        จำนวนต่อ 1 ที่ที่สั่ง เป็นหน่วยใช้ของวัตถุดิบ เลือก “ใช้เพิ่ม” สำหรับของที่ใส่เพิ่ม (เพิ่มช็อต, ไข่ดาว)
                        และ “ใช้น้อยลง” สำหรับของที่ตัวเลือกนี้เอาออกจากสูตรหลัก (เปลี่ยนนมวัวเป็นนมโอ๊ต)
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <p className={`text-xs font-mono py-6 text-center ${NEUTRAL}`}>กำลังโหลด…</p>
                    ) : missing ? (
                        <p className={`text-sm leading-relaxed py-4 ${MUTED}`}>
                            ฐานข้อมูลยังไม่มีตาราง option_choice_ingredients ต้องติดตั้ง migration ตัดสต๊อกแบบเงา (sale stock shadow) ก่อน
                        </p>
                    ) : (
                        <>
                            {draft.length === 0 && (
                                <p className={`text-sm leading-relaxed pb-4 ${MUTED}`}>
                                    ยังไม่ได้ผูกวัตถุดิบ ตัวเลือกนี้จะไม่ตัดหรือคืนสต๊อกเพิ่มจากสูตรหลักของเมนู
                                </p>
                            )}

                            <ul className="space-y-2">
                                {draft.map(row => {
                                    const item = itemsById.get(row.stock_item_id)
                                    const unit = item?.usage_unit || item?.unit || ''
                                    const err = errors[row.key]
                                    return (
                                        <li key={row.key} className={`border ${err ? 'border-red-300' : RULE} rounded-xs bg-[oklch(97%_0.008_28)] p-3`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-bold leading-snug ${INK}`}>{item?.name || 'ไม่พบวัตถุดิบ'}</p>
                                                    {item && (
                                                        <p className={`font-mono text-[10px] mt-0.5 ${NEUTRAL}`}>{ITEM_TYPE_LABELS[getItemType(item)] || ''} · หน่วยใช้ {unit || '-'}</p>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeRow(row.key)}
                                                    className={`shrink-0 font-mono text-[11px] px-2 py-1 ${NEUTRAL} hover:text-red-700 rounded-xs cursor-pointer ${FOCUS}`}
                                                >
                                                    ลบ
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_1fr] gap-2 mt-3 items-center">
                                                <div className={`flex border ${RULE} rounded-xs overflow-hidden text-xs font-bold`} role="group" aria-label="เพิ่มหรือลด">
                                                    {[['plus', 'ใช้เพิ่ม'], ['minus', 'ใช้น้อยลง']].map(([value, label]) => (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            aria-pressed={row.sign === value}
                                                            onClick={() => updateRow(row.key, { sign: value })}
                                                            className={`px-3 py-2 cursor-pointer transition-colors duration-150 ${FOCUS} ${
                                                                row.sign === value
                                                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                                                    : `bg-[oklch(98%_0.004_28)] ${MUTED} hover:bg-[oklch(94%_0.010_28)]`
                                                            }`}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <label className={`flex items-center border ${RULE} rounded-xs bg-[oklch(98%_0.004_28)] focus-within:border-[oklch(52%_0.16_28)]`}>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={row.amount}
                                                        onChange={e => updateRow(row.key, { amount: e.target.value })}
                                                        placeholder="0"
                                                        aria-label={`จำนวน ${item?.name || ''}`}
                                                        className={`w-full min-w-0 bg-transparent px-3 py-2 text-sm font-mono tabular-nums outline-none ${INK}`}
                                                    />
                                                    <span className={`pr-3 text-xs shrink-0 ${NEUTRAL}`}>{unit}</span>
                                                </label>
                                                <select
                                                    value={row.menu_item_id ?? ''}
                                                    onChange={e => updateRow(row.key, { menu_item_id: e.target.value === '' ? null : Number(e.target.value) })}
                                                    aria-label="ใช้กับเมนู"
                                                    className={`col-span-2 sm:col-span-1 w-full border ${RULE} rounded-xs bg-[oklch(98%_0.004_28)] px-2 py-2 text-xs ${INK} ${FOCUS}`}
                                                >
                                                    <option value="">ทุกเมนู</option>
                                                    {menus.map(m => <option key={m.id} value={m.id}>เฉพาะ {m.name}</option>)}
                                                </select>
                                            </div>
                                            {err && <p className="text-xs text-red-700 mt-2">{err}</p>}
                                        </li>
                                    )
                                })}
                            </ul>

                            <div className="mt-4">
                                <label htmlFor="choice-ingredient-search" className={`block font-mono text-[10px] uppercase tracking-wider mb-1.5 ${NEUTRAL}`}>เพิ่มวัตถุดิบ</label>
                                <input
                                    id="choice-ingredient-search"
                                    ref={searchRef}
                                    type="search"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="พิมพ์ชื่อวัตถุดิบ เช่น ช็อต, นมโอ๊ต"
                                    className={`w-full border ${RULE} rounded-xs bg-[oklch(98%_0.004_28)] px-3 py-2 text-sm ${INK} outline-none focus:border-[oklch(52%_0.16_28)]`}
                                />
                                {matches.length > 0 && (
                                    <ul className={`mt-1 border ${RULE} rounded-xs bg-[oklch(98%_0.004_28)] divide-y divide-[oklch(90%_0.010_28)]`}>
                                        {matches.map(i => (
                                            <li key={i.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => addItem(i)}
                                                    className={`w-full text-left px-3 py-2 flex items-baseline justify-between gap-3 hover:bg-[oklch(94%_0.010_28)] cursor-pointer ${FOCUS}`}
                                                >
                                                    <span className={`text-sm leading-snug ${INK}`}>{i.name}</span>
                                                    <span className={`font-mono text-[10px] shrink-0 ${NEUTRAL}`}>{ITEM_TYPE_LABELS[getItemType(i)] || ''} · {i.usage_unit || i.unit || '-'}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {search.trim() && matches.length === 0 && (
                                    <p className={`text-xs mt-2 ${NEUTRAL}`}>ไม่พบวัตถุดิบชื่อนี้</p>
                                )}
                            </div>

                            {menus.length > 0 && (
                                <p className={`text-xs leading-relaxed mt-4 ${NEUTRAL}`}>
                                    แถว “เฉพาะเมนู” จะใช้แทนแถว “ทุกเมนู” ของตัวเลือกนี้เมื่อสั่งเมนูนั้น
                                </p>
                            )}
                        </>
                    )}
                </div>

                <div className={`flex gap-2 px-5 py-4 border-t ${RULE}`}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className={`flex-1 px-3 py-2.5 border ${RULE} bg-[oklch(94%_0.010_28)] ${INK} text-xs font-mono font-bold uppercase rounded-sm hover:bg-[oklch(90%_0.012_28)] transition-colors duration-150 cursor-pointer disabled:opacity-50 ${FOCUS}`}
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || loading || missing}
                        className={`flex-1 px-3 py-2.5 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(14%_0.010_28)] text-[oklch(97%_0.008_28)] text-xs font-mono font-bold uppercase rounded-sm transition-colors duration-150 cursor-pointer disabled:opacity-50 ${FOCUS}`}
                    >
                        {saving ? 'กำลังบันทึก…' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
