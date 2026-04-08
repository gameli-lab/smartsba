# Storage Policies Manual Setup

Since storage policies cannot be created via SQL migrations due to permissions, you need to create them manually through the Supabase Dashboard.

## Step 1: Create the Storage Bucket

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Configure:
   - **Name**: `school-assets`
   - **Public**: `FALSE` (Private bucket)
   - **File size limit**: `2MB`
   - **Allowed MIME types**: `image/jpeg,image/png,image/webp,image/gif`

## Step 2: Create RLS Policies

Go to **Storage** → **Policies** → **New policy** for each of the following:

### Policy 1: Upload (INSERT)

```sql
CREATE POLICY "school_assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'school-assets' AND
    (
      (auth.jwt() ->> 'app_role' = 'super_admin') OR
      (
        auth.jwt() ->> 'app_role' = 'school_admin' AND
        name LIKE (auth.jwt() ->> 'school_id') || '/%'
      )
    ) AND
    (storage.extension(name) = ANY(ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif']))
  );
```

### Policy 2: Select (VIEW)

```sql
CREATE POLICY "school_assets_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'school-assets' AND
    (
      -- Super admin can view all files
      (auth.jwt() ->> 'app_role' = 'super_admin') OR
      -- School users can view files from their school
      (
        auth.jwt() ->> 'school_id' IS NOT NULL AND
        name LIKE (auth.jwt() ->> 'school_id') || '/%'
      )
    )
  );
```

### Policy 3: Update

```sql
CREATE POLICY "school_assets_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'school-assets' AND
    (
      -- Super admin can update all files
      (auth.jwt() ->> 'app_role' = 'super_admin') OR
      -- School admin can update files from their school
      (
        auth.jwt() ->> 'app_role' = 'school_admin' AND
        name LIKE (auth.jwt() ->> 'school_id') || '/%'
      )
    )
  );
```

### Policy 4: Delete

```sql
CREATE POLICY "school_assets_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'school-assets' AND
    (
      -- Only super admin can delete files
      (auth.jwt() ->> 'app_role' = 'super_admin') OR
      -- School admin can delete files from their school
      (
        auth.jwt() ->> 'app_role' = 'school_admin' AND
        name LIKE (auth.jwt() ->> 'school_id') || '/%'
      )
    )
  );
```

## Step 3: Create Helper Function (via SQL Editor)

This CAN be created via the SQL Editor in the Dashboard:

```sql
-- Helper function to get signed URLs for private assets
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

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION get_school_asset_url(TEXT) TO authenticated;

COMMENT ON FUNCTION get_school_asset_url(TEXT) IS 'Returns file path for authorized users to generate signed URLs for school assets';
```

## Important Notes:

1. **Use `auth.jwt()`** instead of `current_setting('request.jwt.claims', true)::json` in the Dashboard
2. Storage policies are applied immediately - no migration needed
3. The helper function can be run via SQL Editor
4. Test policies by trying to upload/view files with different user roles

## Testing the Setup:

1. Create a test school via the schools form
2. Try uploading a logo as super admin - should work
3. Try accessing the file URL - should return a signed URL
4. Switch to school admin role and test restrictions

## Next Steps:

After setting up storage policies:

1. Apply the database migration: `007_add_school_status.sql`
2. Test the complete school creation flow
3. Verify file uploads work correctly
