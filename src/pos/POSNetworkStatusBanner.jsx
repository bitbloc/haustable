/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React from 'react';
import usePOSNetworkStatus from '../hooks/usePOSNetworkStatus';

/**
 * POS Network Status Banner
 * 
 * Complies with:
 * - Rule 1 (Dieter Rams Minimalist Structure & Type: 4px/8px scale, upright typography)
 * - Rule 2 (Thai Modern OKLCH Color Tokens: zero pure white/black, anchor hue 28 / 140)
 * - Rule 5 (Zero-Icon Priority: pure typography & monospace tags)
 * - Rule 6 (Neo-Brutalist Structural Grid: tabular cellular layout)
 */
export default function POSNetworkStatusBanner() {
    const { isOnline, queueCount, dlqCount, isChecking, wasRecentlyRestored, checkConnectivityNow } = usePOSNetworkStatus();

    // If online, not recently restored, and no DLQ items, no banner needed
    if (isOnline && !wasRecentlyRestored && (!dlqCount || dlqCount === 0)) {
        return null;
    }

    const openOfflineDrawer = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('pos-trigger-offline-drawer'));
        }
    };

    // DLQ Attention State while Online (High-visibility warning banner)
    if (isOnline && !wasRecentlyRestored && dlqCount > 0) {
        return (
            <div className="w-full bg-[var(--color-paper-2)] border-b-2 border-[var(--color-accent)] text-[var(--color-ink)] px-4 py-2 flex flex-wrap items-center justify-between gap-3 font-mono text-xs select-none shrink-0 animate-in slide-in-from-top-1 duration-150">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="bg-[var(--color-accent)] text-[var(--color-paper)] text-[9px] font-black uppercase px-2 py-1 rounded-xs tracking-wider shrink-0">
                        DLQ ATTENTION
                    </span>
                    <span className="text-[11px] font-bold truncate text-[var(--color-ink)]">
                        พบรายการ Sync ไม่สำเร็จและถูกย้ายเข้า DLQ จำนวน {dlqCount} รายการ (ข้อมูลปลอดภัยในเครื่อง ไม่สูญหาย)
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={openOfflineDrawer}
                        className="min-h-[36px] px-3 bg-[var(--color-accent)] text-[var(--color-paper)] text-[10px] font-bold uppercase rounded-xs transition-opacity hover:opacity-90 cursor-pointer flex items-center gap-1.5 touch-manipulation active:scale-95"
                    >
                        <span>เปิดคิวตรวจสอบ DLQ ({dlqCount})</span>
                    </button>
                </div>
            </div>
        );
    }

    // Recently Restored State (Temporary confirmation banner using Thai Modern Banana-Leaf Accent 2)
    if (isOnline && wasRecentlyRestored) {
        return (
            <div className="w-full bg-[var(--color-paper-2)] border-b border-[var(--color-accent-2)] text-[var(--color-ink)] px-4 py-2 flex flex-wrap items-center justify-between gap-3 font-mono text-xs select-none shrink-0 transition-all duration-200">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="bg-[var(--color-accent-2)] text-[var(--color-paper)] text-[9px] font-black uppercase px-2 py-1 rounded-xs tracking-wider shrink-0">
                        ONLINE RESTORED
                    </span>
                    <span className="font-bold text-[11px] text-[var(--color-ink)] truncate">
                        เชื่อมต่ออินเทอร์เน็ตสำเร็จแล้ว — ระบบกำลังส่งข้อมูลที่ค้างขึ้นคลาวด์อัตโนมัติ
                    </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {dlqCount > 0 && (
                        <button
                            type="button"
                            onClick={openOfflineDrawer}
                            className="min-h-[36px] px-3 bg-[var(--color-paper)] border border-[var(--color-accent)] text-[var(--color-accent)] text-[10px] font-bold uppercase rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation"
                        >
                            <span>DLQ ตรวจสอบ ({dlqCount})</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={openOfflineDrawer}
                        className="min-h-[36px] px-3 bg-[var(--color-paper)] border border-[var(--color-rule)] hover:border-[var(--color-accent-2)] text-[var(--color-accent-2)] text-[10px] font-bold uppercase rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation"
                    >
                        <span>ดูคิวส่งข้อมูล ({queueCount})</span>
                    </button>
                </div>
            </div>
        );
    }

    // OFFLINE State Banner (Persistent Neo-Brutalist Banner)
    return (
        <div className="w-full bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-[var(--color-ink)] px-4 py-2 flex flex-wrap items-center justify-between gap-3 font-mono text-xs select-none shrink-0 animate-in slide-in-from-top-1 duration-150">
            {/* Left: Indicator & Status Explanation */}
            <div className="flex items-center gap-2.5 min-w-0">
                <span className="bg-[var(--color-accent)] text-[var(--color-paper)] text-[9px] font-black uppercase px-2 py-1 rounded-xs tracking-wider shrink-0">
                    OFFLINE MODE
                </span>
                <span className="text-[11px] font-bold truncate text-[var(--color-ink)]">
                    ไม่มีการเชื่อมต่ออินเทอร์เน็ต — ระบบกำลังทำงานในโหมดออฟไลน์ (เปิดบิล สั่งอาหาร และพิมพ์สลิปได้ตามปกติ)
                </span>
            </div>

            {/* Right: Tabular Actions & Metrics */}
            <div className="flex items-center gap-2 shrink-0">
                {dlqCount > 0 && (
                    <button
                        type="button"
                        onClick={openOfflineDrawer}
                        className="min-h-[36px] px-3 bg-[var(--color-paper)] border border-[var(--color-accent)] text-[var(--color-accent)] text-[10px] font-bold uppercase rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation active:scale-95"
                    >
                        <span>DLQ ({dlqCount})</span>
                    </button>
                )}

                {queueCount > 0 ? (
                    <button
                        type="button"
                        onClick={openOfflineDrawer}
                        className="min-h-[36px] px-3 bg-[var(--color-paper)] border border-[var(--color-rule)] hover:border-[var(--color-accent)] text-[var(--color-accent)] text-[10px] font-bold uppercase rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation active:scale-95"
                    >
                        <span>ค้างส่ง {queueCount} รายการ</span>
                        <span className="text-[9px] text-[var(--color-neutral)] underline ml-0.5">[ตรวจสอบ]</span>
                    </button>
                ) : (
                    <span className="min-h-[36px] flex items-center text-[10px] text-[var(--color-muted)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-1 rounded-xs">
                        ไม่มีรายการค้างซิงค์
                    </span>
                )}

                <button
                    type="button"
                    disabled={isChecking}
                    onClick={checkConnectivityNow}
                    className="min-h-[36px] px-3.5 bg-[var(--color-ink)] hover:opacity-90 active:scale-95 text-[var(--color-paper)] text-[10px] font-bold uppercase rounded-xs transition-opacity cursor-pointer disabled:opacity-50 touch-manipulation"
                >
                    {isChecking ? 'กำลังตรวจ...' : 'ตรวจสัญญาณใหม่'}
                </button>
            </div>
        </div>
    );
}
