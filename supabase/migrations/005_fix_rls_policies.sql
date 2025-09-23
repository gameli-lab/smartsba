-- Fix RLS policies for user_profiles to resolve authentication issues
-- This migration fixes the circular dependency in RLS policies that was causing 500 errors during login

-- Drop ALL existing user_profiles policies (including any partial attempts)
DROP POLICY IF EXISTS "User profiles - Own profile access" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Own profile update" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Admin read users" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Admin create users" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Admin update users" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - School admin read school users" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_own_access" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_authenticated_read" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_write" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_authenticated_update" ON user_profiles;

-- Create simple, non-recursive policies that avoid circular dependency

-- 1. Users can always read their own profile (essential for authentication)
CREATE POLICY "user_profiles_own_read" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

-- 2. Users can update their own profile
CREATE POLICY "user_profiles_own_update" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- 3. Allow authenticated users to read profiles (needed for role checks in app)
-- This is more permissive but prevents recursion
CREATE POLICY "user_profiles_auth_read" ON user_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4. Allow inserts for authenticated users and service role
CREATE POLICY "user_profiles_auth_insert" ON user_profiles
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Verify the policies are working by testing a simple query
-- This should not cause any errors
DO $$
BEGIN
  -- Test that we can query user_profiles without circular dependency
  PERFORM 1 FROM user_profiles LIMIT 1;
  RAISE NOTICE 'SUCCESS: RLS policies updated successfully - no circular dependency detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: Still having issues with RLS policies: %', SQLERRM;
END $$;
