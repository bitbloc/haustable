-- Hide the owner's citizen ID (app_settings.tax_citizen_id) from anyone who is
-- not signed in to the back office.
--
-- Why (2026-11-26): "Public can view settings" lets anon read every
-- app_settings row, so the citizen ID was readable with the public anon key.
-- Only back-office tax pages read it (CashTaxLedgerTab, CashTaxLedgerPrintView,
-- thaiTaxExcelHelper, TaxSettingsTab); /pos and customer pages do not.
--
-- RESTRICTIVE + SELECT only: writes are unchanged, every other key is
-- unchanged. Apply as a single file with `supabase db query` (never db push).
-- Rollback: DROP POLICY "app_settings_private_backoffice_read" ON public.app_settings;

DROP POLICY IF EXISTS "app_settings_private_backoffice_read" ON public.app_settings;
CREATE POLICY "app_settings_private_backoffice_read" ON public.app_settings
    AS RESTRICTIVE
    FOR SELECT
    USING (
        key <> ALL (ARRAY['tax_citizen_id'])
        OR public.is_backoffice_staff()
        OR public.is_admin()
    );
