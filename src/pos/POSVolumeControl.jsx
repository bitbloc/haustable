/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · theme: Dieter Rams + Thai Modern OKLCH */
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Volume2, Volume1, VolumeX, Play, Check, SlidersHorizontal } from 'lucide-react';
import { 
    getAudioVolume, 
    setAudioVolume, 
    isAudioMuted, 
    setAudioMuted, 
    toggleAudioMute, 
    testPlayAlertSound,
    unlockAudioEngine 
} from '../utils/audioHelper';

const PRESETS = [
    { label: 'ปิดเสียง', sub: 'MUTE', value: 0 },
    { label: 'เบา', sub: '30%', value: 30 },
    { label: 'ปานกลาง', sub: '60%', value: 60 },
    { label: 'ดังสุด', sub: '100%', value: 100 }
];

export const POSVolumeControl = memo(function POSVolumeControl({ className = '', compact = false }) {
    const [volume, setVolumeState] = useState(() => getAudioVolume());
    const [isMuted, setIsMutedState] = useState(() => isAudioMuted());
    const [isOpen, setIsOpen] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const popoverRef = useRef(null);

    // Sync state with global audio helper & other tabs/modals
    useEffect(() => {
        const handleVolumeChange = (e) => {
            if (e.detail) {
                if (typeof e.detail.volume === 'number') setVolumeState(e.detail.volume);
                if (typeof e.detail.isMuted === 'boolean') setIsMutedState(e.detail.isMuted);
            } else {
                setVolumeState(getAudioVolume());
                setIsMutedState(isAudioMuted());
            }
        };

        window.addEventListener('pos-audio-volume-changed', handleVolumeChange);
        return () => {
            window.removeEventListener('pos-audio-volume-changed', handleVolumeChange);
        };
    }, []);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('pointerdown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleVolumeSlider = useCallback((e) => {
        const val = parseInt(e.target.value, 10);
        setVolumeState(val);
        setAudioVolume(val);
    }, []);

    const handlePresetSelect = useCallback((val) => {
        unlockAudioEngine();
        setVolumeState(val);
        setAudioVolume(val);
        if (val > 0) {
            // Auto test feedback on preset click (throttled 1200ms)
            testPlayAlertSound(val, 1200);
        }
    }, []);

    const handleToggleMute = useCallback(() => {
        unlockAudioEngine();
        toggleAudioMute();
    }, []);

    const handleTestSound = useCallback(() => {
        if (isTesting) return;
        unlockAudioEngine();
        setIsTesting(true);
        testPlayAlertSound(null, 1200);
        setTimeout(() => setIsTesting(false), 1200);
    }, [isTesting]);

    const effectiveVol = isMuted ? 0 : volume;

    return (
        <div className={`relative inline-block select-none ${className}`} ref={popoverRef}>
            {/* Header Trigger Button */}
            <button
                type="button"
                onClick={() => {
                    unlockAudioEngine();
                    setIsOpen(prev => !prev);
                }}
                className={`min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs touch-manipulation ${
                    isOpen
                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                        : isMuted || effectiveVol === 0
                        ? 'bg-amber-50/80 border-amber-300 text-amber-900 hover:bg-amber-100'
                        : 'bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border-[var(--color-rule)] text-[var(--color-ink)]'
                }`}
                title="ปรับระดับเสียงแจ้งเตือน POS"
                aria-label="Volume settings"
            >
                {isMuted || effectiveVol === 0 ? (
                    <VolumeX size={14} className={isOpen ? 'text-amber-300' : 'text-amber-700'} />
                ) : effectiveVol < 50 ? (
                    <Volume1 size={14} className={isOpen ? 'text-[var(--color-paper)]' : 'text-[var(--color-accent)]'} />
                ) : (
                    <Volume2 size={14} className={isOpen ? 'text-[var(--color-paper)]' : 'text-[var(--color-accent)]'} />
                )}

                <span className="tabular-nums font-bold">
                    {isMuted || effectiveVol === 0 ? 'MUTE' : `${effectiveVol}%`}
                </span>
            </button>

            {/* Popover Settings Panel */}
            {isOpen && (
                <div 
                    className="absolute right-0 top-full mt-2 w-80 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg shadow-xl p-4 z-50 animate-in fade-in-0 zoom-in-95 duration-150 font-sans"
                    style={{ minWidth: '290px' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2.5 mb-3.5">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal size={14} className="text-[var(--color-accent)]" />
                            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                POS AUDIO VOLUME
                            </span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--color-neutral)] uppercase tracking-wider">
                            {isMuted ? 'ปิดเสียง' : `${volume}%`}
                        </span>
                    </div>

                    {/* Live Volume Readout Card */}
                    <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-md p-3 mb-3.5 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-mono text-[var(--color-neutral)] uppercase">สถานะปัจจุบัน</span>
                            <span className="text-sm font-bold text-[var(--color-ink)]">
                                {isMuted || effectiveVol === 0 ? (
                                    <span className="text-amber-800 font-mono">🔇 ปิดเสียงเตือน (Muted)</span>
                                ) : effectiveVol >= 80 ? (
                                    <span className="text-[var(--color-accent)] font-mono">🔊 ดังชัดเจน (High Output)</span>
                                ) : (
                                    <span className="text-[var(--color-ink)] font-mono">🔉 ระดับปานกลาง</span>
                                )}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={handleToggleMute}
                            className={`min-h-[34px] px-2.5 py-1 text-[11px] font-mono font-bold uppercase rounded-md border transition-colors cursor-pointer touch-manipulation ${
                                isMuted 
                                    ? 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700' 
                                    : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)] hover:border-[var(--color-ink)]'
                            }`}
                        >
                            {isMuted ? 'เปิดเสียง' : 'Mute'}
                        </button>
                    </div>

                    {/* Range Slider */}
                    <div className="mb-4">
                        <div className="flex justify-between items-center text-xs font-mono text-[var(--color-neutral)] mb-1.5">
                            <span>ระดับความดัง</span>
                            <span className="font-bold text-[var(--color-ink)] text-sm">{volume}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={volume}
                            onChange={handleVolumeSlider}
                            className="w-full h-2.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)] focus:outline-none"
                            style={{
                                accentColor: 'oklch(52% 0.16 28)'
                            }}
                        />
                        <div className="flex justify-between text-[9px] font-mono text-[var(--color-muted)] mt-1">
                            <span>0% (Mute)</span>
                            <span>50%</span>
                            <span>100% (Max)</span>
                        </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="grid grid-cols-4 gap-1.5 mb-4">
                        {PRESETS.map((p) => {
                            const isSelected = (!isMuted && volume === p.value) || (p.value === 0 && (isMuted || volume === 0));
                            return (
                                <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => handlePresetSelect(p.value)}
                                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border text-center transition-all cursor-pointer touch-manipulation active:scale-95 ${
                                        isSelected
                                            ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)] font-bold shadow-xs'
                                            : 'bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)]'
                                    }`}
                                >
                                    <span className="text-[11px] font-bold leading-tight">{p.label}</span>
                                    <span className={`text-[9px] font-mono ${isSelected ? 'text-[var(--color-paper)] opacity-80' : 'text-[var(--color-neutral)]'}`}>
                                        {p.sub}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Test Sound Button */}
                    <button
                        type="button"
                        onClick={handleTestSound}
                        disabled={isTesting}
                        className={`w-full min-h-[40px] flex items-center justify-center gap-2 rounded-md font-mono text-xs font-bold uppercase transition-all shadow-xs ${
                            isTesting
                                ? 'bg-[var(--color-accent)] text-white opacity-90 cursor-not-allowed'
                                : 'bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)] hover:border-[var(--color-ink)] cursor-pointer touch-manipulation active:scale-95'
                        }`}
                    >
                        <Play size={13} className={isTesting ? 'animate-spin' : 'text-[var(--color-accent)]'} />
                        <span>{isTesting ? 'กำลังทดสอบเสียง...' : 'ทดสอบเสียงแจ้งเตือน (TEST)'}</span>
                    </button>
                </div>
            )}
        </div>
    );
});

export default POSVolumeControl;
