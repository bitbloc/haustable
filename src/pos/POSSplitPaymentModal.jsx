/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * component: split-payment-modal · genre: modern-minimal · theme: thai-modern
 * Dieter Rams Minimalist Structure & Thai Modern OKLCH tokens
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    X, Plus, Minus, Check, Users, Receipt, DollarSign, 
    CreditCard, QrCode, Banknote, Sparkles, Phone, UserCheck, 
    RefreshCw, ChevronRight, AlertCircle, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import generatePayload from 'promptpay-qr';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabaseClient';
import { normalizePromptPayId, getStorePromptpayId } from '../utils/printerHelper';
import { formatOrderItemOptions } from '../utils/menuHelper';

export default function POSSplitPaymentModal({
    order,
    activeBooking,
    includeTax = true,
    storePromptpayId: propPromptpayId,
    onClose,
    onConfirmSplit
}) {
    // 3 Split Modes: 'ITEMS' | 'EQUAL' | 'CUSTOM'
    const [splitMode, setSplitMode] = useState('ITEMS');
    
    // --- Mode 1: By Items States ---
    const [splitQuantities, setSplitQuantities] = useState({});
    
    // --- Mode 2: Equal Split States ---
    const [numPeople, setNumPeople] = useState(2);
    const [currentPersonIndex, setCurrentPersonIndex] = useState(0); // 0-indexed: Person 1
    const [completedEqualShares, setCompletedEqualShares] = useState([]); // [{ person: 1, amount: 250, method: 'qr' }]

    // --- Mode 3: Custom Amount States ---
    const [customAmountInput, setCustomAmountInput] = useState('');

    // --- Common Payment States ---
    const [paymentMethod, setPaymentMethod] = useState('qr'); // 'qr' | 'cash' | 'credit'
    const [cashReceived, setCashReceived] = useState('');
    
    // PromptPay settings resolution
    const [storePromptpayId, setStorePromptpayId] = useState(() => normalizePromptPayId(propPromptpayId || '0985284217'));

    useEffect(() => {
        if (propPromptpayId) {
            setStorePromptpayId(normalizePromptPayId(propPromptpayId));
            return;
        }
        const loadSettings = async () => {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['promptpay_id', 'receipt_shop_phone', 'contact_phone', 'admin_phone_contact', 'phone_number', 'printer_config']);
                if (data && data.length > 0) {
                    const settingsMap = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    let parsedCfg = {};
                    if (settingsMap.printer_config) {
                        try { parsedCfg = JSON.parse(settingsMap.printer_config); } catch (e) {}
                    }
                    const resolved = getStorePromptpayId(settingsMap, parsedCfg);
                    setStorePromptpayId(resolved);
                }
            } catch (e) {}
        };
        loadSettings();
    }, [propPromptpayId]);
    const [searchingMember, setSearchingMember] = useState(false);
    const [attachedSplitMember, setAttachedSplitMember] = useState(null);
    const [showMemberAttach, setShowMemberAttach] = useState(false);

    // Initial item quantities mapping
    useEffect(() => {
        const initial = {};
        (order?.items || []).forEach(item => {
            initial[item.id] = 0;
        });
        setSplitQuantities(initial);
    }, [order?.items]);

    // Table / Booking Info
    const tableName = activeBooking?.tables_layout?.table_name || activeBooking?.table_name || (activeBooking?.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN');
    const orderItems = order?.items || [];
    const hasUnsentItems = orderItems.some(item => !item.db_id);

    // Total order value calculation
    const orderSubtotal = useMemo(() => {
        return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }, [orderItems]);

    const orderTax = includeTax ? orderSubtotal * 0.07 : 0;
    const orderTotal = Math.ceil(orderSubtotal + orderTax);

    // Mode 1: Items Selection Calculation
    const selectedItems = useMemo(() => {
        return orderItems.map(item => ({
            ...item,
            selectedQty: splitQuantities[item.id] || 0
        })).filter(item => item.selectedQty > 0);
    }, [orderItems, splitQuantities]);

    const itemsSubtotal = useMemo(() => {
        return selectedItems.reduce((sum, item) => sum + (item.price * item.selectedQty), 0);
    }, [selectedItems]);

    const itemsTax = includeTax ? itemsSubtotal * 0.07 : 0;
    const itemsTotal = Math.ceil(itemsSubtotal + itemsTax);

    // Mode 2: Equal Split Calculation
    const equalSharesArray = useMemo(() => {
        const total = orderTotal;
        const count = Math.max(1, parseInt(numPeople) || 1);
        const baseShare = Math.floor(total / count);
        const remainder = total % count;
        
        // Distribute remainder 1 baht to the first 'remainder' people
        const shares = [];
        for (let i = 0; i < count; i++) {
            shares.push(baseShare + (i < remainder ? 1 : 0));
        }
        return shares;
    }, [orderTotal, numPeople]);

    const currentEqualAmount = equalSharesArray[currentPersonIndex] || 0;

    // Mode 3: Custom Amount Calculation
    const customAmountVal = parseFloat(customAmountInput) || 0;

    // Active Split Amount based on current mode
    const currentSplitAmount = useMemo(() => {
        if (splitMode === 'ITEMS') return itemsTotal;
        if (splitMode === 'EQUAL') return currentEqualAmount;
        if (splitMode === 'CUSTOM') return customAmountVal;
        return 0;
    }, [splitMode, itemsTotal, currentEqualAmount, customAmountVal]);

    // Remaining Table Balance after this split
    const remainingBalanceAfterSplit = useMemo(() => {
        return Math.max(0, orderTotal - currentSplitAmount);
    }, [orderTotal, currentSplitAmount]);

    // PromptPay QR Payload for the current split portion
    const splitQrPayload = useMemo(() => {
        if (currentSplitAmount <= 0) return null;
        try {
            return generatePayload(normalizePromptPayId(storePromptpayId), { amount: currentSplitAmount });
        } catch (e) {
            console.error("Split PromptPay QR generation error:", e);
            return null;
        }
    }, [currentSplitAmount, storePromptpayId]);

    // CFD Broadcast Communication (Live Sync to Customer Screen)
    const cfdChannel = useRef(null);
    useEffect(() => {
        try {
            cfdChannel.current = new BroadcastChannel('pos_cfd_channel');
        } catch (e) {}

        return () => {
            if (cfdChannel.current) {
                try { cfdChannel.current.close(); } catch (e) {}
            }
        };
    }, []);

    const broadcastToCFD = (payload) => {
        if (cfdChannel.current) {
            try { cfdChannel.current.postMessage(payload); } catch (e) {}
        }
        window.dispatchEvent(new CustomEvent('pos-cfd-broadcast', { detail: payload }));
        try {
            localStorage.setItem('pos_cfd_last_event', JSON.stringify(payload));
        } catch (e) {}
    };

    // Live Broadcast to CFD whenever split state changes
    useEffect(() => {
        if (currentSplitAmount > 0) {
            broadcastToCFD({
                type: 'SPLIT_CHECKOUT',
                payload: {
                    splitMode,
                    splitTotal: currentSplitAmount,
                    orderTotal,
                    remainingBalance: remainingBalanceAfterSplit,
                    tableName,
                    paymentMethod,
                    cashReceived: parseFloat(cashReceived) || 0,
                    changeDue: Math.max(0, (parseFloat(cashReceived) || 0) - currentSplitAmount),
                    selectedItems: splitMode === 'ITEMS' ? selectedItems : [],
                    equalSplitInfo: splitMode === 'EQUAL' ? {
                        currentPerson: currentPersonIndex + 1,
                        totalPeople: numPeople,
                        amount: currentEqualAmount
                    } : null,
                    qrPayload: splitQrPayload,
                    memberProfile: attachedSplitMember
                }
            });
        }

        return () => {
            // Restore CFD to Cart on close if unmounting
        };
    }, [
        splitMode, 
        currentSplitAmount, 
        orderTotal, 
        remainingBalanceAfterSplit, 
        tableName, 
        paymentMethod, 
        cashReceived, 
        selectedItems, 
        currentPersonIndex, 
        numPeople, 
        currentEqualAmount, 
        splitQrPayload, 
        attachedSplitMember
    ]);

    // Handle Item Qty Steppers
    const handleQtyChange = (itemId, delta, maxQty) => {
        setSplitQuantities(prev => {
            const cur = prev[itemId] || 0;
            const next = Math.max(0, Math.min(maxQty, cur + delta));
            return { ...prev, [itemId]: next };
        });
    };

    const handleSelectAllItems = () => {
        const all = {};
        orderItems.forEach(item => {
            all[item.id] = item.quantity;
        });
        setSplitQuantities(all);
    };

    const handleClearAllItems = () => {
        const cleared = {};
        orderItems.forEach(item => {
            cleared[item.id] = 0;
        });
        setSplitQuantities(cleared);
    };

    // Member Phone Lookup
    const handleSearchMember = async (e) => {
        e?.preventDefault();
        const clean = memberPhone.trim().replace(/\D/g, '');
        if (!clean || clean.length < 9) {
            toast.error("กรุณากรอกเบอร์โทรศัพท์ 9-10 หลักครับ");
            return;
        }

        setSearchingMember(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, display_name, nickname, phone_number, current_tier, xhaus_balance')
                .eq('phone_number', clean)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setAttachedSplitMember(data);
                toast.success(`พบสมาชิก: ${data.display_name} (${data.current_tier || 'Member'})`);
            } else {
                toast.info("ไม่พบข้อมูลสมาชิกเบอร์นี้");
            }
        } catch (err) {
            console.error("Search member error:", err);
            toast.error("ค้นหาสมาชิกไม่สำเร็จ");
        } finally {
            setSearchingMember(false);
        }
    };

    // Confirm Split Payment Execution
    const handleConfirm = () => {
        if (hasUnsentItems) {
            toast.error("มีรายการยังไม่ส่งครัว กรุณาส่งครัวก่อนแบ่งชำระครับ");
            return;
        }

        if (currentSplitAmount <= 0) {
            toast.error("ยอดชำระต้องมากกว่า ฿0 ครับ");
            return;
        }

        if (paymentMethod === 'cash') {
            const cashVal = parseFloat(cashReceived) || 0;
            if (cashVal < currentSplitAmount) {
                toast.error("จำนวนเงินสดที่รับมาไม่เพียงพอครับ");
                return;
            }
        }

        const cashRecvNum = parseFloat(cashReceived) || 0;
        const changeVal = paymentMethod === 'cash' ? Math.max(0, cashRecvNum - currentSplitAmount) : 0;

        // Broadcast success to CFD
        broadcastToCFD({
            type: 'SPLIT_SUCCESS',
            payload: {
                splitTotal: currentSplitAmount,
                remainingBalance: remainingBalanceAfterSplit,
                paymentMethod,
                memberProfile: attachedSplitMember
            }
        });

        // Trigger parent split confirmation
        onConfirmSplit({
            splitMode,
            paidItems: splitMode === 'ITEMS' ? selectedItems : [],
            splitTotal: currentSplitAmount,
            paymentMethod,
            cashReceived: cashRecvNum,
            changeDue: changeVal,
            attachedMember: attachedSplitMember,
            splitMeta: {
                splitMode,
                tableName,
                currentPersonIndex: splitMode === 'EQUAL' ? currentPersonIndex + 1 : null,
                totalPeople: splitMode === 'EQUAL' ? numPeople : null,
                remainingBalanceAfterSplit
            }
        });
    };

    return (
        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-2xl w-full max-w-2xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden text-[oklch(18%_0.012_28)] font-sans select-none animate-in fade-in zoom-in-95 duration-150">
            
            {/* 1. Structural Header */}
            <div className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-2.5 py-1 rounded-md">
                        โต๊ะ {tableName}
                    </span>
                    <div>
                        <h2 className="text-base font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                            SPLIT BILL PAYMENT / แบ่งชำระเงิน
                        </h2>
                        <p className="text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                            ยอดรวมทั้งโต๊ะ: <span className="font-bold text-[oklch(18%_0.012_28)]">฿{orderTotal.toLocaleString()}</span>
                        </p>
                    </div>
                </div>

                <button 
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white border border-[oklch(85%_0.012_28)] flex items-center justify-center text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(97%_0.008_28)] transition-all cursor-pointer"
                >
                    <X size={16} />
                </button>
            </div>

            {hasUnsentItems && (
                <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 text-xs text-amber-900 font-bold flex items-center gap-2">
                    <AlertCircle size={15} className="text-amber-600 shrink-0" />
                    <span>มีรายการยังไม่ส่งครัว! กรุณากดส่งครัวให้เรียบร้อยก่อนทำการแบ่งจ่ายครับ</span>
                </div>
            )}

            {/* 2. Three Tab Modes Navigation */}
            <div className="grid grid-cols-3 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] p-1.5 gap-1.5 font-mono text-xs font-bold uppercase tracking-wider">
                <button
                    type="button"
                    onClick={() => setSplitMode('ITEMS')}
                    className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        splitMode === 'ITEMS' 
                            ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs border border-[oklch(85%_0.012_28)] font-black' 
                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                    }`}
                >
                    <Receipt size={14} />
                    <span>1. ตามรายการ (ITEMS)</span>
                </button>

                <button
                    type="button"
                    onClick={() => setSplitMode('EQUAL')}
                    className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        splitMode === 'EQUAL' 
                            ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs border border-[oklch(85%_0.012_28)] font-black' 
                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                    }`}
                >
                    <Users size={14} />
                    <span>2. หารเท่า (EQUAL)</span>
                </button>

                <button
                    type="button"
                    onClick={() => setSplitMode('CUSTOM')}
                    className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        splitMode === 'CUSTOM' 
                            ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs border border-[oklch(85%_0.012_28)] font-black' 
                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                    }`}
                >
                    <DollarSign size={14} />
                    <span>3. กำหนดเอง (CUSTOM)</span>
                </button>
            </div>

            {/* 3. Tab Body Container */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[380px] scrollbar-none">
                
                {/* --- MODE 1: BY ITEMS --- */}
                {splitMode === 'ITEMS' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1">
                            <span className="text-xs font-mono text-[oklch(55%_0.010_28)] uppercase font-bold">
                                เลือกจำนวนสินค้าที่ต้องการจ่ายรอบนี้ ({selectedItems.length} จาก {orderItems.length} รายการ)
                            </span>
                            <div className="flex items-center gap-2 font-mono text-xs">
                                <button
                                    type="button"
                                    onClick={handleSelectAllItems}
                                    className="px-2.5 py-1 bg-white border border-[oklch(85%_0.012_28)] rounded-lg text-[oklch(18%_0.012_28)] font-bold hover:bg-[oklch(94%_0.010_28)] cursor-pointer"
                                >
                                    เลือกทั้งหมด
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClearAllItems}
                                    className="px-2.5 py-1 bg-white border border-[oklch(85%_0.012_28)] rounded-lg text-[oklch(55%_0.010_28)] hover:text-red-600 cursor-pointer"
                                >
                                    ล้าง
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {orderItems.map(item => {
                                const curSelected = splitQuantities[item.id] || 0;
                                const isSelected = curSelected > 0;
                                return (
                                    <div 
                                        key={item.id} 
                                        className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                                            isSelected 
                                                ? 'bg-white border-[oklch(52%_0.16_28)] shadow-xs' 
                                                : 'bg-[oklch(94%_0.010_28)]/60 border-[oklch(85%_0.012_28)] opacity-85'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1 mr-3">
                                            <h4 className="font-bold text-sm text-[oklch(18%_0.012_28)] uppercase truncate">
                                                {item.name}
                                            </h4>
                                            <div className="flex items-center gap-2 text-xs mt-0.5">
                                                <span className="font-mono font-bold text-[oklch(52%_0.16_28)]">
                                                    ฿{item.price.toLocaleString()}
                                                </span>
                                                <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                                    (สั่งทั้งหมด: {item.quantity})
                                                </span>
                                            </div>
                                            {(() => {
                                                const opts = formatOrderItemOptions(item.selected_options);
                                                if (opts.length === 0) return null;
                                                return (
                                                    <p className="text-[10px] font-mono text-[oklch(55%_0.010_28)] mt-0.5 line-clamp-1">
                                                        {opts.join(', ')}
                                                    </p>
                                                );
                                            })()}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="flex items-center bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-1 gap-1">
                                                <button 
                                                    type="button"
                                                    disabled={hasUnsentItems || curSelected <= 0}
                                                    onClick={() => handleQtyChange(item.id, -1, item.quantity)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white hover:bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] transition-all cursor-pointer disabled:opacity-30 active:scale-95 shadow-2xs"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                
                                                <span className={`w-8 text-center font-mono font-bold text-sm ${curSelected > 0 ? 'text-[oklch(52%_0.16_28)] font-black' : 'text-[oklch(55%_0.010_28)]'}`}>
                                                    {curSelected}
                                                </span>

                                                <button 
                                                    type="button"
                                                    disabled={hasUnsentItems || curSelected >= item.quantity}
                                                    onClick={() => handleQtyChange(item.id, 1, item.quantity)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white hover:bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] transition-all cursor-pointer disabled:opacity-30 active:scale-95 shadow-2xs"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleQtyChange(item.id, item.quantity - curSelected, item.quantity)}
                                                className="px-2.5 py-2 rounded-xl bg-white border border-[oklch(85%_0.012_28)] font-mono text-[11px] font-bold text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:border-[oklch(18%_0.012_28)] cursor-pointer"
                                            >
                                                MAX
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* --- MODE 2: EQUAL SPLIT --- */}
                {splitMode === 'EQUAL' && (
                    <div className="space-y-4">
                        <div>
                            <span className="text-xs font-mono text-[oklch(55%_0.010_28)] uppercase font-bold block mb-2">
                                เลือกจำนวนคนที่ต้องการหารเท่า
                            </span>
                            <div className="grid grid-cols-5 gap-2 font-mono">
                                {[2, 3, 4, 5, 6].map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => {
                                            setNumPeople(num);
                                            setCurrentPersonIndex(0);
                                        }}
                                        className={`py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                                            numPeople === num 
                                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)] shadow-sm' 
                                                : 'bg-white text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                        }`}
                                    >
                                        <span>{num} ท่าน</span>
                                        <span className="text-[10px] opacity-75 font-normal">
                                            ฿{Math.ceil(orderTotal / num).toLocaleString()}/คน
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Person Selection Stepper */}
                        <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2.5">
                                <span className="font-mono text-xs font-bold text-[oklch(55%_0.010_28)] uppercase">
                                    ลำดับการชำระ (PERSON STEPPER)
                                </span>
                                <span className="font-mono text-xs font-bold text-[oklch(52%_0.16_28)]">
                                    ท่านที่ {currentPersonIndex + 1} จากทั้งหมด {numPeople} ท่าน
                                </span>
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                {equalSharesArray.map((shareAmt, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setCurrentPersonIndex(idx)}
                                        className={`p-2.5 rounded-lg border text-center font-mono text-xs font-bold transition-all cursor-pointer ${
                                            currentPersonIndex === idx
                                                ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)] ring-2 ring-[oklch(52%_0.16_28)]/30'
                                                : 'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-white'
                                        }`}
                                    >
                                        <div className="text-[10px] opacity-80 uppercase">คนที่ {idx + 1}</div>
                                        <div className="text-sm font-black mt-0.5">฿{shareAmt.toLocaleString()}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODE 3: CUSTOM AMOUNT --- */}
                {splitMode === 'CUSTOM' && (
                    <div className="space-y-4">
                        <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-[oklch(55%_0.010_28)] uppercase">
                                    ระบุยอดเงินที่ต้องการชำระในรอบนี้
                                </span>
                                <span className="text-xs font-mono text-[oklch(55%_0.010_28)]">
                                    ยอดบิลรวม: ฿{orderTotal.toLocaleString()}
                                </span>
                            </div>

                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-mono font-black text-[oklch(55%_0.010_28)]">
                                    ฿
                                </span>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={customAmountInput}
                                    onChange={(e) => setCustomAmountInput(e.target.value)}
                                    className="w-full bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xl pl-10 pr-4 py-3 text-2xl font-mono font-black text-[oklch(18%_0.012_28)] outline-none focus:border-[oklch(18%_0.012_28)]"
                                />
                            </div>

                            {/* Quick Presets */}
                            <div className="grid grid-cols-4 gap-2 font-mono text-xs">
                                <button
                                    type="button"
                                    onClick={() => setCustomAmountInput(String(Math.ceil(orderTotal * 0.25)))}
                                    className="py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-bold hover:bg-white cursor-pointer"
                                >
                                    25% (฿{Math.ceil(orderTotal * 0.25).toLocaleString()})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomAmountInput(String(Math.ceil(orderTotal * 0.50)))}
                                    className="py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-bold hover:bg-white cursor-pointer"
                                >
                                    50% (฿{Math.ceil(orderTotal * 0.50).toLocaleString()})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomAmountInput(String(Math.ceil(orderTotal * 0.75)))}
                                    className="py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-bold hover:bg-white cursor-pointer"
                                >
                                    75% (฿{Math.ceil(orderTotal * 0.75).toLocaleString()})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomAmountInput(String(orderTotal))}
                                    className="py-2 bg-[oklch(18%_0.012_28)] text-white border border-[oklch(18%_0.012_28)] rounded-lg font-bold cursor-pointer"
                                >
                                    เต็มจำนวน
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Optional Member Attachment for this Split Payer */}
                <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3">
                    {!attachedSplitMember ? (
                        <div>
                            {!showMemberAttach ? (
                                <button
                                    type="button"
                                    onClick={() => setShowMemberAttach(true)}
                                    className="w-full flex items-center justify-between text-xs font-mono font-bold text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] cursor-pointer"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Phone size={13} />
                                        <span>สะสมแต้ม XHAUS สำหรับผู้จ่ายรอบนี้ (คลิกเพื่อระบุเบอร์)</span>
                                    </span>
                                    <Plus size={14} />
                                </button>
                            ) : (
                                <form onSubmit={handleSearchMember} className="flex items-center gap-2">
                                    <input
                                        type="tel"
                                        placeholder="ระบุเบอร์โทรสมาชิก (0812345678)"
                                        value={memberPhone}
                                        onChange={(e) => setMemberPhone(e.target.value)}
                                        className="flex-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg px-3 py-1.5 text-xs font-mono outline-none focus:border-[oklch(18%_0.012_28)]"
                                    />
                                    <button
                                        type="submit"
                                        disabled={searchingMember}
                                        className="bg-[oklch(18%_0.012_28)] text-white px-3 py-1.5 rounded-lg text-xs font-mono font-bold hover:bg-black cursor-pointer disabled:opacity-50"
                                    >
                                        {searchingMember ? 'ค้นหา...' : 'ค้นหา'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowMemberAttach(false)}
                                        className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] cursor-pointer"
                                    >
                                        <X size={14} />
                                    </button>
                                </form>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2">
                                <UserCheck size={14} className="text-emerald-600" />
                                <span className="font-bold text-[oklch(18%_0.012_28)]">
                                    สมาชิก: {attachedSplitMember.display_name} ({attachedSplitMember.phone_number})
                                </span>
                                <span className="bg-[oklch(52%_0.16_28)] text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                                    {attachedSplitMember.current_tier || 'Member'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setAttachedSplitMember(null);
                                    setMemberPhone('');
                                }}
                                className="text-[10px] text-red-600 font-bold hover:underline cursor-pointer"
                            >
                                ยกเลิก
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. Split Summary & Payment Tender Bar */}
            <div className="bg-[oklch(94%_0.010_28)] border-t border-[oklch(85%_0.012_28)] p-5 space-y-4">
                
                {/* Live Split Figures */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-[oklch(85%_0.012_28)] p-3 rounded-xl">
                        <span className="text-[10px] font-mono font-bold uppercase text-[oklch(55%_0.010_28)] block">
                            ยอดชำระรอบนี้ (CURRENT SPLIT)
                        </span>
                        <span className="text-2xl font-mono font-black text-[oklch(52%_0.16_28)]">
                            ฿{currentSplitAmount.toLocaleString()}
                        </span>
                    </div>

                    <div className="bg-white border border-[oklch(85%_0.012_28)] p-3 rounded-xl">
                        <span className="text-[10px] font-mono font-bold uppercase text-[oklch(55%_0.010_28)] block">
                            ยอดคงเหลือของโต๊ะ (REMAINING BALANCE)
                        </span>
                        <span className="text-xl font-mono font-bold text-[oklch(18%_0.012_28)]">
                            ฿{remainingBalanceAfterSplit.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Payment Method Selector */}
                <div className="flex bg-[oklch(85%_0.012_28)]/50 p-1 rounded-xl border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold uppercase tracking-wider gap-1 h-11">
                    <button 
                        type="button"
                        onClick={() => setPaymentMethod('qr')}
                        className={`flex-1 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            paymentMethod === 'qr' 
                                ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs font-black' 
                                : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                        }`}
                    >
                        <QrCode size={14} />
                        <span>PROMPTPAY QR</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex-1 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            paymentMethod === 'cash' 
                                ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs font-black' 
                                : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                        }`}
                    >
                        <Banknote size={14} />
                        <span>CASH (เงินสด)</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => setPaymentMethod('credit')}
                        className={`flex-1 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            paymentMethod === 'credit' 
                                ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs font-black' 
                                : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                        }`}
                    >
                        <CreditCard size={14} />
                        <span>บัตรเครดิต</span>
                    </button>
                </div>

                {/* Cash Tender Keypad Sub-panel */}
                {paymentMethod === 'cash' && (
                    <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold uppercase text-[oklch(55%_0.010_28)]">
                                รับเงินสดมา (CASH RECEIVED)
                            </span>
                            <input 
                                type="number"
                                placeholder="0.00"
                                value={cashReceived}
                                onChange={(e) => setCashReceived(e.target.value)}
                                className="w-36 text-right bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xl px-3 py-1.5 text-base font-mono font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-[oklch(18%_0.012_28)]"
                            />
                        </div>

                        {/* Quick cash denomination chips */}
                        <div className="flex gap-2 font-mono text-xs">
                            <button
                                type="button"
                                onClick={() => setCashReceived(String(currentSplitAmount))}
                                className="flex-1 py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-bold hover:bg-[oklch(97%_0.008_28)] cursor-pointer"
                            >
                                พอดี
                            </button>
                            {[100, 500, 1000].map(den => (
                                <button
                                    key={den}
                                    type="button"
                                    onClick={() => setCashReceived(String(den))}
                                    className="flex-1 py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-bold hover:bg-[oklch(97%_0.008_28)] cursor-pointer"
                                >
                                    ฿{den}
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-between items-center text-xs border-t border-dashed border-[oklch(85%_0.012_28)] pt-2 font-mono">
                            <span className="font-bold text-[oklch(55%_0.010_28)]">เงินทอน (CHANGE DUE)</span>
                            <span className={`font-bold text-sm ${parseFloat(cashReceived) >= currentSplitAmount ? 'text-emerald-700 font-black' : 'text-red-600'}`}>
                                {parseFloat(cashReceived) >= currentSplitAmount 
                                    ? `฿${Math.ceil(parseFloat(cashReceived) - currentSplitAmount).toLocaleString()}` 
                                    : cashReceived ? `ขาดอีก ฿${Math.ceil(currentSplitAmount - parseFloat(cashReceived)).toLocaleString()}` : '฿0'}
                            </span>
                        </div>
                    </div>
                )}

                {/* 5. Main Action Confirmation Button */}
                <button
                    type="button"
                    disabled={hasUnsentItems || currentSplitAmount <= 0}
                    onClick={handleConfirm}
                    className="w-full bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] border border-[oklch(42%_0.16_28)] text-white py-3.5 rounded-xl text-sm font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer h-12 flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                    <Check size={16} />
                    <span>
                        CONFIRM SPLIT PAY / ยืนยันชำระเงิน (฿{currentSplitAmount.toLocaleString()})
                    </span>
                </button>
            </div>
        </div>
    );
}
