-- ==========================================
-- CREATE HAUS_CHECKINS TABLE FOR SUPABASE
-- ==========================================

-- 1. Create the check-ins table
CREATE TABLE IF NOT EXISTS public.haus_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  source TEXT NOT NULL, -- 'instagram', 'facebook', 'google'
  user_name TEXT NOT NULL, -- e.g., 'Pimchaya T.'
  user_handle TEXT, -- e.g., '@pim.pimp' or 'Local Guide'
  user_avatar TEXT, -- Profile image URL
  text TEXT NOT NULL, -- Caption/review text
  rating INTEGER, -- Star rating 1-5 (Google Reviews)
  location TEXT DEFAULT 'IN THE HAUS ในบ้าน นครพนม',
  image_url TEXT NOT NULL, -- Image asset URL
  post_url TEXT, -- Direct link to the social post
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true -- Show/hide toggle
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.haus_checkins ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Policy A: Everyone (even unauthenticated guests) can read/view active check-ins
CREATE POLICY "Allow public read access" ON public.haus_checkins
  FOR SELECT
  USING (true);

-- Policy B: Authenticated admin users can perform all operations (insert, update, delete)
CREATE POLICY "Allow admin full access" ON public.haus_checkins
  FOR ALL
  USING (auth.role() = 'authenticated');

-- ==========================================
-- 4. CREATE SECURE PUBLIC LIKES RPC FUNCTION
-- ==========================================
-- This allows unauthenticated page visitors to like/unlike check-ins securely.
-- Since it uses SECURITY DEFINER, it bypasses RLS to update ONLY the likes count,
-- protecting the other fields (like user_name, text, is_visible) from public edits.
CREATE OR REPLACE FUNCTION public.toggle_checkin_likes(checkin_id UUID, increment_by INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_likes INTEGER;
BEGIN
  UPDATE public.haus_checkins
  SET likes = GREATEST(0, COALESCE(likes, 0) + increment_by)
  WHERE id = checkin_id
  RETURNING likes INTO new_likes;
  
  RETURN new_likes;
END;
$$;
