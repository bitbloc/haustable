-- Create pos_shifts table for cloud backup and recovery of shifts
CREATE TABLE IF NOT EXISTS public.pos_shifts (
    id TEXT PRIMARY KEY,
    staff_name TEXT NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    opening_float NUMERIC NOT NULL DEFAULT 0,
    closed_cash NUMERIC,
    expected_cash NUMERIC,
    difference NUMERIC,
    status TEXT NOT NULL DEFAULT 'open',
    transactions JSONB DEFAULT '[]'::jsonb,
    adjustments JSONB DEFAULT '[]'::jsonb,
    cash_sales NUMERIC DEFAULT 0,
    qr_sales NUMERIC DEFAULT 0,
    total_sales NUMERIC DEFAULT 0,
    total_in NUMERIC DEFAULT 0,
    total_out NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;

-- Read policy
DROP POLICY IF EXISTS "pos_shifts_read" ON public.pos_shifts;
CREATE POLICY "pos_shifts_read" ON public.pos_shifts
    FOR SELECT TO anon, authenticated USING (true);

-- Write/Update policy
DROP POLICY IF EXISTS "pos_shifts_write" ON public.pos_shifts;
CREATE POLICY "pos_shifts_write" ON public.pos_shifts
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Grant select/write
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_shifts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_shifts TO authenticated;
