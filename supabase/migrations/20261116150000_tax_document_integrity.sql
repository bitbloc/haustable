-- ==============================================================================
-- Tax document integrity: running numbers, locked documents, no deletes
-- Date: 2026-11-16 · Apply in the Supabase SQL Editor · Rollback: supabase/security_hardening/02_tax_document_integrity_ROLLBACK.sql
-- APPLIED to production on 2026-11-16 via the Supabase SQL Editor (owner asked Claude to run it).
-- Verified right after with rolled-back checks: 5 triggers present; next number REC-202611-6595;
-- editing an issued document, deleting and a second active document per bill are refused;
-- the public (POS) role can still insert and reissue. Counter table left empty.
--
-- 1. Running numbers assigned by the database
--    Every new receipt / tax invoice / credit note / 50 ทวิ gets PREFIX-YYYYMM-NNNN from a
--    counter, inside the INSERT itself: no gaps from failed saves, no duplicates from two
--    devices saving at once. Whatever number a client sends is replaced, so old cached
--    POS builds also get proper numbers. Each month's counter continues after the highest
--    number already used that month (November 2026 continues after the old random ones).
-- 2. One active document per POS bill (checked on insert; the two active documents that
--    already exist for one bill are left as they are and reported to the owner).
-- 3. An issued document cannot be changed: only cancelling it, its signature, notes and
--    contact email/phone. A cancelled document cannot be changed or brought back.
--    Corrections = reissue_tax_invoice(): cancels the old one and issues a new number in
--    one transaction.
-- 4. Tax documents cannot be deleted (records must be kept 5 years). 50 ทวิ gets a
--    status so it can be cancelled instead. The data purge tool no longer deletes tax
--    documents or expenses.
--
-- POS constraint (owner, 2026-11-11): the PIN-only POS issues full tax invoices as the
-- public role. Nothing here changes who can read/insert/update tax_invoices; the triggers
-- run for everyone, and reissue_tax_invoice is executable by the POS too.
-- ==============================================================================

BEGIN;

-- ---- 1. Counters ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_document_counters (
    series     TEXT PRIMARY KEY,          -- e.g. 'REC-202611'
    last_no    INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_document_counters ENABLE ROW LEVEL SECURITY;  -- no policies: only the functions below touch it
REVOKE ALL ON public.tax_document_counters FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tax_next_document_number(p_prefix TEXT, p_at TIMESTAMPTZ, p_kind TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_series TEXT := p_prefix || '-' || to_char(COALESCE(p_at, now()) AT TIME ZONE 'Asia/Bangkok', 'YYYYMM');
    v_seed   INTEGER;
    v_no     INTEGER;
BEGIN
    -- Highest number already used in this series (also covers numbers made before this migration)
    IF p_kind = 'wht' THEN
        SELECT COALESCE(MAX(substr(doc_number, length(v_series) + 2)::INTEGER), 0) INTO v_seed
        FROM public.withholding_tax_records
        WHERE doc_number LIKE v_series || '-%' AND substr(doc_number, length(v_series) + 2) ~ '^[0-9]{1,9}$';
    ELSE
        SELECT COALESCE(MAX(substr(invoice_number, length(v_series) + 2)::INTEGER), 0) INTO v_seed
        FROM public.tax_invoices
        WHERE invoice_number LIKE v_series || '-%' AND substr(invoice_number, length(v_series) + 2) ~ '^[0-9]{1,9}$';
    END IF;

    INSERT INTO public.tax_document_counters AS c (series, last_no)
    VALUES (v_series, v_seed + 1)
    ON CONFLICT (series) DO UPDATE
        SET last_no = GREATEST(c.last_no, v_seed) + 1, updated_at = now()
    RETURNING last_no INTO v_no;

    RETURN v_series || '-' || lpad(v_no::TEXT, 4, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.tax_next_document_number(TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tax_setting(p_key TEXT, p_default TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(NULLIF(trim((SELECT value FROM public.app_settings WHERE key = p_key LIMIT 1)), ''), p_default);
$$;
REVOKE ALL ON FUNCTION public.tax_setting(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ---- 2 + 1. tax_invoices: number and one active document per bill -----------
CREATE OR REPLACE FUNCTION public.tax_invoices_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix   TEXT;
    v_existing TEXT;
BEGIN
    IF NEW.booking_id IS NOT NULL AND COALESCE(NEW.status, 'issued') <> 'cancelled' THEN
        SELECT invoice_number INTO v_existing
        FROM public.tax_invoices
        WHERE booking_id = NEW.booking_id AND status <> 'cancelled'
        LIMIT 1;
        IF v_existing IS NOT NULL THEN
            RAISE EXCEPTION 'บิลนี้มีเอกสาร % อยู่แล้ว ยกเลิกใบเดิมก่อนถ้าต้องการออกใหม่', v_existing
                USING ERRCODE = 'P0001', HINT = 'one_active_document_per_bill';
        END IF;
    END IF;

    v_prefix := CASE NEW.doc_type
        WHEN 'tax_invoice' THEN public.tax_setting('tax_invoice_prefix', 'INV')
        WHEN 'credit_note' THEN 'CN'
        ELSE public.tax_setting('tax_receipt_prefix', 'REC')
    END;
    NEW.invoice_number := public.tax_next_document_number(v_prefix, COALESCE(NEW.issued_at, now()), 'invoice');
    NEW.status := COALESCE(NEW.status, 'issued');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tax_invoices_before_insert ON public.tax_invoices;
CREATE TRIGGER tax_invoices_before_insert
    BEFORE INSERT ON public.tax_invoices
    FOR EACH ROW EXECUTE FUNCTION public.tax_invoices_before_insert();

-- ---- 3. tax_invoices: issued documents are locked ---------------------------
CREATE OR REPLACE FUNCTION public.tax_invoices_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    -- Fields that may change on an issued document
    v_free CONSTANT TEXT[] := ARRAY['status', 'cancellation_reason', 'cancelled_at', 'signature_url',
                                    'signature_name', 'notes', 'customer_email', 'customer_phone', 'booking_id'];
BEGIN
    -- Deleting a POS bill sets booking_id to NULL (ON DELETE SET NULL); that is the only
    -- booking_id change allowed.
    IF NEW.booking_id IS DISTINCT FROM OLD.booking_id AND NEW.booking_id IS NOT NULL THEN
        RAISE EXCEPTION 'เปลี่ยนบิลที่ผูกกับเอกสาร % ไม่ได้', OLD.invoice_number USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status = 'cancelled' THEN
        IF (to_jsonb(NEW) - 'booking_id') IS DISTINCT FROM (to_jsonb(OLD) - 'booking_id') THEN
            RAISE EXCEPTION 'เอกสาร % ถูกยกเลิกแล้ว แก้ไขหรือเปิดใช้ใหม่ไม่ได้ ให้ออกเอกสารใบใหม่', OLD.invoice_number
                USING ERRCODE = 'P0001', HINT = 'cancelled_document_is_final';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.status NOT IN ('issued', 'cancelled') THEN
        RAISE EXCEPTION 'สถานะเอกสารไม่ถูกต้อง: %', NEW.status USING ERRCODE = 'P0001';
    END IF;

    IF (to_jsonb(NEW) - v_free) IS DISTINCT FROM (to_jsonb(OLD) - v_free) THEN
        RAISE EXCEPTION 'เอกสาร % ออกไปแล้ว แก้ไขยอดเงิน ผู้ซื้อ รายการ หรือวันที่ไม่ได้ ให้ยกเลิกและออกใบใหม่', OLD.invoice_number
            USING ERRCODE = 'P0001', HINT = 'issued_document_is_locked';
    END IF;

    IF NEW.status = 'cancelled' THEN
        NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
        IF COALESCE(trim(NEW.cancellation_reason), '') = '' THEN
            RAISE EXCEPTION 'กรุณาระบุเหตุผลการยกเลิกเอกสาร' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tax_invoices_before_update ON public.tax_invoices;
CREATE TRIGGER tax_invoices_before_update
    BEFORE UPDATE ON public.tax_invoices
    FOR EACH ROW EXECUTE FUNCTION public.tax_invoices_before_update();

-- ---- 4. No deletes -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tax_documents_block_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'เอกสารภาษีต้องเก็บไว้ 5 ปี ลบไม่ได้ ให้ยกเลิกเอกสารแทน'
        USING ERRCODE = 'P0001', HINT = 'tax_documents_are_kept';
END;
$$;

DROP TRIGGER IF EXISTS tax_invoices_block_delete ON public.tax_invoices;
CREATE TRIGGER tax_invoices_block_delete
    BEFORE DELETE ON public.tax_invoices
    FOR EACH ROW EXECUTE FUNCTION public.tax_documents_block_delete();

-- 50 ทวิ: cancellable instead of deletable, numbered by the database
ALTER TABLE public.withholding_tax_records ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'issued';
ALTER TABLE public.withholding_tax_records ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.withholding_tax_records ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
DO $$ BEGIN
    ALTER TABLE public.withholding_tax_records
        ADD CONSTRAINT withholding_tax_records_status_check CHECK (status IN ('issued', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.withholding_tax_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.doc_number := public.tax_next_document_number(
        public.tax_setting('tax_wht_prefix', 'WHT'),
        (COALESCE(NEW.payment_date, CURRENT_DATE)::TIMESTAMP AT TIME ZONE 'Asia/Bangkok'),
        'wht');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS withholding_tax_before_insert ON public.withholding_tax_records;
CREATE TRIGGER withholding_tax_before_insert
    BEFORE INSERT ON public.withholding_tax_records
    FOR EACH ROW EXECUTE FUNCTION public.withholding_tax_before_insert();

DROP TRIGGER IF EXISTS withholding_tax_block_delete ON public.withholding_tax_records;
CREATE TRIGGER withholding_tax_block_delete
    BEFORE DELETE ON public.withholding_tax_records
    FOR EACH ROW EXECUTE FUNCTION public.tax_documents_block_delete();

-- ---- 3b. Correct a document in one step --------------------------------------
-- Cancels p_old_id with p_reason and issues a new document from p_new (the same fields
-- the app inserts), atomically. Runs with the caller's rights, so the POS can use it.
CREATE OR REPLACE FUNCTION public.reissue_tax_invoice(p_old_id UUID, p_reason TEXT, p_new JSONB)
RETURNS public.tax_invoices
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_old public.tax_invoices;
    v_new public.tax_invoices;
    r     public.tax_invoices;
BEGIN
    IF COALESCE(trim(p_reason), '') = '' THEN
        RAISE EXCEPTION 'กรุณาระบุเหตุผลที่ออกใบใหม่' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.tax_invoices
       SET status = 'cancelled', cancellation_reason = p_reason, cancelled_at = now()
     WHERE id = p_old_id AND status = 'issued'
    RETURNING * INTO v_old;
    IF v_old.id IS NULL THEN
        RAISE EXCEPTION 'ไม่พบเอกสารที่ยังใช้งานอยู่สำหรับออกใบแทน' USING ERRCODE = 'P0001';
    END IF;

    r := jsonb_populate_record(NULL::public.tax_invoices, p_new);

    INSERT INTO public.tax_invoices (
        invoice_number, booking_id, doc_type, customer_type, customer_name, customer_tax_id,
        customer_branch_type, customer_branch_code, customer_address, customer_phone, customer_email,
        subtotal, discount_amount, pre_vat_amount, vat_rate, vat_amount, total_amount,
        wht_rate, wht_amount, net_payable, payment_method, payment_reference, items,
        issuer_name, issuer_tax_id, issuer_branch, issuer_address, issuer_phone,
        status, notes, issued_at, signature_url, signature_name
    ) VALUES (
        'assigned-by-trigger', COALESCE(r.booking_id, v_old.booking_id), COALESCE(r.doc_type, v_old.doc_type),
        r.customer_type, r.customer_name, r.customer_tax_id,
        r.customer_branch_type, r.customer_branch_code, COALESCE(r.customer_address, ''), r.customer_phone, r.customer_email,
        COALESCE(r.subtotal, 0), COALESCE(r.discount_amount, 0), COALESCE(r.pre_vat_amount, 0),
        COALESCE(r.vat_rate, 0), COALESCE(r.vat_amount, 0), COALESCE(r.total_amount, 0),
        r.wht_rate, r.wht_amount, COALESCE(r.net_payable, 0), r.payment_method, r.payment_reference,
        COALESCE(r.items, '[]'::jsonb),
        r.issuer_name, r.issuer_tax_id, r.issuer_branch, r.issuer_address, r.issuer_phone,
        'issued', r.notes, COALESCE(r.issued_at, now()), r.signature_url, r.signature_name
    )
    RETURNING * INTO v_new;

    RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.reissue_tax_invoice(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reissue_tax_invoice(UUID, TEXT, JSONB) TO anon, authenticated, service_role;

-- ---- 4b. Purge tool keeps tax documents and expenses ---------------------------
-- Same body as 20261021130000 (the passcode check stays, and the public wrapper from
-- 01a_URGENT_lock_destructive_functions.sql still requires an admin login), minus the
-- deletes of tax_invoices, withholding_tax_records and store_expenses.
CREATE OR REPLACE FUNCTION public.purge_system_data_impl(
    p_category TEXT,
    p_passcode TEXT,
    p_reset_stock_qty BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_valid_passcode CONSTANT TEXT := '1500323553';
    v_deleted_info JSONB := '{}'::JSONB;
BEGIN
    IF p_passcode IS NULL OR TRIM(p_passcode) <> v_valid_passcode THEN
        RAISE EXCEPTION 'รหัสความปลอดภัยไม่ถูกต้อง (Invalid Passcode). การดำเนินการถูกระงับเพื่อความปลอดภัย';
    END IF;

    IF p_category = 'orders' OR p_category = 'all_operational' THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
            DELETE FROM public.order_items;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_slips_registry') THEN
            DELETE FROM public.payment_slips_registry;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
            DELETE FROM public.bookings;  -- tax_invoices.booking_id becomes NULL; the documents stay
        END IF;
        v_deleted_info := jsonb_set(v_deleted_info, '{orders_purged}', 'true'::JSONB);
    END IF;

    IF p_category = 'shifts' OR p_category = 'all_operational' THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_audit_logs') THEN
            DELETE FROM public.pos_audit_logs;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_shifts') THEN
            DELETE FROM public.pos_shifts;
        END IF;
        v_deleted_info := jsonb_set(v_deleted_info, '{shifts_purged}', 'true'::JSONB);
    END IF;

    IF p_category = 'stock' OR p_category = 'all_operational' THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_transactions') THEN
            DELETE FROM public.stock_transactions;
        END IF;
        IF p_reset_stock_qty IS TRUE THEN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_items') THEN
                UPDATE public.stock_items SET current_quantity = 0;
            END IF;
            v_deleted_info := jsonb_set(v_deleted_info, '{stock_quantities_zeroed}', 'true'::JSONB);
        END IF;
        v_deleted_info := jsonb_set(v_deleted_info, '{stock_transactions_purged}', 'true'::JSONB);
    END IF;

    IF p_category = 'tax_expenses' OR p_category = 'all_operational' THEN
        -- Tax documents and expense records are kept for 5 years: nothing is deleted here any more
        v_deleted_info := jsonb_set(v_deleted_info, '{tax_and_expenses_kept}', 'true'::JSONB);
    END IF;

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

    IF p_category = 'crm_balances' THEN
        UPDATE public.profiles
        SET xhaus_coin_balance = 10.00, drink_stamps_count = 0, free_drinks_earned = 0
        WHERE role = 'customer' OR role IS NULL;
        v_deleted_info := jsonb_set(v_deleted_info, '{crm_balances_reset}', 'true'::JSONB);
    END IF;

    v_deleted_info := jsonb_set(v_deleted_info, '{timestamp}', to_jsonb(NOW()));
    v_deleted_info := jsonb_set(v_deleted_info, '{category}', to_jsonb(p_category));
    RETURN v_deleted_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.purge_system_data_impl(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;

COMMIT;

-- ==============================================================================
-- CHECK RIGHT AFTER RUNNING (each block on its own; nothing here changes data for good)
-- ==============================================================================
-- a) Triggers are in place (expect 5 rows):
--   SELECT tgname FROM pg_trigger WHERE tgname IN ('tax_invoices_before_insert','tax_invoices_before_update',
--     'tax_invoices_block_delete','withholding_tax_before_insert','withholding_tax_block_delete');
--
-- b) Numbering, lock and delete block, all rolled back:
--   BEGIN;
--   INSERT INTO public.tax_invoices (invoice_number, doc_type, customer_name, customer_address, total_amount, net_payable)
--     VALUES ('ignored', 'receipt', 'TEST ROLLBACK', '-', 1, 1) RETURNING invoice_number;   -- REC-YYYYMM-NNNN
--   UPDATE public.tax_invoices SET total_amount = 2 WHERE customer_name = 'TEST ROLLBACK';   -- must fail
--   ROLLBACK;
