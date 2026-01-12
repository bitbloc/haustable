-- Database Performance Optimization Indexes
-- Enable Pro Plan Monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 1. Bookings: Frequently filtered by status and date range in Dashboards
-- Used in: StaffDashboard.jsx, AdminBookings.jsx
CREATE INDEX IF NOT EXISTS idx_bookings_status_date 
ON public.bookings (status, booking_time);

-- 2. Stock Items: Barcode scanning (needs to be instant)
-- Used in: StockPage.jsx, StockItemForm.jsx
-- Note: 'barcode' column was defined as UNIQUE in create_stock_system.sql, which implicitly creates an index. 
-- However, if we need case-insensitive search or partial matches later, a separate index might be needed. 
-- For now, the UNIQUE constraint index is sufficient for exact matches.
-- We add an index for low stock calculation:
CREATE INDEX IF NOT EXISTS idx_stock_items_quantity_threshold
ON public.stock_items (current_quantity) 
WHERE current_quantity <= min_stock_threshold;

-- 3. Order Items: Heavy joins with Orders and Menu Items
-- Used in: AdminSteakDashboard.jsx
CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON public.order_items (booking_id);

CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id 
ON public.order_items (menu_item_id);

-- 4. Menu Items: Sorting and Categorization
-- Used in: Menu lists
CREATE INDEX IF NOT EXISTS idx_menu_items_category_sort
ON public.menu_items (category, sort_order);

-- 5. Profiles: Role checks (StaffAuthLayout)
-- 'id' is Primary Key (Indexed), but we often select 'role'.
-- If table is huge, a covering index might help, but for < 100 users, PK is fine.

-- 6. Stock Transactions: History Logs
-- Used in: TransactionHistory.jsx
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_at
ON public.stock_transactions (created_at DESC);
