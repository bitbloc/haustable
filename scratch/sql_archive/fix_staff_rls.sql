-- Fix Staff View Access
-- The Staff View uses client-side PIN auth without a real Supabase User (anon role).
-- We need to allow 'anon' to read/write bookings and order_items.

-- 1. Bookings Table
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view bookings" ON bookings;
CREATE POLICY "Public can view bookings"
ON bookings FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can update bookings" ON bookings;
CREATE POLICY "Public can update bookings"
ON bookings FOR UPDATE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can insert bookings" ON bookings;
CREATE POLICY "Public can insert bookings"
ON bookings FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2. Order Items Table
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view order items" ON order_items;
CREATE POLICY "Public can view order items"
ON order_items FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can update order items" ON order_items;
CREATE POLICY "Public can update order items"
ON order_items FOR UPDATE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can insert order items" ON order_items;
CREATE POLICY "Public can insert order items"
ON order_items FOR INSERT
TO anon, authenticated
WITH CHECK (true);
