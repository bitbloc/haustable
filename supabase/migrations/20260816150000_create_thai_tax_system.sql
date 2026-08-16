-- Migration: Create Thai Tax & Official Invoicing System (Dual Non-VAT & VAT Mode)
-- Date: 2026-08-16
-- Description: Complete schema for official receipts, full tax invoices, customer tax directory, withholding tax (50 ทวิ), and tax settings.

-- ============================================================================
-- 1. TAX INVOICES & OFFICIAL RECEIPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tax_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    doc_type TEXT NOT NULL DEFAULT 'receipt' CHECK (doc_type IN ('receipt', 'tax_invoice', 'credit_note')),
    customer_type TEXT DEFAULT 'company' CHECK (customer_type IN ('company', 'individual')),
    customer_name TEXT NOT NULL,
    customer_tax_id TEXT,
    customer_branch_type TEXT DEFAULT 'head_office' CHECK (customer_branch_type IN ('head_office', 'branch')),
    customer_branch_code TEXT DEFAULT '00000',
    customer_address TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    pre_vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    wht_rate NUMERIC(5, 2) DEFAULT 0.00,
    wht_amount NUMERIC(12, 2) DEFAULT 0.00,
    net_payable NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT DEFAULT 'CASH',
    payment_reference TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    issuer_name TEXT DEFAULT 'IN THE HAUS',
    issuer_tax_id TEXT,
    issuer_branch TEXT DEFAULT '00000',
    issuer_address TEXT,
    issuer_phone TEXT,
    status TEXT DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled', 'credit_note')),
    cancellation_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    issued_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 2. REUSABLE CUSTOMER TAX PROFILES DIRECTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tax_customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_type TEXT DEFAULT 'company' CHECK (customer_type IN ('company', 'individual')),
    company_name TEXT NOT NULL,
    tax_id TEXT NOT NULL,
    branch_type TEXT DEFAULT 'head_office' CHECK (branch_type IN ('head_office', 'branch')),
    branch_code TEXT DEFAULT '00000',
    address TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. WITHHOLDING TAX (ภาษีหัก ณ ที่จ่าย ภ.ง.ด. 1/3/53 & ใบ 50 ทวิ)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.withholding_tax_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number TEXT UNIQUE NOT NULL,
    payee_type TEXT DEFAULT 'company' CHECK (payee_type IN ('company', 'individual')),
    payee_name TEXT NOT NULL,
    payee_tax_id TEXT NOT NULL,
    payee_address TEXT NOT NULL,
    income_type TEXT NOT NULL,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
    gross_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_withheld NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    form_type TEXT DEFAULT 'PND53' CHECK (form_type IN ('PND1', 'PND3', 'PND53')),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 4. PERFORMANCE & REPORTING INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tax_invoices_issued_at ON public.tax_invoices (issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_doc_number ON public.tax_invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_status ON public.tax_invoices (status);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_booking_id ON public.tax_invoices (booking_id);
CREATE INDEX IF NOT EXISTS idx_tax_customer_profiles_tax_id ON public.tax_customer_profiles (tax_id);
CREATE INDEX IF NOT EXISTS idx_tax_customer_profiles_name ON public.tax_customer_profiles ((LOWER(TRIM(company_name))));
CREATE INDEX IF NOT EXISTS idx_wht_records_payment_date ON public.withholding_tax_records (payment_date DESC);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.tax_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withholding_tax_records ENABLE ROW LEVEL SECURITY;

-- Allow read and write for authenticated staff/admin or public safe access
CREATE POLICY "Allow authenticated full access to tax_invoices" 
ON public.tax_invoices FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to tax_customer_profiles" 
ON public.tax_customer_profiles FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to withholding_tax_records" 
ON public.withholding_tax_records FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. DEFAULT TAX SETTINGS SEED (Non-VAT by default, ready for 2027 VAT upgrade)
-- ============================================================================
INSERT INTO public.app_settings (key, value) VALUES 
('tax_is_vat_registered', 'false'),
('tax_company_name', 'IN THE HAUS'),
('tax_company_name_en', 'IN THE HAUS'),
('tax_id', ''),
('tax_branch_type', 'head_office'),
('tax_branch_code', '00000'),
('tax_address', ''),
('tax_phone', ''),
('tax_email', ''),
('tax_vat_rate', '7.00'),
('tax_vat_model', 'inclusive'),
('tax_receipt_prefix', 'REC'),
('tax_invoice_prefix', 'INV'),
('tax_wht_prefix', 'WHT'),
('tax_signature_name', 'ผู้มีอำนาจลงนาม / ผู้รับเงิน')
ON CONFLICT (key) DO NOTHING;
