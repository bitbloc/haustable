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
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1 text-center">{title}</h3>
            )}
            {subtitle && (
                <p className="text-xs text-[var(--color-muted)] mb-3 text-center">{subtitle}</p>
            )}

            {/* PIN Dot Indicators */}
            <div className={`flex justify-center gap-3.5 my-3.5 ${isError ? 'animate-bounce' : ''}`}>
                {[1, 2, 3, 4].map(idx => {
                    const isFilled = pin.length >= idx;
                    return (
                        <div
                            key={idx}
                            className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                                isFilled
                                    ? 'bg-[var(--color-accent)] border-[var(--color-accent)] scale-110 shadow-xs'
                                    : 'bg-[var(--color-paper-2)] border-[var(--color-rule)]'
                            }`}
                        />
                    );
                })}
            </div>

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-2 w-full touch-manipulation">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                        key={num}
                        type="button"
                        onClick={() => handleDigit(String(num))}
                        className="h-12 min-h-[48px] rounded-md bg-[var(--color-paper)] border border-[var(--color-rule)] hover:bg-[var(--color-paper-2)] active:scale-95 text-base font-mono font-bold text-[var(--color-ink)] shadow-xs flex items-center justify-center cursor-pointer transition-transform duration-75 select-none touch-manipulation"
                    >
                        {num}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={handleClear}
                    className="h-12 min-h-[48px] rounded-md bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:bg-red-50 active:scale-95 text-[11px] font-mono font-bold text-red-700 shadow-xs flex items-center justify-center cursor-pointer uppercase transition-transform duration-75 select-none touch-manipulation"
                >
                    ล้าง (C)
                </button>
                <button
                    type="button"
                    onClick={() => handleDigit('0')}
                    className="h-12 min-h-[48px] rounded-md bg-[var(--color-paper)] border border-[var(--color-rule)] hover:bg-[var(--color-paper-2)] active:scale-95 text-base font-mono font-bold text-[var(--color-ink)] shadow-xs flex items-center justify-center cursor-pointer transition-transform duration-75 select-none touch-manipulation"
                >
                    0
                </button>
                <button
                    type="button"
                    onClick={handleBackspace}
                    className="h-12 min-h-[48px] rounded-md bg-[var(--color-paper)] border border-[var(--color-rule)] hover:bg-[var(--color-paper-2)] active:scale-95 text-base font-mono font-bold text-[var(--color-ink)] shadow-xs flex items-center justify-center cursor-pointer transition-transform duration-75 select-none touch-manipulation"
                >
                    ←
                </button>
            </div>
        </div>
    );
}
