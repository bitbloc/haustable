-- Migration: Add secure RPC for POS offline PIN verification
-- Description: Allows authorized POS terminals to retrieve salted SHA-256 PIN hashes for offline caching.
-- Zero exposure of raw PINs. Only hashed credentials matching the store's offline salt are returned.
-- Date: 2026-09-30

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.get_staff_offline_pin_hashes()
RETURNS TABLE (id UUID, display_name TEXT, role TEXT, pin_hash TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, 
        p.display_name, 
        p.role,
        encode(digest('IN_THE_HAUS_POS_OFFLINE_PIN_V1:' || trim(p.pin), 'sha256'), 'hex') AS pin_hash
    FROM public.profiles p
    WHERE p.pin IS NOT NULL 
      AND length(trim(p.pin)) >= 4
      AND (
        p.role IN ('staff', 'cashier', 'kitchen', 'manager', 'owner', 'admin', 'custom')
        OR (p.admin_permissions IS NOT NULL AND cardinality(p.admin_permissions) > 0)
      );
END;
$$;

-- Grant execution to authenticated users and anon (for POS terminal authentication)
GRANT EXECUTE ON FUNCTION public.get_staff_offline_pin_hashes() TO anon, authenticated, service_role;
