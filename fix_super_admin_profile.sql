-- Fix Super Admin profile connection
-- Run this script to connect your Supabase Auth user to the Super Admin profile

-- PARAMETERS: Update these variables with your actual values
DO $$
DECLARE
  p_user_id UUID := '4eab9d56-3d74-4f1d-834b-7196b3af41c2'; -- 🔄 UPDATE THIS!
  p_email TEXT := 'your-email@example.com'; -- 🔄 UPDATE THIS!
  p_full_name TEXT := 'Super Administrator'; -- 🔄 UPDATE THIS!
  
  -- Safety validation variables
  placeholder_uuid UUID := '00000000-0000-0000-0000-000000000000';
  placeholder_email TEXT := 'your-email@example.com';
  
  -- Result tracking
  update_count INTEGER := 0;
  insert_count INTEGER := 0;
BEGIN
  -- Validation: Prevent execution with placeholder values
  IF p_user_id = placeholder_uuid THEN
    RAISE EXCEPTION 'ERROR: Please update p_user_id with your actual Supabase Auth user UUID';
  END IF;
  
  IF p_email = placeholder_email OR p_email LIKE '%example.com' THEN
    RAISE EXCEPTION 'ERROR: Please update p_email with your actual email address';
  END IF;
  
  IF p_user_id IS NULL OR p_email IS NULL THEN
    RAISE EXCEPTION 'ERROR: p_user_id and p_email cannot be NULL';
  END IF;

  -- Display current state
  RAISE NOTICE 'Current Super Admin profiles:';
  FOR rec IN 
    SELECT id, user_id, role, email, full_name, created_at
    FROM user_profiles 
    WHERE role = 'super_admin'
  LOOP
    RAISE NOTICE 'ID: %, User ID: %, Email: %, Name: %', rec.id, rec.user_id, rec.email, rec.full_name;
  END LOOP;

  -- Update existing placeholder record
  UPDATE user_profiles 
  SET 
      user_id = p_user_id,
      email = p_email,
      full_name = p_full_name,
      updated_at = NOW()
  WHERE role = 'super_admin'
  AND user_id = placeholder_uuid;
  
  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  -- If no placeholder record was updated, try creating new one
  IF update_count = 0 THEN
    INSERT INTO user_profiles (
        user_id,
        school_id,
        role,
        email,
        full_name,
        staff_id
    ) 
    SELECT 
        p_user_id,
        NULL,
        'super_admin',
        p_email,
        p_full_name,
        'SUPER001'
    WHERE NOT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_id = p_user_id
    );
    
    GET DIAGNOSTICS insert_count = ROW_COUNT;
  END IF;

  -- Report results
  IF update_count > 0 THEN
    RAISE NOTICE 'SUCCESS: Updated % existing super admin profile(s)', update_count;
  ELSIF insert_count > 0 THEN
    RAISE NOTICE 'SUCCESS: Created % new super admin profile(s)', insert_count;
  ELSE
    RAISE NOTICE 'INFO: Super admin profile already exists for user_id: %', p_user_id;
  END IF;

  -- Final verification
  RAISE NOTICE 'Final Super Admin profile verification:';
  FOR rec IN 
    SELECT id, user_id, role, email, full_name, staff_id, school_id, created_at, updated_at
    FROM user_profiles 
    WHERE user_id = p_user_id
  LOOP
    RAISE NOTICE 'SUCCESS: Profile found - ID: %, Role: %, Email: %, Name: %', 
                 rec.id, rec.role, rec.email, rec.full_name;
  END LOOP;
  
END $$;
