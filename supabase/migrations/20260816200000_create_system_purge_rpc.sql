-- Migration: Create System Test Data Purge RPC with Security Passcode Verification
-- Date: 2026-08-16
-- Passcode Required: 1500323553

-- ============================================================================
-- 1. FUNCTION: Get Live Record Counts for System Data Purge Panel
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_system_record_counts()
RETURNS JSONB AS $$
DECLARE
    v_counts JSONB;
    v_orders_cnt INT := 0;
    v_order_items_cnt INT := 0;
    v_shifts_cnt INT := 0;
    v_stock_tx_cnt INT := 0;
    v_tax_invoices_cnt INT := 0;
    v_wht_cnt INT := 0;
    v_expenses_cnt INT := 0;
    v_audit_logs_cnt INT := 0;
    v_slips_cnt INT := 0;
    v_song_requests_cnt INT := 0;
    v_arcade_logs_cnt INT := 0;
    v_leaderboard_cnt INT := 0;
    v_checkins_cnt INT := 0;
    v_profiles_cnt INT := 0;
    v_menu_items_cnt INT := 0;
    v_stock_items_cnt INT := 0;
BEGIN
    -- Operational Counts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
        SELECT COUNT(*) INTO v_orders_cnt FROM public.bookings;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        SELECT COUNT(*) INTO v_order_items_cnt FROM public.order_items;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_shifts') THEN
        SELECT COUNT(*) INTO v_shifts_cnt FROM public.pos_shifts;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_transactions') THEN
        SELECT COUNT(*) INTO v_stock_tx_cnt FROM public.stock_transactions;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_invoices') THEN
        SELECT COUNT(*) INTO v_tax_invoices_cnt FROM public.tax_invoices;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'withholding_tax_records') THEN
        SELECT COUNT(*) INTO v_wht_cnt FROM public.withholding_tax_records;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_expenses') THEN
        SELECT COUNT(*) INTO v_expenses_cnt FROM public.store_expenses;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_audit_logs') THEN
        SELECT COUNT(*) INTO v_audit_logs_cnt FROM public.pos_audit_logs;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_slips_registry') THEN
        SELECT COUNT(*) INTO v_slips_cnt FROM public.payment_slips_registry;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'song_requests') THEN
        SELECT COUNT(*) INTO v_song_requests_cnt FROM public.song_requests;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'arcade_rewards_log') THEN
        SELECT COUNT(*) INTO v_arcade_logs_cnt FROM public.arcade_rewards_log;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leaderboard') THEN
        SELECT COUNT(*) INTO v_leaderboard_cnt FROM public.leaderboard;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'haus_checkins') THEN
        SELECT COUNT(*) INTO v_checkins_cnt FROM public.haus_checkins;
    END IF;

    -- Master / Protected Counts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        SELECT COUNT(*) INTO v_profiles_cnt FROM public.profiles;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_items') THEN
        SELECT COUNT(*) INTO v_menu_items_cnt FROM public.menu_items;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_items') THEN
        SELECT COUNT(*) INTO v_stock_items_cnt FROM public.stock_items;
    END IF;

    v_counts := jsonb_build_object(
        'orders', v_orders_cnt,
        'order_items', v_order_items_cnt,
        'shifts', v_shifts_cnt,
        'stock_transactions', v_stock_tx_cnt,
        'tax_invoices', v_tax_invoices_cnt,
        'withholding_tax', v_wht_cnt,
        'store_expenses', v_expenses_cnt,
        'audit_logs', v_audit_logs_cnt,
        'payment_slips', v_slips_cnt,
        'song_requests', v_song_requests_cnt,
        'arcade_logs', v_arcade_logs_cnt,
        'leaderboard', v_leaderboard_cnt,
        'checkins', v_checkins_cnt,
        'protected_profiles', v_profiles_cnt,
        'protected_menu_items', v_menu_items_cnt,
        'protected_stock_items', v_stock_items_cnt
    );

    RETURN v_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 2. FUNCTION: Purge System Test Data by Category with Passcode '1500323553'
-- ============================================================================
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

        -- Delete main bookings
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
            DELETE FROM public.bookings;
        END IF;

        -- Reset table occupancy
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tables_layout') THEN
            UPDATE public.tables_layout
            SET status = 'available'
            WHERE status <> 'available';
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
    -- CATEGORY 6: Reset Member CRM Points/Stamps ONLY (Customer Profiles Preserved 100%) ('crm_balances')
    -- ========================================================================
    IF p_category = 'crm_balances' THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
            -- Reset points and stamps back to default welcome bonus, keep name/phone/line_id intact
            UPDATE public.profiles
            SET xhaus_balance = 10.00,
                total_earned_xhaus = 10.00,
                total_redeemed_xhaus = 0.00,
                drink_stamp_count = 0,
                free_drink_quota = 0,
                total_drinks_purchased = 0,
                current_tier = 'Haus Common';
        END IF;

        v_deleted_info := jsonb_set(v_deleted_info, '{crm_balances_reset}', 'true'::JSONB);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'category', p_category,
        'details', v_deleted_info,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions to authenticated & service_role
GRANT EXECUTE ON FUNCTION public.get_system_record_counts() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.purge_system_data(TEXT, TEXT, BOOLEAN) TO authenticated, service_role, anon;
