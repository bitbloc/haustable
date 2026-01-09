-- Create stock_items table
CREATE TABLE IF NOT EXISTS public.stock_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'veg', 'meat', 'dry', 'sauce', etc.
    image_url TEXT,
    
    -- Quantity Management
    current_quantity FLOAT DEFAULT 0,
    unit TEXT NOT NULL, -- Primary display unit (e.g., 'kg', 'bottle')
    base_unit TEXT,     -- Smallest unit for calculation (e.g., 'g', 'ml')
    
    -- Conversion Logic
    unit_config JSONB DEFAULT '{}'::jsonb, 
    -- Example: { "carton": {"factor": 12, "unit": "bottle"}, "bottle": {"factor": 1, "unit": "bottle"} }
    
    -- Sorting & Identification
    barcode TEXT UNIQUE,
    display_order INTEGER DEFAULT 0, -- For Shelf-to-Sheet sorting
    
    -- Stock Levels (for alerting)
    min_stock_threshold FLOAT DEFAULT 0, -- Critical (Red)
    reorder_point FLOAT DEFAULT 0,       -- Warning (Orange)
    par_level FLOAT DEFAULT 0,           -- Full/Safe (White/Green)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for stock_items
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- Create policy for stock_items (Allow all authenticated staff to view and edit for now)
CREATE POLICY "Enable read/write for authenticated users" 
ON public.stock_items FOR ALL 
USING (auth.role() = 'authenticated');


-- Create stock_transactions table
CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE CASCADE,
    
    transaction_type TEXT NOT NULL, -- 'in', 'out', 'audit', 'set'
    quantity_change FLOAT NOT NULL,
    
    -- Metadata
    performed_by TEXT, -- Basic staff identifier or name
    note TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for stock_transactions
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for stock_transactions
CREATE POLICY "Enable read/write for authenticated users" 
ON public.stock_transactions FOR ALL 
USING (auth.role() = 'authenticated');

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON public.stock_items(category);
CREATE INDEX IF NOT EXISTS idx_stock_items_barcode ON public.stock_items(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_item_id ON public.stock_transactions(stock_item_id);
