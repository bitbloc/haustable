import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * usePromotion Hook
 * Manages the state and logic for applying discount codes.
 */
export function usePromotion() {
    const [promoCode, setPromoCode] = useState('')
    const [appliedPromo, setAppliedPromo] = useState(null) // { code, amount, id }
    const [promoError, setPromoError] = useState(null)
    const [isValidating, setIsValidating] = useState(false)

    /**
     * Check and Apply Code
     * @param {string} codeToCheck - The code input by user
     * @param {number} subtotal - Current cart total
     * @param {string} serviceType - 'booking' or 'ordering'
     */
    const applyCode = useCallback(async (codeToCheck, subtotal, serviceType) => {
        if (!codeToCheck) return

        setIsValidating(true)
        setPromoError(null)

        try {
            const { data, error } = await supabase.rpc('check_promotion', {
                code_text: codeToCheck,
                subtotal: subtotal,
                service_type: serviceType
            })

            if (error) throw error

            if (data.valid) {
                setAppliedPromo({
                    id: data.promo_id,
                    code: data.code,
                    discountAmount: data.discount_amount,
                    discountType: data.discount_type, // NEW
                    discountValue: data.discount_value // NEW
                })
                setPromoCode(data.code) // Ensure casing matches DB
                setPromoError(null)
                return { success: true, discount: data.discount_amount }
            } else {
                setAppliedPromo(null)
                setPromoError(data.reason) // e.g., "Code expired", "Min spend not met"
                return { success: false, reason: data.reason }
            }
        } catch (err) {
            console.error('Promotion Check Error:', err)
            setPromoError('Failed to check promotion')
            setAppliedPromo(null)
            return { success: false, reason: 'Network error' }
        } finally {
            setIsValidating(false)
        }
    }, [])

    /**
     * Re-validate currently applied code (e.g. when cart changes)
     * Automatically removes code if conditions (like min spend) are no longer met.
     */
    const revalidatePromo = useCallback(async (currentSubtotal, serviceType) => {
        if (!appliedPromo) return

        // If subtotal is 0, just remove it immediately to save an API call?
        // Actually, RP check is cheap. Let's consistency check.
        
        try {
            const { data, error } = await supabase.rpc('check_promotion', {
                code_text: appliedPromo.code,
                subtotal: currentSubtotal,
                service_type: serviceType
            })

            if (error || !data.valid) {
                 // Auto-remove
                 setAppliedPromo(null)
                 setPromoError(data?.reason || "Promotion no longer valid")
            } else {
                // Update discount amount (it might be % based and changed with subtotal)
                setAppliedPromo(prev => ({
                    ...prev,
                    discountAmount: data.discount_amount,
                    // Also update these in case logic changed valid status or others
                    discountType: data.discount_type, 
                    discountValue: data.discount_value
                }))
            }
        } catch (err) {
            // If network fails, better to remove for safety? Or keep?
            // Safer to remove to prevent giving invalid discount.
            setAppliedPromo(null)
        }
    }, [appliedPromo])

    const removePromo = () => {
        setAppliedPromo(null)
        setPromoCode('')
        setPromoError(null)
    }

    return {
        promoCode,
        setPromoCode, // For input binding
        appliedPromo,
        promoError,
        isValidating,
        applyCode,
        removePromo,
        revalidatePromo
    }
}
