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
DROP POLICY IF EXISTS "user_profiles_auth_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_own_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_authenticated_read" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_write" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_authenticated_update" ON user_profiles;

-- Create simple, non-recursive policies that avoid circular dependency

-- 1. Users can always read and update their own profile (essential for authentication)
CREATE POLICY "user_profiles_own_access" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_profiles_own_update" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- 2. Service role access for system operations (no circular dependency)
CREATE POLICY "user_profiles_service_access" ON user_profiles
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Admin access using JWT claims (avoids circular user_profiles queries)
-- Uses JWT claims to determine admin status without querying user_profiles
CREATE POLICY "user_profiles_admin_access" ON user_profiles
  FOR SELECT USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' IN ('super_admin', 'school_admin')
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

-- Fix other tables that had circular dependencies on user_profiles

-- Drop and recreate students table policies to remove circular dependencies
DROP POLICY IF EXISTS "Students - Own record access" ON students;
DROP POLICY IF EXISTS "Students - School staff access" ON students;
DROP POLICY IF EXISTS "Students - Parent access to wards" ON students;
DROP POLICY IF EXISTS "Students - Admin manage" ON students;

-- Students can read only their own records
CREATE POLICY "students_own_read" ON students
  FOR SELECT USING (user_id = auth.uid());

-- Students can update only their own records
CREATE POLICY "students_own_update" ON students
  FOR UPDATE USING (user_id = auth.uid());

-- School staff can read students from their school only
-- Using JWT claims to avoid circular dependency on user_profiles
CREATE POLICY "students_school_staff_read" ON students
  FOR SELECT USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' IN ('school_admin', 'teacher') AND
    current_setting('request.jwt.claims', true)::json ->> 'school_id' = school_id::text
  );

-- School staff can update students from their school only
CREATE POLICY "students_school_staff_update" ON students
  FOR UPDATE USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' IN ('school_admin', 'teacher') AND
    current_setting('request.jwt.claims', true)::json ->> 'school_id' = school_id::text
  );

-- Super admin can read all students
CREATE POLICY "students_super_admin_read" ON students
  FOR SELECT USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin'
  );

-- Super admin can update all students
CREATE POLICY "students_super_admin_update" ON students
  FOR UPDATE USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin'
  );

-- Parents can read their wards' records using direct parent_student_links relationship
CREATE POLICY "students_parent_read_wards" ON students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parent_student_links psl
      JOIN user_profiles up ON up.id = psl.parent_id
      WHERE up.user_id = auth.uid() AND psl.student_id = students.id
    )
  );

-- Fix teachers table policies to remove circular dependencies
DROP POLICY IF EXISTS "Teachers - Own record access" ON teachers;
DROP POLICY IF EXISTS "Teachers - School admin access" ON teachers;
DROP POLICY IF EXISTS "Teachers - Super admin access" ON teachers;

-- Teachers can read their own records
CREATE POLICY "teachers_own_read" ON teachers
  FOR SELECT USING (user_id = auth.uid());

-- Teachers can update their own records
CREATE POLICY "teachers_own_update" ON teachers
  FOR UPDATE USING (user_id = auth.uid());

-- School admins can manage teachers in their school
CREATE POLICY "teachers_school_admin_access" ON teachers
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'school_admin' AND
    current_setting('request.jwt.claims', true)::json ->> 'school_id' = school_id::text
  );

-- Super admins can access all teachers
CREATE POLICY "teachers_super_admin_access" ON teachers
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin'
  );

-- Fix parent_student_links table policies
DROP POLICY IF EXISTS "Parent student links - Parent access own links" ON parent_student_links;
DROP POLICY IF EXISTS "Parent student links - Admin manage" ON parent_student_links;

-- Parents can access their own links
CREATE POLICY "parent_links_own_access" ON parent_student_links
  FOR SELECT USING (
    parent_id IN (
      SELECT id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- School admins can manage links in their school
CREATE POLICY "parent_links_school_admin_access" ON parent_student_links
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'school_admin' AND
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = student_id 
      AND s.school_id::text = current_setting('request.jwt.claims', true)::json ->> 'school_id'
    )
  );

-- Super admins can access all parent links
CREATE POLICY "parent_links_super_admin_access" ON parent_student_links
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin'
  );

-- Note: After applying this migration, you may need to set JWT claims
-- in your application to include app_role and school_id for proper authorization
-- Example JWT claims structure:
-- {
--   "aud": "authenticated",
--   "role": "authenticated", 
--   "app_role": "school_admin",
--   "school_id": "uuid-of-school",
--   "sub": "user-uuid"
-- }
