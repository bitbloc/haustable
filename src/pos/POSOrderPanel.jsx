import React from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Plus, Minus, CreditCard, Banknote, UserPlus, ReceiptText, AlertCircle, Receipt, Check, Printer, Send, Bell, RefreshCw, Coins, Tag, Percent, Ticket, Gift, QrCode, X, Search, Edit, Utensils, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { supabase } from '../lib/supabaseClient';
import ViewSlipModal from '../components/shared/ViewSlipModal';
import POSEmergencyItemModal from './POSEmergencyItemModal';
import { getShortBookingId, normalizePromptPayId, getStorePromptpayId } from '../utils/printerHelper';

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
    onUpdateGuestCount,
    onInjectRewardItem,
    onRemoveRewardItem,
    onAddEmergencyItem,
    onOpenMenu
}) {
    const [showEditPaxModal, setShowEditPaxModal] = React.useState(false);
    const [showEmergencyModal, setShowEmergencyModal] = React.useState(false);
    const [editPaxInput, setEditPaxInput] = React.useState('1');
    const [includeTax, setIncludeTax] = React.useState(true);
    const [paymentMethod, setPaymentMethod] = React.useState('cash'); // 'cash' | 'qr'
    const [cashStep, setCashStep] = React.useState('input'); // 'input' | 'change'
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
    const [useFreeDrinkQuota, setUseFreeDrinkQuota] = React.useState(false);
    
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
    const [isMenuDrawerOpen, setIsMenuDrawerOpen] = React.useState(false);
    const [storePromptpayId, setStorePromptpayId] = React.useState('0985284217');

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

    // Quick Register Customer States
    const [isQuickRegistering, setIsQuickRegistering] = React.useState(false);
    const [quickName, setQuickName] = React.useState('');
    const [quickPhone, setQuickPhone] = React.useState('');
    const [isRegisteringMember, setIsRegisteringMember] = React.useState(false);

    const handleQuickRegisterCustomer = async (e) => {
        if (e) e.preventDefault();
        const nameTrim = quickName.trim();
        const cleanPhone = quickPhone.replace(/\D/g, '');

        if (!nameTrim) {
            toast.error("กรุณากรอกชื่อลูกค้า");
            return;
        }
        if (!cleanPhone || cleanPhone.length < 9) {
            toast.error("กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (อย่างน้อย 9-10 หลัก)");
            return;
        }

        setIsRegisteringMember(true);
        try {
            // 1. Check if profile with phone number already exists
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('phone_number', cleanPhone)
                .maybeSingle();

            if (existingProfile) {
                toast.info(`พบข้อมูลสมาชิก "${existingProfile.display_name}" อยู่ในระบบแล้ว ทำการเชื่อมต่อบิลเรียบร้อย`);
                await onAttachCustomer?.(existingProfile);
                setIsQuickRegistering(false);
                setQuickName('');
                setQuickPhone('');
                setActiveModal(null);
                return;
            }

            // 2. Register account via Edge Function with default pass: inthehaus
            const defaultEmail = `${cleanPhone}@inthehaus.com`;
            const defaultPassword = 'inthehaus';

            const { data: resData, error: fnError } = await supabase.functions.invoke('manage-booking', {
                body: {
                    action: 'register_account',
                    email: defaultEmail,
                    password: defaultPassword,
                    profileData: {
                        display_name: nameTrim,
                        phone_number: cleanPhone
                    }
                }
            });

            if (fnError) throw fnError;
            if (resData?.error) throw new Error(resData.error);

            // Fetch newly created profile
            const newUserId = resData?.userId;
            let newMember = null;
            if (newUserId) {
                const { data: createdProf } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', newUserId)
                    .maybeSingle();
                newMember = createdProf;
            }

            if (!newMember) {
                newMember = {
                    id: newUserId || Date.now().toString(),
                    display_name: nameTrim,
                    phone_number: cleanPhone,
                    role: 'customer'
                };
            }

            toast.success(`สมัครสมาชิกสำเร็จ! เบอร์: ${cleanPhone} (รหัสผ่านเข้าดูคะแนน: inthehaus)`);
            
            await onAttachCustomer?.(newMember);

            setIsQuickRegistering(false);
            setQuickName('');
            setQuickPhone('');
            await loadCrmMembers();
            setActiveModal(null);

        } catch (err) {
            console.error("Error quick registering customer:", err);
            toast.error("ไม่สามารถสมัครสมาชิกได้: " + (err.message || err));
        } finally {
            setIsRegisteringMember(false);
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
                query = query.or(`display_name.ilike.${q},phone_number.ilike.${q}`);
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

    // Global ESC keydown listener to close active modal cleanly
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                if (activeModal) setActiveModal(null);
                if (showEditPaxModal) setShowEditPaxModal(false);
                if (showEmergencyModal) setShowEmergencyModal(false);
                if (viewSlipModalUrl) setViewSlipModalUrl(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeModal, showEditPaxModal, showEmergencyModal, viewSlipModalUrl]);

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
        crm_min_redeem_xhaus: 10.0,
        crm_base_spend_amount: 100.0,
        crm_max_redeem_percent: 100
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
                    .in('key', [
                        'crm_redeem_rate_xhaus',
                        'crm_min_redeem_xhaus',
                        'crm_base_spend_amount',
                        'crm_max_redeem_percent',
                        'promptpay_id',
                        'receipt_shop_phone',
                        'contact_phone',
                        'admin_phone_contact',
                        'phone_number',
                        'printer_config'
                    ]);
                if (data) {
                    const settingsObj = {};
                    data.forEach(item => {
                        settingsObj[item.key] = item.value;
                    });
                    let parsedCfg = {};
                    if (settingsObj.printer_config) {
                        try { parsedCfg = JSON.parse(settingsObj.printer_config); } catch (e) {}
                    }
                    const resolvedPpId = getStorePromptpayId(settingsObj, parsedCfg);
                    setStorePromptpayId(resolvedPpId);
                    
                    const numObj = {};
                    ['crm_redeem_rate_xhaus', 'crm_min_redeem_xhaus', 'crm_base_spend_amount', 'crm_max_redeem_percent'].forEach(k => {
                        if (settingsObj[k] !== undefined) numObj[k] = parseFloat(settingsObj[k]);
                    });
                    setCrmSettings(prev => ({ ...prev, ...numObj }));
                }
            } catch (err) {
                console.error("Error loading CRM/PromptPay settings:", err);
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
            setUseFreeDrinkQuota(false);
        }
    }, [booking?.id, order.items.length]);

    const handleApplyRewardCode = async () => {
        if (!rewardCodeInput) return;
        const currentMemberProfile = attachedMemberCrm || booking?.profiles;
        if (!currentMemberProfile) {
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

            // Fetch linked menu item if any
            if (reward.linked_menu_item_id) {
                try {
                    const { data: menuItem, error: menuErr } = await supabase
                        .from('menu_items')
                        .select('id, name, price, category_id')
                        .eq('id', reward.linked_menu_item_id)
                        .maybeSingle();
                    if (menuErr) console.warn("Error fetching linked menu item:", menuErr);
                    if (menuItem) {
                        reward.menu_items = menuItem;
                    }
                } catch (fetchErr) {
                    console.warn("Exception fetching linked menu item:", fetchErr);
                }
            }

            // 2. Check customer points balance
            const customerBalance = parseFloat(currentMemberProfile.xhaus_balance ?? booking?.profiles?.xhaus_balance ?? 0);
            const cost = parseFloat(reward.xhaus_cost || 0);

            // 2.5 Check if reward quota has been fully redeemed
            if (reward.usage_limit && (reward.used_count || 0) >= reward.usage_limit) {
                toast.error("ขออภัยครับ ของรางวัลนี้ถูกใช้งานครบจำนวนสิทธิ์แล้ว (Out of Stock / Fully Redeemed)");
                return;
            }

            if (customerBalance < cost) {
                toast.error(`เหรียญ xhaus ของลูกค้าไม่พอ! (ต้องการ ${cost} xhaus, ลูกค้ามี ${customerBalance} xhaus)`);
                return;
            }

            // 3. Auto-Inject item if linked
            if (reward.menu_items && onInjectRewardItem) {
                onInjectRewardItem(reward.menu_items, reward.claim_code, reward.id, parseFloat(reward.xhaus_cost || 0));
            }
            
            // Calculate reward discount value if it's a discount type reward
            let discVal = 0;
            const rewardTitle = reward.title || 'ของรางวัล';
            if (rewardTitle.includes("ส่วนลด") || rewardTitle.toLowerCase().includes("discount")) {
                const match = rewardTitle.match(/(\d+)\s*(บาท|Baht|B|b)/);
                if (match) {
                    discVal = parseFloat(match[1]);
                } else if (reward.claim_code === 'IHDISC50') {
                    discVal = 50.00;
                }
            }
            
            setAppliedReward(reward);
            setRewardDiscount(discVal);
            toast.success(`แลกรางวัลสำเร็จ: ${rewardTitle} (หัก ${cost} xhaus)`);
            setRewardCodeInput('');
        } catch (err) {
            console.error("Error applying reward code:", err);
            toast.error(`เกิดข้อผิดพลาดในการตรวจสอบรหัสแลกรางวัล: ${err.message || 'กรุณาลองใหม่อีกครั้ง'}`);
            setAppliedReward(null);
            setRewardDiscount(0);
        }
    };

    const handleCancelReward = () => {
        if (appliedReward?.menu_items && onRemoveRewardItem) {
            onRemoveRewardItem(appliedReward.claim_code);
        }
        setAppliedReward(null);
        setRewardDiscount(0);
        toast.info("ยกเลิกการแลกของรางวัลแล้ว");
    };

    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // 1. Member Tier Privilege (Point Earning Multiplier Model, 0% bill percentage discount)
    const currentMemberForDisc = attachedMemberCrm || booking?.profiles;
    const tierName = currentMemberForDisc?.current_tier || '';
    const tierMultiplier = currentMemberForDisc?.multiplier !== undefined 
        ? parseFloat(currentMemberForDisc.multiplier)
        : (tierName === 'Inner Haus' ? 1.50 : (tierName === 'Haus People' ? 1.25 : 1.00));
    const tierDiscountRate = 0.00; // 0% member bill discount
    const memberDiscount = 0;
    const discountLabel = '';
    const baseSpendUnit = parseFloat(crmSettings.crm_base_spend_amount) || 100;
    const estimatedPointsEarned = currentMemberForDisc ? (Math.floor((subtotal / baseSpendUnit) * tierMultiplier * 100) / 100) : 0;
        
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

    // 4. xhaus Coins Discount Calculation (Respecting configured max percentage cap)
    const rawXhausDiscount = xhausToRedeem * (parseFloat(crmSettings.crm_redeem_rate_xhaus) || 1.0);
    const maxAllowedDiscountBaht = (subtotal * (parseFloat(crmSettings.crm_max_redeem_percent) || 100)) / 100;
    const xhausDiscount = Math.min(rawXhausDiscount, maxAllowedDiscountBaht);
    
    // 5. Drink 10 Free 1 Discount Calculation
    const isItemDrinkStampEligible = React.useCallback((item) => {
        if (item.is_drink_stamp_eligible === true) return true;
        if (item.menu_items?.is_drink_stamp_eligible === true) return true;
        if (item.menu_items?.menu_categories?.is_drink_stamp_eligible === true) return true;
        const catName = (item.menu_items?.menu_categories?.name || item.category || item.category_name || item.category_title || '').toLowerCase();
        const itemName = (item.menu_items?.name || item.item_name || item.name || '').toLowerCase();
        const drinkRegex = /coffee|tea|beverage|drink|soda|matcha|cocoa|latte|espresso|brew|smoothie|frappe|juice|milk|non-coffee|shot|ชา|กาแฟ|เครื่องดื่ม|นมสด|มัทฉะ|โกโก้|น้ำผลไม้|โซดา|ช็อต|เอสเพรสโซ|เอสเพรสโซ่/i;
        return drinkRegex.test(catName) || drinkRegex.test(itemName);
    }, []);

    const freeDrinkDiscount = React.useMemo(() => {
        if (!useFreeDrinkQuota) return 0;
        const eligibleItems = order.items.filter(isItemDrinkStampEligible);
        if (eligibleItems.length === 0) return 0;
        const prices = eligibleItems.map(i => parseFloat(i.price) || 0);
        return Math.min(...prices);
    }, [useFreeDrinkQuota, order.items, isItemDrinkStampEligible]);

    const netBeforeTax = Math.ceil(Math.max(0, subtotal - memberDiscount - promoDiscount - manualDiscount - xhausDiscount - rewardDiscount - freeDrinkDiscount));
    const tax = includeTax ? Math.ceil(netBeforeTax * 0.07) : 0;
    
    const depositPaid = booking?.deposit_amount ? Math.ceil(parseFloat(booking.deposit_amount)) : 0;
    const total = Math.ceil(Math.max(0, netBeforeTax + tax - depositPaid));
    
    // xhaus points earned
    const currentMemberForPoints = attachedMemberCrm || booking?.profiles;
    const pointsMultiplier = currentMemberForPoints?.multiplier !== undefined 
        ? parseFloat(currentMemberForPoints.multiplier) 
        : (currentMemberForPoints?.current_tier === 'Inner Haus' ? 1.50 : (currentMemberForPoints?.current_tier === 'Haus People' ? 1.25 : 1.00));
    const finalMultiplier = isNaN(pointsMultiplier) ? 1.0 : pointsMultiplier;
    const pointsEarned = Math.floor((total / baseSpendUnit) * finalMultiplier * 100) / 100;
    
    // CFD Broadcast Channel (BroadcastChannel + Supabase Realtime for cross-origin)
    const cfdChannel = React.useRef(null);
    const supabaseCfdRef = React.useRef(null);

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

    const computeCurrentCFDPayload = React.useCallback(() => {
        const totalDiscountValue = memberDiscount + promoDiscount + manualDiscount + xhausDiscount + rewardDiscount + freeDrinkDiscount;
        if (activeModal === 'checkout') {
            if (paymentMethod === 'qr') {
                return {
                    type: 'SHOW_QR',
                    payload: {
                        items: order.items,
                        subtotal,
                        discount: totalDiscountValue,
                        tax,
                        total,
                        customer: order.customer || booking?.customer_name || 'Walk-in Guest',
                        memberProfile: currentMemberProfile,
                        tableName: order.table?.table_name || booking?.tables_layout?.table_name || null,
                        paymentMethod: 'qr',
                        promptpayId: storePromptpayId
                    }
                };
            } else {
                const received = parseFloat(cashReceivedInput) || 0;
                return {
                    type: 'SHOW_CHECKOUT',
                    payload: {
                        items: order.items,
                        subtotal,
                        discount: totalDiscountValue,
                        tax,
                        total,
                        customer: order.customer || booking?.customer_name || 'Walk-in Guest',
                        memberProfile: currentMemberProfile,
                        tableName: order.table?.table_name || booking?.tables_layout?.table_name || null,
                        paymentMethod: 'cash',
                        cashReceived: received,
                        changeDue: Math.max(0, received - total),
                        promptpayId: storePromptpayId
                    }
                };
            }
        } else if (order.items && order.items.length > 0) {
            return {
                type: 'UPDATE_CART',
                payload: {
                    items: order.items,
                    subtotal,
                    discount: totalDiscountValue,
                    tax,
                    total,
                    customer: order.customer || booking?.customer_name || 'Walk-in Guest',
                    memberProfile: currentMemberProfile,
                    tableName: order.table?.table_name || booking?.tables_layout?.table_name || null
                }
            };
        } else {
            return { type: 'IDLE' };
        }
    }, [activeModal, paymentMethod, order.items, order.customer, order.table, subtotal, memberDiscount, promoDiscount, manualDiscount, xhausDiscount, rewardDiscount, freeDrinkDiscount, tax, total, currentMemberProfile, booking, cashReceivedInput, storePromptpayId]);

    const lastBroadcastMsgRef = React.useRef('');
    const cfdDebounceTimerRef = React.useRef(null);

    const broadcastCFD = React.useCallback((msg) => {
        if (!msg) return;
        const msgStr = JSON.stringify(msg);
        if (msgStr === lastBroadcastMsgRef.current) return;
        lastBroadcastMsgRef.current = msgStr;

        // Instant local channel broadcast (zero lag for local secondary monitors)
        if (cfdChannel.current) {
            try { cfdChannel.current.postMessage(msg); } catch (e) {}
        }
        
        // Debounce cloud realtime broadcast and storage write to prevent UI thread lock
        if (cfdDebounceTimerRef.current) {
            clearTimeout(cfdDebounceTimerRef.current);
        }

        const isUrgent = msg.type === 'PAYMENT_SUCCESS' || msg.type === 'IDLE';
        const delay = isUrgent ? 0 : 120;

        cfdDebounceTimerRef.current = setTimeout(() => {
            if (supabaseCfdRef.current) {
                supabaseCfdRef.current.send({
                    type: 'broadcast',
                    event: 'cfd_event',
                    payload: msg
                }).catch(() => {});
            }
            try {
                localStorage.setItem('pos_cfd_last_event', msgStr);
            } catch (e) {}
        }, delay);
    }, []);

    const computeCurrentCFDPayloadRef = React.useRef(computeCurrentCFDPayload);
    computeCurrentCFDPayloadRef.current = computeCurrentCFDPayload;

    const broadcastCFDRef = React.useRef(broadcastCFD);
    broadcastCFDRef.current = broadcastCFD;

    React.useEffect(() => {
        cfdChannel.current = new BroadcastChannel('pos_cfd_channel');
        
        // Handle incoming handshake requests from CFD
        cfdChannel.current.onmessage = (event) => {
            if (event.data?.type === 'REQUEST_CFD_STATE') {
                const currentMsg = computeCurrentCFDPayloadRef.current ? computeCurrentCFDPayloadRef.current() : null;
                if (currentMsg) broadcastCFDRef.current?.(currentMsg);
            }
        };

        supabaseCfdRef.current = supabase.channel('pos_cfd_room');
        supabaseCfdRef.current.on('broadcast', { event: 'cfd_handshake' }, () => {
            const currentMsg = computeCurrentCFDPayloadRef.current ? computeCurrentCFDPayloadRef.current() : null;
            if (currentMsg) broadcastCFDRef.current?.(currentMsg);
        }).subscribe();

        return () => {
            if (cfdDebounceTimerRef.current) clearTimeout(cfdDebounceTimerRef.current);
            if (cfdChannel.current) cfdChannel.current.close();
            if (supabaseCfdRef.current) supabase.removeChannel(supabaseCfdRef.current);
        };
    }, []);

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
    }, [broadcastCFD]);

    React.useEffect(() => {
        const currentMsg = computeCurrentCFDPayload();
        broadcastCFD(currentMsg);
    }, [computeCurrentCFDPayload, broadcastCFD]);
    
    const hasNewItems = order.items.some(item => !item.db_id);

    return (
        <aside className="w-[380px] lg:w-[440px] bg-[#F5F5F2] border-l border-[#D1D1CD] flex flex-col h-full shadow-sm z-30 font-sans text-[#1A1A1A] select-none shrink-0 overflow-hidden">
            {/* Order Header */}
            <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between shrink-0">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-mono font-bold text-xs tracking-wider uppercase">Order Details</h3>
                        {booking && (
                            <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 px-1.5 py-0.5 rounded border border-[oklch(52%_0.16_28)]/20">
                                #{getShortBookingId(booking)}
                            </span>
                        )}
                    </div>
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
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
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
                <div className="flex items-center gap-1.5 flex-wrap">
                    {onOpenMenu && (
                        <button
                            type="button"
                            onClick={onOpenMenu}
                            className="text-[10px] font-bold bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white border border-[oklch(52%_0.16_28)] px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1 shadow-2xs font-mono uppercase"
                            title="เปิดเมนูเพื่อคีย์และสั่งอาหารเข้าโต๊ะนี้"
                        >
                            <Plus size={12} />
                            <span>สั่งอาหาร / คีย์เมนู</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowEmergencyModal(true)}
                        className="text-[10px] font-bold bg-[oklch(18%_0.012_28)] hover:bg-black text-[oklch(97%_0.008_28)] border border-[oklch(18%_0.012_28)] px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1 shadow-2xs font-mono uppercase"
                        title="เพิ่มเมนูพิเศษและกำหนดราคาเอง"
                    >
                        <Plus size={12} />
                        <span>เมนูเพิ่มเติม</span>
                    </button>
                    <button 
                        onClick={onClear}
                        title="เคลียร์บิล / ยกเลิก"
                        className="p-1.5 text-[#767673] hover:text-red-600 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg transition-all cursor-pointer"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
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
                                <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider block">Attached Member</span>
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[8px] font-mono font-bold rounded">
                                        แต้ม x{tierMultiplier}
                                    </span>
                                </div>
                                <p className="text-sm font-bold text-[oklch(18%_0.012_28)] truncate uppercase flex items-center gap-1">
                                    {attachedMemberCrm?.display_name || booking?.profiles?.display_name || 'Anonymous User'} 
                                    {(attachedMemberCrm?.current_tier || booking?.profiles?.current_tier) && (
                                        <span className="px-1.5 py-0.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-[9px] font-mono font-bold rounded uppercase">
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
                    <div className="h-full flex flex-col items-center justify-center text-[#767673] gap-3 opacity-90 font-mono text-xs font-bold uppercase tracking-wider py-8">
                        <Utensils size={32} strokeWidth={1.5} className="opacity-40" />
                        <span className="opacity-60">Cart is empty / ยังไม่มีรายการ</span>
                        {onOpenMenu && (
                            <button
                                type="button"
                                onClick={onOpenMenu}
                                className="bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white px-4 py-2 rounded-xl text-xs font-bold font-sans tracking-normal uppercase cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                            >
                                <Plus size={14} />
                                <span>+ สั่งอาหาร / คีย์รายการ</span>
                            </button>
                        )}
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

                    {currentMemberForDisc && (
                        <div className="flex justify-between items-center text-emerald-700 font-bold py-1 border-t border-[#D1D1CD]/40 mt-1 text-xs">
                            <span className="flex items-center gap-1">
                                <span>+ EARNED POINTS (สะสมแต้ม)</span>
                                <span className="text-[8px] bg-emerald-100 px-1 py-0.2 rounded text-emerald-800 font-mono">x{tierMultiplier}</span>
                            </span>
                            <span className="font-mono">+{estimatedPointsEarned} xhaus</span>
                        </div>
                    )}

                    {(promoDiscount > 0 || manualDiscount > 0 || xhausDiscount > 0 || rewardDiscount > 0) && (
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
                                    <span>xhaus REDEEMED (ตัดแต้ม -{xhausToRedeem || Math.ceil(xhausDiscount)} xhaus)</span>
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
                                        setCashStep('input');
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
                                        onClick={() => onOpenSplitPayment?.(includeTax)}
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

            {/* Overlay Modals (Portaled directly to document.body for true full-screen centering) */}
            {activeModal === 'crm' && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 font-sans backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
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
                                ) : currentMemberProfile ? (
                                    <div className="space-y-4 text-left">
                                        {/* Member Profile Card */}
                                        <div className="bg-[#E0E0DC] border border-[#B0B0AC] rounded-xl p-4 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)] shrink-0 font-mono font-bold text-base">
                                                    {currentMemberProfile.display_name?.charAt(0).toUpperCase() || 'U'}
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
                                                    <p className="text-base font-bold text-[#1A1A1A] uppercase mt-1 truncate">{currentMemberProfile.display_name || 'Anonymous User'}</p>
                                                    
                                                    {/* Display Phone & Email */}
                                                    <div className="flex flex-col gap-1 mt-2 text-xs font-mono text-[#555]">
                                                        {currentMemberProfile.phone_number ? (
                                                            <span className="font-bold text-[#1A1A1A]">📞 {currentMemberProfile.phone_number}</span>
                                                        ) : (
                                                            <span className="text-red-600 font-bold">📞 No Phone (ไม่มีเบอร์)</span>
                                                        )}
                                                        {currentMemberProfile.email ? (
                                                            <span>✉️ {currentMemberProfile.email}</span>
                                                        ) : (
                                                            <span className="text-amber-700/80 font-medium">✉️ No Email</span>
                                                        )}
                                                        {currentMemberProfile.xhaus_balance !== undefined && (() => {
                                                            const originalBalance = Math.ceil(parseFloat(currentMemberProfile.xhaus_balance || 0));
                                                            const cartRewardCost = (order.items || []).reduce((sum, item) => sum + (parseFloat(item.xhaus_cost) || 0), 0);
                                                            const standaloneRewardCost = (appliedReward && !appliedReward.menu_items) ? parseFloat(appliedReward.xhaus_cost || 0) : 0;
                                                            const totalRedeemed = Math.ceil((parseFloat(xhausToRedeem) || 0) + cartRewardCost + standaloneRewardCost);
                                                            const currentBalance = Math.max(0, originalBalance - totalRedeemed);
                                                            return (
                                                                <span className="text-amber-800 font-bold text-sm mt-1 flex items-center gap-2">
                                                                    <span>🪙 {currentBalance.toLocaleString()} xhaus</span>
                                                                    {totalRedeemed > 0 && (
                                                                        <span className="text-red-500 font-mono text-[10px] bg-red-50 px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-wider">
                                                                            (-{totalRedeemed.toLocaleString()} Redeemed)
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            );
                                                        })()}
                                                        <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-mono">
                                                            <span className="bg-amber-100 border border-amber-300 text-amber-950 font-bold px-2 py-0.5 rounded">
                                                                STAMPS: {(currentMemberProfile.drink_stamp_count || 0)}/10
                                                            </span>
                                                            {(currentMemberProfile.free_drink_quota || 0) > 0 && (
                                                                <span className="bg-[#1A1A1A] text-white font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                                                    FREE DRINKS: {(currentMemberProfile.free_drink_quota)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Edit customer details button */}
                                                <button 
                                                    type="button"
                                                    onClick={() => startEditingProfile(currentMemberProfile)}
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
                                                            const cartRewardCost = (order.items || []).reduce((sum, item) => sum + (parseFloat(item.xhaus_cost) || 0), 0);
                                                            const maxBalance = (parseFloat(currentMemberProfile.xhaus_balance) || 0) - (appliedReward?.xhaus_cost || 0) - cartRewardCost;
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
                                        {/* Automatic Drink 10 Free 1 Card */}
                                        <div className="bg-[#FFF4E6] border border-amber-300 rounded-xl p-4 flex flex-col gap-3 shadow-sm text-left font-sans">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-1 rounded bg-[#1A1A1A] text-white font-mono text-xs font-bold">10+1</span>
                                                    <div>
                                                        <p className="text-xs font-mono font-bold text-amber-950 uppercase tracking-wide">
                                                            DRINK 10 FREE 1 PUNCHCARD
                                                        </p>
                                                        <p className="text-xs text-amber-900/80 font-medium">
                                                            ซื้อเครื่องดื่มสะสมครบ 10 แก้ว รับฟรี 1 แก้วทันที
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stamp Slots Progress Display */}
                                            <div className="flex items-center justify-between bg-white border border-amber-200 p-2.5 rounded-xl">
                                                <div className="flex items-center gap-1.5 overflow-x-auto">
                                                    {Array.from({ length: 10 }).map((_, idx) => {
                                                        const isFilled = idx < (currentMemberProfile.drink_stamp_count || 0);
                                                        return (
                                                            <div 
                                                                key={idx}
                                                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs border ${
                                                                    isFilled 
                                                                        ? 'bg-[#1A1A1A] border-black text-white shadow-xs' 
                                                                        : 'bg-amber-50 border-amber-200 text-amber-400'
                                                                }`}
                                                                title={`แก้วที่ ${idx + 1}`}
                                                            >
                                                                {isFilled ? '✓' : idx + 1}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="font-mono font-bold text-xs text-amber-950 shrink-0 ml-2">
                                                    {(currentMemberProfile.drink_stamp_count || 0)}/10
                                                </div>
                                            </div>

                                            {/* Free Quota Action Button */}
                                            {(currentMemberProfile.free_drink_quota || 0) > 0 ? (
                                                <div className="flex items-center justify-between bg-white border border-emerald-400 p-3 rounded-xl">
                                                    <div>
                                                        <p className="text-xs font-mono font-bold text-emerald-950 uppercase">FREE DRINKS: {(currentMemberProfile.free_drink_quota)} AVAILABLE</p>
                                                        <p className="text-[11px] text-emerald-800">
                                                            {useFreeDrinkQuota ? 'กำลังใช้งานส่วนลดแถมฟรี 1 แก้วในบิลนี้' : 'กดใช้สิทธิ์เพื่อลดราคาเครื่องดื่มที่ร่วมรายการ'}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (useFreeDrinkQuota) {
                                                                setUseFreeDrinkQuota(false);
                                                                toast.info("ยกเลิกการใช้สิทธิ์เครื่องดื่มฟรีแล้ว");
                                                            } else {
                                                                const eligibleItems = order.items.filter(isItemDrinkStampEligible);
                                                                if (eligibleItems.length === 0) {
                                                                    toast.error("กรุณาเพิ่มเมนูเครื่องดื่มที่ร่วมรายการลงในบิลก่อนใช้สิทธิ์ฟรีครับ");
                                                                    return;
                                                                }
                                                                setUseFreeDrinkQuota(true);
                                                                toast.success("ใช้สิทธิ์เครื่องดื่มฟรี 10 แถม 1 ในบิลนี้เรียบร้อยครับ");
                                                            }
                                                        }}
                                                        className={`px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all active:scale-95 ${
                                                            useFreeDrinkQuota 
                                                                ? 'bg-red-50 hover:bg-red-100 border border-red-300 text-red-700' 
                                                                : 'bg-[#1A1A1A] hover:bg-[#333330] text-white shadow-xs'
                                                        }`}
                                                    >
                                                        {useFreeDrinkQuota ? 'CANCEL' : 'APPLY FREE DRINK'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-amber-800/80 font-mono">
                                                    สะสมอีก {10 - (currentMemberProfile.drink_stamp_count || 0)} แก้ว เพื่อรับสิทธิ์เครื่องดื่มฟรี 1 แก้ว
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Customer Search Area */
                                    <div className="space-y-3.5">
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
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
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsQuickRegistering(true);
                                                    if (/^\d+$/.test(crmSearchTerm)) {
                                                        setQuickPhone(crmSearchTerm);
                                                    } else if (crmSearchTerm) {
                                                        setQuickName(crmSearchTerm);
                                                    }
                                                }}
                                                className="px-3.5 py-3 bg-[var(--color-accent)] hover:bg-[#d00000] text-white rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm shrink-0 flex items-center gap-1.5 h-12 active:scale-95"
                                                title="สมัครสมาชิกด่วน"
                                            >
                                                <UserPlus size={16} />
                                                <span className="hidden sm:inline">+ สมัครด่วน</span>
                                            </button>
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
                                                <div className="text-center font-mono text-xs font-bold text-[#767673] py-10 uppercase bg-[#F5F5F2] rounded-xl border border-dashed border-[#D1D1CD] flex flex-col items-center justify-center gap-3">
                                                    <span>No customer profiles found / ไม่พบสมาชิกลูกค้า</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsQuickRegistering(true);
                                                            if (/^\d+$/.test(crmSearchTerm)) {
                                                                setQuickPhone(crmSearchTerm);
                                                            } else if (crmSearchTerm) {
                                                                setQuickName(crmSearchTerm);
                                                            }
                                                        }}
                                                        className="px-4 py-2.5 bg-[var(--color-accent)] hover:bg-[#d00000] text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
                                                    >
                                                        <UserPlus size={14} />
                                                        <span>+ สมัครสมาชิกด่วนให้ลูกค้านี้</span>
                                                    </button>
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
                        </div>
                    </div>,
                    document.body
                )}

                {/* Quick Register Modal */}
                {isQuickRegistering && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4 font-sans backdrop-blur-xs animate-in fade-in duration-150">
                        <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl flex flex-col animate-in zoom-in-95 duration-150">
                            <div className="p-4 flex justify-between items-center bg-white border-b border-[#D1D1CD]">
                                <div>
                                    <h3 className="font-mono font-bold text-base uppercase tracking-wider text-[#1A1A1A]">QUICK REGISTER</h3>
                                    <p className="text-xs text-[#767673] font-medium mt-0.5">สมัครสมาชิกด่วน</p>
                                </div>
                                <button 
                                    onClick={() => setIsQuickRegistering(false)} 
                                    className="p-2 hover:bg-[#F5F5F2] text-[#767673] hover:text-[#1A1A1A] rounded-full transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleQuickRegisterCustomer} className="p-5 space-y-4 bg-white">
                                <div className="space-y-2">
                                    <label className="block text-xs font-mono font-bold text-[#767673] uppercase tracking-wider">
                                        CUSTOMER NAME <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text"
                                        placeholder="ชื่อลูกค้า"
                                        value={quickName}
                                        onChange={(e) => setQuickName(e.target.value)}
                                        className="w-full bg-[#F5F5F2] border border-[#D1D1CD] rounded-xl p-3 text-sm text-[#1A1A1A] font-bold focus:outline-none focus:border-[#1A1A1A] transition-colors font-mono"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-mono font-bold text-[#767673] uppercase tracking-wider">
                                        PHONE NUMBER <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="tel"
                                        placeholder="เบอร์โทรศัพท์ (9-10 หลัก)"
                                        value={quickPhone}
                                        onChange={(e) => setQuickPhone(e.target.value.replace(/\D/g, ''))}
                                        className="w-full bg-[#F5F5F2] border border-[#D1D1CD] rounded-xl p-3 text-sm text-[#1A1A1A] font-bold focus:outline-none focus:border-[#1A1A1A] transition-colors font-mono tracking-wider"
                                        required
                                        maxLength={10}
                                    />
                                </div>
                                
                                <button
                                    type="submit"
                                    disabled={isRegisteringMember || !quickName.trim() || quickPhone.length < 9}
                                    className="w-full bg-[var(--color-accent)] hover:bg-[#d00000] disabled:bg-[#D1D1CD] disabled:text-[#767673] text-white py-3.5 rounded-xl font-mono text-sm font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 mt-2"
                                >
                                    {isRegisteringMember ? 'REGISTERING...' : 'REGISTER & ATTACH'}
                                </button>
                            </form>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Discount Modal */}
                {activeModal === 'discount' && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 font-sans backdrop-blur-xs animate-in fade-in duration-150">
                        <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col animate-in zoom-in-95 duration-150">
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
                        </div>
                    </div>,
                    document.body
                )}

                {/* Checkout Modal (True Center Full-Screen Pop-up) */}
                {activeModal === 'checkout' && typeof document !== 'undefined' && createPortal(
                    <div 
                        onClick={() => setActiveModal(null)}
                        className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 font-sans backdrop-blur-xs animate-in fade-in duration-150"
                    >
                        <div 
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-2xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col text-[oklch(18%_0.012_28)] animate-in zoom-in-95 duration-150"
                        >
                            {/* Modal Header (Tabular Division) */}
                            <div className="p-4 flex justify-between items-center bg-[oklch(97%_0.008_28)] border-b border-[oklch(85%_0.012_28)]">
                                <div>
                                    <h3 className="font-mono font-bold text-sm uppercase tracking-wider text-[oklch(18%_0.012_28)]">CHECKOUT · ปิดบิล</h3>
                                    <p className="text-[11px] text-[oklch(42%_0.010_28)] mt-0.5">เลือกช่องทางชำระเงินและปิดบิล</p>
                                </div>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(18%_0.012_28)] hover:text-white rounded transition-colors cursor-pointer"
                                >
                                    ESC
                                </button>
                            </div>
                            
                            <div className="p-4 space-y-3 bg-[oklch(97%_0.008_28)]">
                                {/* Segmented Method Switcher (Zero-Icon Pure Typography) */}
                                <div className="grid grid-cols-2 p-1 bg-[oklch(94%_0.010_28)] rounded-lg border border-[oklch(85%_0.012_28)]">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setPaymentMethod('cash');
                                            setCashStep('input');
                                        }}
                                        className={`py-2 rounded font-mono text-xs uppercase tracking-wider transition-all cursor-pointer touch-manipulation ${paymentMethod === 'cash' ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold shadow-xs' : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] font-medium'}`}
                                    >
                                        CASH · เงินสด
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setPaymentMethod('qr');
                                        }}
                                        className={`py-2 rounded font-mono text-xs uppercase tracking-wider transition-all cursor-pointer touch-manipulation ${paymentMethod === 'qr' ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold shadow-xs' : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] font-medium'}`}
                                    >
                                        QR PROMPTPAY · สแกน
                                    </button>
                                </div>

                                {/* Total Amount Display Box */}
                                <div className="text-center bg-[oklch(94%_0.010_28)] py-3 px-4 rounded-lg border border-[oklch(85%_0.012_28)]">
                                    <p className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)] uppercase tracking-widest mb-0.5">NET TOTAL · ยอดชำระสุทธิ</p>
                                    <p className="text-3xl font-mono font-bold text-[oklch(52%_0.16_28)]">฿{Math.ceil(total).toLocaleString()}</p>
                                </div>

                                {/* --- CASH FLOW --- */}
                                {paymentMethod === 'cash' && (() => {
                                    const ceilTotal = Math.ceil(total);
                                    const parsedInput = parseFloat(cashReceivedInput);
                                    const hasInput = !isNaN(parsedInput) && cashReceivedInput !== '';
                                    const cashRecvNum = hasInput ? parsedInput : 0;
                                    const changeDue = Math.max(0, cashRecvNum - ceilTotal);
                                    const isShort = hasInput && cashRecvNum > 0 && cashRecvNum < ceilTotal;

                                    const smartPresets = [];
                                    if (ceilTotal > 0) {
                                        const candidateSet = new Set();
                                        if (ceilTotal % 100 !== 0) candidateSet.add(Math.ceil(ceilTotal / 50) * 50);
                                        if (ceilTotal % 100 !== 0) candidateSet.add(Math.ceil(ceilTotal / 100) * 100);
                                        if (ceilTotal < 500) candidateSet.add(500);
                                        if (ceilTotal < 1000) candidateSet.add(1000);
                                        if (ceilTotal >= 500 && ceilTotal < 1000) candidateSet.add(1000);
                                        if (ceilTotal >= 1000) {
                                            candidateSet.add(Math.ceil(ceilTotal / 100) * 100);
                                            candidateSet.add(Math.ceil(ceilTotal / 500) * 500);
                                            candidateSet.add(Math.ceil(ceilTotal / 1000) * 1000);
                                            if (candidateSet.size < 3) candidateSet.add(Math.ceil((ceilTotal + 500) / 500) * 500);
                                        }
                                        smartPresets.push(...Array.from(candidateSet).filter(amt => amt > ceilTotal).sort((a, b) => a - b).slice(0, 3));
                                    }

                                    if (cashStep === 'input') {
                                        return (
                                            <div className="space-y-2.5 animate-in fade-in duration-150">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)] uppercase tracking-wider">
                                                        CASH RECEIVED · ระบุยอดเงินสดที่รับมา
                                                    </p>
                                                    {cashReceivedInput && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setCashReceivedInput('')}
                                                            className="text-[10px] font-mono font-bold text-[oklch(52%_0.16_28)] hover:underline uppercase tracking-wider cursor-pointer"
                                                        >
                                                            CLEAR
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-mono font-bold text-[oklch(42%_0.010_28)]">
                                                        ฿
                                                    </span>
                                                    <input
                                                        type="number"
                                                        placeholder={`เช่น ${Math.ceil(ceilTotal / 100) * 100}`}
                                                        value={cashReceivedInput}
                                                        onChange={(e) => setCashReceivedInput(e.target.value)}
                                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-lg pl-10 pr-4 py-2.5 text-2xl font-mono font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-[oklch(52%_0.16_28)] h-12 placeholder:text-[oklch(70%_0.010_28)]"
                                                        autoFocus
                                                    />
                                                </div>

                                                {/* Single Clean Row of 4 Fast Presets (Pure Typography) */}
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-mono font-bold text-[oklch(42%_0.010_28)] uppercase tracking-wider">
                                                        QUICK TENDER · ปุ่มลัดข้ามไปสรุปเงินทอน
                                                    </p>
                                                    <div className="grid grid-cols-4 gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setCashReceivedInput(String(ceilTotal));
                                                                setCashStep('change');
                                                            }}
                                                            className="py-2.5 bg-[oklch(97%_0.008_28)] border border-[oklch(52%_0.16_28)] hover:bg-[oklch(52%_0.16_28)] hover:text-white rounded-lg font-mono font-bold text-xs text-[oklch(52%_0.16_28)] transition-colors cursor-pointer shadow-2xs active:scale-[0.98] flex flex-col items-center justify-center gap-0.5"
                                                        >
                                                            <span className="text-[9px] uppercase tracking-wider opacity-80">EXACT</span>
                                                            <span>฿{ceilTotal.toLocaleString()}</span>
                                                        </button>

                                                        {smartPresets.map(amt => (
                                                            <button
                                                                key={amt}
                                                                type="button"
                                                                onClick={() => {
                                                                    setCashReceivedInput(String(amt));
                                                                    setCashStep('change');
                                                                }}
                                                                className="py-2.5 bg-white border border-[oklch(85%_0.012_28)] hover:border-[oklch(18%_0.012_28)] rounded-lg font-mono font-bold text-xs text-[oklch(18%_0.012_28)] transition-colors cursor-pointer shadow-2xs active:scale-[0.98] flex flex-col items-center justify-center gap-0.5"
                                                            >
                                                                <span className="text-[9px] text-[oklch(42%_0.010_28)] uppercase">NOTE</span>
                                                                <span>฿{amt.toLocaleString()}</span>
                                                            </button>
                                                        ))}

                                                        {smartPresets.length < 3 && [100, 500, 1000].filter(d => !smartPresets.includes(d) && d > ceilTotal).slice(0, 3 - smartPresets.length).map(amt => (
                                                            <button
                                                                key={amt}
                                                                type="button"
                                                                onClick={() => {
                                                                    setCashReceivedInput(String(amt));
                                                                    setCashStep('change');
                                                                }}
                                                                className="py-2.5 bg-white border border-[oklch(85%_0.012_28)] hover:border-[oklch(18%_0.012_28)] rounded-lg font-mono font-bold text-xs text-[oklch(18%_0.012_28)] transition-colors cursor-pointer shadow-2xs active:scale-[0.98] flex flex-col items-center justify-center gap-0.5"
                                                            >
                                                                <span className="text-[9px] text-[oklch(42%_0.010_28)] uppercase">NOTE</span>
                                                                <span>฿{amt.toLocaleString()}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Shortfall Alert */}
                                                {isShort && (
                                                    <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(52%_0.16_28)] rounded-lg p-2.5 text-[oklch(18%_0.012_28)] animate-in fade-in duration-150 flex items-center justify-between font-mono">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                                                            SHORT BY · ยังขาดอีก
                                                        </span>
                                                        <span className="text-base font-bold text-[oklch(52%_0.16_28)]">
                                                            ฿{(ceilTotal - cashRecvNum).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    // CASH STEP 2: Change Due Screen (Hero Rams Element)
                                    return (
                                        <div className="space-y-3 animate-in zoom-in-95 duration-150">
                                            <div className="flex items-center justify-between px-3 py-2 bg-[oklch(94%_0.010_28)] rounded-lg border border-[oklch(85%_0.012_28)] text-xs font-mono text-[oklch(42%_0.010_28)]">
                                                <span>RECEIVED: <strong className="text-[oklch(18%_0.012_28)]">฿{cashRecvNum.toLocaleString()}</strong></span>
                                                <span>BILL: <strong className="text-[oklch(18%_0.012_28)]">฿{ceilTotal.toLocaleString()}</strong></span>
                                            </div>

                                            {/* Hero Change Due Box */}
                                            <div className="bg-[oklch(94%_0.010_28)] border-2 border-[oklch(45%_0.08_140)] rounded-xl p-5 text-center shadow-xs">
                                                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[oklch(45%_0.08_140)] block">
                                                    CHANGE DUE · เงินทอนลูกค้า
                                                </span>
                                                <p className="text-5xl font-mono font-bold text-[oklch(18%_0.012_28)] tracking-tight my-2">
                                                    ฿{changeDue.toLocaleString()}
                                                </p>
                                                <span className="text-[11px] text-[oklch(42%_0.010_28)] font-sans">
                                                    {changeDue > 0 ? 'โปรดคืนเงินทอนให้ลูกค้าและกดปิดบิล' : 'รับเงินสดพอดี'}
                                                </span>
                                            </div>

                                            {/* Back / Edit Button */}
                                            <button
                                                type="button"
                                                onClick={() => setCashStep('input')}
                                                className="w-full py-1.5 text-xs font-mono font-bold text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] uppercase tracking-wider transition-colors text-center cursor-pointer"
                                            >
                                                [ EDIT TENDER · แก้ไขยอดเงินรับ ]
                                            </button>
                                        </div>
                                    );
                                })()}

                                {/* --- QR FLOW --- */}
                                {paymentMethod === 'qr' && (
                                    <div className="space-y-2.5 animate-in fade-in duration-150">
                                        <div className="p-3.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg text-center space-y-1">
                                            <p className="text-xs font-mono font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                                                PROMPTPAY READY · พร้อมรับชำระ
                                            </p>
                                            <p className="text-[11px] text-[oklch(42%_0.010_28)] leading-relaxed">
                                                ลูกค้าสแกนได้จากหน้าจอ CFD หรือพิมพ์ใบแจ้งยอด
                                            </p>
                                        </div>

                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (onOpenSlip) {
                                                    const totalDiscountVal = memberDiscount + promoDiscount + manualDiscount + xhausDiscount + rewardDiscount + freeDrinkDiscount;
                                                    onOpenSlip('billing', {
                                                        discount_amount: totalDiscountVal,
                                                        total_amount: total,
                                                        xhaus_discount: xhausDiscount,
                                                        manual_discount: manualDiscount,
                                                        promo_discount: promoDiscount,
                                                        member_discount: memberDiscount,
                                                        include_tax: includeTax
                                                    });
                                                }
                                            }}
                                            className="w-full bg-white hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] py-2.5 rounded-lg transition-colors shadow-2xs font-mono font-bold text-xs uppercase tracking-wider cursor-pointer"
                                        >
                                            PRINT BILL & QR · พิมพ์ใบแจ้งยอด
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Modal Action Footer (Stark CTAs) */}
                            <div className="p-4 border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                                {/* Cash Step 1 Button */}
                                {paymentMethod === 'cash' && cashStep === 'input' && (() => {
                                    const ceilTotal = Math.ceil(total);
                                    const parsedCash = parseFloat(cashReceivedInput);
                                    const isReady = !isNaN(parsedCash) && parsedCash >= ceilTotal;
                                    return (
                                        <button
                                            type="button"
                                            disabled={!isReady}
                                            onClick={() => setCashStep('change')}
                                            className="w-full bg-[oklch(18%_0.012_28)] hover:bg-black text-[oklch(97%_0.008_28)] py-3.5 rounded-lg font-mono text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            NEXT · คำนวณเงินทอน
                                        </button>
                                    );
                                })()}

                                {/* Cash Step 2 Settle Button */}
                                {paymentMethod === 'cash' && cashStep === 'change' && (() => {
                                    const ceilTotal = Math.ceil(total);
                                    const parsedCash = parseFloat(cashReceivedInput);
                                    const cashRecvNum = (!isNaN(parsedCash) && parsedCash > 0) ? parsedCash : ceilTotal;
                                    const changeDueVal = Math.max(0, cashRecvNum - ceilTotal);

                                    return (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const rewardItemsInCart = order.items.filter(item => item.is_reward);
                                                const cartRewardCost = rewardItemsInCart.reduce((sum, item) => sum + (parseFloat(item.xhaus_cost) || 0), 0);
                                                const totalXhausRedeemed = (xhausToRedeem || 0) + (appliedReward ? parseFloat(appliedReward.xhaus_cost || 0) : cartRewardCost);
                                                
                                                const finalRewardCode = appliedReward?.claim_code || rewardItemsInCart[0]?.claim_code || null;
                                                const finalRewardId = appliedReward?.id || rewardItemsInCart[0]?.reward_id || null;

                                                try {
                                                    localStorage.setItem('last_cash_received', String(cashRecvNum));
                                                    localStorage.setItem('last_cash_change', String(changeDueVal));
                                                } catch (e) {}

                                                if (changeDueVal > 0) {
                                                    toast.success(
                                                        `เงินทอน: ฿${changeDueVal.toLocaleString()} (รับเงินสด ฿${cashRecvNum.toLocaleString()})`,
                                                        { duration: 6000 }
                                                    );
                                                } else {
                                                    toast.success(`รับเงินสดพอดี ฿${cashRecvNum.toLocaleString()}`, { duration: 4000 });
                                                }

                                                if (onCheckout) {
                                                    onCheckout(
                                                        'cash',
                                                        includeTax,
                                                        pointsEarned,
                                                        totalXhausRedeemed,
                                                        xhausDiscount,
                                                        promoDiscount + rewardDiscount,
                                                        manualDiscount,
                                                        finalRewardCode,
                                                        finalRewardId,
                                                        useFreeDrinkQuota,
                                                        cashRecvNum,
                                                        changeDueVal
                                                    );
                                                }
                                                setActiveModal(null);
                                            }}
                                            className="w-full bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white py-3.5 rounded-lg font-mono text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                                        >
                                            SETTLE CASH & PRINT · ปิดบิลเงินสด
                                        </button>
                                    );
                                })()}

                                {/* QR Settle Button */}
                                {paymentMethod === 'qr' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const rewardItemsInCart = order.items.filter(item => item.is_reward);
                                            const cartRewardCost = rewardItemsInCart.reduce((sum, item) => sum + (parseFloat(item.xhaus_cost) || 0), 0);
                                            const totalXhausRedeemed = (xhausToRedeem || 0) + (appliedReward ? parseFloat(appliedReward.xhaus_cost || 0) : cartRewardCost);
                                            
                                            const finalRewardCode = appliedReward?.claim_code || rewardItemsInCart[0]?.claim_code || null;
                                            const finalRewardId = appliedReward?.id || rewardItemsInCart[0]?.reward_id || null;

                                            toast.success('รับชำระเงินผ่าน QR สำเร็จ', { duration: 4000 });

                                            if (onCheckout) {
                                                onCheckout(
                                                    'qr',
                                                    includeTax,
                                                    pointsEarned,
                                                    totalXhausRedeemed,
                                                    xhausDiscount,
                                                    promoDiscount + rewardDiscount,
                                                    manualDiscount,
                                                    finalRewardCode,
                                                    finalRewardId,
                                                    useFreeDrinkQuota,
                                                    0,
                                                    0
                                                );
                                            }
                                            setActiveModal(null);
                                        }}
                                        className="w-full bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white py-3.5 rounded-lg font-mono text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                                    >
                                        CONFIRM QR & SETTLE · ยืนยันชำระ QR
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Edit Guest Count (Pax) Modal */}
            {showEditPaxModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 font-sans backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-[#1A1A1A] animate-in zoom-in-95 duration-150">
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
                </div>,
                document.body
            )}

            {/* View Slip Modal */}
            <ViewSlipModal 
                url={viewSlipModalUrl} 
                onClose={() => setViewSlipModalUrl(null)} 
            />

            {/* Emergency / Custom Item Modal */}
            <POSEmergencyItemModal
                isOpen={showEmergencyModal}
                onClose={() => setShowEmergencyModal(false)}
                onConfirm={(customItem) => {
                    if (onAddEmergencyItem) {
                        onAddEmergencyItem(customItem);
                    }
                    toast.success(`เพิ่มเมนูเพิ่มเติม: ${customItem.name} (฿${customItem.price})`);
                }}
            />
        </aside>
    );
});

export default POSOrderPanel;

const OrderItemRow = React.memo(function OrderItemRow({ item, onUpdateQuantity, onUpdateItemNote }) {
    const isRewardItem = item.is_reward || !!item.claim_code || (item.name || '').includes('แลกสิทธิ');
    const isCustomEmergency = Boolean(item.is_custom || item.is_emergency || String(item.id).startsWith('custom_'));

    return (
        <div 
            className="bg-white border border-[#D1D1CD] p-3 rounded-xl flex items-center justify-between shadow-sm select-none"
        >
            <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <h5 className="font-bold text-sm leading-tight text-[oklch(18%_0.012_28)] uppercase truncate">{item.name}</h5>
                    {isCustomEmergency && (
                        <span className="text-[9px] font-mono font-bold bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] border border-[oklch(52%_0.16_28)]/30 px-1 py-0.2 rounded shrink-0">
                            [เมนูเพิ่มเติม]
                        </span>
                    )}
                </div>
                
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
                    disabled={isRewardItem}
                    onClick={() => {
                        if (isRewardItem) {
                            toast.error("รายการแลกสิทธิไม่สามารถเพิ่มจำนวนได้ครับ");
                            return;
                        }
                        onUpdateQuantity(item.id, 1);
                    }}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center bg-white text-[#1A1A1A] transition-transform shadow-xs cursor-pointer touch-manipulation ${
                        isRewardItem ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#F5F5F2] active:scale-95'
                    }`}
                    title={isRewardItem ? "รายการแลกสิทธิไม่สามารถเพิ่มจำนวนได้" : "เพิ่มจำนวน"}
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
