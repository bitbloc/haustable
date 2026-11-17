-- ==============================================================================
-- Phase A3 — staff PINs out of public reach
-- Design: docs/security-hardening-plan.md section 4. Inventory: docs/security-audit.md.
--
-- NOT APPLIED to production. Verified on a local copy of the production schema with
-- scripts/verify-rls.mjs. Apply after closing time, then deploy the frontend straight away
-- (src/AdminMembers.jsx, src/utils/staffAuthHelper.js), e.g.
--   npx supabase db query --remote -f supabase/migrations/20261117130000_staff_pin_hashing.sql
-- Never `supabase db push` (remote migration history is untracked).
-- Rollback: supabase/security_hardening/07_staff_pin_hashing_ROLLBACK.sql
--
-- Why not a pin_hash column on profiles: a 4-digit PIN has 10,000 values, so any hash an
-- attacker can read is as good as the PIN. profiles is publicly readable. The bcrypt
-- hashes live in staff_pin_credentials, which neither anon nor authenticated can select.
--
-- What it does
--   1. staff_pin_credentials (profile_id -> bcrypt hash). RLS on, no policies, no grants.
--   2. staff_pin_legacy_backup (plaintext copy for the rollback only). Locked the same way.
--      The owner drops it once the new login has run for a week.
--   3. Copies profiles.pin into both tables, then sets profiles.pin to NULL. The column
--      stays (guard_profile_privileged_columns and old clients still name it).
--      Triggers on that UPDATE (live catalog, 2026-11-17):
--        guard_profile_privileged_columns_upd  BEFORE, SECURITY INVOKER: returns NEW
--            unchanged when current_user is not anon/authenticated (this file runs as
--            postgres), so it neither raises nor rewrites anything.
--        trg_auto_link_profile_bookings        AFTER, SECURITY DEFINER: would re-link
--            unlinked bookings to the profile by phone number on every profile UPDATE.
--            That is a side effect unrelated to PINs, so it is disabled for this one
--            statement only and enabled again inside the same transaction.
--      profiles has no updated_at trigger and is not in the realtime publication.
--   4. verify_staff_pin_login(p_pin): same name and return type, so the POS login code is
--      unchanged. Anything that is not 4-8 digits returns no row (the POS shows "wrong
--      PIN", it does not fall back to offline mode). Same staff-role predicate as before.
--   5. admin_set_staff_pin(p_profile_id, p_pin): owner/admin only (42501). Empty/NULL PIN
--      removes the credential; otherwise 4-8 digits, unique across staff (23505
--      'PIN already in use', because login is by PIN alone).
--   6. admin_staff_pin_status(): which profiles have a PIN (no hash), owner/admin only.
--   7. get_staff_offline_pin_hashes() is dropped. Offline login stays (decision D1): the
--      POS caches a credential on the device at each successful online login.
--
-- Cost: verify_staff_pin_login checks every stored hash with bcrypt (cost 10); with the
-- 8 PINs live today a login takes a few hundred milliseconds of database time.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Credentials
-- ------------------------------------------------------------------------------
CREATE TABLE public.staff_pin_credentials (
    profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    pin_hash text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid
);
ALTER TABLE public.staff_pin_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_pin_credentials FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Legacy backup (kept by the rollback, so it may already exist on a re-apply)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_pin_legacy_backup (
    profile_id uuid PRIMARY KEY,
    pin text NOT NULL,
    backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_pin_legacy_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_pin_legacy_backup FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Move the PINs
-- ------------------------------------------------------------------------------
INSERT INTO public.staff_pin_legacy_backup (profile_id, pin)
SELECT p.id, p.pin
FROM public.profiles p
WHERE p.pin IS NOT NULL
ON CONFLICT (profile_id) DO UPDATE
    SET pin = EXCLUDED.pin,
        backed_up_at = now();

INSERT INTO public.staff_pin_credentials (profile_id, pin_hash)
SELECT p.id, extensions.crypt(btrim(p.pin), extensions.gen_salt('bf', 10))
FROM public.profiles p
WHERE nullif(btrim(p.pin), '') IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.profiles'::regclass
          AND tgname = 'trg_auto_link_profile_bookings'
          AND tgenabled = 'O'
    ) THEN
        RAISE EXCEPTION 'trg_auto_link_profile_bookings is not in the expected state; stop and re-check the triggers on profiles';
    END IF;
END $$;

ALTER TABLE public.profiles DISABLE TRIGGER trg_auto_link_profile_bookings;
UPDATE public.profiles SET pin = NULL WHERE pin IS NOT NULL;
ALTER TABLE public.profiles ENABLE TRIGGER trg_auto_link_profile_bookings;

-- ------------------------------------------------------------------------------
-- 4. Login by PIN (same signature as before)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_staff_pin_login(p_pin text)
RETURNS TABLE(id uuid, display_name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,8}$' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT p.id, p.display_name, p.role
    FROM public.staff_pin_credentials c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE c.pin_hash = crypt(p_pin, c.pin_hash)
      AND (
        p.role IN ('staff', 'cashier', 'kitchen', 'manager', 'owner', 'admin', 'custom')
        OR (p.admin_permissions IS NOT NULL AND cardinality(p.admin_permissions) > 0)
      )
    LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_staff_pin_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin_login(text) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. Set, change or clear a PIN (back office)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_staff_pin(p_profile_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_pin text := nullif(btrim(coalesce(p_pin, '')), '');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'only an owner or admin can set staff PINs' USING ERRCODE = '42501';
    END IF;

    IF v_pin IS NULL THEN
        DELETE FROM public.staff_pin_credentials WHERE profile_id = p_profile_id;
        RETURN;
    END IF;

    IF v_pin !~ '^[0-9]{4,8}$' THEN
        RAISE EXCEPTION 'PIN must be 4 to 8 digits' USING ERRCODE = '22023';
    END IF;

    -- One PIN change at a time, so two admins cannot hand out the same PIN at once
    PERFORM pg_advisory_xact_lock(hashtext('public.admin_set_staff_pin'));

    IF EXISTS (
        SELECT 1 FROM public.staff_pin_credentials c
        WHERE c.profile_id <> p_profile_id
          AND c.pin_hash = crypt(v_pin, c.pin_hash)
    ) THEN
        RAISE EXCEPTION 'PIN already in use' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.staff_pin_credentials (profile_id, pin_hash, updated_at, updated_by)
    VALUES (p_profile_id, crypt(v_pin, gen_salt('bf', 10)), now(), auth.uid())
    ON CONFLICT (profile_id) DO UPDATE
        SET pin_hash = EXCLUDED.pin_hash,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_staff_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_staff_pin(uuid, text) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. Who has a PIN (no hash leaves the database)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_staff_pin_status()
RETURNS TABLE(profile_id uuid, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT c.profile_id, c.updated_at
    FROM public.staff_pin_credentials c
    WHERE public.is_admin();
$$;
REVOKE ALL ON FUNCTION public.admin_staff_pin_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_staff_pin_status() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. No more hashes for anyone who asks
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_staff_offline_pin_hashes();

COMMIT;

-- ==============================================================================
-- CHECK RIGHT AFTER RUNNING
--   SELECT count(*) FROM public.profiles WHERE pin IS NOT NULL;          -- expect 0
--   SELECT count(*) FROM public.staff_pin_credentials;                   -- expect 8 today
--   SELECT count(*) FROM public.staff_pin_legacy_backup;                 -- expect 8 today
--   SET ROLE anon; SELECT * FROM public.staff_pin_credentials;           -- expect permission denied
--   RESET ROLE;
-- THEN: each staff member logs in once on each POS terminal while online (this refreshes
-- the device's offline credential), and the owner sets a PIN in Members to confirm.
-- ==============================================================================
