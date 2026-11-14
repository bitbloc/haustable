-- ==============================================================================
-- ROLLBACK for 01_stage2_hide_secrets_and_lock_backoffice.sql
-- Puts access back to "open to everyone", which is how these tables behaved before.
-- Takes effect immediately; no app restart needed.
--
-- Note: the three back-office tables get one generic "allow all" policy each. If the
-- original policies had different names or rules, restore them from the output of
-- 00_diagnose_current_rls.sql saved before stage 2.
-- ==============================================================================

BEGIN;

-- A. app_settings — secrets readable by everyone again
DROP POLICY IF EXISTS "app_settings_secrets_admin_only" ON public.app_settings;

DO $$
BEGIN
    -- If stage 2 was what switched RLS on (it left this marker policy), switch it back off.
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'app_settings_open_legacy'
    ) THEN
        ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
        DROP POLICY "app_settings_open_legacy" ON public.app_settings;
    END IF;
END $$;

-- B. Back-office tables — open again
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['store_expenses', 'withholding_tax_records'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_backoffice_only', t);
    END LOOP;
END $$;

-- Exact policies that existed on 2026-11-11 (from 00_diagnose_current_rls.sql)
DROP POLICY IF EXISTS "Allow full access to store_expenses" ON public.store_expenses;
CREATE POLICY "Allow full access to store_expenses" ON public.store_expenses
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to withholding_tax_records" ON public.withholding_tax_records;
CREATE POLICY "Allow authenticated full access to withholding_tax_records" ON public.withholding_tax_records
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to withholding_tax_records" ON public.withholding_tax_records;
CREATE POLICY "Allow full access to withholding_tax_records" ON public.withholding_tax_records
    FOR ALL USING (true) WITH CHECK (true);

COMMIT;
