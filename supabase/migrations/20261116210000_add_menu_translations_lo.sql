-- Migration: Lao display names for the customer QR menu and the /link landing page
-- Description:
-- Adds optional Lao columns next to the English and Chinese ones from
-- 20261031120000_add_menu_translations.sql. Additive only: `name` / `description` stay the
-- source of truth for POS, kitchen slips and receipts. Customer pages fall back to English,
-- then Thai, when a translation is empty. Existing RLS policies cover the new columns.

ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS name_lo TEXT,
ADD COLUMN IF NOT EXISTS description_lo TEXT;

ALTER TABLE public.menu_categories
ADD COLUMN IF NOT EXISTS name_lo TEXT;

ALTER TABLE public.option_groups
ADD COLUMN IF NOT EXISTS name_lo TEXT;

ALTER TABLE public.option_choices
ADD COLUMN IF NOT EXISTS name_lo TEXT;
