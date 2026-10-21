-- Migration: Fix tables_layout.status in purge_system_data and add shift_number to pos_shifts
-- Description:
-- 1. Adds shift_number column to public.pos_shifts table to support shift ordering and prevent 42703 column missing errors.
-- 2. Updates purge_system_data RPC to eliminate non-existent tables_layout.status column references.

-- 1. Add shift_number column to pos_shifts if missing
ALTER TABLE public.pos_shifts 
ADD COLUMN IF NOT EXISTS shift_number INTEGER DEFAULT 1;

-- 2. Update purge_system_data RPC function
CREATE OR REPLACE FUNCTION public.purge_system_data(
    p_category TEXT,
    p_passcode TEXT,
    p_reset_stock_qty BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_valid_passcode CONSTANT TEXT := '1500323553';
    v_deleted_info JSONB := '{}'::JSONB;
BEGIN
    -- Strict Passcode Verification
    IF p_passcode IS NULL OR TRIM(p_passcode) <> v_valid_passcode THEN
        RAISE EXCEPTION 'รหัสความปลอดภัยไม่ถูกต้อง (Invalid Passcode). การดำเนินการถูกระงับเพื่อความปลอดภัย';
    END IF;

    -- ========================================================================
    -- CATEGORY 1: Orders & Billing Data ('orders')
    -- ========================================================================
    IF p_category = 'orders' OR p_category = 'all_operational' THEN
        -- Delete child order items first
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
            DELETE FROM public.order_items;
        END IF;

        -- Delete invoices & tax records linked to bookings
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_invoices') THEN
            DELETE FROM public.tax_invoices;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'withholding_tax_records') THEN
            DELETE FROM public.withholding_tax_records;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_slips_registry') THEN
            DELETE FROM public.payment_slips_registry;
        END IF;

        -- Delete main bookings (occupancy in tables_layout is dynamic based on bookings, so deleting bookings clears occupancy)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
            DELETE FROM public.bookings;
        END IF;

        v_deleted_info := jsonb_set(v_deleted_info, '{orders_purged}', 'true'::JSONB);
    END IF;

    -- ========================================================================
    -- CATEGORY 2: POS Shifts & Cashier Logs ('shifts')
    -- ========================================================================
    IF p_category = 'shifts' OR p_category = 'all_operational' THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_audit_logs') THEN
            DELETE FROM public.pos_audit_logs;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_shifts') THEN
            DELETE FROM public.pos_shifts;
        END IF;

        v_deleted_info := jsonb_set(v_deleted_info, '{shifts_purged}', 'true'::JSONB);
    END IF;

    -- ========================================================================
    -- CATEGORY 3: Stock Movement & Transactions ('stock')
    -- ========================================================================
    IF p_category = 'stock' OR p_category = 'all_operational' THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_transactions') THEN
            DELETE FROM public.stock_transactions;
        END IF;

        -- Optional: Reset current stock levels to 0 for physical inventory counting
        IF p_reset_stock_qty IS TRUE THEN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_items') THEN
                UPDATE public.stock_items SET current_quantity = 0;
            END IF;
            v_deleted_info := jsonb_set(v_deleted_info, '{stock_quantities_zeroed}', 'true'::JSONB);
        END IF;

        v_deleted_info := jsonb_set(v_deleted_info, '{stock_transactions_purged}', 'true'::JSONB);
    END IF;

    -- ========================================================================
    -- CATEGORY 4: Tax Invoices & Store Expenses ('tax_expenses')
    -- ========================================================================
    IF p_category = 'tax_expenses' OR p_category = 'all_operational' THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_invoices') THEN
            DELETE FROM public.tax_invoices;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'withholding_tax_records') THEN
            DELETE FROM public.withholding_tax_records;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_expenses') THEN
            DELETE FROM public.store_expenses;
        END IF;

        v_deleted_info := jsonb_set(v_deleted_info, '{tax_and_expenses_purged}', 'true'::JSONB);
    END IF;

    -- ========================================================================
    -- CATEGORY 5: Entertainment & Activity Logs ('activities')
    -- ========================================================================
    IF p_category = 'activities' OR p_category = 'all_operational' THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'song_requests') THEN
            DELETE FROM public.song_requests;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard') THEN
            DELETE FROM public.leaderboard;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'arcade_rewards_log') THEN
            DELETE FROM public.arcade_rewards_log;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'haus_checkins') THEN
            DELETE FROM public.haus_checkins;
        END IF;

        v_deleted_info := jsonb_set(v_deleted_info, '{activities_purged}', 'true'::JSONB);
    END IF;

    -- ========================================================================
    -- CATEGORY 6: CRM Points & Drink Stamps Reset ('crm_balances')
    -- ========================================================================
    IF p_category = 'crm_balances' THEN
        UPDATE public.profiles
        SET 
            xhaus_coin_balance = 10.00,
            drink_stamps_count = 0,
            free_drinks_earned = 0
        WHERE role = 'customer' OR role IS NULL;

        v_deleted_info := jsonb_set(v_deleted_info, '{crm_balances_reset}', 'true'::JSONB);
    END IF;

    -- Record timestamp
    v_deleted_info := jsonb_set(v_deleted_info, '{timestamp}', to_jsonb(NOW()));
    v_deleted_info := jsonb_set(v_deleted_info, '{category}', to_jsonb(p_category));

    RETURN v_deleted_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.purge_system_data(TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_system_data(TEXT, TEXT, BOOLEAN) TO service_role;
