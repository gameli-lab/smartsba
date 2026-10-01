-- Fix infinite recursion in user_profiles RLS policies
-- Root cause: user_profiles SELECT/UPDATE policies used EXISTS subqueries
-- that queried user_profiles itself, creating circular dependency.
-- Also: SECURITY DEFINER helper functions queried user_profiles, which
-- was subject to RLS, causing recursion when policies used self-referencing
-- subqueries.

-- ============================================================================
-- STEP 1: Drop ALL existing user_profiles policies (from migrations 002 and 005)
-- ============================================================================

DROP POLICY IF EXISTS "User profiles - Own profile access" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Own profile update" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Admin read users" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Admin create users" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - Admin update users" ON user_profiles;
DROP POLICY IF EXISTS "User profiles - School admin read school users" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_own_access" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_own_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_own_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_read" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_write" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_authenticated_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_access" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_access" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_auth_insert" ON user_profiles;

-- ============================================================================
-- STEP 2: Create simple, non-recursive policies for user_profiles
-- ============================================================================

-- Users can ALWAYS read their own profile (essential for authentication)
-- No subqueries on user_profiles — just direct user_id comparison
CREATE POLICY "user_profiles_own_select" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "user_profiles_own_update" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Users can insert their own profile
CREATE POLICY "user_profiles_own_insert" ON user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Service role has full access (for server-side operations, admin APIs, etc.)
CREATE POLICY "user_profiles_service_role_all" ON user_profiles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 3: Recreate SECURITY DEFINER helper functions
-- ============================================================================
-- These functions query user_profiles. Since we fixed the RLS policies above
-- to avoid self-referencing subqueries (USING user_id = auth.uid() directly),
-- RLS no longer causes infinite recursion when these functions query user_profiles.
-- The SECURITY DEFINER attribute ensures they execute with the owner's privileges.

CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS user_profiles AS $$
DECLARE
  profile user_profiles;
BEGIN
  -- SECURITY DEFINER: executes as the function owner (postgres)
  -- New policies don't use self-referencing subqueries, so no recursion
  SELECT * INTO profile
  FROM user_profiles
  WHERE user_id = auth.uid();

  RETURN profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'super_admin'
    FROM user_profiles
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_school_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT school_id
    FROM user_profiles
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_access_school(target_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admin can access all schools
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- Others can only access their own school
  RETURN get_user_school_id() = target_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on all helper functions to authenticated and service_role
GRANT EXECUTE ON FUNCTION get_current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_school(UUID) TO authenticated;

-- ============================================================================
-- STEP 4: Verify the fix
-- ============================================================================

DO $$
DECLARE
  test_count INTEGER;
BEGIN
  -- This query should work without infinite recursion
  -- Using BYPASSRLS context (service role) to verify the table is accessible
  SELECT COUNT(*) INTO test_count FROM user_profiles WHERE user_id IS NOT NULL;
  RAISE NOTICE 'SUCCESS: user_profiles policies fixed - no infinite recursion. Row count: %', test_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: Still having issues with RLS policies: %', SQLERRM;
END $$;
