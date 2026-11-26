-- Recurring fixed costs (rent, monthly ads, subscriptions): set once, posted
-- into store_expenses every month (owner request 2026-11-26).
--
-- recurring_expenses        the templates, managed in Tax & Invoices -> ค่าใช้จ่าย
-- recurring_expense_posts   one row per template per month once it is posted.
--                           If staff delete that month's expense (not paid,
--                           skipped), it is NOT posted again.
-- post_recurring_expenses('YYYY-MM') posts every active template whose day has
-- come (Bangkok date) and that has not been posted for that month. Called by
-- the back office when the expenses tab or the monthly report opens.
--
-- Additive only: no change to store_expenses or to anything the POS reads.
-- Same access rule as store_expenses: back-office staff only.
-- Apply as one file with `supabase db query` (never db push).
-- Rollback: DROP FUNCTION public.post_recurring_expenses(text);
--           DROP TABLE public.recurring_expense_posts; DROP TABLE public.recurring_expenses;

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'rent',
    vendor_name TEXT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    day_of_month SMALLINT NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 31),
    payment_method TEXT NOT NULL DEFAULT 'TRANSFER',
    doc_type TEXT NOT NULL DEFAULT 'receipt_voucher',
    start_month TEXT NOT NULL CHECK (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    end_month TEXT CHECK (end_month IS NULL OR end_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recurring_expense_posts (
    recurring_expense_id UUID NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    expense_id UUID,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (recurring_expense_id, month)
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring_expenses_backoffice_only" ON public.recurring_expenses;
CREATE POLICY "recurring_expenses_backoffice_only" ON public.recurring_expenses
    FOR ALL USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff());

DROP POLICY IF EXISTS "recurring_expense_posts_backoffice_only" ON public.recurring_expense_posts;
CREATE POLICY "recurring_expense_posts_backoffice_only" ON public.recurring_expense_posts
    FOR ALL USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff());

-- Runs with the caller's rights, so RLS keeps it to back-office staff.
CREATE OR REPLACE FUNCTION public.post_recurring_expenses(p_month TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_year INT;
    v_mon INT;
    v_last INT;
    v_date DATE;
    v_today DATE := (now() AT TIME ZONE 'Asia/Bangkok')::date;
    v_expense_id UUID;
    v_posted INT := 0;
BEGIN
    IF p_month IS NULL OR p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
        RAISE EXCEPTION 'p_month must be YYYY-MM';
    END IF;
    v_year := split_part(p_month, '-', 1)::INT;
    v_mon := split_part(p_month, '-', 2)::INT;
    v_last := EXTRACT(DAY FROM (make_date(v_year, v_mon, 1) + INTERVAL '1 month - 1 day'))::INT;

    FOR r IN
        SELECT * FROM public.recurring_expenses
        WHERE active
          AND start_month <= p_month
          AND (end_month IS NULL OR end_month >= p_month)
    LOOP
        v_date := make_date(v_year, v_mon, LEAST(r.day_of_month, v_last));
        CONTINUE WHEN v_date > v_today; -- never post ahead of the day

        INSERT INTO public.recurring_expense_posts (recurring_expense_id, month)
        VALUES (r.id, p_month)
        ON CONFLICT DO NOTHING;
        CONTINUE WHEN NOT FOUND; -- already posted (or deliberately removed) this month

        INSERT INTO public.store_expenses
            (expense_date, title, category, vendor_name, doc_type, amount, vat_included, vat_amount, payment_method, notes)
        VALUES
            (v_date, r.title, r.category, r.vendor_name, r.doc_type, r.amount, FALSE, 0, r.payment_method,
             trim(both ' ' from concat('ค่าใช้จ่ายประจำ (ลงอัตโนมัติ) ', coalesce(r.notes, ''))))
        RETURNING id INTO v_expense_id;

        UPDATE public.recurring_expense_posts SET expense_id = v_expense_id
        WHERE recurring_expense_id = r.id AND month = p_month;
        v_posted := v_posted + 1;
    END LOOP;

    RETURN v_posted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_recurring_expenses(TEXT) TO authenticated;
