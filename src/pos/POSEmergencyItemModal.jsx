/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export default function POSEmergencyItemModal({ isOpen, onClose, onConfirm }) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [destination, setDestination] = useState('kitchen'); // 'kitchen' | 'bar' | 'other'
    const [note, setNote] = useState('');
    
    const nameInputRef = useRef(null);

    // Quick Presets
    const PRESETS = [
        { label: 'เมนูพิเศษ', name: 'เมนูพิเศษ', destination: 'kitchen' },
        { label: 'เครื่องดื่มพิเศษ', name: 'เครื่องดื่มพิเศษ', destination: 'bar' },
        { label: 'ค่าเปิดขวด', name: 'ค่าเปิดขวด', destination: 'other', defaultPrice: '100' },
        { label: 'ของทานเล่น', name: 'ของทานเล่นพิเศษ', destination: 'kitchen' },
        { label: 'ค่าบริการ/อื่นๆ', name: 'ค่าบริการพิเศษ', destination: 'other' }
    ];

    // Quick Price Increment Chips
    const PRICE_INCREMENTS = [10, 20, 50, 100, 200, 500];

    useEffect(() => {
        if (isOpen) {
            setName('');
            setPrice('');
            setQuantity(1);
            setDestination('kitchen');
            setNote('');
            requestAnimationFrame(() => {
                if (nameInputRef.current) {
                    nameInputRef.current.focus();
                }
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleApplyPreset = (preset) => {
        setName(preset.name);
        setDestination(preset.destination);
        if (preset.defaultPrice && !price) {
            setPrice(preset.defaultPrice);
        }
    };

    const handleAddPrice = (increment) => {
        const current = parseFloat(price) || 0;
        setPrice(String(current + increment));
    };

    const handleConfirm = (e) => {
        if (e) e.preventDefault();

        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error('กรุณาระบุชื่อเมนูเพิ่มเติม');
            if (nameInputRef.current) nameInputRef.current.focus();
            return;
        }

        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            toast.error('กรุณาระบุราคาให้ถูกต้อง (ตั้งแต่ 0 บาทขึ้นไป)');
            return;
        }

        const parsedQty = parseInt(quantity) || 1;
        if (parsedQty <= 0) {
            toast.error('จำนวนต้องมากกว่า 0');
            return;
        }

        // Determine category mapping based on destination
        let categoryId = 'kitchen_custom';
        let categoryName = 'อาหาร';
        if (destination === 'bar') {
            categoryId = '7524bb8a-4698-45c6-aa17-d8ccc296f667'; // Default bar category
            categoryName = 'เครื่องดื่ม';
        } else if (destination === 'other') {
            categoryId = 'other_custom';
            categoryName = 'อื่นๆ';
        }

        const customItemPayload = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            menu_item_id: null,
            name: trimmedName,
            custom_name: trimmedName,
            price: parsedPrice,
            quantity: parsedQty,
            destination: destination,
            category_id: categoryId,
            category_name: categoryName,
            is_custom: true,
            is_emergency: true,
            item_note: note.trim(),
            selected_options: [
                { 
                    name: `[เมนูเพิ่มเติม${destination === 'bar' ? ' (บาร์)' : destination === 'other' ? ' (ทั่วไป)' : ' (ครัว)'}]`,
                    is_custom_badge: true,
                    custom_item_name: trimmedName,
                    destination: destination
                },
                ...(note.trim() ? [{ name: `หมายเหตุ: ${note.trim()}` }] : [])
            ]
        };

        onConfirm(customItemPayload);
        onClose();
    };

    const parsedPriceNum = parseFloat(price) || 0;
    const totalPrice = parsedPriceNum * (parseInt(quantity) || 1);

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 select-none touch-manipulation font-sans"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-lg bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[oklch(18%_0.012_28)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[oklch(55%_0.010_28)] block">
                            [CUSTOM / EMERGENCY ITEM]
                        </span>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                            เพิ่มเมนูเพิ่มเติม (กำหนดราคาเอง)
                        </h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="px-3 py-1 bg-white border border-[oklch(85%_0.012_28)] rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] cursor-pointer"
                    >
                        ปิด [ESC]
                    </button>
                </div>

                {/* Body Content */}
                <form onSubmit={handleConfirm} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                    {/* Quick Presets */}
                    <div>
                        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] block mb-1.5">
                            รายการด่วน (Quick Presets)
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {PRESETS.map((preset, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleApplyPreset(preset)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                        name === preset.name
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                            : 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:border-[oklch(55%_0.010_28)]'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Menu Item Name */}
                    <div>
                        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] block mb-1.5">
                            ชื่อรายการ / เมนู <span className="text-[oklch(52%_0.16_28)]">*</span>
                        </label>
                        <input 
                            ref={nameInputRef}
                            type="text"
                            required
                            placeholder="เช่น ต้มยำกุ้งพิเศษ, ค่าเปิดไวน์, เบียร์สดนำเข้า..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-white border border-[oklch(85%_0.012_28)] focus:border-[oklch(52%_0.16_28)] rounded-xl py-2.5 px-4 text-sm text-[oklch(18%_0.012_28)] placeholder-[oklch(55%_0.010_28)] outline-none font-medium transition-colors"
                        />
                    </div>

                    {/* Custom Price Input */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)]">
                                ราคาต่อหน่วย (THB) <span className="text-[oklch(52%_0.16_28)]">*</span>
                            </label>
                            <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)]">
                                ระบุ 0 หากเป็นรายการแถมฟรี
                            </span>
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-base text-[oklch(52%_0.16_28)]">
                                ฿
                            </span>
                            <input 
                                type="number"
                                step="any"
                                min="0"
                                required
                                placeholder="0.00"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full bg-white border border-[oklch(85%_0.012_28)] focus:border-[oklch(52%_0.16_28)] rounded-xl py-2.5 pl-9 pr-4 text-lg font-mono font-bold text-[oklch(18%_0.012_28)] placeholder-[oklch(55%_0.010_28)] outline-none transition-colors"
                            />
                        </div>

                        {/* Quick Price Increment Chips */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {PRICE_INCREMENTS.map(inc => (
                                <button
                                    key={inc}
                                    type="button"
                                    onClick={() => handleAddPrice(inc)}
                                    className="px-2.5 py-1 bg-white hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg text-xs font-mono font-bold text-[oklch(18%_0.012_28)] transition-colors cursor-pointer"
                                >
                                    +{inc}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setPrice('')}
                                className="px-2.5 py-1 bg-white hover:bg-red-50 border border-[oklch(85%_0.012_28)] rounded-lg text-xs font-mono font-bold text-red-600 transition-colors cursor-pointer"
                            >
                                ล้างราคา
                            </button>
                        </div>
                    </div>

                    {/* Quantity & Destination Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Quantity Counter */}
                        <div>
                            <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] block mb-1.5">
                                จำนวน (Quantity)
                            </label>
                            <div className="flex items-center bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-1 gap-1">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(prev => Math.max(1, (parseInt(prev) || 1) - 1))}
                                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-[oklch(94%_0.010_28)] hover:bg-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold text-lg cursor-pointer"
                                >
                                    -
                                </button>
                                <input 
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="flex-1 text-center font-mono font-bold text-lg text-[oklch(18%_0.012_28)] outline-none bg-transparent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setQuantity(prev => (parseInt(prev) || 1) + 1)}
                                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-[oklch(94%_0.010_28)] hover:bg-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold text-lg cursor-pointer"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Order Destination Routing */}
                        <div>
                            <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] block mb-1.5">
                                ปลายทางพิมพ์ใบสั่ง (Destination)
                            </label>
                            <div className="grid grid-cols-3 gap-1 bg-[oklch(94%_0.010_28)] p-1 border border-[oklch(85%_0.012_28)] rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setDestination('kitchen')}
                                    className={`py-2 px-1 rounded-lg text-xs font-mono font-bold uppercase tracking-tight transition-all cursor-pointer ${
                                        destination === 'kitchen'
                                            ? 'bg-white text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] shadow-xs'
                                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                    }`}
                                >
                                    ครัว (Food)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDestination('bar')}
                                    className={`py-2 px-1 rounded-lg text-xs font-mono font-bold uppercase tracking-tight transition-all cursor-pointer ${
                                        destination === 'bar'
                                            ? 'bg-white text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] shadow-xs'
                                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                    }`}
                                >
                                    บาร์ (Bar)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDestination('other')}
                                    className={`py-2 px-1 rounded-lg text-xs font-mono font-bold uppercase tracking-tight transition-all cursor-pointer ${
                                        destination === 'other'
                                            ? 'bg-white text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] shadow-xs'
                                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                    }`}
                                >
                                    ทั่วไป (Other)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Note / Special Instructions */}
                    <div>
                        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] block mb-1.5">
                            หมายเหตุเพิ่มเติม (Special Notes)
                        </label>
                        <input 
                            type="text"
                            placeholder="เช่น หวานน้อย, ไม่ใส่ผัก, เสิร์ฟแยกจาน..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full bg-white border border-[oklch(85%_0.012_28)] focus:border-[oklch(52%_0.16_28)] rounded-xl py-2.5 px-4 text-sm text-[oklch(18%_0.012_28)] placeholder-[oklch(55%_0.010_28)] outline-none font-medium transition-colors"
                        />
                    </div>

                    {/* Total Summary Banner */}
                    <div className="p-3.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xl flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)]">
                            คำนวณยอดรวม (Summary):
                        </span>
                        <div className="text-right">
                            <span className="text-xs font-mono text-[oklch(55%_0.010_28)] mr-2">
                                ฿{parsedPriceNum.toLocaleString()} x {quantity}
                            </span>
                            <span className="text-base font-mono font-bold text-[oklch(52%_0.16_28)]">
                                ฿{totalPrice.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-white hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)] transition-colors cursor-pointer"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex-2 py-3 px-4 bg-[oklch(18%_0.012_28)] hover:bg-black text-[oklch(97%_0.008_28)] rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-98"
                        >
                            + เพิ่มเมนูเพิ่มเติมลงบิล (฿{totalPrice.toLocaleString()})
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
