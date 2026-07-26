-- Fix Foreign Key Constraint for Booking Deletion
-- The error "update or delete on table ... violates foreign key constraint" means we can't delete a booking if it has items.
-- We must change the constraint to ON DELETE CASCADE so items are deleted automatically with the booking.

ALTER TABLE order_items
DROP CONSTRAINT IF EXISTS "order_items_booking_id_fkey";

ALTER TABLE order_items
ADD CONSTRAINT "order_items_booking_id_fkey"
FOREIGN KEY (booking_id) REFERENCES bookings(id)
ON DELETE CASCADE;
