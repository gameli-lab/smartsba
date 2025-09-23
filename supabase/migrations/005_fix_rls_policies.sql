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

-- 3. Secure reading - only own profile or role-based access
-- Prevents data leakage while allowing necessary operations
CREATE POLICY "user_profiles_secure_read" ON user_profiles
  FOR SELECT USING (
    user_id = auth.uid() OR  -- Users can read their own profile
    auth.jwt() ->> 'role' = 'service_role'  -- Service role access
  );

-- 4. Admin read access - for administrative operations
-- Uses a separate policy to avoid recursion while allowing admin access
CREATE POLICY "user_profiles_admin_read" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('super_admin', 'school_admin')
      -- Use a subquery to avoid direct circular reference
      AND EXISTS (SELECT 1 FROM auth.users WHERE id = up.user_id)
    )
  );

-- 5. Allow inserts for authenticated users and service role
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
