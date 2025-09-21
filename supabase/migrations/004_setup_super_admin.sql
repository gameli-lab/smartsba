-- Setup script for creating the first Super Admin account
-- Run this AFTER completing all migrations (000, 001, 002, 003)

-- This script creates a Super Admin profile that can be linked to a real Supabase Auth user

-- Step 1: Create a placeholder user profile for Super Admin
-- You'll need to update the user_id after creating the auth user in Supabase Dashboard

INSERT INTO user_profiles (
    id,
    user_id,
    school_id,
    role,
    email,
    full_name,
    staff_id
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000', -- Placeholder - UPDATE THIS after creating auth user
    NULL, -- Super admin doesn't belong to a specific school
    'super_admin',
    'superadmin@smartsba.com', -- UPDATE THIS to your real email
    'Super Administrator', -- UPDATE THIS to your real name
    'SUPER001'
);

-- Display the created profile
SELECT 
    id,
    user_id,
    role,
    email,
    full_name,
    staff_id,
    created_at
FROM user_profiles 
WHERE role = 'super_admin'
ORDER BY created_at DESC
LIMIT 1;

-- Instructions for completing the setup:
SELECT '
🚀 SUPER ADMIN SETUP INSTRUCTIONS:

1. ✅ Copy the profile ID from the query result above
2. 🔐 Go to Supabase Dashboard → Authentication → Users
3. ➕ Click "Add User" (or "Create User")
4. 📧 Enter email: superadmin@smartsba.com (or your preferred email)
5. 🔑 Set a strong password
6. ✅ Click "Create User"
7. 📋 Copy the new user UUID from the users list
8. 🔄 Run this update query with the real UUID:

   UPDATE user_profiles 
   SET user_id = ''YOUR_REAL_USER_UUID_HERE'' 
   WHERE role = ''super_admin'' 
   AND user_id = ''00000000-0000-0000-0000-000000000000'';

9. 🎯 You can now login with your Super Admin account!

📝 ALTERNATIVE: If you already have a Supabase Auth user, just update the user_id directly.
' as setup_instructions;
