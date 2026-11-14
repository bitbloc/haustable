-- ==============================================================================
-- ROLLBACK for 01a_URGENT_lock_destructive_functions.sql
-- Restores the original functions and their original (open) permissions.
-- Only use if a back-office screen stops working after 01a.
-- ==============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.delete_user_by_admin(uuid);
ALTER FUNCTION public.delete_user_by_admin_impl(uuid) RENAME TO delete_user_by_admin;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.purge_system_data(text, text, boolean);
ALTER FUNCTION public.purge_system_data_impl(text, text, boolean) RENAME TO purge_system_data;
GRANT EXECUTE ON FUNCTION public.purge_system_data(text, text, boolean) TO PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_system_record_counts() TO PUBLIC, anon, authenticated, service_role;

COMMIT;
