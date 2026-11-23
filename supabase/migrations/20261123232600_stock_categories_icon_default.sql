-- Fix stock_categories.icon so creating or editing categories without an icon succeeds
-- (Brand v2 Zero-Icon UI: CategoryManager no longer asks staff to pick an emoji icon)
ALTER TABLE public.stock_categories
    ALTER COLUMN icon SET DEFAULT '',
    ALTER COLUMN icon DROP NOT NULL;
