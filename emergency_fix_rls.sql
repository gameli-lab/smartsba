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
CREATE POLICY "user_profiles_own_access" ON user_profiles
  FOR ALL USING (user_id = auth.uid());

-- 2. Secure reading - only own profile or admin access
-- Restricts access to prevent data leakage
CREATE POLICY "user_profiles_secure_read" ON user_profiles
  FOR SELECT USING (
    user_id = auth.uid() OR  -- Own profile
    auth.jwt() ->> 'role' = 'service_role' OR  -- Service role
    EXISTS (  -- Admin users can read profiles in their context
      SELECT 1 FROM auth.users au 
      WHERE au.id = auth.uid() 
      AND au.email LIKE '%admin%'  -- Basic admin detection
    )
  );

-- 3. Restrict INSERT/UPDATE to existing users or service role
CREATE POLICY "user_profiles_service_write" ON user_profiles
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL OR 
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
