-- ==============================================================================
-- ROLLBACK for supabase/migrations/20261116150000_tax_document_integrity.sql
-- Removes the triggers and functions it added. Documents issued in the meantime keep
-- their numbers; the counters table and the 50 ทวิ status columns are left in place
-- (harmless, and dropping them would lose which certificates were cancelled).
-- The purge tool is NOT put back to deleting tax documents; to restore that, re-run the
-- purge_system_data_impl definition from 20261021130000 (renamed to *_impl).
-- ==============================================================================
BEGIN;
DROP TRIGGER IF EXISTS tax_invoices_before_insert ON public.tax_invoices;
DROP TRIGGER IF EXISTS tax_invoices_before_update ON public.tax_invoices;
DROP TRIGGER IF EXISTS tax_invoices_block_delete ON public.tax_invoices;
DROP TRIGGER IF EXISTS withholding_tax_before_insert ON public.withholding_tax_records;
DROP TRIGGER IF EXISTS withholding_tax_block_delete ON public.withholding_tax_records;
DROP FUNCTION IF EXISTS public.tax_invoices_before_insert();
DROP FUNCTION IF EXISTS public.tax_invoices_before_update();
DROP FUNCTION IF EXISTS public.withholding_tax_before_insert();
DROP FUNCTION IF EXISTS public.tax_documents_block_delete();
DROP FUNCTION IF EXISTS public.reissue_tax_invoice(UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.tax_next_document_number(TEXT, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.tax_setting(TEXT, TEXT);
COMMIT;
