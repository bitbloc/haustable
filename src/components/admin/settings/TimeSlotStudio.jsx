/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react';
import { Clock, Plus, Trash2, RotateCcw, Check, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

export default function TimeSlotStudio({
    value = '',
    openingTime = '11:00',
    closingTime = '21:30',
    onChange
}) {
    const [customTimeInput, setCustomTimeInput] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

    // Parse comma-separated value into sorted unique array
    const activeSlots = useMemo(() => {
        if (!value || typeof value !== 'string') return [];
        return value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .filter(s => /^([01]\d|2[0-3]):([0-5]\d)$/.test(s))
            .sort((a, b) => a.localeCompare(b));
    }, [value]);

    const activeSet = useMemo(() => new Set(activeSlots), [activeSlots]);

    // Update parent with sorted comma-separated string
    const emitChanges = (newSlotsArray) => {
        const uniqueSorted = Array.from(new Set(newSlotsArray))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        if (onChange) {
            onChange(uniqueSorted.join(', '));
        }
    };

    // Toggle individual time slot
    const toggleSlot = (slot) => {
        if (activeSet.has(slot)) {
            emitChanges(activeSlots.filter(s => s !== slot));
        } else {
            emitChanges([...activeSlots, slot]);
        }
    };

    // Auto-generate slots given interval in minutes
    const generateSlotsByInterval = (intervalMins) => {
        const [openH, openM] = (openingTime || '11:00').split(':').map(Number);
        const [closeH, closeM] = (closingTime || '21:30').split(':').map(Number);

        const startMinutes = openH * 60 + (openM || 0);
        const endMinutes = closeH * 60 + (closeM || 0);

        if (startMinutes >= endMinutes) {
            toast.error('เวลาเปิดร้านต้องมาก่อนเวลาปิดร้าน');
            return;
        }

        const generated = [];
        for (let m = startMinutes; m < endMinutes; m += intervalMins) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
            generated.push(timeStr);
        }

        emitChanges(generated);
        toast.success(`สร้างรอบเวลาทุกๆ ${intervalMins} นาที (${generated.length} รอบ) สำเร็จ`);
    };

    // Add custom single slot
    const handleAddCustomSlot = (e) => {
        e?.preventDefault();
        const cleaned = customTimeInput.trim();
        if (!cleaned || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(cleaned)) {
            toast.error('กรุณาระบุเวลาในรูปแบบ HH:mm (เช่น 17:45)');
            return;
        }

        if (activeSet.has(cleaned)) {
            toast.info(`รอบเวลา ${cleaned} มีอยู่ในรายการแล้ว`);
            setCustomTimeInput('');
            return;
        }

        emitChanges([...activeSlots, cleaned]);
        toast.success(`เพิ่มรอบเวลา ${cleaned} เรียบร้อย`);
        setCustomTimeInput('');
        setShowCustomInput(false);
    };

    // Group active slots by meal periods
    const groupedSlots = useMemo(() => {
        const groups = {
            lunch: { label: 'มื้อเที่ยง (11:00 - 14:00)', slots: [] },
            afternoon: { label: 'ช่วงบ่าย (14:00 - 17:00)', slots: [] },
            dinner: { label: 'มื้อเย็น (17:00 - 21:00)', slots: [] },
            night: { label: 'รอบดึก (21:00+)', slots: [] },
        };

        activeSlots.forEach(slot => {
            const hour = parseInt(slot.split(':')[0], 10);
            if (hour >= 11 && hour < 14) groups.lunch.slots.push(slot);
            else if (hour >= 14 && hour < 17) groups.afternoon.slots.push(slot);
            else if (hour >= 17 && hour < 21) groups.dinner.slots.push(slot);
            else groups.night.slots.push(slot);
        });

        return groups;
    }, [activeSlots]);

    return (
        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-2xl p-5 space-y-5 font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--color-rule)] pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[oklch(45%_0.08_140)]/10 text-[oklch(45%_0.08_140)] border border-[oklch(45%_0.08_140)]/20 flex items-center justify-center">
                        <Clock size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm tabular-nums font-bold text-[var(--color-ink)]">
                            TIME SLOT STUDIO · ระบบจัดการรอบเวลาให้บริการ
                        </h2>
                        <p className="text-[13px] tabular-nums text-[var(--color-neutral)]">
                            สร้างและเปิด-ปิดรอบเวลาที่ลูกค้าสามารถเลือกจองโต๊ะหรือสั่ง Pickup ได้
                        </p>
                    </div>
                </div>

                {/* Total Active Slots Badge */}
                <div className="flex items-center gap-2">
                    <span className="tabular-nums text-xs font-bold px-2.5 py-1 rounded-lg bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)]">
                        รอบที่เปิดใช้งาน: <strong className="text-[var(--brand-plum)]">{activeSlots.length}</strong> รอบ
                    </span>
                </div>
            </div>

            {/* Quick Generator Toolbar */}
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--color-rule)] pb-2.5">
                    <span className="tabular-nums text-xs font-bold text-[var(--color-neutral)] flex items-center gap-1.5">
                        <Sparkles size={12} className="text-[var(--brand-plum)]" />
                        AUTO-GENERATOR (สร้างอัตโนมัติตามช่วงเวลา {openingTime} - {closingTime}):
                    </span>
                    <div className="flex items-center gap-1.5 text-xs tabular-nums text-[var(--color-neutral)]">
                        <button
                            type="button"
                            onClick={() => emitChanges([])}
                            className="text-red-600 hover:underline cursor-pointer"
                        >
                            ล้างรอบทั้งหมด
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        onClick={() => generateSlotsByInterval(60)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] tabular-nums text-xs font-bold text-[var(--color-ink)] transition-all cursor-pointer flex items-center gap-1"
                    >
                        ⚡ ทุก 1 ชม. (60m - แนะนำร้านอาหาร)
                    </button>
                    <button
                        type="button"
                        onClick={() => generateSlotsByInterval(30)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] tabular-nums text-xs font-bold text-[var(--color-ink)] transition-all cursor-pointer"
                    >
                        ⏱ ทุก 30 นาที (คาเฟ่ / หมุนโต๊ะเร็ว)
                    </button>
                    <button
                        type="button"
                        onClick={() => generateSlotsByInterval(45)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] tabular-nums text-xs font-bold text-[var(--color-ink)] transition-all cursor-pointer"
                    >
                        ทุก 45 นาที
                    </button>
                    <button
                        type="button"
                        onClick={() => generateSlotsByInterval(90)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] tabular-nums text-xs font-bold text-[var(--color-ink)] transition-all cursor-pointer"
                    >
                        ทุก 1.5 ชม. (90m)
                    </button>
                    <button
                        type="button"
                        onClick={() => generateSlotsByInterval(15)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] tabular-nums text-xs font-bold text-[var(--color-ink)] transition-all cursor-pointer"
                    >
                        ทุก 15 นาที (Pickup ถี่)
                    </button>
                </div>
            </div>

            {/* Visual Slots Chips Studio & Custom Adder */}
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-2.5">
                    <span className="tabular-nums text-xs font-bold text-[var(--color-ink)]">
                        รอบเวลาที่เปิดให้บริการ (คลิกชิปเพื่อเปิด/ปิดรอบเวลา)
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        className="tabular-nums text-xs font-bold text-[var(--brand-plum)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                        <Plus size={12} /> {showCustomInput ? 'ปิดช่องเพิ่ม' : '+ เพิ่มรอบเวลาพิเศษ'}
                    </button>
                </div>

                {/* Custom Slot Input Drawer */}
                {showCustomInput && (
                    <form onSubmit={handleAddCustomSlot} className="flex items-center gap-2 p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg">
                        <span className="tabular-nums text-xs font-bold text-[var(--color-ink)]">เวลา:</span>
                        <input
                            type="time"
                            value={customTimeInput}
                            onChange={(e) => setCustomTimeInput(e.target.value)}
                            className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded px-2 py-1 tabular-nums text-xs font-bold outline-none focus:border-[var(--color-ink)]"
                            required
                        />
                        <button
                            type="submit"
                            className="px-3 py-1 bg-[var(--color-ink)] text-[var(--color-paper)] tabular-nums text-xs font-bold rounded hover:bg-[var(--color-ink)] transition-colors cursor-pointer"
                        >
                            + เพิ่มรอบ
                        </button>
                    </form>
                )}

                {/* Grouped Meal Slots Rendering */}
                {activeSlots.length === 0 ? (
                    <div className="text-center py-10 tabular-nums text-xs text-[var(--color-neutral)] italic">
                        ยังไม่มีรอบเวลาที่เปิดใช้งาน — กรุณากดปุ่ม Auto-Generator หรือเพิ่มรอบเวลาพิเศษด้านบน
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(groupedSlots).map(([key, group]) => {
                            if (group.slots.length === 0) return null;
                            return (
                                <div key={key} className="space-y-2">
                                    <div className="tabular-nums text-xs font-bold text-[var(--color-neutral)]  ">
                                        {group.label} ({group.slots.length} รอบ)
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {group.slots.map(slot => (
                                            <button
                                                key={slot}
                                                type="button"
                                                onClick={() => toggleSlot(slot)}
                                                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-paper)] hover:bg-red-50 hover:border-red-300 border border-[var(--color-rule)] tabular-nums text-xs font-bold text-[var(--color-ink)] transition-all cursor-pointer select-none"
                                                title="คลิกเพื่อลบรอบเวลานี้"
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:bg-red-500 transition-colors"></span>
                                                <span>{slot}</span>
                                                <X size={12} className="text-[var(--color-neutral)] group-hover:text-red-600 transition-colors ml-0.5" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Read-only raw preview for developer inspection */}
            <div className="flex items-center justify-between tabular-nums text-xs text-[var(--color-neutral)] pt-1">
                <span className="truncate max-w-[80%]">
                    Raw database string: <span className="text-[var(--color-ink)]">{value || '(empty)'}</span>
                </span>
                <span>{activeSlots.length} active</span>
            </div>
        </div>
    );
}
