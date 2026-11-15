/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · theme: Dieter Rams + Thai Modern OKLCH */
import React, { useEffect, useState, memo } from 'react';
import { getPosTextScale, nextPosTextScale, setPosTextScale } from '../utils/posTextScale';

/**
 * Header cell that cycles the POS text size (100 → 115 → 130 → 145%) for this device.
 * One tap per step, no popover: staff can fix the size mid-service without hunting for settings.
 */
export const POSTextSizeControl = memo(function POSTextSizeControl() {
    const [scale, setScale] = useState(() => getPosTextScale());

    useEffect(() => {
        const handle = (e) => setScale(e?.detail?.scale ?? getPosTextScale());
        window.addEventListener('pos-text-scale-changed', handle);
        return () => window.removeEventListener('pos-text-scale-changed', handle);
    }, []);

    return (
        <button
            type="button"
            onClick={() => setPosTextScale(nextPosTextScale(scale))}
            title="ขนาดตัวอักษร (แตะเพื่อเปลี่ยน)"
            aria-label={`ขนาดตัวอักษร ${Math.round(scale * 100)}% แตะเพื่อเปลี่ยน`}
            className="min-h-[44px] min-w-[72px] flex items-center justify-center gap-1.5 px-3 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-[var(--color-ink)] rounded-md font-mono cursor-pointer transition-colors touch-manipulation"
        >
            <span className="font-sans font-bold text-sm leading-none">Aa</span>
            <span className="text-xs font-bold tabular-nums">{Math.round(scale * 100)}%</span>
        </button>
    );
});

export default POSTextSizeControl;
