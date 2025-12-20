-- 3. RPC Function: check_promotion (Read-Only) - UPDATED
CREATE OR REPLACE FUNCTION public.check_promotion(
    code_text TEXT, 
    subtotal NUMERIC, 
    service_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    promo RECORD;
    calculated_discount NUMERIC;
BEGIN
    -- 1. Find Code (Case Insensitive)
    SELECT * INTO promo 
    FROM public.promotion_codes 
    WHERE upper(code) = upper(code_text)
    AND is_active = true;

    IF NOT FOUND THEN
        RETURN json_build_object('valid', false, 'reason', 'Code not found or inactive');
    END IF;

    -- 2. Check Date
    IF now() < promo.start_date OR now() > promo.end_date THEN
        RETURN json_build_object('valid', false, 'reason', 'Code expired or not started yet');
    END IF;

    -- 3. Check Service Type
    IF promo.applicable_to <> 'both' AND promo.applicable_to <> service_type THEN
        RETURN json_build_object('valid', false, 'reason', 'Code not applicable for this service');
    END IF;

    -- 4. Check Min Spend
    IF subtotal < promo.min_spend THEN
        RETURN json_build_object('valid', false, 'reason', format('Minimum spend of %s required', promo.min_spend));
    END IF;

    -- 5. Check Usage Limit (Soft Check)
    IF promo.usage_limit IS NOT NULL AND promo.used_count >= promo.usage_limit THEN
        RETURN json_build_object('valid', false, 'reason', 'Code fully redeemed');
    END IF;

    -- 6. Calculate Discount (ROUND UP / CEIL)
    IF promo.discount_type = 'percent' THEN
        calculated_discount := CEIL((subtotal * promo.discount_value) / 100.0);
    ELSE
        calculated_discount := CEIL(promo.discount_value);
    END IF;

    -- Ensure discount doesn't exceed subtotal
    IF calculated_discount > subtotal THEN
        calculated_discount := subtotal;
    END IF;

    RETURN json_build_object(
        'valid', true, 
        'discount_amount', calculated_discount,
        'promo_id', promo.id,
        'code', promo.code,
        'discount_type', promo.discount_type, -- NEW
        'discount_value', promo.discount_value -- NEW
    );
END;
$$;

-- 4. Trigger Function: handle_promotion_usage (Write/Lock) - UPDATED
CREATE OR REPLACE FUNCTION public.handle_promotion_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    promo RECORD;
    calculated_discount NUMERIC;
BEGIN
    -- Only run if a promotion code is applied
    IF NEW.promotion_code_id IS NOT NULL THEN
        
        -- A. LOCK the row
        SELECT * INTO promo 
        FROM public.promotion_codes 
        WHERE id = NEW.promotion_code_id 
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Promotion code not found';
        END IF;

        IF NOT promo.is_active THEN
            RAISE EXCEPTION 'Promotion code is inactive';
        END IF;

        -- B. Re-Validate Conditions
        IF now() < promo.start_date OR now() > promo.end_date THEN
            RAISE EXCEPTION 'Promotion code expired';
        END IF;

        -- Logic: NEW.total_amount comes in as the FINAL amount (Subtotal - Discount)
        -- So Base Price = NEW.total_amount + NEW.discount_amount
        IF (NEW.total_amount + NEW.discount_amount) < promo.min_spend THEN
            RAISE EXCEPTION 'Minimum spend not met';
        END IF;

        IF promo.usage_limit IS NOT NULL AND promo.used_count >= promo.usage_limit THEN
            RAISE EXCEPTION 'Promotion fully redeemed';
        END IF;

        -- C. Security Check: Validate Discount Amount
        DECLARE 
            base_amount NUMERIC := NEW.total_amount + NEW.discount_amount;
        BEGIN
            IF promo.discount_type = 'percent' THEN
                calculated_discount := CEIL((base_amount * promo.discount_value) / 100.0);
            ELSE
                calculated_discount := CEIL(promo.discount_value);
            END IF;

            -- Security Tolerance: Direct Match (Allow small float drift if necessary, but integers should be exact)
            -- Logic: The discount claimed (NEW.discount_amount) must NOT be greater than calculated.
            -- (Less is fine? No, usually exact. But mainly we prevent over-discounting).
            
            IF NEW.discount_amount > calculated_discount THEN
                 RAISE EXCEPTION 'Invalid discount amount. Expected max: %, Got: %', calculated_discount, NEW.discount_amount;
            END IF;
        END;

        -- D. Increment Usage
        UPDATE public.promotion_codes 
        SET used_count = used_count + 1 
        WHERE id = promo.id;

    END IF;

    RETURN NEW;
END;
$$;
