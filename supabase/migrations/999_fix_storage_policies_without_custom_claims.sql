-- Fix storage policies to work without custom JWT claims
-- Instead of relying on app_role and school_id in JWT, query user_profiles directly

-- Drop existing policies
DROP POLICY IF EXISTS "school_assets_upload" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_select" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_delete" ON storage.objects;

-- 1. UPLOAD Policy: Allow authenticated users to upload files
CREATE POLICY "school_assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'school-assets' AND
    (
      -- Super admin can upload anywhere
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'super_admin'
      ) OR
      -- School admin can upload to their school folder only
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'school_admin'
        AND school_id::text = split_part(name, '/', 1)
        -- Path traversal protection
        AND name !~ '\.\.'
        AND name !~ '/\./'
        AND name !~ '^\./'
      )
    ) AND
    -- Only allow image files
    (storage.extension(name) = ANY(ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif']))
  );

-- 2. SELECT Policy: Allow users to view files they have access to
CREATE POLICY "school_assets_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'school-assets' AND
    (
      -- Super admin can view all files
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'super_admin'
      ) OR
      -- Users can view files from their school
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND school_id::text = split_part(name, '/', 1)
        -- Path traversal protection
        AND name !~ '\.\.'
        AND name !~ '/\./'
        AND name !~ '^\./'
      )
    )
  );

-- 3. UPDATE Policy: Allow users to update files they own
CREATE POLICY "school_assets_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'school-assets' AND
    (
      -- Super admin can update all files
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'super_admin'
      ) OR
      -- School admin can update files from their school
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'school_admin'
        AND school_id::text = split_part(name, '/', 1)
        -- Path traversal protection
        AND name !~ '\.\.'
        AND name !~ '/\./'
        AND name !~ '^\./'
      )
    )
  );

-- 4. DELETE Policy: Allow authorized deletion
CREATE POLICY "school_assets_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'school-assets' AND
    (
      -- Super admin can delete all files
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'super_admin'
      ) OR
      -- School admin can delete files from their school
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'school_admin'
        AND school_id::text = split_part(name, '/', 1)
        -- Path traversal protection
        AND name !~ '\.\.'
        AND name !~ '/\./'
        AND name !~ '^\./'
      )
    )
  );
