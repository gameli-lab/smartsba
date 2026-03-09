#!/bin/bash

# Script to fix storage policies without custom JWT claims

SQL_QUERY=$(cat <<'EOF'
-- Drop existing policies
DROP POLICY IF EXISTS "school_assets_upload" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_select" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_delete" ON storage.objects;

-- 1. UPLOAD Policy
CREATE POLICY "school_assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'school-assets' AND
    (
      EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'super_admin') OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'school_admin'
        AND school_id::text = split_part(name, '/', 1)
        AND name !~ '\.\.' AND name !~ '/\./' AND name !~ '^\./'
      )
    ) AND
    (storage.extension(name) = ANY(ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif']))
  );

-- 2. SELECT Policy
CREATE POLICY "school_assets_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'school-assets' AND
    (
      EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'super_admin') OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND school_id::text = split_part(name, '/', 1)
        AND name !~ '\.\.' AND name !~ '/\./' AND name !~ '^\./'
      )
    )
  );

-- 3. UPDATE Policy
CREATE POLICY "school_assets_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'school-assets' AND
    (
      EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'super_admin') OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'school_admin'
        AND school_id::text = split_part(name, '/', 1)
        AND name !~ '\.\.' AND name !~ '/\./' AND name !~ '^\./'
      )
    )
  );

-- 4. DELETE Policy
CREATE POLICY "school_assets_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'school-assets' AND
    (
      EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'super_admin') OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND role = 'school_admin'
        AND school_id::text = split_part(name, '/', 1)
        AND name !~ '\.\.' AND name !~ '/\./' AND name !~ '^\./'
      )
    )
  );
EOF
)

echo "=== Applying Storage Policy Fix ==="
echo ""
echo "Please run this SQL in your Supabase Dashboard > SQL Editor:"
echo ""
echo "$SQL_QUERY"
echo ""
echo "Or copy the SQL from: supabase/migrations/999_fix_storage_policies_without_custom_claims.sql"
