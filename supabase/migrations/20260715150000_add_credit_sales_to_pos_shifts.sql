-- Add credit_sales column to pos_shifts table
ALTER TABLE public.pos_shifts ADD COLUMN IF NOT EXISTS credit_sales NUMERIC DEFAULT 0;
