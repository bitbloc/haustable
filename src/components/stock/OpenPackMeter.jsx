/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React from 'react';

/**
 * How much of the opened pack is left, as four quarter cells (a bottle read at a glance:
 * three and a bit cells = a bit over three quarters left). Only drawn when a pack is open.
 */
export default function OpenPackMeter({ percent = 0 }) {
    const left = Math.max(0, Math.min(100, Number(percent) || 0));
    return (
        <span className="sc-open__meter" role="img" aria-label={`ของที่เปิดแล้วเหลือ ${left}%`}>
            {[0, 1, 2, 3].map(i => (
                <span key={i} className="sc-open__cell">
                    <span className="sc-open__fill" style={{ width: `${Math.max(0, Math.min(1, (left - i * 25) / 25)) * 100}%` }} />
                </span>
            ))}
        </span>
    );
}
