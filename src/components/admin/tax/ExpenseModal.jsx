import React, { useState } from 'react';
import { 
    X, 
    Upload, 
    Camera, 
    Save, 
    CheckCircle2, 
    AlertCircle, 
    Calendar,
    DollarSign,
    Sparkles,
    Bot,
    Key,
    Loader2,
    RefreshCw,
    Check
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { EXPENSE_CATEGORIES, VENDOR_PRESETS } from '../../../utils/expenseConstants';
import { scanReceiptWithGemini, saveGeminiApiKey } from '../../../utils/geminiOcrHelper';
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

    // AI OCR States
    const [isAiScanning, setIsAiScanning] = useState(false);
    const [aiScannedSuccess, setAiScannedSuccess] = useState(false);
    const [aiConfidence, setAiConfidence] = useState(null);
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [autoScanEnabled, setAutoScanEnabled] = useState(true);

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

    // AI Scan Function
    const handleAiScan = async (imageToScan = receiptImage) => {
        if (!imageToScan) {
            toast.warning('กรุณาถ่ายรูปหรืออัปโหลดใบเสร็จก่อนใช้ AI สแกน');
            return;
        }

        setIsAiScanning(true);
        setAiScannedSuccess(false);

        try {
            const data = await scanReceiptWithGemini(imageToScan);
            
            // Auto-fill all fields
            if (data.title) setTitle(data.title);
            if (data.amount && !isNaN(Number(data.amount))) setAmount(String(data.amount));
            if (data.expense_date) setExpenseDate(data.expense_date);
            if (data.category) setCategory(data.category);
            if (data.vendor_name) setVendorName(data.vendor_name);
            if (data.vendor_tax_id) setVendorTaxId(data.vendor_tax_id);
            if (data.doc_type) setDocType(data.doc_type);
            if (typeof data.vat_included === 'boolean') setVatIncluded(data.vat_included);
            if (data.payment_method) setPaymentMethod(data.payment_method);
            if (data.notes) setNotes(data.notes);
            if (data.confidence) setAiConfidence(Math.round(data.confidence * 100));

            setAiScannedSuccess(true);
            toast.success(`✨ Gemini AI สแกนและแยกหมวดหมู่สำเร็จ! (${data.vendor_name || 'บิล'} ฿${Number(data.amount || 0).toLocaleString()})`);
        } catch (err) {
            if (err.message === 'MISSING_API_KEY') {
                setShowApiKeyModal(true);
            } else {
                toast.error('AI สแกนไม่สำเร็จ: ' + err.message);
            }
        } finally {
            setIsAiScanning(false);
        }
    };

    // Save API Key and Retry Scan
    const handleSaveApiKeyAndScan = async () => {
        if (!apiKeyInput.trim()) {
            toast.error('กรุณาระบุ Gemini API Key');
            return;
        }
        await saveGeminiApiKey(apiKeyInput.trim());
        toast.success('บันทึก Gemini API Key เรียบร้อยแล้ว');
        setShowApiKeyModal(false);
        if (receiptImage) {
            handleAiScan(receiptImage);
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
                const MAX_WIDTH = 1400;
                const MAX_HEIGHT = 1400;
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

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
                setReceiptImage(compressedBase64);
                toast.success('แนบรูปใบเสร็จเรียบร้อยแล้ว');

                // Auto Trigger AI Scan if enabled
                if (autoScanEnabled && !existingExpense) {
                    handleAiScan(compressedBase64);
                }
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
                            <div className="flex items-center gap-2">
                                <h2 className="font-mono font-bold text-sm sm:text-base tracking-wider uppercase">
                                    {existingExpense ? 'แก้ไขรายการค่าใช้จ่าย' : 'บันทึกค่าใช้จ่ายร้าน & บิล Makro'}
                                </h2>
                                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-mono text-[9px] font-extrabold flex items-center gap-1">
                                    <Sparkles size={10} /> Gemini AI Auto-Scan
                                </span>
                            </div>
                            <p className="text-[10px] text-[#A3A39E] font-mono">
                                ถ่ายรูปบิล Makro / ค่าน้ำไฟ / ค่าน้ำมัน AI จะอ่านและแยกหมวดหมู่ให้อัตโนมัติ
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Body Form */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs bg-white">

                    {/* AI OCR Active Banner / Control Ribbon */}
                    <div className="p-3 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 rounded-xl border border-orange-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[oklch(52%_0.16_28)] text-white rounded-lg shrink-0">
                                <Bot size={16} />
                            </div>
                            <div>
                                <span className="font-bold text-xs text-zinc-900 flex items-center gap-1.5">
                                    ระบบ Gemini Vision AI ช่วยกรอกบิลอัตโนมัติ
                                    {aiScannedSuccess && (
                                        <span className="text-[10px] text-emerald-700 bg-emerald-100 font-mono font-bold px-1.5 py-0.2 rounded-md inline-flex items-center gap-0.5">
                                            <Check size={10} /> สแกนสำเร็จ {aiConfidence ? `(${aiConfidence}%)` : ''}
                                        </span>
                                    )}
                                </span>
                                <span className="text-[10px] text-zinc-500 block">
                                    อ่านยอดรวม, วันที่, ชื่อร้าน, เลข 13 หลัก, และแยกหมวดวัตถุดิบ/น้ำไฟ/น้ำมัน
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            {receiptImage && (
                                <button
                                    type="button"
                                    disabled={isAiScanning}
                                    onClick={() => handleAiScan()}
                                    className="px-3 py-1.5 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded-lg font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {isAiScanning ? (
                                        <>
                                            <Loader2 size={13} className="animate-spin" />
                                            <span>AI กำลังอ่านบิล...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={13} />
                                            <span>{aiScannedSuccess ? 'สแกนซ้ำ (Re-Scan)' : 'สแกนบิลด้วย AI'}</span>
                                        </>
                                    )}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setShowApiKeyModal(true)}
                                className="p-1.5 bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-300 rounded-lg cursor-pointer transition-colors"
                                title="ตั้งค่า Gemini API Key"
                            >
                                <Key size={14} />
                            </button>
                        </div>
                    </div>

                    {/* AI Pulsing Loading Indicator */}
                    {isAiScanning && (
                        <div className="p-4 bg-zinc-900 text-white rounded-xl flex items-center gap-3 animate-pulse border border-zinc-700 shadow-md">
                            <Loader2 size={20} className="animate-spin text-amber-400" />
                            <div>
                                <strong className="text-xs font-mono font-bold text-amber-300 block">
                                    🤖 Gemini Vision AI กำลังวิเคราะห์ใบเสร็จ...
                                </strong>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                    กำลังอ่านยอดเงิน, แยกหมวดหมู่สินค้า, ตรวจสอบเลขประจำตัวผู้เสียภาษี 13 หลัก
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {/* Category Quick Pills */}
                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1.5">
                            หมวดหมู่ค่าใช้จ่าย (Expense Category) * {aiScannedSuccess && <span className="text-emerald-600 font-bold">(AI เลือกให้อัตโนมัติ)</span>}
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                            {EXPENSE_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleSelectCategory(cat.id)}
                                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                                        category === cat.id
                                            ? 'bg-zinc-900 text-white border-zinc-900 font-bold shadow-sm ring-2 ring-orange-400'
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
                                    placeholder="เช่น 1540.50"
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
                                placeholder="เช่น Siam Makro, Lotus, ปตท."
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs focus:border-zinc-900 focus:outline-none"
                            />
                            {/* Quick Presets */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {VENDOR_PRESETS.slice(0, 6).map((v, i) => (
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
                                    <option value="tax_invoice">🥇 ใบกำกับภาษีเต็มรูป (เกรด A เช่น Makro/ปั๊มน้ำมัน)</option>
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
                                <span>ยอดเงินนี้รวม VAT 7% ในบิลแล้ว (เช่น Makro, ปั๊มน้ำมัน)</span>
                            </label>
                        </div>
                    </div>

                    {/* Receipt Image Upload Area with Gemini Trigger */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase">
                                รูปถ่ายใบเสร็จ / บิล Makro / สลิปโอนเงิน (Receipt Photo)
                            </label>
                            <label className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoScanEnabled}
                                    onChange={(e) => setAutoScanEnabled(e.target.checked)}
                                    className="accent-[oklch(52%_0.16_28)] w-3.5 h-3.5"
                                />
                                <span>⚡ สแกนด้วย AI อัตโนมัติเมื่อเลือกรูป</span>
                            </label>
                        </div>

                        {receiptImage ? (
                            <div className="relative border-2 border-zinc-300 rounded-xl overflow-hidden bg-zinc-100 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <img src={receiptImage} alt="Receipt Preview" className="w-16 h-16 object-cover rounded-lg border border-zinc-300 shadow-sm" />
                                    <div>
                                        <span className="font-bold text-xs text-zinc-900 block">แนบรูปใบเสร็จแล้ว</span>
                                        <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-1">
                                            <CheckCircle2 size={11} /> พร้อมใช้เป็นหลักฐานภาษี
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        disabled={isAiScanning}
                                        onClick={() => handleAiScan()}
                                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-mono font-bold text-[11px] flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                                    >
                                        <Sparkles size={12} />
                                        <span>กดสแกนด้วย Gemini AI</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReceiptImage(null);
                                            setAiScannedSuccess(false);
                                        }}
                                        className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-bold transition-colors cursor-pointer"
                                    >
                                        เปลี่ยนรูป
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <label className="border-2 border-dashed border-orange-300 hover:border-orange-500 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-orange-50/30 hover:bg-orange-50/60 group">
                                <div className="p-3 bg-white group-hover:bg-[oklch(52%_0.16_28)] group-hover:text-white rounded-full shadow-sm text-zinc-700 transition-colors">
                                    <Camera size={22} />
                                </div>
                                <div className="text-center">
                                    <span className="font-bold text-xs text-zinc-900 block">
                                        กดถ่ายรูป หรือ อัปโหลดรูปใบเสร็จ Makro / สลิปโอน
                                    </span>
                                    <span className="text-[10px] text-amber-700 font-mono font-semibold">
                                        ✨ Gemini AI จะอ่านยอดเงินและแยกหมวดหมู่อัตโนมัติ
                                    </span>
                                </div>
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
                            บันทึกรายการสินค้า / รายละเอียดเพิ่มเติม (Notes)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="เช่น หมูสามชั้น 2kg, นมสด Meiji 5L, ผักสลัด"
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
                        disabled={saving || isAiScanning}
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-mono font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                    >
                        <Save size={15} />
                        <span>{saving ? 'กำลังบันทึก...' : 'บันทึกค่าใช้จ่าย (SAVE)'}</span>
                    </button>
                </div>
            </div>

            {/* MODAL: GEMINI API KEY SETUP */}
            {showApiKeyModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans text-xs">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-zinc-300 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-orange-100 text-orange-700 rounded-xl">
                                <Key size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-zinc-950">
                                    ตั้งค่า Google Gemini API Key
                                </h3>
                                <p className="text-[11px] text-zinc-500 font-mono">
                                    ใช้สำหรับระบบสแกนบิลและแยกหมวดหมู่อัตโนมัติด้วย AI
                                </p>
                            </div>
                        </div>

                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                            💡 คุณสามารถรับ <strong>Gemini API Key ฟรี</strong> ได้ทันทีจาก Google AI Studio (ไม่มีค่าใช้จ่าย):
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noreferrer"
                                className="font-bold text-orange-700 underline block mt-1"
                            >
                                🔗 กดรับ API Key ฟรีที่ aistudio.google.com &rarr;
                            </a>
                        </div>

                        <div>
                            <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                วาง Gemini API Key ของคุณที่นี่:
                            </label>
                            <input
                                type="password"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                placeholder="AIzaSy..."
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs focus:border-zinc-900 focus:outline-none"
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowApiKeyModal(false)}
                                className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg font-mono font-bold text-xs hover:bg-zinc-100 cursor-pointer"
                            >
                                ปิด
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveApiKeyAndScan}
                                className="px-5 py-2 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded-lg font-mono font-bold text-xs cursor-pointer shadow-md flex items-center gap-1.5"
                            >
                                <Save size={14} />
                                <span>บันทึก &amp; เริ่มสแกนบิล</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
