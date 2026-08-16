/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useRef } from 'react';
import { 
    X, 
    Camera, 
    Check, 
    Loader2, 
    Key, 
    ZoomIn, 
    RotateCcw,
    Sparkles,
    ShieldCheck,
    FileText,
    AlertTriangle
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { EXPENSE_CATEGORIES, VENDOR_PRESETS } from '../../../utils/expenseConstants';
import { 
    scanReceiptWithGemini, 
    saveGeminiApiKey, 
    GEMINI_SUPPORTED_MODELS, 
    getGeminiPreferredModel, 
    saveGeminiPreferredModel 
} from '../../../utils/geminiOcrHelper';
import { checkDuplicateExpense } from '../../../utils/duplicateDetector';
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
    const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash');
    const [autoScanEnabled, setAutoScanEnabled] = useState(true);
    const [imagePreviewZoom, setImagePreviewZoom] = useState(false);
    const [compareImage, setCompareImage] = useState(null);
    const [existingExpensesList, setExistingExpensesList] = useState(() => {
        try {
            const local = localStorage.getItem('onhaus_store_expenses');
            return local ? JSON.parse(local) : [];
        } catch {
            return [];
        }
    });

    const fileInputRef = useRef(null);

    // Initial preferred model & fresh expenses load
    useEffect(() => {
        let isMounted = true;
        getGeminiPreferredModel().then(m => {
            if (isMounted && m) setGeminiModel(m);
        });

        // Load fresh expenses from Supabase to ensure real-time duplicate detection
        supabase.from('store_expenses').select('*').then(({ data }) => {
            if (isMounted && data) {
                setExistingExpensesList(data);
            }
        });

        return () => { isMounted = false; };
    }, []);

    // Duplicate Detection Calculation
    const duplicateCheckResult = React.useMemo(() => {
        return checkDuplicateExpense({
            id: existingExpense?.id,
            amount,
            expense_date: expenseDate,
            vendor_name: vendorName,
            title,
            notes
        }, existingExpensesList);
    }, [existingExpense, amount, expenseDate, vendorName, title, notes, existingExpensesList]);

    // Keyboard Shortcuts (Escape to close, Ctrl+Enter to save)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (imagePreviewZoom) {
                    setImagePreviewZoom(false);
                } else if (showApiKeyModal) {
                    setShowApiKeyModal(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [imagePreviewZoom, showApiKeyModal, onClose]);

    // Handle Category change & autofill smart defaults
    const handleSelectCategory = (catId) => {
        setCategory(catId);
        const matched = EXPENSE_CATEGORIES.find(c => c.id === catId);
        if (matched && !existingExpense) {
            setTitle(matched.label.replace(/^[^\s]+\s*/, ''));
            if (matched.defaultVendor) setVendorName(matched.defaultVendor);
            if (matched.defaultDoc) setDocType(matched.defaultDoc);
        }
    };

    // AI Scan Function
    const handleAiScan = async (imageToScan = receiptImage) => {
        if (!imageToScan) {
            toast.warning('กรุณาถ่ายรูปหรืออัปโหลดใบเสร็จก่อนเริ่มสแกน');
            return;
        }

        setIsAiScanning(true);
        setAiScannedSuccess(false);

        try {
            const data = await scanReceiptWithGemini(imageToScan, null, geminiModel);
            
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
            toast.success(`Gemini AI ประมวลผลสำเร็จ: ${data.vendor_name || 'บิล'} ฿${Number(data.amount || 0).toLocaleString()}`);
        } catch (err) {
            if (err.message === 'MISSING_API_KEY') {
                setShowApiKeyModal(true);
            } else {
                toast.error('AI Scan Error: ' + err.message);
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
        toast.success('บันทึก Gemini API Key เรียบร้อย');
        setShowApiKeyModal(false);
        if (receiptImage) {
            handleAiScan(receiptImage);
        }
    };

    // Handle Image Upload / Compression
    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 12 * 1024 * 1024) {
            toast.error('ขนาดไฟล์เกิน 12MB กรุณาเลือกรูปขนาดเล็กลง');
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
                toast.success('แนบภาพใบเสร็จเรียบร้อย');

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
            toast.error('กรุณาระบุชื่อรายการค่าใช้จ่าย');
            return;
        }

        // Duplicate Warning Confirmation
        if (duplicateCheckResult?.isDuplicate && duplicateCheckResult.confidence === 'HIGH') {
            const proceed = window.confirm(`⚠️ ระบบตรวจพบบิลซ้ำที่เคยบันทึกไว้แล้ว:\n\n${duplicateCheckResult.reason}\n\nคุณแน่ใจหรือไม่ว่าต้องการบันทึกรายการนี้ซ้ำอีกครั้ง?`);
            if (!proceed) return;
        }

        setSaving(true);
        try {
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

            // 1. Supabase Sync
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
                // Fallback locally
            }

            // 2. LocalStorage Sync
            const localList = JSON.parse(localStorage.getItem('onhaus_store_expenses') || '[]');
            const existingIdx = localList.findIndex(e => e.id === savedRecord.id);
            if (existingIdx >= 0) {
                localList[existingIdx] = savedRecord;
            } else {
                localList.unshift(savedRecord);
            }
            localStorage.setItem('onhaus_store_expenses', JSON.stringify(localList));

            toast.success(`บันทึกค่าใช้จ่าย ฿${numAmount.toLocaleString()} เรียบร้อย`);
            if (onSaveSuccess) onSaveSuccess(savedRecord);
        } catch (err) {
            toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto font-sans">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-none shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden text-[var(--color-ink)]">
                
                {/* 1. Structural Brutalist Header */}
                <div className="bg-[var(--color-ink)] text-[var(--color-paper)] px-4 py-3 sm:px-6 flex items-center justify-between border-b border-[var(--color-rule)] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="font-mono text-xs font-bold px-2 py-0.5 bg-[var(--color-accent)] text-white">
                            EXP//01
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-mono font-bold text-sm tracking-wider uppercase">
                                    {existingExpense ? 'EDIT EXPENSE RECORD' : 'STORE EXPENSE & RECEIPT CAPTURE'}
                                </h2>
                                <span className="font-mono text-[10px] text-[var(--color-muted)]">
                                    // {isAiScanning ? 'SCANNING...' : aiScannedSuccess ? `CONFIDENCE: ${aiConfidence}%` : 'READY'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowApiKeyModal(true)}
                            className="font-mono text-[10px] font-bold px-2.5 py-1 text-[var(--color-paper)]/80 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
                        >
                            AI CONFIG
                        </button>
                        <button 
                            onClick={onClose} 
                            className="p-1 text-[var(--color-paper)]/70 hover:text-white transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* 2. Split Workspace: Optical Chamber (Left) + Structured Ledger (Right) */}
                <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-rule)]">
                    
                    {/* LEFT CHAMBER: Optical Scanner & Receipt Preview (5 Columns) */}
                    <div className="lg:col-span-5 p-4 sm:p-5 bg-[var(--color-paper-2)] flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--color-neutral)]">
                                    [01] OPTICAL ATTACHMENT
                                </span>
                                <label className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-neutral)] cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={autoScanEnabled}
                                        onChange={(e) => setAutoScanEnabled(e.target.checked)}
                                        className="accent-[var(--color-accent)] w-3 h-3"
                                    />
                                    <span>AUTO SCAN</span>
                                </label>
                            </div>

                            {/* Scanning Viewport */}
                            {receiptImage ? (
                                <div className="relative border border-[var(--color-rule)] bg-black/5 aspect-[4/5] w-full flex items-center justify-center overflow-hidden group">
                                    <img 
                                        src={receiptImage} 
                                        alt="Receipt Attachment" 
                                        className="w-full h-full object-contain cursor-zoom-in"
                                        onClick={() => setImagePreviewZoom(true)}
                                    />

                                    {/* Optical Scanning Sweep Animation */}
                                    {isAiScanning && (
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-accent)]/30 to-transparent animate-pulse border-y-2 border-[var(--color-accent)] pointer-events-none flex items-center justify-center">
                                            <div className="bg-black/80 text-white font-mono text-[11px] font-bold px-3 py-1 tracking-widest flex items-center gap-2">
                                                <Loader2 size={13} className="animate-spin text-[var(--color-accent)]" />
                                                <span>GEMINI_VISION_OCR_ACTIVE</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Overlay Actions */}
                                    {!isAiScanning && (
                                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 p-1 bg-black/70 backdrop-blur-xs">
                                            <button
                                                type="button"
                                                onClick={() => setImagePreviewZoom(true)}
                                                className="px-2 py-1 text-[10px] font-mono font-bold text-white hover:text-[var(--color-accent)] flex items-center gap-1 transition-colors"
                                            >
                                                <ZoomIn size={12} />
                                                <span>INSPECT</span>
                                            </button>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAiScan()}
                                                    className="px-2.5 py-1 text-[10px] font-mono font-bold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)] flex items-center gap-1 transition-colors"
                                                >
                                                    <Sparkles size={11} />
                                                    <span>RE-SCAN</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="px-2 py-1 text-[10px] font-mono font-bold text-gray-300 hover:text-white border border-white/20 transition-colors"
                                                >
                                                    REPLACE
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-[var(--color-rule)] hover:border-[var(--color-ink)] transition-colors aspect-[4/5] w-full flex flex-col items-center justify-center gap-3 cursor-pointer bg-[var(--color-paper)] group p-6 text-center"
                                >
                                    <div className="w-12 h-12 rounded-none border border-[var(--color-rule)] group-hover:border-[var(--color-ink)] flex items-center justify-center text-[var(--color-neutral)] group-hover:text-[var(--color-ink)] transition-all">
                                        <Camera size={20} />
                                    </div>
                                    <div>
                                        <span className="font-mono text-xs font-bold tracking-wider text-[var(--color-ink)] block uppercase">
                                            SNAP OR DROP RECEIPT
                                        </span>
                                        <span className="font-mono text-[10px] text-[var(--color-muted)] mt-1 block">
                                            MAKRO / FUEL / UTILITY / SLIP
                                        </span>
                                    </div>
                                    <div className="font-mono text-[9px] text-[var(--color-accent)] uppercase tracking-wider font-bold border-t border-[var(--color-rule)] pt-2 mt-1">
                                        + GEMINI AUTO-CATEGORIZATION
                                    </div>
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>

                        {/* Telemetry / Readout Strip */}
                        <div className="p-3 bg-[var(--color-paper)] border border-[var(--color-rule)] font-mono text-[10px] space-y-1.5">
                            <div className="flex justify-between text-[var(--color-neutral)]">
                                <span>TAX_COMPLIANCE:</span>
                                <span className="font-bold text-[var(--color-ink)]">SEC 86/4 &amp; 105</span>
                            </div>
                            <div className="flex justify-between text-[var(--color-neutral)]">
                                <span>IMAGE_COMPRESSION:</span>
                                <span className="font-bold text-[var(--color-ink)]">CANVAS FAST JPG</span>
                            </div>
                            {aiScannedSuccess && (
                                <div className="flex justify-between text-[var(--color-emerald)] font-bold pt-1 border-t border-[var(--color-rule)]">
                                    <span>AI_CLASSIFICATION:</span>
                                    <span>VERIFIED</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT CHAMBER: Structured Input Ledger (7 Columns) */}
                    <div className="lg:col-span-7 p-4 sm:p-6 bg-[var(--color-paper)] space-y-5">
                        
                        {/* Section Tag */}
                        <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--color-neutral)]">
                                [02] TRANSACTION ENTRY &amp; TAX ATTRIBUTES
                            </span>
                            {docType === 'tax_invoice' && (
                                <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 bg-[var(--color-ink)] text-[var(--color-paper)]">
                                    FULL TAX INVOICE (GRADE A)
                                </span>
                            )}
                        </div>

                        {/* Amount & Date Hero Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div className="sm:col-span-7 border border-[var(--color-rule)] p-3 bg-[var(--color-paper-2)]">
                                <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-1">
                                    PAYABLE AMOUNT (THB) *
                                </label>
                                <div className="relative flex items-center">
                                    <span className="font-mono font-black text-xl text-[var(--color-ink)] mr-2 select-none">฿</span>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        autoFocus
                                        className="w-full bg-transparent border-none font-mono font-black text-2xl text-[var(--color-ink)] focus:outline-none placeholder:text-gray-300"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-5 border border-[var(--color-rule)] p-3 bg-[var(--color-paper-2)]">
                                <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-1">
                                    PAYMENT DATE *
                                </label>
                                <input
                                    type="date"
                                    value={expenseDate}
                                    onChange={(e) => setExpenseDate(e.target.value)}
                                    className="w-full bg-transparent border-none font-mono font-bold text-xs text-[var(--color-ink)] focus:outline-none pt-1"
                                />
                            </div>
                        </div>

                        {/* Category Selector Grid (Neo-Brutalist Cells) */}
                        <div>
                            <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-2">
                                EXPENSE CATEGORY (AI AUTO-CLASSIFIED) *
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[11px]">
                                {EXPENSE_CATEGORIES.map((cat, idx) => {
                                    const isSelected = category === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => handleSelectCategory(cat.id)}
                                            className={`p-2 text-left border transition-all cursor-pointer flex flex-col justify-between min-h-[46px] ${
                                                isSelected
                                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)] font-bold'
                                                    : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'
                                            }`}
                                        >
                                            <span className="text-[8px] opacity-60">[{String(idx + 1).padStart(2, '0')}]</span>
                                            <span className="truncate">{cat.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Title & Vendor Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                            <div className="sm:col-span-2">
                                <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-1">
                                    TRANSACTION TITLE / DESCRIPTION *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="เช่น ซื้อเนื้อสัตว์ นม ผักสด Makro สาขาศรีนครินทร์"
                                    className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-medium focus:border-[var(--color-ink)] focus:outline-none"
                                />
                            </div>

                            {/* Vendor Name & Quick Presets */}
                            <div>
                                <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-1">
                                    VENDOR / PAYEE NAME
                                </label>
                                <input
                                    type="text"
                                    value={vendorName}
                                    onChange={(e) => setVendorName(e.target.value)}
                                    placeholder="เช่น Siam Makro, Lotus, ปตท."
                                    className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-medium focus:border-[var(--color-ink)] focus:outline-none"
                                />
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {VENDOR_PRESETS.slice(0, 5).map((v, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setVendorName(v)}
                                            className="px-1.5 py-0.5 border border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-neutral)] font-mono text-[9px] hover:text-[var(--color-ink)] cursor-pointer"
                                        >
                                            +{v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Proof Grade & Vendor Tax ID */}
                            <div className="space-y-1.5">
                                <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block">
                                    TAX PROOF TYPE &amp; TAX ID
                                </label>
                                <select
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-medium focus:border-[var(--color-ink)] focus:outline-none"
                                >
                                    <option value="tax_invoice">GRADE A: FULL TAX INVOICE (ใบกำกับภาษีเต็มรูป)</option>
                                    <option value="cash_bill">GRADE B: CASH BILL + SLIP (บิลเงินสด + สลิป)</option>
                                    <option value="receipt_voucher">GRADE C: PAYMENT VOUCHER (ใบสำคัญรับเงิน)</option>
                                    <option value="slip_only">TRANSFER SLIP ONLY (สลิปโอนเงิน)</option>
                                </select>
                                <input
                                    type="text"
                                    maxLength={17}
                                    value={vendorTaxId}
                                    onChange={(e) => setVendorTaxId(e.target.value)}
                                    placeholder="13-Digit Tax ID (e.g. 0105531044471)"
                                    className="w-full px-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-mono text-[10px] focus:border-[var(--color-ink)] focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Payment Method & VAT Toggle */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-[var(--color-rule)]">
                            <div>
                                <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-1">
                                    PAYMENT SETTLEMENT METHOD
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-mono text-xs focus:border-[var(--color-ink)] focus:outline-none"
                                >
                                    <option value="TRANSFER">BANK TRANSFER (โอนเงิน)</option>
                                    <option value="CASH">CASH (เงินสด)</option>
                                    <option value="CREDIT">CORPORATE CREDIT (บัตรเครดิต)</option>
                                </select>
                            </div>

                            <div className="flex items-center pt-4">
                                <label className="flex items-center gap-2 text-xs font-mono text-[var(--color-ink)] cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={vatIncluded}
                                        onChange={(e) => setVatIncluded(e.target.checked)}
                                        className="accent-[var(--color-accent)] w-4 h-4"
                                    />
                                    <span>VAT 7% INCLUDED IN TOTAL</span>
                                </label>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-1">
                                ITEMIZED AUDIT NOTES (EXTRACTED ITEMS)
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="เช่น หมูสามชั้น 2kg, นมสด Meiji 5L, ผักสลัด"
                                className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono focus:border-[var(--color-ink)] focus:outline-none"
                            />
                        </div>

                        {/* DUPLICATE DETECTION WARNING BANNER */}
                        {duplicateCheckResult?.isDuplicate && (
                            <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 font-mono text-xs space-y-2 animate-in fade-in">
                                <div className="flex items-center justify-between font-bold text-[11px] text-amber-900 border-b border-amber-500/20 pb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <AlertTriangle size={15} className="text-amber-600" />
                                        DUPLICATE DETECTED // ตรวจพบบิลซ้ำที่เคยบันทึกไว้แล้ว
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-amber-600 text-white text-[9px] font-bold">
                                        {duplicateCheckResult.confidence} CONFIDENCE
                                    </span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-amber-900">
                                    {duplicateCheckResult.reason}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px]">
                                    {duplicateCheckResult.matchedRecord?.receipt_image_url && (
                                        <button
                                            type="button"
                                            onClick={() => setCompareImage(duplicateCheckResult.matchedRecord.receipt_image_url)}
                                            className="px-2 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 font-bold underline cursor-pointer border border-amber-400"
                                        >
                                            &rarr; กดดูรูปบิลเดิมเทียบกับรูปใหม่ (COMPARE RECEIPT)
                                        </button>
                                    )}
                                    <span className="text-amber-800 text-[10px]">
                                        * หากเป็นบิลคนละใบสามารถกดยืนยันบันทึกต่อไปได้
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Brutalist Action Bar (Footer) */}
                <div className="p-3 sm:px-6 bg-[var(--color-paper-2)] border-t border-[var(--color-rule)] flex items-center justify-between shrink-0 font-mono text-xs">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] font-bold transition-colors cursor-pointer uppercase text-[11px]"
                    >
                        CANCEL (ESC)
                    </button>

                    <button
                        type="button"
                        disabled={saving || isAiScanning}
                        onClick={handleSave}
                        className="px-6 py-2 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-2 uppercase text-[11px]"
                    >
                        <span>{saving ? 'COMMITTING...' : 'SAVE EXPENSE RECORD'}</span>
                    </button>
                </div>
            </div>

            {/* FULL RECEIPT ZOOM INSPECTION MODAL */}
            {imagePreviewZoom && receiptImage && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/90 p-4 font-sans">
                    <div className="relative max-w-4xl max-h-[92vh] flex flex-col border border-white/20 bg-black overflow-hidden">
                        <div className="p-3 bg-zinc-900 text-white flex justify-between items-center font-mono text-xs border-b border-zinc-800">
                            <span>RECEIPT OPTICAL INSPECTION // {vendorName}</span>
                            <button onClick={() => setImagePreviewZoom(false)} className="text-white hover:text-red-400 p-1 cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
                            <img src={receiptImage} alt="Zoomed Receipt" className="max-w-full max-h-[80vh] object-contain" />
                        </div>
                    </div>
                </div>
            )}

            {/* DUPLICATE SIDE-BY-SIDE COMPARISON MODAL */}
            {compareImage && (
                <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/95 p-4 font-sans text-xs">
                    <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col border border-zinc-700 bg-zinc-950 text-white overflow-hidden shadow-2xl">
                        <div className="p-3.5 bg-zinc-900 flex justify-between items-center font-mono text-xs border-b border-zinc-800">
                            <span className="font-bold flex items-center gap-2 text-amber-400">
                                <AlertTriangle size={15} />
                                SIDE-BY-SIDE RECEIPT COMPARISON (เปรียบเทียบบิลเดิม vs บิลใหม่)
                            </span>
                            <button onClick={() => setCompareImage(null)} className="text-white hover:text-red-400 p-1 cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Left: Previous Saved Receipt */}
                            <div className="border border-zinc-800 bg-black p-3 flex flex-col items-center">
                                <span className="font-mono text-[10px] text-zinc-400 font-bold uppercase mb-2">
                                    [1] บิลเดิมที่เคยบันทึกไว้ในระบบ (EXISTING RECORD)
                                </span>
                                <div className="flex-1 flex items-center justify-center w-full">
                                    <img src={compareImage} alt="Old Receipt" className="max-w-full max-h-[60vh] object-contain" />
                                </div>
                            </div>

                            {/* Right: Current Candidate Receipt */}
                            <div className="border border-zinc-800 bg-black p-3 flex flex-col items-center">
                                <span className="font-mono text-[10px] text-amber-400 font-bold uppercase mb-2">
                                    [2] บิลใหม่ที่กำลังสแกน / กรอกอยู่ (CURRENT CANDIDATE)
                                </span>
                                <div className="flex-1 flex items-center justify-center w-full">
                                    {receiptImage ? (
                                        <img src={receiptImage} alt="New Receipt" className="max-w-full max-h-[60vh] object-contain" />
                                    ) : (
                                        <span className="text-zinc-600 font-mono text-xs">ไม่มีรูปภาพบิลใหม่</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex justify-between items-center font-mono">
                            <span className="text-zinc-400 text-[11px]">
                                หากเป็นคนละใบเสร็จ ให้กดปิดหน้าต่างนี้แล้วกด &quot;SAVE EXPENSE RECORD&quot; ได้ตามปกติ
                            </span>
                            <button
                                type="button"
                                onClick={() => setCompareImage(null)}
                                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs cursor-pointer"
                            >
                                เข้าใจแล้ว / ปิดหน้าต่าง (CLOSE)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GEMINI API KEY SETUP MODAL */}
            {showApiKeyModal && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 p-4 font-sans text-xs">
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <div className="border-b border-[var(--color-rule)] pb-3">
                            <div className="font-mono text-[10px] font-bold text-[var(--color-accent)] uppercase">
                                CONFIGURATION // AI OCR
                            </div>
                            <h3 className="font-mono font-bold text-sm text-[var(--color-ink)] uppercase mt-0.5">
                                GOOGLE GEMINI VISION API KEY
                            </h3>
                        </div>

                        <p className="text-[12px] text-[var(--color-neutral)] leading-relaxed">
                            ระบบสแกนบิลใช้ Google Gemini Vision AI ซึ่งเปิดให้ใช้งานฟรี 
                            คุณสามารถรับ API Key ได้ทันทีจาก Google AI Studio:
                        </p>

                        <div className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-mono text-[11px]">
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--color-accent)] font-bold underline block"
                            >
                                &rarr; GET FREE GEMINI API KEY (aistudio.google.com)
                            </a>
                        </div>

                        <div>
                            <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-1">
                                PASTE YOUR GEMINI API KEY:
                            </label>
                            <input
                                type="password"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                placeholder="AIzaSy..."
                                className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-mono text-xs focus:border-[var(--color-ink)] focus:outline-none"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-1">
                                GEMINI AI MODEL:
                            </label>
                            <select
                                value={geminiModel}
                                onChange={(e) => {
                                    setGeminiModel(e.target.value);
                                    saveGeminiPreferredModel(e.target.value);
                                }}
                                className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-mono text-xs focus:border-[var(--color-ink)] focus:outline-none"
                            >
                                {GEMINI_SUPPORTED_MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                            <span className="font-mono text-[9px] text-[var(--color-muted)] mt-1 block">
                                * หากโมเดลที่เลือกไม่พร้อมใช้งาน ระบบจะสลับไปยังโมเดลสำรองให้อัตโนมัติ (Fallback Cascade)
                            </span>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-rule)]">
                            <button
                                type="button"
                                onClick={() => setShowApiKeyModal(false)}
                                className="px-4 py-2 border border-[var(--color-rule)] text-[var(--color-neutral)] font-mono font-bold text-xs hover:text-[var(--color-ink)] cursor-pointer"
                            >
                                CANCEL
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveApiKeyAndScan}
                                className="px-5 py-2 bg-[var(--color-ink)] text-[var(--color-paper)] font-mono font-bold text-xs cursor-pointer"
                            >
                                SAVE &amp; SCAN
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
