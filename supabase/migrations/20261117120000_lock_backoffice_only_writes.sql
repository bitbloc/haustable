-- ==============================================================================
-- Phase A2 — close the writes no public screen needs
-- Design: docs/security-hardening-plan.md section 3. Inventory: docs/security-audit.md.
--
-- NOT APPLIED to production. Verified on a local copy of the production schema with
-- scripts/verify-rls.mjs. Apply after closing time, one file, e.g.
--   npx supabase db query --remote -f supabase/migrations/20261117120000_lock_backoffice_only_writes.sql
-- Never `supabase db push` (remote migration history is untracked).
-- Rollback: supabase/security_hardening/06_lock_backoffice_only_writes_ROLLBACK.sql
--
-- What changes (anon = the POS, the QR page and anyone holding the public key)
--   promotion_codes        writes: anyone -> signed-in back-office staff. Reads unchanged.
--   store_exceptions       writes: anyone -> signed-in back-office staff. Reads unchanged.
--   stock_items            read + write: anyone -> signed-in back-office staff.
--   recipe_ingredients     read + write: anyone -> signed-in back-office staff.
--   save_menu_recipe()     EXECUTE: anon and PUBLIC removed (it bypassed the line above).
--   bookings               DELETE: anyone -> signed-in back-office staff. Insert/update/read unchanged.
--   pos_shifts             DELETE: anyone -> signed-in back-office staff. Insert/update/read unchanged.
--   tax_customer_profiles  DELETE: anyone -> signed-in back-office staff. Read/insert/update unchanged.
--   app_settings           staff_pin_code joins the admin-only secret keys.
--
-- Checks made before each table (2026-11-17, code on branch security/hardening-phase-a and
-- the live catalog read with --read-only):
--   (a) No anon screen reads or writes the locked part. stock_items / recipe_ingredients are
--       used only under /admin and /staff/* (StaffAuthLayout requires the same roles as
--       is_backoffice_staff()), including the embedded selects in StaffDashboard,
--       StockPage, auditLogger (admin logs page), OptionGroupList, useBarSOP (/staff/sop,
--       /admin/sop). promotion_codes is written only by PromoVoucherManager; the POS and the
--       tracking page only read it. store_exceptions has no reader or writer in src/, api/
--       or supabase/functions. The only deletes of bookings / pos_shifts /
--       tax_customer_profiles are AdminBookings, AdminTestSandboxModal, DataPurgePanel and
--       TaxSettingsTab (all /admin). The POS voids by updating status, opens/closes shifts
--       with insert/update/upsert, and upserts tax customers with insert/update.
--   (b) The SECURITY INVOKER triggers that run during anon writes on bookings
--       (set_bookings_updated_at, generate_booking_tracking_info,
--       sync_booking_contact_columns) only touch NEW. Every trigger on order_items is
--       SECURITY DEFINER. Usage counting of promotion codes is handle_promotion_usage
--       (SECURITY DEFINER); sales stock deduction runs in SECURITY DEFINER functions.
--   (c) stock-api, telegram-report, line-webhook, get-tracking-info create their client
--       with SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- promotion_codes: public read stays (promotion_codes_read); writes back office only
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "promotion_codes_write" ON public.promotion_codes;
CREATE POLICY "promotion_codes_backoffice_write" ON public.promotion_codes
    FOR ALL TO authenticated
    USING (public.is_backoffice_staff())
    WITH CHECK (public.is_backoffice_staff());

-- ------------------------------------------------------------------------------
-- store_exceptions: public read stays (store_exceptions_read); writes back office only
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "store_exceptions_write" ON public.store_exceptions;
CREATE POLICY "store_exceptions_backoffice_write" ON public.store_exceptions
    FOR ALL TO authenticated
    USING (public.is_backoffice_staff())
    WITH CHECK (public.is_backoffice_staff());

-- ------------------------------------------------------------------------------
-- stock_items, recipe_ingredients: the one open policy also covered reads, so after this
-- only signed-in back-office staff (and SECURITY DEFINER functions) can see them
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all access for public" ON public.stock_items;
CREATE POLICY "stock_items_backoffice_all" ON public.stock_items
    FOR ALL TO authenticated
    USING (public.is_backoffice_staff())
    WITH CHECK (public.is_backoffice_staff());

DROP POLICY IF EXISTS "Enable all access for public" ON public.recipe_ingredients;
CREATE POLICY "recipe_ingredients_backoffice_all" ON public.recipe_ingredients
    FOR ALL TO authenticated
    USING (public.is_backoffice_staff())
    WITH CHECK (public.is_backoffice_staff());

-- save_menu_recipe(bigint, jsonb) is SECURITY DEFINER and rewrites recipe_ingredients
-- with no role check, so anon could go around the policy above. Its only caller is
-- RecipeBuilder (mounted in MenuCostPage, RecipeLabPage, SOPEditorPage under /admin and
-- StockPage under /staff/stock, all signed in); no other function, edge function or api/
-- file calls it. Body unchanged; anon loses EXECUTE. Still open: any signed-in user can
-- call it (no role check inside) - Phase B.
REVOKE EXECUTE ON FUNCTION public.save_menu_recipe(bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_menu_recipe(bigint, jsonb) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- bookings: only DELETE changes
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can delete bookings" ON public.bookings;
CREATE POLICY "bookings_backoffice_delete" ON public.bookings
    FOR DELETE TO authenticated
    USING (public.is_backoffice_staff());

-- ------------------------------------------------------------------------------
-- pos_shifts: the POS keeps insert/update (upsert needs both, plus pos_shifts_read)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "pos_shifts_write" ON public.pos_shifts;
CREATE POLICY "pos_shifts_insert" ON public.pos_shifts
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);
CREATE POLICY "pos_shifts_update" ON public.pos_shifts
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);
CREATE POLICY "pos_shifts_backoffice_delete" ON public.pos_shifts
    FOR DELETE TO authenticated
    USING (public.is_backoffice_staff());

-- ------------------------------------------------------------------------------
-- tax_customer_profiles: the POS keeps search and upsert (owner rule 2026-11-11)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated full access to tax_customer_profiles" ON public.tax_customer_profiles;
DROP POLICY IF EXISTS "Allow full access to tax_customer_profiles" ON public.tax_customer_profiles;
CREATE POLICY "tax_customer_profiles_select" ON public.tax_customer_profiles
    FOR SELECT
    USING (true);
CREATE POLICY "tax_customer_profiles_insert" ON public.tax_customer_profiles
    FOR INSERT
    WITH CHECK (true);
CREATE POLICY "tax_customer_profiles_update" ON public.tax_customer_profiles
    FOR UPDATE
    USING (true)
    WITH CHECK (true);
CREATE POLICY "tax_customer_profiles_backoffice_delete" ON public.tax_customer_profiles
    FOR DELETE TO authenticated
    USING (public.is_backoffice_staff());

-- ------------------------------------------------------------------------------
-- app_settings: staff_pin_code (4 characters, read by nothing but the admin settings
-- form) joins the 8 admin-only keys from stage 2
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "app_settings_secrets_admin_only" ON public.app_settings;
CREATE POLICY "app_settings_secrets_admin_only" ON public.app_settings
    AS RESTRICTIVE
    FOR ALL
    USING (
        key <> ALL (ARRAY[
            'easyslip_api_key', 'gemini_api_key',
            'line_channel_access_token', 'line_channel_secret',
            'notte_api_key', 'sms_api_key', 'sms_api_secret',
            'spotify_client_secret',
            'staff_pin_code'
        ])
        OR public.is_admin()
    )
    WITH CHECK (
        key <> ALL (ARRAY[
            'easyslip_api_key', 'gemini_api_key',
            'line_channel_access_token', 'line_channel_secret',
            'notte_api_key', 'sms_api_key', 'sms_api_secret',
            'spotify_client_secret',
            'staff_pin_code'
        ])
        OR public.is_admin()
    );

COMMIT;

-- ==============================================================================
-- CHECK RIGHT AFTER RUNNING (as the public role)
--   SET ROLE anon;
--   SELECT count(*) FROM public.stock_items;            -- expect 0
--   SELECT count(*) FROM public.recipe_ingredients;     -- expect 0
--   SELECT count(*) FROM public.app_settings WHERE key = 'staff_pin_code';  -- expect 0
--   SELECT count(*) FROM public.promotion_codes;        -- expect the same as before
--   RESET ROLE;
-- THEN IN THE REAL APPS: POS open a shift, order, pay, close the shift; issue a full tax
-- invoice from Bill Details; back office (signed in) edit a promo code, open stock.
-- If anything at the front of house fails: run 06_lock_backoffice_only_writes_ROLLBACK.sql.
-- ==============================================================================
