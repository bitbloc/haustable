/**
 * In The Haus - CRM & Loyalty (xhaus) Helper Module
 * Implements Dieter Rams + Thai Modern Aesthetics & Mathematical Calculations
 * Supports dynamic relationship tiers, granular coin earning rules, and redemption limits.
 */

export const DEFAULT_CRM_SETTINGS = {
    crm_welcome_xhaus: '10.00',
    crm_redeem_rate_xhaus: '1.00',     // 1 xhaus = 1.00 Baht
    crm_min_redeem_xhaus: '10.00',     // Min coins required to redeem
    crm_base_spend_amount: '100.00',   // Every 100 Baht spent = X coins
    crm_max_redeem_percent: '100',     // Max % of bill total payable by coins (100 = 100%)
    crm_tier_eval_months: '12',        // Rolling evaluation window (12 months)
    crm_grace_period_days: '30'        // Grace period retention buffer (30 days)
};

export const DEFAULT_CRM_TIERS = [
    {
        id: 'tier_common',
        level_code: '01',
        name: 'Haus Common',
        min_spend: 0,
        multiplier: 1.00,
        tagline: '"พื้นที่ที่เราเริ่มรู้จักกัน" — ทุกคนเริ่มต้นจากพื้นที่เดียวกัน',
        condition_text: 'สมัครสมาชิกและมียอดใช้จ่ายสะสม 12 เดือนแรกเริ่ม (0 – 3,999 บาท)',
        badge_theme: 'bronze',
        color_accent: 'oklch(52% 0.16 28)',
        card_bg: 'bg-[#F2F2EC] border-[#B8B8B2] text-[#1A1A1A]',
        card_badge: 'bg-zinc-200/70 text-zinc-800 border-zinc-300'
    },
    {
        id: 'tier_people',
        level_code: '02',
        name: 'Haus People',
        min_spend: 4000,
        multiplier: 1.25,
        tagline: '"คนที่กลับมาเจอกันบ่อยขึ้น" — ไม่ได้แค่มาเยือนแต่กลับมาเจอกันเรื่อยๆ',
        condition_text: 'มียอดจ่ายสะสมสุทธิครบ 4,000 บาทภายใน 12 เดือน',
        badge_theme: 'silver',
        color_accent: 'oklch(60% 0.12 220)',
        card_bg: 'bg-[#2E3138] border-[#A0AEC0] text-slate-100',
        card_badge: 'bg-slate-700/60 text-slate-200 border-slate-500/40'
    },
    {
        id: 'tier_inner',
        level_code: '03',
        name: 'Inner Haus',
        min_spend: 12000,
        multiplier: 1.50,
        tagline: '"คนในบ้าน" — เข้ามาสัมผัสพื้นที่ข้างในบ้านอย่างอบอุ่นแล้ว',
        condition_text: 'มียอดจ่ายสะสมสุทธิครบ 12,000 บาทภายใน 12 เดือน',
        badge_theme: 'gold',
        color_accent: 'oklch(75% 0.18 85)',
        card_bg: 'bg-[#12141a] border-[#D4AF37] text-white',
        card_badge: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40'
    }
];

/**
 * Safely parse and normalize tiers configuration from app_settings
 * @param {string|Array|null} rawConfig - JSON string or array of tiers
 * @returns {Array} Sorted list of normalized tiers (by min_spend ASC)
 */
export function parseTiersConfig(rawConfig) {
    if (!rawConfig) return [...DEFAULT_CRM_TIERS];
    
    let parsed = [];
    if (typeof rawConfig === 'string') {
        try {
            parsed = JSON.parse(rawConfig);
        } catch (e) {
            console.warn("Failed to parse crm_tiers_config JSON:", e);
            return [...DEFAULT_CRM_TIERS];
        }
    } else if (Array.isArray(rawConfig)) {
        parsed = rawConfig;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
        return [...DEFAULT_CRM_TIERS];
    }

    // Normalize and ensure required fields
    const normalized = parsed.map((tier, index) => ({
        id: tier.id || `tier_${index + 1}`,
        level_code: tier.level_code || String(index + 1).padStart(2, '0'),
        name: String(tier.name || `Tier ${index + 1}`).trim(),
        min_spend: Math.max(0, parseFloat(tier.min_spend) || 0),
        multiplier: Math.max(0.1, parseFloat(tier.multiplier) || 1.0),
        tagline: tier.tagline || '',
        condition_text: tier.condition_text || `มียอดใช้จ่ายสะสม ${Number(tier.min_spend || 0).toLocaleString()} บาทขึ้นไป`,
        badge_theme: tier.badge_theme || (index === 0 ? 'bronze' : index === 1 ? 'silver' : 'gold'),
        color_accent: tier.color_accent || 'oklch(52% 0.16 28)',
        card_bg: tier.card_bg || (index === 0 ? 'bg-[#F2F2EC] border-[#B8B8B2] text-[#1A1A1A]' : index === 1 ? 'bg-[#2E3138] border-[#A0AEC0] text-slate-100' : 'bg-[#12141a] border-[#D4AF37] text-white'),
        card_badge: tier.card_badge || (index === 0 ? 'bg-zinc-200/70 text-zinc-800 border-zinc-300' : index === 1 ? 'bg-slate-700/60 text-slate-200 border-slate-500/40' : 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40')
    }));

    // Sort ascending by min_spend
    return normalized.sort((a, b) => a.min_spend - b.min_spend);
}

/**
 * Calculate member tier, multiplier, and grace period status given spent amounts
 * @param {number} spent12m - Accumulated spent within standard window (e.g. 12 months)
 * @param {number} spentGrace - Accumulated spent within grace window (e.g. 13 months)
 * @param {Array} tiers - Sorted tier definitions
 * @returns {Object} { current_tier, multiplier, is_in_grace_period, next_tier, amount_to_next_tier, progress_pct }
 */
export function calculateMemberTier(spent12m = 0, spentGrace = 0, tiers = DEFAULT_CRM_TIERS) {
    const sortedTiers = [...tiers].sort((a, b) => a.min_spend - b.min_spend);
    const numSpent12m = Math.max(0, parseFloat(spent12m) || 0);
    const numSpentGrace = Math.max(0, parseFloat(spentGrace) || numSpent12m);

    // Find highest tier matching standard 12m spend
    let matchedIndex = 0;
    let inGrace = false;

    // Check standard 12m from top down
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
        if (numSpent12m >= sortedTiers[i].min_spend) {
            matchedIndex = i;
            break;
        }
    }

    // Check if grace period qualifies for higher tier
    for (let i = sortedTiers.length - 1; i > matchedIndex; i--) {
        if (numSpentGrace >= sortedTiers[i].min_spend) {
            matchedIndex = i;
            inGrace = true;
            break;
        }
    }

    const currentTier = sortedTiers[matchedIndex] || sortedTiers[0];
    const nextTier = matchedIndex < sortedTiers.length - 1 ? sortedTiers[matchedIndex + 1] : null;

    let amountToNextTier = 0;
    let progressPct = 100;

    if (nextTier) {
        amountToNextTier = Math.max(0, nextTier.min_spend - numSpent12m);
        const currentTierBase = currentTier.min_spend;
        const targetSpan = nextTier.min_spend - currentTierBase;
        if (targetSpan > 0) {
            const earnedInSpan = Math.max(0, numSpent12m - currentTierBase);
            progressPct = Math.min(100, Math.max(0, Math.floor((earnedInSpan / targetSpan) * 100)));
        }
    }

    return {
        current_tier: currentTier.name,
        tier_obj: currentTier,
        multiplier: currentTier.multiplier,
        is_in_grace_period: inGrace,
        accumulated_spent_12m: numSpent12m,
        accumulated_spent_13m: numSpentGrace,
        next_tier: nextTier ? nextTier.name : null,
        next_tier_min_spend: nextTier ? nextTier.min_spend : null,
        amount_to_next_tier: amountToNextTier,
        progress_pct: progressPct
    };
}

/**
 * Calculate coins earned from a bill total
 * @param {number} billTotal - Net payable total or eligible bill amount
 * @param {number} multiplier - Tier multiplier (e.g. 1.0, 1.25, 1.5)
 * @param {number} baseSpendAmount - Base spend amount (default 100)
 * @returns {number} Coins earned (rounded to 2 decimal places)
 */
export function calculateCoinsEarned(billTotal, multiplier = 1.0, baseSpendAmount = 100) {
    const total = Math.max(0, parseFloat(billTotal) || 0);
    const mult = Math.max(0.1, parseFloat(multiplier) || 1.0);
    const base = Math.max(1, parseFloat(baseSpendAmount) || 100);

    // E.g. (total / 100) * 1.25
    return Math.floor((total / base) * mult * 100) / 100;
}

/**
 * Calculate coin discount with maximum percentage constraints
 * @param {number} coinsToRedeem - Coins amount requested
 * @param {number} redeemRate - Baht per coin (default 1.0)
 * @param {number} maxRedeemPercent - Maximum percentage of bill total (e.g. 100%)
 * @param {number} billSubtotal - Current bill subtotal
 * @param {number} minRedeemLimit - Minimum coins required to redeem
 * @returns {Object} { discountAmount, effectiveCoinsRedeemed, maxRedeemableCoins, error }
 */
export function calculateCoinsDiscount(coinsToRedeem, redeemRate = 1.0, maxRedeemPercent = 100, billSubtotal = 0, minRedeemLimit = 10) {
    const coins = Math.max(0, parseFloat(coinsToRedeem) || 0);
    const rate = Math.max(0.01, parseFloat(redeemRate) || 1.0);
    const maxPct = Math.min(100, Math.max(1, parseFloat(maxRedeemPercent) || 100));
    const subtotal = Math.max(0, parseFloat(billSubtotal) || 0);
    const minLimit = Math.max(0, parseFloat(minRedeemLimit) || 0);

    // Calculate maximum allowable discount in Baht
    const maxDiscountBaht = (subtotal * maxPct) / 100;
    const maxRedeemableCoins = Math.floor((maxDiscountBaht / rate) * 100) / 100;

    if (coins > 0 && coins < minLimit) {
        return {
            discountAmount: 0,
            effectiveCoinsRedeemed: 0,
            maxRedeemableCoins,
            error: `ต้องแลกขั้นต่ำอย่างน้อย ${minLimit} xhaus`
        };
    }

    const cappedCoins = Math.min(coins, maxRedeemableCoins);
    const discountAmount = Math.floor(cappedCoins * rate * 100) / 100;

    return {
        discountAmount,
        effectiveCoinsRedeemed: cappedCoins,
        maxRedeemableCoins,
        error: null
    };
}

/**
 * Visual styling theme helper for Tier cards (Dieter Rams + Thai Modern)
 * @param {string} tierName - Name of the tier
 * @param {string} badgeTheme - Theme code ('bronze' | 'silver' | 'gold' | 'emerald' | 'purple')
 * @returns {Object} Styling tokens
 */
export function getTierVisualTheme(tierName = '', badgeTheme = '') {
    const nameLower = String(tierName).toLowerCase();
    const themeLower = String(badgeTheme).toLowerCase();

    if (themeLower === 'gold' || nameLower.includes('inner') || nameLower.includes('gold') || nameLower.includes('vip')) {
        return {
            bg: 'bg-[#12141a] border-[#D4AF37] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.3)]',
            badge: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40',
            accentColor: 'text-[#D4AF37]',
            labelColor: 'text-[#D4AF37]/80',
            dotColor: 'bg-[#D4AF37]',
            glow: 'shadow-[0_0_10px_#D4AF37]',
            pillBg: 'bg-amber-500/10 text-amber-600 border-amber-500/30'
        };
    }

    if (themeLower === 'silver' || nameLower.includes('people') || nameLower.includes('silver') || nameLower.includes('regular')) {
        return {
            bg: 'bg-[#2E3138] border-[#A0AEC0] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.2)]',
            badge: 'bg-slate-700/60 text-slate-200 border-slate-500/40',
            accentColor: 'text-slate-200',
            labelColor: 'text-slate-400',
            dotColor: 'bg-[#00E5FF]',
            glow: 'shadow-[0_0_10px_#00E5FF]',
            pillBg: 'bg-slate-400/10 text-slate-700 border-slate-300/40'
        };
    }

    if (themeLower === 'emerald' || nameLower.includes('green') || nameLower.includes('club')) {
        return {
            bg: 'bg-[#18261e] border-[#34D399] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.25)]',
            badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
            accentColor: 'text-emerald-300',
            labelColor: 'text-emerald-400/80',
            dotColor: 'bg-[#34D399]',
            glow: 'shadow-[0_0_10px_#34D399]',
            pillBg: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
        };
    }

    // Default: Haus Common / Bronze / Clay
    return {
        bg: 'bg-[#F2F2EC] border-[#B8B8B2] text-[#1A1A1A] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_rgba(0,0,0,0.08)]',
        badge: 'bg-zinc-200/70 text-zinc-800 border-zinc-300',
        accentColor: 'text-[#1A1A1A]',
        labelColor: 'text-zinc-500',
        dotColor: 'bg-[#FF5500]',
        glow: 'shadow-[0_0_10px_#FF5500]',
        pillBg: 'bg-amber-700/10 text-amber-800 border-amber-700/20'
    };
}

/**
 * Calculate comparable CRM score for a member profile or booking
 * Score priority: Points Balance (คะแนนสะสมเยอะกว่า) > Tier Level (ระดับสมาชิก) > Accumulated Spend > Registered Member
 * @param {Object} memberOrBooking - Member profile object or booking object
 * @returns {number} Numeric CRM score for comparison
 */
export function calculateMemberCrmScore(memberOrBooking) {
    if (!memberOrBooking) return 0;
    
    // Extract profile object
    const profile = Array.isArray(memberOrBooking.profiles) 
        ? memberOrBooking.profiles[0] 
        : (memberOrBooking.profiles || memberOrBooking);

    const hasUserId = !!(profile?.id || memberOrBooking.user_id || profile?.user_id);
    if (!hasUserId) {
        // Not a registered member / Walk-in guest
        return 0;
    }

    const points = Math.max(0, parseFloat(profile.xhaus_coins || profile.points || profile.coins || memberOrBooking.xhaus_coins || 0) || 0);
    const spent = Math.max(0, parseFloat(profile.total_spent_12m || profile.total_spent || profile.total_spent_all_time || 0) || 0);
    const tier = String(profile.current_tier || profile.tier || memberOrBooking.current_tier || '').toLowerCase();

    let tierWeight = 1000; // Base registered member
    if (tier.includes('inner') || tier.includes('gold') || tier.includes('03')) {
        tierWeight = 5000;
    } else if (tier.includes('people') || tier.includes('silver') || tier.includes('02')) {
        tierWeight = 3000;
    } else if (tier.includes('common') || tier.includes('bronze') || tier.includes('01')) {
        tierWeight = 1500;
    }

    // Points have primary priority, multiplied by 100,000 to ensure higher points always win
    // Tier weight gives a secondary tie-breaker
    // Total spent gives third tie-breaker
    return (points * 100000) + (tierWeight * 10) + spent;
}

/**
 * Resolves which CRM member should be attached to the target merged booking.
 * Strictly selects the member with higher points / CRM score ("เลือกคนที่คะแนนเยอะกว่าเสมอ").
 * @param {Object} sourceBooking - Source booking being merged
 * @param {Object} targetBooking - Target booking receiving the merge
 * @param {Object} attachedSourceMember - Optional attached member for source
 * @param {Object} attachedTargetMember - Optional attached member for target
 * @returns {Object} { dominantMember, dominantBooking, wasSourceChosen, reason }
 */
export function resolveDominantCrmMember(sourceBooking, targetBooking, attachedSourceMember = null, attachedTargetMember = null) {
    const sourceProfile = attachedSourceMember || (Array.isArray(sourceBooking?.profiles) ? sourceBooking.profiles[0] : sourceBooking?.profiles) || (sourceBooking?.user_id ? { id: sourceBooking.user_id, display_name: sourceBooking.customer_name || sourceBooking.pickup_contact_name || 'Member' } : null);
    const targetProfile = attachedTargetMember || (Array.isArray(targetBooking?.profiles) ? targetBooking.profiles[0] : targetBooking?.profiles) || (targetBooking?.user_id ? { id: targetBooking.user_id, display_name: targetBooking.customer_name || targetBooking.pickup_contact_name || 'Member' } : null);

    const sourceScore = calculateMemberCrmScore(sourceProfile || sourceBooking);
    const targetScore = calculateMemberCrmScore(targetProfile || targetBooking);

    if (sourceScore > targetScore && sourceProfile) {
        return {
            dominantMember: sourceProfile,
            dominantBooking: sourceBooking,
            wasSourceChosen: true,
            sourceScore,
            targetScore,
            reason: `เลือกสมาชิก ${sourceProfile.display_name || 'บิลต้นทาง'} เนื่องจากมีคะแนนสะสม/ระดับ CRM สูงกว่า (คะแนน: ${sourceProfile.xhaus_coins || sourceProfile.points || 0} pts)`
        };
    }

    return {
        dominantMember: targetProfile || null,
        dominantBooking: targetBooking,
        wasSourceChosen: false,
        sourceScore,
        targetScore,
        reason: targetProfile 
            ? `คงสมาชิก ${targetProfile.display_name || 'บิลปลายทาง'} (คะแนน: ${targetProfile.xhaus_coins || targetProfile.points || 0} pts)`
            : 'ไม่มีสมาชิกที่เป็น Member ทั้งสองโต๊ะ'
    };
}

