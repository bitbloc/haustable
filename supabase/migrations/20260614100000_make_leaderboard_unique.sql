-- Migration: Make leaderboard score unique per user profile and keep the highest score

-- 1. Clean up duplicate scores, keeping only the highest score for each profile_id
DELETE FROM public.leaderboard
WHERE id NOT IN (
    SELECT DISTINCT ON (profile_id) id
    FROM public.leaderboard
    ORDER BY profile_id, score DESC, created_at DESC, id DESC
);

-- 2. Add a unique constraint on profile_id to prevent future duplicate rows
ALTER TABLE public.leaderboard
ADD CONSTRAINT leaderboard_profile_id_key UNIQUE (profile_id);

-- 3. Add Row Level Security (RLS) policy to allow authenticated users to update their own leaderboard score
CREATE POLICY "Allow authenticated update to leaderboard" ON public.leaderboard
    FOR UPDATE USING (
        auth.uid() = profile_id
    ) WITH CHECK (
        auth.uid() = profile_id
    );
