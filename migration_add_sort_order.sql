-- Run this in your Supabase SQL Editor

ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 9999,
ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT FALSE;
