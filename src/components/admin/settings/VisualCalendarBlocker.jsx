/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Calendar, ChevronLeft, ChevronRight, Trash2, ShieldAlert, Sparkles, Check, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function VisualCalendarBlocker({ blockedList = [], onRefresh }) {
    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [selectedDates, setSelectedDates] = useState(new Set());
    const [reason, setReason] = useState('ปิดรับจองชั่วคราว');
    const [isSaving, setIsSaving] = useState(false);

    // Map blocked list by ISO date string (YYYY-MM-DD)
    const blockedMap = useMemo(() => {
        const map = new Map();
        (blockedList || []).forEach(item => {
            if (item.blocked_date) {
                // Normalize date string
                const dStr = item.blocked_date.slice(0, 10);
                map.set(dStr, item);
            }
        });
        return map;
    }, [blockedList]);

    // Calendar generation for currentMonth
    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
        const totalDays = lastDayOfMonth.getDate();

        const days = [];

        // Previous month filler days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            const prevDate = new Date(year, month - 1, d);
            const dateStr = prevDate.toLocaleDateString('en-CA');
            days.push({
                day: d,
                dateStr,
                isCurrentMonth: false,
                date: prevDate
            });
        }

        // Current month days
        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(year, month, d);
            const dateStr = date.toLocaleDateString('en-CA');
            days.push({
                day: d,
                dateStr,
                isCurrentMonth: true,
                date
            });
        }

        // Next month filler days to complete grid (42 cells max)
        const remaining = 42 - days.length;
        for (let d = 1; d <= remaining; d++) {
            const nextDate = new Date(year, month + 1, d);
            const dateStr = nextDate.toLocaleDateString('en-CA');
            days.push({
                day: d,
                dateStr,
                isCurrentMonth: false,
                date: nextDate
            });
        }

        return days;
    }, [currentMonth]);

    const handlePrevMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    // Toggle single day on calendar
    const handleDayClick = (dayObj) => {
        const dStr = dayObj.dateStr;
        const isAlreadyBlocked = blockedMap.has(dStr);

        if (isAlreadyBlocked) {
            // Instant unblock single day
            const item = blockedMap.get(dStr);
            handleDeleteBlocked(item.id, dStr);
            return;
        }

        // Toggle in selected staging set
        setSelectedDates(prev => {
            const next = new Set(prev);
            if (next.has(dStr)) {
                next.delete(dStr);
            } else {
                next.add(dStr);
            }
            return next;
        });
    };

    // Save selected staging dates
    const handleSaveSelected = async () => {
        if (selectedDates.size === 0) return;
        setIsSaving(true);
        try {
            const payload = Array.from(selectedDates).map(dateStr => ({
                blocked_date: dateStr,
                reason: reason.trim() || 'ปิดรับจอง'
            }));

            const { error } = await supabase
                .from('blocked_dates')
                .upsert(payload, { onConflict: 'blocked_date', ignoreDuplicates: true });

            if (error) throw error;

            toast.success(`บล็อก ${selectedDates.size} วันเรียบร้อยแล้ว`);
            setSelectedDates(new Set());
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Failed to block dates:', err);
            toast.error('ไม่สามารถบันทึกวันหยุดได้: ' + (err.message || 'Error'));
        } finally {
            setIsSaving(false);
        }
    };

    // Delete single blocked date
    const handleDeleteBlocked = async (id, dateLabel = '') => {
        try {
            const { error } = await supabase.from('blocked_dates').delete().eq('id', id);
            if (error) throw error;
            toast.success(`ปลดล็อกวันที่ ${dateLabel || ''} เรียบร้อย`);
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Failed to delete blocked date:', err);
            toast.error('ปลดล็อกไม่สำเร็จ: ' + err.message);
        }
    };

    // Quick Presets
    const handleApplyPreset = (type) => {
        const today = new Date();
        const targets = new Set();

        if (type === 'today') {
            targets.add(today.toLocaleDateString('en-CA'));
        } else if (type === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            targets.add(tomorrow.toLocaleDateString('en-CA'));
        } else if (type === 'weekend') {
            // Find this upcoming Saturday and Sunday
            const dayOfWeek = today.getDay();
            const satOffset = (6 - dayOfWeek + 7) % 7;
            const sat = new Date(today);
            sat.setDate(sat.getDate() + (satOffset === 0 ? 7 : satOffset));
            const sun = new Date(sat);
            sun.setDate(sun.getDate() + 1);

            targets.add(sat.toLocaleDateString('en-CA'));
            targets.add(sun.toLocaleDateString('en-CA'));
        } else if (type === 'next_week') {
            // 7 days starting from next Monday
            const dayOfWeek = today.getDay();
            const daysUntilMon = (8 - dayOfWeek) % 7 || 7;
            const startMon = new Date(today);
            startMon.setDate(startMon.getDate() + daysUntilMon);

            for (let i = 0; i < 7; i++) {
                const d = new Date(startMon);
                d.setDate(d.getDate() + i);
                targets.add(d.toLocaleDateString('en-CA'));
            }
        }

        setSelectedDates(targets);
    };

    const monthLabel = currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    const todayStr = new Date().toLocaleDateString('en-CA');

    // Upcoming blocked dates list (sorted)
    const upcomingBlocked = useMemo(() => {
        return (blockedList || [])
            .filter(b => b.blocked_date >= todayStr)
            .sort((a, b) => a.blocked_date.localeCompare(b.blocked_date));
    }, [blockedList, todayStr]);

    return (
        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-2xl p-5 shadow-2xs space-y-5 font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[oklch(85%_0.012_28)] pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] border border-[oklch(52%_0.16_28)]/20 flex items-center justify-center">
                        <Calendar size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                            BLOCKED DATES STUDIO · จัดการวันหยุดร้าน
                        </h2>
                        <p className="text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                            คลิกเลือกวันที่บนปฏิทินเพื่อล็อกวันหยุด (ซิงค์ตรงกับหน้าจองของลูกค้าทันที)
                        </p>
                    </div>
                </div>

                {/* Total Count Badge */}
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)]">
                        หยุดล่วงหน้า: <strong className="text-[oklch(52%_0.16_28)]">{upcomingBlocked.length}</strong> วัน
                    </span>
                </div>
            </div>

            {/* Quick Presets Bar */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider">
                <span className="text-[oklch(55%_0.010_28)] mr-1 flex items-center gap-1">
                    <Sparkles size={11} /> PRESETS:
                </span>
                <button
                    type="button"
                    onClick={() => handleApplyPreset('today')}
                    className="px-2.5 py-1 rounded-md bg-[oklch(94%_0.010_28)] hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] transition-all cursor-pointer"
                >
                    + หยุดวันนี้
                </button>
                <button
                    type="button"
                    onClick={() => handleApplyPreset('tomorrow')}
                    className="px-2.5 py-1 rounded-md bg-[oklch(94%_0.010_28)] hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] transition-all cursor-pointer"
                >
                    + หยุดพรุ่งนี้
                </button>
                <button
                    type="button"
                    onClick={() => handleApplyPreset('weekend')}
                    className="px-2.5 py-1 rounded-md bg-[oklch(94%_0.010_28)] hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] transition-all cursor-pointer"
                >
                    + สุดสัปดาห์นี้ (เสาร์-อาทิตย์)
                </button>
                <button
                    type="button"
                    onClick={() => handleApplyPreset('next_week')}
                    className="px-2.5 py-1 rounded-md bg-[oklch(94%_0.010_28)] hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] transition-all cursor-pointer"
                >
                    + สัปดาห์หน้า (7 วัน)
                </button>
            </div>

            {/* Main Studio Grid: Calendar (Left 7 cols) & Staging / Active List (Right 5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* 1. Visual Monthly Calendar Grid */}
                <div className="lg:col-span-7 bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-4 flex flex-col justify-between">
                    {/* Calendar Month Navigation */}
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-3 mb-3">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1.5 rounded-lg border border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] transition-all cursor-pointer"
                            title="เดือนก่อนหน้า"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <span className="font-mono font-bold text-xs uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                            {monthLabel}
                        </span>

                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1.5 rounded-lg border border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] transition-all cursor-pointer"
                            title="เดือนถัดไป"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Days of Week Header */}
                    <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider mb-2">
                        <span className="text-red-600">อา</span>
                        <span>จ</span>
                        <span>อ</span>
                        <span>พ</span>
                        <span>พฤ</span>
                        <span>ศ</span>
                        <span className="text-blue-600">ส</span>
                    </div>

                    {/* 42-cell Calendar Days Grid */}
                    <div className="grid grid-cols-7 gap-1.5">
                        {calendarDays.map((dayObj, idx) => {
                            const dStr = dayObj.dateStr;
                            const isToday = dStr === todayStr;
                            const isPast = dStr < todayStr;
                            const isBlocked = blockedMap.has(dStr);
                            const isSelected = selectedDates.has(dStr);
                            const blockedInfo = blockedMap.get(dStr);

                            let cellBg = 'bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)]';

                            if (!dayObj.isCurrentMonth) {
                                cellBg = 'opacity-30 bg-transparent text-[oklch(55%_0.010_28)] border-dashed border-gray-200';
                            } else if (isBlocked) {
                                // Red blocked style
                                cellBg = 'bg-red-50 text-red-900 border-red-300 font-bold hover:bg-red-100 ring-1 ring-red-400';
                            } else if (isSelected) {
                                // Terracotta staged selection style
                                cellBg = 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)] font-bold shadow-xs';
                            } else if (isToday) {
                                cellBg = 'bg-blue-50 text-blue-900 border-blue-300 font-bold';
                            }

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleDayClick(dayObj)}
                                    className={`h-11 rounded-lg border flex flex-col items-center justify-center p-1 transition-all cursor-pointer relative group select-none ${cellBg}`}
                                    title={isBlocked ? `[บล็อกอยู่] ${blockedInfo?.reason || 'ปิดรับจอง'} (คลิกเพื่อปลดล็อก)` : isSelected ? 'คลิกเพื่อยกเลิกเลือก' : 'คลิกเพื่อเลือกล็อกวัน'}
                                >
                                    <span className="font-mono text-xs">{dayObj.day}</span>
                                    
                                    {isBlocked && (
                                        <span className="text-[8px] font-mono uppercase tracking-tighter truncate max-w-full text-red-700 leading-none mt-0.5">
                                            BLOCKED
                                        </span>
                                    )}

                                    {isSelected && (
                                        <span className="text-[8px] font-mono uppercase tracking-tighter truncate max-w-full text-white/90 leading-none mt-0.5">
                                            SELECTED
                                        </span>
                                    )}

                                    {isToday && !isBlocked && !isSelected && (
                                        <span className="w-1 h-1 rounded-full bg-blue-600 absolute bottom-1"></span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[oklch(85%_0.012_28)] pt-3 mt-3 text-[10px] font-mono text-[oklch(55%_0.010_28)]">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-300"></span> วันหยุด (ล็อกแล้ว)
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded bg-[oklch(52%_0.16_28)]"></span> กำลังเลือก
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded bg-blue-50 border border-blue-300"></span> วันนี้
                            </span>
                        </div>
                        <span className="text-[9px] italic">💡 คลิกวันที่สีแดงเพื่อปลดล็อกได้ทันที</span>
                    </div>
                </div>

                {/* 2. Staging Save Box & Active Blocked List */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    
                    {/* Action Form for Selected Staging Dates */}
                    <div className={`p-4 rounded-xl border transition-all ${
                        selectedDates.size > 0 
                            ? 'bg-[oklch(94%_0.010_28)] border-[oklch(52%_0.16_28)] shadow-xs' 
                            : 'bg-white border-[oklch(85%_0.012_28)] opacity-90'
                    }`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                ล็อกวันที่เลือก ({selectedDates.size} วัน)
                            </span>
                            {selectedDates.size > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDates(new Set())}
                                    className="text-[10px] font-mono text-red-600 hover:underline cursor-pointer"
                                >
                                    ล้างที่เลือก
                                </button>
                            )}
                        </div>

                        {/* Selected Dates Chips */}
                        {selectedDates.size > 0 ? (
                            <div className="flex flex-wrap gap-1 mb-3 max-h-20 overflow-y-auto pr-1">
                                {Array.from(selectedDates).sort().map(dStr => (
                                    <span
                                        key={dStr}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[oklch(85%_0.012_28)] font-mono text-[10px] font-bold text-[oklch(18%_0.012_28)]"
                                    >
                                        {dStr}
                                        <X
                                            size={10}
                                            className="text-red-500 hover:text-red-700 cursor-pointer"
                                            onClick={() => {
                                                setSelectedDates(prev => {
                                                    const next = new Set(prev);
                                                    next.delete(dStr);
                                                    return next;
                                                });
                                            }}
                                        />
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-[oklch(55%_0.010_28)] italic mb-3">
                                เลือกวันที่บนปฏิทินทางซ้าย หรือใช้ปุ่ม Preset ด้านบน
                            </p>
                        )}

                        {/* Reason Input & Confirm Button */}
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="สาเหตุ (เช่น วันหยุดนักขัตฤกษ์, ปรับปรุงร้าน)"
                                className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-lg px-3 py-2 text-xs font-sans text-[oklch(18%_0.012_28)] outline-none focus:border-[oklch(18%_0.012_28)]"
                            />

                            <button
                                type="button"
                                disabled={selectedDates.size === 0 || isSaving}
                                onClick={handleSaveSelected}
                                className="w-full py-2.5 rounded-lg bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                            >
                                <Check size={14} />
                                <span>{isSaving ? 'SAVING...' : `ยืนยันล็อก ${selectedDates.size} วันหยุด`}</span>
                            </button>
                        </div>
                    </div>

                    {/* Active Blocked Dates List */}
                    <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-center border-b border-[oklch(85%_0.012_28)] pb-2 mb-2">
                            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                วันหยุดที่ตั้งไว้ ({upcomingBlocked.length})
                            </span>
                            <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)]">นับจากวันนี้</span>
                        </div>

                        <div className="space-y-1.5 overflow-y-auto max-h-[220px] pr-1 flex-1">
                            {upcomingBlocked.map(item => {
                                const d = new Date(item.blocked_date);
                                const dLabel = d.toLocaleDateString('th-TH', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                    year: '2-digit'
                                });

                                return (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] hover:border-red-300 transition-colors"
                                    >
                                        <div className="min-w-0 pr-2">
                                            <div className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                                                <span>{dLabel}</span>
                                            </div>
                                            <div className="text-[10px] text-[oklch(55%_0.010_28)] truncate pl-3">
                                                {item.reason || 'ปิดรับจอง'}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteBlocked(item.id, item.blocked_date)}
                                            className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer shrink-0"
                                            title="ปลดล็อกวันหยุดนี้"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                );
                            })}

                            {upcomingBlocked.length === 0 && (
                                <div className="text-center py-8 text-[11px] font-mono text-[oklch(55%_0.010_28)] italic">
                                    ไม่มีวันหยุดล่วงหน้าที่ตั้งไว้
                                </div>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
