import { describe, it, expect } from 'vitest'

describe('Online Booking & Pickup CRM Privileges (xhaus & Free Drinks)', () => {
    // 1. Drink stamp eligibility checker logic
    const isItemDrinkStampEligible = (item, eligibleCategoryIds = new Set()) => {
        if (!item || item.is_reward) return false
        if (item.is_drink_stamp_eligible === true) return true
        if (item.menu_items?.is_drink_stamp_eligible === true) return true
        if (item.menu_categories?.is_drink_stamp_eligible === true) return true
        if (item.category_id && eligibleCategoryIds.has(item.category_id)) return true
        const catName = String(item.category || item.menu_categories?.name || '').toLowerCase()
        const name = String(item.name || '').toLowerCase()
        const beverageKeywords = ['coffee', 'tea', 'drink', 'beverage', 'soda', 'matcha', 'cocoa', 'latte', 'espresso', 'americano', 'cappuccino', 'mocha', 'dirty', 'brew', 'smoothie', 'frappe', 'juice', 'milk', 'lemonade', 'water', 'กาแฟ', 'ชา', 'มัทฉะ', 'น้ำ']
        return beverageKeywords.some(k => catName.includes(k) || name.includes(k))
    }

    // 2. Free drink quota calculation
    const calculateAvailableFreeDrinks = (memberProfile) => {
        if (!memberProfile) return 0
        const quota = parseInt(memberProfile.free_drink_quota || 0, 10)
        const stamps = parseInt(memberProfile.drink_stamp_count || 0, 10)
        return Math.max(0, quota + Math.floor(stamps / 10))
    }

    // 3. Free drink discount calculation
    const calculateFreeDrinkDiscount = ({ useFreeDrinkQuota, availableFreeDrinks, cart, eligibleCategoryIds }) => {
        if (!useFreeDrinkQuota || availableFreeDrinks <= 0) return 0
        const eligibleDrinks = cart.filter(item => isItemDrinkStampEligible(item, eligibleCategoryIds))
        if (eligibleDrinks.length === 0) return 0
        const prices = eligibleDrinks.map(i => parseFloat(i.totalPricePerUnit || i.price) || 0)
        return Math.min(...prices)
    }

    // 4. xhaus discount calculation
    const calculateXhausDiscount = ({
        xhausToRedeem,
        memberProfile,
        cartTotal,
        promoDiscount = 0,
        freeDrinkDiscount = 0,
        crmSettings = {
            crm_redeem_rate_xhaus: '1.00',
            crm_min_redeem_xhaus: '10',
            crm_max_redeem_percent: '50'
        }
    }) => {
        const netBeforeXhaus = Math.max(0, cartTotal - promoDiscount - freeDrinkDiscount)
        const memberCoinsBalance = Math.max(0, parseFloat(memberProfile?.xhaus_balance || 0))
        const redeemRate = parseFloat(crmSettings.crm_redeem_rate_xhaus) || 1.0
        const maxRedeemPercent = parseFloat(crmSettings.crm_max_redeem_percent) || 100.0
        const minRedeem = parseFloat(crmSettings.crm_min_redeem_xhaus) || 10.0

        const maxAllowedDiscountBaht = (netBeforeXhaus * maxRedeemPercent) / 100
        const maxCoinsAllowed = Math.min(memberCoinsBalance, Math.floor((maxAllowedDiscountBaht / redeemRate) * 100) / 100)

        if (xhausToRedeem < minRedeem || xhausToRedeem <= 0 || !memberProfile) {
            return {
                effectiveDiscount: 0,
                maxAllowedDiscountBaht,
                maxCoinsAllowed,
                finalTotal: netBeforeXhaus
            }
        }

        const validCoins = Math.min(xhausToRedeem, maxCoinsAllowed)
        const effectiveDiscount = Math.min(validCoins * redeemRate, maxAllowedDiscountBaht, netBeforeXhaus)
        const finalTotal = Math.max(0, netBeforeXhaus - effectiveDiscount)

        return {
            effectiveDiscount,
            maxAllowedDiscountBaht,
            maxCoinsAllowed,
            finalTotal
        }
    }

    it('identifies drink stamp eligible items by category flag, item flag, or beverage keywords', () => {
        const eligibleCats = new Set(['cat-drinks-id'])

        expect(isItemDrinkStampEligible({ name: 'Iced Americano', price: 85 })).toBe(true)
        expect(isItemDrinkStampEligible({ name: 'ชาไทยเย็น (Thai Milk Tea)', price: 75 })).toBe(true)
        expect(isItemDrinkStampEligible({ name: 'Special Blend', category: 'Coffee' })).toBe(true)
        expect(isItemDrinkStampEligible({ name: 'House Soda', category_id: 'cat-drinks-id' }, eligibleCats)).toBe(true)
        expect(isItemDrinkStampEligible({ name: 'คั่วกลิ้งผักแนม', price: 180 })).toBe(false)
        expect(isItemDrinkStampEligible({ name: 'Matcha Latte', is_reward: true })).toBe(false)
    })

    it('calculates available free drinks from accumulated stamps (10 stamps = 1 free drink) plus quota', () => {
        // Customer with 4 stamps, 0 quota
        expect(calculateAvailableFreeDrinks({ drink_stamp_count: 4, free_drink_quota: 0 })).toBe(0)

        // Customer with 10 stamps, 0 quota
        expect(calculateAvailableFreeDrinks({ drink_stamp_count: 10, free_drink_quota: 0 })).toBe(1)

        // Customer with 24 stamps, 1 quota -> 1 + 2 = 3
        expect(calculateAvailableFreeDrinks({ drink_stamp_count: 24, free_drink_quota: 1 })).toBe(3)
    })

    it('calculates free drink discount by deducting the lowest-priced eligible beverage in the order', () => {
        const cart = [
            { name: 'ข้าวคั่วกลิ้ง', price: 120, qty: 1 },
            { name: 'Iced Americano', price: 85, qty: 1 },
            { name: 'Matcha Latte', price: 95, qty: 1 }
        ]

        const discount = calculateFreeDrinkDiscount({
            useFreeDrinkQuota: true,
            availableFreeDrinks: 1,
            cart
        })

        // Americano is 85, Matcha is 95 -> discount is 85
        expect(discount).toBe(85)
    })

    it('enforces min redeem, max percent of bill, and member coin balance for xhaus redemption', () => {
        const memberProfile = {
            id: 'user-123',
            xhaus_balance: 50
        }

        const crmSettings = {
            crm_redeem_rate_xhaus: '1.00',
            crm_min_redeem_xhaus: '10',
            crm_max_redeem_percent: '50'
        }

        // Bill = 600, Max 50% = 300 Baht. Member has 50 coins.
        // Trying to redeem 5 coins -> below min redeem 10 -> 0
        const resultA = calculateXhausDiscount({
            xhausToRedeem: 5,
            memberProfile,
            cartTotal: 600,
            crmSettings
        })
        expect(resultA.effectiveDiscount).toBe(0)

        // Trying to redeem 34 coins (which is >= 10 and <= 50)
        const resultB = calculateXhausDiscount({
            xhausToRedeem: 34,
            memberProfile,
            cartTotal: 600,
            crmSettings
        })
        expect(resultB.effectiveDiscount).toBe(34)
        expect(resultB.finalTotal).toBe(566)

        // Small Bill = 40 Baht. 50% max discount = 20 Baht.
        // Even if member has 50 coins and enters 30 coins, max coins allowed is 20
        const resultC = calculateXhausDiscount({
            xhausToRedeem: 30,
            memberProfile,
            cartTotal: 40,
            crmSettings
        })
        expect(resultC.effectiveDiscount).toBe(20)
        expect(resultC.finalTotal).toBe(20)
    })

    it('combines promo code, free drink, and xhaus discounts sequentially', () => {
        const memberProfile = {
            id: 'user-123',
            xhaus_balance: 100,
            drink_stamp_count: 10,
            free_drink_quota: 0
        }

        const cart = [
            { name: 'Set Size XL', price: 899, qty: 1 },
            { name: 'Iced Latte', price: 90, qty: 1 }
        ]
        const cartTotal = 899 + 90 // 989

        const promoDiscount = 50 // e.g. 50 baht voucher
        const freeDrinkDiscount = calculateFreeDrinkDiscount({
            useFreeDrinkQuota: true,
            availableFreeDrinks: 1,
            cart
        }) // 90 baht (Iced Latte)

        expect(freeDrinkDiscount).toBe(90)

        // Net before xhaus: 989 - 50 - 90 = 849
        // Max 50% of 849 = 424.5 Baht
        // Member redeems 40 coins -> 40 baht
        const xhausResult = calculateXhausDiscount({
            xhausToRedeem: 40,
            memberProfile,
            cartTotal,
            promoDiscount,
            freeDrinkDiscount
        })

        expect(xhausResult.effectiveDiscount).toBe(40)
        expect(xhausResult.finalTotal).toBe(809)

        // Booking 50% deposit based on final total
        const depositAmount = Math.ceil(xhausResult.finalTotal * 0.5)
        expect(depositAmount).toBe(405)
    })

    it('safely prepares payload for DB insert by stripping non-column use_free_drink_quota', () => {
        const rawPayload = {
            booking_type: 'pickup',
            customer_name: 'banff line',
            total_amount: 566,
            xhaus_redeemed: 34,
            xhaus_discount: 34,
            use_free_drink_quota: true
        }

        const { use_free_drink_quota, ...safePayload } = rawPayload
        expect(safePayload).not.toHaveProperty('use_free_drink_quota')
        expect(safePayload.xhaus_redeemed).toBe(34)
        expect(safePayload.xhaus_discount).toBe(34)
        expect(use_free_drink_quota).toBe(true)
    })
})
