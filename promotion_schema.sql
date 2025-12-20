-- 1. Create Promotion Codes Table
CREATE TABLE IF NOT EXISTS public.promotion_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    applicable_to TEXT NOT NULL CHECK (applicable_to IN ('booking', 'ordering', 'both')),
    min_spend NUMERIC NOT NULL DEFAULT 0 CHECK (min_spend >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_limit INT, -- NULL means unlimited
    used_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by code
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_codes_code_upper ON public.promotion_codes (upper(code));

-- 2. Modify Bookings Table (supports both Booking & Pickup)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS promotion_code_id UUID REFERENCES public.promotion_codes(id),
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- 3. RPC Function: check_promotion (Read-Only)
-- Input: code (string), subtotal (numeric), service_type (string: 'booking' | 'ordering')
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
    error_reason TEXT;
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

    -- 6. Calculate Discount
    IF promo.discount_type = 'percent' THEN
        calculated_discount := (subtotal * promo.discount_value) / 100;
        -- Optional: Cap max discount if we had a column for it. For now, unlimited % discount.
    ELSE
        calculated_discount := promo.discount_value;
    END IF;

    -- Ensure discount doesn't exceed subtotal
    IF calculated_discount > subtotal THEN
        calculated_discount := subtotal;
    END IF;

    RETURN json_build_object(
        'valid', true, 
        'discount_amount', calculated_discount,
        'promo_id', promo.id,
        'code', promo.code -- Return correct casing from DB
    );
END;
$$;

-- 4. Trigger Function: handle_promotion_usage (Write/Lock)
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
        
        -- A. LOCK the row to prevent race conditions
        SELECT * INTO promo 
        FROM public.promotion_codes 
        WHERE id = NEW.promotion_code_id 
        FOR UPDATE; -- Critical: Locks this row until transaction commits/rolls back

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

        IF NEW.total_amount < promo.min_spend THEN -- Note: total_amount should probably be the pre-discount amount? 
            -- Assumption: Frontend sends `total_amount` as the FINAL amount.
            -- Wait, if `total_amount` is final, we can't easily check min_spend based on Pre-Discount.
            -- Let's assume the schema is: total_amount = (Items Total) - discount_amount.
            -- So Pre-Discount Total = NEW.total_amount + NEW.discount_amount
            IF (NEW.total_amount + NEW.discount_amount) < promo.min_spend THEN
                RAISE EXCEPTION 'Minimum spend not met';
            END IF;
        ELSE
             -- If we assume total_amount IS the final amount, this logic holds.
             -- But for safety, let's explicitely check against (Total + Discount)
             IF (NEW.total_amount + NEW.discount_amount) < promo.min_spend THEN
                 RAISE EXCEPTION 'Minimum spend not met';
             END IF;
        END IF;

        IF promo.usage_limit IS NOT NULL AND promo.used_count >= promo.usage_limit THEN
            RAISE EXCEPTION 'Promotion fully redeemed';
        END IF;

        -- C. Security Check: Validate Discount Amount
        -- We recalculate what the discount SHOULD be.
        DECLARE 
            base_amount NUMERIC := NEW.total_amount + NEW.discount_amount;
        BEGIN
            IF promo.discount_type = 'percent' THEN
                calculated_discount := (base_amount * promo.discount_value) / 100;
            ELSE
                calculated_discount := promo.discount_value;
            END IF;

            -- Rounding tolerance (e.g. 0.01 or 1.00 depending on currency)
            -- Let's allow 1.0 difference for float issues, or exact? 
            -- Better to be strict but allow slight floor/ceil delta.
            -- Actually, let's just use the logic: Client sent discount MUST BE <= Calculated (plus epsilon)
            -- AND Client sent discount MUST BE > 0
            
            IF NEW.discount_amount > (calculated_discount + 0.5) THEN
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

-- 5. Attach Trigger
DROP TRIGGER IF EXISTS trigger_apply_promotion ON public.bookings;

CREATE TRIGGER trigger_apply_promotion
    BEFORE INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_promotion_usage();
