-- Create stock_categories table
CREATE TABLE IF NOT EXISTS public.stock_categories (
    id TEXT PRIMARY KEY, -- slug, e.g. 'veg', 'meat'
    label TEXT NOT NULL,
    icon TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write for authenticated users" 
ON public.stock_categories FOR ALL 
USING (auth.role() = 'authenticated');

-- Insert Defaults
INSERT INTO public.stock_categories (id, label, icon, sort_order) VALUES
('restock', 'ต้องเติม (Restock)', '⚠️', 0),
('veg', 'ผัก (Veg)', '🥬', 10),
('meat', 'เนื้อสัตว์ (Meat)', '🥩', 20),
('dry', 'ของแห้ง (Dry)', '🥫', 30),
('sauce', 'เครื่องปรุง (Sauce)', '🧂', 40),
('other', 'อื่นๆ (Other)', '📦', 50)
ON CONFLICT (id) DO NOTHING;

-- Optional: Add specific permissions if needed, but 'authenticated' covers staff.
