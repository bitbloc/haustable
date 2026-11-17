-- ==============================================================================
-- ROLLBACK for supabase/migrations/20261117120000_lock_backoffice_only_writes.sql
-- Drops the policies that migration added and recreates, verbatim, the policies that were
-- live on 2026-11-17 (read from pg_policies with --read-only; same as docs/security-audit.md).
-- Takes effect immediately; no app restart needed. No data is touched.
-- ==============================================================================

BEGIN;

-- promotion_codes
DROP POLICY IF EXISTS "promotion_codes_backoffice_write" ON public.promotion_codes;
DROP POLICY IF EXISTS "promotion_codes_write" ON public.promotion_codes;
CREATE POLICY "promotion_codes_write" ON public.promotion_codes
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- store_exceptions
DROP POLICY IF EXISTS "store_exceptions_backoffice_write" ON public.store_exceptions;
DROP POLICY IF EXISTS "store_exceptions_write" ON public.store_exceptions;
CREATE POLICY "store_exceptions_write" ON public.store_exceptions
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- stock_items
DROP POLICY IF EXISTS "stock_items_backoffice_all" ON public.stock_items;
DROP POLICY IF EXISTS "Enable all access for public" ON public.stock_items;
CREATE POLICY "Enable all access for public" ON public.stock_items
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- recipe_ingredients
DROP POLICY IF EXISTS "recipe_ingredients_backoffice_all" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "Enable all access for public" ON public.recipe_ingredients;
CREATE POLICY "Enable all access for public" ON public.recipe_ingredients
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- save_menu_recipe: live ACL on 2026-11-17 was
-- {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
GRANT EXECUTE ON FUNCTION public.save_menu_recipe(bigint, jsonb) TO PUBLIC, anon, authenticated, service_role;

-- bookings
DROP POLICY IF EXISTS "bookings_backoffice_delete" ON public.bookings;
DROP POLICY IF EXISTS "Public can delete bookings" ON public.bookings;
CREATE POLICY "Public can delete bookings" ON public.bookings
    FOR DELETE TO anon, authenticated
    USING (true);

-- pos_shifts
DROP POLICY IF EXISTS "pos_shifts_insert" ON public.pos_shifts;
DROP POLICY IF EXISTS "pos_shifts_update" ON public.pos_shifts;
DROP POLICY IF EXISTS "pos_shifts_backoffice_delete" ON public.pos_shifts;
DROP POLICY IF EXISTS "pos_shifts_write" ON public.pos_shifts;
CREATE POLICY "pos_shifts_write" ON public.pos_shifts
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- tax_customer_profiles
DROP POLICY IF EXISTS "tax_customer_profiles_select" ON public.tax_customer_profiles;
DROP POLICY IF EXISTS "tax_customer_profiles_insert" ON public.tax_customer_profiles;
DROP POLICY IF EXISTS "tax_customer_profiles_update" ON public.tax_customer_profiles;
DROP POLICY IF EXISTS "tax_customer_profiles_backoffice_delete" ON public.tax_customer_profiles;
DROP POLICY IF EXISTS "Allow authenticated full access to tax_customer_profiles" ON public.tax_customer_profiles;
DROP POLICY IF EXISTS "Allow full access to tax_customer_profiles" ON public.tax_customer_profiles;
CREATE POLICY "Allow authenticated full access to tax_customer_profiles" ON public.tax_customer_profiles
    FOR ALL
    USING (true)
    WITH CHECK (true);
CREATE POLICY "Allow full access to tax_customer_profiles" ON public.tax_customer_profiles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- app_settings: back to the 8 keys of stage 2 (staff_pin_code readable again)
DROP POLICY IF EXISTS "app_settings_secrets_admin_only" ON public.app_settings;
CREATE POLICY "app_settings_secrets_admin_only" ON public.app_settings
    AS RESTRICTIVE
    FOR ALL
    USING (
        key <> ALL (ARRAY[
            'easyslip_api_key', 'gemini_api_key',
            'line_channel_access_token', 'line_channel_secret',
            'notte_api_key', 'sms_api_key', 'sms_api_secret',
            'spotify_client_secret'
        ])
        OR public.is_admin()
    )
    WITH CHECK (
        key <> ALL (ARRAY[
            'easyslip_api_key', 'gemini_api_key',
            'line_channel_access_token', 'line_channel_secret',
            'notte_api_key', 'sms_api_key', 'sms_api_secret',
            'spotify_client_secret'
        ])
        OR public.is_admin()
    );

COMMIT;
