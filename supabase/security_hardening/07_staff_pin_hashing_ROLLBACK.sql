-- ==============================================================================
-- ROLLBACK for supabase/migrations/20261117130000_staff_pin_hashing.sql
-- Puts the plaintext PINs back into profiles.pin from staff_pin_legacy_backup, recreates
-- verify_staff_pin_login and get_staff_offline_pin_hashes exactly as they were live on
-- 2026-11-17 (pg_get_functiondef, read-only), and drops the new functions and
-- staff_pin_credentials. staff_pin_legacy_backup is KEPT (no data is deleted).
--
-- Know before running: a PIN set or cleared through admin_set_staff_pin after the
-- migration exists only as a bcrypt hash and cannot be put back. Those staff get the PIN
-- they had at migration time (or none, if they had none), and the old frontend must be
-- deployed again with this rollback.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Plaintext PINs back (auto-link trigger off for this statement, as in the migration)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles DISABLE TRIGGER trg_auto_link_profile_bookings;
UPDATE public.profiles p
SET pin = b.pin
FROM public.staff_pin_legacy_backup b
WHERE b.profile_id = p.id
  AND p.pin IS DISTINCT FROM b.pin;
ALTER TABLE public.profiles ENABLE TRIGGER trg_auto_link_profile_bookings;

-- ------------------------------------------------------------------------------
-- 2. Old functions, verbatim
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_staff_pin_login(p_pin text)
 RETURNS TABLE(id uuid, display_name text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT p.id, p.display_name, p.role
    FROM public.profiles p
    WHERE p.pin = p_pin
      AND (
        p.role IN ('staff', 'cashier', 'kitchen', 'manager', 'owner', 'admin', 'custom')
        OR (p.admin_permissions IS NOT NULL AND cardinality(p.admin_permissions) > 0)
      )
    LIMIT 1;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin_login(text) TO PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_staff_offline_pin_hashes()
 RETURNS TABLE(id uuid, display_name text, role text, pin_hash text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;
GRANT EXECUTE ON FUNCTION public.get_staff_offline_pin_hashes() TO PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. New objects out (the backup table stays)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_set_staff_pin(uuid, text);
DROP FUNCTION IF EXISTS public.admin_staff_pin_status();
DROP TABLE IF EXISTS public.staff_pin_credentials;

COMMIT;
