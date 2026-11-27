/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabaseClient'
import { ITEM_TYPE_LABELS, getItemType } from '../../utils/recipeGraph'
import { displayUnit } from '../../utils/stockCount'
import {
    parseOptionAmountInput,
    planChoiceIngredientSave,
    stepOptionAmount,
    validateChoiceIngredients
} from '../../utils/optionIngredients'
import { useMenuChoiceGroups } from '../../hooks/useMenuChoiceGroups'
import FixedChoiceEditor from '../../components/recipes/FixedChoiceEditor'

const INK = 'text-[var(--color-ink)]'
const MUTED = 'text-[var(--color-muted)]'
const NEUTRAL = 'text-[var(--color-neutral)]'
const RULE = 'border-[var(--color-rule)]'
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]'

let keySeq = 0
const nextKey = () => `row_${++keySeq}`

const toDraft = (row) => ({
    key: nextKey(),
    id: row.id || null,
    stock_item_id: row.stock_item_id || '',
    linked_menu_item_id: row.linked_menu_item_id ?? null,
    linked_choice_ids: row.linked_choice_ids || [],
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
    const [allMenus, setAllMenus] = useState([])
    const [menus, setMenus] = useState([])
    const [existing, setExisting] = useState([])
    const [draft, setDraft] = useState([])
    const [errors, setErrors] = useState({})
    const [search, setSearch] = useState('')
    const [addMode, setAddMode] = useState('stock') // 'stock' | 'menu'
    const searchRef = useRef(null)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            const [rowsRes, itemsRes, linkRes, allMenusRes] = await Promise.all([
                supabase.from('option_choice_ingredients').select('*').eq('choice_id', choice.id),
                supabase.from('stock_items').select('*').order('name'),
                supabase.from('menu_item_options').select('menu_item_id').eq('option_group_id', group.id),
                supabase.from('menu_items').select('id, name, category').order('name')
            ])
            if (cancelled) return
            if (rowsRes.error) {
                const msg = `${rowsRes.error.code} ${rowsRes.error.message}`
                if (/42P01|PGRST205|does not exist|Could not find/i.test(msg)) setMissing(true)
                else toast.error('โหลดวัตถุดิบของตัวเลือกไม่ได้')
                setLoading(false)
                return
            }
            const menuList = allMenusRes.data || []
            const menuIds = new Set((linkRes.data || []).map(l => Number(l.menu_item_id)).filter(Boolean))
            const menuRows = menuList.filter(m => menuIds.has(Number(m.id)))
            if (cancelled) return
            setExisting(rowsRes.data || [])
            setDraft((rowsRes.data || []).map(toDraft))
            setStockItems(itemsRes.data || [])
            setAllMenus(menuList)
            setMenus(menuRows)
            if ((rowsRes.data || []).some(r => r.linked_menu_item_id != null)) {
                setAddMode('menu')
            }
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
    const menusById = useMemo(() => new Map(allMenus.map(m => [Number(m.id), m])), [allMenus])

    // Option choices of the menus this choice deducts, so the ones always used can be fixed
    const linkedMenuIds = useMemo(() => draft
        .map(r => r.linked_menu_item_id)
        .filter(v => v !== null && v !== undefined && v !== '')
        .map(Number), [draft])
    const linked = useMenuChoiceGroups(linkedMenuIds)

    const matches = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return []
        if (addMode === 'menu') {
            return allMenus.filter(m => String(m.name || '').toLowerCase().includes(q)).slice(0, 8)
        }
        return stockItems.filter(i => String(i.name || '').toLowerCase().includes(q)).slice(0, 8)
    }, [search, stockItems, allMenus, addMode])

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

    const addLinkedMenu = (menu) => {
        setDraft(prev => [...prev, { ...toDraft({ linked_menu_item_id: Number(menu.id), quantity: 1 }), sign: 'plus' }])
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
                className={`bg-[var(--color-paper)] border ${RULE} w-full sm:max-w-xl max-h-[92vh] flex flex-col rounded-t-sm sm:rounded-sm shadow-xl font-sans`}
                onClick={e => e.stopPropagation()}
            >
                <div className={`px-5 pt-5 pb-4 border-b ${RULE}`}>
                    <p className={`tabular-nums text-[13px] tracking-wider ${NEUTRAL}`}>วัตถุดิบของตัวเลือก · {group.name}</p>
                    <h3 id="choice-ingredients-title" className={`text-lg font-bold leading-snug mt-1 ${INK}`}>{choice.name}</h3>
                    <p className={`text-[13px] leading-relaxed mt-2 ${MUTED}`}>
                        จำนวนต่อ 1 ที่ที่สั่ง เป็นหน่วยใช้ของวัตถุดิบ เลือก “ใช้เพิ่ม” สำหรับของที่ใส่เพิ่ม (เพิ่มช็อต, ไข่ดาว)
                        และ “ใช้น้อยลง” สำหรับของที่ตัวเลือกนี้เอาออกจากสูตรหลัก (เปลี่ยนนมวัวเป็นนมโอ๊ต)
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <p className={`text-[13px] tabular-nums py-6 text-center ${NEUTRAL}`}>กำลังโหลด…</p>
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
                                    const isLinkedMenu = row.linked_menu_item_id !== null && row.linked_menu_item_id !== undefined && row.linked_menu_item_id !== ''
                                    const linkedMenu = isLinkedMenu ? menusById.get(Number(row.linked_menu_item_id)) : null
                                    const item = !isLinkedMenu ? itemsById.get(row.stock_item_id) : null
                                    const unit = isLinkedMenu ? 'ที่' : displayUnit(item?.usage_unit || item?.unit || '')
                                    const titleName = isLinkedMenu
                                        ? (linkedMenu?.name || `เมนู #${row.linked_menu_item_id}`)
                                        : (item?.name || 'ไม่พบวัตถุดิบ')
                                    const err = errors[row.key]
                                    return (
                                        <li key={row.key} className={`border ${err ? 'border-[var(--error-red)]' : RULE} rounded-xs bg-[var(--color-paper)] p-3`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {isLinkedMenu && (
                                                            <span className="text-[11px] font-bold px-1.5 py-0.2 bg-[var(--brand-plum)] text-[var(--color-paper)]">
                                                                สูตรเมนูขาย
                                                            </span>
                                                        )}
                                                        <p className={`text-sm font-bold leading-snug ${INK}`}>{titleName}</p>
                                                    </div>
                                                    {isLinkedMenu ? (
                                                        <p className={`tabular-nums text-[13px] mt-0.5 ${NEUTRAL}`}>
                                                            ตัดวัตถุดิบตามสูตรของเมนูนี้ · หน่วยใช้ ที่ (เสิร์ฟ)
                                                        </p>
                                                    ) : item && (
                                                        <p className={`tabular-nums text-[13px] mt-0.5 ${NEUTRAL}`}>{ITEM_TYPE_LABELS[getItemType(item)] || ''} · หน่วยใช้ {unit || '-'}</p>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeRow(row.key)}
                                                    className={`shrink-0 tabular-nums text-xs px-2 py-1 ${NEUTRAL} hover:text-[var(--error-red)] rounded-xs cursor-pointer ${FOCUS}`}
                                                >
                                                    ลบ
                                                </button>
                                            </div>

                                            {isLinkedMenu && (
                                                <div className="mt-2 empty:hidden">
                                                    <FixedChoiceEditor
                                                        menuName={titleName}
                                                        groups={linked.groupsByMenu[String(row.linked_menu_item_id)] || []}
                                                        value={row.linked_choice_ids || []}
                                                        loading={linked.loading}
                                                        onChange={(next) => updateRow(row.key, { linked_choice_ids: next })}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                                <div className={`inline-flex border ${RULE} divide-x divide-[var(--color-rule)] rounded-xs overflow-hidden text-xs font-bold shrink-0`} role="group" aria-label="เพิ่มหรือลด">
                                                    {[
                                                        ['plus', 'ใช้เพิ่ม', 'bg-[var(--color-ink)] text-[var(--color-paper)]'],
                                                        ['minus', 'ใช้น้อยลง', 'bg-[var(--brand-plum)] text-[var(--color-paper)]']
                                                    ].map(([value, label, activeCls]) => (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            aria-pressed={row.sign === value}
                                                            onClick={() => updateRow(row.key, { sign: value })}
                                                            className={`h-11 px-3 cursor-pointer touch-manipulation transition-colors duration-150 ${FOCUS} ${
                                                                row.sign === value
                                                                    ? activeCls
                                                                    : `bg-[var(--color-paper)] ${MUTED} hover:bg-[var(--color-paper-2)]`
                                                            }`}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className={`flex flex-1 min-w-[164px] items-center border ${RULE} divide-x divide-[var(--color-rule)] rounded-xs bg-[var(--color-paper)] focus-within:border-[var(--brand-plum)]`}>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateRow(row.key, { amount: stepOptionAmount(row.amount, -1) })}
                                                        className={`w-11 h-11 shrink-0 flex items-center justify-center text-lg font-semibold leading-none ${INK} hover:bg-[var(--color-paper-2)] active:bg-[var(--color-paper-3)] cursor-pointer touch-manipulation ${FOCUS}`}
                                                        aria-label={`ลดจำนวน ${item?.name || ''} 1`}
                                                    >
                                                        −
                                                    </button>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        autoComplete="off"
                                                        value={row.amount}
                                                        onChange={e => {
                                                            const parsed = parseOptionAmountInput(e.target.value, row.sign)
                                                            updateRow(row.key, { sign: parsed.sign, amount: parsed.amount })
                                                        }}
                                                        placeholder="0"
                                                        aria-label={`จำนวน ${item?.name || ''} (${unit})`}
                                                        className={`flex-1 min-w-[52px] w-full h-11 bg-transparent px-2 text-center text-base font-medium tabular-nums outline-none ${INK}`}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => updateRow(row.key, { amount: stepOptionAmount(row.amount, 1) })}
                                                        className={`w-11 h-11 shrink-0 flex items-center justify-center text-lg font-semibold leading-none ${INK} hover:bg-[var(--color-paper-2)] active:bg-[var(--color-paper-3)] cursor-pointer touch-manipulation ${FOCUS}`}
                                                        aria-label={`เพิ่มจำนวน ${item?.name || ''} 1`}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <select
                                                    value={row.menu_item_id ?? ''}
                                                    onChange={e => updateRow(row.key, { menu_item_id: e.target.value === '' ? null : Number(e.target.value) })}
                                                    aria-label="ใช้กับเมนู"
                                                    className={`w-full sm:w-auto sm:min-w-[140px] h-11 border ${RULE} rounded-xs bg-[var(--color-paper)] px-2.5 text-sm ${INK} ${FOCUS}`}
                                                >
                                                    <option value="">ทุกเมนู</option>
                                                    {menus.map(m => <option key={m.id} value={m.id}>เฉพาะ {m.name}</option>)}
                                                </select>
                                            </div>
                                            {err && <p className="text-[13px] text-[var(--error-red)] mt-2">{err}</p>}
                                        </li>
                                    )
                                })}
                            </ul>

                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <label htmlFor="choice-ingredient-search" className={`block tabular-nums text-xs font-bold ${NEUTRAL}`}>
                                        {addMode === 'menu' ? 'ผูกตัดตามสูตรเมนูขาย (สำหรับเซตคู่เครื่องดื่ม/อาหาร)' : 'เพิ่มวัตถุดิบ / ของเตรียม'}
                                    </label>
                                    <div className={`inline-flex border ${RULE} divide-x divide-[var(--color-rule)] text-xs font-bold`} role="group" aria-label="ประเภทที่จะผูก">
                                        {[
                                            ['stock', 'วัตถุดิบ/ของเตรียม'],
                                            ['menu', 'สูตรเมนูขาย']
                                        ].map(([mode, label]) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                aria-pressed={addMode === mode}
                                                onClick={() => { setAddMode(mode); setSearch(''); searchRef.current?.focus() }}
                                                className={`h-8 px-2.5 cursor-pointer transition-colors ${
                                                    addMode === mode
                                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                                        : `bg-[var(--color-paper)] ${MUTED} hover:bg-[var(--color-paper-2)]`
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <input
                                    id="choice-ingredient-search"
                                    ref={searchRef}
                                    type="search"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={addMode === 'menu' ? 'พิมพ์ชื่อเมนูขาย เช่น ชาไทย, อเมริกาโน่, นมชมพู' : 'พิมพ์ชื่อวัตถุดิบ เช่น ช็อต, นมโอ๊ต, ยอดมะพร้าว'}
                                    className={`w-full min-h-[44px] border ${RULE} rounded-xs bg-[var(--color-paper)] px-3 py-2 text-base sm:text-sm ${INK} outline-none focus:border-[var(--brand-plum)]`}
                                />
                                {matches.length > 0 && (
                                    <ul className={`mt-1 border ${RULE} rounded-xs bg-[var(--color-paper)] divide-y divide-[var(--color-paper-3)]`}>
                                        {matches.map(i => (
                                            <li key={i.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => addMode === 'menu' ? addLinkedMenu(i) : addItem(i)}
                                                    className={`w-full min-h-[44px] text-left px-3 py-2.5 flex items-baseline justify-between gap-3 hover:bg-[var(--color-paper-2)] cursor-pointer ${FOCUS}`}
                                                >
                                                    <span className={`text-sm leading-snug ${INK}`}>{i.name}</span>
                                                    <span className={`tabular-nums text-xs shrink-0 ${NEUTRAL}`}>
                                                        {addMode === 'menu'
                                                            ? `เมนูขาย · ${i.category || '1 ที่'}`
                                                            : `${ITEM_TYPE_LABELS[getItemType(i)] || ''} · ${displayUnit(i.usage_unit || i.unit || '') || '-'}`}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {search.trim() && matches.length === 0 && (
                                    <p className={`text-[13px] mt-2 ${NEUTRAL}`}>
                                        {addMode === 'menu' ? 'ไม่พบเมนูชื่อนี้' : 'ไม่พบวัตถุดิบชื่อนี้'}
                                    </p>
                                )}
                            </div>

                            {menus.length > 0 && (
                                <p className={`text-[13px] leading-relaxed mt-4 ${NEUTRAL}`}>
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
                        className={`flex-1 px-3 py-2.5 border ${RULE} bg-[var(--color-paper-2)] ${INK} text-xs tabular-nums font-bold rounded-sm hover:bg-[var(--color-paper-3)] transition-colors duration-150 cursor-pointer disabled:opacity-50 ${FOCUS}`}
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || loading || missing}
                        className={`flex-1 px-3 py-2.5 bg-[var(--color-ink)] hover:bg-[var(--color-ink)] text-[var(--color-paper)] text-xs tabular-nums font-bold rounded-sm transition-colors duration-150 cursor-pointer disabled:opacity-50 ${FOCUS}`}
                    >
                        {saving ? 'กำลังบันทึก…' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
