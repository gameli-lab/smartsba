-- Fix RLS policies to allow students to read classes
-- Students need to view their class information on the dashboard

-- Drop old policy if exists
DROP POLICY IF EXISTS "Classes - School access" ON classes;

-- Allow students to read classes from their school
CREATE POLICY "classes_student_read" ON classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() 
      AND up.school_id = classes.school_id
      AND up.role = 'student'
    )
  );

-- Allow school staff and super admins to manage classes
CREATE POLICY "classes_staff_manage" ON classes
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json ->> 'app_role' IN ('school_admin', 'teacher', 'super_admin')
    AND (current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin' 
         OR current_setting('request.jwt.claims', true)::json ->> 'school_id' = school_id::text)
  );
