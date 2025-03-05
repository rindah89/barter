-- SQL to make the uploads bucket publicly readable
-- Run this in the Supabase SQL Editor

-- Check if the uploads bucket exists
SELECT name FROM storage.buckets WHERE name = 'uploads';

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'uploads', 'uploads', TRUE
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'uploads');

-- Update the bucket to be public if it exists but isn't public
UPDATE storage.buckets SET public = TRUE WHERE name = 'uploads';

-- Drop any existing read policy for the uploads bucket
DROP POLICY IF EXISTS "uploads_read_policy" ON storage.objects;

-- Create a new policy that allows public read access to the uploads bucket
CREATE POLICY "uploads_read_policy"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploads');

-- Verify the bucket is public
SELECT id, name, public FROM storage.buckets WHERE name = 'uploads';

-- List policies for the storage.objects table
SELECT
    policyname AS policy_name,
    tablename,
    permissive,
    roles,
    cmd AS operation,
    qual AS using_expression,
    with_check AS with_check_expression
FROM
    pg_policies
WHERE
    schemaname = 'storage' AND tablename = 'objects'; 