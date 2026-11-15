/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Thai Modern OKLCH */
import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import MenuCostPage from './MenuCostPage';
import RecipeLabPage from './RecipeLabPage';
import SOPEditorPage from './SOPEditorPage';
import { AdminFilterChips, AdminTabPanel } from './AdminKit';

const VIEWS = [
    { id: 'menus', label: 'เมนู', hint: 'สูตรของแต่ละจานและแก้ว ใช้คิดต้นทุน GP และตัดสต๊อก' },
    { id: 'bases', label: 'เบส / ของเตรียม', hint: 'ซอส เบสชา นมมิกซ์ ทำเป็น portion แล้วใช้เป็นส่วนผสมในสูตรเมนู' },
    { id: 'methods', label: 'วิธีทำ (SOP)', hint: 'ขั้นตอน แก้ว การตกแต่ง ผูกกับเมนูหรือเบส และพิมพ์คู่มือ' }
];

/**
 * One place for what is sold and how it is made.
 *   เมนู            recipe of each menu item: the only list used for cost and stock
 *   เบส / ของเตรียม  bases made in batches and kept as stock (folders saved in the database)
 *   วิธีทำทั้งหมด     the SOP library (steps, glass, garnish), each SOP linked to a menu or a base
 * "วิธีทำ" on a menu or base opens its SOP directly.
 */
export default function FoodDrinkPage({ initialView = 'menus' }) {
    const [view, setView] = useState(VIEWS.some(v => v.id === initialView) ? initialView : 'menus');
    const [methodFor, setMethodFor] = useState(null); // { type, id, name }
    const openMethod = useCallback((target) => setMethodFor(target), []);
    const current = VIEWS.find(v => v.id === view);

    return (
        <div className="font-sans text-[oklch(18%_0.012_28)] space-y-4">
            {/* One switch for the three parts of a recipe, with what the current part is for */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <AdminFilterChips
                    label="ส่วนของ Food & Drink"
                    layoutId="food-drink-view"
                    options={VIEWS.map(v => ({ key: v.id, label: v.label }))}
                    value={view}
                    onChange={setView}
                />
                <p className="text-[13px] leading-5 text-[oklch(42%_0.010_28)] min-w-0">{current?.hint}</p>
            </div>

            <AdminTabPanel id={view}>
            {view === 'menus' && <MenuCostPage isEmbedded onOpenMethod={openMethod} />}
            {view === 'bases' && <RecipeLabPage isEmbedded onOpenMethod={openMethod} />}
            {view === 'methods' && <SOPEditorPage isEmbedded />}
            </AdminTabPanel>

            {methodFor && createPortal(
                <div className="fixed inset-0 z-[60] bg-[oklch(97%_0.008_28)] overflow-y-auto" role="dialog" aria-modal="true" aria-label={`วิธีทำ ${methodFor.name}`}>
                    <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto] items-center border-b border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
                        <div className="px-4 py-2.5 min-w-0">
                            <span className="text-xs text-[oklch(42%_0.010_28)] block">
                                วิธีทำ · {methodFor.type === 'menu' ? 'เมนู' : 'เบส'}
                            </span>
                            <span className="font-bold text-[15px] leading-6 break-words">{methodFor.name}</span>
                        </div>
                        <button type="button" onClick={() => setMethodFor(null)}
                            className="self-stretch px-5 border-l border-[oklch(85%_0.012_28)] font-bold text-[13px] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">
                            ปิด
                        </button>
                    </div>
                    <div className="max-w-7xl mx-auto p-4">
                        <SOPEditorPage isEmbedded focus={methodFor} onClose={() => setMethodFor(null)} />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
