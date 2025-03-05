-- SQL to make Supabase Storage buckets publicly readable
-- Run this in the Supabase SQL Editor

-- UPLOADS BUCKET
-- Check if the uploads bucket exists
SELECT name FROM storage.buckets WHERE name = 'uploads';

-- Create the uploads bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'uploads', 'uploads', TRUE
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'uploads');

-- Update the uploads bucket to be public if it exists but isn't public
UPDATE storage.buckets SET public = TRUE WHERE name = 'uploads';

-- PROFILES BUCKET
-- Check if the profiles bucket exists
SELECT name FROM storage.buckets WHERE name = 'profiles';

-- Create the profiles bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'profiles', 'profiles', TRUE
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'profiles');

-- Update the profiles bucket to be public if it exists but isn't public
UPDATE storage.buckets SET public = TRUE WHERE name = 'profiles';

-- DROP EXISTING POLICIES
-- Drop any existing read policies for the buckets
DROP POLICY IF EXISTS "uploads_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "profiles_read_policy" ON storage.objects;

-- CREATE NEW POLICIES
-- Create a policy that allows public read access to the uploads bucket
CREATE POLICY "uploads_read_policy"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploads');

-- Create a policy that allows public read access to the profiles bucket
CREATE POLICY "profiles_read_policy"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- VERIFY CONFIGURATION
-- Verify the buckets are public
SELECT id, name, public FROM storage.buckets WHERE name IN ('uploads', 'profiles');

-- List all policies for the storage.objects table
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