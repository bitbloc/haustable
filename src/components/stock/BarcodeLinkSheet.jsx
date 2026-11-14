/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Count sheet · theme: Thai Modern OKLCH */
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { displayUnit } from '../../utils/stockCount';

/**
 * A scanned code that no stock item has yet: pick the item it belongs to.
 * onLink(item, perScan) saves it; onSkip() ignores this code for now.
 */
export default function BarcodeLinkSheet({ code, items, saving, onLink, onSkip }) {
    const [search, setSearch] = useState('');
    const [perScan, setPerScan] = useState('1');
    const [picked, setPicked] = useState(null);

    const matches = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
        return list.slice(0, 30);
    }, [items, search]);

    const per = Number(perScan);
    const perValid = Number.isFinite(per) && per > 0;

    return createPortal(
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={() => !saving && onSkip()}>
            <div role="dialog" aria-modal="true" aria-labelledby="barcode-link-title"
                className="w-full sm:max-w-md max-h-[88dvh] flex flex-col bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-sans"
                onClick={e => e.stopPropagation()}>
                <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[oklch(85%_0.012_28)]">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">NEW BARCODE</span>
                    <h2 id="barcode-link-title" className="font-bold text-base leading-7">บาร์โค้ดนี้ยังไม่ได้ผูกกับวัตถุดิบ</h2>
                    <p className="font-mono text-[13px] leading-5 text-[oklch(42%_0.010_28)] break-all">{code}</p>
                    <p className="text-[12px] leading-5 text-[oklch(55%_0.010_28)] mt-1">เลือกวัตถุดิบที่ตรงกัน ครั้งหน้าสแกนแล้วจะเจอทันที</p>
                </div>

                <div className="shrink-0 p-3 border-b border-[oklch(85%_0.012_28)] space-y-2">
                    <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อวัตถุดิบ..."
                        aria-label="ค้นหาชื่อวัตถุดิบ"
                        className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-[14px] outline-none focus:border-black" />
                </div>

                <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-[oklch(90%_0.008_28)] bg-white" role="listbox" aria-label="วัตถุดิบ">
                    {matches.map(i => (
                        <li key={i.id}>
                            <button type="button" role="option" aria-selected={picked?.id === i.id} onClick={() => setPicked(i)}
                                className={`w-full text-left px-4 py-2.5 grid grid-cols-[1fr_auto] gap-3 items-baseline cursor-pointer ${picked?.id === i.id ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'hover:bg-[oklch(94%_0.010_28)]'}`}>
                                <span className="font-bold text-[14px] leading-6 break-words min-w-0">{i.name}</span>
                                <span className={`text-[12px] ${picked?.id === i.id ? 'text-[oklch(85%_0.012_28)]' : 'text-[oklch(55%_0.010_28)]'}`}>
                                    {i.barcode ? 'มีบาร์โค้ดแล้ว' : displayUnit(i.unit)}
                                </span>
                            </button>
                        </li>
                    ))}
                    {matches.length === 0 && <li className="px-4 py-4 text-[14px] text-[oklch(55%_0.010_28)]">ไม่พบรายการ</li>}
                </ul>

                <div className="shrink-0 p-3 border-t border-[oklch(85%_0.012_28)] space-y-2.5">
                    <label className="flex items-center gap-2 text-[13px] leading-5 text-[oklch(42%_0.010_28)]">
                        สแกน 1 ครั้ง =
                        <input type="text" inputMode="decimal" value={perScan} onChange={e => setPerScan(e.target.value)}
                            aria-invalid={!perValid}
                            className={`w-16 p-1.5 border bg-white font-mono font-bold text-[15px] text-right outline-none focus:border-black ${perValid ? 'border-[oklch(85%_0.012_28)]' : 'border-[oklch(52%_0.16_28)]'}`} />
                        <span>{picked ? displayUnit(picked.unit) : 'หน่วย'}</span>
                        <span className="text-[12px] text-[oklch(55%_0.010_28)]">(ลังละ 24 ใส่ 24)</span>
                    </label>
                    <div className="grid grid-cols-2 border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]">
                        <button type="button" onClick={onSkip} disabled={saving}
                            className="py-3 font-bold text-[14px] bg-white hover:bg-[oklch(94%_0.010_28)] cursor-pointer disabled:opacity-40">
                            ข้าม
                        </button>
                        <button type="button" onClick={() => picked && perValid && onLink(picked, per)} disabled={!picked || !perValid || saving}
                            className="py-3 font-bold text-[14px] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-black cursor-pointer disabled:opacity-40">
                            {saving ? 'กำลังบันทึก...' : 'ผูกแล้วนับ'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
