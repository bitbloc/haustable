-- Drop the existing foreign key constraint on bookings
ALTER TABLE public.bookings 
DROP CONSTRAINT IF EXISTS bookings_promotion_code_id_fkey;

-- Add the foreign key constraint back with ON DELETE SET NULL
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_promotion_code_id_fkey 
FOREIGN KEY (promotion_code_id) 
REFERENCES public.promotion_codes(id) 
ON DELETE SET NULL;
