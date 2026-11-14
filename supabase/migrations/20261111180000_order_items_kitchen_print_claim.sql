-- ==============================================================================
-- Migration: Server-side kitchen/bar print tracking for order_items
-- Purpose : Stop duplicate kitchen & bar slips. "Already printed" used to live only in
--           each device's localStorage (qr_printed_items_<bookingId>), so a second POS
--           device, a reinstalled APK, a merged bill or an offline re-sync reprinted
--           everything. The database is now the single source of truth and a device
--           must atomically claim an item before printing it.
-- Run     : Outside service hours (the backfill touches every order_items row and each
--           row emits a realtime UPDATE event).
-- ==============================================================================

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS kitchen_printed_at       timestamptz,
    ADD COLUMN IF NOT EXISTS kitchen_print_claimed_at timestamptz,
    ADD COLUMN IF NOT EXISTS kitchen_print_claimed_by text;

-- Backfill: everything that already exists has been printed, except items of orders
-- still waiting for staff approval (status = 'pending'), which have not been printed yet.
UPDATE public.order_items oi
SET kitchen_printed_at = COALESCE(oi.created_at, now())
WHERE oi.kitchen_printed_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = oi.booking_id AND b.status = 'pending'
  );

-- Small partial index: only the handful of not-yet-printed rows.
CREATE INDEX IF NOT EXISTS idx_order_items_unprinted
ON public.order_items (booking_id)
WHERE kitchen_printed_at IS NULL;

-- 1. Atomically claim items for printing. Returns only the ids this device won.
--    A claim older than 45s with no confirmation is treated as abandoned (device crashed
--    or lost power mid-print) and can be taken over by another device.
CREATE OR REPLACE FUNCTION public.claim_order_items_for_print(p_item_ids bigint[], p_device text)
RETURNS SETOF bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.order_items
    SET kitchen_print_claimed_at = now(),
        kitchen_print_claimed_by = p_device
    WHERE id = ANY(p_item_ids)
      AND kitchen_printed_at IS NULL
      AND (
          kitchen_print_claimed_at IS NULL
          OR kitchen_print_claimed_at < now() - interval '45 seconds'
          OR kitchen_print_claimed_by IS NOT DISTINCT FROM p_device
      )
    RETURNING id;
$$;

-- 2. Mark items as printed (after a successful print, or for items the staff terminal
--    prints itself right after inserting them).
CREATE OR REPLACE FUNCTION public.mark_order_items_printed(p_item_ids bigint[], p_device text)
RETURNS SETOF bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.order_items
    SET kitchen_printed_at = now(),
        kitchen_print_claimed_at = COALESCE(kitchen_print_claimed_at, now()),
        kitchen_print_claimed_by = COALESCE(kitchen_print_claimed_by, p_device)
    WHERE id = ANY(p_item_ids)
      AND kitchen_printed_at IS NULL
    RETURNING id;
$$;

-- 3. Release a claim after a failed print so the next attempt (any device) can retry.
CREATE OR REPLACE FUNCTION public.release_order_items_print_claim(p_item_ids bigint[], p_device text)
RETURNS SETOF bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.order_items
    SET kitchen_print_claimed_at = NULL,
        kitchen_print_claimed_by = NULL
    WHERE id = ANY(p_item_ids)
      AND kitchen_printed_at IS NULL
      AND kitchen_print_claimed_by IS NOT DISTINCT FROM p_device
    RETURNING id;
$$;

GRANT EXECUTE ON FUNCTION public.claim_order_items_for_print(bigint[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_items_printed(bigint[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_items_print_claim(bigint[], text) TO anon, authenticated;
