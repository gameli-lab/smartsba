-- Migration 008: Storage Helper Functions
-- This includes only the functions that can be created via migration
-- Storage policies must be created manually via Supabase Dashboard

-- Helper function to get signed URLs for private assets
-- This allows controlled access to files without making the bucket public
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

-- Add comments for documentation
COMMENT ON FUNCTION get_school_asset_url(TEXT) IS 'Returns file path for authorized users to generate signed URLs for school assets';
