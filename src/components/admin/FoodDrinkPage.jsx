/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Thai Modern OKLCH */
import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import MenuCostPage from './MenuCostPage';
import RecipeLabPage from './RecipeLabPage';
import SOPEditorPage from './SOPEditorPage';

const VIEWS = [
    { id: 'menus', label: 'เมนู', hint: 'สูตรของแต่ละจาน / แก้ว ต้นทุน และ GP' },
    { id: 'bases', label: 'เบส / ของเตรียม', hint: 'ซอส เบสชา นมมิกซ์ ทำเป็น portion แล้วเก็บสต๊อก' },
    { id: 'methods', label: 'วิธีทำทั้งหมด', hint: 'คลัง SOP หมวด ขนาดแก้ว และพิมพ์' }
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
            <div className="border border-[oklch(85%_0.012_28)] bg-white">
                <div className="px-4 py-3 border-b border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)]">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">FOOD &amp; DRINK</span>
                    <h2 className="font-bold text-xl leading-8">สูตรและวิธีทำ</h2>
                    <p className="text-[12px] leading-5 text-[oklch(42%_0.010_28)] max-w-prose">
                        สูตรของเมนูคือรายการเดียวที่ใช้คิดต้นทุนและตัดสต๊อก เบสใช้เป็นส่วนผสมในสูตรเมนูได้ ส่วนวิธีทำ (SOP) ผูกกับเมนูหรือเบสและดึงส่วนผสมจากสูตรนั้น
                    </p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-[oklch(85%_0.012_28)]" role="tablist" aria-label="ส่วนของ Food & Drink">
                    {VIEWS.map(v => (
                        <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
                            className={`px-3 py-2.5 text-left cursor-pointer transition-colors ${view === v.id ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'bg-white text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'}`}>
                            <span className="block font-bold text-[14px] leading-6">{v.label}</span>
                            <span className={`hidden sm:block text-[11px] leading-4 ${view === v.id ? 'text-[oklch(85%_0.012_28)]' : 'text-[oklch(55%_0.010_28)]'}`}>{v.hint}</span>
                        </button>
                    ))}
                </div>
            </div>

            <p className="sm:hidden text-[12px] leading-5 text-[oklch(42%_0.010_28)]">{current?.hint}</p>

            {view === 'menus' && <MenuCostPage isEmbedded onOpenMethod={openMethod} />}
            {view === 'bases' && <RecipeLabPage isEmbedded onOpenMethod={openMethod} />}
            {view === 'methods' && <SOPEditorPage isEmbedded />}

            {methodFor && createPortal(
                <div className="fixed inset-0 z-[60] bg-[oklch(97%_0.008_28)] overflow-y-auto" role="dialog" aria-modal="true" aria-label={`วิธีทำ ${methodFor.name}`}>
                    <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto] items-center border-b border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
                        <div className="px-4 py-2.5 min-w-0">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">
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
