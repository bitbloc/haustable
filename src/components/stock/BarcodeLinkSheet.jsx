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
        <div className="fixed inset-0 z-[60] bg-[oklch(21.78%_0_0/0.45)] flex items-end sm:items-center justify-center sm:p-4" onClick={() => !saving && onSkip()}>
            <div role="dialog" aria-modal="true" aria-labelledby="barcode-link-title"
                className="w-full sm:max-w-md max-h-[88dvh] flex flex-col bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] font-sans"
                onClick={e => e.stopPropagation()}>
                <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[var(--color-rule)]">
                    <h2 id="barcode-link-title" className="font-bold text-base leading-7">บาร์โค้ดนี้ยังไม่ได้ผูกกับวัตถุดิบ</h2>
                    <p className="font-mono text-[14px] leading-5 text-[var(--color-muted)] break-all">{code}</p>
                    <p className="text-[12px] leading-5 text-[var(--color-neutral)] mt-1">เลือกวัตถุดิบที่ตรงกัน ครั้งหน้าสแกนแล้วจะเจอทันที</p>
                </div>

                <div className="shrink-0 p-3 border-b border-[var(--color-rule)] space-y-2">
                    <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อวัตถุดิบ..."
                        aria-label="ค้นหาชื่อวัตถุดิบ"
                        className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[14px] outline-none focus:border-[var(--color-ink)]" />
                </div>

                <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--color-paper-3)] bg-[var(--color-paper)]" role="listbox" aria-label="วัตถุดิบ">
                    {matches.map(i => (
                        <li key={i.id}>
                            <button type="button" role="option" aria-selected={picked?.id === i.id} onClick={() => setPicked(i)}
                                className={`w-full text-left px-4 py-2.5 grid grid-cols-[1fr_auto] gap-3 items-baseline cursor-pointer ${picked?.id === i.id ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'hover:bg-[var(--color-paper-2)]'}`}>
                                <span className="font-bold text-[14px] leading-6 break-words min-w-0">{i.name}</span>
                                <span className={`text-[12px] ${picked?.id === i.id ? 'text-[var(--color-rule)]' : 'text-[var(--color-neutral)]'}`}>
                                    {i.barcode ? 'มีบาร์โค้ดแล้ว' : displayUnit(i.unit)}
                                </span>
                            </button>
                        </li>
                    ))}
                    {matches.length === 0 && <li className="px-4 py-4 text-[14px] text-[var(--color-neutral)]">ไม่พบรายการ</li>}
                </ul>

                <div className="shrink-0 p-3 border-t border-[var(--color-rule)] space-y-2.5">
                    <label className="flex items-center gap-2 text-[14px] leading-5 text-[var(--color-muted)]">
                        สแกน 1 ครั้ง =
                        <input type="text" inputMode="decimal" value={perScan} onChange={e => setPerScan(e.target.value)}
                            aria-invalid={!perValid}
                            className={`w-16 p-1.5 border bg-[var(--color-paper)] tabular-nums font-bold text-base text-right outline-none focus:border-[var(--color-ink)] ${perValid ? 'border-[var(--color-rule)]' : 'border-[var(--brand-plum)]'}`} />
                        <span>{picked ? displayUnit(picked.unit) : 'หน่วย'}</span>
                        <span className="text-[12px] text-[var(--color-neutral)]">(ลังละ 24 ใส่ 24)</span>
                    </label>
                    <div className="grid grid-cols-2 border border-[var(--color-rule)] divide-x divide-[var(--color-rule)]">
                        <button type="button" onClick={onSkip} disabled={saving}
                            className="py-3 font-bold text-[14px] bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] cursor-pointer disabled:opacity-40">
                            ข้าม
                        </button>
                        <button type="button" onClick={() => picked && perValid && onLink(picked, per)} disabled={!picked || !perValid || saving}
                            className="py-3 font-bold text-[14px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink)] cursor-pointer disabled:opacity-40">
                            {saving ? 'กำลังบันทึก...' : 'ผูกแล้วนับ'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
