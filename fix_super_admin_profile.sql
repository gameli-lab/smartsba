-- Fix Super Admin profile connection
-- Run this script to connect your Supabase Auth user to the Super Admin profile

-- PARAMETERS: Update these variables with your actual values
DO $$
DECLARE
  p_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- 🔄 MUST UPDATE THIS!
  p_email TEXT := 'PLACEHOLDER_EMAIL@CHANGE.ME'; -- 🔄 MUST UPDATE THIS!
  p_full_name TEXT := 'Super Administrator'; -- 🔄 UPDATE THIS!
  
  -- Safety validation variables
  placeholder_uuid UUID := '00000000-0000-0000-0000-000000000000';
  placeholder_email TEXT := 'PLACEHOLDER_EMAIL@CHANGE.ME';
  
  -- Result tracking
  update_count INTEGER := 0;
  insert_count INTEGER := 0;
BEGIN
  -- Validation: Prevent execution with placeholder values
  IF p_user_id = placeholder_uuid THEN
    RAISE EXCEPTION 'ERROR: Please update p_user_id with your actual Supabase Auth user UUID';
  END IF;
  
  IF p_email = placeholder_email OR p_email LIKE '%CHANGE.ME' OR p_email LIKE '%example.com' THEN
    RAISE EXCEPTION 'ERROR: Please update p_email with your actual email address (current: %)', p_email;
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
  
  -- If no placeholder record was updated, use atomic upsert to prevent duplicates
  IF update_count = 0 THEN
    -- Create unique constraint if it doesn't exist (safe to run multiple times)
    BEGIN
      ALTER TABLE user_profiles ADD CONSTRAINT unique_user_id_role UNIQUE (user_id, role);
    EXCEPTION
      WHEN duplicate_object THEN 
        NULL; -- Constraint already exists, continue
    END;
    
    -- Use atomic upsert to prevent race conditions
    INSERT INTO user_profiles (
        user_id,
        school_id,
        role,
        email,
        full_name,
        staff_id
    ) VALUES (
        p_user_id,
        NULL,
        'super_admin',
        p_email,
        p_full_name,
        'SUPER001'
    )
    ON CONFLICT (user_id, role) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();
    
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
