-- ==============================================================================
-- Migration: Create Slips Storage Bucket & Public Upload Policies
-- Purpose: Enable public / guest table booking and payment slip uploads without RLS violations
-- Date: 2026-09-12
-- ==============================================================================

-- 1. Create or ensure 'slips' bucket is public with generous size limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'slips', 
    'slips', 
    true, 
    20971520, -- 20MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf'];

-- 2. Storage Policies for 'slips' bucket (Public view and guest upload)
DROP POLICY IF EXISTS "Public View Access for Slips" ON storage.objects;
CREATE POLICY "Public View Access for Slips" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'slips');

DROP POLICY IF EXISTS "Allow All Insert into Slips" ON storage.objects;
CREATE POLICY "Allow All Insert into Slips" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'slips');

DROP POLICY IF EXISTS "Allow All Update in Slips" ON storage.objects;
CREATE POLICY "Allow All Update in Slips" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'slips');

DROP POLICY IF EXISTS "Allow All Delete in Slips" ON storage.objects;
CREATE POLICY "Allow All Delete in Slips" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'slips');
