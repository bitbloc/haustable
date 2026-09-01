-- Migration: Create Store Expenses & Makro Receipt Tracker Table
-- Date: 2026-08-16
-- Description: Records store expenses, Makro purchases, utilities, rent, and payroll with attached receipt images for tax deductions.

CREATE TABLE IF NOT EXISTS public.store_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'raw_material',
    vendor_name TEXT DEFAULT 'Makro',
    vendor_tax_id TEXT,
    doc_type TEXT DEFAULT 'tax_invoice' CHECK (doc_type IN ('tax_invoice', 'cash_bill', 'receipt_voucher', 'slip_only')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vat_included BOOLEAN DEFAULT true,
    vat_amount NUMERIC(12, 2) DEFAULT 0.00,
    receipt_image_url TEXT,
    payment_method TEXT DEFAULT 'TRANSFER' CHECK (payment_method IN ('TRANSFER', 'CASH', 'CREDIT')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_store_expenses_date ON public.store_expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_store_expenses_category ON public.store_expenses (category);
CREATE INDEX IF NOT EXISTS idx_store_expenses_doc_type ON public.store_expenses (doc_type);

ALTER TABLE public.store_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to store_expenses" ON public.store_expenses;
CREATE POLICY "Allow full access to store_expenses" 
ON public.store_expenses FOR ALL USING (true) WITH CHECK (true);
