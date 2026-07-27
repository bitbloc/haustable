import React from 'react';
import { Trash2, Plus, Minus, CreditCard, Banknote, UserPlus, ReceiptText, AlertCircle, Receipt, Check, Printer, Send, Bell, RefreshCw, Coins, Tag, Percent, Ticket, Gift, QrCode, X, Search, Edit } from 'lucide-react';
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
                .select('id, display_name, phone_number, email, avatar_url, role, xhaus_balance')
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
        setCashReceivedInput('');
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
        if (order.items && order.items.length > 0) {
            broadcastCFD({
                type: 'UPDATE_CART',
                payload: {
                    items: order.items,
                    subtotal,
                    discount: memberDiscount + promoDiscount + manualDiscount + xhausDiscount + rewardDiscount,
                    tax,
                    total,
                    customer: order.customer || booking?.customer_name || 'Walk-in Guest',
                    memberProfile: attachedMemberCrm || booking?.profiles || null,
                    tableName: order.table?.table_name || booking?.tables_layout?.table_name || null
                }
            });
        } else {
            broadcastCFD({ type: 'IDLE' });
        }
    }, [order.items, subtotal, memberDiscount, promoDiscount, manualDiscount, xhausDiscount, rewardDiscount, tax, total, attachedMemberCrm, booking]);
    
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

            {/* Customer CRM Summary Header */}
            <div className="px-3 py-1.5 shrink-0 border-b border-[#D1D1CD]/50 bg-white/40">
                {booking?.profiles ? (
                    <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent-2)] shrink-0 animate-pulse" />
                            <div className="text-left min-w-0">
                                <span className="font-mono text-[8px] font-bold text-[var(--color-neutral)] uppercase tracking-wider block">Attached Customer</span>
                                <p className="text-[11px] font-bold text-[var(--color-ink)] truncate uppercase">
                                    {booking.profiles.display_name || 'Anonymous User'} 
                                    {attachedMemberCrm && (
                                        <span className="ml-1.5 px-1 py-0.2 bg-[var(--color-ink)] text-[var(--color-paper)] text-[7px] font-mono font-bold rounded uppercase">
                                            {attachedMemberCrm.current_tier}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setActiveModal('crm')}
                            className="text-[9px] font-mono font-bold text-[var(--color-accent)] hover:underline px-2 py-1 bg-[#F5F5F2] hover:bg-[#E0E0DC] border border-[#D1D1CD] rounded transition-all cursor-pointer"
                        >
                            CRM & Rewards
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                            <UserPlus size={13} className="text-[#767673]" />
                            <span className="text-[9px] font-mono font-bold text-[#767673] uppercase tracking-wider">No Customer Attached</span>
                        </div>
                        <button
                            onClick={() => setActiveModal('crm')}
                            className="text-[9px] font-mono font-bold bg-white hover:bg-[#F5F5F2] border border-[#D1D1CD] text-[#1A1A1A] px-2.5 py-1 rounded transition-all cursor-pointer shadow-sm active:scale-95"
                        >
                            + Attach CRM
                        </button>
                    </div>
                )}
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5 scrollbar-none">
                {order.items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#767673] gap-2 opacity-50 font-mono text-[9px] font-bold uppercase tracking-wider py-8">
                        <UtensilsIcon size={24} strokeWidth={1.5} />
                        <span>Cart is empty</span>
                    </div>
                ) : (
                    order.items.map(item => (
                        <div 
                            key={item.id}
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
                        </div>
                    ))
                )}
            </div>

            {/* Summary & Checkout */}
            <div className="p-4 bg-[#EBEBE9] border-t border-[#D1D1CD] space-y-3 shrink-0">
                <div className="space-y-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#767673]">
                    <div className="flex justify-between items-center">
                        <span>SUBTOTAL</span>
                        <span className="text-[#1A1A1A]">฿{subtotal.toFixed(2)}</span>
                    </div>

                    {(memberDiscount > 0 || promoDiscount > 0 || manualDiscount > 0 || xhausDiscount > 0 || rewardDiscount > 0) && (
                        <div className="space-y-0.5 border-t border-[#D1D1CD]/30 pt-1 mt-1">
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
                            
                            {rewardDiscount > 0 && (
                                <div className="flex justify-between items-center text-blue-600 font-bold py-0.5 animate-fade-in">
                                    <span>REWARD DISCOUNT</span>
                                    <span>-฿{rewardDiscount.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* VAT Toggle Row */}
                    <div className="flex justify-between items-center py-0.5 border-b border-dashed border-[#D1D1CD] pb-1.5 mt-1">
                        <div className="flex items-center gap-1.5">
                            <span>VAT (7%)</span>
                            <button 
                                onClick={() => setIncludeTax(!includeTax)}
                                className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center cursor-pointer ${includeTax ? 'bg-[var(--color-accent)]' : 'bg-white/30'}`}
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
                        <span className="text-lg font-black text-[var(--color-accent)]">฿{total.toFixed(2)}</span>
                    </div>

                    {attachedMemberCrm && pointsEarned > 0 && (
                        <div className="flex justify-between items-center text-emerald-600 font-bold pt-1.5 border-t border-dashed border-[#D1D1CD] animate-fade-in">
                            <span>COINS TO EARN</span>
                            <span>+{pointsEarned.toFixed(2)} xhaus</span>
                        </div>
                    )}
                </div>

                {/* Primary Action Row */}
                {(order.items.length > 0 || booking) && (
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 font-mono text-[9px] font-bold uppercase tracking-wider">
                            {/* Promo & Discount Trigger */}
                            <button
                                type="button"
                                onClick={() => setActiveModal('discount')}
                                className={`w-full py-2 rounded-lg border transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                                    (selectedPromo || parseFloat(manualDiscountVal) > 0)
                                    ? 'bg-[#E6F4FF] border-blue-300 text-blue-800'
                                    : 'bg-white hover:bg-[#F5F5F2] border-[#D1D1CD] text-[#1A1A1A]'
                                }`}
                            >
                                <Tag size={10} /> 
                                {(selectedPromo || parseFloat(manualDiscountVal) > 0) ? 'Promo Applied' : 'Discount / Promo'}
                            </button>

                            {/* Pay / Checkout Trigger */}
                            {hasNewItems ? (
                                <button 
                                    onClick={() => onOpenSlip && onOpenSlip('kitchen')}
                                    className="w-full bg-[#00CC44] hover:bg-[#00B33C] border border-[#009933] text-white py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                                >
                                    <Send size={10} /> Send to Kitchen
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCashReceivedInput(''); // reset cash received input
                                        setActiveModal('checkout');
                                    }}
                                    className="w-full bg-[var(--color-accent)] hover:bg-[#d00000] border border-[#c00000] text-white py-2 rounded-lg transition-all shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-1"
                                >
                                    <CreditCard size={10} /> Pay / Checkout
                                </button>
                            )}
                        </div>

                        {/* Secondary Slip / Split Payment Row */}
                        {!hasNewItems && (
                            <div className="grid grid-cols-2 gap-2 font-mono text-[9px] font-bold uppercase tracking-wider">
                                <button 
                                    type="button"
                                    onClick={() => onOpenSlip && onOpenSlip('kitchen')}
                                    className="flex items-center justify-center gap-1 bg-white hover:bg-[#FDFDFD] border border-[#D1D1CD] py-1.5 rounded-lg text-[#767673] hover:text-[#1A1A1A] transition-all shadow-sm cursor-pointer"
                                >
                                    <ReceiptText size={10} /> Kitchen Slip
                                </button>
                                {booking && (
                                    <button 
                                        type="button"
                                        onClick={() => onOpenSplitPayment?.()}
                                        className="flex items-center justify-center gap-1 bg-white hover:bg-[#FDFDFD] border border-[#D1D1CD] py-1.5 rounded-lg text-[#767673] hover:text-[#1A1A1A] transition-all shadow-sm cursor-pointer"
                                    >
                                        <Coins size={10} /> Split Payment
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Branding footer */}
                <div className="text-center pt-2 text-[8px] font-mono font-bold tracking-widest text-[#767673]/60 uppercase border-t border-[#D1D1CD] select-none">
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
                            className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col max-h-[85vh]"
                        >
                            {/* Header */}
                            <div className="p-4 flex justify-between items-center text-[#1A1A1A] border-b border-[#D1D1CD] bg-white">
                                <div>
                                    <h3 className="font-mono font-bold text-xs uppercase tracking-widest">Customer CRM & Rewards</h3>
                                    <p className="text-[9px] text-[#767673] font-mono mt-0.5">จัดการข้อมูลสมาชิกและสิทธิพิเศษ</p>
                                </div>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="p-1.5 hover:bg-[#F5F5F2] text-[#767673] hover:text-[#1A1A1A] rounded-full border border-transparent hover:border-[#D1D1CD]/50 transition-colors cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                                {editingProfile ? (
                                    /* Edit Customer Profile Form */
                                    <div className="space-y-4 text-left p-4 bg-[#F5F5F2] rounded-xl border border-[#D1D1CD] shadow-inner font-sans">
                                        <h4 className="font-mono font-bold text-[10px] text-[#767673] uppercase tracking-wider">
                                            Edit Customer Profile / แก้ไขข้อมูลลูกค้า
                                        </h4>
                                        
                                        {/* Display Name Input */}
                                        <div className="space-y-1">
                                            <label className="block text-[9px] font-mono font-bold text-[#767673] uppercase">
                                                Customer Name / ชื่อลูกค้า
                                            </label>
                                            <input 
                                                type="text"
                                                value={editDisplayName}
                                                onChange={(e) => setEditDisplayName(e.target.value)}
                                                className="w-full bg-white border border-[#D1D1CD] rounded-lg px-3 py-2 text-xs font-semibold text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                                            />
                                        </div>

                                        {/* Phone Number Input */}
                                        <div className="space-y-1">
                                            <label className="block text-[9px] font-mono font-bold text-[#767673] uppercase">
                                                Phone Number / เบอร์โทรศัพท์
                                            </label>
                                            <input 
                                                type="text"
                                                placeholder="e.g. 0812345678"
                                                value={editPhone}
                                                onChange={(e) => setEditPhone(e.target.value)}
                                                className="w-full bg-white border border-[#D1D1CD] rounded-lg px-3 py-2 text-xs font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                                            />
                                        </div>

                                        {/* Email Input */}
                                        <div className="space-y-1">
                                            <label className="block text-[9px] font-mono font-bold text-[#767673] uppercase">
                                                Email Address / อีเมล
                                            </label>
                                            <input 
                                                type="email"
                                                placeholder="e.g. customer@example.com"
                                                value={editEmail}
                                                onChange={(e) => setEditEmail(e.target.value)}
                                                className="w-full bg-white border border-[#D1D1CD] rounded-lg px-3 py-2 text-xs font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                                            />
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2.5 pt-2.5 border-t border-[#D1D1CD]/50">
                                            <button
                                                type="button"
                                                onClick={() => setEditingProfile(null)}
                                                disabled={isSavingProfile}
                                                className="flex-1 bg-white hover:bg-[#EBEBE9] border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] py-2 rounded-lg font-mono text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveProfile}
                                                disabled={isSavingProfile}
                                                className="flex-1 bg-[#1A1A1A] hover:bg-[#333330] text-white py-2 rounded-lg font-mono text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                                            >
                                                {isSavingProfile ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
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
                                        <div className="bg-[#E0E0DC] border border-[#B0B0AC] rounded-xl p-3.5 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)] shrink-0 font-mono font-bold">
                                                    {booking.profiles.display_name?.charAt(0).toUpperCase() || 'U'}
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
                                                    <p className="text-xs font-bold text-[#1A1A1A] uppercase mt-1 truncate">{booking.profiles.display_name || 'Anonymous User'}</p>
                                                    
                                                    {/* Display Phone & Email */}
                                                    <div className="flex flex-col gap-0.5 mt-1.5 text-[9px] font-mono text-[#767673]">
                                                        {booking.profiles.phone_number ? (
                                                            <span>📞 {booking.profiles.phone_number}</span>
                                                        ) : (
                                                            <span className="text-red-500 font-bold">📞 No Phone (ไม่มีเบอร์)</span>
                                                        )}
                                                        {booking.profiles.email ? (
                                                            <span>✉️ {booking.profiles.email}</span>
                                                        ) : (
                                                            <span className="text-amber-600/70 font-semibold">✉️ No Email</span>
                                                        )}
                                                        {booking.profiles.xhaus_balance !== undefined && (
                                                            <span className="text-amber-700 font-bold mt-0.5">🪙 {parseFloat(booking.profiles.xhaus_balance).toFixed(2)} xhaus</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {/* Edit customer details button */}
                                                <button 
                                                    type="button"
                                                    onClick={() => startEditingProfile(booking.profiles)}
                                                    className="p-2 bg-white hover:bg-blue-50 text-[#767673] hover:text-blue-600 border border-[#D1D1CD] hover:border-blue-200 rounded-lg transition-colors cursor-pointer"
                                                    title="Edit Customer Profile"
                                                >
                                                    <Edit size={13} />
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
                                                    className="p-2 bg-white hover:bg-red-50 text-[#767673] hover:text-red-650 border border-[#D1D1CD] hover:border-red-200 rounded-lg transition-colors cursor-pointer"
                                                    title="Detach Customer"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* xhaus Coins Redemption Panel */}
                                        <div className="bg-[#FFF9E6] border border-amber-200 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Coins size={14} className="text-[#FFAA00]" />
                                                    <div className="text-left">
                                                        <p className="text-[10px] font-mono font-bold text-amber-900 uppercase tracking-wide leading-none">xhaus Coins Redemption</p>
                                                        <p className="text-[9px] text-amber-800/80 font-medium leading-none mt-0.5">
                                                            1 xhaus = ฿{crmSettings.crm_redeem_rate_xhaus} (Min: {crmSettings.crm_min_redeem_xhaus} xhaus)
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {xhausToRedeem > 0 ? (
                                                <div className="bg-white border border-amber-200 rounded-lg p-2.5 flex justify-between items-center text-xs">
                                                    <span className="font-bold text-amber-900">Redeemed {xhausToRedeem} xhaus (-฿{xhausDiscount.toFixed(2)})</span>
                                                    <button 
                                                        onClick={() => {
                                                            setXhausToRedeem(0);
                                                            setRedeemInputVal('');
                                                        }}
                                                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[9px] font-mono font-bold uppercase rounded cursor-pointer transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="number"
                                                        value={redeemInputVal}
                                                        onChange={(e) => setRedeemInputVal(e.target.value)}
                                                        placeholder={`e.g. ${crmSettings.crm_min_redeem_xhaus}`}
                                                        className="flex-1 bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg px-3 py-1.5 text-xs font-bold font-mono text-[#1A1A1A] outline-none focus:border-amber-400"
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
                                                            toast.success(`กรอกแลกส่วนลดสำเร็จ: ส่วนลด ฿${(points * (crmSettings.crm_redeem_rate_xhaus || 1.0)).toFixed(2)}`);
                                                        }}
                                                        className="bg-[#1A1A1A] hover:bg-[#333330] text-white text-[9px] font-bold uppercase rounded-lg px-4 cursor-pointer transition-all active:scale-95"
                                                    >
                                                        Apply
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* xhaus Reward Code Redemption Panel */}
                                        <div className="bg-[#E6F4FF] border border-blue-200 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <Gift size={14} className="text-blue-500 shrink-0" />
                                                <p className="text-[10px] font-mono font-bold text-blue-900 uppercase tracking-wide leading-none">Redeem Reward Code</p>
                                            </div>

                                            {appliedReward ? (
                                                <div className="bg-white border border-blue-300 p-2.5 rounded-lg flex justify-between items-center text-[10px]">
                                                    <div className="space-y-0.5 text-left">
                                                        <p className="font-bold text-blue-950 truncate max-w-[200px]">{appliedReward.title}</p>
                                                        <p className="text-[8px] text-neutral-500 font-mono">
                                                            Cost: {appliedReward.xhaus_cost} xhaus ({appliedReward.claim_code})
                                                        </p>
                                                    </div>
                                                    <button 
                                                        onClick={handleCancelReward}
                                                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 text-[9px] font-mono font-bold uppercase rounded cursor-pointer transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text"
                                                        placeholder="Enter Code (e.g. IHGLASS50)"
                                                        value={rewardCodeInput}
                                                        onChange={(e) => setRewardCodeInput(e.target.value.toUpperCase())}
                                                        className="flex-1 bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg px-3 py-1.5 text-xs font-bold font-mono text-[#1A1A1A] outline-none placeholder:text-neutral-400 placeholder:font-sans uppercase focus:border-blue-400"
                                                    />
                                                    <button 
                                                        onClick={handleApplyRewardCode}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold uppercase rounded-lg px-4 cursor-pointer transition-all active:scale-95"
                                                    >
                                                        Apply
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Customer Search Area */
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#767673]" size={14} />
                                            <input 
                                                type="text"
                                                placeholder="SEARCH BY NAME OR PHONE..."
                                                value={crmSearchTerm}
                                                onChange={(e) => setCrmSearchTerm(e.target.value)}
                                                className="w-full bg-[#F5F5F2] border border-[#D1D1CD] rounded-xl py-2.5 pl-9 pr-4 text-xs text-[#1A1A1A] placeholder-[#767673] focus:outline-none focus:border-[#1A1A1A] font-medium transition-colors font-mono"
                                                autoFocus
                                            />
                                        </div>

                                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                                            {crmLoading ? (
                                                <div className="flex flex-col items-center justify-center opacity-50 py-12">
                                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1A1A1A] mb-2"></div>
                                                    <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-[#767673]">LOADING REGISTRY...</span>
                                                </div>
                                            ) : filteredCrmMembers.length > 0 ? (
                                                filteredCrmMembers.map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={async () => {
                                                            await onAttachCustomer?.(m);
                                                            setActiveModal('crm');
                                                        }}
                                                        className="w-full text-left bg-[#F5F5F2] hover:bg-[#E0E0DC] border border-[#D1D1CD] hover:border-[#B0B0AC] p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between group shadow-sm active:scale-99"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-8 h-8 rounded-full border border-[#D1D1CD] bg-white overflow-hidden select-none shrink-0 flex items-center justify-center font-mono font-bold text-xs text-[#767673]">
                                                                {m.avatar_url ? (
                                                                    <img src={m.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                                ) : (
                                                                    m.display_name?.charAt(0).toUpperCase() || 'U'
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-xs text-[#1A1A1A] uppercase tracking-tight truncate">{m.display_name || 'Anonymous User'}</p>
                                                                
                                                                {/* Display Phone & Email in Search Items */}
                                                                <div className="flex flex-col gap-0.5 mt-1 text-[9px] font-mono text-[#767673]">
                                                                    {m.phone_number ? (
                                                                        <span>📞 {m.phone_number}</span>
                                                                    ) : (
                                                                        <span className="text-red-500 font-semibold">📞 No Phone (ไม่มีเบอร์)</span>
                                                                    )}
                                                                    {m.email ? (
                                                                        <span>✉️ {m.email}</span>
                                                                    ) : (
                                                                        <span className="text-amber-600/70 font-semibold">✉️ No Email</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {/* Inline edit button for search registry item */}
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // prevent select/attach
                                                                    startEditingProfile(m);
                                                                }}
                                                                className="p-1.5 bg-white hover:bg-blue-50 text-[#767673] hover:text-blue-600 border border-[#D1D1CD] hover:border-blue-200 rounded-lg transition-colors cursor-pointer"
                                                                title="Edit Profile"
                                                            >
                                                                <Edit size={11} />
                                                            </button>
                                                            
                                                            <span className="text-[9px] font-mono font-bold text-[var(--color-accent)] uppercase tracking-wider border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                                ATTACH
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-center font-mono text-[9px] text-[#767673] py-12 uppercase italic bg-[#F5F5F2] rounded-xl border border-dashed border-[#D1D1CD]">
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
                                    className="bg-[#1A1A1A] hover:bg-[#333330] text-white px-4 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow"
                                >
                                    Close Window
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {activeModal === 'discount' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 font-sans"
                    >
                        <motion.div 
                            initial={{ scale: 0.97, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.97, y: 10 }}
                            className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-4 flex justify-between items-center text-[#1A1A1A] border-b border-[#D1D1CD] bg-white">
                                <div>
                                    <h3 className="font-mono font-bold text-xs uppercase tracking-widest">Apply Discount / Promo</h3>
                                    <p className="text-[9px] text-[#767673] font-mono mt-0.5">เลือกส่วนลดและโปรโมชั่นพิเศษสำหรับโต๊ะนี้</p>
                                </div>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="p-1.5 hover:bg-[#F5F5F2] text-[#767673] hover:text-[#1A1A1A] rounded-full border border-transparent hover:border-[#D1D1CD]/50 transition-colors cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-4 space-y-4 bg-white text-left">
                                {/* Promotion Code Dropdown */}
                                <div className="space-y-1.5">
                                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] flex items-center gap-1">
                                        <Ticket size={11} /> Select Promotion (เลือกโปรโมชั่น)
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
                                        className="w-full px-3 py-2 bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg text-xs text-[#1A1A1A] font-semibold outline-none cursor-pointer focus:border-[#1A1A1A]"
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
                                <div className="space-y-1.5">
                                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] flex items-center gap-1">
                                        <Percent size={11} /> Custom Manual Discount (ใส่ส่วนลดเอง)
                                    </label>
                                    <div className="flex gap-2">
                                        {/* Unit Toggle */}
                                        <div className="flex bg-[#F5F5F2] border border-[#D1D1CD] p-0.5 rounded-lg shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setManualDiscountType('amount')}
                                                className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${manualDiscountType === 'amount' ? 'bg-[#1A1A1A] text-white' : 'text-[#767673]'}`}
                                            >
                                                ฿
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setManualDiscountType('percent')}
                                                className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${manualDiscountType === 'percent' ? 'bg-[#1A1A1A] text-white' : 'text-[#767673]'}`}
                                            >
                                                %
                                            </button>
                                        </div>
                                        {/* Input box */}
                                        <input
                                            type="number"
                                            placeholder={manualDiscountType === 'amount' ? 'e.g. 50' : 'e.g. 10'}
                                            value={manualDiscountVal}
                                            onChange={(e) => setManualDiscountVal(e.target.value)}
                                            className="flex-1 px-3 py-1.5 bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg text-xs font-bold font-mono text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9] flex justify-end">
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="bg-[#1A1A1A] hover:bg-[#333330] text-white px-5 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow"
                                >
                                    Confirm Discount
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {activeModal === 'checkout' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 font-sans"
                    >
                        <motion.div 
                            initial={{ scale: 0.97, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.97, y: 10 }}
                            className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-4 flex justify-between items-center text-[#1A1A1A] border-b border-[#D1D1CD] bg-white">
                                <div>
                                    <h3 className="font-mono font-bold text-xs uppercase tracking-widest">Payment & Settlement</h3>
                                    <p className="text-[9px] text-[#767673] font-mono mt-0.5">เลือกช่องทางชำระเงินและรับเงิน</p>
                                </div>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="p-1.5 hover:bg-[#F5F5F2] text-[#767673] hover:text-[#1A1A1A] rounded-full border border-transparent hover:border-[#D1D1CD]/50 transition-colors cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-4 space-y-4 bg-white text-left">
                                {/* Bill summary list inside checkout */}
                                <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-xl p-3.5 space-y-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#767673]">
                                    <div className="flex justify-between items-center">
                                        <span>SUBTOTAL</span>
                                        <span className="text-[#1A1A1A]">฿{subtotal.toFixed(2)}</span>
                                    </div>
                                    {(memberDiscount + promoDiscount + manualDiscount + xhausDiscount + rewardDiscount > 0) && (
                                        <div className="flex justify-between items-center text-green-600">
                                            <span>TOTAL DISCOUNTS</span>
                                            <span>-฿{(memberDiscount + promoDiscount + manualDiscount + xhausDiscount + rewardDiscount).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center py-0.5 border-b border-dashed border-[#D1D1CD] pb-1.5">
                                        <span>VAT (7%)</span>
                                        <span className={`font-bold ${includeTax ? 'text-[#1A1A1A]' : 'text-gray-400 line-through'}`}>
                                            ฿{(netBeforeTax * 0.07).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end text-[#1A1A1A] pt-1">
                                        <span className="text-[9px] font-bold pb-0.5">NET TOTAL TO PAY</span>
                                        <span className="text-xl font-black text-[var(--color-accent)]">฿{total.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Payment Method Selector */}
                                <div className="flex bg-[#E0E0DC] p-0.5 rounded-lg border border-[#D1D1CD] w-full font-mono text-[9px] font-bold uppercase tracking-wider gap-0.5">
                                    <button 
                                        type="button"
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`flex-1 py-2 rounded-md transition-all flex items-center justify-center gap-0.5 cursor-pointer ${paymentMethod === 'cash' ? 'bg-white text-[#1A1A1A] shadow-sm font-black' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                                    >
                                        <Banknote size={10} /> CASH / เงินสด
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setPaymentMethod('qr')}
                                        className={`flex-1 py-2 rounded-md transition-all flex items-center justify-center gap-0.5 cursor-pointer ${paymentMethod === 'qr' ? 'bg-white text-[#1A1A1A] shadow-sm font-black' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                                    >
                                        <QrCode size={10} /> QR / โอน
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setPaymentMethod('credit')}
                                        className={`flex-1 py-2 rounded-md transition-all flex items-center justify-center gap-0.5 cursor-pointer ${paymentMethod === 'credit' ? 'bg-white text-[#1A1A1A] shadow-sm font-black' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                                    >
                                        <CreditCard size={10} /> CREDIT / บัตร
                                    </button>
                                </div>

                                {/* Cash calculator inside modal */}
                                {paymentMethod === 'cash' && (
                                    <div className="bg-[#FFF9E6] border border-amber-200 rounded-xl p-3.5 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673]">
                                                Cash Received (รับเงินมา)
                                            </span>
                                            <input 
                                                type="number"
                                                placeholder="0.00"
                                                value={cashReceivedInput}
                                                onChange={(e) => setCashReceivedInput(e.target.value)}
                                                className="w-28 text-right bg-white border border-[#D1D1CD] rounded-lg px-3 py-1 text-xs font-mono font-bold text-[#1A1A1A] outline-none focus:border-amber-400"
                                                autoFocus
                                            />
                                        </div>
                                        
                                        {/* Quick Cash buttons */}
                                        <div className="grid grid-cols-4 gap-1.5">
                                            <button 
                                                type="button"
                                                onClick={() => setCashReceivedInput(total.toFixed(2))}
                                                className="bg-white hover:bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg py-1.5 text-[9px] font-bold font-mono text-center cursor-pointer transition-all active:scale-95"
                                            >
                                                พอดี
                                            </button>
                                            {Math.ceil(total / 100) * 100 !== total && (
                                                <button 
                                                    type="button"
                                                    onClick={() => setCashReceivedInput((Math.ceil(total / 100) * 100).toFixed(2))}
                                                    className="bg-white hover:bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg py-1.5 text-[9px] font-bold font-mono text-center cursor-pointer transition-all active:scale-95"
                                                >
                                                    ฿{Math.ceil(total / 100) * 100}
                                                </button>
                                            )}
                                            {total <= 500 && (
                                                <button 
                                                    type="button"
                                                    onClick={() => setCashReceivedInput('500.00')}
                                                    className="bg-white hover:bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg py-1.5 text-[9px] font-bold font-mono text-center cursor-pointer transition-all active:scale-95"
                                                >
                                                    ฿500
                                                </button>
                                            )}
                                            <button 
                                                type="button"
                                                onClick={() => setCashReceivedInput('1000.00')}
                                                className="bg-white hover:bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg py-1.5 text-[9px] font-bold font-mono text-center cursor-pointer transition-all active:scale-95"
                                            >
                                                ฿1000
                                            </button>
                                        </div>

                                        <div className="flex justify-between items-center text-[10px] border-t border-dashed border-[#D1D1CD]/50 pt-2.5">
                                            <span className="font-bold text-[#767673]">Change (เงินทอน)</span>
                                            <span className={`font-mono font-bold text-sm ${parseFloat(cashReceivedInput) >= total ? 'text-green-600' : 'text-[#ff0000]'}`}>
                                                {parseFloat(cashReceivedInput) >= total 
                                                    ? `฿${(parseFloat(cashReceivedInput) - total).toFixed(2)}` 
                                                    : cashReceivedInput ? `ขาดอีก ฿${(total - parseFloat(cashReceivedInput)).toFixed(2)}` : '฿0.00'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* QR buttons */}
                                {paymentMethod === 'qr' && (
                                    <button 
                                        onClick={() => {
                                            onOpenSlip && onOpenSlip('billing');
                                            broadcastCFD({
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
                                            toast.info("พิมพ์ใบแจ้งยอด/แสดงคิวอาร์โค้ดแล้ว");
                                        }}
                                        className="w-full bg-[#E6F4FF] hover:bg-blue-100 border border-blue-200 text-blue-800 py-2.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                        <Printer size={12} /> DISPLAY QR / พิมพ์ใบแจ้งยอด
                                    </button>
                                )}
                            </div>

                            {/* Footer Checkout Action */}
                            <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9] flex justify-between gap-3">
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="flex-1 bg-white border border-[#D1D1CD] hover:bg-[#F5F5F2] text-[#1A1A1A] py-2.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-98"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => {
                                        if (paymentMethod === 'cash') {
                                            const cashRecv = parseFloat(cashReceivedInput) || 0;
                                            if (cashRecv < total) {
                                                toast.error("กรุณากรอกจำนวนเงินรับมาให้พอดีหรือมากกว่ายอดรวมครับ");
                                                return;
                                            }
                                            localStorage.setItem('last_cash_received', cashRecv);
                                            localStorage.setItem('last_cash_change', (cashRecv - total).toFixed(2));
                                        }
                                        
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
                                        setActiveModal(null);
                                        if (paymentMethod === 'qr') {
                                            broadcastCFD({ type: 'PAYMENT_SUCCESS' });
                                        }
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--color-accent)] hover:bg-[#d00000] border border-[#c00000] text-white py-2.5 rounded-lg transition-all shadow-md active:scale-98 cursor-pointer font-mono text-[10px] font-bold uppercase tracking-wider"
                                >
                                    <Check size={11} /> CHECKOUT / ปิดโต๊ะ
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Guest Count (Pax) Modal */}
            {showEditPaxModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl font-sans text-[#1A1A1A]">
                        <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between">
                            <div>
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider">ปรับจำนวนลูกค้า (Guest Count)</h3>
                                <p className="text-[10px] text-[#767673] font-mono mt-0.5">{order.table ? `โต๊ะ ${order.table.table_name}` : 'Walk-in'}</p>
                            </div>
                            <button onClick={() => setShowEditPaxModal(false)} className="p-1 hover:bg-[#EAEAE6] rounded-lg cursor-pointer text-[#767673]"><X size={16} /></button>
                        </div>
                        
                        <div className="p-5 flex flex-col items-center gap-4">
                            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#767673]">ระบุจำนวนลูกค้า (คน) *</div>
                            
                            {/* Stepper Input */}
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setEditPaxInput(prev => String(Math.max(1, (parseInt(prev) || 1) - 1)))}
                                    className="w-10 h-10 rounded-xl bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm cursor-pointer"
                                >
                                    -
                                </button>
                                <input 
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={editPaxInput}
                                    onChange={(e) => setEditPaxInput(e.target.value)}
                                    className="w-20 h-10 bg-white border border-[#D1D1CD] rounded-xl text-center text-xl font-mono font-bold text-[#1A1A1A] focus:outline-none focus:border-[#52281C]"
                                />
                                <button 
                                    onClick={() => setEditPaxInput(prev => String((parseInt(prev) || 1) + 1))}
                                    className="w-10 h-10 rounded-xl bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm cursor-pointer"
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
                                        className={`py-2 rounded-lg font-mono font-bold text-xs transition-all cursor-pointer ${parseInt(editPaxInput) === num ? 'bg-[#3C3D40] text-white shadow-sm' : 'bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-[#1A1A1A]'}`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9] flex gap-2">
                            <button
                                onClick={() => setShowEditPaxModal(false)}
                                className="flex-1 bg-white border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] py-2 rounded-lg font-mono text-[10px] font-bold uppercase transition-all cursor-pointer shadow-sm active:scale-98"
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
                                className="flex-1 bg-[#3C3D40] hover:bg-[#1A1A1A] text-white py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer"
                            >
                                บันทึก (Save)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}

function UtensilsIcon({ size = 24, strokeWidth = 2 }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
}
