-- ==============================================================================
-- STAGE 2 — Hide API secrets and lock back-office-only tables
--
-- APPLIED to production on 2026-11-11 after closing time, via the Supabase SQL Editor
-- (owner approved; API keys left unchanged). Rollback: 01_stage2_ROLLBACK.sql
-- Verified with the public key right after: 0 of the 8 secret rows visible, 163 ordinary
-- settings still readable (171 - 8), store_expenses and withholding_tax_records return 0
-- rows; printer/tax settings, tax_invoices, tax_customer_profiles, bookings, menu and the
-- staff list are still readable.
--
-- What it does
--   A. app_settings: the 8 secret rows (API keys / tokens) become readable and writable
--      only by a logged-in owner/admin. Every other row behaves exactly as before.
--   B. store_expenses, withholding_tax_records: only logged-in back-office staff.
--      These two tables are used by back-office pages only.
--
-- WORKFLOW CONSTRAINT (owner, 2026-11-11): front-of-house staff must be able to issue a
--   FULL tax invoice to a customer from the POS (Bill Details -> TaxInvoiceModal), and the
--   POS is not logged in to Supabase. That flow reads tax_* rows of app_settings, searches
--   and upserts tax_customer_profiles, and inserts/updates tax_invoices. So tax_invoices
--   and tax_customer_profiles MUST stay reachable by the POS and are NOT locked here.
--
-- What it deliberately does NOT touch (the live shop depends on public access today)
--   bookings, order_items, profiles, tables_layout, pos_shifts, stock_*, tax_invoices,
--   pos_audit_logs, menu_*. Those need the POS to sign in as a device first (stage 4).
--
-- Why nothing at the front of house changes
--   - POS and customer pages never read the secret rows; they only read ordinary settings.
--   - Edge functions (LINE, slip verification, Spotify, Makro) use the service role key,
--     which bypasses RLS, so they keep reading the secrets.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- Helper: is the caller a logged-in back-office staff member?
-- Mirrors the check in src/components/AdminLayout.jsx.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_backoffice_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND (
              lower(coalesce(role, '')) IN ('owner', 'admin', 'manager', 'staff', 'cashier', 'kitchen', 'custom')
              OR coalesce(cardinality(admin_permissions), 0) > 0
          )
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_backoffice_staff() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- A. app_settings — secrets visible to owner/admin only
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    had_rls boolean;
BEGIN
    SELECT relrowsecurity INTO had_rls FROM pg_class WHERE oid = 'public.app_settings'::regclass;
    IF NOT had_rls THEN
        -- RLS was off, i.e. everything was open. Keep that behaviour for ordinary rows
        -- with one explicit permissive policy, then switch RLS on.
        CREATE POLICY "app_settings_open_legacy" ON public.app_settings
            FOR ALL USING (true) WITH CHECK (true);
        ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

DROP POLICY IF EXISTS "app_settings_secrets_admin_only" ON public.app_settings;
-- RESTRICTIVE = applied on top of whatever permissive policies already exist.
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

-- ------------------------------------------------------------------------------
-- B. Back-office-only tables
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    t text;
    p record;
BEGIN
    FOREACH t IN ARRAY ARRAY['store_expenses', 'withholding_tax_records'] LOOP
        -- Remove every existing policy (names on the live database are not known for sure;
        -- the diagnostic output saved beforehand is the record of what was there).
        FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
        END LOOP;
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff())',
            t || '_backoffice_only', t
        );
    END LOOP;
END $$;

COMMIT;

-- ==============================================================================
-- CHECK RIGHT AFTER RUNNING (SQL Editor runs as an owner role, so use SET ROLE)
-- ==============================================================================
-- Expect 0 rows / 0 counts for the public role:
--   SET ROLE anon;
--   SELECT key FROM public.app_settings WHERE key LIKE '%secret%' OR key LIKE '%api_key%' OR key LIKE '%token%';
--   SELECT count(*) FROM public.store_expenses;
--   SELECT count(*) FROM public.withholding_tax_records;
-- Expect the ordinary settings to still be readable by the public role (same count as before minus 8):
--   SELECT count(*) FROM public.app_settings;
--   RESET ROLE;
--
-- THEN TEST IN THE REAL APPS
--   1. Customer: scan a table QR, open the menu, place a test order.
--   2. POS: open a bill, send to kitchen, print, take payment.
--   2b. POS: open Bill Details on a paid bill and issue a FULL tax invoice (search an
--       existing tax customer, save, print). This must work without a back-office login.
--   3. Back office (logged in as owner): Settings shows the API keys, Tax hub and
--      Expenses load and save.
--   4. Upload a payment slip on the booking/pickup page (slip verification).
--   5. Send a LINE notification from the POS.
-- If any of 1-5 fails: run 01_stage2_ROLLBACK.sql.
