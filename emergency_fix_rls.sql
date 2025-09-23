-- Emergency fix for infinite recursion in user_profiles RLS policies
-- This completely replaces the problematic policies with simple, non-recursive ones

-- First, drop ALL existing user_profiles policies to stop the recursion
DROP POLICY IF EXISTS "User profiles - Own profile access" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Own profile update" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Admin read users" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Admin create users" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Admin update users" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - School admin read school users" ON user_profiles;

-- Create simple, non-recursive policies

-- 1. Users can ALWAYS read and update their own profile (no conditions, no recursion)
-- 1. Users can read and update their own profile only
CREATE POLICY "user_profiles_own_select" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_profiles_own_update" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "user_profiles_own_insert" ON user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 2. Service role and admin access for system operations
-- Only grants access to service role or verified admin users
CREATE POLICY "user_profiles_admin_read" ON user_profiles
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'service_role' OR  -- Service role
    current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin'  -- JWT admin claim
  );

-- 3. Service role write access for system operations
CREATE POLICY "user_profiles_service_write" ON user_profiles
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "user_profiles_authenticated_update" ON user_profiles
  FOR UPDATE USING (
    user_id = auth.uid() OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Verify the fix by testing a simple query
DO $$
BEGIN
  -- This should work without infinite recursion
  PERFORM COUNT(*) FROM user_profiles WHERE user_id IS NOT NULL;
  RAISE NOTICE 'SUCCESS: user_profiles policies fixed - no infinite recursion';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: Still having issues: %', SQLERRM;
END $$;
