-- Fix RLS policies to allow student profile auto-initialization
-- The issue: No INSERT policy exists for students table, and circular references in policies

-- Drop all existing INSERT policies on students (if any)
DROP POLICY IF EXISTS "students_insert" ON students;
DROP POLICY IF EXISTS "students_admin_insert" ON students;

-- Add INSERT policy for super admins and school admins to create students
CREATE POLICY "students_admin_insert" ON students
  FOR INSERT WITH CHECK (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' IN ('school_admin', 'super_admin')
    AND (current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin' 
         OR current_setting('request.jwt.claims', true)::json ->> 'school_id' = school_id::text)
  );

-- Add DELETE policy for super admins and school admins
DROP POLICY IF EXISTS "students_admin_delete" ON students;
CREATE POLICY "students_admin_delete" ON students
  FOR DELETE USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' IN ('school_admin', 'super_admin')
    AND (current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin' 
         OR current_setting('request.jwt.claims', true)::json ->> 'school_id' = school_id::text)
  );

-- Note: The policies were already fixed in 005_fix_rls_policies.sql to use JWT claims
-- instead of subqueries on user_profiles to avoid circular dependencies
