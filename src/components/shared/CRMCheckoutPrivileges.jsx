import React, { useState, useEffect, useMemo } from 'react'
import { Coins, Coffee, Check, AlertCircle, X, Sparkles } from 'lucide-react'

/**
 * CRM Checkout Privileges Component (Dieter Rams + Thai Modern Aesthetics)
 * Supports:
 * 1. 10 Free 1 Drink Reward (ใช้สิทธิ์แก้วฟรีเมื่อสะสมครบ)
 * 2. xhaus Coins Redemption (แลกเหรียญ xhaus ตามกฎที่กำหนด: min redeem, redeem rate, max bill %)
 */
export default function CRMCheckoutPrivileges({
    memberProfile,
    crmSettings = {},
    cart = [],
    isItemDrinkStampEligible,
    useFreeDrinkQuota,
    onToggleFreeDrink,
    xhausToRedeem = 0,
    onApplyXhaus,
    onCancelXhaus,
    cartSubtotal = 0,
    promoDiscount = 0
}) {
    if (!memberProfile) return null

    // 1. CRM Settings Parsing
    const redeemRate = parseFloat(crmSettings.crm_redeem_rate_xhaus) || 1.0
    const minRedeem = parseFloat(crmSettings.crm_min_redeem_xhaus) || 10.0
    const maxRedeemPercent = parseFloat(crmSettings.crm_max_redeem_percent) || 100.0
    const memberBalance = Math.max(0, parseFloat(memberProfile.xhaus_balance || 0))
    const currentStamps = parseInt(memberProfile.drink_stamp_count || 0, 10)
    const currentQuota = parseInt(memberProfile.free_drink_quota || 0, 10)

    // Total free drinks earned / available
    const availableFreeDrinks = Math.max(0, currentQuota + Math.floor(currentStamps / 10))

    // 2. Eligible Drinks Evaluation in Cart
    const eligibleDrinkItems = useMemo(() => {
        if (!isItemDrinkStampEligible || !cart || cart.length === 0) return []
        return cart.filter(isItemDrinkStampEligible)
    }, [cart, isItemDrinkStampEligible])

    const hasEligibleDrinks = eligibleDrinkItems.length > 0

    // Price of the free drink (lowest priced eligible drink in cart, matching POS logic)
    const freeDrinkValue = useMemo(() => {
        if (!hasEligibleDrinks) return 0
        const prices = eligibleDrinkItems.map(i => parseFloat(i.totalPricePerUnit || i.price) || 0)
        return Math.min(...prices)
    }, [eligibleDrinkItems, hasEligibleDrinks])

    const freeDrinkDiscount = useFreeDrinkQuota ? freeDrinkValue : 0

    // 3. xhaus Discount Constraints
    const netBeforeXhaus = Math.max(0, cartSubtotal - promoDiscount - freeDrinkDiscount)
    const maxDiscountBaht = (netBeforeXhaus * maxRedeemPercent) / 100
    const maxCoinsAllowed = Math.min(memberBalance, Math.floor((maxDiscountBaht / redeemRate) * 100) / 100)

    const [redeemInput, setRedeemInput] = useState(xhausToRedeem > 0 ? String(xhausToRedeem) : '')
    const [inputError, setInputError] = useState(null)

    // Sync input if xhausToRedeem is cancelled externally
    useEffect(() => {
        if (xhausToRedeem === 0) {
            setRedeemInput('')
            setInputError(null)
        } else {
            setRedeemInput(String(xhausToRedeem))
        }
    }, [xhausToRedeem])

    const handleApplyCoins = () => {
        setInputError(null)
        const coins = parseFloat(redeemInput) || 0

        if (coins < minRedeem) {
            setInputError(`ต้องแลกขั้นต่ำอย่างน้อย ${minRedeem} xhaus`)
            return
        }
        if (coins > memberBalance) {
            setInputError(`แต้มสะสมมีเพียง ${memberBalance.toFixed(0)} xhaus`)
            return
        }
        if (coins > maxCoinsAllowed) {
            setInputError(`แลกได้สูงสุดไม่เกิน ${maxCoinsAllowed} xhaus (จำกัด ${maxRedeemPercent}% ของยอด)`)
            return
        }

        onApplyXhaus?.(coins)
    }

    const handleQuickMax = () => {
        setInputError(null)
        if (maxCoinsAllowed >= minRedeem) {
            setRedeemInput(String(maxCoinsAllowed))
            onApplyXhaus?.(maxCoinsAllowed)
        } else {
            setInputError(`ยอดแลกสูงสุด (${maxCoinsAllowed} xhaus) ต่ำกว่าเกณฑ์ขั้นต่ำ ${minRedeem} xhaus`)
        }
    }

    const effectiveXhausDiscount = Math.min(xhausToRedeem * redeemRate, maxDiscountBaht, netBeforeXhaus)

    return (
        <div className="space-y-3 font-sans">
            {/* Header Tag */}
            <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-1.5">
                <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                    สิทธิประโยชน์สมาชิก CRM (Loyalty Privileges)
                </span>
                <span className="font-mono text-[10px] text-[oklch(52%_0.16_28)] font-bold">
                    🪙 {memberBalance.toFixed(0)} xhaus | ☕ {currentStamps}/10
                </span>
            </div>

            {/* 1. Free Drink Quota Card (สิทธิ์แก้วฟรี 10 แถม 1) */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-3.5 rounded-rams space-y-2.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[oklch(45%_0.08_140)]/15 text-[oklch(45%_0.08_140)] flex items-center justify-center font-bold text-xs">
                            <Coffee size={13} />
                        </div>
                        <div>
                            <span className="font-mono text-[9px] font-bold text-[oklch(45%_0.08_140)] uppercase tracking-wider block">
                                [ 10 FREE 1 // แก้วฟรีสะสม ]
                            </span>
                            <span className="text-xs font-bold text-[oklch(18%_0.012_28)]">
                                {availableFreeDrinks > 0 
                                    ? `มีสิทธิ์เครื่องดื่มฟรี ${availableFreeDrinks} แก้ว` 
                                    : `สะสมแสตมป์เครื่องดื่ม (${currentStamps}/10)`
                                }
                            </span>
                        </div>
                    </div>

                    {availableFreeDrinks > 0 && (
                        <span className="px-2 py-0.5 bg-[oklch(45%_0.08_140)] text-white text-[9px] font-mono font-bold rounded-rams uppercase">
                            พร้อมใช้งาน
                        </span>
                    )}
                </div>

                {availableFreeDrinks > 0 ? (
                    <div className="bg-white/90 border border-[oklch(85%_0.012_28)] p-3 rounded-rams flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-0.5">
                            {useFreeDrinkQuota ? (
                                <p className="text-xs font-bold text-emerald-800 font-mono flex items-center gap-1.5">
                                    <Check size={14} className="text-emerald-700" />
                                    <span>ใช้สิทธิ์เครื่องดื่มฟรี 1 แก้ว (-฿{freeDrinkValue}.-)</span>
                                </p>
                            ) : (
                                <p className="text-xs text-[oklch(42%_0.010_28)]">
                                    {hasEligibleDrinks 
                                        ? `กดใช้สิทธิ์เพื่อลดราคาเครื่องดื่มที่ร่วมรายการ (-฿${freeDrinkValue}.-)`
                                        : 'เลือกเครื่องดื่มในเมนู (เช่น กาแฟ ชา โซดา) เพื่อใช้สิทธิ์'
                                    }
                                </p>
                            )}
                            <p className="text-[10px] text-[oklch(55%_0.010_28)] font-mono">
                                * โควตาแก้วฟรีสะสมคงเหลือ: {availableFreeDrinks} สิทธิ์
                            </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                            {useFreeDrinkQuota ? (
                                <button
                                    type="button"
                                    onClick={() => onToggleFreeDrink?.(false)}
                                    className="w-full sm:w-auto px-3.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-mono text-xs font-bold rounded-rams cursor-pointer transition-colors"
                                >
                                    ยกเลิก
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onToggleFreeDrink?.(true)}
                                    disabled={!hasEligibleDrinks}
                                    className="w-full sm:w-auto px-4 py-1.5 bg-[oklch(18%_0.012_28)] hover:bg-black text-white font-mono text-xs font-bold rounded-rams disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 shadow-2xs"
                                >
                                    ใช้สิทธิ์แก้วฟรี
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Stamp Progress (10 Slots Grid) */
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                            {Array.from({ length: 10 }).map((_, idx) => {
                                const isStamped = idx < currentStamps
                                return (
                                    <div
                                        key={idx}
                                        className={`w-6 h-6 rounded-rams flex items-center justify-center font-mono text-[10px] font-bold border transition-all ${
                                            isStamped
                                                ? 'bg-[oklch(18%_0.012_28)] text-white border-black shadow-2xs'
                                                : 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)]'
                                        }`}
                                        title={`แก้วที่ ${idx + 1}`}
                                    >
                                        {isStamped ? '✓' : idx + 1}
                                    </div>
                                )
                            })}
                            <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] pl-1.5">
                                {currentStamps}/10
                            </span>
                        </div>
                        <p className="text-[10px] text-[oklch(55%_0.010_28)] font-mono">
                            สะสมอีก {10 - currentStamps} แก้ว เพื่อรับสิทธิ์เครื่องดื่มฟรี 1 แก้ว
                        </p>
                    </div>
                )}
            </div>

            {/* 2. xhaus Coins Redemption Card (แลกเหรียญ xhaus) */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-3.5 rounded-rams space-y-2.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[oklch(52%_0.16_28)]/15 text-[oklch(52%_0.16_28)] flex items-center justify-center font-bold text-xs">
                            <Coins size={13} />
                        </div>
                        <div>
                            <span className="font-mono text-[9px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block">
                                [ XHAUS COINS // แลกแต้มส่วนลด ]
                            </span>
                            <span className="text-xs font-bold text-[oklch(18%_0.012_28)]">
                                1 xhaus = ฿{redeemRate.toFixed(2).replace(/\.00$/, '')} (ขั้นต่ำ {minRedeem.toFixed(0)} xhaus)
                            </span>
                        </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-[oklch(52%_0.16_28)]">
                        🪙 {memberBalance.toFixed(0)} pts
                    </span>
                </div>

                {xhausToRedeem > 0 ? (
                    <div className="bg-white/90 border border-amber-300 p-3 rounded-rams flex items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-bold text-amber-950 font-mono">
                                แลกใช้ {xhausToRedeem} xhaus (-฿{effectiveXhausDiscount.toLocaleString()}.-)
                            </p>
                            <p className="text-[10px] text-amber-800/80 font-mono">
                                แต้มคงเหลือหลังหัก: {(memberBalance - xhausToRedeem).toFixed(0)} xhaus
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onCancelXhaus?.()}
                            className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-mono text-xs font-bold rounded-rams cursor-pointer transition-colors"
                        >
                            ยกเลิก
                        </button>
                    </div>
                ) : (
                    <div>
                        {memberBalance < minRedeem ? (
                            <p className="text-[11px] text-[oklch(55%_0.010_28)] font-mono py-1">
                                * ต้องสะสมครบ {minRedeem.toFixed(0)} xhaus เพื่อเริ่มแลกส่วนลด (ปัจจุบันมี {memberBalance.toFixed(0)} xhaus)
                            </p>
                        ) : maxCoinsAllowed < minRedeem ? (
                            <p className="text-[11px] text-[oklch(55%_0.010_28)] font-mono py-1">
                                * ยอดบิลปัจจุบันสามารถแลกได้ไม่เกิน {maxCoinsAllowed.toFixed(0)} xhaus (ขั้นต่ำ {minRedeem.toFixed(0)} xhaus)
                            </p>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min={minRedeem}
                                        max={maxCoinsAllowed}
                                        value={redeemInput}
                                        onChange={(e) => {
                                            setRedeemInput(e.target.value)
                                            setInputError(null)
                                        }}
                                        placeholder={`เช่น ${minRedeem}`}
                                        className="flex-1 bg-white border border-[oklch(85%_0.012_28)] rounded-rams px-3 py-2 text-sm font-mono font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-[oklch(18%_0.012_28)] transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleQuickMax}
                                        className="px-2.5 py-2 bg-canvas hover:bg-paper border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono text-[11px] font-bold rounded-rams transition-colors shrink-0"
                                        title={`แลกสูงสุด ${maxCoinsAllowed} xhaus`}
                                    >
                                        แลกเต็ม {maxCoinsAllowed.toFixed(0)}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleApplyCoins}
                                        disabled={!redeemInput}
                                        className="px-4 py-2 bg-[oklch(18%_0.012_28)] hover:bg-black text-white font-mono text-xs font-bold rounded-rams disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 shadow-2xs shrink-0"
                                    >
                                        ใช้แต้ม
                                    </button>
                                </div>

                                {inputError && (
                                    <p className="text-error text-xs font-mono font-bold flex items-center gap-1">
                                        <AlertCircle size={12} /> {inputError}
                                    </p>
                                )}

                                <div className="flex justify-between items-center text-[10px] text-[oklch(55%_0.010_28)] font-mono pt-0.5">
                                    <span>จำกัดไม่เกิน {maxRedeemPercent}% ของบิล</span>
                                    <span>แลกได้สูงสุด: {maxCoinsAllowed.toFixed(0)} xhaus (ลด ฿{(maxCoinsAllowed * redeemRate).toLocaleString()}.-)</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
