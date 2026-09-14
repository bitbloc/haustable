/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react';
import { 
    ArrowLeft, Plus, Search, Trash2, Edit2, Eye, EyeOff, Save, X, 
    Settings, RefreshCw, Link as LinkIcon, Download, Copy, FileText, 
    ChevronRight, Check, SlidersHorizontal, Sparkles, BookOpen 
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import useBarSOP, { SOP_ACTIONS } from '../../hooks/useBarSOP';
import SOPRecipeCard from '../sop/SOPRecipeCard';
import SOPCategoryManager from '../sop/SOPCategoryManager';
import SOPExportModal from '../sop/SOPExportModal';
import { parseSOPText } from '../../utils/sopTextParser';
import { toast } from 'sonner';
import { THAI_UNITS } from '../../utils/unitUtils';

// ── Standard Beverage Starter Templates (สูตรตั้งต้นสำเร็จรูป) ──
const BEVERAGE_STARTER_TEMPLATES = [
    {
        id: 'iced_latte',
        name: 'กาแฟนมเย็น (Iced Latte)',
        steps: [
            { order: 1, action: 'brew', title: 'สกัดช็อตกาแฟ', instruction: 'สกัดเอสเพรสโซ่ 2 ช็อต (ประมาณ 30-36g) ในเวลา 25-30 วินาที', duration_sec: 30, key_points: 'เช็คเวลาและน้ำหนักสกัดให้อยู่ในเกณฑ์มาตรฐาน', reason: 'ให้ได้รสชาติเข้มข้นไม่ไหม้' },
            { order: 2, action: 'stir', title: 'ผสมนมและสารหวาน', instruction: 'ตวงนมสดและสารหวานตามระดับที่ลูกค้าเลือก คนผสมให้เข้ากันในแก้ว', duration_sec: 15, key_points: 'คนจนสารหวานละลายเนียนเข้ากับนม', reason: 'ป้องกันน้ำตาลตกตะกอนก้นแก้ว' },
            { order: 3, action: 'pour', title: 'ใส่น้ำแข็งและเทกาแฟ', instruction: 'ตักน้ำแข็งเต็มแก้ว เทนมลงไป แล้วค่อยๆ เทช็อตกาแฟท็อปด้านบน', duration_sec: 10, key_points: 'เทกาแฟผ่านน้ำแข็งเบาๆ', reason: 'เพื่อให้เกิดเลเยอร์แยกชั้นที่สวยงาม' }
        ]
    },
    {
        id: 'iced_americano',
        name: 'กาแฟดำเย็น (Iced Americano)',
        steps: [
            { order: 1, action: 'pour', title: 'เตรียมน้ำเย็นและสารหวาน', instruction: 'ตวงน้ำเย็นและสารหวาน (ถ้ามี) ลงในแก้ว คนให้ละลาย แล้วตักน้ำแข็งเต็มแก้ว', duration_sec: 15, key_points: 'ใช้น้ำกรองเย็นจัด', reason: 'ลดการละลายของน้ำแข็ง' },
            { order: 2, action: 'brew', title: 'สกัดช็อตกาแฟ', instruction: 'สกัดเอสเพรสโซ่ 2 ช็อต (30-36g) ลงบนเหยือกตวง', duration_sec: 30, key_points: 'ดมกลิ่นและเช็ค Crema สีทอง', reason: 'รับประกันความสดของช็อต' },
            { order: 3, action: 'pour', title: 'เทกาแฟลงบนน้ำแข็ง', instruction: 'เทช็อตกาแฟสดราดบนผิวน้ำแข็งพร้อมเสิร์ฟ', duration_sec: 10, key_points: 'เสิร์ฟทันทีขณะ Crema ยังลอยตัว', reason: 'ให้ลูกค้าได้กลิ่นหอมของอโรมาเต็มที่' }
        ]
    },
    {
        id: 'matcha_latte',
        name: 'มัทฉะลาเต้ (Iced Matcha Latte)',
        steps: [
            { order: 1, action: 'stir', title: 'ชั่งและตีมัทฉะ', instruction: 'ร่อนผงมัทฉะลงถ้วย เติมน้ำอุณหภูมิ 80C ตีด้วยแปรง Chasen เป็นรูปตัว W จนเนียนละเอียดและขึ้นฟอง', duration_sec: 45, key_points: 'อุณหภูมิน้ำห้ามเกิน 85C และตีจนไม่เหลือเม็ดแป้ง', reason: 'น้ำร้อนเกินไปจะทำให้มัทฉะมีรสขมฝาด' },
            { order: 2, action: 'stir', title: 'เตรียมนมสดและสารหวาน', instruction: 'เติมนมสดและสารหวานตามระดับลงในแก้ว คนให้เข้ากันแล้วใส่น้ำแข็งเต็มแก้ว', duration_sec: 15, key_points: 'ใช้นมสดพาสเจอร์ไรส์เย็นจัด', reason: 'เสริมบอดี้ความหอมมัน' },
            { order: 3, action: 'pour', title: 'เทมัทฉะแยกชั้น', instruction: 'ค่อยๆ เทเบสมัทฉะที่ตีแล้วลงด้านบนช้าๆ ให้แยกชั้นสีเขียวกับนมสดสีขาว', duration_sec: 10, key_points: 'เทผ่านหลังช้อนหรือก้อนน้ำแข็ง', reason: 'เพื่อความสวยงามตามมาตรฐานร้าน' }
        ]
    },
    {
        id: 'sparkling_soda',
        name: 'อิตาเลียนโซดา (Sparkling Fruit Soda)',
        steps: [
            { order: 1, action: 'stir', title: 'ผสมไซรัปผลไม้', instruction: 'ตวงไซรัปและน้ำผลไม้ลงก้นแก้ว เติมโซดาประมาณ 30ml คนให้เข้ากันจนเนียน', duration_sec: 15, key_points: 'คนไซรัปกับโซดานิดเดียวก่อนใส่น้ำแข็ง', reason: 'ช่วยให้ไซรัปไม่จมและกระจายตัวดี' },
            { order: 2, action: 'pour', title: 'ใส่น้ำแข็งและโซดา', instruction: 'ตักน้ำแข็งเต็มแก้ว เทโซดาเย็นจัดลงไปจนเกือบเต็มแก้ว', duration_sec: 10, key_points: 'เทโซดาแนบขอบแก้วเบาๆ', reason: 'รักษาความซ่าของคาร์บอเนต' },
            { order: 3, action: 'pour', title: 'ตกแต่งและปิดฝา', instruction: 'ตกแต่งด้วยผลไม้สด/โรสแมรี่/เลมอนหั่นแว่น เช็ดขอบแก้วให้แห้งสะอาดก่อนเสิร์ฟ', duration_sec: 10, key_points: 'ตรวจดูความสะอาดของปากแก้ว', reason: 'สร้างความประทับใจแรกก่อนดื่ม' }
        ]
    },
    {
        id: 'dirty_coffee',
        name: 'กาแฟเดอร์ตี้ (Dirty Coffee)',
        steps: [
            { order: 1, action: 'prepare', title: 'เตรียมนมเย็นจัด (Chilled Milk Mix)', instruction: 'ผสมนมสด ครีมสด และสารหวานตามสูตร แช่ในช่องฟรีซ 10-15 นาทีให้อุณหภูมิเย็นจัดใกล้ 0C', duration_sec: 30, key_points: 'นมต้องเย็นจัดและแก้วต้องแช่เย็น', reason: 'ป้องกันไม่ให้นมและกาแฟผสมกันเร็วเกินไป' },
            { order: 2, action: 'brew', title: 'สกัดช็อต Ristretto', instruction: 'สกัดกาแฟแบบ Double Ristretto (ประมาณ 20-25g) หยดตรงลงบนผิวนมเย็นจัดโดยตรง', duration_sec: 25, key_points: 'รองแก้วไว้ใต้ Portafilter โดยตรง ไม่ใช้น้ำแข็ง', reason: 'ให้ความต่างของอุณหภูมิร้อน-เย็นปะทะกันอย่างสมบูรณ์' },
            { order: 3, action: 'pour', title: 'เสิร์ฟทันทีโดยไม่คน', instruction: 'ยกเสิร์ฟทันทีพร้อมคำแนะนำให้ลูกค้าดื่มแบบจิบจากขอบแก้วเพื่อสัมผัสสองอุณหภูมิ', duration_sec: 10, key_points: 'เสิร์ฟภายใน 1 นาทีหลังสกัด', reason: 'หากปล่อยไว้นาน เลเยอร์จะรวมตัวกัน' }
        ]
    }
];

// ── Step Editor Row (Dieter Rams Tabular Cell) ──
function StepRow({ step, index, onUpdate, onDelete, onMove, isLast, availableIngredients, isExpanded, onToggleExpand }) {
    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] overflow-hidden transition-all duration-150 rounded-xs">
            {/* Header (Collapsed View) */}
            <div 
                onClick={onToggleExpand}
                className="p-3 bg-[oklch(94%_0.010_28)] flex items-center justify-between cursor-pointer hover:bg-[oklch(90%_0.012_28)] transition-colors select-none"
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-5 h-5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0">
                        {index + 1}
                    </span>
                    <span className="text-xs font-bold text-[oklch(18%_0.012_28)] truncate">
                        {step.title || <span className="text-[oklch(55%_0.010_28)] italic font-mono">[ขั้นตอนยังไม่มีชื่อ]</span>}
                    </span>
                    {step.duration_sec && (
                        <span className="text-[10px] bg-[oklch(88%_0.012_28)] text-[oklch(18%_0.012_28)] px-1.5 py-0.2 font-mono font-bold flex-shrink-0">
                            {step.duration_sec}S
                        </span>
                    )}
                    {step.action && (
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] font-mono uppercase">
                            [{step.action}]
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button 
                        type="button"
                        onClick={() => onMove(index, -1)} 
                        disabled={index === 0} 
                        className="p-1 text-[oklch(55%_0.010_28)] hover:text-black disabled:opacity-20 cursor-pointer text-xs"
                        title="ย้ายขึ้น"
                    >
                        ▲
                    </button>
                    <button 
                        type="button"
                        onClick={() => onMove(index, 1)} 
                        disabled={isLast} 
                        className="p-1 text-[oklch(55%_0.010_28)] hover:text-black disabled:opacity-20 cursor-pointer text-xs"
                        title="ย้ายลง"
                    >
                        ▼
                    </button>
                    <button 
                        type="button"
                        onClick={() => onDelete(index)} 
                        className="p-1 text-[oklch(55%_0.010_28)] hover:text-red-700 cursor-pointer"
                        title="ลบขั้นตอน"
                    >
                        <Trash2 size={14} />
                    </button>
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-1 font-mono font-bold">
                        {isExpanded ? '[ย่อ ▲]' : '[แก้ไข ▼]'}
                    </span>
                </div>
            </div>

            {/* Expanded Fields */}
            {isExpanded && (
                <div className="p-4 border-t border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-1">
                            <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">ประเภทการทำ</label>
                            <select
                                value={step.action || 'pour'}
                                onChange={e => onUpdate(index, { ...step, action: e.target.value })}
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs font-mono outline-none focus:border-black"
                            >
                                {SOP_ACTIONS.map(a => (
                                    <option key={a.key} value={a.key}>{a.labelEn || a.label} ({a.label})</option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-3">
                            <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">ชื่อขั้นตอน</label>
                            <input 
                                value={step.title || ''} 
                                onChange={e => onUpdate(index, { ...step, title: e.target.value })} 
                                placeholder="ชื่อขั้นตอน (เช่น สกัดช็อตกาแฟ)" 
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs font-bold outline-none focus:border-black" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">รายละเอียดขั้นตอน</label>
                        <textarea 
                            value={step.instruction || ''} 
                            onChange={e => onUpdate(index, { ...step, instruction: e.target.value })} 
                            placeholder="รายละเอียดขั้นตอนอย่างย่อ" 
                            className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs outline-none focus:border-black resize-none" 
                            rows={3} 
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-mono font-bold text-[oklch(52%_0.16_28)] uppercase block mb-1">[KEY POINT] จุดสำคัญ</label>
                            <input 
                                value={step.key_points || ''} 
                                onChange={e => onUpdate(index, { ...step, key_points: e.target.value })} 
                                placeholder="จุดสำคัญ (เช่น น้ำต้องเย็นจัด)" 
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs outline-none focus:border-[oklch(52%_0.16_28)]" 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">[REASON] เหตุผล</label>
                            <input 
                                value={step.reason || ''} 
                                onChange={e => onUpdate(index, { ...step, reason: e.target.value })} 
                                placeholder="เหตุผล (เช่น ลดการแยกชั้น)" 
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs outline-none focus:border-black" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-1">
                            <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">เวลา (วินาที)</label>
                            <input
                                type="number"
                                value={step.duration_sec || ''}
                                onChange={e => onUpdate(index, { ...step, duration_sec: e.target.value ? parseInt(e.target.value, 10) : null })}
                                placeholder="เช่น 30"
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs outline-none focus:border-black font-mono"
                            />
                        </div>
                        <div className="sm:col-span-3">
                            <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">แนบวัตถุดิบ (อ้างอิงสูตร)</label>
                            {(() => {
                                const refs = step.ingredient_refs || (step.ingredient_ref ? [step.ingredient_ref] : []);
                                const available = (availableIngredients || []).filter(name => !refs.includes(name));
                                return (
                                    <div className="space-y-1.5 mt-1">
                                        {refs.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {refs.map((ref, idx) => (
                                                    <span key={idx} className="inline-flex items-center gap-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] px-2 py-0.5 rounded-xs text-[11px] font-mono">
                                                        {ref}
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                const newRefs = refs.filter((_, i) => i !== idx);
                                                                onUpdate(index, { 
                                                                    ...step, 
                                                                    ingredient_refs: newRefs, 
                                                                    ingredient_ref: newRefs.length > 0 ? newRefs[0] : null 
                                                                });
                                                            }} 
                                                            className="text-[oklch(55%_0.010_28)] hover:text-red-600 font-bold ml-0.5"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {available.length > 0 && (
                                            <select
                                                value=""
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val && !refs.includes(val)) {
                                                        const newRefs = [...refs, val];
                                                        onUpdate(index, { 
                                                            ...step, 
                                                            ingredient_refs: newRefs, 
                                                            ingredient_ref: newRefs[0] 
                                                        });
                                                    }
                                                }}
                                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs text-[oklch(42%_0.010_28)] outline-none cursor-pointer font-mono"
                                            >
                                                <option value="">+ แนบวัตถุดิบ...</option>
                                                {available.map(name => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Ingredient Row (Dieter Rams Tabular Cell) ──
function IngredientRow({ ing, index, onUpdate, onDelete }) {
    const isStandard = THAI_UNITS.some(u => u.value.toLowerCase() === (ing.unit || '').trim().toLowerCase());
    const showWarning = ing.unit && !isStandard;

    return (
        <div className="p-3 bg-[oklch(98%_0.004_28)] rounded-xs border border-[oklch(85%_0.012_28)] space-y-2.5">
            {/* Top row: Name, Qty, Unit */}
            <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 flex gap-2 items-center min-w-0">
                    {ing.isLinked && (
                        <span className="px-1.5 py-0.5 bg-[oklch(92%_0.015_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[9px] rounded-xs font-mono font-bold flex-shrink-0" title="ดึงข้อมูลจากคลังสินค้า">
                            [LINKED]
                        </span>
                    )}
                    <input 
                        value={ing.name || ''} 
                        onChange={e => onUpdate(index, { ...ing, name: e.target.value })} 
                        placeholder="ชื่อวัตถุดิบ" 
                        className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs font-bold outline-none focus:border-black" 
                    />
                </div>
                
                <div className="flex gap-2 flex-shrink-0">
                    <div className="w-20">
                        <input 
                            type="number" 
                            value={ing.qty || ''} 
                            onChange={e => onUpdate(index, { ...ing, qty: e.target.value ? parseFloat(e.target.value) : 0 })} 
                            className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs text-center font-mono font-bold outline-none focus:border-black tabular-nums" 
                            placeholder="จำนวน" 
                        />
                    </div>
                    
                    <div className="w-20 flex items-center relative">
                        <input 
                            value={ing.unit || ''} 
                            onChange={e => onUpdate(index, { ...ing, unit: e.target.value })} 
                            list="sop-units"
                            className={`w-full p-2 border text-xs text-center font-mono outline-none ${showWarning ? 'border-[oklch(60%_0.15_28)] bg-[oklch(95%_0.02_45)]/20' : 'border-[oklch(85%_0.012_28)] bg-white'}`} 
                            placeholder="หน่วย" 
                        />
                    </div>
                </div>
            </div>

            {/* Bottom row: Remark, Checkboxes, Delete */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-[oklch(90%_0.008_28)] pt-2">
                <div className="flex-1">
                    <input 
                        value={ing.remark || ''} 
                        onChange={e => onUpdate(index, { ...ing, remark: e.target.value })} 
                        className="w-full p-1.5 border border-[oklch(90%_0.008_28)] bg-white text-xs outline-none focus:border-black" 
                        placeholder="หมายเหตุ (เช่น กรองเอาแต่น้ำ)" 
                    />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 font-mono">
                    <label className="flex items-center gap-1.5 text-xs text-[oklch(42%_0.010_28)] cursor-pointer select-none">
                        <input type="checkbox" checked={ing.scalable !== false} onChange={e => onUpdate(index, { ...ing, scalable: e.target.checked })} className="rounded-xs text-black border-[oklch(85%_0.012_28)] focus:ring-0 w-3.5 h-3.5" />
                        <span className="text-[11px]">SCALE แก้ว</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-[oklch(52%_0.16_28)] font-bold cursor-pointer select-none">
                        <input type="checkbox" checked={ing.is_sweetener === true} onChange={e => onUpdate(index, { ...ing, is_sweetener: e.target.checked })} className="rounded-xs text-[oklch(52%_0.16_28)] border-[oklch(85%_0.012_28)] focus:ring-0 w-3.5 h-3.5" />
                        <span className="text-[11px]">[SWEETENER]</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-[oklch(55%_0.010_28)] cursor-pointer select-none">
                        <input type="checkbox" checked={ing.isHidden === true} onChange={e => onUpdate(index, { ...ing, isHidden: e.target.checked })} className="rounded-xs border-[oklch(85%_0.012_28)] focus:ring-0 w-3.5 h-3.5" />
                        <span className="text-[11px]">ซ่อน</span>
                    </label>

                    <button 
                        type="button"
                        onClick={() => onDelete(index)} 
                        className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-red-700 rounded transition-colors"
                        title="ลบวัตถุดิบ"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Smart Quick-Paste Modal (วางข้อความนำเข้าสูตรด่วน) ──
function QuickPasteModal({ onClose, onApply }) {
    const [text, setText] = useState('');
    const parsed = useMemo(() => parseSOPText(text), [text]);

    const handleConfirm = () => {
        if (!text.trim()) {
            toast.error('กรุณาวางข้อความสูตร');
            return;
        }
        onApply(parsed);
        toast.success(`แปลงสูตรสำเร็จ: ${parsed.name} (${parsed.ingredients.length} วัตถุดิบ, ${parsed.steps.length} ขั้นตอน)`);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] max-w-xl w-full rounded-sm shadow-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-between items-center">
                    <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">
                            NATURAL TEXT PARSER
                        </span>
                        <h2 className="font-mono text-base font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                            วางข้อความนำเข้าสูตรด่วน (Quick Paste)
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1 text-[oklch(55%_0.010_28)] hover:text-black">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                    <p className="text-xs text-[oklch(42%_0.010_28)] leading-relaxed">
                        คัดลอกข้อความสูตรจาก LINE, Apple Notes หรือ Google Docs มาวางลงในกล่องนี้ ระบบจะตัดแยกชื่อเมนู, ปริมาณ, หน่วย, และขั้นตอนการชงให้อัตโนมัติ:
                    </p>
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder={`มัทฉะลาเต้เย็น 16oz\n- ผงมัทฉะ 5g\n- น้ำร้อน 30ml\n- นมสด 120ml\n- ไซรัป 15ml (หวานปกติ 15, หวานน้อย 7.5, ไม่หวาน 0)\nขั้นตอน:\n1. ตีมัทฉะกับน้ำร้อน 30 วินาทีจนละลาย\n2. ใส่นมสดและน้ำแข็งเต็มแก้ว\n3. เทมัทฉะท็อปด้านบน`}
                        className="w-full h-44 p-3 border border-[oklch(85%_0.012_28)] bg-white text-xs font-mono outline-none focus:border-black resize-none"
                        autoFocus
                    />

                    {/* Live Parser Feedback */}
                    {text.trim() && (
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3 font-mono text-xs space-y-1.5">
                            <div className="text-[10px] font-bold uppercase text-[oklch(52%_0.16_28)]">
                                ผลการวิเคราะห์ข้อมูลสด:
                            </div>
                            <div className="text-[oklch(18%_0.012_28)]">
                                <strong>ชื่อเมนู:</strong> {parsed.name} | <strong>ขนาดแก้ว:</strong> {parsed.glassSizeOz} oz
                            </div>
                            <div className="text-[oklch(42%_0.010_28)]">
                                ตรวจพบ <strong>{parsed.ingredients.length}</strong> วัตถุดิบ | <strong>{parsed.steps.length}</strong> ขั้นตอน
                                {parsed.sweetnessMatrix && ' | ตรวจพบสัดส่วนความหวานเฉพาะ'}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3 border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-end gap-2 font-mono text-xs">
                    <button onClick={onClose} className="px-3 py-2 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(42%_0.010_28)] font-bold uppercase">
                        ยกเลิก
                    </button>
                    <button onClick={handleConfirm} disabled={!text.trim()} className="px-4 py-2 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold uppercase hover:bg-black disabled:opacity-40">
                        นำเข้าข้อมูลสูตร
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Quick-View Slide Drawer (ดูสูตรด่วน & ปรับแก้จากหน้ารายการ) ──
function QuickViewDrawer({ recipe, onClose, onEditFull, onDuplicate, onExportPdf, onSaveQuick }) {
    const [selectedSweetness, setSelectedSweetness] = useState('100%');
    const [inlineQty, setInlineQty] = useState(() => 
        (recipe?.ingredients || []).reduce((acc, ing, idx) => ({ ...acc, [idx]: ing.qty }), {})
    );
    const [isSaving, setIsSaving] = useState(false);

    if (!recipe) return null;

    const handleInlineSave = async () => {
        setIsSaving(true);
        const updatedIngredients = (recipe.ingredients || []).map((ing, idx) => ({
            ...ing,
            qty: inlineQty[idx] !== undefined ? parseFloat(inlineQty[idx]) : ing.qty
        }));
        await onSaveQuick({ ...recipe, ingredients: updatedIngredients });
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-y-0 right-0 z-[80] w-full max-w-md bg-[oklch(98%_0.004_28)] border-l border-[oklch(85%_0.012_28)] shadow-2xl flex flex-col font-sans">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-between items-center">
                <div>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                        QUICK RECIPE DRAWER
                    </span>
                    <h3 className="font-mono text-sm font-bold uppercase text-[oklch(18%_0.012_28)] truncate max-w-[260px]">
                        {recipe.name}
                    </h3>
                </div>
                <button onClick={onClose} className="p-1 text-[oklch(55%_0.010_28)] hover:text-black">
                    <X size={18} />
                </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
                {/* Meta stats */}
                <div className="grid grid-cols-3 border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)] bg-white font-mono text-center">
                    <div className="p-2">
                        <span className="block text-[8px] text-[oklch(55%_0.010_28)] uppercase">หมวดหมู่</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">{recipe.category?.label || 'ทั่วไป'}</span>
                    </div>
                    <div className="p-2">
                        <span className="block text-[8px] text-[oklch(55%_0.010_28)] uppercase">แก้วฐาน</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">{recipe.base_glass_size_oz || 16} oz</span>
                    </div>
                    <div className="p-2">
                        <span className="block text-[8px] text-[oklch(55%_0.010_28)] uppercase">ขั้นตอน</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">{(recipe.steps || []).length} steps</span>
                    </div>
                </div>

                {/* Sweetness Selector */}
                <div>
                    <div className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1.5">
                        ทดลองสเกลระดับความหวาน (Sweetness Test):
                    </div>
                    <div className="grid grid-cols-4 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] divide-x divide-[oklch(85%_0.012_28)] font-mono text-[11px] text-center">
                        {['0%', '50%', '100%', '120%'].map(lvl => (
                            <button
                                key={lvl}
                                type="button"
                                onClick={() => setSelectedSweetness(lvl)}
                                className={`py-1.5 font-bold transition-colors ${
                                    selectedSweetness === lvl 
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' 
                                        : 'hover:bg-[oklch(90%_0.012_28)] text-[oklch(42%_0.010_28)]'
                                }`}
                            >
                                {lvl === '0%' ? 'ไม่หวาน' : lvl === '50%' ? '50%' : lvl === '100%' ? 'ปกติ' : '120%'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ingredients with Inline Adjust */}
                <div className="border border-[oklch(85%_0.012_28)] bg-white">
                    <div className="p-2 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] font-mono text-[10px] font-bold uppercase text-[oklch(18%_0.012_28)] flex justify-between">
                        <span>ส่วนผสม (ปรับตัวเลขได้ทันที)</span>
                        <span>{recipe.ingredients?.length || 0} รายการ</span>
                    </div>
                    <div className="divide-y divide-[oklch(90%_0.008_28)] p-1">
                        {(recipe.ingredients || []).map((ing, idx) => (
                            <div key={idx} className="p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-xs text-[oklch(18%_0.012_28)] truncate">{ing.name}</div>
                                    {ing.is_sweetener && (
                                        <span className="font-mono text-[8px] font-bold text-[oklch(52%_0.16_28)] uppercase">[SWEETENER]</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <input 
                                        type="number"
                                        value={inlineQty[idx] !== undefined ? inlineQty[idx] : ing.qty}
                                        onChange={e => setInlineQty({ ...inlineQty, [idx]: e.target.value })}
                                        className="w-16 p-1 border border-[oklch(85%_0.012_28)] text-center font-mono font-bold text-xs bg-white focus:border-black outline-none"
                                    />
                                    <span className="font-mono text-[10px] text-[oklch(42%_0.010_28)] w-8 text-left">{ing.unit}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-2 border-t border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] flex justify-end">
                        <button
                            type="button"
                            onClick={handleInlineSave}
                            disabled={isSaving}
                            className="px-3 py-1 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-[10px] font-bold uppercase hover:bg-black disabled:opacity-50"
                        >
                            {isSaving ? 'กำลังบันทึก...' : 'บันทึกตัวเลขที่ปรับ'}
                        </button>
                    </div>
                </div>

                {/* Steps Glance */}
                <div className="border border-[oklch(85%_0.012_28)] bg-white p-3 space-y-2">
                    <span className="font-mono text-[10px] font-bold uppercase text-[oklch(55%_0.010_28)] block">
                        ลำดับขั้นตอนการชงย่อ:
                    </span>
                    <ol className="space-y-1.5 font-mono text-[11px] text-[oklch(18%_0.012_28)]">
                        {(recipe.steps || []).map((s, idx) => (
                            <li key={idx} className="flex gap-2">
                                <span className="font-bold text-[oklch(55%_0.010_28)]">{idx + 1}.</span>
                                <span>{s.instruction || s.title}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>

            {/* Drawer Actions */}
            <div className="p-3 border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex gap-2 font-mono text-xs">
                <button
                    type="button"
                    onClick={() => onExportPdf(recipe.id)}
                    className="flex-1 py-2 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(18%_0.012_28)] font-bold uppercase hover:bg-[oklch(90%_0.012_28)] flex items-center justify-center gap-1.5"
                >
                    <Download size={13} />
                    <span>EXPORT PDF</span>
                </button>
                <button
                    type="button"
                    onClick={() => onDuplicate(recipe.id)}
                    className="flex-1 py-2 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(18%_0.012_28)] font-bold uppercase hover:bg-[oklch(90%_0.012_28)] flex items-center justify-center gap-1.5"
                >
                    <Copy size={13} />
                    <span>โคลนสูตร</span>
                </button>
                <button
                    type="button"
                    onClick={() => onEditFull(recipe)}
                    className="flex-1 py-2 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold uppercase hover:bg-black flex items-center justify-center gap-1.5"
                >
                    <Edit2 size={13} />
                    <span>แก้ไขเต็ม</span>
                </button>
            </div>
        </div>
    );
}

// ── Import from Recipe Lab Modal ──
function ImportModal({ onClose, onImport }) {
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            const [{ data: menus }, { data: stocks }] = await Promise.all([
                supabase.from('menu_items').select('id, name, price').order('name'),
                supabase.from('stock_items').select('id, name').eq('is_base_recipe', true).order('name')
            ]);
            setItems([
                ...(menus || []).map(m => ({ ...m, type: 'menu' })),
                ...(stocks || []).map(s => ({ ...s, type: 'stock' }))
            ]);
            setLoading(false);
        };
        fetch();
    }, []);

    const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] rounded-xs w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
                <div className="p-4 border-b border-[oklch(85%_0.012_28)] flex justify-between items-center bg-[oklch(94%_0.010_28)]">
                    <h3 className="font-mono font-bold text-sm uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                        IMPORT จาก RECIPE LAB / เมนู
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-[oklch(90%_0.012_28)] text-[oklch(55%_0.010_28)]"><X size={16} /></button>
                </div>
                <div className="p-3 border-b border-[oklch(85%_0.012_28)]">
                    <input 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder="ค้นหาเมนูหรือเบส..." 
                        className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs outline-none focus:border-black font-mono" 
                        autoFocus 
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? <div className="text-center py-8 font-mono text-xs text-[oklch(55%_0.010_28)]">Loading...</div> :
                    filtered.length === 0 ? <div className="text-center py-8 font-mono text-xs text-[oklch(55%_0.010_28)]">ไม่พบข้อมูล</div> :
                    filtered.map(item => (
                        <button 
                            key={item.type + item.id} 
                            onClick={() => onImport(item.id, item.type)} 
                            className="w-full p-2.5 hover:bg-[oklch(94%_0.010_28)] text-left flex justify-between items-center border border-transparent hover:border-[oklch(85%_0.012_28)] font-sans"
                        >
                            <div>
                                <div className="font-bold text-xs text-[oklch(18%_0.012_28)] flex items-center gap-2">
                                    {item.type === 'stock' && <span className="px-1.5 py-0.2 bg-[oklch(92%_0.015_28)] text-[oklch(18%_0.012_28)] text-[9px] font-mono font-bold">BASE</span>}
                                    {item.name}
                                </div>
                                <div className="text-[10px] text-[oklch(55%_0.010_28)] font-mono mt-0.5">{item.type === 'menu' ? 'Menu Item' : 'Stock Recipe'}</div>
                            </div>
                            <Download size={14} className="text-[oklch(55%_0.010_28)]" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Main SOPEditorPage (Dieter Rams Single-Scroll Layout with Simplicity Controls) ──
export default function SOPEditorPage({ isEmbedded = false }) {
    const { 
        recipes, 
        categories, 
        glassSizes, 
        loading, 
        activeCategory, 
        setActiveCategory, 
        searchQuery, 
        setSearchQuery, 
        fetchRecipes, 
        saveSOPRecipe, 
        duplicateSOPRecipe,
        deleteSOPRecipe, 
        saveCategory, 
        deleteCategory, 
        scaleIngredients, 
        fetchRecipeLabSummary, 
        refresh 
    } = useBarSOP({ department: 'bar', staffMode: false });

    const [editing, setEditing] = useState(null);
    const [editorMode, setEditorMode] = useState('simple'); // 'simple' | 'pro'
    const [showImport, setShowImport] = useState(false);
    const [showQuickPaste, setShowQuickPaste] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Quick-View Drawer & Export Modal state
    const [drawerRecipe, setDrawerRecipe] = useState(null);
    const [exportModalConfig, setExportModalConfig] = useState({ isOpen: false, recipeId: null });

    const [expandedStepIndex, setExpandedStepIndex] = useState(0);
    const [activeAnchor, setActiveAnchor] = useState('basic');

    // ── Create new empty recipe ──
    const handleNew = () => {
        setEditing({
            name: '', name_en: '', category_id: categories[0]?.id || '', department: 'bar',
            base_glass_size_oz: 16, ingredients: [], steps: [],
            scaling_rules: { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 },
            garnish: '', notes: '', is_published: true, sort_order: 0,
            advanced_details: { 
                equipment: [], 
                qc_standards: [], 
                troubleshooting: [], 
                shelf_life: [], 
                checklist: [],
                sweetness_matrix: { mode: 'auto', levels: {} }
            }
        });
        setEditorMode('simple');
        setExpandedStepIndex(0);
        setActiveAnchor('basic');
    };

    // ── Apply Quick Paste parsed recipe ──
    const handleApplyQuickPaste = (parsed) => {
        setEditing({
            name: parsed.name,
            name_en: '',
            category_id: categories[0]?.id || '',
            department: 'bar',
            base_glass_size_oz: parsed.glassSizeOz || 16,
            ingredients: parsed.ingredients,
            steps: parsed.steps,
            scaling_rules: { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 },
            garnish: '',
            notes: parsed.notes || '',
            is_published: true,
            sort_order: 0,
            advanced_details: {
                equipment: [],
                qc_standards: [],
                troubleshooting: [],
                shelf_life: [],
                checklist: [],
                sweetness_matrix: parsed.sweetnessMatrix || { mode: 'auto', levels: {} }
            }
        });
        setEditorMode('simple');
        setExpandedStepIndex(0);
    };

    // ── Load Starter Template ──
    const handleApplyStarterTemplate = (templateId) => {
        const tmpl = BEVERAGE_STARTER_TEMPLATES.find(t => t.id === templateId);
        if (!tmpl) return;

        if (confirm(`ต้องการใช้เทมเพลตขั้นตอนสำหรับ "${tmpl.name}" หรือไม่? ขั้นตอนเดิมจะถูกแทนที่`)) {
            setEditing(prev => ({
                ...prev,
                steps: tmpl.steps.map(s => ({ ...s }))
            }));
            toast.success(`โหลดขั้นตอนจาก ${tmpl.name} เรียบร้อย`);
        }
    };

    const isCustomMode = editing?.scaling_rules?._mode === 'custom';

    const toggleCustomMode = (toCustom) => {
        if (toCustom) {
            setEditing({
                ...editing,
                scaling_rules: {
                    _mode: 'custom',
                    presets: [{ name: '1 ถัง', multiplier: 1, isBase: true }]
                }
            });
        } else {
            setEditing({
                ...editing,
                scaling_rules: { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 },
                base_glass_size_oz: 16
            });
        }
    };

    // ── Save ──
    const handleSave = async () => {
        if (!editing.name.trim()) { toast.error('กรุณาใส่ชื่อ SOP'); return; }

        setSaving(true);
        const result = await saveSOPRecipe(editing);
        setSaving(false);
        if (result) {
            setEditing(null);
            fetchRecipes(activeCategory);
        }
    };

    // ── Link/Import from Recipe Lab ──
    const handleLink = async (sourceId, sourceType) => {
        const linkedIngs = await fetchRecipeLabSummary(sourceId, sourceType);
        
        setEditing(prev => {
            const currentManuals = (prev.ingredients || []).filter(i => !i.isLinked);
            const freshLinked = linkedIngs.map(i => ({
                ...i,
                isLinked: true
            }));
            
            return {
                ...prev,
                source_menu_item_id: sourceType === 'menu' ? sourceId : null,
                source_stock_item_id: sourceType === 'stock' ? sourceId : null,
                ingredients: [...freshLinked, ...currentManuals]
            };
        });
        
        setShowImport(false);
        toast.success('เชื่อมโยงส่วนผสมจาก Recipe Lab เรียบร้อย');
    };

    // ── Duplicate Recipe (1-Click) ──
    const handleDuplicateRecipe = async (recipeId) => {
        const cloned = await duplicateSOPRecipe(recipeId);
        if (cloned) {
            setDrawerRecipe(null);
        }
    };

    // ── Ingredient CRUD Handlers ──
    const addIngredient = () => setEditing(prev => ({ ...prev, ingredients: [...(prev.ingredients || []), { name: '', qty: 0, unit: 'ml', scalable: true, is_sweetener: false }] }));
    const updateIngredient = (i, val) => setEditing(prev => ({ ...prev, ingredients: prev.ingredients.map((ing, idx) => idx === i ? val : ing) }));
    const deleteIngredient = (i) => setEditing(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, idx) => idx !== i) }));

    // ── Step CRUD Handlers ──
    const addStep = () => {
        setEditing(prev => {
            const newSteps = [...(prev.steps || []), { order: (prev.steps?.length || 0) + 1, action: 'pour', title: '', instruction: '', duration_sec: null }];
            setExpandedStepIndex(newSteps.length - 1);
            return { ...prev, steps: newSteps };
        });
    };
    const updateStep = (i, val) => setEditing(prev => ({ ...prev, steps: prev.steps.map((s, idx) => idx === i ? val : s) }));
    const deleteStep = (i) => setEditing(prev => ({ ...prev, steps: prev.steps.filter((_, idx) => idx !== i) }));
    const moveStep = (i, dir) => {
        setEditing(prev => {
            const arr = [...prev.steps];
            const j = i + dir;
            if (j < 0 || j >= arr.length) return prev;
            [arr[i], arr[j]] = [arr[j], arr[i]];
            if (expandedStepIndex === i) setExpandedStepIndex(j);
            else if (expandedStepIndex === j) setExpandedStepIndex(i);
            return { ...prev, steps: arr };
        });
    };

    // Smooth Scroll Helper
    const scrollToSection = (id) => {
        setActiveAnchor(id);
        const el = document.getElementById(`sec-${id}`);
        if (el) {
            const offset = 120;
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = el.getBoundingClientRect().top;
            const offsetPosition = elementRect - bodyRect - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    const sweetenersList = (editing?.ingredients || []).filter(i => i.is_sweetener);

    // ── Auto-Fill Sweetness Matrix ──
    const handleAutoFillSweetness = () => {
        if (sweetenersList.length === 0) {
            toast.error('กรุณาติ๊กส่วนผสมที่เป็นสารหวานอย่างน้อย 1 รายการก่อน');
            return;
        }

        const newLevels = {};
        sweetenersList.forEach(sw => {
            newLevels[sw.name] = {
                none: 0,
                less: Math.round(sw.qty * 0.5 * 10) / 10,
                normal: sw.qty,
                extra: Math.round(sw.qty * 1.2 * 10) / 10
            };
        });

        setEditing(prev => ({
            ...prev,
            advanced_details: {
                ...prev.advanced_details,
                sweetness_matrix: {
                    mode: 'custom',
                    levels: newLevels
                }
            }
        }));
        toast.success('คำนวณระดับความหวาน 0/50/100/120% อัตโนมัติเรียบร้อย');
    };

    // ── LIST VIEW ──
    if (!editing) {
        return (
            <div className={`font-sans text-[oklch(18%_0.012_28)] ${isEmbedded ? '' : 'min-h-screen bg-[oklch(97%_0.008_28)]'}`}>
                {/* Header Actions Bar (Dieter Rams Cellular Layout) */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-[oklch(85%_0.012_28)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                                S.O.P. MANAGEMENT BENCH
                            </span>
                        </div>
                        <h1 className="text-xl font-bold font-mono uppercase tracking-tight text-[oklch(18%_0.012_28)] mt-0.5">
                            Kitchen & Bar SOP Recipes
                        </h1>
                        <p className="text-xs text-[oklch(55%_0.010_28)] font-mono">
                            สูตรมาตรฐาน ระดับความหวาน และขั้นตอนการเตรียมพร้อมระบบส่งออกคู่มือ
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto font-mono text-xs">
                        <button 
                            onClick={() => setShowQuickPaste(true)} 
                            className="px-3 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] font-bold uppercase flex items-center gap-1.5 transition-colors"
                            title="วางข้อความจาก LINE เพื่อสร้างสูตรทันที"
                        >
                            <FileText size={13} />
                            <span>QUICK PASTE</span>
                        </button>

                        <button 
                            onClick={() => setExportModalConfig({ isOpen: true, recipeId: null })}
                            className="px-3 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] font-bold uppercase flex items-center gap-1.5 transition-colors"
                            title="ส่งออกคู่มือ SOP เป็นเอกสาร PDF"
                        >
                            <BookOpen size={13} />
                            <span>EXPORT PDF</span>
                        </button>

                        <button 
                            onClick={() => setShowCategoryManager(true)} 
                            className="p-2 hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] bg-white text-[oklch(42%_0.010_28)]" 
                            title="จัดการหมวดหมู่"
                        >
                            <Settings size={15} />
                        </button>

                        <button 
                            onClick={refresh} 
                            className="p-2 hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] bg-white text-[oklch(42%_0.010_28)]"
                            title="รีเฟรชข้อมูล"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>

                        <button 
                            onClick={handleNew} 
                            className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-3.5 py-2 font-bold uppercase flex items-center gap-1.5 hover:bg-black transition-colors shadow-sm"
                        >
                            <Plus size={14} /> 
                            <span>NEW SOP</span>
                        </button>
                    </div>
                </div>

                {/* Category Switcher Tabs */}
                <div 
                    className="flex overflow-x-auto pb-0 gap-3 border-b border-[oklch(85%_0.012_28)] no-scrollbar font-mono text-xs mb-4"
                >
                    <button 
                        onClick={() => setActiveCategory(null)} 
                        className={`pb-2.5 pt-1 whitespace-nowrap font-bold border-b-2 transition-colors uppercase ${
                            !activeCategory 
                                ? 'border-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)]' 
                                : 'border-transparent text-[oklch(55%_0.010_28)] hover:text-black'
                        }`}
                    >
                        [ทั้งหมด ({recipes.length})]
                    </button>
                    {categories.map(cat => {
                        const count = recipes.filter(r => r.category_id === cat.id || r.category?.id === cat.id).length;
                        return (
                            <button 
                                key={cat.id} 
                                onClick={() => setActiveCategory(cat.id)} 
                                className={`pb-2.5 pt-1 whitespace-nowrap font-bold border-b-2 transition-colors uppercase ${
                                    activeCategory === cat.id 
                                        ? 'border-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)]' 
                                        : 'border-transparent text-[oklch(55%_0.010_28)] hover:text-black'
                                }`}
                            >
                                [{cat.label} ({count})]
                            </button>
                        );
                    })}
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[oklch(55%_0.010_28)]" />
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อเมนู, ชื่ออังกฤษ, หรือวัตถุดิบ..."
                        value={searchQuery || ''}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-9 py-2.5 bg-white border border-[oklch(85%_0.012_28)] text-xs font-mono outline-none focus:border-black transition-all"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)] hover:text-black">
                            <X size={15} />
                        </button>
                    )}
                </div>

                {/* Recipe Ledger List */}
                {loading ? (
                    <div className="space-y-2 font-mono text-xs">
                        {[1,2,3,4].map(i => <div key={i} className="h-14 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] animate-pulse" />)}
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="text-center py-16 text-[oklch(55%_0.010_28)] border border-dashed border-[oklch(85%_0.012_28)] bg-white">
                        <p className="text-xs font-mono uppercase tracking-wider mb-2">ยังไม่มีสูตร SOP ในหมวดหมู่นี้</p>
                        <div className="flex justify-center gap-3">
                            <button onClick={() => setShowQuickPaste(true)} className="text-black font-bold text-xs hover:underline font-mono">[QUICK PASTE นำเข้า]</button>
                            <span>•</span>
                            <button onClick={handleNew} className="text-black font-bold text-xs hover:underline font-mono">[+ สร้าง SOP ใหม่]</button>
                        </div>
                    </div>
                ) : (
                    <div className="border border-[oklch(85%_0.012_28)] bg-white divide-y divide-[oklch(90%_0.008_28)]">
                        {recipes.map(recipe => (
                            <div 
                                key={recipe.id} 
                                onClick={() => setDrawerRecipe(recipe)}
                                className="p-3.5 flex items-center justify-between gap-4 hover:bg-[oklch(98%_0.004_28)] transition-colors cursor-pointer group"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="font-mono text-[10px] font-bold px-2 py-1 bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] uppercase flex-shrink-0">
                                        {recipe.category?.label || 'BAR'}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-sm tracking-tight text-[oklch(18%_0.012_28)] truncate">
                                                {recipe.name}
                                            </h3>
                                            {recipe.name_en && (
                                                <span className="text-[11px] font-mono text-[oklch(55%_0.010_28)] hidden sm:inline truncate">
                                                    ({recipe.name_en})
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                                            <span>{recipe.base_glass_size_oz || 16}oz</span>
                                            <span>•</span>
                                            <span>{(recipe.ingredients || []).length} ings</span>
                                            <span>•</span>
                                            <span>{(recipe.steps || []).length} steps</span>
                                            {recipe.advanced_details?.sweetness_matrix && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-[oklch(52%_0.16_28)] font-bold">[SWEETNESS MATRIX]</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                    <span className={`px-2 py-0.5 text-[9px] font-mono font-bold border ${
                                        recipe.is_published 
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                            : 'bg-gray-50 text-gray-500 border-gray-200'
                                    }`}>
                                        {recipe.is_published ? 'PUBLISHED' : 'DRAFT'}
                                    </span>

                                    <button 
                                        type="button"
                                        onClick={() => setExportModalConfig({ isOpen: true, recipeId: recipe.id })}
                                        className="p-2 text-[oklch(55%_0.010_28)] hover:text-black hover:bg-[oklch(94%_0.010_28)] rounded transition-colors"
                                        title="พิมพ์คู่มือสูตรนี้ (A4 PDF)"
                                    >
                                        <Download size={15} />
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={() => handleDuplicateRecipe(recipe.id)}
                                        className="p-2 text-[oklch(55%_0.010_28)] hover:text-black hover:bg-[oklch(94%_0.010_28)] rounded transition-colors"
                                        title="โคลนสูตรนี้ (Duplicate)"
                                    >
                                        <Copy size={15} />
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={() => setEditing({ ...recipe })} 
                                        className="p-2 text-[oklch(55%_0.010_28)] hover:text-black hover:bg-[oklch(94%_0.010_28)] rounded transition-colors"
                                        title="แก้ไขสูตร"
                                    >
                                        <Edit2 size={15} />
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={async () => { 
                                            if (confirm(`ลบสูตร SOP "${recipe.name}" หรือไม่?`)) { 
                                                await deleteSOPRecipe(recipe.id); 
                                                fetchRecipes(activeCategory); 
                                            }
                                        }} 
                                        className="p-2 text-[oklch(55%_0.010_28)] hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                        title="ลบสูตร"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modals & Drawers */}
                {drawerRecipe && (
                    <QuickViewDrawer 
                        key={drawerRecipe.id}
                        recipe={drawerRecipe}
                        onClose={() => setDrawerRecipe(null)}
                        onEditFull={(rec) => { setDrawerRecipe(null); setEditing({ ...rec }); }}
                        onDuplicate={handleDuplicateRecipe}
                        onExportPdf={(id) => { setExportModalConfig({ isOpen: true, recipeId: id }); }}
                        onSaveQuick={async (updatedRec) => {
                            await saveSOPRecipe(updatedRec);
                            await fetchRecipes(activeCategory);
                            setDrawerRecipe(updatedRec);
                        }}
                    />
                )}

                {showQuickPaste && (
                    <QuickPasteModal 
                        onClose={() => setShowQuickPaste(false)} 
                        onApply={handleApplyQuickPaste} 
                    />
                )}

                {showCategoryManager && (
                    <SOPCategoryManager 
                        categories={categories} 
                        onSave={saveCategory} 
                        onDelete={deleteCategory} 
                        onClose={() => setShowCategoryManager(false)} 
                    />
                )}

                {exportModalConfig.isOpen && (
                    <SOPExportModal 
                        isOpen={exportModalConfig.isOpen}
                        onClose={() => setExportModalConfig({ isOpen: false, recipeId: null })}
                        recipes={recipes}
                        categories={categories}
                        activeCategory={activeCategory}
                        department="bar"
                        initialSelectedRecipeId={exportModalConfig.recipeId}
                    />
                )}
            </div>
        );
    }

    // ── EDIT VIEW (Dieter Rams Single-Scroll with Simplicity Mode Switcher) ──
    return (
        <div className="font-sans text-[oklch(18%_0.012_28)] pb-24">
            {/* Top Editor Bar (Tabular Grid) */}
            <div className="border-b border-[oklch(85%_0.012_28)] pb-3 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setEditing(null)} 
                        className="px-2.5 py-1.5 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(42%_0.010_28)] hover:text-black font-mono text-xs font-bold uppercase flex items-center gap-1"
                    >
                        <ArrowLeft size={13} />
                        <span>กลับหน้ารายการ</span>
                    </button>
                    <div>
                        <span className="font-mono text-[9px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block">
                            RECIPE WORKBENCH
                        </span>
                        <h2 className="font-mono text-base font-bold uppercase text-[oklch(18%_0.012_28)]">
                            {editing.id ? `แก้ไข: ${editing.name}` : 'สร้างสูตร SOP ใหม่'}
                        </h2>
                    </div>
                </div>

                {/* Right controls: Mode Toggle & Save */}
                <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto font-mono text-xs">
                    {/* Simple vs Pro Mode Switcher */}
                    <div className="flex border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] divide-x divide-[oklch(85%_0.012_28)]">
                        <button 
                            type="button"
                            onClick={() => setEditorMode('simple')} 
                            className={`px-3 py-1.5 font-bold uppercase transition-colors ${
                                editorMode === 'simple' 
                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' 
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            SIMPLE (เรียบง่าย)
                        </button>
                        <button 
                            type="button"
                            onClick={() => setEditorMode('pro')} 
                            className={`px-3 py-1.5 font-bold uppercase transition-colors ${
                                editorMode === 'pro' 
                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' 
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            PRO (เจาะลึก QC)
                        </button>
                    </div>

                    <button 
                        type="button"
                        onClick={() => setShowPreview(!showPreview)} 
                        className={`px-3 py-1.5 border border-[oklch(85%_0.012_28)] font-bold uppercase transition-colors flex items-center gap-1 ${
                            showPreview 
                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' 
                                : 'bg-white text-[oklch(42%_0.010_28)] hover:text-black'
                        }`}
                    >
                        {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>PREVIEW</span>
                    </button>

                    <button 
                        type="button"
                        onClick={handleSave} 
                        disabled={saving} 
                        className="px-4 py-1.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold uppercase hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                        <Save size={13} />
                        <span>{saving ? 'กำลังบันทึก...' : 'บันทึก SOP'}</span>
                    </button>
                </div>
            </div>

            {/* Anchors Bar (Only in Pro Mode) */}
            {editorMode === 'pro' && (
                <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-1.5 mb-5 flex gap-2 overflow-x-auto no-scrollbar font-mono text-xs">
                    {[
                        { id: 'basic', label: '01 / ข้อมูลทั่วไป' },
                        { id: 'scaling', label: '02 / สเกล & ขนาด' },
                        { id: 'ingredients', label: '03 / ส่วนผสม & ความหวาน' },
                        { id: 'steps', label: '04 / ขั้นตอนการทำ' },
                        { id: 'pro', label: '05 / QC & มาตรฐาน' }
                    ].map(item => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => scrollToSection(item.id)}
                            className={`px-3 py-1 font-bold whitespace-nowrap transition-colors ${
                                activeAnchor === item.id 
                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' 
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="space-y-6">
                {/* Live Preview Box */}
                {showPreview && (
                    <div className="bg-[oklch(18%_0.012_28)] p-4 rounded-xs border border-[oklch(30%_0.015_28)] shadow-2xl">
                        <div className="text-[10px] text-[oklch(70%_0.010_28)] font-mono uppercase tracking-wider mb-3 px-1 border-b border-[oklch(30%_0.015_28)] pb-1 flex justify-between items-center">
                            <span>SIMULATION: SOP RECIPE VIEWER SCREEN</span>
                            <span className="text-emerald-400 font-bold">[LIVE PREVIEW]</span>
                        </div>
                        <SOPRecipeCard 
                            recipe={{ 
                                ...editing, 
                                category: categories.find(c => c.id === editing.category_id),
                                display_ingredients: editing.ingredients || []
                            }} 
                            glassSizes={glassSizes} 
                            scaleIngredients={scaleIngredients} 
                            darkMode={true} 
                            defaultExpanded={true} 
                        />
                    </div>
                )}

                {/* ── SECTION 1: ข้อมูลทั่วไป (General Info) ── */}
                <section id="sec-basic" className="bg-white p-5 rounded-xs border border-[oklch(85%_0.012_28)] space-y-4">
                    <div className="border-b border-[oklch(90%_0.008_28)] pb-2 flex justify-between items-center">
                        <h3 className="text-xs font-mono font-bold text-[oklch(55%_0.010_28)] uppercase tracking-widest">
                            01 / ข้อมูลทั่วไป (GENERAL INFO)
                        </h3>
                        <span className="text-[10px] font-mono text-[oklch(52%_0.16_28)] font-bold">
                            {editorMode === 'simple' ? '[SIMPLE MODE]' : '[PRO MODE]'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                            <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">
                                ชื่อเมนู (ภาษาไทย) *
                            </label>
                            <input 
                                value={editing.name} 
                                onChange={e => setEditing({ ...editing, name: e.target.value })} 
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] text-xs font-bold focus:border-black outline-none" 
                                placeholder="เช่น มัทฉะลาเต้เย็น" 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">
                                ชื่อเมนู (EN / optional)
                            </label>
                            <input 
                                value={editing.name_en || ''} 
                                onChange={e => setEditing({ ...editing, name_en: e.target.value })} 
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] text-xs font-mono focus:border-black outline-none" 
                                placeholder="e.g. Iced Matcha Latte" 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">
                                หมวดหมู่สูตร SOP
                            </label>
                            <select 
                                value={editing.category_id || ''} 
                                onChange={e => setEditing({ ...editing, category_id: e.target.value })} 
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs font-mono focus:border-black outline-none"
                            >
                                <option value="">-- เลือกหมวดหมู่ --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                        {!isCustomMode && (
                            <div>
                                <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">
                                    ขนาดแก้วมาตรฐาน (Base Glass Size)
                                </label>
                                <select 
                                    value={editing.base_glass_size_oz} 
                                    onChange={e => setEditing({ ...editing, base_glass_size_oz: parseInt(e.target.value, 10) })} 
                                    className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs font-mono font-bold focus:border-black outline-none"
                                >
                                    {glassSizes.map(gs => <option key={gs.id} value={gs.size_oz}>{gs.size_oz} oz ({gs.name || gs.label})</option>)}
                                    <option value="16">16 oz (Default)</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">
                                เวลาสกัด/เตรียม (Prep Time)
                            </label>
                            <input 
                                value={editing.advanced_details?.prep_time || ''} 
                                onChange={e => setEditing({ ...editing, advanced_details: { ...editing.advanced_details, prep_time: e.target.value }})} 
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] text-xs font-mono focus:border-black outline-none" 
                                placeholder="เช่น 2-3 นาที" 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-mono font-bold text-[oklch(55%_0.010_28)] uppercase block mb-1">
                                ระดับน้ำแข็งมาตรฐาน (Ice Level)
                            </label>
                            <input 
                                value={editing.advanced_details?.ice_level || ''} 
                                onChange={e => setEditing({ ...editing, advanced_details: { ...editing.advanced_details, ice_level: e.target.value }})} 
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] text-xs font-mono focus:border-black outline-none" 
                                placeholder="เช่น เต็มแก้ว 100%" 
                            />
                        </div>
                    </div>
                </section>

                {/* ── SECTION 2: สเกลและขนาด (Scaling Rules) - Shown in PRO Mode ── */}
                {editorMode === 'pro' && (
                    <section id="sec-scaling" className="bg-white p-5 rounded-xs border border-[oklch(85%_0.012_28)] space-y-4">
                        <div className="border-b border-[oklch(90%_0.008_28)] pb-2 flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-mono font-bold text-[oklch(55%_0.010_28)] uppercase tracking-widest">
                                    02 / การปรับสเกล & ล็อตใหญ่ (SCALING RULES)
                                </h3>
                            </div>
                            <div className="flex border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                                <button type="button" onClick={() => toggleCustomMode(false)} className={`px-2.5 py-1 text-[10px] font-mono font-bold ${!isCustomMode ? 'bg-[oklch(18%_0.012_28)] text-white' : 'text-[oklch(42%_0.010_28)]'}`}>แก้ว (OZ)</button>
                                <button type="button" onClick={() => toggleCustomMode(true)} className={`px-2.5 py-1 text-[10px] font-mono font-bold ${isCustomMode ? 'bg-[oklch(18%_0.012_28)] text-white' : 'text-[oklch(42%_0.010_28)]'}`}>เบส (CUSTOM)</button>
                            </div>
                        </div>

                        {isCustomMode ? (
                            <div className="space-y-2.5">
                                {(editing.scaling_rules?.presets || []).map((preset, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)]">
                                        <input 
                                            value={preset.name} 
                                            onChange={e => {
                                                const newPresets = [...editing.scaling_rules.presets];
                                                newPresets[idx].name = e.target.value;
                                                setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, presets: newPresets } });
                                            }}
                                            placeholder="ชื่อปุ่ม (เช่น 1.5 ลิตร)"
                                            className="flex-1 p-1.5 border border-[oklch(85%_0.012_28)] text-xs font-bold bg-white"
                                        />
                                        <div className="flex items-center gap-1 bg-white px-2 py-1 border border-[oklch(85%_0.012_28)]">
                                            <span className="text-[9px] font-mono font-bold text-[oklch(55%_0.010_28)]">MULTIPLIER</span>
                                            <input 
                                                type="number" step="0.01"
                                                value={preset.multiplier}
                                                onChange={e => {
                                                    const newPresets = [...editing.scaling_rules.presets];
                                                    newPresets[idx].multiplier = parseFloat(e.target.value) || 1;
                                                    setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, presets: newPresets } });
                                                }}
                                                className={`w-14 text-center font-mono font-bold text-xs outline-none ${preset.isBase ? 'text-[oklch(55%_0.010_28)]' : 'text-black'}`}
                                                disabled={preset.isBase}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-[oklch(55%_0.010_28)] font-mono">เลือกขนาดแก้วที่จำหน่ายสำหรับเมนูนี้ (ระบบคำนวณสเกลให้อัตโนมัติ):</p>
                                <div className="flex flex-wrap gap-2">
                                    {glassSizes.map(gs => {
                                        const isBase = gs.size_oz === editing.base_glass_size_oz;
                                        const isAvailable = isBase || editing.scaling_rules?.[String(gs.size_oz)] !== undefined;
                                        return (
                                            <button
                                                key={gs.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isBase) return;
                                                    const newRules = { ...editing.scaling_rules };
                                                    if (isAvailable) delete newRules[String(gs.size_oz)];
                                                    else newRules[String(gs.size_oz)] = gs.size_oz / editing.base_glass_size_oz;
                                                    setEditing({ ...editing, scaling_rules: newRules });
                                                }}
                                                className={`px-3 py-2 border font-mono text-left transition-all ${
                                                    isAvailable 
                                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-black' 
                                                        : 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] hover:border-black'
                                                }`}
                                            >
                                                <div className="text-[9px] uppercase">{isBase ? 'STANDARD' : isAvailable ? 'ON SALE' : 'OFF'}</div>
                                                <div className="font-bold text-sm">{gs.size_oz} OZ</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* ── SECTION 3: ส่วนผสมและระดับความหวาน (Ingredients & Sweetness Matrix) ── */}
                <section id="sec-ingredients" className="bg-white p-5 rounded-xs border border-[oklch(85%_0.012_28)] space-y-4">
                    <div className="border-b border-[oklch(90%_0.008_28)] pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <h3 className="text-xs font-mono font-bold text-[oklch(55%_0.010_28)] uppercase tracking-widest">
                                {editorMode === 'simple' ? '02 / รายการส่วนผสม & ความหวาน' : '03 / ส่วนผสม & ความหวาน'}
                            </h3>
                        </div>
                        <div className="flex flex-wrap gap-2 font-mono text-xs">
                            <button 
                                type="button" 
                                onClick={() => setShowQuickPaste(true)}
                                className="px-2.5 py-1 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] font-bold uppercase hover:bg-[oklch(90%_0.012_28)] flex items-center gap-1"
                            >
                                <FileText size={12} />
                                <span>วางข้อความนำเข้า</span>
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setShowImport(true)} 
                                className="px-2.5 py-1 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(18%_0.012_28)] font-bold uppercase hover:bg-[oklch(94%_0.010_28)] flex items-center gap-1"
                            >
                                <Download size={12} />
                                <span>Recipe Lab Link</span>
                            </button>
                        </div>
                    </div>

                    {/* Integrated Ingredients List */}
                    <div className="space-y-2.5">
                        {(editing.ingredients || []).map((ing, i) => (
                            <IngredientRow key={i} ing={ing} index={i} onUpdate={updateIngredient} onDelete={deleteIngredient} />
                        ))}
                        {(editing.ingredients || []).length === 0 && (
                            <div className="text-center py-6 font-mono text-xs text-[oklch(55%_0.010_28)] border border-dashed border-[oklch(85%_0.012_28)] p-4">
                                ยังไม่มีส่วนผสม กรุณากดปุ่มเพิ่มวัตถุดิบ หรือใช้วางข้อความนำเข้าด่วน (Quick Paste)
                            </div>
                        )}
                        <button 
                            type="button" 
                            onClick={addIngredient} 
                            className="w-full py-2.5 border border-dashed border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] font-mono font-bold text-xs text-[oklch(42%_0.010_28)] hover:text-black hover:border-black transition-colors uppercase"
                        >
                            + เพิ่มวัตถุดิบ (ADD INGREDIENT)
                        </button>
                    </div>

                    {/* ── SWEETNESS MATRIX SUB-PANEL ── */}
                    {sweetenersList.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-[oklch(85%_0.012_28)] space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">
                                        SWEETNESS SPECIFICATION MATRIX
                                    </span>
                                    <h4 className="font-mono text-xs font-bold uppercase text-[oklch(18%_0.012_28)]">
                                        ตารางกำหนดปริมาณระดับความหวาน (4 ระดับ)
                                    </h4>
                                </div>

                                <div className="flex items-center gap-2 font-mono text-xs">
                                    <button
                                        type="button"
                                        onClick={() => handleAutoFillSweetness(false)}
                                        className="px-2.5 py-1 bg-[oklch(18%_0.012_28)] text-white text-[11px] font-bold uppercase hover:bg-black transition-colors flex items-center gap-1"
                                    >
                                        <Sparkles size={12} />
                                        <span>คำนวณมาตรฐาน (0/50/100/120%)</span>
                                    </button>
                                </div>
                            </div>

                            <p className="text-xs text-[oklch(42%_0.010_28)] leading-relaxed">
                                ระบุปริมาณสารหวานเจาะจง (ml/g) สำหรับแต่ละระดับความหวาน เพื่อให้บาริสต้าตวงได้ตรงตามมาตรฐานร้าน:
                            </p>

                            <div className="overflow-x-auto border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)]">
                                <table className="w-full text-center font-mono text-xs divide-y divide-[oklch(85%_0.012_28)]">
                                    <thead>
                                        <tr className="bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] text-[11px]">
                                            <th className="p-2 text-left pl-3">สารหวาน</th>
                                            <th className="p-2">ไม่หวาน (0%)</th>
                                            <th className="p-2 text-[oklch(52%_0.16_28)] font-bold">หวานน้อย (50%)</th>
                                            <th className="p-2 bg-[oklch(90%_0.015_28)] text-black font-bold">หวานปกติ (100%)</th>
                                            <th className="p-2">หวานมาก (120%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[oklch(90%_0.008_28)]">
                                        {sweetenersList.map((sw, sIdx) => {
                                            const custom = editing.advanced_details?.sweetness_matrix?.levels?.[sw.name] || {};
                                            const noneVal = custom.none !== undefined ? custom.none : 0;
                                            const lessVal = custom.less !== undefined ? custom.less : Math.round(sw.qty * 0.5 * 10) / 10;
                                            const normVal = custom.normal !== undefined ? custom.normal : sw.qty;
                                            const extraVal = custom.extra !== undefined ? custom.extra : Math.round(sw.qty * 1.2 * 10) / 10;

                                            const updateLevel = (levelKey, newVal) => {
                                                const currentLevels = { ...(editing.advanced_details?.sweetness_matrix?.levels || {}) };
                                                currentLevels[sw.name] = {
                                                    none: noneVal,
                                                    less: lessVal,
                                                    normal: normVal,
                                                    extra: extraVal,
                                                    ...currentLevels[sw.name],
                                                    [levelKey]: parseFloat(newVal) || 0
                                                };
                                                setEditing(prev => ({
                                                    ...prev,
                                                    advanced_details: {
                                                        ...prev.advanced_details,
                                                        sweetness_matrix: {
                                                            mode: 'custom',
                                                            levels: currentLevels
                                                        }
                                                    }
                                                }));
                                            };

                                            return (
                                                <tr key={sIdx} className="hover:bg-white transition-colors">
                                                    <td className="p-2 text-left pl-3 font-sans font-bold text-[oklch(18%_0.012_28)]">
                                                        {sw.name}
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            value={noneVal}
                                                            onChange={e => updateLevel('none', e.target.value)}
                                                            className="w-16 p-1 border border-[oklch(85%_0.012_28)] text-center font-mono text-xs bg-white"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="inline-flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                value={lessVal}
                                                                onChange={e => updateLevel('less', e.target.value)}
                                                                className="w-16 p-1 border border-[oklch(52%_0.16_28)] text-center font-mono font-bold text-xs bg-white text-[oklch(52%_0.16_28)]"
                                                            />
                                                            <button 
                                                                type="button"
                                                                onClick={() => updateLevel('less', Math.max(0, lessVal - 5))}
                                                                className="px-1 py-0.5 border border-[oklch(85%_0.012_28)] text-[9px] hover:bg-gray-100"
                                                                title="ลด 5ml"
                                                            >
                                                                -5
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => updateLevel('less', lessVal + 5)}
                                                                className="px-1 py-0.5 border border-[oklch(85%_0.012_28)] text-[9px] hover:bg-gray-100"
                                                                title="เพิ่ม 5ml"
                                                            >
                                                                +5
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 bg-[oklch(94%_0.010_28)]/50">
                                                        <input
                                                            type="number"
                                                            value={normVal}
                                                            onChange={e => updateLevel('normal', e.target.value)}
                                                            className="w-16 p-1 border border-[oklch(85%_0.012_28)] text-center font-mono font-bold text-xs bg-white"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="inline-flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                value={extraVal}
                                                                onChange={e => updateLevel('extra', e.target.value)}
                                                                className="w-16 p-1 border border-[oklch(85%_0.012_28)] text-center font-mono text-xs bg-white"
                                                            />
                                                            <button 
                                                                type="button"
                                                                onClick={() => updateLevel('extra', Math.max(0, extraVal - 5))}
                                                                className="px-1 py-0.5 border border-[oklch(85%_0.012_28)] text-[9px] hover:bg-gray-100"
                                                            >
                                                                -5
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => updateLevel('extra', extraVal + 5)}
                                                                className="px-1 py-0.5 border border-[oklch(85%_0.012_28)] text-[9px] hover:bg-gray-100"
                                                            >
                                                                +5
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>

                {/* ── SECTION 4: ขั้นตอนการทำ (Steps with Starter Templates) ── */}
                <section id="sec-steps" className="bg-white p-5 rounded-xs border border-[oklch(85%_0.012_28)] space-y-4">
                    <div className="border-b border-[oklch(90%_0.008_28)] pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <h3 className="text-xs font-mono font-bold text-[oklch(55%_0.010_28)] uppercase tracking-widest">
                                {editorMode === 'simple' ? '03 / ขั้นตอนการเตรียมและดำเนินการ' : '04 / ขั้นตอนการเตรียมและดำเนินการ'}
                            </h3>
                        </div>

                        {/* Beverage Starter Templates Selector */}
                        <div className="flex items-center gap-2 font-mono text-xs">
                            <select
                                defaultValue=""
                                onChange={e => {
                                    if (e.target.value) {
                                        handleApplyStarterTemplate(e.target.value);
                                        e.target.value = '';
                                    }
                                }}
                                className="p-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-xs font-mono font-bold outline-none cursor-pointer"
                            >
                                <option value="">[โหลดขั้นตอนจากเทมเพลตมาตรฐาน...]</option>
                                {BEVERAGE_STARTER_TEMPLATES.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        {(editing.steps || []).map((step, i) => (
                            <StepRow 
                                key={i} 
                                step={step} 
                                index={i} 
                                onUpdate={updateStep} 
                                onDelete={deleteStep} 
                                onMove={moveStep} 
                                isLast={i === editing.steps.length - 1} 
                                isExpanded={expandedStepIndex === i}
                                onToggleExpand={() => setExpandedStepIndex(expandedStepIndex === i ? null : i)}
                                availableIngredients={(editing.ingredients || []).map(ing => ing.name)}
                            />
                        ))}
                        {(editing.steps || []).length === 0 && (
                            <div className="text-center py-6 font-mono text-xs text-[oklch(55%_0.010_28)] border border-dashed border-[oklch(85%_0.012_28)] p-4">
                                ยังไม่มีขั้นตอนดำเนินการบันทึก สามารถเลือกเทมเพลตมาตรฐานด้านบนหรือกดเพิ่มขั้นตอนใหม่
                            </div>
                        )}
                        <button 
                            type="button"
                            onClick={addStep} 
                            className="w-full py-2.5 border border-dashed border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] font-mono font-bold text-xs text-[oklch(42%_0.010_28)] hover:text-black hover:border-black transition-colors uppercase"
                        >
                            + เพิ่มขั้นตอนดำเนินการ (ADD STEP)
                        </button>
                    </div>
                </section>

                {/* ── SECTION 5: QC & มาตรฐานคุณภาพ (Shown only in PRO Mode) ── */}
                {editorMode === 'pro' && (
                    <section id="sec-pro" className="bg-white p-5 rounded-xs border border-[oklch(85%_0.012_28)] space-y-6">
                        <div className="border-b border-[oklch(90%_0.008_28)] pb-2 flex justify-between items-center">
                            <h3 className="text-xs font-mono font-bold text-[oklch(55%_0.010_28)] uppercase tracking-widest">
                                05 / มาตรฐานการบริการ & ประกันคุณภาพ (QC)
                            </h3>
                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                ADVANCED SECTION
                            </span>
                        </div>

                        {/* Equipment */}
                        <div className="space-y-2">
                            <label className="text-xs font-mono font-bold text-[oklch(55%_0.010_28)] block">
                                อุปกรณ์เฉพาะ (Required Equipment)
                            </label>
                            <textarea
                                value={Array.isArray(editing.advanced_details?.equipment) ? editing.advanced_details.equipment.join(', ') : (editing.advanced_details?.equipment || '')}
                                onChange={e => {
                                    const val = e.target.value;
                                    const arr = val.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                                    setEditing({ ...editing, advanced_details: { ...editing.advanced_details, equipment: arr } });
                                }}
                                className="w-full p-2.5 border border-[oklch(85%_0.012_28)] text-xs focus:border-black outline-none font-mono"
                                rows={2}
                                placeholder="เช่น เหยือกตวง, แปรง Chasen, บิวเรตต์ (คั่นด้วย Enter หรือลูกน้ำ ,)"
                            />
                        </div>

                        {/* QC Standards list */}
                        <div className="space-y-2 border-t border-[oklch(90%_0.008_28)] pt-4">
                            <label className="text-xs font-mono font-bold text-[oklch(55%_0.010_28)] block">
                                มาตรฐานของรสชาติและหน้าตา (QC Standards)
                            </label>
                            {(editing.advanced_details?.qc_standards || []).map((qc, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <input 
                                        value={qc.topic || ''} 
                                        onChange={e => {
                                            const newQc = (editing.advanced_details?.qc_standards || []).map((item, idx) => 
                                                idx === i ? { ...item, topic: e.target.value } : item
                                            );
                                            setEditing(prev => ({ 
                                                ...prev, 
                                                advanced_details: { ...prev.advanced_details, qc_standards: newQc } 
                                            }));
                                        }} 
                                        className="w-1/3 p-2 border border-[oklch(85%_0.012_28)] text-xs font-bold outline-none" 
                                        placeholder="หัวข้อ (เช่น สี/หน้าตา)" 
                                    />
                                    <input 
                                        value={qc.standard || ''} 
                                        onChange={e => {
                                            const newQc = (editing.advanced_details?.qc_standards || []).map((item, idx) => 
                                                idx === i ? { ...item, standard: e.target.value } : item
                                            );
                                            setEditing(prev => ({ 
                                                ...prev, 
                                                advanced_details: { ...prev.advanced_details, qc_standards: newQc } 
                                            }));
                                        }} 
                                        className="flex-1 p-2 border border-[oklch(85%_0.012_28)] text-xs outline-none" 
                                        placeholder="มาตรฐานรสชาติที่ยอมรับได้" 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const newQc = (editing.advanced_details?.qc_standards || []).filter((_, idx) => idx !== i);
                                            setEditing(prev => ({ 
                                                ...prev, 
                                                advanced_details: { ...prev.advanced_details, qc_standards: newQc } 
                                            }));
                                        }} 
                                        className="p-2 text-[oklch(55%_0.010_28)] hover:text-red-700"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}
                            <button 
                                type="button" 
                                onClick={() => {
                                    const newQc = [...(editing.advanced_details?.qc_standards || []), { topic: '', standard: '' }];
                                    setEditing(prev => ({ 
                                        ...prev, 
                                        advanced_details: { ...prev.advanced_details, qc_standards: newQc } 
                                    }));
                                }} 
                                className="text-xs font-mono font-bold px-3 py-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] uppercase"
                            >
                                + เพิ่มมาตรฐาน QC
                            </button>
                        </div>

                        {/* Troubleshooting */}
                        <div className="space-y-3 border-t border-[oklch(90%_0.008_28)] pt-4">
                            <label className="text-xs font-mono font-bold text-[oklch(55%_0.010_28)] block">
                                การแก้ปัญหาเบื้องต้น (Troubleshooting)
                            </label>
                            {(editing.advanced_details?.troubleshooting || []).map((tb, i) => (
                                <div key={i} className="p-3 bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] relative space-y-2">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const newTb = (editing.advanced_details?.troubleshooting || []).filter((_, idx) => idx !== i);
                                            setEditing(prev => ({ 
                                                ...prev, 
                                                advanced_details: { ...prev.advanced_details, troubleshooting: newTb } 
                                            }));
                                        }} 
                                        className="absolute top-2 right-2 text-[oklch(55%_0.010_28)] hover:text-red-700"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                    <div className="pr-6 space-y-2">
                                        <input 
                                            value={tb.problem || ''} 
                                            onChange={e => {
                                                const newTb = (editing.advanced_details?.troubleshooting || []).map((item, idx) => 
                                                    idx === i ? { ...item, problem: e.target.value } : item
                                                );
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, troubleshooting: newTb } 
                                                }));
                                            }} 
                                            className="w-full p-1.5 border border-[oklch(85%_0.012_28)] bg-white text-xs font-bold text-red-600" 
                                            placeholder="ปัญหาที่อาจเกิดขึ้น (เช่น ชาขมเกินไป)" 
                                        />
                                        <input 
                                            value={tb.cause || ''} 
                                            onChange={e => {
                                                const newTb = (editing.advanced_details?.troubleshooting || []).map((item, idx) => 
                                                    idx === i ? { ...item, cause: e.target.value } : item
                                                );
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, troubleshooting: newTb } 
                                                }));
                                            }} 
                                            className="w-full p-1.5 border border-[oklch(85%_0.012_28)] bg-white text-xs" 
                                            placeholder="สาเหตุที่เป็นไปได้ (เช่น แช่ชานานเกินเวลา)" 
                                        />
                                        <input 
                                            value={tb.solution || ''} 
                                            onChange={e => {
                                                const newTb = (editing.advanced_details?.troubleshooting || []).map((item, idx) => 
                                                    idx === i ? { ...item, solution: e.target.value } : item
                                                );
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, troubleshooting: newTb } 
                                                }));
                                            }} 
                                            className="w-full p-1.5 border border-emerald-300 bg-emerald-50/20 text-xs text-emerald-800" 
                                            placeholder="แนวทางการแก้ไข (เช่น จับเวลาสกัดชาไม่เกิน 30 วินาที)" 
                                        />
                                    </div>
                                </div>
                            ))}
                            <button 
                                type="button" 
                                onClick={() => {
                                    const newTb = [...(editing.advanced_details?.troubleshooting || []), { problem: '', cause: '', solution: '' }];
                                    setEditing(prev => ({ 
                                        ...prev, 
                                        advanced_details: { ...prev.advanced_details, troubleshooting: newTb } 
                                    }));
                                }} 
                                className="text-xs font-mono font-bold px-3 py-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] uppercase"
                            >
                                + เพิ่มการแก้ปัญหา
                            </button>
                        </div>
                    </section>
                )}

                {/* Published / Draft status */}
                <div className="p-4 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none font-mono text-xs font-bold">
                        <input 
                            type="checkbox" 
                            checked={editing.is_published} 
                            onChange={e => setEditing({ ...editing, is_published: e.target.checked })} 
                            className="w-4 h-4 rounded-xs text-black border-[oklch(85%_0.012_28)] focus:ring-0" 
                        />
                        <span>{editing.is_published ? '[PUBLISHED] เปิดใช้งานและแสดงในคู่มือบาร์' : '[DRAFT] ซ่อนไว้เป็นสูตรร่างภายใน'}</span>
                    </label>

                    <div className="flex gap-2 font-mono text-xs">
                        <button 
                            type="button" 
                            onClick={() => setEditing(null)} 
                            className="px-4 py-2 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(42%_0.010_28)] font-bold uppercase"
                        >
                            ยกเลิก
                        </button>
                        <button 
                            type="button" 
                            onClick={handleSave} 
                            disabled={saving} 
                            className="px-5 py-2 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold uppercase hover:bg-black disabled:opacity-50"
                        >
                            {saving ? 'กำลังบันทึก...' : 'บันทึกสูตร'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-modals */}
            {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleLink} />}
            {showQuickPaste && <QuickPasteModal onClose={() => setShowQuickPaste(false)} onApply={handleApplyQuickPaste} />}

            <datalist id="sop-units">
                {THAI_UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                ))}
            </datalist>
        </div>
    );
}
