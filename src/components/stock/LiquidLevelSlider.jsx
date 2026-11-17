import React, { useState, useEffect, useRef } from 'react';

export default function LiquidLevelSlider({ value = 0, onChange, unit = '%' }) {
    const [dragging, setDragging] = useState(false);
    const containerRef = useRef(null);

    const handleInteraction = (clientY) => {
         if (!containerRef.current) return;
         const rect = containerRef.current.getBoundingClientRect();
         const height = rect.height;
         const relativeY = clientY - rect.top;
         
         // 0 at bottom, 100 at top
         let percentage = 100 - ((relativeY / height) * 100);
         
         // Clamp
         percentage = Math.max(0, Math.min(100, percentage));
         
         // Snap to nearest 10 for easier usage? Or 5?
         // Let's do nearest 5
         percentage = Math.round(percentage / 5) * 5;
         
         onChange(percentage);
    };

    const handleMouseDown = (e) => {
        setDragging(true);
        handleInteraction(e.clientY);
    };

    const handleMouseMove = (e) => {
        if (dragging) {
            handleInteraction(e.clientY);
        }
    };

    const handleTouchStart = (e) => {
         setDragging(true);
         handleInteraction(e.touches[0].clientY);
    };

    const handleTouchMove = (e) => {
        if (dragging) {
            e.preventDefault(); // Prevent scroll while dragging
            handleInteraction(e.touches[0].clientY);
        }
    };

    useEffect(() => {
        const up = () => setDragging(false);
        window.addEventListener('mouseup', up);
        window.addEventListener('touchend', up);
        return () => {
            window.removeEventListener('mouseup', up);
            window.removeEventListener('touchend', up);
        };
    }, []);

    // Ink fill; the clay accent only when the container is nearly empty
    const fill = value <= 20 ? 'oklch(25.18% 0.1001 348.33)' : 'oklch(21.78% 0 0)';

    const onKeyDown = (e) => {
        const step = e.shiftKey ? 25 : 5;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(100, Math.round(value) + step)); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(0, Math.round(value) - step)); }
    };

    return (
        <div className="flex flex-col items-center gap-1.5">
            <div
                ref={containerRef}
                role="slider"
                tabIndex={0}
                aria-label="ปริมาณที่เหลือในของที่เปิดอยู่"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(value)}
                aria-valuetext={`${Math.round(value)}${unit}`}
                onKeyDown={onKeyDown}
                className="relative w-20 h-44 rounded-lg overflow-hidden border border-[var(--color-rule)] bg-[var(--color-paper-2)] cursor-ns-resize touch-none outline-none focus-visible:border-[var(--color-ink)]"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
            >
                {/* Quarter marks */}
                <div className="absolute inset-0 flex flex-col justify-between py-0 pointer-events-none z-10">
                    {[100, 75, 50, 25, 0].map(tick => (
                        <div key={tick} className={`w-3 h-px ${tick % 100 ? 'bg-[oklch(70%_0.012_348.33)]' : 'bg-transparent'}`} />
                    ))}
                </div>

                {/* Level */}
                <div
                    className="absolute bottom-0 left-0 right-0 flex items-start justify-center pt-1.5 text-sm font-semibold tabular-nums text-[var(--color-paper)]"
                    style={{
                        height: `${Math.round(value)}%`,
                        backgroundColor: fill,
                        transition: dragging ? 'none' : 'height 180ms cubic-bezier(0.16, 1, 0.3, 1), background-color 180ms'
                    }}
                >
                    {value > 15 && <span>{Math.round(value)}{unit}</span>}
                </div>

                {value <= 15 && (
                    <div className="absolute bottom-1.5 left-0 right-0 text-center text-sm font-semibold tabular-nums text-[var(--color-muted)] pointer-events-none">
                        {Math.round(value)}{unit}
                    </div>
                )}
            </div>
            <p className="text-xs text-[var(--color-neutral)]">ลากขึ้นลง</p>
        </div>
    );
}
