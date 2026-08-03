import React from 'react';
import { Trash2, Plus, Minus, CreditCard, Banknote, UserPlus, ReceiptText, AlertCircle, Receipt, Check, Printer, Send, Bell, RefreshCw, Coins, Tag, Percent, Ticket, Gift, QrCode, X, Search, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { supabase } from '../lib/supabaseClient';
import ViewSlipModal from '../components/shared/ViewSlipModal';

const POSOrderPanel = React.memo(function POSOrderPanel({ 
    order, 
    booking, 
    attachedMemberCrm,
    isSubmitting = false,
    onUpdateQuantity, 
    onClear, 
    onCheckout, 
    onAcceptOrder, 
    onOpenSlip, 
    onAttachCustomer, 
    onDetachCustomer,
    onUpdateItemNote,
    onOpenSplitPayment,
    onMoveTable,
    onMergeBill,
    onUpdateCustomerProfile,
    onUpdateGuestCount
}) {
    const [showEditPaxModal, setShowEditPaxModal] = React.useState(false);
    const [editPaxInput, setEditPaxInput] = React.useState('1');
    const [includeTax, setIncludeTax] = React.useState(true);
    const [paymentMethod, setPaymentMethod] = React.useState('cash'); // 'cash' | 'qr'
    const [cashReceivedInput, setCashReceivedInput] = React.useState('');
    const [viewSlipModalUrl, setViewSlipModalUrl] = React.useState(null);
    
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

    // Modal and CRM Search States
    const [activeModal, setActiveModal] = React.useState(null); // 'crm' | 'discount' | 'checkout' | null
    const [crmSearchTerm, setCrmSearchTerm] = React.useState('');
    const [crmMembers, setCrmMembers] = React.useState([]);
    const [crmLoading, setCrmLoading] = React.useState(false);

    // Profile editing states
    const [editingProfile, setEditingProfile] = React.useState(null);
    const [editDisplayName, setEditDisplayName] = React.useState('');
    const [editPhone, setEditPhone] = React.useState('');
    const [editEmail, setEditEmail] = React.useState('');
    const [isSavingProfile, setIsSavingProfile] = React.useState(false);

    const startEditingProfile = (profile) => {
        setEditingProfile(profile);
        setEditDisplayName(profile.display_name || '');
        setEditPhone(profile.phone_number || profile.phone || '');
        setEditEmail(profile.email || '');
    };

    const handleSaveProfile = async () => {
        if (!editingProfile) return;
        setIsSavingProfile(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    display_name: editDisplayName,
                    phone_number: editPhone,
                    email: editEmail
                })
                .eq('id', editingProfile.id);
            
            if (error) throw error;
            
            toast.success("Updated customer profile successfully");
            setEditingProfile(null);
            
            // Reload crm registry to reflect updates
            await loadCrmMembers();
            
            // Trigger callback to dashboard to update active booking
            if (onUpdateCustomerProfile) {
                await onUpdateCustomerProfile();
            }
        } catch (err) {
            console.error("Error updating profile:", err);
            toast.error("Failed to update profile: " + err.message);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const loadCrmMembers = async (searchQuery = '') => {
        setCrmLoading(true);
        try {
            let query = supabase
                .from('profiles')
                .select('*')
                .order('display_name', { ascending: true })
                .limit(50);

            if (searchQuery.trim()) {
                const q = `%${searchQuery.trim()}%`;
                query = query.or(`display_name.ilike.${q},phone_number.ilike.${q},email.ilike.${q}`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setCrmMembers(data || []);
        } catch (err) {
            console.error("Error loading profiles in panel:", err);
            toast.error("Failed to load customer profiles");
        } finally {
            setCrmLoading(false);
        }
    };

    React.useEffect(() => {
        if (activeModal === 'crm' && !booking?.profiles) {
            const timer = setTimeout(() => {
                loadCrmMembers(crmSearchTerm);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [activeModal, booking?.profiles, crmSearchTerm]);

    const filteredCrmMembers = React.useMemo(() => {
        if (!crmSearchTerm) return crmMembers.slice(0, 50);
        const term = crmSearchTerm.toLowerCase();
        return crmMembers.filter(m => {
            return (m.display_name || '').toLowerCase().includes(term) ||
                   (m.phone_number || '').toLowerCase().includes(term) ||
                   (m.phone || '').toLowerCase().includes(term) ||
                   (m.email || '').toLowerCase().includes(term);
        }).slice(0, 50);
    }, [crmMembers, crmSearchTerm]);

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

    // Reset points & discount settings when switching tables/bookings or when cart is cleared
    React.useEffect(() => {
        if (!booking || !booking.id || order.items.length === 0) {
            setXhausToRedeem(0);
            setShowRedeemInput(false);
            setRedeemInputVal('');
            setManualDiscountVal('');
            setManualDiscountType('amount');
            setSelectedPromo(null);
            setRewardCodeInput('');
            setAppliedReward(null);
            setRewardDiscount(0);
            setCashReceivedInput('');
        }
    }, [booking?.id, order.items.length]);

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
    const memberDiscount = 0;
    const discountLabel = '';
        
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
    
    const netBeforeTax = Math.ceil(Math.max(0, subtotal - memberDiscount - promoDiscount - manualDiscount - xhausDiscount - rewardDiscount));
    const tax = includeTax ? Math.ceil(netBeforeTax * 0.07) : 0;
    
    const depositPaid = booking?.deposit_amount ? Math.ceil(parseFloat(booking.deposit_amount)) : 0;
    const total = Math.ceil(Math.max(0, netBeforeTax + tax - depositPaid));
    
    // xhaus points earned
    const pointsMultiplier = attachedMemberCrm ? parseFloat(attachedMemberCrm.multiplier) : 1.0;
    const pointsEarned = Math.floor((total / 100) * pointsMultiplier * 100) / 100;
    
    // CFD Broadcast Channel (BroadcastChannel + Supabase Realtime for cross-origin)
    const cfdChannel = React.useRef(null);
    const supabaseCfdRef = React.useRef(null);

    React.useEffect(() => {
        cfdChannel.current = new BroadcastChannel('pos_cfd_channel');
        supabaseCfdRef.current = supabase.channel('pos_cfd_room');
        supabaseCfdRef.current.subscribe();

        return () => {
            if (cfdChannel.current) cfdChannel.current.close();
            if (supabaseCfdRef.current) supabase.removeChannel(supabaseCfdRef.current);
        };
    }, []);

    const broadcastCFD = (msg) => {
        if (cfdChannel.current) {
            try { cfdChannel.current.postMessage(msg); } catch (e) {}
        }
        if (supabaseCfdRef.current) {
            supabaseCfdRef.current.send({
                type: 'broadcast',
                event: 'cfd_event',
                payload: msg
            }).catch(() => {});
        }
        try {
            localStorage.setItem('pos_cfd_last_event', JSON.stringify(msg));
        } catch (e) {}
    };

    React.useEffect(() => {
        const handleCfdCustomEvent = (e) => {
            if (e.detail) {
                broadcastCFD(e.detail);
            }
        };
        window.addEventListener('pos-cfd-broadcast', handleCfdCustomEvent);
        return () => {
            window.removeEventListener('pos-cfd-broadcast', handleCfdCustomEvent);
        };
    }, []);

    const currentMemberProfile = (() => {
        if (booking?.user_id) {
            if (attachedMemberCrm && (attachedMemberCrm.id === booking.user_id || attachedMemberCrm.user_id === booking.user_id)) {
                return attachedMemberCrm;
            }
            if (booking.profiles) {
                return booking.profiles;
            }
            return null;
        }
        return attachedMemberCrm || null;
    })();

    React.useEffect(() => {
        if (activeModal === 'checkout') {
            if (paymentMethod === 'qr') {
                broadcastCFD({
                    type: 'SHOW_QR',
                    payload: {
                        items: order.items,
                        subtotal,
                        discount: memberDiscount + promoDiscount + manualDiscount + xhausDiscount + rewardDiscount,
                        tax,
                        total,
                        customer: order.customer || booking?.customer_name || 'Walk-in Guest',
                        memberProfile: currentMemberProfile,
                        tableName: order.table?.table_name || booking?.tables_layout?.table_name || null,
                        paymentMethod: 'qr'
                    }
                });
            } else {
                const received = parseFloat(cashReceivedInput) || 0;
                broadcastCFD({
                    type: 'SHOW_CHECKOUT',
                    payload: {
                        items: order.items,
                        subtotal,
                        discount: memberDiscount + promoDiscount + manualDiscount + xhausDiscount + rewardDiscount,
                        tax,
                        total,
                        customer: order.customer || booking?.customer_name || 'Walk-in Guest',
                        memberProfile: currentMemberProfile,
                        tableName: order.table?.table_name || booking?.tables_layout?.table_name || null,
                        paymentMethod: 'cash',
                        cashReceived: received,
                        changeDue: Math.max(0, received - total)
                    }
                });
            }
        } else if (order.items && order.items.length > 0) {
            broadcastCFD({
                type: 'UPDATE_CART',
                payload: {
                    items: order.items,
                    subtotal,
                    discount: memberDiscount + promoDiscount + manualDiscount + xhausDiscount + rewardDiscount,
                    tax,
                    total,
                    customer: order.customer || booking?.customer_name || 'Walk-in Guest',
                    memberProfile: currentMemberProfile,
                    tableName: order.table?.table_name || booking?.tables_layout?.table_name || null
                }
            });
        } else {
            broadcastCFD({ type: 'IDLE' });
        }
    }, [order.items, subtotal, memberDiscount, promoDiscount, manualDiscount, xhausDiscount, rewardDiscount, tax, total, currentMemberProfile, booking, activeModal, paymentMethod, cashReceivedInput]);
    
    const hasNewItems = order.items.some(item => !item.db_id);

    return (
        <aside className="w-[380px] lg:w-[440px] bg-[#F5F5F2] border-l border-[#D1D1CD] flex flex-col h-full shadow-sm z-30 font-sans text-[#1A1A1A] select-none shrink-0 overflow-hidden">
            {/* Order Header */}
            <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between shrink-0">
                <div>
                    <h3 className="font-mono font-bold text-xs tracking-wider uppercase">Order Details</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-[#767673] font-bold font-mono uppercase tracking-tight">
                            {order.table ? `TABLE: ${order.table.table_name}` : (booking?.booking_type === 'pickup' ? 'PICK-UP ORDER' : 'WALK-IN ORDER')}
                        </p>
                        {booking && (
                            <button
                                onClick={() => {
                                    setEditPaxInput(String(booking.pax || 1));
                                    setShowEditPaxModal(true);
                                }}
                                className="text-[9px] font-bold bg-[#EAEAE6] hover:bg-[#D1D1CD] text-[#1A1A1A] border border-[#D1D1CD] px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1 transition-all active:scale-95"
                                title="คลิกเพื่อแก้ไขจำนวนคน"
                            >
                                👥 {booking.pax || 1} คน
                                <Edit size={9} className="text-[#767673]" />
                            </button>
                        )}
                    </div>
                    {booking && order.table && (
                        <div className="flex gap-1.5 mt-1.5">
                            <button 
                                onClick={() => onMoveTable?.()}
                                className="text-[8px] font-bold bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-[#767673] hover:text-[#1A1A1A] px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95"
                            >
                                ย้ายโต๊ะ (Move)
                            </button>
                            <button 
                                onClick={() => onMergeBill?.()}
                                className="text-[8px] font-bold bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-[#767673] hover:text-[#1A1A1A] px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95"
                            >
                                รวมบิล (Merge)
                            </button>
                        </div>
                    )}
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
                        disabled={isSubmitting}
                        onClick={onAcceptOrder}
                        className="w-full bg-[#FFAA00] hover:bg-[#E5A900] disabled:opacity-50 disabled:cursor-not-allowed text-black py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                        {isSubmitting ? <RefreshCw size={10} className="animate-spin" /> : <Check size={10} />} 
                        {isSubmitting ? 'Processing...' : 'Accept & Print Slip'}
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
                        onClick={() => setViewSlipModalUrl(booking.payment_slip_url)}
                        className="w-full bg-[#00CC44] hover:bg-[#00B33C] text-white py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                        <Receipt size={10} /> View Slip Image
                    </button>
                </div>
            )}

            {/* Customer CRM Summary Header */}
            <div className="px-3.5 py-2 shrink-0 border-b border-[#D1D1CD]/50 bg-white/40 touch-manipulation select-none">
                {(attachedMemberCrm || booking?.profiles) ? (
                    <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-3 h-3 rounded-full bg-[oklch(52%_0.16_28)] shrink-0 animate-pulse" />
                            <div className="text-left min-w-0">
                                <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider block">Attached Customer</span>
                                <p className="text-sm font-bold text-[oklch(18%_0.012_28)] truncate uppercase">
                                    {attachedMemberCrm?.display_name || booking?.profiles?.display_name || 'Anonymous User'} 
                                    {(attachedMemberCrm?.current_tier || booking?.profiles?.current_tier) && (
                                        <span className="ml-1.5 px-1.5 py-0.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-[9px] font-mono font-bold rounded uppercase">
                                            {attachedMemberCrm?.current_tier || booking?.profiles?.current_tier}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setActiveModal('crm')}
                            className="text-xs font-mono font-bold text-[oklch(52%_0.16_28)] hover:underline px-2.5 py-1.5 bg-[#F5F5F2] hover:bg-[#E0E0DC] border border-[#D1D1CD] rounded-lg transition-all cursor-pointer touch-manipulation"
                        >
                            CRM & Rewards
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                            <UserPlus size={16} className="text-[#767673]" />
                            <span className="text-xs font-mono font-bold text-[#767673] uppercase tracking-wider">No Customer Attached</span>
                        </div>
                        <button
                            onClick={() => setActiveModal('crm')}
                            className="text-xs font-mono font-bold bg-white hover:bg-[#F5F5F2] border border-[#D1D1CD] text-[#1A1A1A] px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 touch-manipulation"
                        >
                            + Attach CRM
                        </button>
                    </div>
                )}
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-3 py-1.5 space-y-2 scrollbar-none touch-manipulation">
                {order.items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#767673] gap-2 opacity-50 font-mono text-xs font-bold uppercase tracking-wider py-8">
                        <UtensilsIcon size={28} strokeWidth={1.5} />
                        <span>Cart is empty</span>
                    </div>
                ) : (
                    order.items.map(item => (
                        <OrderItemRow 
                            key={item.id}
                            item={item}
                            onUpdateQuantity={onUpdateQuantity}
                            onUpdateItemNote={onUpdateItemNote}
                        />
                    ))
                )}
            </div>

            {/* Summary & Checkout */}
            <div className="p-4 bg-[#EBEBE9] border-t border-[#D1D1CD] space-y-3 shrink-0 select-none touch-manipulation">
                <div className="space-y-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[#767673]">
                    <div className="flex justify-between items-center text-sm">
                        <span>SUBTOTAL</span>
                        <span className="text-[#1A1A1A]">฿{subtotal.toLocaleString()}</span>
                    </div>

                    {(memberDiscount > 0 || promoDiscount > 0 || manualDiscount > 0 || xhausDiscount > 0 || rewardDiscount > 0) && (
                        <div className="space-y-1 border-t border-[#D1D1CD]/40 pt-1.5 mt-1 text-xs">
                            {promoDiscount > 0 && (
                                <div className="flex justify-between items-center text-green-600 font-bold py-0.5">
                                    <span>PROMO DISCOUNT ({selectedPromo?.code})</span>
                                    <span>-฿{Math.ceil(promoDiscount).toLocaleString()}</span>
                                </div>
                            )}

                            {manualDiscount > 0 && (
                                <div className="flex justify-between items-center text-blue-600 font-bold py-0.5">
                                    <span>MANUAL DISCOUNT</span>
                                    <span>-฿{Math.ceil(manualDiscount).toLocaleString()}</span>
                                </div>
                            )}

                            {xhausDiscount > 0 && (
                                <div className="flex justify-between items-center text-amber-700 font-bold py-0.5">
                                    <span>xhaus REDEEMED</span>
                                    <span>-฿{Math.ceil(xhausDiscount).toLocaleString()}</span>
                                </div>
                            )}
                            
                            {rewardDiscount > 0 && (
                                <div className="flex justify-between items-center text-blue-600 font-bold py-0.5">
                                    <span>REWARD DISCOUNT</span>
                                    <span>-฿{Math.ceil(rewardDiscount).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* VAT Toggle Row */}
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-[#D1D1CD] pb-2 mt-1 text-xs">
                        <div className="flex items-center gap-2">
                            <span>VAT (7%)</span>
                            <button 
                                onClick={() => setIncludeTax(!includeTax)}
                                className={`w-8 h-4 rounded-full transition-colors relative flex items-center cursor-pointer touch-manipulation ${includeTax ? 'bg-[oklch(52%_0.16_28)]' : 'bg-black/20'}`}
                            >
                                <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform ${includeTax ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        <span className={`font-bold ${includeTax ? 'text-[#1A1A1A]' : 'text-gray-400 line-through'}`}>
                            ฿{Math.ceil(netBeforeTax * 0.07).toLocaleString()}
                        </span>
                    </div>

                    {depositPaid > 0 && (
                        <div className="flex justify-between items-center text-orange-600 font-bold py-1 border-b border-dashed border-[#D1D1CD] mb-1 text-xs">
                            <span>DEPOSIT PAID (โอนมัดจำแล้ว)</span>
                            <span>-฿{Math.ceil(depositPaid).toLocaleString()}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-end text-[#1A1A1A] pt-2">
                        <span className="text-xs font-bold pb-1 text-[#767673]">NET TOTAL</span>
                        <div className="flex items-center gap-2">
                            {depositPaid >= (netBeforeTax + tax) && (netBeforeTax + tax) > 0 && (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider">
                                    [ PAID ]
                                </span>
                            )}
                            <span className="text-2xl font-black text-[oklch(52%_0.16_28)] tracking-tight">฿{total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Primary Action Row */}
                {(order.items.length > 0 || booking) && (
                    <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-2 gap-2.5 font-mono text-xs font-bold uppercase tracking-wider">
                            {/* Promo & Discount Trigger */}
                            <button
                                type="button"
                                onClick={() => setActiveModal('discount')}
                                className={`w-full py-3.5 rounded-xl border transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer touch-manipulation active:scale-[0.98] ${
                                    (selectedPromo || parseFloat(manualDiscountVal) > 0)
                                    ? 'bg-[#E6F4FF] border-blue-300 text-blue-800'
                                    : 'bg-white hover:bg-[#F5F5F2] border-[#D1D1CD] text-[#1A1A1A]'
                                }`}
                            >
                                <Tag size={14} /> 
                                {(selectedPromo || parseFloat(manualDiscountVal) > 0) ? 'Promo Applied' : 'Discount / Promo'}
                            </button>

                            {/* Pay / Checkout Trigger */}
                            {hasNewItems ? (
                                <button 
                                    disabled={isSubmitting}
                                    onClick={() => !isSubmitting && onOpenSlip && onOpenSlip('kitchen')}
                                    className="w-full bg-[#00CC44] hover:bg-[#00B33C] disabled:opacity-50 disabled:cursor-not-allowed border border-[#009933] text-white py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] cursor-pointer touch-manipulation font-bold text-sm"
                                >
                                    {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                                    {isSubmitting ? 'Sending...' : 'Send to Kitchen'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCashReceivedInput(''); // reset cash received input
                                        setActiveModal('checkout');
                                    }}
                                    className="w-full bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] border border-[oklch(42%_0.16_28)] text-white py-3.5 rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 touch-manipulation font-bold text-sm"
                                >
                                    <CreditCard size={16} /> Pay / Checkout
                                </button>
                            )}
                        </div>

                        {/* Secondary Slip / Split Payment Row */}
                        {!hasNewItems && (
                            <div className="grid grid-cols-2 gap-2.5 font-mono text-xs font-bold uppercase tracking-wider">
                                <button 
                                    type="button"
                                    onClick={() => onOpenSlip && onOpenSlip('kitchen')}
                                    className="flex items-center justify-center gap-2 bg-white hover:bg-[#FDFDFD] border border-[#D1D1CD] py-2.5 rounded-xl text-[#1A1A1A] transition-all shadow-sm cursor-pointer touch-manipulation"
                                >
                                    <ReceiptText size={14} /> Kitchen Slip
                                </button>
                                {booking && (
                                    <button 
                                        type="button"
                                        onClick={() => onOpenSplitPayment?.()}
                                        className="flex items-center justify-center gap-2 bg-white hover:bg-[#FDFDFD] border border-[#D1D1CD] py-2.5 rounded-xl text-[#1A1A1A] transition-all shadow-sm cursor-pointer touch-manipulation"
                                    >
                                        <Coins size={14} /> Split Payment
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Branding footer */}
                <div className="text-center pt-2 text-[9px] font-mono font-bold tracking-widest text-[#767673]/60 uppercase border-t border-[#D1D1CD] select-none">
                    ONHAUS SYSTEM ©
                </div>
            </div>

            {/* Overlay Modals */}
            <AnimatePresence>
                {activeModal === 'crm' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 font-sans"
                    >
                        <motion.div 
                            initial={{ scale: 0.97, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.97, y: 10 }}
                            className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="p-4 flex justify-between items-center text-[#1A1A1A] border-b border-[#D1D1CD] bg-white">
                                <div>
                                    <h3 className="font-mono font-bold text-base uppercase tracking-wider text-[#1A1A1A]">Customer CRM & Rewards</h3>
                                    <p className="text-xs text-[#767673] font-medium mt-0.5">จัดการข้อมูลสมาชิกและสิทธิพิเศษสำหรับลูกค้า</p>
                                </div>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="p-2 hover:bg-[#F5F5F2] text-[#767673] hover:text-[#1A1A1A] rounded-full border border-transparent hover:border-[#D1D1CD]/50 transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                                {editingProfile ? (
                                    /* Edit Customer Profile Form */
                                    <div className="space-y-4 text-left p-4.5 bg-[#F5F5F2] rounded-xl border border-[#D1D1CD] shadow-inner font-sans">
                                        <h4 className="font-mono font-bold text-xs text-[#767673] uppercase tracking-wider">
                                            Edit Customer Profile / แก้ไขข้อมูลลูกค้า
                                        </h4>
                                        
                                        {/* Display Name Input */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-mono font-bold text-[#767673] uppercase">
                                                Customer Name / ชื่อลูกค้า
                                            </label>
                                            <input 
                                                type="text"
                                                value={editDisplayName}
                                                onChange={(e) => setEditDisplayName(e.target.value)}
                                                className="w-full bg-white border border-[#D1D1CD] rounded-xl px-3.5 py-3 text-sm font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A] h-11"
                                            />
                                        </div>

                                        {/* Phone Number Input */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-mono font-bold text-[#767673] uppercase">
                                                Phone Number / เบอร์โทรศัพท์
                                            </label>
                                            <input 
                                                type="text"
                                                placeholder="e.g. 0812345678"
                                                value={editPhone}
                                                onChange={(e) => setEditPhone(e.target.value)}
                                                className="w-full bg-white border border-[#D1D1CD] rounded-xl px-3.5 py-3 text-sm font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A] h-11"
                                            />
                                        </div>

                                        {/* Email Input */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-mono font-bold text-[#767673] uppercase">
                                                Email Address / อีเมล
                                            </label>
                                            <input 
                                                type="email"
                                                placeholder="e.g. customer@example.com"
                                                value={editEmail}
                                                onChange={(e) => setEditEmail(e.target.value)}
                                                className="w-full bg-white border border-[#D1D1CD] rounded-xl px-3.5 py-3 text-sm font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A] h-11"
                                            />
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-3 pt-3 border-t border-[#D1D1CD]/50">
                                            <button
                                                type="button"
                                                onClick={() => setEditingProfile(null)}
                                                disabled={isSavingProfile}
                                                className="flex-1 bg-white hover:bg-[#EBEBE9] border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer h-11"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveProfile}
                                                disabled={isSavingProfile}
                                                className="flex-1 bg-[#1A1A1A] hover:bg-[#333330] text-white py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 h-11"
                                            >
                                                {isSavingProfile ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                        <span>Saving...</span>
                                                    </>
                                                ) : (
                                                    <span>Save Changes</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ) : booking?.profiles ? (
                                    <div className="space-y-4 text-left">
                                        {/* Member Profile Card */}
                                        <div className="bg-[#E0E0DC] border border-[#B0B0AC] rounded-xl p-4 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)] shrink-0 font-mono font-bold text-base">
                                                    {booking.profiles.display_name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div className="text-left min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-mono font-bold tracking-widest text-[#767673] uppercase leading-none">MEMBER ATTACHED</p>
                                                        {attachedMemberCrm && (
                                                            <span className="px-2 py-0.5 bg-[#1A1A1A] text-white text-xs font-mono font-bold rounded uppercase tracking-wider">
                                                                {attachedMemberCrm.current_tier}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-base font-bold text-[#1A1A1A] uppercase mt-1 truncate">{booking.profiles.display_name || 'Anonymous User'}</p>
                                                    
                                                    {/* Display Phone & Email */}
                                                    <div className="flex flex-col gap-1 mt-2 text-xs font-mono text-[#555]">
                                                        {booking.profiles.phone_number ? (
                                                            <span className="font-bold text-[#1A1A1A]">📞 {booking.profiles.phone_number}</span>
                                                        ) : (
                                                            <span className="text-red-600 font-bold">📞 No Phone (ไม่มีเบอร์)</span>
                                                        )}
                                                        {booking.profiles.email ? (
                                                            <span>✉️ {booking.profiles.email}</span>
                                                        ) : (
                                                            <span className="text-amber-700/80 font-medium">✉️ No Email</span>
                                                        )}
                                                        {booking.profiles.xhaus_balance !== undefined && (
                                                            <span className="text-amber-800 font-bold text-sm mt-1">🪙 {Math.ceil(parseFloat(booking.profiles.xhaus_balance || 0)).toLocaleString()} xhaus</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Edit customer details button */}
                                                <button 
                                                    type="button"
                                                    onClick={() => startEditingProfile(booking.profiles)}
                                                    className="w-10 h-10 flex items-center justify-center bg-white hover:bg-blue-50 text-[#767673] hover:text-blue-600 border border-[#D1D1CD] hover:border-blue-200 rounded-xl transition-colors cursor-pointer shadow-xs"
                                                    title="Edit Customer Profile"
                                                >
                                                    <Edit size={16} />
                                                </button>

                                                {/* Detach customer button */}
                                                <button 
                                                    type="button"
                                                    onClick={async () => {
                                                        await onDetachCustomer?.();
                                                        setXhausToRedeem(0);
                                                        setAppliedReward(null);
                                                        setRewardDiscount(0);
                                                    }} 
                                                    className="w-10 h-10 flex items-center justify-center bg-white hover:bg-red-50 text-[#767673] hover:text-red-650 border border-[#D1D1CD] hover:border-red-200 rounded-xl transition-colors cursor-pointer shadow-xs"
                                                    title="Detach Customer"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* xhaus Coins Redemption Panel */}
                                        <div className="bg-[#FFF9E6] border border-amber-300/80 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Coins size={18} className="text-[#FFAA00]" />
                                                    <div className="text-left">
                                                        <p className="text-xs font-mono font-bold text-amber-950 uppercase tracking-wide leading-none">xhaus Coins Redemption</p>
                                                        <p className="text-xs text-amber-900/80 font-medium leading-none mt-1">
                                                            1 xhaus = ฿{crmSettings.crm_redeem_rate_xhaus} (Min: {crmSettings.crm_min_redeem_xhaus} xhaus)
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {xhausToRedeem > 0 ? (
                                                <div className="bg-white border border-amber-300 rounded-xl p-3 flex justify-between items-center text-sm">
                                                    <span className="font-bold text-amber-950">Redeemed {xhausToRedeem} xhaus (-฿{Math.ceil(xhausDiscount).toLocaleString()})</span>
                                                    <button 
                                                        onClick={() => {
                                                            setXhausToRedeem(0);
                                                            setRedeemInputVal('');
                                                        }}
                                                        className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-mono font-bold uppercase rounded-lg cursor-pointer transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2.5">
                                                    <input 
                                                        type="number"
                                                        value={redeemInputVal}
                                                        onChange={(e) => setRedeemInputVal(e.target.value)}
                                                        placeholder={`e.g. ${crmSettings.crm_min_redeem_xhaus}`}
                                                        className="flex-1 bg-white border border-[#D1D1CD] rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono text-[#1A1A1A] outline-none focus:border-amber-500 h-11"
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
                                                                toast.error(`คะแนนคงเหลือมีเพียง ${Math.ceil(maxBalance).toLocaleString()} xhaus ครับ`);
                                                                return;
                                                            }
                                                            if (points > total) {
                                                                toast.error('แต้มส่วนลดห้ามเกินมูลค่ารวมของบิลอาหารครับ');
                                                                return;
                                                            }
                                                            setXhausToRedeem(points);
                                                            toast.success(`กรอกแลกส่วนลดสำเร็จ: ส่วนลด ฿${Math.ceil(points * (crmSettings.crm_redeem_rate_xhaus || 1.0)).toLocaleString()}`);
                                                        }}
                                                        className="bg-[#1A1A1A] hover:bg-[#333330] text-white text-xs font-bold uppercase rounded-xl px-5 h-11 cursor-pointer transition-all active:scale-95 shadow-sm"
                                                    >
                                                        Apply
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* xhaus Reward Code Redemption Panel */}
                                        <div className="bg-[#E6F4FF] border border-blue-300/80 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Gift size={18} className="text-blue-600 shrink-0" />
                                                <p className="text-xs font-mono font-bold text-blue-950 uppercase tracking-wide leading-none">Redeem Reward Code</p>
                                            </div>

                                            {appliedReward ? (
                                                <div className="bg-white border border-blue-300 p-3 rounded-xl flex justify-between items-center text-xs">
                                                    <div className="space-y-0.5 text-left">
                                                        <p className="font-bold text-blue-950 truncate max-w-[220px] text-sm">{appliedReward.title}</p>
                                                        <p className="text-xs text-neutral-500 font-mono">
                                                            Cost: {appliedReward.xhaus_cost} xhaus ({appliedReward.claim_code})
                                                        </p>
                                                    </div>
                                                    <button 
                                                        onClick={handleCancelReward}
                                                        className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 text-xs font-mono font-bold uppercase rounded-lg cursor-pointer transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2.5">
                                                    <input 
                                                        type="text"
                                                        placeholder="ENTER CODE (E.G. IHGLASS50)"
                                                        value={rewardCodeInput}
                                                        onChange={(e) => setRewardCodeInput(e.target.value.toUpperCase())}
                                                        className="flex-1 bg-white border border-[#D1D1CD] rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono text-[#1A1A1A] outline-none placeholder:text-neutral-400 placeholder:font-sans uppercase focus:border-blue-500 h-11"
                                                    />
                                                    <button 
                                                        onClick={handleApplyRewardCode}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-xl px-5 h-11 cursor-pointer transition-all active:scale-95 shadow-sm"
                                                    >
                                                        Apply
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Customer Search Area */
                                    <div className="space-y-3.5">
                                        <div className="relative">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767673]" size={18} />
                                            <input 
                                                type="text"
                                                placeholder="SEARCH BY NAME OR PHONE (ค้นหาด้วยชื่อหรือเบอร์)..."
                                                value={crmSearchTerm}
                                                onChange={(e) => setCrmSearchTerm(e.target.value)}
                                                className="w-full bg-[#F5F5F2] border border-[#D1D1CD] rounded-xl py-3 pl-11 pr-4 text-sm text-[#1A1A1A] placeholder-[#767673] focus:outline-none focus:border-[#1A1A1A] font-bold transition-colors font-mono h-12"
                                                autoFocus
                                            />
                                        </div>

                                        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-none">
                                            {crmLoading ? (
                                                <div className="flex flex-col items-center justify-center opacity-50 py-12">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1A1A1A] mb-2"></div>
                                                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#767673]">LOADING REGISTRY...</span>
                                                </div>
                                            ) : filteredCrmMembers.length > 0 ? (
                                                filteredCrmMembers.map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={async () => {
                                                            await onAttachCustomer?.(m);
                                                            setActiveModal(null);
                                                        }}
                                                        className="w-full text-left bg-[#F5F5F2] hover:bg-[#E0E0DC] border border-[#D1D1CD] hover:border-[#B0B0AC] p-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-between group shadow-sm active:scale-99"
                                                    >
                                                        <div className="flex items-center gap-3.5 min-w-0">
                                                            <div className="w-9 h-9 rounded-full border border-[#D1D1CD] bg-white overflow-hidden select-none shrink-0 flex items-center justify-center font-mono font-bold text-sm text-[#767673]">
                                                                {m.avatar_url ? (
                                                                    <img src={m.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                                ) : (
                                                                    m.display_name?.charAt(0).toUpperCase() || 'U'
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-sm text-[#1A1A1A] uppercase tracking-tight truncate">{m.display_name || 'Anonymous User'}</p>
                                                                
                                                                {/* Display Phone & Email in Search Items */}
                                                                <div className="flex flex-col gap-0.5 mt-1 text-xs font-mono text-[#555]">
                                                                    {m.phone_number ? (
                                                                        <span className="font-bold text-[#1A1A1A]">📞 {m.phone_number}</span>
                                                                    ) : (
                                                                        <span className="text-red-600 font-semibold">📞 No Phone (ไม่มีเบอร์)</span>
                                                                    )}
                                                                    {m.email ? (
                                                                        <span>✉️ {m.email}</span>
                                                                    ) : (
                                                                        <span className="text-amber-700/80 font-semibold">✉️ No Email</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2.5 shrink-0">
                                                            {/* Inline edit button for search registry item */}
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // prevent select/attach
                                                                    startEditingProfile(m);
                                                                }}
                                                                className="w-9 h-9 flex items-center justify-center bg-white hover:bg-blue-50 text-[#767673] hover:text-blue-600 border border-[#D1D1CD] hover:border-blue-200 rounded-xl transition-colors cursor-pointer"
                                                                title="Edit Profile"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            
                                                            <span className="text-xs font-mono font-bold text-[var(--color-accent)] uppercase tracking-wider border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-1.5 rounded-lg">
                                                                ATTACH
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-center font-mono text-xs font-bold text-[#767673] py-12 uppercase italic bg-[#F5F5F2] rounded-xl border border-dashed border-[#D1D1CD]">
                                                    No customer profiles found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9] flex justify-end">
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="bg-[#1A1A1A] hover:bg-[#333330] text-white px-6 py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow h-11"
                                >
                                    Close Window
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Discount Modal */}
                {activeModal === 'discount' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 font-sans"
                    >
                        <motion.div 
                            initial={{ scale: 0.97, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.97, y: 10 }}
                            className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl flex flex-col"
                        >
                            <div className="p-4 flex justify-between items-center bg-white border-b border-[#D1D1CD]">
                                <div>
                                    <h3 className="font-mono font-bold text-base uppercase tracking-wider text-[#1A1A1A]">Discount & Promos</h3>
                                    <p className="text-xs text-[#767673] font-medium mt-0.5">ส่วนลดและโปรโมชัน</p>
                                </div>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="p-2 hover:bg-[#F5F5F2] text-[#767673] hover:text-[#1A1A1A] rounded-full transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-5 space-y-5 bg-white">
                                <div className="space-y-2">
                                    <label className="block text-xs font-mono font-bold text-[#767673] uppercase tracking-wider">
                                        Manual Discount / ส่วนลดกำหนดเอง
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-[#767673]">
                                                {manualDiscountType === 'amount' ? '฿' : '%'}
                                            </span>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={manualDiscountVal}
                                                onChange={(e) => setManualDiscountVal(e.target.value)}
                                                className="w-full bg-white border border-[#D1D1CD] rounded-xl pl-8 pr-3 py-3 text-base font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A] h-12"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setManualDiscountType(manualDiscountType === 'amount' ? 'percent' : 'amount')}
                                            className="px-4 bg-[#F5F5F2] border border-[#D1D1CD] text-[#1A1A1A] font-mono font-bold rounded-xl active:scale-95 transition-all cursor-pointer text-sm"
                                        >
                                            {manualDiscountType === 'amount' ? 'Baht (฿)' : 'Percent (%)'}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-mono font-bold text-[#767673] uppercase tracking-wider">
                                        Available Promos / โปรโมชันที่ใช้งานได้
                                    </label>
                                    {activePromotions && activePromotions.length > 0 ? (
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {activePromotions.map(promo => {
                                                const isSelected = selectedPromo?.id === promo.id;
                                                return (
                                                    <button
                                                        key={promo.id}
                                                        onClick={() => setSelectedPromo(isSelected ? null : promo)}
                                                        className={`w-full text-left p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer touch-manipulation ${
                                                            isSelected 
                                                            ? 'bg-[#E6F4FF] border-blue-400 shadow-sm' 
                                                            : 'bg-white border-[#D1D1CD] hover:border-gray-400'
                                                        }`}
                                                    >
                                                        <Tag size={18} className={`mt-0.5 ${isSelected ? 'text-blue-600' : 'text-[#767673]'}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`font-bold text-sm truncate ${isSelected ? 'text-blue-900' : 'text-[#1A1A1A]'}`}>
                                                                {promo.code} - {promo.name}
                                                            </p>
                                                            <p className={`text-xs mt-0.5 truncate ${isSelected ? 'text-blue-700' : 'text-[#767673]'}`}>
                                                                ลด {promo.discount_type === 'percent' ? `${promo.discount_value}%` : `฿${promo.discount_value}`}
                                                            </p>
                                                        </div>
                                                        {isSelected && <Check size={18} className="text-blue-600 shrink-0" />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center font-mono text-xs font-bold text-[#767673] py-6 uppercase italic bg-[#F5F5F2] rounded-xl border border-dashed border-[#D1D1CD]">
                                            No active promotions
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9]">
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="w-full bg-[#1A1A1A] hover:bg-[#333330] text-white py-3.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow h-11"
                                >
                                    Apply & Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Checkout Modal */}
                {activeModal === 'checkout' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 font-sans"
                    >
                        <motion.div 
                            initial={{ scale: 0.97, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.97, y: 10 }}
                            className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl flex flex-col"
                        >
                            <div className="p-4 flex justify-between items-center bg-white border-b border-[#D1D1CD]">
                                <div>
                                    <h3 className="font-mono font-bold text-base uppercase tracking-wider text-[#1A1A1A]">Payment & Checkout</h3>
                                    <p className="text-xs text-[#767673] font-medium mt-0.5">ชำระเงินและปิดบิล</p>
                                </div>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="p-2 hover:bg-[#F5F5F2] text-[#767673] hover:text-[#1A1A1A] rounded-full transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-5 space-y-5 bg-white">
                                <div className="text-center bg-[#EBEBE9] py-4 rounded-xl border border-[#D1D1CD]">
                                    <p className="text-xs font-mono font-bold text-[#767673] uppercase tracking-wider mb-1">Total Amount</p>
                                    <p className="text-4xl font-mono font-bold text-[oklch(52%_0.16_28)]">฿{Math.ceil(total).toLocaleString()}</p>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-mono font-bold text-[#767673] uppercase tracking-wider">Payment Method</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            type="button"
                                            onClick={() => setPaymentMethod('cash')}
                                            className={`py-3 rounded-xl border font-mono font-bold text-sm uppercase tracking-wider transition-all flex flex-col items-center gap-1 cursor-pointer touch-manipulation ${paymentMethod === 'cash' ? 'bg-[#1A1A1A] text-white border-black shadow-md' : 'bg-white text-[#1A1A1A] border-[#D1D1CD] hover:border-black/30'}`}
                                        >
                                            <Banknote size={20} />
                                            CASH
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setPaymentMethod('qr')}
                                            className={`py-3 rounded-xl border font-mono font-bold text-sm uppercase tracking-wider transition-all flex flex-col items-center gap-1 cursor-pointer touch-manipulation ${paymentMethod === 'qr' ? 'bg-[#1A1A1A] text-white border-black shadow-md' : 'bg-white text-[#1A1A1A] border-[#D1D1CD] hover:border-black/30'}`}
                                        >
                                            <QrCode size={20} />
                                            QR PROMPTPAY
                                        </button>
                                    </div>
                                </div>

                                {paymentMethod === 'cash' && (
                                    <div className="space-y-2 animate-in fade-in duration-200">
                                        <p className="text-xs font-mono font-bold text-[#767673] uppercase tracking-wider">Cash Received</p>
                                        <input
                                            type="number"
                                            placeholder={`e.g. ${Math.ceil(total / 100) * 100}`}
                                            value={cashReceivedInput}
                                            onChange={(e) => setCashReceivedInput(e.target.value)}
                                            className="w-full bg-white border border-[#D1D1CD] rounded-xl px-4 py-3 text-2xl font-mono font-bold text-[#1A1A1A] outline-none focus:border-[var(--color-accent)] h-14 placeholder:text-gray-300"
                                        />
                                        
                                        <div className="grid grid-cols-4 gap-1.5 mt-2">
                                            {[100, 500, 1000].map(amt => (
                                                <button
                                                    key={amt}
                                                    type="button"
                                                    onClick={() => setCashReceivedInput(String(amt))}
                                                    className="py-2 bg-[#F5F5F2] border border-[#D1D1CD] hover:border-[#1A1A1A] rounded-lg font-mono font-bold text-sm text-[#1A1A1A] transition-colors cursor-pointer"
                                                >
                                                    ฿{amt}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setCashReceivedInput(String(Math.ceil(total)))}
                                                className="py-2 bg-[#E6F4FF] border border-blue-200 hover:border-blue-400 rounded-lg font-mono font-bold text-[10px] uppercase tracking-wider text-blue-700 transition-colors cursor-pointer"
                                            >
                                                EXACT
                                            </button>
                                        </div>

                                        {parseFloat(cashReceivedInput) > 0 && parseFloat(cashReceivedInput) >= total && (
                                            <div className="flex justify-between items-center px-4 py-3 bg-[#F5F5F2] border border-[#D1D1CD] rounded-xl mt-3 text-[#1A1A1A]">
                                                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#767673]">Change Due</span>
                                                <span className="text-xl font-mono font-bold">฿{Math.ceil(Math.max(0, parseFloat(cashReceivedInput || 0) - total)).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {paymentMethod === 'qr' && (
                                    <div className="space-y-3 mt-1 animate-in fade-in duration-200 border-t border-[#D1D1CD] pt-4">
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (onOpenSlip) {
                                                    onOpenSlip('billing');
                                                }
                                            }}
                                            className="w-full bg-white hover:bg-[#F5F5F2] border border-[#D1D1CD] text-[#1A1A1A] py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] font-mono font-bold text-sm uppercase tracking-wider cursor-pointer"
                                        >
                                            <Printer size={16} /> Print Bill & QR
                                        </button>
                                        <p className="text-center text-[11px] text-[#767673] font-medium px-2 leading-relaxed">
                                            พิมพ์ใบแจ้งยอดให้ลูกค้าสแกนจ่าย ก่อนกด Confirm Payment<br/>(พิมพ์ออกแบบ Silent Print)
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9]">
                                <button
                                    type="button"
                                    disabled={paymentMethod === 'cash' && (parseFloat(cashReceivedInput) < total || !cashReceivedInput)}
                                    onClick={() => {
                                        if (onCheckout) {
                                            onCheckout(
                                                paymentMethod,
                                                includeTax,
                                                pointsEarned,
                                                xhausToRedeem,
                                                xhausDiscount,
                                                promoDiscount + rewardDiscount,
                                                manualDiscount,
                                                appliedReward?.claim_code || null,
                                                appliedReward?.id || null
                                            );
                                        }
                                        setActiveModal(null);
                                    }}
                                    className="w-full bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white py-4 rounded-xl font-mono text-sm font-bold uppercase tracking-widest transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Check size={18} />
                                    Confirm Payment
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Guest Count (Pax) Modal */}
            {showEditPaxModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-[#1A1A1A]">
                        <div className="p-4.5 border-b border-[#D1D1CD] flex items-center justify-between bg-white">
                            <div>
                                <h3 className="font-mono font-bold text-sm uppercase tracking-wider">ปรับจำนวนลูกค้า (Guest Count)</h3>
                                <p className="text-xs text-[#767673] font-mono mt-0.5">{order.table ? `โต๊ะ ${order.table.table_name}` : 'Walk-in'}</p>
                            </div>
                            <button onClick={() => setShowEditPaxModal(false)} className="p-1.5 hover:bg-[#EAEAE6] rounded-xl cursor-pointer text-[#767673]"><X size={18} /></button>
                        </div>
                        
                        <div className="p-5 flex flex-col items-center gap-4 bg-white">
                            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#767673]">ระบุจำนวนลูกค้า (คน) *</div>
                            
                            {/* Stepper Input */}
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setEditPaxInput(prev => String(Math.max(1, (parseInt(prev) || 1) - 1)))}
                                    className="w-12 h-12 rounded-xl bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-2xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm cursor-pointer"
                                >
                                    -
                                </button>
                                <input 
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={editPaxInput}
                                    onChange={(e) => setEditPaxInput(e.target.value)}
                                    className="w-24 h-12 bg-white border border-[#D1D1CD] rounded-xl text-center text-2xl font-mono font-bold text-[#1A1A1A] focus:outline-none focus:border-[#52281C]"
                                />
                                <button 
                                    onClick={() => setEditPaxInput(prev => String((parseInt(prev) || 1) + 1))}
                                    className="w-12 h-12 rounded-xl bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-2xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm cursor-pointer"
                                >
                                    +
                                </button>
                            </div>

                            {/* Preset Quick Buttons */}
                            <div className="grid grid-cols-5 gap-2 w-full mt-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setEditPaxInput(String(num))}
                                        className={`py-2.5 rounded-xl font-mono font-bold text-sm transition-all cursor-pointer ${parseInt(editPaxInput) === num ? 'bg-[#3C3D40] text-white shadow-sm' : 'bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-[#1A1A1A]'}`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9] flex gap-3">
                            <button
                                onClick={() => setShowEditPaxModal(false)}
                                className="flex-1 bg-white border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] py-3 rounded-xl font-mono text-xs font-bold uppercase transition-all cursor-pointer shadow-sm active:scale-98 h-11"
                            >
                                ยกเลิก (Cancel)
                            </button>
                            <button
                                onClick={async () => {
                                    const num = parseInt(editPaxInput);
                                    if (!num || num <= 0) {
                                        toast.error("กรุณาระบุจำนวนลูกค้าให้ถูกต้อง");
                                        return;
                                    }
                                    if (booking?.id && onUpdateGuestCount) {
                                        await onUpdateGuestCount(booking.id, num);
                                    }
                                    setShowEditPaxModal(false);
                                }}
                                className="flex-1 bg-[#3C3D40] hover:bg-[#1A1A1A] text-white py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer h-11"
                            >
                                บันทึก (Save)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Slip Modal */}
            <ViewSlipModal 
                url={viewSlipModalUrl} 
                onClose={() => setViewSlipModalUrl(null)} 
            />
        </aside>
    );
});

export default POSOrderPanel;

const OrderItemRow = React.memo(function OrderItemRow({ item, onUpdateQuantity, onUpdateItemNote }) {
    return (
        <div 
            className="bg-white border border-[#D1D1CD] p-3 rounded-xl flex items-center justify-between shadow-sm select-none"
        >
            <div className="flex-1 min-w-0 mr-3">
                <h5 className="font-bold text-sm leading-tight text-[oklch(18%_0.012_28)] uppercase truncate">{item.name}</h5>
                
                {/* Display existing options/notes if any */}
                {item.selected_options && item.selected_options.length > 0 && (
                    <div className="text-xs text-[#767673] font-mono leading-tight mt-1">
                        {item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt).join(', ')}
                    </div>
                )}
                
                {/* Display newly added note */}
                {item.item_note && (
                    <div className="text-xs text-blue-600 font-mono font-bold leading-tight mt-1">
                        Note: {item.item_note}
                    </div>
                )}
                
                <div className="flex items-center gap-2.5 mt-1">
                    <p className="text-xs text-[oklch(52%_0.16_28)] font-mono font-bold">฿{item.price}</p>
                    
                    {/* Only allow adding notes to new (unsubmitted) items */}
                    {!item.db_id && (
                        <button 
                            onClick={() => {
                                const note = prompt(`ระบุหมายเหตุสำหรับ: ${item.name} (Optional)`, item.item_note || "");
                                if (note !== null && onUpdateItemNote) {
                                    onUpdateItemNote(item.id, note.trim());
                                }
                            }}
                            className="text-xs bg-white border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] px-2 py-0.5 rounded-md cursor-pointer transition-colors font-mono font-medium touch-manipulation"
                        >
                            + Note
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center bg-[#E0E0DC] border border-[#B0B0AC] rounded-xl p-1 gap-1 shrink-0">
                <button 
                    onClick={() => onUpdateQuantity(item.id, -1)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center bg-white hover:bg-[#F5F5F2] text-[#1A1A1A] active:scale-95 transition-transform shadow-xs cursor-pointer touch-manipulation"
                >
                    <Minus size={14} />
                </button>
                <span className="w-8 text-center font-mono font-bold text-base text-[#1A1A1A] select-none">{item.quantity}</span>
                <button 
                    onClick={() => onUpdateQuantity(item.id, 1)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center bg-white hover:bg-[#F5F5F2] text-[#1A1A1A] active:scale-95 transition-transform shadow-xs cursor-pointer touch-manipulation"
                >
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
});

function UtensilsIcon({ size = 24, strokeWidth = 2 }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
}
