-- ==============================================================================
-- Migration: Allow public & guest insert/update on leaderboard
-- Purpose: Allow all players (both guests and authenticated members) to record high scores
-- Date: 2026-09-11
-- ==============================================================================

-- 1. Ensure RLS is active on leaderboard
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow authenticated insert to leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Allow authenticated update to leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Allow public insert to leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Allow public update to leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Allow public read access to leaderboard" ON public.leaderboard;

-- 3. Everyone can read top scores
CREATE POLICY "Allow public read access to leaderboard" ON public.leaderboard
    FOR SELECT USING (true);

-- 4. Allow all users (anon & authenticated) to insert scores to the leaderboard
CREATE POLICY "Allow public insert to leaderboard" ON public.leaderboard
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- 5. Allow users (anon & authenticated) to update scores
CREATE POLICY "Allow public update to leaderboard" ON public.leaderboard
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Grant permissions
GRANT ALL ON public.leaderboard TO anon, authenticated, service_role;
