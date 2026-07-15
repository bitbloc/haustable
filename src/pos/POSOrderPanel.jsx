import React from 'react';
import { Trash2, Plus, Minus, CreditCard, Banknote, UserPlus, ReceiptText, AlertCircle, Receipt, Check, Printer, Send, Bell, RefreshCw, Coins, Tag, Percent, Ticket, Gift, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { supabase } from '../lib/supabaseClient';

export default function POSOrderPanel({ 
    order, 
    booking, 
    attachedMemberCrm,
    onUpdateQuantity, 
    onClear, 
    onCheckout, 
    onAcceptOrder, 
    onOpenSlip, 
    onAttachCustomer, 
    onDetachCustomer,
    onUpdateItemNote 
}) {
    const [includeTax, setIncludeTax] = React.useState(true);
    const [paymentMethod, setPaymentMethod] = React.useState('cash'); // 'cash' | 'qr'
    
    // Points states
    const [xhausToRedeem, setXhausToRedeem] = React.useState(0);
    const [showRedeemInput, setShowRedeemInput] = React.useState(false);
    const [redeemInputVal, setRedeemInputVal] = React.useState('');

    // xhaus Reward Code states
    const [rewardCodeInput, setRewardCodeInput] = React.useState('');
    const [appliedReward, setAppliedReward] = React.useState(null);
    const [rewardDiscount, setRewardDiscount] = React.useState(0);
    
    // Manual discount states
    const [manualDiscountVal, setManualDiscountVal] = React.useState('');
    const [manualDiscountType, setManualDiscountType] = React.useState('amount'); // 'amount' | 'percent'
    
    // Promotions states
    const [activePromotions, setActivePromotions] = React.useState([]);
    const [selectedPromo, setSelectedPromo] = React.useState(null);

    const [crmSettings, setCrmSettings] = React.useState({
        crm_redeem_rate_xhaus: 1.0,
        crm_min_redeem_xhaus: 10.0
    });

    React.useEffect(() => {
        const loadDefaultVat = async () => {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'default_vat_enabled')
                    .single();
                if (data && data.value) {
                    setIncludeTax(data.value === 'true');
                }
            } catch (err) {
                console.error("Error loading default VAT:", err);
            }
        };
        const loadCrmSettings = async () => {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['crm_redeem_rate_xhaus', 'crm_min_redeem_xhaus']);
                if (data) {
                    const settingsObj = {};
                    data.forEach(item => {
                        settingsObj[item.key] = parseFloat(item.value);
                    });
                    setCrmSettings(prev => ({ ...prev, ...settingsObj }));
                }
            } catch (err) {
                console.error("Error loading CRM settings:", err);
            }
        };
        const fetchActivePromotions = async () => {
            try {
                const { data, error } = await supabase
                    .from('promotion_codes')
                    .select('*')
                    .eq('is_active', true);
                if (!error && data) {
                    const now = new Date();
                    const filtered = data.filter(p => {
                        const startOk = !p.start_date || new Date(p.start_date) <= now;
                        const endOk = !p.end_date || new Date(p.end_date) >= now;
                        return startOk && endOk;
                    });
                    setActivePromotions(filtered);
                }
            } catch (err) {
                console.error("Error loading active promotions:", err);
            }
        };
        loadDefaultVat();
        loadCrmSettings();
        fetchActivePromotions();
    }, []);

    // Reset points & discount settings when switching tables/bookings
    React.useEffect(() => {
        setXhausToRedeem(0);
        setShowRedeemInput(false);
        setRedeemInputVal('');
        setManualDiscountVal('');
        setManualDiscountType('amount');
        setSelectedPromo(null);
        setRewardCodeInput('');
        setAppliedReward(null);
        setRewardDiscount(0);
    }, [booking?.id]);

    const handleApplyRewardCode = async () => {
        if (!rewardCodeInput) return;
        if (!booking || !booking.profiles) {
            toast.error("กรุณาผูกบัญชีสมาชิก (CRM) ก่อนแลกโค้ดรางวัลครับ");
            return;
        }

        try {
            // 1. Query xhaus_rewards for the code
            const { data: reward, error } = await supabase
                .from('xhaus_rewards')
                .select('*')
                .eq('claim_code', rewardCodeInput.toUpperCase().trim())
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            if (!reward) {
                toast.error("ไม่พบรหัสแลกของรางวัลนี้ หรือรหัสหมดอายุแล้วครับ");
                return;
            }

            // 2. Check customer points balance
            const customerBalance = parseFloat(booking.profiles.xhaus_balance || 0);
            const cost = parseFloat(reward.xhaus_cost);

            // 2.5 Check if reward quota has been fully redeemed
            if (reward.usage_limit && (reward.used_count || 0) >= reward.usage_limit) {
                toast.error("ขออภัยครับ ของรางวัลนี้ถูกใช้งานครบจำนวนสิทธิ์แล้ว (Out of Stock / Fully Redeemed)");
                return;
            }

            if (customerBalance < cost) {
                toast.error(`เหรียญ xhaus ของลูกค้าไม่พอ! (ต้องการ ${cost} xhaus, ลูกค้ามี ${customerBalance} xhaus)`);
                return;
            }

            // 3. Apply the reward
            setAppliedReward(reward);
            
            // Calculate reward discount value if it's a discount type reward
            let discVal = 0;
            if (reward.title.includes("ส่วนลด") || reward.title.toLowerCase().includes("discount")) {
                const match = reward.title.match(/(\d+)\s*(บาท|Baht|B|b)/);
                if (match) {
                    discVal = parseFloat(match[1]);
                } else if (reward.claim_code === 'IHDISC50') {
                    discVal = 50.00;
                }
            }
            
            setRewardDiscount(discVal);
            toast.success(`แลกรางวัลสำเร็จ: ${reward.title} (หัก ${cost} xhaus)`);
            setRewardCodeInput('');
        } catch (err) {
            console.error("Error applying reward code:", err);
            toast.error("เกิดข้อผิดพลาดในการตรวจสอบรหัสแลกรางวัล");
        }
    };

    const handleCancelReward = () => {
        setAppliedReward(null);
        setRewardDiscount(0);
        toast.info("ยกเลิกการแลกของรางวัลแล้ว");
    };

    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // 1. Member Tier Discount Calculation
    const getMemberDiscount = () => {
        if (!booking || !booking.profiles) return 0;
        const role = (booking.profiles.role || 'customer').toLowerCase();
        const tier = attachedMemberCrm?.current_tier || '';
        
        let rate = 0;
        if (role === 'admin' || role === 'vip' || tier === 'Inner Haus') {
            rate = 0.15; // 15%
        } else if (role === 'gold' || tier === 'Haus People') {
            rate = 0.10; // 10%
        } else if (role === 'customer' || tier === 'Haus Common') {
            rate = 0.05; // 5%
        }
        return subtotal * rate;
    };

    const memberDiscount = getMemberDiscount();
    const discountLabel = attachedMemberCrm?.current_tier 
        ? attachedMemberCrm.current_tier.toUpperCase()
        : booking?.profiles 
            ? `${(booking.profiles.role || 'MEMBER').toUpperCase()}` 
            : '';
        
    // 2. Promotion Code Discount Calculation
    const getPromoDiscount = () => {
        if (!selectedPromo) return 0;
        if (subtotal < parseFloat(selectedPromo.min_spend || 0)) {
            return 0; // Under minimum spend
        }
        if (selectedPromo.discount_type === 'percentage') {
            return subtotal * (parseFloat(selectedPromo.discount_value) / 100);
        } else {
            return parseFloat(selectedPromo.discount_value);
        }
    };
    const promoDiscount = getPromoDiscount();

    // 3. Manual Discount Calculation
    const getManualDiscount = () => {
        const val = parseFloat(manualDiscountVal) || 0;
        if (val <= 0) return 0;
        if (manualDiscountType === 'percent') {
            return subtotal * (val / 100);
        } else {
            return val;
        }
    };
    const manualDiscount = getManualDiscount();

    // 4. xhaus Coins Discount Calculation
    const xhausDiscount = xhausToRedeem * (crmSettings.crm_redeem_rate_xhaus || 1.0);
    
    // Net total calculations (including reward discount)
    const netBeforeTax = Math.max(0, subtotal - memberDiscount - promoDiscount - manualDiscount - xhausDiscount - rewardDiscount);
    const tax = includeTax ? netBeforeTax * 0.07 : 0;
    const total = netBeforeTax + tax;
    
    // xhaus points earned
    const pointsMultiplier = attachedMemberCrm ? parseFloat(attachedMemberCrm.multiplier) : 1.0;
    const pointsEarned = Math.floor((total / 100) * pointsMultiplier * 100) / 100;
    
    // CFD Broadcast Channel
    const cfdChannel = React.useRef(null);
    React.useEffect(() => {
        cfdChannel.current = new BroadcastChannel('pos_cfd_channel');
        return () => {
            if (cfdChannel.current) cfdChannel.current.close();
        };
    }, []);

    React.useEffect(() => {
        if (!cfdChannel.current) return;
        if (order.items && order.items.length > 0) {
            cfdChannel.current.postMessage({
                type: 'UPDATE_CART',
                payload: {
                    items: order.items,
                    subtotal,
                    discount: memberDiscount + promoDiscount + manualDiscount + xhausDiscount + rewardDiscount,
                    tax,
                    total
                }
            });
        } else {
            cfdChannel.current.postMessage({ type: 'IDLE' });
        }
    }, [order.items, subtotal, memberDiscount, promoDiscount, manualDiscount, xhausDiscount, rewardDiscount, tax, total]);
    
    const hasNewItems = order.items.some(item => !item.db_id);

    return (
        <aside className="w-[320px] md:w-[340px] bg-[#F5F5F2] border-l border-[#D1D1CD] flex flex-col h-full shadow-sm z-30 font-sans text-[#1A1A1A] select-none shrink-0 overflow-hidden">
            {/* Order Header */}
            <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between shrink-0">
                <div>
                    <h3 className="font-mono font-bold text-xs tracking-wider uppercase">Order Details</h3>
                    <p className="text-[10px] text-[#767673] font-bold font-mono mt-0.5 uppercase tracking-tight">
                        {order.table ? `TABLE: ${order.table.table_name}` : (booking?.booking_type === 'pickup' ? 'PICK-UP ORDER' : 'WALK-IN ORDER')}
                    </p>
                </div>
                <button 
                    onClick={onClear}
                    className="p-1.5 text-[#767673] hover:text-red-600 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg transition-all cursor-pointer"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Pending Order Alert */}
            {booking && booking.status === 'pending' && (
                <div className="mx-3 mt-3 p-3 bg-[#FFF9E6] border border-[#E5A900] rounded-xl flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-amber-700 font-mono text-[9px] font-bold uppercase tracking-wider">
                        <AlertCircle size={12} className="text-[#FFAA00] animate-pulse" />
                        <span>Pending Approval</span>
                    </div>
                    <p className="text-[9px] text-amber-800/80 font-medium">Order submitted by customer. Awaiting confirmation.</p>
                    <button 
                        onClick={onAcceptOrder}
                        className="w-full bg-[#FFAA00] hover:bg-[#E5A900] text-black py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                        <Check size={10} /> Accept & Print Slip
                    </button>
                </div>
            )}

            {/* Call Staff Alert */}
            {booking && booking.staff_remark?.includes('[CALL_STAFF]') && (
                <div className="mx-3 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2 shrink-0 animate-pulse">
                    <div className="flex items-center gap-1.5 text-red-700 font-mono text-[9px] font-bold uppercase tracking-wider">
                        <Bell size={12} className="text-red-500" />
                        <span>เรียกพนักงาน / Help Called</span>
                    </div>
                    <p className="text-[9px] text-red-800/80 font-medium">ลูกค้ากำลังเรียกขอความช่วยเหลือที่โต๊ะนี้</p>
                    <button 
                        onClick={async () => {
                            try {
                                const newRemark = (booking.staff_remark || '').replace('[CALL_STAFF]', '').trim();
                                const { error } = await supabase
                                    .from('bookings')
                                    .update({ staff_remark: newRemark })
                                    .eq('id', booking.id);
                                    
                                if (error) throw error;
                                toast.success("เคลียร์แจ้งเตือนเรียบร้อยแล้ว");
                            } catch (err) {
                                console.error("Failed to clear staff call:", err);
                                toast.error("ไม่สามารถเคลียร์สถานะได้ในขณะนี้");
                            }
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                        <Check size={10} /> Clear Assistance Alert
                    </button>
                </div>
            )}

            {/* Call Bill Alert */}
            {booking && booking.staff_remark?.includes('[CALL_BILL]') && (
                <div className="mx-3 mt-3 p-3 bg-amber-50 border border-[#FFAA00] rounded-xl flex flex-col gap-2 shrink-0 animate-pulse">
                    <div className="flex items-center gap-1.5 text-amber-800 font-mono text-[9px] font-bold uppercase tracking-wider">
                        <Banknote size={12} className="text-[#FFAA00]" />
                        <span>เรียกเช็คบิล / Bill Requested</span>
                    </div>
                    <p className="text-[9px] text-amber-800/80 font-medium">ลูกค้าโต๊ะนี้ส่งสัญญาณเรียกเช็คบิล</p>
                    <button 
                        onClick={async () => {
                            try {
                                const newRemark = (booking.staff_remark || '').replace('[CALL_BILL]', '').trim();
                                const { error } = await supabase
                                    .from('bookings')
                                    .update({ staff_remark: newRemark })
                                    .eq('id', booking.id);
                                    
                                if (error) throw error;
                                toast.success("เคลียร์เรียกเช็คบิลเรียบร้อยแล้ว");
                            } catch (err) {
                                console.error("Failed to clear bill call:", err);
                                toast.error("ไม่สามารถเคลียร์สถานะได้ในขณะนี้");
                            }
                        }}
                        className="w-full bg-[#FFAA00] hover:bg-[#E5A900] text-black py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                        <Check size={10} /> Clear Bill Alert
                    </button>
                </div>
            )}

            {/* Payment Slip Alert */}
            {booking && booking.payment_slip_url && (
                <div className="mx-3 mt-3 p-3 bg-emerald-50 border border-[#00CC44] rounded-xl flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-mono text-[9px] font-bold uppercase tracking-wider">
                        <Receipt size={12} className="text-[#00CC44]" />
                        <span>Payment Slip Received</span>
                    </div>
                    <button 
                        onClick={() => window.open(`https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/slips/${booking.payment_slip_url}`, '_blank')}
                        className="w-full bg-[#00CC44] hover:bg-[#00B33C] text-white py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                        <Receipt size={10} /> View Slip Image
                    </button>
                </div>
            )}

            {/* Customer Lookup (CRM Hook) */}
            {booking?.profiles ? (
                <div className="px-3 py-2 shrink-0 space-y-2">
                    <div className="w-full bg-[#E0E0DC] border border-[#B0B0AC] rounded-xl p-2.5 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-[#ff0000]/10 border border-[#ff0000]/20 flex items-center justify-center text-[#ff0000] shrink-0">
                                <UserPlus size={14} />
                            </div>
                            <div className="text-left min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-[8px] font-mono font-bold tracking-widest text-[#767673] uppercase leading-none">MEMBER ATTACHED</p>
                                    {attachedMemberCrm && (
                                        <span className="px-1.5 py-0.2 bg-[#1A1A1A] text-white text-[7px] font-mono font-bold rounded uppercase tracking-wider">
                                            {attachedMemberCrm.current_tier}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] font-bold uppercase mt-0.5 truncate">{booking.profiles.display_name || 'Anonymous User'}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[8px] font-mono text-[#767673] leading-none">
                                    <span>{booking.profiles.phone_number || booking.profiles.phone || '-'}</span>
                                    {booking.profiles.xhaus_balance !== undefined && (
                                        <>
                                            <span>•</span>
                                            <span className="text-amber-700 font-bold">🪙 {parseFloat(booking.profiles.xhaus_balance).toFixed(2)} xhaus</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            <button 
                                onClick={() => onAttachCustomer?.()} 
                                className="p-1.5 hover:bg-white text-[#767673] hover:text-[#1A1A1A] rounded-md transition-colors cursor-pointer"
                                title="Change Customer"
                            >
                                <RefreshCw size={12} />
                            </button>
                            <button 
                                onClick={() => onDetachCustomer?.()} 
                                className="p-1.5 hover:bg-[#FFD6D6] text-[#767673] hover:text-red-600 rounded-md transition-colors cursor-pointer"
                                title="Detach Customer"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>

                    {/* xhaus Coins Redemption Panel */}
                    <div className="bg-[#FFF9E6] border border-amber-200 rounded-xl p-2.5 flex flex-col gap-2 shadow-sm font-sans">
                        {!showRedeemInput ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Coins size={12} className="text-[#FFAA00]" />
                                    <div className="text-left">
                                        {xhausToRedeem > 0 ? (
                                            <p className="text-[9px] font-bold text-amber-900 leading-none">
                                                Redeemed {xhausToRedeem} xhaus (-฿{xhausDiscount.toFixed(2)})
                                            </p>
                                        ) : (
                                            <p className="text-[9px] text-amber-800 font-medium leading-none">
                                                Use xhaus for discount (1 xhaus = ฿{crmSettings.crm_redeem_rate_xhaus})
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {xhausToRedeem > 0 ? (
                                    <button 
                                        onClick={() => {
                                            setXhausToRedeem(0);
                                            setRedeemInputVal('');
                                        }}
                                        className="px-2 py-0.5 bg-red-100 hover:bg-red-200 border border-red-300 text-red-700 text-[8px] font-bold uppercase rounded cursor-pointer transition-colors"
                                    >
                                        Cancel
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => {
                                            setRedeemInputVal(Math.min(parseFloat(booking.profiles.xhaus_balance || 0), Math.floor(total)).toString());
                                            setShowRedeemInput(true);
                                        }}
                                        className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#333330] text-white text-[8px] font-bold uppercase rounded-lg cursor-pointer transition-all active:scale-95"
                                    >
                                        Redeem
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-amber-900">
                                        Enter coins to redeem (Max: {parseFloat(booking.profiles.xhaus_balance || 0).toFixed(2)})
                                    </span>
                                    <button 
                                        onClick={() => setShowRedeemInput(false)}
                                        className="text-amber-800 hover:text-amber-950 font-bold font-mono text-[9px] uppercase cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="flex gap-1.5">
                                    <input 
                                        type="number"
                                        value={redeemInputVal}
                                        onChange={(e) => setRedeemInputVal(e.target.value)}
                                        placeholder="e.g. 50"
                                        className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold font-mono text-[#1A1A1A] outline-none"
                                    />
                                    <button 
                                        onClick={() => {
                                            const points = parseFloat(redeemInputVal) || 0;
                                            const maxBalance = parseFloat(booking.profiles.xhaus_balance) || 0;
                                            const minRedeem = crmSettings.crm_min_redeem_xhaus || 10.0;
                                            
                                            if (points < minRedeem) {
                                                toast.error(`จำนวนเหรียญที่แลกต้องไม่ต่ำกว่า ${minRedeem} xhaus ครับ`);
                                                return;
                                            }
                                            if (points > maxBalance) {
                                                toast.error(`คะแนนคงเหลือมีเพียง ${maxBalance.toFixed(2)} xhaus ครับ`);
                                                return;
                                            }
                                            if (points > total) {
                                                toast.error('แต้มส่วนลดห้ามเกินมูลค่ารวมของบิลอาหารครับ');
                                                return;
                                            }
                                            setXhausToRedeem(points);
                                            setShowRedeemInput(false);
                                            toast.success(`กรอกแลกส่วนลดสำเร็จ: ส่วนลด ฿${(points * (crmSettings.crm_redeem_rate_xhaus || 1.0)).toFixed(2)}`);
                                        }}
                                        className="bg-[#1A1A1A] hover:bg-[#333330] text-white text-[8px] font-bold uppercase rounded-lg px-3 cursor-pointer transition-all active:scale-95"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* xhaus Reward Code Redemption Panel */}
                    <div className="bg-[#E6F4FF] border border-blue-200 rounded-xl p-2.5 flex flex-col gap-2 shadow-sm font-sans mt-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <Gift size={12} className="text-blue-500 shrink-0" />
                                <p className="text-[9px] text-blue-900 font-bold leading-none">Redeem Reward Code</p>
                            </div>
                        </div>
                        {appliedReward ? (
                            <div className="bg-white border border-blue-300 p-2 rounded-lg flex justify-between items-center text-[9px]">
                                <div className="space-y-0.5 text-left">
                                    <p className="font-bold text-blue-950 truncate max-w-[170px]">{appliedReward.title}</p>
                                    <p className="text-[8px] text-neutral-500 font-mono">
                                        Cost: {appliedReward.xhaus_cost} xhaus ({appliedReward.claim_code})
                                        {appliedReward.usage_limit && ` | สิทธิ์คงเหลือ: ${Math.max(0, appliedReward.usage_limit - (appliedReward.used_count || 0))}/${appliedReward.usage_limit}`}
                                    </p>
                                </div>
                                <button 
                                    onClick={handleCancelReward}
                                    className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 text-[8px] font-bold uppercase rounded cursor-pointer transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-1.5">
                                <input 
                                    type="text"
                                    placeholder="Enter Code (e.g. IHGLASS50)"
                                    value={rewardCodeInput}
                                    onChange={(e) => setRewardCodeInput(e.target.value.toUpperCase())}
                                    className="flex-1 bg-white border border-blue-300 rounded-lg px-2.5 py-1 text-xs font-bold font-mono text-[#1A1A1A] outline-none placeholder:text-neutral-400 placeholder:font-sans uppercase"
                                />
                                <button 
                                    onClick={handleApplyRewardCode}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-[8px] font-bold uppercase rounded-lg px-3 cursor-pointer transition-all active:scale-95"
                                >
                                    Apply
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="px-3 py-2 shrink-0">
                    <button 
                        onClick={() => onAttachCustomer?.()}
                        className="w-full bg-white border border-[#D1D1CD] rounded-xl p-2.5 flex items-center gap-3 hover:border-[#B0B0AC] transition-all cursor-pointer group shadow-sm"
                    >
                        <div className="w-7 h-7 rounded-full bg-[#E0E0DC] flex items-center justify-center text-[#1A1A1A] shrink-0">
                            <UserPlus size={14} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                            <p className="text-[8px] font-mono font-bold tracking-widest text-[#767673] uppercase leading-none">CUSTOMER CRM</p>
                            <p className="text-[11px] font-bold uppercase mt-0.5 truncate">Attach Customer Profile</p>
                        </div>
                    </button>
                </div>
            )}

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5 scrollbar-none">
                <AnimatePresence>
                    {order.items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-[#767673] gap-2 opacity-50 font-mono text-[9px] font-bold uppercase tracking-wider py-8">
                            <UtensilsIcon size={24} strokeWidth={1.5} />
                            <span>Cart is empty</span>
                        </div>
                    ) : (
                        order.items.map(item => (
                            <motion.div 
                                key={item.id}
                                initial={{ x: 10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -10, opacity: 0 }}
                                className="bg-white border border-[#D1D1CD] p-2.5 rounded-lg flex items-center justify-between shadow-sm"
                            >
                                <div className="flex-1 min-w-0 mr-2">
                                    <h5 className="font-bold text-[11px] leading-tight text-[#1A1A1A] uppercase truncate">{item.name}</h5>
                                    
                                    {/* Display existing options/notes if any */}
                                    {item.selected_options && item.selected_options.length > 0 && (
                                        <div className="text-[9px] text-[#767673] font-mono leading-tight mt-0.5">
                                            {item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt).join(', ')}
                                        </div>
                                    )}
                                    
                                    {/* Display newly added note */}
                                    {item.item_note && (
                                        <div className="text-[9px] text-blue-600 font-mono font-bold leading-tight mt-0.5">
                                            Note: {item.item_note}
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[9px] text-[#ff0000] font-mono font-bold">฿{item.price}</p>
                                        
                                        {/* Only allow adding notes to new (unsubmitted) items */}
                                        {!item.db_id && (
                                            <button 
                                                onClick={() => {
                                                    const note = prompt(`ระบุหมายเหตุสำหรับ: ${item.name} (Optional)`, item.item_note || "");
                                                    if (note !== null && onUpdateItemNote) {
                                                        onUpdateItemNote(item.id, note.trim());
                                                    }
                                                }}
                                                className="text-[8px] bg-white border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                            >
                                                + Note
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center bg-[#E0E0DC] border border-[#B0B0AC] rounded-md p-0.5 gap-0.5 shrink-0 scale-90 origin-right">
                                    <button 
                                        onClick={() => onUpdateQuantity(item.id, -1)}
                                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-white text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                                    >
                                        <Minus size={10} />
                                    </button>
                                    <span className="w-6 text-center font-mono font-bold text-[11px] text-[#1A1A1A]">{item.quantity}</span>
                                    <button 
                                        onClick={() => onUpdateQuantity(item.id, 1)}
                                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-white text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                                    >
                                        <Plus size={10} />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Summary & Checkout */}
            <div className="p-4 bg-[#EBEBE9] border-t border-[#D1D1CD] space-y-3 shrink-0">
                {/* Custom Discount & Promotions Panel */}
                <div className="bg-white border border-[#D1D1CD] rounded-xl p-2.5 space-y-2.5 shadow-sm">
                    {/* Header */}
                    <div className="flex items-center gap-1.5 border-b border-[#F5F5F2] pb-1.5">
                        <Tag size={12} className="text-[#1A1A1A]" />
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
                            Discounts & Promo (ส่วนลดและโปรโมชั่น)
                        </span>
                    </div>

                    {/* Promotion Code Dropdown */}
                    <div className="space-y-1">
                        <label className="block text-[8px] font-mono font-bold uppercase tracking-wider text-[#767673] flex items-center gap-1">
                            <Ticket size={10} /> Select Promotion (เลือกโปรโมชั่น)
                        </label>
                        <select
                            value={selectedPromo ? selectedPromo.id : ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                    setSelectedPromo(null);
                                    return;
                                }
                                const found = activePromotions.find(p => p.id === val);
                                if (found) {
                                    if (subtotal < parseFloat(found.min_spend || 0)) {
                                        toast.error(`โปรโมชั่นนี้ต้องการยอดขั้นต่ำ ฿${parseFloat(found.min_spend).toLocaleString()} ครับ (ยอดปัจจุบัน: ฿${subtotal.toLocaleString()})`);
                                        return;
                                    }
                                    setSelectedPromo(found);
                                    toast.success(`ใช้โปรโมชั่น ${found.code} สำเร็จ!`);
                                }
                            }}
                            className="w-full px-2 py-1.5 bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg text-[10px] text-[#1A1A1A] font-semibold outline-none cursor-pointer"
                        >
                            <option value="">-- No Promotion Code --</option>
                            {activePromotions.map(p => (
                                <option key={p.id} value={p.id}>
                                    🎟 {p.code} ({p.discount_type === 'percentage' ? `${p.discount_value}%` : `฿${p.discount_value}`} Off)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Manual Discount Entry */}
                    <div className="space-y-1">
                        <label className="block text-[8px] font-mono font-bold uppercase tracking-wider text-[#767673] flex items-center gap-1">
                            <Percent size={10} /> Custom Manual Discount (ใส่ส่วนลดเอง)
                        </label>
                        <div className="flex gap-1.5">
                            {/* Unit Toggle */}
                            <div className="flex bg-[#F5F5F2] border border-[#D1D1CD] p-0.5 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setManualDiscountType('amount')}
                                    className={`px-2 py-0.5 text-[9px] font-bold rounded ${manualDiscountType === 'amount' ? 'bg-[#1A1A1A] text-white' : 'text-[#767673]'}`}
                                >
                                    ฿
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setManualDiscountType('percent')}
                                    className={`px-2 py-0.5 text-[9px] font-bold rounded ${manualDiscountType === 'percent' ? 'bg-[#1A1A1A] text-white' : 'text-[#767673]'}`}
                                >
                                    %
                                </button>
                            </div>
                            {/* Input box */}
                            <input
                                type="number"
                                placeholder={manualDiscountType === 'amount' ? 'e.g. 50' : 'e.g. 10'}
                                value={manualDiscountVal}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setManualDiscountVal(val);
                                }}
                                className="flex-1 px-2.5 py-1 bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg text-xs font-bold font-mono text-[#1A1A1A] outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#767673]">
                    <div className="flex justify-between items-center">
                        <span>SUBTOTAL</span>
                        <span className="text-[#1A1A1A]">฿{subtotal.toFixed(2)}</span>
                    </div>

                    {memberDiscount > 0 && (
                        <div className="flex justify-between items-center text-green-600 font-bold py-0.5">
                            <span>DISCOUNT ({discountLabel})</span>
                            <span>-฿{memberDiscount.toFixed(2)}</span>
                        </div>
                    )}

                    {promoDiscount > 0 && (
                        <div className="flex justify-between items-center text-green-600 font-bold py-0.5 animate-fade-in">
                            <span>PROMO DISCOUNT ({selectedPromo?.code})</span>
                            <span>-฿{promoDiscount.toFixed(2)}</span>
                        </div>
                    )}

                    {manualDiscount > 0 && (
                        <div className="flex justify-between items-center text-blue-600 font-bold py-0.5 animate-fade-in">
                            <span>MANUAL DISCOUNT</span>
                            <span>-฿{manualDiscount.toFixed(2)}</span>
                        </div>
                    )}

                    {xhausDiscount > 0 && (
                        <div className="flex justify-between items-center text-amber-700 font-bold py-0.5 animate-fade-in">
                            <span>xhaus REDEEMED</span>
                            <span>-฿{xhausDiscount.toFixed(2)}</span>
                        </div>
                    )}
                    
                    {/* VAT Toggle Row */}
                    <div className="flex justify-between items-center py-0.5 border-b border-dashed border-[#D1D1CD] pb-1.5">
                        <div className="flex items-center gap-1.5">
                            <span>VAT (7%)</span>
                            <button 
                                onClick={() => setIncludeTax(!includeTax)}
                                className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center cursor-pointer ${includeTax ? 'bg-[#ff0000]' : 'bg-white/30'}`}
                            >
                                <div className={`absolute w-2.5 h-2.5 bg-white rounded-full transition-transform ${includeTax ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        <span className={`font-bold ${includeTax ? 'text-[#1A1A1A]' : 'text-gray-400 line-through'}`}>
                            ฿{(netBeforeTax * 0.07).toFixed(2)}
                        </span>
                    </div>

                    <div className="flex justify-between items-end text-[#1A1A1A] pt-1">
                        <span className="text-[9px] font-bold pb-0.5">NET TOTAL</span>
                        <span className="text-lg font-black text-[#ff0000]">฿{total.toFixed(2)}</span>
                    </div>

                    {attachedMemberCrm && pointsEarned > 0 && (
                        <div className="flex justify-between items-center text-emerald-600 font-bold pt-1.5 border-t border-dashed border-[#D1D1CD] animate-fade-in">
                            <span>COINS TO EARN (สะสมเพิ่ม)</span>
                            <span>+{pointsEarned.toFixed(2)} xhaus</span>
                        </div>
                    )}
                </div>

                {/* Payment Method Selector / Actions */}
                {(order.items.length > 0 || booking) && (
                    <div className="space-y-2">
                        <div className="flex bg-[#E0E0DC] p-0.5 rounded-lg border border-[#D1D1CD] w-full font-mono text-[9px] font-bold uppercase tracking-wider gap-0.5">
                            <button 
                                type="button"
                                onClick={() => setPaymentMethod('cash')}
                                className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-0.5 cursor-pointer ${paymentMethod === 'cash' ? 'bg-white text-[#1A1A1A] shadow-sm font-black' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                <Banknote size={10} /> CASH / เงินสด
                            </button>
                            <button 
                                type="button"
                                onClick={() => setPaymentMethod('qr')}
                                className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-0.5 cursor-pointer ${paymentMethod === 'qr' ? 'bg-white text-[#1A1A1A] shadow-sm font-black' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                <QrCode size={10} /> QR / โอน
                            </button>
                            <button 
                                type="button"
                                onClick={() => setPaymentMethod('credit')}
                                className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-0.5 cursor-pointer ${paymentMethod === 'credit' ? 'bg-white text-[#1A1A1A] shadow-sm font-black' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                <CreditCard size={10} /> CREDIT / บัตร
                            </button>
                        </div>

                        {/* Print Bill / Show QR button if QR is chosen */}
                        {paymentMethod === 'qr' && (
                            <button 
                                onClick={() => {
                                    onOpenSlip && onOpenSlip('billing');
                                    if (cfdChannel.current) {
                                        cfdChannel.current.postMessage({
                                            type: 'SHOW_QR',
                                            payload: {
                                                orderData: {
                                                    items: order.items,
                                                    subtotal,
                                                    discount: memberDiscount + promoDiscount + manualDiscount + xhausDiscount + rewardDiscount,
                                                    tax,
                                                    total
                                                },
                                                total
                                            }
                                        });
                                    }
                                }}
                                className="w-full bg-white hover:bg-[#FDFDFD] border border-[#D1D1CD] text-[#1A1A1A] py-2 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                            >
                                <Printer size={10} /> DISPLAY QR / พิมพ์ใบแจ้งยอด
                            </button>
                        )}

                        <div className="grid grid-cols-2 gap-2 font-mono text-[9px] font-bold uppercase tracking-wider">
                            {hasNewItems ? (
                                <button 
                                    onClick={() => onOpenSlip && onOpenSlip('kitchen')}
                                    className="col-span-2 bg-[#00CC44] hover:bg-[#00B33C] border border-[#009933] text-white py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                                >
                                    <Send size={10} /> SEND TO KITCHEN / ส่งครัว
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => onOpenSlip && onOpenSlip('kitchen')}
                                        className="flex items-center justify-center gap-1 bg-white hover:bg-[#FDFDFD] border border-[#D1D1CD] py-2 rounded-lg text-[#767673] hover:text-[#1A1A1A] transition-all shadow-sm cursor-pointer"
                                    >
                                        <ReceiptText size={10} /> KITCHEN SLIP
                                    </button>
                                    <button 
                                        onClick={() => {
                                            onCheckout(
                                                paymentMethod, 
                                                includeTax, 
                                                pointsEarned, 
                                                xhausToRedeem + (appliedReward ? parseFloat(appliedReward.xhaus_cost) : 0), 
                                                xhausDiscount + rewardDiscount, 
                                                promoDiscount, 
                                                manualDiscount,
                                                appliedReward ? appliedReward.claim_code : null,
                                                appliedReward ? appliedReward.id : null
                                            );
                                            if (cfdChannel.current && paymentMethod === 'qr') {
                                                cfdChannel.current.postMessage({ type: 'PAYMENT_SUCCESS' });
                                            }
                                        }}
                                        className="flex items-center justify-center gap-1 bg-[#ff0000] hover:bg-[#d00000] border border-[#c00000] text-white py-2 rounded-lg transition-all shadow-sm active:scale-98 cursor-pointer"
                                    >
                                        <Check size={10} /> CHECKOUT / ปิดโต๊ะ
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Branding footer */}
                <div className="text-center pt-2 text-[8px] font-mono font-bold tracking-widest text-[#767673]/60 uppercase border-t border-[#D1D1CD] select-none">
                    ONHAUS SYSTEM ©
                </div>
            </div>
        </aside>
    );
}

function UtensilsIcon({ size = 24, strokeWidth = 2 }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
}
