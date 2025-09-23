-- Fix Super Admin profile connection
-- Run this script to connect your Supabase Auth user to the Super Admin profile

-- Replace 'YOUR_AUTH_USER_ID_HERE' with the actual UUID from your Supabase Auth user
-- You can find this in Supabase Dashboard → Authentication → Users

-- First, let's see what we have in the user_profiles table
SELECT 'Current Super Admin profiles:' as info;
SELECT 
    id,
    user_id,
    role,
    email,
    full_name,
    created_at
FROM user_profiles 
WHERE role = 'super_admin';

-- Update the user_id to connect to your real Supabase Auth user
-- ⚠️  IMPORTANT: Replace '4eab9d56-3d74-4f1d-834b-7196b3af41c2' with your actual auth user ID
UPDATE user_profiles 
SET 
    user_id = '4eab9d56-3d74-4f1d-834b-7196b3af41c2', -- 🔄 UPDATE THIS!
    email = 'your-email@example.com', -- 🔄 UPDATE THIS to match auth user email
    updated_at = NOW()
WHERE role = 'super_admin'
AND user_id = '00000000-0000-0000-0000-000000000000'; -- Only update placeholder records

-- Verify the update worked
SELECT 'Updated Super Admin profile:' as info;
SELECT 
    id,
    user_id,
    role,
    email,
    full_name,
    created_at,
    updated_at
FROM user_profiles 
WHERE role = 'super_admin'
AND user_id = '4eab9d56-3d74-4f1d-834b-7196b3af41c2'; -- 🔄 UPDATE THIS!

-- Alternative: If no profile exists, create one
-- Use this if the UPDATE above affected 0 rows
INSERT INTO user_profiles (
    user_id,
    school_id,
    role,
    email,
    full_name,
    staff_id
) 
SELECT 
    '4eab9d56-3d74-4f1d-834b-7196b3af41c2', -- 🔄 UPDATE THIS!
    NULL,
    'super_admin',
    'your-email@example.com', -- 🔄 UPDATE THIS!
    'Super Administrator',
    'SUPER001'
WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = '4eab9d56-3d74-4f1d-834b-7196b3af41c2' -- 🔄 UPDATE THIS!
);

-- Final verification
SELECT 'Final Super Admin profile verification:' as info;
SELECT 
    id,
    user_id,
    role,
    email,
    full_name,
    staff_id,
    school_id,
    created_at,
    updated_at
FROM user_profiles 
WHERE user_id = '4eab9d56-3d74-4f1d-834b-7196b3af41c2'; -- 🔄 UPDATE THIS!
