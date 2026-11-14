/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Ledger drawer · theme: Thai Modern OKLCH */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';

const baht = (n) => `฿${Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

/**
 * Reference price from makro.pro (through the search-api edge function).
 * Picking a product hands { price, title, unitSize } back; the form decides what to fill.
 */
export default function MakroPriceSheet({ initialTerm = '', onPick, onClose }) {
    const [term, setTerm] = useState(initialTerm);
    const [state, setState] = useState({ status: 'idle', results: [], error: null, searched: '' });

    const search = async (q) => {
        const keyword = String(q || '').trim();
        if (!keyword) return;
        setState({ status: 'loading', results: [], error: null, searched: keyword });
        try {
            const { data, error } = await supabase.functions.invoke('search-api', { body: { keyword } });
            if (error) {
                let msg = error.message;
                try { msg = (await error.context?.json?.())?.error || msg; } catch { /* keep message */ }
                throw new Error(msg);
            }
            if (data?.error) throw new Error(data.error);
            setState({ status: 'done', results: data?.results || [], error: null, searched: keyword });
        } catch (err) {
            setState({ status: 'error', results: [], error: err.message, searched: keyword });
        }
    };

    useEffect(() => {
        if (initialTerm.trim()) search(initialTerm);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const makroLink = `https://www.makro.pro/c/search?q=${encodeURIComponent(term.trim())}`;

    return createPortal(
        <div className="fixed inset-0 z-[80] bg-black/50 flex justify-end" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="makro-price-title" onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-lg h-full flex flex-col bg-[oklch(97%_0.008_28)] border-l border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-sans">
                <header className="shrink-0 grid grid-cols-[1fr_auto] border-b border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]">
                    <div className="px-4 py-3 min-w-0">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">REFERENCE PRICE · MAKRO.PRO</span>
                        <h2 id="makro-price-title" className="font-bold text-lg leading-7">ราคากลาง</h2>
                        <p className="text-[12px] leading-5 text-[oklch(42%_0.010_28)]">ราคาหน้าเว็บ makro ตอนนี้ ใช้อ้างอิง ราคาซื้อจริงอาจต่างจากนี้</p>
                    </div>
                    <button type="button" onClick={onClose} className="px-4 font-bold text-[13px] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">
                        ปิด
                    </button>
                </header>

                <form onSubmit={e => { e.preventDefault(); search(term); }}
                    className="shrink-0 grid grid-cols-[1fr_auto] border-b border-[oklch(85%_0.012_28)] bg-white">
                    <label className="min-w-0">
                        <span className="sr-only">ชื่อสินค้า</span>
                        <input value={term} onChange={e => setTerm(e.target.value)} autoFocus placeholder="เช่น นมข้นหวาน 2 กก."
                            className="w-full px-4 py-3 text-[14px] leading-6 bg-transparent outline-none" />
                    </label>
                    <button type="submit" disabled={state.status === 'loading' || !term.trim()}
                        className="px-5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold text-[14px] leading-6 hover:bg-black disabled:opacity-50 cursor-pointer">
                        ค้นหา
                    </button>
                </form>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {state.status === 'idle' && (
                        <p className="p-6 text-[14px] leading-6 text-[oklch(42%_0.010_28)]">พิมพ์ชื่อสินค้าพร้อมขนาด จะได้ผลตรงกว่า เช่น “มะนาวแป้น 10 ลูก”</p>
                    )}
                    {state.status === 'loading' && (
                        <p className="p-6 text-[14px] text-[oklch(55%_0.010_28)]">กำลังค้นใน makro.pro...</p>
                    )}
                    {state.status === 'error' && (
                        <div className="p-6 space-y-2">
                            <p className="text-[14px] leading-6 text-[oklch(52%_0.16_28)]">ค้นไม่สำเร็จ: {state.error}</p>
                            <a href={makroLink} target="_blank" rel="noopener noreferrer" className="inline-block text-[13px] font-bold underline underline-offset-4">เปิดหน้าค้นหาใน makro.pro</a>
                        </div>
                    )}
                    {state.status === 'done' && state.results.length === 0 && (
                        <div className="p-6 space-y-2">
                            <p className="text-[14px] leading-6 text-[oklch(42%_0.010_28)]">ไม่พบ “{state.searched}” ใน makro.pro ลองคำที่สั้นลง</p>
                            <a href={makroLink} target="_blank" rel="noopener noreferrer" className="inline-block text-[13px] font-bold underline underline-offset-4">เปิดหน้าค้นหาใน makro.pro</a>
                        </div>
                    )}
                    {state.status === 'done' && state.results.length > 0 && (
                        <ul className="divide-y divide-[oklch(90%_0.008_28)] bg-white border-b border-[oklch(85%_0.012_28)]">
                            {state.results.map(r => (
                                <li key={r.id || r.title} className="grid grid-cols-[3.5rem_1fr_auto] gap-3 px-4 py-3 items-center">
                                    <span className="w-14 h-14 border border-[oklch(90%_0.008_28)] bg-[oklch(97%_0.008_28)] overflow-hidden flex items-center justify-center">
                                        {r.image
                                            ? <img src={r.image} alt="" loading="lazy" className="w-full h-full object-contain" />
                                            : <span className="text-[10px] text-[oklch(55%_0.010_28)]">ไม่มีรูป</span>}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block font-bold text-[14px] leading-6 break-words">{r.title}</span>
                                        <span className="block text-[12px] leading-5 text-[oklch(55%_0.010_28)] break-words">
                                            {[r.brand, r.unitSize && r.unitSize !== '1 ชิ้น' ? `ขาย ${r.unitSize}` : null, r.inStock ? null : 'ของหมด'].filter(Boolean).join(' · ')}
                                        </span>
                                        <span className="block font-mono text-[14px] leading-6 tabular-nums">
                                            <span className="font-bold">{baht(r.price)}</span>
                                            {r.originalPrice && <span className="ml-2 text-[12px] text-[oklch(55%_0.010_28)] line-through">{baht(r.originalPrice)}</span>}
                                        </span>
                                    </span>
                                    <button type="button" onClick={() => onPick(r)}
                                        className="self-stretch px-3 border border-[oklch(18%_0.012_28)] font-bold text-[13px] leading-5 hover:bg-[oklch(18%_0.012_28)] hover:text-[oklch(97%_0.008_28)] cursor-pointer whitespace-nowrap">
                                        ใช้ราคานี้
                                    </button>
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
