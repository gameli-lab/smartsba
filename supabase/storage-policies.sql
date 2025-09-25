-- Storage configuration for school assets - REFERENCE DOCUMENT
-- 
-- ⚠️  IMPORTANT: Storage policies CANNOT be created via SQL migrations
-- due to permissions restrictions on the storage.objects table.
-- 
-- You must create these policies manually via the Supabase Dashboard.
-- See STORAGE_POLICIES_MANUAL_SETUP.md for step-by-step instructions.

-- Create the storage bucket (run this in Supabase Dashboard -> Storage)
-- Bucket name: school-assets
-- Public: FALSE (Private bucket)
-- File size limit: 2MB
-- Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

-- RLS Policies for school-assets bucket (CREATE VIA DASHBOARD)
-- 
-- SECURITY NOTE: All policies include path traversal protection:
-- 1. Reject paths containing '..' sequences
-- 2. Reject paths with '/./' sequences  
-- 3. Reject paths starting with './'
-- 4. Use anchored regex (^school_id/.+) for strict prefix matching
-- 5. Validate first path segment explicitly matches school_id
-- This prevents attacks like "../other_school/file.jpg"

-- 1. UPLOAD Policy: Allow authenticated users to upload files
-- Super admins can upload to any school folder
-- School admins can only upload to their own school folder
CREATE POLICY "school_assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'school-assets' AND
    (
      -- Super admin can upload anywhere
      (current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin') OR
      -- School admin can upload to their school folder only with strict path validation
      (
        current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'school_admin' AND
        -- Prevent path traversal attacks
        name !~ '\.\.' AND
        name !~ '/\./' AND
        name !~ '^\./' AND
        -- Strict prefix match: must start with school_id/ (anchored to beginning)
        name ~ ('^' || (current_setting('request.jwt.claims', true)::json ->> 'school_id') || '/.+') AND
        -- Additional validation: first path segment must exactly match school_id
        split_part(name, '/', 1) = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
      )
    ) AND
    -- Only allow image files
    (storage.extension(name) = ANY(ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif']))
  );

-- 2. SELECT Policy: Allow users to view files they have access to
-- Users can view files from their own school + super admins can view all
CREATE POLICY "school_assets_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'school-assets' AND
    (
      -- Super admin can view all files
      (current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin') OR
      -- School users can view files from their school with strict path validation
      (
        current_setting('request.jwt.claims', true)::json ->> 'school_id' IS NOT NULL AND
        -- Prevent path traversal attacks
        name !~ '\.\.' AND
        name !~ '/\./' AND
        name !~ '^\./' AND
        -- Strict prefix match: must start with school_id/ (anchored to beginning)
        name ~ ('^' || (current_setting('request.jwt.claims', true)::json ->> 'school_id') || '/.+') AND
        -- Additional validation: first path segment must exactly match school_id
        split_part(name, '/', 1) = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
      )
    )
  );

-- 3. UPDATE Policy: Allow users to update files they own
CREATE POLICY "school_assets_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'school-assets' AND
    (
      -- Super admin can update all files
      (current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin') OR
      -- School admin can update files from their school with strict path validation
      (
        current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'school_admin' AND
        -- Prevent path traversal attacks
        name !~ '\.\.' AND
        name !~ '/\./' AND
        name !~ '^\./' AND
        -- Strict prefix match: must start with school_id/ (anchored to beginning)
        name ~ ('^' || (current_setting('request.jwt.claims', true)::json ->> 'school_id') || '/.+') AND
        -- Additional validation: first path segment must exactly match school_id
        split_part(name, '/', 1) = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
      )
    )
  );

-- 4. DELETE Policy: Allow authorized deletion
CREATE POLICY "school_assets_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'school-assets' AND
    (
      -- Only super admin can delete files
      (current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin') OR
      -- School admin can delete files from their school with strict path validation
      (
        current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'school_admin' AND
        -- Prevent path traversal attacks
        name !~ '\.\.' AND
        name !~ '/\./' AND
        name !~ '^\./' AND
        -- Strict prefix match: must start with school_id/ (anchored to beginning)
        name ~ ('^' || (current_setting('request.jwt.claims', true)::json ->> 'school_id') || '/.+') AND
        -- Additional validation: first path segment must exactly match school_id
        split_part(name, '/', 1) = (current_setting('request.jwt.claims', true)::json ->> 'school_id')
      )
    )
  );

-- ⚠️  NOTE: The helper function below has been moved to migration 008_storage_helper_functions.sql
-- Run that migration to create the function. This is kept here for reference only.

-- Helper function to get signed URLs for private assets (FOR REFERENCE - USE MIGRATION 008)
CREATE OR REPLACE FUNCTION get_school_asset_url(file_path TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  school_id_from_path TEXT;
  user_school_id TEXT;
  user_role TEXT;
BEGIN
  -- Extract school ID from file path (assumes format: school_id/file_name)
  school_id_from_path := split_part(file_path, '/', 1);
  
  -- Get user's school and role from JWT
  user_school_id := auth.jwt() ->> 'school_id';
  user_role := auth.jwt() ->> 'app_role';
  
  -- Check access permissions
  IF user_role = 'super_admin' OR user_school_id = school_id_from_path THEN
    -- Return the file path for signed URL generation
    RETURN file_path;
  ELSE
    -- No access
    RETURN NULL;
  END IF;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_storage_objects_school_path 
ON storage.objects(name) 
WHERE bucket_id = 'school-assets';

-- Add comments for documentation
COMMENT ON FUNCTION get_school_asset_url(TEXT) IS 'Returns file path for authorized users to generate signed URLs for school assets';
