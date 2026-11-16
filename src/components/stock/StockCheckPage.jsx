/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · app style: achromatic ledger (same sheet as the Stock page) */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import StockItemForm from './StockItemForm';
import { stockHealth, readMergeResult, unitLine, sameUnitSetup, suggestMergeRatio, parseRatio, mergedQuantity } from '../../utils/stockHealth';
import { displayUnit, qtyInWords } from '../../utils/stockCount';
import { packCapacity } from '../../utils/stockUtils';
import '../../StockPage.css';

const SHOWN = 8;
const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
const qtyText = (item) => qtyInWords(item, item.current_quantity, packCapacity(item));
const unitOf = (item) => displayUnit(item.unit || item.pack_unit || 'unit');
// One ratio per item that will be removed, prefilled when the set-up already says it
const ratiosFor = (group, keepId) => {
    const keep = group.find(i => i.id === keepId);
    return Object.fromEntries(group.filter(i => i.id !== keepId && !sameUnitSetup(keep, i))
        .map(i => [i.id, String(suggestMergeRatio(keep, i) ?? '')]));
};

/**
 * Where stock items are set up wrongly: what bends menu cost first, then what makes counts
 * misleading, then names that look like the same item twice. Each row opens the item form;
 * a duplicate pair can be merged into one item.
 */
export default function StockCheckPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [recipeCounts, setRecipeCounts] = useState({});
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [expanded, setExpanded] = useState(() => new Set());
    const [editing, setEditing] = useState(null);
    const [merge, setMerge] = useState(null); // { group, keepId, ratios, saving, problem }

    const load = useCallback(async () => {
        try {
            const [itemsRes, recipesRes, catsRes] = await Promise.all([
                supabase.from('stock_items').select('*').order('name'),
                supabase.from('recipe_ingredients').select('ingredient_id'),
                supabase.from('stock_categories').select('*').order('sort_order'),
            ]);
            if (itemsRes.error) throw itemsRes.error;
            if (recipesRes.error) throw recipesRes.error;
            const counts = {};
            (recipesRes.data || []).forEach(r => { if (r.ingredient_id) counts[r.ingredient_id] = (counts[r.ingredient_id] || 0) + 1; });
            setItems(itemsRes.data || []);
            setRecipeCounts(counts);
            setCategories(catsRes.data || []);
            setFailed(false);
        } catch (err) {
            console.error('[StockCheckPage] load failed:', err);
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const health = useMemo(() => stockHealth(items, recipeCounts), [items, recipeCounts]);
    const groups = health.groups.filter(g => g.rows.length > 0);
    const nothingWrong = !loading && !failed && groups.length === 0 && health.duplicates.length === 0;

    const toggle = (key) => setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    const runMerge = async () => {
        if (!merge || merge.saving) return;
        setMerge(m => ({ ...m, saving: true, problem: null }));
        const keep = merge.group.find(i => i.id === merge.keepId);
        const others = merge.group.filter(i => i.id !== merge.keepId);
        for (const other of others) {
            const ratio = sameUnitSetup(keep, other) ? null : parseRatio(merge.ratios[other.id]);
            const result = readMergeResult(await supabase
                .rpc('merge_stock_items', { p_keep: merge.keepId, p_remove: other.id, p_ratio: ratio })
                .then(res => res, err => ({ data: null, error: err })));
            if (!result.ok) {
                setMerge(m => (m ? { ...m, saving: false, problem: result.message } : m));
                load();
                return;
            }
        }
        toast.success(`รวมเป็น "${keep?.name}" แล้ว`);
        setMerge(null);
        load();
    };

    const mergeKeep = merge ? merge.group.find(i => i.id === merge.keepId) : null;
    const mergeOthers = merge ? merge.group.filter(i => i.id !== merge.keepId) : [];
    const mergeNeeds = mergeOthers.filter(o => !sameUnitSetup(mergeKeep, o));
    const mergeReady = mergeNeeds.every(o => parseRatio(merge.ratios[o.id]) !== null);

    return (
        <div className="stock-page">
            <header className="sp-header">
                <div className="sp-wrap sp-header__top">
                    <button type="button" onClick={() => navigate('/staff/stock')} className="sp-btn sp-btn--quiet">กลับ</button>
                    <div className="sp-header__title">
                        <h1>ตรวจหน่วยและต้นทุน</h1>
                    </div>
                    <button type="button" onClick={() => { setLoading(true); load(); }} className="sp-btn sp-btn--outline">โหลดใหม่</button>
                </div>
            </header>

            <main className="sp-wrap sk-main">
                {loading && <p className="sk-lede">กำลังตรวจรายการวัตถุดิบ</p>}

                {failed && (
                    <div className="sk-notice" role="alert">
                        โหลดรายการไม่ได้ ตรวจสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง
                        <div><button type="button" className="sp-btn sp-btn--outline" onClick={() => { setLoading(true); load(); }}>ลองอีกครั้ง</button></div>
                    </div>
                )}

                {!loading && !failed && (
                    <p className={`sk-lede ${health.urgentCount > 0 ? 'is-urgent' : ''}`}>
                        {nothingWrong
                            ? `ตรวจ ${items.length} รายการ ไม่พบหน่วยหรือต้นทุนที่ต้องแก้`
                            : health.urgentCount > 0
                                ? `${health.urgentCount} จาก ${items.length} รายการ ทำให้ต้นทุนเมนูหรือจำนวนชิ้นผิด ควรแก้ก่อน แตะรายการเพื่อแก้`
                                : `ตรวจ ${items.length} รายการ ไม่มีอะไรที่ทำให้ต้นทุนเมนูผิด เหลือที่ควรตั้งให้ครบด้านล่าง`}
                    </p>
                )}

                {!loading && !failed && groups.map(group => {
                    const open = expanded.has(group.key);
                    const rows = open ? group.rows : group.rows.slice(0, SHOWN);
                    return (
                        <section key={group.key} className="sk-panel" aria-labelledby={`sk-${group.key}`}>
                            <div className="sk-panel__head">
                                <h2 id={`sk-${group.key}`}>{group.title}</h2>
                                <span className={`sk-count ${group.urgent ? 'is-urgent' : ''}`}>{group.rows.length}</span>
                            </div>
                            <p className="sk-why">{group.why}</p>
                            <ul className="sk-rows">
                                {rows.map(({ item, recipes, detail }) => (
                                    <li key={item.id}>
                                        <button type="button" className="sk-row" onClick={() => setEditing(item)}>
                                            <span className="sk-row__main">
                                                <span className="sk-row__name">{item.name}</span>
                                                <span className="sk-row__sub">
                                                    {detail} · ราคา {baht(item.cost_price)}{recipes > 0 ? ` · ใช้ใน ${recipes} สูตร` : ''}
                                                </span>
                                            </span>
                                            <span className="sk-row__go">แก้</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {group.rows.length > SHOWN && (
                                <button type="button" className="sk-more" onClick={() => toggle(group.key)}>
                                    {open ? 'ย่อ' : `ดูทั้งหมด ${group.rows.length} รายการ`}
                                </button>
                            )}
                        </section>
                    );
                })}

                {!loading && !failed && health.duplicates.length > 0 && (
                    <section className="sk-panel" aria-labelledby="sk-duplicates">
                        <div className="sk-panel__head">
                            <h2 id="sk-duplicates">ชื่อที่น่าจะเป็นของเดียวกัน</h2>
                            <span className="sk-count">{health.duplicates.length}</span>
                        </div>
                        <p className="sk-why">ของเดียวกันที่แยกเป็นสองรายการ ทำให้ยอดคงเหลือและสูตรกระจาย กด "รวม" เพื่อเลือกรายการที่จะเก็บ ถ้าสองรายการตั้งหน่วยต่างกัน จะถามตัวแปลงก่อนรวม ถ้าเป็นคนละของ ไม่ต้องทำอะไร</p>
                        <ul className="sk-rows">
                            {health.duplicates.map(group => {
                                const sameUnits = group.every(i => sameUnitSetup(i, group[0]));
                                return (
                                    <li key={group.map(i => i.id).join('-')} className="sk-dup">
                                        <span className="sk-row__main">
                                            {group.map(item => (
                                                <button key={item.id} type="button" className="sk-dup__item" onClick={() => setEditing(item)} aria-label={`แก้ ${item.name}`}>
                                                    <span className="sk-row__name">{item.name}</span>
                                                    <span className="sk-row__sub">
                                                        คงเหลือ {qtyText(item)} · {unitLine(item)}
                                                        {recipeCounts[item.id] > 0 ? ` · ใช้ใน ${recipeCounts[item.id]} สูตร` : ''}
                                                    </span>
                                                </button>
                                            ))}
                                            {!sameUnits && <span className="sk-dup__note">หน่วยไม่ตรงกัน ตอนรวมจะถามว่าหนึ่งหน่วยของรายการที่ลบเท่ากับเท่าไรของรายการที่เก็บ</span>}
                                        </span>
                                        <button type="button" className="sp-btn sp-btn--outline"
                                            onClick={() => setMerge({ group, keepId: group[0].id, ratios: ratiosFor(group, group[0].id), saving: false, problem: null })}>
                                            รวม
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}
            </main>

            {editing && (
                <StockItemForm
                    item={editing}
                    categories={categories}
                    onClose={() => setEditing(null)}
                    onUpdate={() => load()}
                />
            )}

            {merge && (
                <div className="sk-sheet" role="dialog" aria-modal="true" aria-labelledby="sk-merge-title">
                    <button type="button" className="sk-sheet__veil" aria-label="ปิด" onClick={() => !merge.saving && setMerge(null)} />
                    <div className="sk-sheet__body">
                        <div className="sk-sheet__head">
                            <h2 id="sk-merge-title">รวมเป็นรายการเดียว</h2>
                            <button type="button" className="sp-btn sp-btn--quiet" disabled={merge.saving} onClick={() => setMerge(null)}>ปิด</button>
                        </div>
                        <fieldset className="sk-choices">
                            <legend>เก็บรายการไหนไว้</legend>
                            {merge.group.map(item => (
                                <label key={item.id} className={`sk-choice ${merge.keepId === item.id ? 'is-on' : ''}`}>
                                    <input type="radio" name="sk-keep" checked={merge.keepId === item.id} onChange={() => setMerge(m => ({ ...m, keepId: item.id, ratios: ratiosFor(m.group, item.id), problem: null }))} />
                                    <span className="sk-row__main">
                                        <span className="sk-row__name">{item.name}</span>
                                        <span className="sk-row__sub">คงเหลือ {qtyText(item)} · {unitLine(item)} · ราคา {baht(item.cost_price)}{recipeCounts[item.id] > 0 ? ` · ใช้ใน ${recipeCounts[item.id]} สูตร` : ''}</span>
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                        {mergeNeeds.map(other => (
                            <label key={other.id} className="sk-ratio">
                                <span className="sk-ratio__q">1 {unitOf(other)} ของ “{other.name}” เท่ากับกี่{unitOf(mergeKeep)}</span>
                                <span className="sk-ratio__row">
                                    <input type="text" inputMode="decimal" autoComplete="off" value={merge.ratios[other.id] ?? ''}
                                        aria-invalid={parseRatio(merge.ratios[other.id]) === null}
                                        onChange={e => setMerge(m => ({ ...m, ratios: { ...m.ratios, [other.id]: e.target.value }, problem: null }))} />
                                    <span>{unitOf(mergeKeep)}</span>
                                </span>
                                <span className="sk-row__sub">
                                    {suggestMergeRatio(mergeKeep, other) !== null
                                        ? `คิดจากที่ตั้งไว้: ${unitLine(other)} และ ${unitLine(mergeKeep)} แก้ได้ถ้าไม่ตรงของจริง`
                                        : 'หน่วยของสองรายการเทียบกันเองไม่ได้ ดูจากของจริงแล้วใส่ตัวเลข'}
                                </span>
                            </label>
                        ))}
                        <p className="sk-total">
                            ยอดหลังรวม <strong>{mergeReady ? qtyInWords(mergeKeep, mergedQuantity(mergeKeep, mergeOthers, Object.fromEntries(Object.entries(merge.ratios).map(([id, v]) => [id, parseRatio(v) ?? 0]))), packCapacity(mergeKeep)) : 'ใส่ตัวแปลงก่อน'}</strong>
                        </p>
                        <p className="sk-why">
                            รายการที่ไม่ได้เลือกจะถูกลบ ยอดคงเหลือ ประวัติ การนับ และบาร์โค้ดของมันจะถูกแปลงเป็นหน่วยของรายการที่เก็บไว้ สูตรที่ใช้มันจะย้ายมาด้วย ย้อนกลับไม่ได้
                        </p>
                        {merge.problem && <p className="sk-notice" role="alert">{merge.problem}</p>}
                        <button type="button" className="sk-primary" disabled={merge.saving || !mergeReady} onClick={runMerge}>
                            {merge.saving ? 'กำลังรวม' : 'รวมรายการ'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
