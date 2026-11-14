-- ==============================================================================
-- STEP 0 — READ-ONLY DIAGNOSTIC (safe to run any time, changes nothing)
-- Run each query in the Supabase SQL Editor and save the results (Export CSV).
-- The saved output is the reference for what the live policies looked like BEFORE
-- any hardening, and is what a manual rollback would restore.
-- ==============================================================================

-- 1. Which public tables have Row Level Security switched on
SELECT c.relname                AS table_name,
       c.relrowsecurity         AS rls_enabled,
       c.relforcerowsecurity    AS rls_forced,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;

-- 2. Every policy as it exists right now
SELECT tablename, policyname, permissive, roles, cmd, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. What the public (anon) role is granted on each table
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS anon_privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
GROUP BY table_name
ORDER BY table_name;

-- 4. Functions the public (anon) role may call, and whether they bypass RLS
SELECT p.proname AS function_name,
       p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY anon_can_execute DESC, p.proname;
