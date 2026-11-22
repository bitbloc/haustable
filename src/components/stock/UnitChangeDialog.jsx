/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Decision dialog · theme: brand v2 */
import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const num = (n) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 4 });

/**
 * The item's setup now says one counted unit holds a different amount. Ask what the stock
 * left should read: the same count (the old setup was wrong) or the converted count
 * (the way of counting changed). Each answer shows what it means in real contents.
 */
function UnitChangeDialog({ info, onDone }) {
    const keepRef = useRef(null);
    useEffect(() => {
        keepRef.current?.focus();
        const onKey = (e) => { if (e.key === 'Escape') onDone(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onDone]);

    const { oldUnit, newUnit, usageUnit, keep, convert, qty, levels } = info;
    const hasStock = Math.abs(Number(qty) || 0) > 1e-9;
    const levelCount = Object.keys(levels || {}).length;

    const option = 'w-full text-left px-4 py-3 min-h-[56px] cursor-pointer';
    const sub = 'block text-[14px] leading-6';

    return (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => onDone(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="unit-change-title" onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-md bg-[var(--cream)] text-[var(--charcoal)] font-sans border border-[var(--color-rule)] max-h-[100dvh] overflow-y-auto">
                <header className="px-4 py-3 border-b border-[var(--color-rule)]">
                    <span className="font-mono text-[12px] leading-5 uppercase tracking-wider text-[var(--brand-plum)] block">Unit setup changed</span>
                    <h2 id="unit-change-title" className="font-bold text-[18px] leading-7">ยอดคงเหลือควรเป็นเท่าไหร่</h2>
                    <p className="text-[14px] leading-6 text-[var(--color-muted,#524A4E)]">
                        {hasStock
                            ? <>ในระบบตอนนี้ <span className="font-mono font-bold text-[var(--charcoal)]">{num(qty)}</span> {oldUnit} การตั้งค่าใหม่ทำให้ 1 {newUnit} มีของไม่เท่าเดิม</>
                            : <>ยอดคงเหลือเป็น 0 แต่ระดับแจ้งเตือน {levelCount} ค่าผูกกับหน่วยนับ ต้องเลือกว่าจะแปลงหรือไม่</>}
                    </p>
                </header>

                <div className="divide-y divide-[var(--color-rule)]">
                    <button ref={keepRef} type="button" onClick={() => onDone('keep')}
                        className={`${option} bg-[var(--action-primary)] text-[var(--on-action)] hover:bg-[var(--action-primary-hover)]`}>
                        <span className="block font-bold text-[16px] leading-6">
                            {hasStock ? <>ยังเป็น <span className="font-mono">{num(keep.quantity)}</span> {newUnit}</> : 'ไม่แปลง ใช้ระดับแจ้งเตือนเดิม'}
                        </span>
                        <span className={`${sub} opacity-80`}>
                            แค่แก้การตั้งค่าที่เคยใส่ผิด ของที่นับไว้ยังถูก
                            {hasStock && <> · เท่ากับ <span className="font-mono">{num(keep.usage)}</span> {usageUnit}</>}
                        </span>
                    </button>
                    <button type="button" onClick={() => onDone('convert')}
                        className={`${option} bg-[var(--cream)] hover:bg-[var(--color-paper-2)]`}>
                        <span className="block font-bold text-[16px] leading-6">
                            {hasStock ? <>แปลงเป็น <span className="font-mono">{num(convert.quantity)}</span> {newUnit}</> : 'แปลงระดับแจ้งเตือนตามหน่วยใหม่'}
                        </span>
                        <span className={`${sub} text-[var(--color-muted,#524A4E)]`}>
                            เปลี่ยนวิธีนับ เช่น จากนับขวดเป็นนับลัง ปริมาณของเท่าเดิม
                            {hasStock && <> · เท่ากับ <span className="font-mono">{num(convert.usage)}</span> {usageUnit}</>}
                        </span>
                    </button>
                    <button type="button" onClick={() => onDone(null)}
                        className={`${option} text-center font-bold text-[16px] leading-6 text-[var(--color-muted,#524A4E)] hover:bg-[var(--color-paper-2)]`}>
                        ยกเลิก ยังไม่บันทึก
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Ask the person; resolves 'keep', 'convert' or null (cancelled).
 * info: the result of rescaleForCountUnitChange with changed === true.
 */
export function askUnitChange(info) {
    return new Promise((resolve) => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        const done = (choice) => {
            root.unmount();
            host.remove();
            resolve(choice);
        };
        root.render(<UnitChangeDialog info={info} onDone={done} />);
    });
}

export default UnitChangeDialog;
