-- Enable DELETE access for bookings
-- NOTE: This allows public/anon users to DELETE bookings.
-- Security is handled by the Client-Side PIN check in the application.

-- 1. Bookings Deletion
DROP POLICY IF EXISTS "Public can delete bookings" ON bookings;
CREATE POLICY "Public can delete bookings"
ON bookings FOR DELETE
TO anon, authenticated
USING (true);

-- 2. Order Items Deletion (Usually handled by CASCADE, but good to have)
DROP POLICY IF EXISTS "Public can delete order_items" ON order_items;
CREATE POLICY "Public can delete order_items"
ON order_items FOR DELETE
TO anon, authenticated
USING (true);
