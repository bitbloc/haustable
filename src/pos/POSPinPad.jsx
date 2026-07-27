import React, { useState, useEffect, useCallback } from 'react';

/**
 * Isolated, high-performance PIN Keypad Component
 * Features:
 * - Localized state prevents top-level parent (POSDashboard) re-renders on digit presses.
 * - Hardware Keyboard Listener (Numpad, Digits 0-9, Backspace, Escape/C).
 * - 60ms microtask completion delay ensuring 4th indicator dot illuminates smoothly before parent async logic starts.
 * - Optimized touch-action manipulation for zero-delay tap response on touch POS terminals.
 */
export default function POSPinPad({ onComplete, title, subtitle }) {
    const [pin, setPin] = useState('');
    const [isError, setIsError] = useState(false);

    const handleDigit = useCallback((digit) => {
        setIsError(false);
        setPin(prev => {
            if (prev.length >= 4) return prev;
            const newPin = prev + digit;
            
            if (newPin.length === 4) {
                // Microtask delay so 4th dot animates to filled state visually before running parent async logic
                setTimeout(() => {
                    onComplete(newPin, () => {
                        // Reset callback in case parent pin check fails
                        setIsError(true);
                        setPin('');
                    });
                }, 60);
            }
            return newPin;
        });
    }, [onComplete]);

    const handleClear = useCallback(() => {
        setPin('');
        setIsError(false);
    }, []);

    const handleBackspace = useCallback(() => {
        setPin(prev => prev.slice(0, -1));
        setIsError(false);
    }, []);

    // Hardware Keyboard Listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore key events if target is an editable input or textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                handleDigit(e.key);
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                handleBackspace();
            } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
                e.preventDefault();
                handleClear();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleDigit, handleBackspace, handleClear]);

    return (
        <div className="flex flex-col items-center w-full max-w-[280px] mx-auto select-none">
            {title && (
                <h3 className="text-sm font-bold text-[#1A1A1A] mb-0.5 text-center">{title}</h3>
            )}
            {subtitle && (
                <p className="text-xs text-[#767673] mb-3 text-center">{subtitle}</p>
            )}

            {/* PIN Dot Indicators */}
            <div className={`flex justify-center gap-3.5 my-3.5 ${isError ? 'animate-bounce' : ''}`}>
                {[1, 2, 3, 4].map(idx => {
                    const isFilled = pin.length >= idx;
                    return (
                        <div
                            key={idx}
                            className={`w-4 h-4 rounded-full border transition-all duration-150 ${
                                isFilled
                                    ? 'bg-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)] scale-110 shadow-sm'
                                    : 'bg-white border-[#D1D1CD]'
                            }`}
                        />
                    );
                })}
            </div>

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-2.5 w-full touch-manipulation">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                        key={num}
                        type="button"
                        onClick={() => handleDigit(String(num))}
                        className="h-12 rounded-xl bg-white border border-[#D1D1CD] hover:bg-[#F4F4F0] active:scale-95 text-base font-mono font-bold text-[#1A1A1A] shadow-sm flex items-center justify-center cursor-pointer transition-transform duration-75 select-none touch-manipulation"
                    >
                        {num}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={handleClear}
                    className="h-12 rounded-xl bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] hover:bg-[#FAD2D2] active:scale-95 text-[11px] font-bold text-[#D32F2F] shadow-sm flex items-center justify-center cursor-pointer uppercase transition-transform duration-75 select-none touch-manipulation"
                >
                    ล้าง (C)
                </button>
                <button
                    type="button"
                    onClick={() => handleDigit('0')}
                    className="h-12 rounded-xl bg-white border border-[#D1D1CD] hover:bg-[#F4F4F0] active:scale-95 text-base font-mono font-bold text-[#1A1A1A] shadow-sm flex items-center justify-center cursor-pointer transition-transform duration-75 select-none touch-manipulation"
                >
                    0
                </button>
                <button
                    type="button"
                    onClick={handleBackspace}
                    className="h-12 rounded-xl bg-white border border-[#D1D1CD] hover:bg-[#F4F4F0] active:scale-95 text-base font-mono font-bold text-[#1A1A1A] shadow-sm flex items-center justify-center cursor-pointer transition-transform duration-75 select-none touch-manipulation"
                >
                    ←
                </button>
            </div>
        </div>
    );
}
