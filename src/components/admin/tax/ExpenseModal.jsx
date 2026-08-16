import React, { useState } from 'react';
import { 
    X, 
    Upload, 
    Camera, 
    Save, 
    Trash2, 
    CheckCircle2, 
    AlertCircle, 
    Receipt, 
    Calendar,
    DollarSign,
    Store
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { EXPENSE_CATEGORIES, VENDOR_PRESETS } from '../../../utils/expenseConstants';
import { toast } from 'sonner';

export default function ExpenseModal({ 
    existingExpense = null, 
    onClose, 
    onSaveSuccess 
}) {
    const [expenseDate, setExpenseDate] = useState(
        existingExpense?.expense_date || new Date().toISOString().slice(0, 10)
    );
    const [category, setCategory] = useState(existingExpense?.category || 'raw_material');
    const [title, setTitle] = useState(existingExpense?.title || 'ซื้อวัตถุดิบ Makro');
    const [vendorName, setVendorName] = useState(existingExpense?.vendor_name || 'Siam Makro');
    const [vendorTaxId, setVendorTaxId] = useState(existingExpense?.vendor_tax_id || '');
    const [docType, setDocType] = useState(existingExpense?.doc_type || 'tax_invoice');
    const [amount, setAmount] = useState(existingExpense?.amount ? String(existingExpense.amount) : '');
    const [vatIncluded, setVatIncluded] = useState(existingExpense?.vat_included ?? true);
    const [paymentMethod, setPaymentMethod] = useState(existingExpense?.payment_method || 'TRANSFER');
    const [receiptImage, setReceiptImage] = useState(existingExpense?.receipt_image_url || null);
    const [notes, setNotes] = useState(existingExpense?.notes || '');
    const [saving, setSaving] = useState(false);

    // Handle Category change & autofill smart defaults
    const handleSelectCategory = (catId) => {
        setCategory(catId);
        const matched = EXPENSE_CATEGORIES.find(c => c.id === catId);
        if (matched) {
            if (!existingExpense) {
                setTitle(matched.label.replace(/^[^\s]+\s*/, ''));
                if (matched.defaultVendor) setVendorName(matched.defaultVendor);
                if (matched.defaultDoc) setDocType(matched.defaultDoc);
            }
        }
    };

    // Handle Image Upload / Compression
    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error('ขนาดไฟล์รูปภาพเกิน 10MB กรุณาเลือกรูปขนาดเล็กลง');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                setReceiptImage(compressedBase64);
                toast.success('แนบรูปใบเสร็จเรียบร้อยแล้ว');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Save Expense
    const handleSave = async () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error('กรุณาระบุจำนวนเงินที่ถูกต้อง');
            return;
        }
        if (!title.trim()) {
            toast.error('กรุณาระบุรายการค่าใช้จ่าย');
            return;
        }

        setSaving(true);
        try {
            // Calculate VAT breakdown if applicable
            let vatVal = 0;
            if (vatIncluded) {
                vatVal = parseFloat(((numAmount * 7) / 107).toFixed(2));
            }

            const payload = {
                expense_date: expenseDate,
                title: title.trim(),
                category,
                vendor_name: vendorName.trim() || 'ไม่ระบุ',
                vendor_tax_id: vendorTaxId.replace(/\D/g, ''),
                doc_type: docType,
                amount: numAmount,
                vat_included: vatIncluded,
                vat_amount: vatVal,
                receipt_image_url: receiptImage,
                payment_method: paymentMethod,
                notes: notes.trim()
            };

            let savedRecord = { ...payload, id: existingExpense?.id || `local_${Date.now()}` };

            // 1. Save to Supabase
            try {
                if (existingExpense?.id && !String(existingExpense.id).startsWith('local_')) {
                    const { data } = await supabase
                        .from('store_expenses')
                        .update(payload)
                        .eq('id', existingExpense.id)
                        .select()
                        .single();
                    if (data) savedRecord = data;
                } else {
                    const { data } = await supabase
                        .from('store_expenses')
                        .insert([payload])
                        .select()
                        .single();
                    if (data) savedRecord = data;
                }
            } catch {
                // Fallback to local
            }

            // 2. Save to LocalStorage
            const localList = JSON.parse(localStorage.getItem('onhaus_store_expenses') || '[]');
            const existingIdx = localList.findIndex(e => e.id === savedRecord.id);
            if (existingIdx >= 0) {
                localList[existingIdx] = savedRecord;
            } else {
                localList.unshift(savedRecord);
            }
            localStorage.setItem('onhaus_store_expenses', JSON.stringify(localList));

            toast.success(`บันทึกค่าใช้จ่าย ฿${numAmount.toLocaleString()} เรียบร้อยแล้ว!`);
            if (onSaveSuccess) onSaveSuccess(savedRecord);
        } catch (err) {
            toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto font-sans">
            <div className="bg-[#ECECE9] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-[#D1D1CD]">
                {/* Header */}
                <div className="bg-[#1A1A1A] text-white p-4 sm:px-6 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[oklch(52%_0.16_28)] flex items-center justify-center text-white font-mono font-bold text-sm">
                            ฿
                        </div>
                        <div>
                            <h2 className="font-mono font-bold text-sm sm:text-base tracking-wider uppercase">
                                {existingExpense ? 'แก้ไขรายการค่าใช้จ่าย' : 'บันทึกค่าใช้จ่ายร้าน & บิล Makro'}
                            </h2>
                            <p className="text-[10px] text-[#A3A39E] font-mono">
                                แนบรูปใบเสร็จเพื่อใช้เป็นหลักฐานลดหย่อนภาษีตอนสิ้นปี
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Body Form */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs bg-white">
                    
                    {/* Category Quick Pills */}
                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1.5">
                            หมวดหมู่ค่าใช้จ่าย (Expense Category) *
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {EXPENSE_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleSelectCategory(cat.id)}
                                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                                        category === cat.id
                                            ? 'bg-zinc-900 text-white border-zinc-900 font-bold shadow-sm'
                                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                                    }`}
                                >
                                    <div className="text-[11px] leading-tight truncate">{cat.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Amount & Date Input Block */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                        <div>
                            <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                ยอดเงินที่จ่าย (บาท) *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-sm">฿</span>
                                <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="เช่น 1500"
                                    autoFocus
                                    className="w-full pl-8 pr-3 py-2 border-2 border-zinc-300 rounded-lg text-base font-mono font-black text-zinc-950 focus:border-zinc-900 focus:outline-none bg-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                วันที่ตามใบเสร็จ / วันที่จ่าย *
                            </label>
                            <input
                                type="date"
                                value={expenseDate}
                                onChange={(e) => setExpenseDate(e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs font-bold focus:border-zinc-900 focus:outline-none bg-white"
                            />
                        </div>
                    </div>

                    {/* Details: Title & Vendor */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                            <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                รายละเอียดรายการค่าใช้จ่าย *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="เช่น ซื้อเนื้อสัตว์ นม ผักสด Makro สาขาศรีนครินทร์"
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-semibold focus:border-zinc-900 focus:outline-none"
                            />
                        </div>

                        {/* Vendor Name */}
                        <div>
                            <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                ร้านค้า / ผู้รับเงิน (Vendor)
                            </label>
                            <input
                                type="text"
                                value={vendorName}
                                onChange={(e) => setVendorName(e.target.value)}
                                placeholder="เช่น Siam Makro, Lotus"
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs focus:border-zinc-900 focus:outline-none"
                            />
                            {/* Quick Presets */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {VENDOR_PRESETS.slice(0, 5).map((v, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setVendorName(v)}
                                        className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-mono text-[9px] cursor-pointer"
                                    >
                                        +{v}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Document Proof Grade & Vendor Tax ID */}
                        <div className="space-y-2">
                            <div>
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    ชนิดหลักฐานเอกสาร (Tax Proof Grade)
                                </label>
                                <select
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value)}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium focus:border-zinc-900 focus:outline-none bg-white"
                                >
                                    <option value="tax_invoice">🥇 ใบกำกับภาษีเต็มรูป (เกรด A เช่น Makro/Lotus)</option>
                                    <option value="cash_bill">🥈 บิลเงินสด + สลิปโอน (เกรด B)</option>
                                    <option value="receipt_voucher">🥉 ใบสำคัญรับเงิน (เกรด C)</option>
                                    <option value="slip_only">สลิปโอนเงินอย่างเดียว</option>
                                </select>
                            </div>

                            <div>
                                <input
                                    type="text"
                                    maxLength={17}
                                    value={vendorTaxId}
                                    onChange={(e) => setVendorTaxId(e.target.value)}
                                    placeholder="เลขผู้เสียภาษี 13 หลักของผู้ขาย (ถ้ามี)"
                                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg font-mono text-[11px] text-zinc-700 focus:border-zinc-900 focus:outline-none bg-zinc-50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Payment Method & VAT Tag */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                วิธีชำระเงิน
                            </label>
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium focus:border-zinc-900 focus:outline-none bg-white"
                            >
                                <option value="TRANSFER">โอนเงิน (Transfer)</option>
                                <option value="CASH">เงินสด (Cash)</option>
                                <option value="CREDIT">บัตรเครดิต (Credit Card)</option>
                            </select>
                        </div>

                        <div className="flex items-center pt-5">
                            <label className="flex items-center gap-2 text-xs text-zinc-800 cursor-pointer font-medium">
                                <input
                                    type="checkbox"
                                    checked={vatIncluded}
                                    onChange={(e) => setVatIncluded(e.target.checked)}
                                    className="accent-[oklch(52%_0.16_28)] w-4 h-4"
                                />
                                <span>ยอดเงินนี้รวม VAT 7% ในบิลแล้ว (เช่น บิล Makro)</span>
                            </label>
                        </div>
                    </div>

                    {/* Receipt Image Upload Area */}
                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1.5">
                            รูปถ่ายใบเสร็จ / บิล Makro / สลิปโอนเงิน (Receipt Photo)
                        </label>

                        {receiptImage ? (
                            <div className="relative border-2 border-zinc-300 rounded-xl overflow-hidden bg-zinc-100 p-2 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img src={receiptImage} alt="Receipt Preview" className="w-16 h-16 object-cover rounded-lg border border-zinc-300" />
                                    <div>
                                        <span className="font-bold text-xs text-zinc-900 block">แนบรูปใบเสร็จแล้ว</span>
                                        <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-1">
                                            <CheckCircle2 size={11} /> พร้อมใช้เป็นหลักฐานภาษี
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setReceiptImage(null)}
                                    className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-bold transition-colors cursor-pointer"
                                >
                                    เปลี่ยนรูป
                                </button>
                            </div>
                        ) : (
                            <label className="border-2 border-dashed border-zinc-300 hover:border-zinc-500 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-zinc-50/50 hover:bg-zinc-100">
                                <div className="p-3 bg-white rounded-full shadow-sm text-zinc-700">
                                    <Camera size={20} />
                                </div>
                                <span className="font-bold text-xs text-zinc-800">
                                    กดถ่ายรูป หรือ อัปโหลดรูปใบเสร็จ Makro / สลิปโอน
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                    รองรับ JPG, PNG (ระบบจะย่อขนาดให้อัตโนมัติ)
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                            บันทึกเพิ่มเติม (Notes)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="เช่น ซื้อวัตถุดิบรอบเช้าสำหรับทำเซตสเต๊ก"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs focus:border-zinc-900 focus:outline-none"
                        />
                    </div>
                </div>

                {/* Footer Toolbar */}
                <div className="p-4 bg-zinc-50 border-t border-[#D1D1CD] flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 border border-zinc-300 hover:bg-zinc-200 text-zinc-700 rounded-lg font-mono font-bold text-xs transition-colors cursor-pointer"
                    >
                        ยกเลิก
                    </button>

                    <button
                        type="button"
                        disabled={saving}
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-mono font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                    >
                        <Save size={15} />
                        <span>{saving ? 'กำลังบันทึก...' : 'บันทึกค่าใช้จ่าย (SAVE)'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
