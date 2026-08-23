-- Migration: Enhance Tax Invoices Table for Void Tracking and Digital Signature
-- Date: 2026-08-22
-- Description: Adds missing columns for cancellation timestamp, digital signatures, and customer email; updates RLS policies.

-- 1. Ensure columns exist on tax_invoices
ALTER TABLE public.tax_invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.tax_invoices ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.tax_invoices ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE public.tax_invoices ADD COLUMN IF NOT EXISTS signature_name TEXT;
ALTER TABLE public.tax_invoices ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- 2. Update / Re-create RLS Policy for tax_invoices to permit staff & public operations
DROP POLICY IF EXISTS "Allow authenticated full access to tax_invoices" ON public.tax_invoices;
DROP POLICY IF EXISTS "Allow all access to tax_invoices" ON public.tax_invoices;

CREATE POLICY "Allow all access to tax_invoices" 
ON public.tax_invoices FOR ALL 
USING (true) 
WITH CHECK (true);

-- 3. Ensure app_settings has default keys for signature if needed
INSERT INTO public.app_settings (key, value) VALUES 
('tax_signature_name', 'ผู้มีอำนาจลงนาม / ผู้รับเงิน'),
('tax_signature_position', 'ผู้จัดการร้าน'),
('tax_signature_image', ''),
('tax_signature_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
