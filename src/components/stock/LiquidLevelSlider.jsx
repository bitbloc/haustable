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

    // Determine color based on level
    // High = Green/Blue, Low = Orange/Red
    const getColor = (pct) => {
        if (pct <= 20) return 'rgba(239, 68, 68, 0.8)'; // Red
        if (pct <= 40) return 'rgba(249, 115, 22, 0.8)'; // Orange
        return 'rgba(59, 130, 246, 0.8)'; // Blue
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <div 
                ref={containerRef}
                className="relative w-24 h-64 bg-gray-100 rounded-3xl overflow-hidden border-4 border-gray-200 shadow-inner cursor-pointer touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
            >
                {/* Background Tick Marks */}
                <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none opacity-30 z-10 px-6">
                    {[100, 75, 50, 25, 0].map(tick => (
                        <div key={tick} className="w-full h-px bg-gray-400"></div>
                    ))}
                </div>

                {/* Liquid Fill */}
                <div 
                    className="absolute bottom-0 left-0 right-0 transition-all duration-200 ease-out flex items-center justify-center font-bold text-white text-xl shadow-lg"
                    style={{ 
                        height: `${Math.round(value)}%`, 
                        backgroundColor: getColor(value),
                        boxShadow: `0 0 20px ${getColor(value)}`
                    }}
                >
                    {/* Only show text if meaningful height */}
                    {value > 15 && <span className="drop-shadow-md">{Math.round(value)}{unit}</span>}
                </div>
                
                {/* Label if empty-ish */}
                {value <= 15 && (
                     <div className="absolute bottom-2 left-0 right-0 text-center text-xs font-bold text-gray-500 pointer-events-none">
                         {Math.round(value)}{unit}
                     </div>
                )}
            </div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Slide to adjust</p>
        </div>
    );
}
