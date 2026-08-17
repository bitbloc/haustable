/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    X, 
    RotateCw, 
    Crop, 
    Sparkles, 
    Sliders, 
    Check, 
    RefreshCcw, 
    ZoomIn, 
    ZoomOut, 
    Download,
    Eye,
    Sun,
    Contrast,
    FileText
} from 'lucide-react';
import { 
    applyDocumentEnhancement, 
    detectReceiptCropBounds, 
    ENHANCEMENT_PRESETS,
    downloadFile 
} from '../../../utils/receiptImageProcessor';
import { toast } from 'sonner';

export default function ReceiptImageEnhancerModal({
    receiptItem,
    imageUrl,
    initialOptions = null,
    onSave,
    onClose
}) {
    // Current Enhancement Options State
    const [options, setOptions] = useState(() => {
        return initialOptions || {
            mode: 'bw',
            brightness: 10,
            contrast: 35,
            threshold: 148,
            sharpness: 1.5,
            rotation: 0,
            cropRect: null
        };
    });

    const [activePreset, setActivePreset] = useState('bw_clean');
    const [previewDataUrl, setPreviewDataUrl] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [autoCropLoading, setAutoCropLoading] = useState(false);
    const [compareWithOriginal, setCompareWithOriginal] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);

    const debounceTimerRef = useRef(null);

    // Render Preview via Canvas Engine
    const renderPreview = useCallback(async (optsToUse = options) => {
        if (!imageUrl) return;
        setIsProcessing(true);
        try {
            const result = await applyDocumentEnhancement(imageUrl, {
                ...optsToUse,
                maxDimension: 1800
            });
            setPreviewDataUrl(result.dataUrl);
        } catch (err) {
            console.error('Enhancement error:', err);
            toast.error('ไม่สามารถประมวลผลรูปภาพได้: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    }, [imageUrl, options]);

    // Live update when options change with debouncing for sliders
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            renderPreview(options);
        }, 60);

        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, [options, renderPreview]);

    // Apply Preset
    const handleSelectPreset = (preset) => {
        setActivePreset(preset.id);
        setOptions(prev => ({
            ...prev,
            ...preset.options
        }));
        toast.info(`เปิดใช้งานพรีเซ็ต: ${preset.label}`);
    };

    // Rotate 90 degrees
    const handleRotate = () => {
        setOptions(prev => ({
            ...prev,
            rotation: (prev.rotation + 90) % 360
        }));
    };

    // Auto Crop Action
    const handleAutoCrop = async () => {
        setAutoCropLoading(true);
        toast.info('กำลังตรวจจับขอบใบเสร็จอัตโนมัติ (Auto-Detecting Bounds)...');
        try {
            const bounds = await detectReceiptCropBounds(imageUrl, 0.015);
            setOptions(prev => ({
                ...prev,
                cropRect: bounds
            }));
            toast.success(`ตัดขอบอัตโนมัติสำเร็จ (${bounds.width}x${bounds.height}px)`);
        } catch (err) {
            toast.error('ตรวจจับขอบไม่สำเร็จ: ' + err.message);
        } finally {
            setAutoCropLoading(false);
        }
    };

    // Reset Crop
    const handleResetCrop = () => {
        setOptions(prev => ({
            ...prev,
            cropRect: null
        }));
        toast.info('รีเซ็ตการตัดขอบ (แสดงภาพเต็ม)');
    };

    // Save and Emit Result
    const handleConfirmSave = () => {
        if (!previewDataUrl) return;
        onSave({
            enhancedDataUrl: previewDataUrl,
            options: { ...options }
        });
        toast.success('บันทึกการปรับแต่งรูปภาพแล้ว');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 sm:p-4 font-sans text-xs">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
                
                {/* 1. Header Toolbar */}
                <div className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] px-4 py-3 flex items-center justify-between font-mono gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 bg-[var(--color-ink)] text-[var(--color-paper)] font-bold text-[9px] uppercase tracking-widest">
                            IMAGE//ENHANCER
                        </span>
                        <div>
                            <h2 className="font-bold text-sm text-[var(--color-ink)] uppercase">
                                ปรับแต่งภาพใบเสร็จคมชัด / ขาว-ดำ (RECEIPT TUNING BENCH)
                            </h2>
                            {receiptItem && (
                                <p className="text-[10px] text-[var(--color-muted)]">
                                    REF: #{receiptItem.refNo || receiptItem.id} • {receiptItem.vendor_name || receiptItem.title} • ฿{Number(receiptItem.amount || 0).toLocaleString()}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => downloadFile(previewDataUrl || imageUrl, `receipt_enhanced_${receiptItem?.id || 'tuner'}.jpg`)}
                            className="px-3 py-1.5 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] font-bold flex items-center gap-1.5 cursor-pointer text-[11px]"
                            title="ดาวน์โหลดภาพที่แต่งแล้ว"
                        >
                            <Download size={13} />
                            <span className="hidden sm:inline">DOWNLOAD</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 hover:bg-[var(--color-paper)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* 2. Main Studio Body (Split View: Preview on Left/Center, Controls on Right) */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                    
                    {/* Visual Preview Viewport (7 Cols) */}
                    <div className="lg:col-span-7 bg-zinc-950 flex flex-col justify-between relative overflow-hidden select-none border-b lg:border-b-0 lg:border-r border-[var(--color-rule)]">
                        
                        {/* Top Viewport Floating Controls */}
                        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between font-mono text-[10px] pointer-events-none">
                            <div className="flex items-center gap-1.5 bg-black/80 px-2.5 py-1 text-white border border-white/20 pointer-events-auto">
                                <span className={compareWithOriginal ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                    {compareWithOriginal ? '[ORIGINAL RAW VIEW]' : `[ENHANCED: ${options.mode.toUpperCase()}]`}
                                </span>
                                {options.cropRect && (
                                    <span className="text-zinc-400">
                                        • CROPPED ({options.cropRect.width}x{options.cropRect.height})
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5 bg-black/80 p-1 border border-white/20 pointer-events-auto">
                                <button
                                    type="button"
                                    onMouseDown={() => setCompareWithOriginal(true)}
                                    onMouseUp={() => setCompareWithOriginal(false)}
                                    onTouchStart={() => setCompareWithOriginal(true)}
                                    onTouchEnd={() => setCompareWithOriginal(false)}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                    title="กดค้างไว้เพื่อดูภาพต้นฉบับ"
                                >
                                    <Eye size={12} />
                                    <span>กดค้างเทียบต้นฉบับ</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.25))}
                                    className="p-1 hover:bg-zinc-700 text-white cursor-pointer"
                                    title="ซูมเข้า"
                                >
                                    <ZoomIn size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setZoomLevel(prev => Math.max(0.75, prev - 0.25))}
                                    className="p-1 hover:bg-zinc-700 text-white cursor-pointer"
                                    title="ซูมออก"
                                >
                                    <ZoomOut size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Centered Image Canvas View */}
                        <div className="flex-1 flex items-center justify-center p-6 overflow-auto min-h-[350px]">
                            {isProcessing && !previewDataUrl ? (
                                <div className="text-white font-mono flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                    <span>กำลังเรนเดอร์ภาพ...</span>
                                </div>
                            ) : (
                                <img
                                    src={compareWithOriginal ? imageUrl : (previewDataUrl || imageUrl)}
                                    alt="Enhanced Receipt"
                                    className="max-w-full max-h-[65vh] object-contain transition-all duration-150 shadow-2xl"
                                    style={{
                                        transform: `scale(${zoomLevel})`
                                    }}
                                />
                            )}
                        </div>

                        {/* Bottom Viewport Info Bar */}
                        <div className="bg-zinc-900 px-4 py-2 text-zinc-400 font-mono text-[10px] flex items-center justify-between border-t border-zinc-800">
                            <span>TIP: หมุนภาพให้ตรง และเลือกโหมดขาว-ดำ เพื่อให้ปริ้นได้คมชัดที่สุด</span>
                            <span>ZOOM: {Math.round(zoomLevel * 100)}%</span>
                        </div>
                    </div>

                    {/* Control Sliders & Presets Panel (5 Cols) */}
                    <div className="lg:col-span-5 p-4 sm:p-5 bg-[var(--color-paper)] overflow-y-auto space-y-5 font-mono">
                        
                        {/* Preset Buttons Grid */}
                        <div className="space-y-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-neutral)] block">
                                [1] ENHANCEMENT PRESETS (พรีเซ็ตด่วน)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {ENHANCEMENT_PRESETS.map((preset) => {
                                    const isSelected = activePreset === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => handleSelectPreset(preset)}
                                            className={`p-2.5 text-left border transition-all cursor-pointer flex flex-col justify-between ${
                                                isSelected
                                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                    : 'bg-[var(--color-paper-2)] text-[var(--color-ink)] border-[var(--color-rule)] hover:border-[var(--color-ink)]'
                                            }`}
                                        >
                                            <span className="font-bold text-[11px] block">{preset.label}</span>
                                            <span className={`text-[9px] mt-1 block leading-tight ${isSelected ? 'text-[var(--color-paper)]/70' : 'text-[var(--color-muted)]'}`}>
                                                {preset.description}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Quick Geometry Actions (Auto Crop, Rotate, Reset) */}
                        <div className="space-y-2 pt-2 border-t border-[var(--color-rule)]">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-neutral)] block">
                                [2] GEOMETRY &amp; CROPPING (ตัดขอบ &amp; หมุน)
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={handleAutoCrop}
                                    disabled={autoCropLoading}
                                    className="p-2 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                                >
                                    <Crop size={14} className={autoCropLoading ? 'animate-spin' : ''} />
                                    <span className="text-[10px]">AUTO CROP</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRotate}
                                    className="p-2 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                                >
                                    <RotateCw size={14} />
                                    <span className="text-[10px]">หมุน 90° ({options.rotation}°)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleResetCrop}
                                    className="p-2 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                                >
                                    <RefreshCcw size={14} />
                                    <span className="text-[10px]">รีเซ็ตขอบ</span>
                                </button>
                            </div>
                        </div>

                        {/* Granular Sliders (Brightness, Contrast, Threshold, Sharpness) */}
                        <div className="space-y-4 pt-2 border-t border-[var(--color-rule)]">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-neutral)] block">
                                [3] FINE-TUNING SLIDERS (ปรับแต่งละเอียด)
                            </span>

                            {/* Mode Radio */}
                            <div>
                                <label className="text-[10px] text-[var(--color-neutral)] uppercase block mb-1.5">
                                    COLOR MODE:
                                </label>
                                <div className="grid grid-cols-4 border border-[var(--color-rule)] divide-x divide-[var(--color-rule)] bg-[var(--color-paper-2)] text-center text-[10px] font-bold">
                                    {['bw', 'grayscale', 'color', 'original'].map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => {
                                                setOptions(prev => ({ ...prev, mode: m }));
                                                setActivePreset('custom');
                                            }}
                                            className={`py-1.5 transition-colors cursor-pointer ${
                                                options.mode === m 
                                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' 
                                                    : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                            }`}
                                        >
                                            {m.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Brightness Slider */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                    <span className="flex items-center gap-1 text-[var(--color-neutral)]">
                                        <Sun size={12} /> ความสว่าง (BRIGHTNESS):
                                    </span>
                                    <span className="font-bold">{options.brightness > 0 ? `+${options.brightness}` : options.brightness}</span>
                                </div>
                                <input
                                    type="range"
                                    min="-100"
                                    max="100"
                                    value={options.brightness}
                                    onChange={(e) => {
                                        setOptions(prev => ({ ...prev, brightness: Number(e.target.value) }));
                                        setActivePreset('custom');
                                    }}
                                    className="w-full accent-[var(--color-ink)] cursor-pointer"
                                />
                            </div>

                            {/* Contrast Slider */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                    <span className="flex items-center gap-1 text-[var(--color-neutral)]">
                                        <Contrast size={12} /> คอนทราสต์ (CONTRAST):
                                    </span>
                                    <span className="font-bold">{options.contrast > 0 ? `+${options.contrast}` : options.contrast}</span>
                                </div>
                                <input
                                    type="range"
                                    min="-100"
                                    max="100"
                                    value={options.contrast}
                                    onChange={(e) => {
                                        setOptions(prev => ({ ...prev, contrast: Number(e.target.value) }));
                                        setActivePreset('custom');
                                    }}
                                    className="w-full accent-[var(--color-ink)] cursor-pointer"
                                />
                            </div>

                            {/* B&W Threshold Slider (Only active in B&W mode) */}
                            {options.mode === 'bw' && (
                                <div className="space-y-1 bg-amber-500/10 p-2.5 border border-amber-500/30">
                                    <div className="flex justify-between text-[10px] text-amber-950 font-bold">
                                        <span>ระดับความเข้มตัวอักษร (B&W THRESHOLD):</span>
                                        <span>{options.threshold}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="50"
                                        max="220"
                                        value={options.threshold}
                                        onChange={(e) => {
                                            setOptions(prev => ({ ...prev, threshold: Number(e.target.value) }));
                                            setActivePreset('custom');
                                        }}
                                        className="w-full accent-amber-700 cursor-pointer"
                                    />
                                    <span className="text-[9px] text-amber-800 block">
                                        เลื่อนไปทางขวา = ตัวหนังสือเข้มขึ้น • เลื่อนไปทางซ้าย = ลบเงาพื้นหลัง
                                    </span>
                                </div>
                            )}

                            {/* Sharpness Slider */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                    <span className="flex items-center gap-1 text-[var(--color-neutral)]">
                                        <Sparkles size={12} /> ความคมชัด (SHARPNESS):
                                    </span>
                                    <span className="font-bold">{options.sharpness.toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="4"
                                    step="0.2"
                                    value={options.sharpness}
                                    onChange={(e) => {
                                        setOptions(prev => ({ ...prev, sharpness: Number(e.target.value) }));
                                        setActivePreset('custom');
                                    }}
                                    className="w-full accent-[var(--color-ink)] cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Bottom Footer Action Bar */}
                <div className="bg-[var(--color-paper-2)] border-t border-[var(--color-rule)] px-4 py-3 flex items-center justify-between font-mono">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] font-bold text-xs cursor-pointer"
                    >
                        CANCEL
                    </button>

                    <button
                        type="button"
                        onClick={handleConfirmSave}
                        disabled={isProcessing}
                        className="px-6 py-2 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                        <Check size={15} />
                        <span>APPLY &amp; SAVE (นำไปใช้)</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
