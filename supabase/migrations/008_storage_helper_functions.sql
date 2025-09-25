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
  user_jwt jsonb;
BEGIN
  -- Input validation
  IF file_path IS NULL OR trim(file_path) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Extract school ID from file path (assumes format: school_id/file_name)
  school_id_from_path := trim(split_part(file_path, '/', 1));
  
  -- Validate extracted school ID
  IF school_id_from_path IS NULL OR school_id_from_path = '' THEN
    RETURN NULL;
  END IF;
  
  -- Get JWT safely
  user_jwt := auth.jwt();
  
  -- Handle missing JWT
  IF user_jwt IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Extract user information safely
  user_school_id := trim(user_jwt ->> 'school_id');
  user_role := trim(user_jwt ->> 'app_role');
  
  -- Check access permissions (only proceed if both values are present)
  IF user_role IS NOT NULL AND user_school_id IS NOT NULL THEN
    IF user_role = 'super_admin' OR user_school_id = school_id_from_path THEN
      -- Return the file path for signed URL generation
      RETURN file_path;
    END IF;
  END IF;
  
  -- No access or missing data
  RETURN NULL;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION get_school_asset_url(TEXT) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_school_asset_url(TEXT) IS 'Returns file path for authorized users to generate signed URLs for school assets';
