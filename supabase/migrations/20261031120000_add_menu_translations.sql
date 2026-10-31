-- Migration: English and Chinese display names for the customer QR menu
-- Description:
-- Adds optional translated columns. Additive only: existing `name` / `description` stay the
-- source of truth for POS, kitchen slips and receipts. Customer pages fall back to `name`
-- when a translation is empty. Existing RLS policies on these tables cover the new columns.

ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS name_en TEXT,
ADD COLUMN IF NOT EXISTS name_zh TEXT,
ADD COLUMN IF NOT EXISTS description_en TEXT,
ADD COLUMN IF NOT EXISTS description_zh TEXT;

ALTER TABLE public.menu_categories
ADD COLUMN IF NOT EXISTS name_en TEXT,
ADD COLUMN IF NOT EXISTS name_zh TEXT;

ALTER TABLE public.option_groups
ADD COLUMN IF NOT EXISTS name_en TEXT,
ADD COLUMN IF NOT EXISTS name_zh TEXT;

ALTER TABLE public.option_choices
ADD COLUMN IF NOT EXISTS name_en TEXT,
ADD COLUMN IF NOT EXISTS name_zh TEXT;
