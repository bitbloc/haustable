-- Migration: Create Receipts Storage Bucket & Policies
-- Date: 2026-08-16
-- Description: Creates a storage bucket for storing receipt/bill images uploaded via LINE webhook or Admin Tax Hub.

-- 1. Create the storage bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts', 
    'receipts', 
    true, 
    20971520, -- 20MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf'];

-- 2. Storage Policies
DROP POLICY IF EXISTS "Public View Access for Receipts" ON storage.objects;
CREATE POLICY "Public View Access for Receipts" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Allow All Insert into Receipts" ON storage.objects;
CREATE POLICY "Allow All Insert into Receipts" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Allow All Update in Receipts" ON storage.objects;
CREATE POLICY "Allow All Update in Receipts" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Allow All Delete in Receipts" ON storage.objects;
CREATE POLICY "Allow All Delete in Receipts" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'receipts');
