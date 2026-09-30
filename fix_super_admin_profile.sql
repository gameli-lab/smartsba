-- Fix Super Admin profile connection
-- Run this script to connect your Supabase Auth user to the Super Admin profile

-- PARAMETERS: Update these variables with your actual values
DO $$
DECLARE
  p_user_id UUID := NULL; -- Optional. Leave NULL to auto-resolve from auth.users by email.
  p_email TEXT := 'btorfu@gmail.com';
  p_full_name TEXT := 'Super Administrator'; -- 🔄 UPDATE THIS!
  
  -- Safety validation variables
  placeholder_uuid UUID := '00000000-0000-0000-0000-000000000000';
  placeholder_email TEXT := 'PLACEHOLDER_EMAIL@CHANGE.ME';
  
  -- Result tracking
  update_count INTEGER := 0;
  insert_count INTEGER := 0;
  auth_user_exists BOOLEAN := false;
  resolved_user_id UUID;
  same_email_count INTEGER := 0;
  rec RECORD;
BEGIN
  -- Validation: Prevent execution with placeholder values
  IF p_user_id = placeholder_uuid THEN
    RAISE EXCEPTION 'ERROR: Please update p_user_id with your actual Supabase Auth user UUID';
  END IF;
  
  IF p_email = placeholder_email OR p_email LIKE '%CHANGE.ME' OR p_email LIKE '%example.com' THEN
    RAISE EXCEPTION 'ERROR: Please update p_email with your actual email address (current: %)', p_email;
  END IF;
  
  IF p_email IS NULL THEN
    RAISE EXCEPTION 'ERROR: p_email cannot be NULL';
  END IF;

  -- Resolve the current active auth user id by email.
  SELECT u.id
  INTO resolved_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(p_email)
    AND u.deleted_at IS NULL
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF resolved_user_id IS NULL THEN
    SELECT COUNT(*)
    INTO same_email_count
    FROM auth.users u
    WHERE lower(u.email) = lower(p_email);

    IF same_email_count > 0 THEN
      RAISE EXCEPTION 'ERROR: auth.users has % row(s) for email %, but none are active (deleted_at is not null). Recreate the auth user first.', same_email_count, p_email;
    END IF;

    RAISE EXCEPTION 'ERROR: No auth.users row found for email=% in this Supabase project. Create/sign up this user first.', p_email;
  END IF;

  IF p_user_id IS NULL THEN
    p_user_id := resolved_user_id;
  ELSIF p_user_id <> resolved_user_id THEN
    RAISE NOTICE 'Provided p_user_id % does not match active auth.users id % for email %. Using active id.', p_user_id, resolved_user_id, p_email;
    p_user_id := resolved_user_id;
  END IF;

  auth_user_exists := true;
  RAISE NOTICE 'Using auth user id % for email %', p_user_id, p_email;

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
