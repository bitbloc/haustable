-- ==============================================================================
-- URGENT — Lock the destructive functions that anyone can call today
--
-- APPLIED to production on 2026-11-11 via the Supabase SQL Editor (owner approved).
-- Verified after running: the public key gets "42501 permission denied" on
-- get_system_record_counts; POS staff list, bookings and menu reads still work.
-- Found by 00_diagnose_current_rls.sql on 2026-11-11:
--   * delete_user_by_admin(uuid)  — deletes any profile + auth user. No permission check.
--   * purge_system_data(...)      — deletes bookings, order items, shifts, tax invoices,
--                                   expenses. Guarded only by a passcode that is written in
--                                   the public web bundle (DataPurgePanel.jsx).
--   * get_system_record_counts()  — row counts of every table.
-- All three are SECURITY DEFINER and executable by the public `anon` role, i.e. by anyone
-- who has the public key that ships in the website and the APK.
--
-- Impact on the shop: none. The POS and the customer pages never call these functions.
-- Only two back-office screens do (Members -> delete user, Settings -> Data purge), and
-- those are used by a logged-in owner/admin, which keeps working.
-- Safe to run while the shop is open. Rollback: 01a_URGENT_ROLLBACK.sql
--
-- How: the original function is renamed to *_impl and closed to everyone; a new function
-- with the original name checks is_admin() and then calls it. The function bodies are
-- not rewritten, so their behaviour for an admin is unchanged.
-- ==============================================================================

BEGIN;

-- ---- delete_user_by_admin ----------------------------------------------------
ALTER FUNCTION public.delete_user_by_admin(uuid) RENAME TO delete_user_by_admin_impl;
REVOKE ALL ON FUNCTION public.delete_user_by_admin_impl(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.delete_user_by_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Not authorized: owner/admin login required' USING ERRCODE = '42501';
    END IF;
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'You cannot delete your own account';
    END IF;
    PERFORM public.delete_user_by_admin_impl(target_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_user_by_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO authenticated, service_role;

-- ---- purge_system_data -------------------------------------------------------
ALTER FUNCTION public.purge_system_data(text, text, boolean) RENAME TO purge_system_data_impl;
REVOKE ALL ON FUNCTION public.purge_system_data_impl(text, text, boolean) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.purge_system_data(
    p_category text,
    p_passcode text,
    p_reset_stock_qty boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Not authorized: owner/admin login required' USING ERRCODE = '42501';
    END IF;
    RETURN public.purge_system_data_impl(p_category, p_passcode, p_reset_stock_qty);
END;
$$;
REVOKE ALL ON FUNCTION public.purge_system_data(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_system_data(text, text, boolean) TO authenticated, service_role;

-- ---- get_system_record_counts (read-only, but not for the public) -------------
REVOKE ALL ON FUNCTION public.get_system_record_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_system_record_counts() TO authenticated, service_role;

COMMIT;

-- ==============================================================================
-- CHECK RIGHT AFTER RUNNING
-- ==============================================================================
-- Expect: false, false, false
--   SELECT has_function_privilege('anon', 'public.delete_user_by_admin(uuid)', 'EXECUTE'),
--          has_function_privilege('anon', 'public.purge_system_data(text, text, boolean)', 'EXECUTE'),
--          has_function_privilege('anon', 'public.get_system_record_counts()', 'EXECUTE');
--
-- In the back office, logged in as owner: Settings -> Data purge panel still shows the
-- record counts. (Do NOT run a purge to test.)
