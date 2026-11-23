/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React from 'react';

/**
 * How much of the opened pack is left, as one tube that drains (a bottle's level read at a glance).
 * Only drawn when a pack is open.
 */
export default function OpenPackMeter({ percent = 0 }) {
    const left = Math.max(0, Math.min(100, Number(percent) || 0));
    return (
        <span className="sc-open__meter" role="img" aria-label={`ของที่เปิดแล้วเหลือ ${left}%`}>
            <span className="sc-open__fill" style={{ transform: `scaleX(${left / 100})` }} />
        </span>
    );
}
