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
    // Lotus's has no search data on its public page (results load from its app API), so it is a link out,
    // not a second list: staff compare there and type the price in.
    const lotusLink = `https://www.lotuss.com/th/search/${encodeURIComponent(term.trim())}`;

    return createPortal(
        <div className="fixed inset-0 z-[80] bg-[oklch(21.78%_0_0/0.45)] flex justify-end" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="makro-price-title" onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-lg h-full flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-rule)] text-[var(--color-ink)] font-sans">
                <header className="shrink-0 grid grid-cols-[1fr_auto] border-b border-[var(--color-rule)] divide-x divide-[var(--color-rule)]">
                    <div className="px-4 py-3 min-w-0">
                        <h2 id="makro-price-title" className="font-bold text-xl leading-7">ราคากลาง</h2>
                        <p className="text-[12px] leading-5 text-[var(--color-muted)]">ราคาหน้าเว็บ makro ตอนนี้ ใช้อ้างอิง ราคาซื้อจริงอาจต่างจากนี้</p>
                    </div>
                    <button type="button" onClick={onClose} className="px-4 font-bold text-[14px] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] cursor-pointer">
                        ปิด
                    </button>
                </header>

                <form onSubmit={e => { e.preventDefault(); search(term); }}
                    className="shrink-0 grid grid-cols-[1fr_auto] border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
                    <label className="min-w-0">
                        <span className="sr-only">ชื่อสินค้า</span>
                        <input value={term} onChange={e => setTerm(e.target.value)} autoFocus placeholder="เช่น นมข้นหวาน 2 กก."
                            className="w-full px-4 py-3 text-[14px] leading-6 bg-transparent outline-none" />
                    </label>
                    <button type="submit" disabled={state.status === 'loading' || !term.trim()}
                        className="px-5 bg-[var(--color-ink)] text-[var(--color-paper)] font-bold text-[14px] leading-6 hover:bg-[var(--color-ink)] disabled:opacity-50 cursor-pointer">
                        ค้นหา
                    </button>
                </form>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {state.status === 'idle' && (
                        <p className="p-6 text-[14px] leading-6 text-[var(--color-muted)]">พิมพ์ชื่อสินค้าพร้อมขนาด จะได้ผลตรงกว่า เช่น “มะนาวแป้น 10 ลูก”</p>
                    )}
                    {state.status === 'loading' && (
                        <p className="p-6 text-[14px] text-[var(--color-neutral)]">กำลังค้นใน makro.pro...</p>
                    )}
                    {state.status === 'error' && (
                        <div className="p-6 space-y-2">
                            <p className="text-[14px] leading-6 text-[var(--error-red)]">ค้นไม่สำเร็จ: {state.error}</p>
                            <a href={makroLink} target="_blank" rel="noopener noreferrer" className="inline-block text-[14px] font-bold underline underline-offset-4">เปิดหน้าค้นหาใน makro.pro</a>
                        </div>
                    )}
                    {state.status === 'done' && state.results.length === 0 && (
                        <div className="p-6 space-y-2">
                            <p className="text-[14px] leading-6 text-[var(--color-muted)]">ไม่พบ “{state.searched}” ใน makro.pro ลองคำที่สั้นลง</p>
                            <a href={makroLink} target="_blank" rel="noopener noreferrer" className="inline-block text-[14px] font-bold underline underline-offset-4">เปิดหน้าค้นหาใน makro.pro</a>
                        </div>
                    )}
                    {state.status === 'done' && state.results.length > 0 && (
                        <ul className="divide-y divide-[var(--color-paper-3)] bg-[var(--color-paper)] border-b border-[var(--color-rule)]">
                            {state.results.map(r => (
                                <li key={r.id || r.title} className="grid grid-cols-[3.5rem_1fr_auto] gap-3 px-4 py-3 items-center">
                                    <span className="w-14 h-14 border border-[var(--color-paper-3)] bg-[var(--color-paper)] overflow-hidden flex items-center justify-center">
                                        {r.image
                                            ? <img src={r.image} alt="" loading="lazy" className="w-full h-full object-contain" />
                                            : <span className="text-[12px] text-[var(--color-neutral)]">ไม่มีรูป</span>}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block font-bold text-[14px] leading-6 break-words">{r.title}</span>
                                        <span className="block text-[12px] leading-5 text-[var(--color-neutral)] break-words">
                                            {[r.brand, r.unitSize && r.unitSize !== '1 ชิ้น' ? `ขาย ${r.unitSize}` : null, r.inStock ? null : 'ของหมด'].filter(Boolean).join(' · ')}
                                        </span>
                                        <span className="block text-[14px] leading-6 tabular-nums">
                                            <span className="font-bold">{baht(r.price)}</span>
                                            {r.originalPrice && <span className="ml-2 text-[12px] text-[var(--color-neutral)] line-through">{baht(r.originalPrice)}</span>}
                                        </span>
                                    </span>
                                    <button type="button" onClick={() => onPick(r)}
                                        className="self-stretch px-3 border border-[var(--color-ink)] font-bold text-[14px] leading-5 hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)] cursor-pointer whitespace-nowrap">
                                        ใช้ราคานี้
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {term.trim() && (
                    <footer className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-t border-[var(--color-rule)] bg-[var(--color-paper)] text-[14px] leading-6">
                        <span className="text-[var(--color-muted)]">เทียบราคา “{term.trim()}” ที่</span>
                        <a href={lotusLink} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">Lotus's</a>
                        <a href={makroLink} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">makro.pro</a>
                    </footer>
                )}
            </div>
        </div>,
        document.body
    );
}
