-- Migration: Create song requests table and register settings
CREATE TABLE IF NOT EXISTS public.song_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id text NOT NULL,
  track_name text NOT NULL,
  artist_name text NOT NULL,
  album_image text,
  track_duration_ms integer,
  requester_name text NOT NULL,
  message text,
  slip_url text NOT NULL, -- filename in slips storage bucket
  status text DEFAULT 'pending'::text NOT NULL, -- pending, playing, completed, rejected
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.song_requests ENABLE ROW LEVEL SECURITY;

-- 1. Policy for Customer: Anyone can insert song requests
CREATE POLICY "Allow public insert song_requests" ON public.song_requests
  FOR INSERT WITH CHECK (true);

-- 2. Policy for Queue: Anyone can view song requests
CREATE POLICY "Allow public select song_requests" ON public.song_requests
  FOR SELECT USING (true);

-- 3. Policy for Admin: Only admins/staff can update or delete requests
CREATE POLICY "Allow admin/staff all operations on song_requests" ON public.song_requests
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'staff')
    )
  );

-- Seed app_settings with placeholders for Spotify keys if not present
INSERT INTO public.app_settings (key, value)
VALUES 
  ('spotify_client_id', ''),
  ('spotify_client_secret', '')
ON CONFLICT (key) DO NOTHING;
