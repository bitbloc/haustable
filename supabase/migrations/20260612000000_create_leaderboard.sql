-- Create leaderboard table to store retro game high scores
CREATE TABLE IF NOT EXISTS public.leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- 1. Everyone can read the leaderboard (to show top scores)
CREATE POLICY "Allow public read access to leaderboard" ON public.leaderboard
    FOR SELECT USING (true);

-- 2. Authenticated users can insert their own scores
CREATE POLICY "Allow authenticated insert to leaderboard" ON public.leaderboard
    FOR INSERT WITH CHECK (
        auth.uid() = profile_id
    );

-- Create index for quick sorting of high scores (descending)
CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON public.leaderboard (score DESC);
