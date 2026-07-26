-- Create index for performance on stock_transactions date queries
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_at 
ON public.stock_transactions(created_at);
