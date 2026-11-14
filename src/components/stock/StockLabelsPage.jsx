/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Label sheet · theme: Thai Modern OKLCH */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { shopLabelFor } from '../../utils/stockBarcode';
import { displayUnit } from '../../utils/stockCount';

/**
 * QR labels for stock that has no factory barcode (meat, vegetables, house-made
 * sauces). Stick one on the shelf or container; the count page scanner reads it.
 * Printed on A4 from the browser (plain paper or sticker sheet), not a thermal printer.
 */
export default function StockLabelsPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [onlyNoBarcode, setOnlyNoBarcode] = useState(true);
    const [picked, setPicked] = useState(() => new Set());

    useEffect(() => {
        supabase.from('stock_items').select('*').order('name')
            .then(({ data, error }) => {
                if (error) throw error;
                setItems((data || []).filter(i => (i.item_type ?? 'raw') === 'raw' || (i.item_type === 'prep' && (i.prep_mode ?? 'stocked') === 'stocked')));
            })
            .catch(err => { console.error(err); toast.error('โหลดรายการสต๊อกไม่สำเร็จ'); })
            .finally(() => setLoading(false));
    }, []);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items
            .filter(i => !onlyNoBarcode || !i.barcode)
            .filter(i => !q || i.name.toLowerCase().includes(q));
    }, [items, search, onlyNoBarcode]);

    const toPrint = items.filter(i => picked.has(i.id));
    const toggle = (id) => setPicked(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const allVisiblePicked = visible.length > 0 && visible.every(i => picked.has(i.id));
    const toggleAllVisible = () => setPicked(prev => {
        const next = new Set(prev);
        visible.forEach(i => (allVisiblePicked ? next.delete(i.id) : next.add(i.id)));
        return next;
    });

    return (
        <div className="min-h-screen bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-sans">
            <style>{`
                @media print {
                    @page { size: A4; margin: 8mm; }
                    body { background: #fff !important; }
                    .labels-screen { display: none !important; }
                    .labels-sheet { display: grid !important; }
                }
            `}</style>

            <div className="labels-screen pb-24">
                <header className="sticky top-0 z-20 bg-[oklch(97%_0.008_28)] border-b border-[oklch(85%_0.012_28)]">
                    <div className="max-w-3xl mx-auto grid grid-cols-[auto_1fr] divide-x divide-[oklch(85%_0.012_28)] border-x border-[oklch(85%_0.012_28)]">
                        <button type="button" onClick={() => navigate('/staff/stock/count')}
                            className="px-4 font-bold text-[13px] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">
                            กลับ
                        </button>
                        <div className="px-4 py-2.5">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">STOCK LABELS</span>
                            <h1 className="font-bold text-lg leading-7">ป้าย QR สำหรับนับสต๊อก</h1>
                            <p className="text-[12px] leading-5 text-[oklch(42%_0.010_28)]">
                                ของที่ไม่มีบาร์โค้ด พิมพ์ป้ายติดชั้นหรือกล่อง แล้วสแกนในหน้านับสต๊อกได้เหมือนบาร์โค้ด
                            </p>
                        </div>
                    </div>
                </header>

                <main className="max-w-3xl mx-auto border-x border-[oklch(85%_0.012_28)] bg-white min-h-[60vh]">
                    <div className="p-3 border-b border-[oklch(85%_0.012_28)] space-y-2.5 bg-[oklch(98%_0.004_28)]">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <label className="flex items-center gap-2 text-[13px] leading-5 text-[oklch(42%_0.010_28)] cursor-pointer select-none">
                                <input type="checkbox" checked={onlyNoBarcode} onChange={e => setOnlyNoBarcode(e.target.checked)}
                                    className="w-4 h-4 accent-[oklch(18%_0.012_28)]" />
                                เฉพาะของที่ยังไม่มีบาร์โค้ด
                            </label>
                            <button type="button" onClick={toggleAllVisible} disabled={!visible.length}
                                className="text-[13px] font-bold underline underline-offset-2 cursor-pointer disabled:opacity-40">
                                {allVisiblePicked ? 'ไม่เลือกที่แสดงอยู่' : `เลือกที่แสดงอยู่ (${visible.length})`}
                            </button>
                        </div>
                        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อ..."
                            aria-label="ค้นหาชื่อวัตถุดิบ"
                            className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-[14px] outline-none focus:border-black" />
                    </div>

                    {loading ? (
                        <p className="p-6 text-[14px] text-[oklch(55%_0.010_28)]">กำลังโหลด...</p>
                    ) : (
                        <ul className="divide-y divide-[oklch(90%_0.008_28)]">
                            {visible.map(i => (
                                <li key={i.id}>
                                    <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[oklch(98%_0.004_28)]">
                                        <input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)}
                                            className="w-5 h-5 shrink-0 accent-[oklch(18%_0.012_28)]" />
                                        <span className="font-bold text-[15px] leading-6 min-w-0 break-words flex-1">{i.name}</span>
                                        <span className="text-[12px] text-[oklch(55%_0.010_28)] shrink-0">{displayUnit(i.unit)}</span>
                                    </label>
                                </li>
                            ))}
                            {visible.length === 0 && <li className="p-6 text-[14px] text-[oklch(55%_0.010_28)]">ไม่พบรายการ</li>}
                        </ul>
                    )}
                </main>

                <footer className="fixed bottom-0 inset-x-0 z-20 bg-[oklch(97%_0.008_28)] border-t border-[oklch(85%_0.012_28)]">
                    <div className="max-w-3xl mx-auto grid grid-cols-[1fr_auto] items-center border-x border-[oklch(85%_0.012_28)]">
                        <span className="px-4 text-[13px] leading-5 text-[oklch(42%_0.010_28)]">
                            เลือก <span className="font-mono font-bold text-[oklch(18%_0.012_28)]">{toPrint.length}</span> ป้าย
                            <span className="block text-[11px] text-[oklch(55%_0.010_28)]">A4 หน้าละ 24 ป้าย (3 × 8)</span>
                        </span>
                        <button type="button" onClick={() => window.print()} disabled={!toPrint.length}
                            className="px-6 py-4 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold text-[15px] hover:bg-black disabled:opacity-40 cursor-pointer">
                            พิมพ์ป้าย / บันทึก PDF
                        </button>
                    </div>
                </footer>
            </div>

            {/* Print sheet: 3 x 8 labels per A4 page */}
            <div className="labels-sheet hidden grid-cols-3 gap-[2mm] bg-white text-black" aria-hidden="true">
                {toPrint.map(i => (
                    <div key={i.id} className="h-[33mm] border border-[#bbb] p-[2mm] grid grid-cols-[auto_1fr] gap-[2mm] items-center break-inside-avoid">
                        <QRCodeSVG value={shopLabelFor(i.id)} size={96} level="M" style={{ width: '26mm', height: '26mm' }} />
                        <div className="min-w-0">
                            <div className="font-bold text-[11pt] leading-[1.35] break-words">{i.name}</div>
                            <div className="text-[8pt] leading-[1.4] mt-[1mm]">นับเป็น {displayUnit(i.unit)}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
