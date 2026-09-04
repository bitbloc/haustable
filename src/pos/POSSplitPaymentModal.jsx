/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * component: split-payment-modal · genre: modern-minimal · theme: thai-modern
 * Dieter Rams Minimalist Structure & Thai Modern OKLCH tokens
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    X, Plus, Minus, Check, Users, Receipt, DollarSign, 
    CreditCard, QrCode, Banknote, Sparkles, Phone, UserCheck, 
    RefreshCw, ChevronRight, AlertCircle, ArrowRight, Percent, History,
    Printer
} from 'lucide-react';
import { toast } from 'sonner';
import generatePayload from 'promptpay-qr';
import { supabase } from '../lib/supabaseClient';
import { normalizePromptPayId, getStorePromptpayId, getStorePromptpayName, printSplitQrSlip } from '../utils/printerHelper';
import { 
    calculateSplitBalance, 
    calculatePercentAmount 
} from '../utils/splitPaymentHelper';

export default function POSSplitPaymentModal({
    order,
    activeBooking,
    includeTax = true,
    storePromptpayId: propPromptpayId,
    onClose,
    onConfirmSplit,
    onPrintSplitQr
}) {
    // 3 Split Modes: 'EQUAL' | 'PERCENT' | 'CUSTOM'
    const [splitMode, setSplitMode] = useState('EQUAL');
    
    // Item Quantities Mapping State (Required for items selection calculation and steppers)
    const [splitQuantities, setSplitQuantities] = useState({});
    
    // --- Mode 1: Equal Split States ---
    const [numPeople, setNumPeople] = useState(2);
    const [currentPersonIndex, setCurrentPersonIndex] = useState(0); // 0-indexed: Person 1

    // --- Mode 3: Percentage Split States ---
    const [selectedPercent, setSelectedPercent] = useState(50); // Default 50%
    const [customPercentInput, setCustomPercentInput] = useState('');
    const [percentBasis, setPercentBasis] = useState('remaining'); // 'remaining' | 'total'

    // --- Mode 4: Custom Amount States ---
    const [customAmountInput, setCustomAmountInput] = useState('');

    // --- Common Payment States ---
    const [paymentMethod, setPaymentMethod] = useState('qr'); // 'qr' | 'cash' | 'credit'
    const [cashReceived, setCashReceived] = useState('');
    const [memberPhone, setMemberPhone] = useState('');
    const [searchingMember, setSearchingMember] = useState(false);
    const [attachedSplitMember, setAttachedSplitMember] = useState(null);
    const [showMemberAttach, setShowMemberAttach] = useState(false);
    const [showRoundsHistory, setShowRoundsHistory] = useState(false);
    const [printingQr, setPrintingQr] = useState(false);

    // PromptPay settings resolution
    const [storePromptpayId, setStorePromptpayId] = useState(() => normalizePromptPayId(propPromptpayId || '0614232455'));
    const [storePromptpayName, setStorePromptpayName] = useState('ธัญญธร ศรีวิเศษ');

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
                    .in('key', ['promptpay_id', 'promptpay_name', 'receipt_promptpay_name', 'receipt_shop_phone', 'contact_phone', 'admin_phone_contact', 'phone_number', 'printer_config']);
                if (data && data.length > 0) {
                    const settingsMap = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    let parsedCfg = {};
                    if (settingsMap.printer_config) {
                        try { parsedCfg = JSON.parse(settingsMap.printer_config); } catch (e) {}
                    }
                    const resolved = getStorePromptpayId(settingsMap, parsedCfg);
                    setStorePromptpayId(resolved);
                    
                    const resolvedName = getStorePromptpayName(settingsMap, parsedCfg);
                    setStorePromptpayName(resolvedName);
                }
            } catch (e) {}
        };
        loadSettings();
    }, [propPromptpayId]);

    // Table / Booking Info
    const tableName = activeBooking?.tables_layout?.table_name || activeBooking?.table_name || (activeBooking?.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN');
    const orderItems = useMemo(() => order?.items || [], [order?.items]);
    const hasUnsentItems = orderItems.some(item => !item.db_id);

    // Initial item quantities mapping
    useEffect(() => {
        const initial = {};
        orderItems.forEach(item => {
            initial[item.id] = 0;
        });
        setSplitQuantities(initial);
    }, [orderItems]);

    // Comprehensive multi-round balance calculation
    const splitBalance = useMemo(() => {
        return calculateSplitBalance(activeBooking, orderItems, includeTax);
    }, [activeBooking, orderItems, includeTax]);

    const { 
        fullOrderTotal, 
        alreadyPaid, 
        remainingBalance, 
        currentRoundNumber, 
        rounds: previousRounds 
    } = splitBalance;

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

    // Mode 2: Equal Split Calculation (Based on remaining balance to guarantee settling)
    const equalSharesArray = useMemo(() => {
        const targetTotal = remainingBalance > 0 ? remainingBalance : fullOrderTotal;
        const count = Math.max(1, parseInt(numPeople) || 1);
        const baseShare = Math.floor(targetTotal / count);
        const remainder = targetTotal % count;
        
        // Distribute remainder 1 baht to the first 'remainder' people
        const shares = [];
        for (let i = 0; i < count; i++) {
            shares.push(baseShare + (i < remainder ? 1 : 0));
        }
        return shares;
    }, [remainingBalance, fullOrderTotal, numPeople]);

    const currentEqualAmount = equalSharesArray[currentPersonIndex] || 0;

    // Mode 3: Percentage Calculation
    const activePercentValue = useMemo(() => {
        if (customPercentInput !== '') {
            const parsed = parseFloat(customPercentInput);
            return isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
        }
        return selectedPercent;
    }, [customPercentInput, selectedPercent]);

    const percentCalculatedAmount = useMemo(() => {
        const base = percentBasis === 'total' ? fullOrderTotal : remainingBalance;
        const calculated = calculatePercentAmount(activePercentValue, base);
        return Math.min(remainingBalance, calculated);
    }, [activePercentValue, percentBasis, fullOrderTotal, remainingBalance]);

    // Mode 4: Custom Amount Calculation
    const customAmountVal = parseFloat(customAmountInput) || 0;

    // Active Split Amount based on current mode
    const currentSplitAmount = useMemo(() => {
        if (splitMode === 'ITEMS') return itemsTotal;
        if (splitMode === 'EQUAL') return currentEqualAmount;
        if (splitMode === 'PERCENT') return percentCalculatedAmount;
        if (splitMode === 'CUSTOM') return customAmountVal;
        return 0;
    }, [splitMode, itemsTotal, currentEqualAmount, percentCalculatedAmount, customAmountVal]);

    // Remaining Table Balance after this split
    const remainingBalanceAfterSplit = useMemo(() => {
        return Math.max(0, remainingBalance - currentSplitAmount);
    }, [remainingBalance, currentSplitAmount]);

    // PromptPay QR Payload for the current split portion (only needed when paying by QR)
    const splitQrPayload = useMemo(() => {
        if (paymentMethod !== 'qr' || currentSplitAmount <= 0) return null;
        try {
            return generatePayload(normalizePromptPayId(storePromptpayId), { amount: currentSplitAmount });
        } catch (e) {
            console.error("Split PromptPay QR generation error:", e);
            return null;
        }
    }, [paymentMethod, currentSplitAmount, storePromptpayId]);

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
        const enriched = { ...payload, timestamp: payload.timestamp || Date.now() };
        if (cfdChannel.current) {
            try { cfdChannel.current.postMessage(enriched); } catch (e) {}
        }
        try {
            if (window.AndroidCfdBridge && typeof window.AndroidCfdBridge.sendCfdEvent === 'function') {
                window.AndroidCfdBridge.sendCfdEvent(JSON.stringify(enriched));
            }
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('pos-cfd-broadcast', { detail: enriched }));
        try {
            localStorage.setItem('pos_cfd_last_event', JSON.stringify(enriched));
        } catch (e) {}
    };

    // Live Broadcast to CFD whenever split state changes (debounced by 120ms to prevent Android WebView lockup)
    useEffect(() => {
        if (currentSplitAmount <= 0) return;

        const timer = setTimeout(() => {
            broadcastToCFD({
                type: 'SPLIT_CHECKOUT',
                payload: {
                    splitMode,
                    splitTotal: currentSplitAmount,
                    orderTotal: fullOrderTotal,
                    alreadyPaidAmount: alreadyPaid,
                    currentRound: currentRoundNumber,
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
                    percentInfo: splitMode === 'PERCENT' ? {
                        percent: activePercentValue,
                        basis: percentBasis
                    } : null,
                    qrPayload: splitQrPayload,
                    promptpayId: storePromptpayId || '0614232455',
                    promptpayName: storePromptpayName || 'ธัญญธร ศรีวิเศษ',
                    memberProfile: attachedSplitMember
                }
            });
        }, 120);

        return () => clearTimeout(timer);
    }, [
        splitMode, 
        currentSplitAmount, 
        fullOrderTotal, 
        alreadyPaid,
        currentRoundNumber,
        remainingBalanceAfterSplit, 
        tableName, 
        paymentMethod, 
        cashReceived, 
        selectedItems, 
        currentPersonIndex, 
        numPeople, 
        currentEqualAmount,
        activePercentValue,
        percentBasis,
        splitQrPayload, 
        attachedSplitMember,
        storePromptpayId,
        storePromptpayName
    ]);

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

    // Print Dedicated PromptPay QR Thermal Slip for the current or custom split chunk
    const handlePrintChunkQrSlip = async (customRound = null) => {
        const roundToPrint = customRound?.round || currentRoundNumber;
        const amountToPrint = customRound ? Number(customRound.amount) : currentSplitAmount;
        if (amountToPrint <= 0) {
            toast.error("ยอดชำระต้องมากกว่า ฿0 ครับ");
            return;
        }

        setPrintingQr(true);
        const toastId = toast.loading(`กำลังพิมพ์สลิป QR ยอด ฿${amountToPrint.toLocaleString()}...`);
        try {
            const splitDetails = {
                tableName,
                roundNumber: roundToPrint,
                splitAmount: amountToPrint,
                fullOrderTotal,
                remainingBalanceAfterSplit: customRound ? Math.max(0, fullOrderTotal - alreadyPaid) : remainingBalanceAfterSplit,
                payerName: customRound?.payer || attachedSplitMember?.display_name || null,
                promptpayName: storePromptpayName,
                promptpayId: storePromptpayId
            };

            if (onPrintSplitQr) {
                await onPrintSplitQr(splitDetails);
            } else {
                await printSplitQrSlip(activeBooking, splitDetails);
            }
            toast.success(`พิมพ์สลิป QR รอบที่ ${roundToPrint} (฿${amountToPrint.toLocaleString()}) เรียบร้อยแล้ว`, { id: toastId });
        } catch (err) {
            console.error("Print split QR failed:", err);
            toast.error("พิมพ์สลิป QR ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อเครื่องพิมพ์", { id: toastId });
        } finally {
            setPrintingQr(false);
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

        // Trigger parent split confirmation with rich round metadata
        onConfirmSplit({
            splitMode,
            splitTotal: currentSplitAmount,
            paymentMethod,
            cashReceived: cashRecvNum,
            changeDue: changeVal,
            attachedMember: attachedSplitMember,
            splitMeta: {
                splitMode,
                tableName,
                roundNumber: currentRoundNumber,
                selectedPercent: splitMode === 'PERCENT' ? activePercentValue : null,
                currentPersonIndex: splitMode === 'EQUAL' ? currentPersonIndex + 1 : null,
                totalPeople: splitMode === 'EQUAL' ? numPeople : null,
                remainingBalanceAfterSplit,
                fullOrderTotal,
                alreadyPaidAmount: alreadyPaid
            }
        });

        // Reset inputs for next chunk if balance remains
        if (remainingBalanceAfterSplit > 0) {
            setCustomAmountInput('');
            setCashReceived('');
            if (splitMode === 'EQUAL') {
                setCurrentPersonIndex(prev => Math.min(numPeople - 1, prev + 1));
            }
        }
    };

    return (
        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-2xl w-full max-w-xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden text-[oklch(18%_0.012_28)] font-sans select-none animate-in fade-in zoom-in-95 duration-100">
            
            {/* 1. Structural Header */}
            <div className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-2 py-0.5 rounded-md">
                        โต๊ะ {tableName}
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                                SPLIT BILL PAYMENT / แบ่งชำระเงิน
                            </h2>
                            <span className="bg-[oklch(52%_0.16_28)] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full">
                                รอบที่ {currentRoundNumber}
                            </span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[11px] font-mono text-[oklch(55%_0.010_28)] mt-0.5">
                            <span>บิลรวม: <b className="text-[oklch(18%_0.012_28)]">฿{fullOrderTotal.toLocaleString()}</b></span>
                            {alreadyPaid > 0 && (
                                <>
                                    <span>•</span>
                                    <span>จ่ายแล้ว ({previousRounds.length} รอบ): <b className="text-emerald-700">฿{alreadyPaid.toLocaleString()}</b></span>
                                    <span>•</span>
                                    <span>คงเหลือ: <b className="text-[oklch(52%_0.16_28)]">฿{remainingBalance.toLocaleString()}</b></span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {previousRounds.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowRoundsHistory(!showRoundsHistory)}
                            className={`px-2 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                showRoundsHistory
                                    ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                                    : 'bg-white text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)] hover:text-[oklch(18%_0.012_28)]'
                            }`}
                        >
                            <History size={12} />
                            <span>ประวัติ ({previousRounds.length})</span>
                        </button>
                    )}

                    <button 
                        onClick={onClose}
                        className="w-7 h-7 rounded-full bg-white border border-[oklch(85%_0.012_28)] flex items-center justify-center text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(97%_0.008_28)] transition-all cursor-pointer"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* Split Rounds History Dropdown Bar */}
            {showRoundsHistory && previousRounds.length > 0 && (
                <div className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] px-4 py-2 space-y-1 font-mono text-xs animate-in slide-in-from-top-2 duration-100 shrink-0">
                    <span className="text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase block">
                        ประวัติการชำระแบ่งจ่ายโต๊ะนี้:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {previousRounds.map((r, idx) => (
                            <div key={idx} className="bg-white border border-[oklch(85%_0.012_28)] px-2 py-0.5 rounded-lg flex items-center gap-1.5 text-[11px] shadow-2xs">
                                <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[8px] font-black">
                                    ✓
                                </span>
                                <span className="font-bold text-[oklch(18%_0.012_28)]">
                                    รอบ {r.round}: ฿{r.amount.toLocaleString()}
                                </span>
                                <span className="text-[9px] uppercase bg-[oklch(94%_0.010_28)] px-1 py-0.2 rounded text-[oklch(55%_0.010_28)] font-bold">
                                    {r.method}
                                </span>
                                {r.percent && (
                                    <span className="text-[9px] text-[oklch(52%_0.16_28)] font-bold">
                                        ({r.percent}%)
                                    </span>
                                )}
                                <button
                                    type="button"
                                    title={`พิมพ์สลิป QR รอบที่ ${r.round}`}
                                    onClick={() => handlePrintChunkQrSlip(r)}
                                    disabled={printingQr}
                                    className="p-0.5 hover:bg-[oklch(94%_0.010_28)] rounded text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] cursor-pointer transition-colors"
                                >
                                    <Printer size={11} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {hasUnsentItems && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 font-bold flex items-center gap-2 shrink-0">
                    <AlertCircle size={14} className="text-amber-600 shrink-0" />
                    <span>มีรายการยังไม่ส่งครัว! กรุณากดส่งครัวให้เรียบร้อยก่อนทำการแบ่งจ่ายครับ</span>
                </div>
            )}

            {/* 2. Three Tab Modes Navigation */}
            <div className="grid grid-cols-3 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] p-1 gap-1 font-mono text-[11px] font-bold uppercase tracking-wider shrink-0">
                <button
                    type="button"
                    onClick={() => setSplitMode('EQUAL')}
                    className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        splitMode === 'EQUAL' 
                            ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs border border-[oklch(85%_0.012_28)] font-black' 
                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                    }`}
                >
                    <Users size={12} />
                    <span>1. หารเท่า (คน)</span>
                </button>

                <button
                    type="button"
                    onClick={() => setSplitMode('PERCENT')}
                    className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        splitMode === 'PERCENT' 
                            ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs border border-[oklch(85%_0.012_28)] font-black' 
                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                    }`}
                >
                    <Percent size={12} />
                    <span>2. ใส่ % เอง (ปัดเศษ)</span>
                </button>

                <button
                    type="button"
                    onClick={() => setSplitMode('CUSTOM')}
                    className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        splitMode === 'CUSTOM' 
                            ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs border border-[oklch(85%_0.012_28)] font-black' 
                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                    }`}
                >
                    <DollarSign size={12} />
                    <span>3. ระบุยอดบาท</span>
                </button>
            </div>

            {/* 3. Tab Body Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px] scrollbar-none">
                
                {/* --- MODE 1: EQUAL SPLIT --- */}
                {splitMode === 'EQUAL' && (
                    <div className="space-y-3">
                        <div>
                            <span className="text-[11px] font-mono text-[oklch(55%_0.010_28)] uppercase font-bold block mb-1.5">
                                เลือกจำนวนคนที่ต้องการหารเท่า
                            </span>
                            <div className="grid grid-cols-5 gap-1.5 font-mono">
                                {[2, 3, 4, 5, 6].map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => {
                                            setNumPeople(num);
                                            setCurrentPersonIndex(0);
                                        }}
                                        className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                                            numPeople === num 
                                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)] shadow-sm' 
                                                : 'bg-white text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                        }`}
                                    >
                                        <span>{num} ท่าน</span>
                                        <span className="text-[9px] opacity-75 font-normal">
                                            ฿{Math.ceil(remainingBalance / num).toLocaleString()}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Person Selection Stepper */}
                        <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-1.5">
                                <span className="font-mono text-[11px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                    ลำดับการชำระ (PERSON STEPPER)
                                </span>
                                <span className="font-mono text-[11px] font-bold text-[oklch(52%_0.16_28)]">
                                    ท่านที่ {currentPersonIndex + 1} จากทั้งหมด {numPeople} ท่าน
                                </span>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                {equalSharesArray.map((shareAmt, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setCurrentPersonIndex(idx)}
                                        className={`p-2 rounded-lg border text-center font-mono text-xs font-bold transition-all cursor-pointer ${
                                            currentPersonIndex === idx
                                                ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)] ring-2 ring-[oklch(52%_0.16_28)]/30'
                                                : 'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-white'
                                        }`}
                                    >
                                        <div className="text-[9px] opacity-80 uppercase">คนที่ {idx + 1}</div>
                                        <div className="text-xs font-black mt-0.5">฿{shareAmt.toLocaleString()}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODE 2: PERCENTAGE SPLIT (%) --- */}
                {splitMode === 'PERCENT' && (
                    <div className="space-y-3">
                        {/* Basis Switcher (if already partially paid) */}
                        {alreadyPaid > 0 && (
                            <div className="flex bg-[oklch(94%_0.010_28)] p-1 rounded-xl border border-[oklch(85%_0.012_28)] font-mono text-[10px] font-bold">
                                <button
                                    type="button"
                                    onClick={() => setPercentBasis('remaining')}
                                    className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                                        percentBasis === 'remaining'
                                            ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs font-black'
                                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                    }`}
                                >
                                    % ของยอดคงเหลือ (฿{remainingBalance.toLocaleString()})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPercentBasis('total')}
                                    className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                                        percentBasis === 'total'
                                            ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs font-black'
                                            : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                    }`}
                                >
                                    % ของบิลรวมทั้งโต๊ะ (฿{fullOrderTotal.toLocaleString()})
                                </button>
                            </div>
                        )}

                        {/* Direct Percentage Input with Ceil Rounding */}
                        <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-mono font-bold text-[oklch(18%_0.012_28)] uppercase block">
                                        ระบุ % ที่ต้องการชำระก้อนนี้
                                    </span>
                                    <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)]">
                                        คำนวณแบบปัดเศษขึ้นเต็มบาท ไม่ตกหล่นเศษสตางค์
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 font-mono text-sm">
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        step="any"
                                        placeholder="50"
                                        value={customPercentInput}
                                        onChange={(e) => {
                                            setCustomPercentInput(e.target.value);
                                        }}
                                        className="w-18 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg px-2 py-1 text-center font-black text-[oklch(18%_0.012_28)] text-sm outline-none focus:border-[oklch(18%_0.012_28)]"
                                    />
                                    <span className="font-bold text-[oklch(55%_0.010_28)]">%</span>
                                </div>
                            </div>

                            {/* Quick Percent Presets Grid */}
                            <div className="grid grid-cols-6 gap-1.5 font-mono">
                                {[20, 25, 33.33, 50, 75, 100].map(pct => {
                                    const isSelected = customPercentInput === '' && selectedPercent === pct;
                                    const baseVal = percentBasis === 'total' ? fullOrderTotal : remainingBalance;
                                    const calculatedVal = calculatePercentAmount(pct, baseVal);

                                    return (
                                        <button
                                            key={pct}
                                            type="button"
                                            onClick={() => {
                                                setSelectedPercent(pct);
                                                setCustomPercentInput('');
                                            }}
                                            className={`py-1.5 px-1 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center ${
                                                isSelected
                                                    ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)] shadow-sm'
                                                    : 'bg-white text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                            }`}
                                        >
                                            <span className="text-[11px] font-black">{pct === 33.33 ? '33.3%' : `${pct}%`}</span>
                                            <span className="text-[9px] opacity-75 mt-0.5">
                                                ฿{calculatedVal.toLocaleString()}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Math Summary Badge */}
                            <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg px-2.5 py-1.5 flex items-center justify-between font-mono text-xs">
                                <span className="text-[oklch(55%_0.010_28)]">
                                    {activePercentValue}% ของ {percentBasis === 'total' ? 'บิลรวม' : 'ยอดคงเหลือ'}
                                </span>
                                <div className="flex items-center gap-1 font-bold text-[oklch(18%_0.012_28)]">
                                    <span>= ฿{percentCalculatedAmount.toLocaleString()}</span>
                                    {remainingBalanceAfterSplit === 0 && (
                                        <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-bold ml-1">
                                            ปิดบิล 100%
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODE 4: CUSTOM BAHT AMOUNT --- */}
                {splitMode === 'CUSTOM' && (
                    <div className="space-y-3">
                        <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-[oklch(55%_0.010_28)] uppercase">
                                    ระบุยอดเงินที่ต้องการชำระในรอบนี้
                                </span>
                                <span className="text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                                    คงเหลือ: ฿{remainingBalance.toLocaleString()}
                                </span>
                            </div>

                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-mono font-black text-[oklch(55%_0.010_28)]">
                                    ฿
                                </span>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={customAmountInput}
                                    onChange={(e) => setCustomAmountInput(e.target.value)}
                                    className="w-full bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xl pl-9 pr-3 py-2 text-xl font-mono font-black text-[oklch(18%_0.012_28)] outline-none focus:border-[oklch(18%_0.012_28)]"
                                />
                            </div>

                            {/* Quick Presets */}
                            <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                                <button
                                    type="button"
                                    onClick={() => setCustomAmountInput(String(Math.ceil(remainingBalance * 0.25)))}
                                    className="py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-bold hover:bg-white cursor-pointer"
                                >
                                    25% (฿{Math.ceil(remainingBalance * 0.25).toLocaleString()})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomAmountInput(String(Math.ceil(remainingBalance * 0.50)))}
                                    className="py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-bold hover:bg-white cursor-pointer"
                                >
                                    50% (฿{Math.ceil(remainingBalance * 0.50).toLocaleString()})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomAmountInput(String(Math.ceil(remainingBalance * 0.75)))}
                                    className="py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-bold hover:bg-white cursor-pointer"
                                >
                                    75% (฿{Math.ceil(remainingBalance * 0.75).toLocaleString()})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomAmountInput(String(remainingBalance))}
                                    className="py-1.5 bg-[oklch(18%_0.012_28)] text-white border border-[oklch(18%_0.012_28)] rounded-lg font-bold cursor-pointer"
                                >
                                    ทั้งหมด (฿{remainingBalance.toLocaleString()})
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Optional Member Attachment for this Split Payer */}
                <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-2.5">
                    {!attachedSplitMember ? (
                        <div>
                            {!showMemberAttach ? (
                                <button
                                    type="button"
                                    onClick={() => setShowMemberAttach(true)}
                                    className="w-full flex items-center justify-between text-xs font-mono font-bold text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] cursor-pointer"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Phone size={12} />
                                        <span>สะสมแต้ม XHAUS สำหรับผู้จ่ายรอบนี้ (ระบุเบอร์)</span>
                                    </span>
                                    <Plus size={13} />
                                </button>
                            ) : (
                                <form onSubmit={handleSearchMember} className="flex items-center gap-2">
                                    <input
                                        type="tel"
                                        placeholder="ระบุเบอร์โทรสมาชิก (0812345678)"
                                        value={memberPhone}
                                        onChange={(e) => setMemberPhone(e.target.value)}
                                        className="flex-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg px-2.5 py-1 text-xs font-mono outline-none focus:border-[oklch(18%_0.012_28)]"
                                    />
                                    <button
                                        type="submit"
                                        disabled={searchingMember}
                                        className="bg-[oklch(18%_0.012_28)] text-white px-2.5 py-1 rounded-lg text-xs font-mono font-bold hover:bg-black cursor-pointer disabled:opacity-50"
                                    >
                                        {searchingMember ? '...' : 'ค้นหา'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowMemberAttach(false)}
                                        className="p-1 text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] cursor-pointer"
                                    >
                                        <X size={13} />
                                    </button>
                                </form>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2">
                                <UserCheck size={13} className="text-emerald-600" />
                                <span className="font-bold text-[oklch(18%_0.012_28)]">
                                    สมาชิก: {attachedSplitMember.display_name} ({attachedSplitMember.phone_number})
                                </span>
                                <span className="bg-[oklch(52%_0.16_28)] text-white text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
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
            <div className="bg-[oklch(94%_0.010_28)] border-t border-[oklch(85%_0.012_28)] p-4 space-y-3 shrink-0">
                
                {/* Live Split Figures */}
                <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white border border-[oklch(85%_0.012_28)] p-2.5 rounded-xl">
                        <span className="text-[10px] font-mono font-bold uppercase text-[oklch(55%_0.010_28)] block">
                            ยอดชำระรอบนี้ (รอบที่ {currentRoundNumber})
                        </span>
                        <span className="text-xl font-mono font-black text-[oklch(52%_0.16_28)]">
                            ฿{currentSplitAmount.toLocaleString()}
                        </span>
                    </div>

                    <div className="bg-white border border-[oklch(85%_0.012_28)] p-2.5 rounded-xl">
                        <span className="text-[10px] font-mono font-bold uppercase text-[oklch(55%_0.010_28)] block">
                            ยอดคงเหลือหลังชำระ
                        </span>
                        <span className={`text-lg font-mono font-bold ${remainingBalanceAfterSplit === 0 ? 'text-emerald-700 font-black' : 'text-[oklch(18%_0.012_28)]'}`}>
                            ฿{remainingBalanceAfterSplit.toLocaleString()}
                            {remainingBalanceAfterSplit === 0 && (
                                <span className="text-[11px] text-emerald-600 font-normal ml-1">(ครบถ้วน)</span>
                            )}
                        </span>
                    </div>
                </div>

                {/* Payment Method Selector */}
                <div className="flex bg-[oklch(85%_0.012_28)]/50 p-1 rounded-xl border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold uppercase tracking-wider gap-1 h-10">
                    <button 
                        type="button"
                        onClick={() => setPaymentMethod('qr')}
                        className={`flex-1 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            paymentMethod === 'qr' 
                                ? 'bg-white text-[oklch(18%_0.012_28)] shadow-xs font-black' 
                                : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                        }`}
                    >
                        <QrCode size={13} />
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
                        <Banknote size={13} />
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
                        <CreditCard size={13} />
                        <span>บัตรเครดิต</span>
                    </button>
                </div>

                {/* PromptPay QR Sub-panel: Simplified without redundant cashier screen QR */}
                {paymentMethod === 'qr' && (
                    <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-2.5 animate-in fade-in duration-100">
                        <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2 font-mono">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold uppercase text-[oklch(18%_0.012_28)]">
                                    แสดง QR บนหน้าจอ CFD (ลูกค้า) แล้ว
                                </span>
                            </div>
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                ยอด ฿{currentSplitAmount.toLocaleString()}.-
                            </span>
                        </div>

                        {/* Store Account & PromptPay details row */}
                        <div className="flex items-center justify-between bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] px-3 py-2 rounded-xl font-mono text-xs">
                            <div>
                                <span className="text-[10px] text-[oklch(55%_0.010_28)] uppercase font-bold block">
                                    ชื่อบัญชีรับเงิน
                                </span>
                                <span className="font-bold text-[oklch(18%_0.012_28)] text-xs">
                                    {storePromptpayName || 'ร้านในบ้าน นครพนม'}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-[oklch(55%_0.010_28)] uppercase font-bold block">
                                    หมายเลขพร้อมเพย์
                                </span>
                                <span className="font-bold text-[oklch(52%_0.16_28)] bg-white border border-[oklch(85%_0.012_28)] px-2 py-0.5 rounded text-xs inline-block">
                                    {storePromptpayId || '0614232455'}
                                </span>
                            </div>
                        </div>

                        {/* Dedicated Thermal QR Slip Print Button */}
                        <button
                            type="button"
                            disabled={printingQr || currentSplitAmount <= 0}
                            onClick={() => handlePrintChunkQrSlip()}
                            className="w-full py-2.5 px-4 bg-white hover:bg-[oklch(97%_0.008_28)] border border-[oklch(18%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xs active:scale-[0.99]"
                        >
                            <Printer size={14} className="text-[oklch(52%_0.16_28)]" />
                            <span>{printingQr ? 'กำลังพิมพ์สลิป QR...' : `พิมพ์สลิป QR ก้อนที่ ${currentRoundNumber} (฿${currentSplitAmount.toLocaleString()}.-)`}</span>
                        </button>
                    </div>
                )}

                {/* Cash Tender Keypad Sub-panel */}
                {paymentMethod === 'cash' && (
                    <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-2.5 animate-in fade-in duration-100">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold uppercase text-[oklch(55%_0.010_28)]">
                                รับเงินสดมา (CASH RECEIVED)
                            </span>
                            <input 
                                type="number"
                                placeholder="0.00"
                                value={cashReceived}
                                onChange={(e) => setCashReceived(e.target.value)}
                                className="w-32 text-right bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xl px-2.5 py-1 text-sm font-mono font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-[oklch(18%_0.012_28)]"
                            />
                        </div>

                        {/* Quick cash denomination chips */}
                        <div className="flex gap-1.5 font-mono text-xs">
                            <button
                                type="button"
                                onClick={() => setCashReceived(String(currentSplitAmount))}
                                className="flex-1 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-bold hover:bg-[oklch(97%_0.008_28)] cursor-pointer"
                            >
                                พอดี
                            </button>
                            {[100, 500, 1000].map(den => (
                                <button
                                    key={den}
                                    type="button"
                                    onClick={() => setCashReceived(String(den))}
                                    className="flex-1 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-bold hover:bg-[oklch(97%_0.008_28)] cursor-pointer"
                                >
                                    ฿{den}
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-between items-center text-xs border-t border-dashed border-[oklch(85%_0.012_28)] pt-1.5 font-mono">
                            <span className="font-bold text-[oklch(55%_0.010_28)]">เงินทอน (CHANGE DUE)</span>
                            <span className={`font-bold text-sm ${parseFloat(cashReceived) >= currentSplitAmount ? 'text-emerald-700 font-black' : 'text-red-600'}`}>
                                {parseFloat(cashReceived) >= currentSplitAmount 
                                    ? `฿${Math.ceil(parseFloat(cashReceived) - currentSplitAmount).toLocaleString()}` 
                                    : cashReceived ? `ขาดอีก ฿${Math.ceil(currentSplitAmount - parseFloat(cashReceived)).toLocaleString()}` : '฿0'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Credit Card Sub-panel */}
                {paymentMethod === 'credit' && (
                    <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3 font-mono text-xs text-[oklch(55%_0.010_28)] text-center animate-in fade-in duration-100">
                        <span>ชำระผ่านเครื่องรูดบัตร (EDC) เรียบร้อยแล้วกดบันทึกชำระด้านล่าง</span>
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
                        {remainingBalanceAfterSplit <= 0 
                            ? `🎉 ยืนยันชำระและปิดบิล (฿${currentSplitAmount.toLocaleString()})`
                            : `บันทึกชำระก้อนที่ ${currentRoundNumber} (฿${currentSplitAmount.toLocaleString()})`}
                    </span>
                </button>
            </div>
        </div>
    );
}
