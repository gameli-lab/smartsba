-- Enable Row Level Security on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teacher_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's profile
CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS user_profiles AS $$
DECLARE
  profile user_profiles;
BEGIN
  SELECT * INTO profile 
  FROM user_profiles 
  WHERE user_id = auth.uid();
  
  RETURN profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is super admin
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

-- Helper function to get user's school_id
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

-- Helper function to check if user can access specific school
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

-- Helper function to check if user is teacher assigned to class/subject
CREATE OR REPLACE FUNCTION is_teacher_assigned_to_subject(target_subject_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_teacher_id UUID;
BEGIN
  -- Get teacher id for current user
  SELECT id INTO user_teacher_id 
  FROM teachers 
  WHERE user_id = auth.uid();
  
  IF user_teacher_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if teacher is assigned to this subject
  RETURN EXISTS (
    SELECT 1 
    FROM teacher_assignments 
    WHERE teacher_id = user_teacher_id 
    AND subject_id = target_subject_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is class teacher for a class
CREATE OR REPLACE FUNCTION is_class_teacher_for_class(target_class_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_teacher_id UUID;
BEGIN
  -- Get teacher id for current user
  SELECT id INTO user_teacher_id 
  FROM teachers 
  WHERE user_id = auth.uid();
  
  IF user_teacher_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if teacher is class teacher for this class
  RETURN EXISTS (
    SELECT 1 
    FROM teacher_assignments 
    WHERE teacher_id = user_teacher_id 
    AND class_id = target_class_id 
    AND is_class_teacher = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is parent of student
CREATE OR REPLACE FUNCTION is_parent_of_student(target_student_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_profile_id UUID;
BEGIN
  -- Get user profile id
  SELECT id INTO user_profile_id 
  FROM user_profiles 
  WHERE user_id = auth.uid() AND role = 'parent';
  
  IF user_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if parent is linked to this student
  RETURN EXISTS (
    SELECT 1 
    FROM parent_student_links 
    WHERE parent_id = user_profile_id 
    AND student_id = target_student_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SCHOOLS TABLE POLICIES
-- Super admin can do everything, school admins can read/update their school
CREATE POLICY "Schools - Super admin full access" ON schools
  FOR ALL USING (is_super_admin());

CREATE POLICY "Schools - School admin read own school" ON schools
  FOR SELECT USING (can_access_school(id));

CREATE POLICY "Schools - School admin update own school" ON schools
  FOR UPDATE USING (
    can_access_school(id) AND 
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'school_admin'
  );

-- USER_PROFILES TABLE POLICIES
-- Users can always read their own profile (essential for authentication)
CREATE POLICY "User profiles - Own profile access" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "User profiles - Own profile update" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Admins can read profiles in their school or all schools (for super admin)
CREATE POLICY "User profiles - Admin read users" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() 
      AND (
        up.role = 'super_admin' OR 
        (up.role = 'school_admin' AND up.school_id = user_profiles.school_id)
      )
    )
  );

-- Admins can create users in their school or any school (for super admin)
CREATE POLICY "User profiles - Admin create users" ON user_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() 
      AND (
        up.role = 'super_admin' OR 
        (up.role = 'school_admin' AND up.school_id = user_profiles.school_id)
      )
    )
  );

-- Admins can update users in their school or any school (for super admin)
CREATE POLICY "User profiles - Admin update users" ON user_profiles
  FOR UPDATE USING (
    user_id = auth.uid() OR -- Users can update themselves
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() 
      AND (
        up.role = 'super_admin' OR 
        (up.role = 'school_admin' AND up.school_id = user_profiles.school_id)
      )
    )
  );

-- ACADEMIC_SESSIONS TABLE POLICIES
CREATE POLICY "Academic sessions - School access" ON academic_sessions
  FOR ALL USING (can_access_school(school_id));

-- CLASSES TABLE POLICIES  
CREATE POLICY "Classes - School access" ON classes
  FOR ALL USING (can_access_school(school_id));

-- SUBJECTS TABLE POLICIES
CREATE POLICY "Subjects - School access" ON subjects
  FOR SELECT USING (can_access_school(school_id));

CREATE POLICY "Subjects - Admin manage" ON subjects
  FOR ALL USING (
    can_access_school(school_id) AND 
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('super_admin', 'school_admin')
  );

-- TEACHERS TABLE POLICIES
CREATE POLICY "Teachers - School access" ON teachers
  FOR SELECT USING (can_access_school(school_id));

CREATE POLICY "Teachers - Admin manage" ON teachers
  FOR ALL USING (
    can_access_school(school_id) AND 
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('super_admin', 'school_admin')
  );

-- TEACHER_ASSIGNMENTS TABLE POLICIES
CREATE POLICY "Teacher assignments - School access" ON teacher_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teachers t 
      WHERE t.id = teacher_id 
      AND can_access_school(t.school_id)
    )
  );

CREATE POLICY "Teacher assignments - Admin manage" ON teacher_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM teachers t 
      WHERE t.id = teacher_id 
      AND can_access_school(t.school_id)
      AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('super_admin', 'school_admin')
    )
  );

-- STUDENTS TABLE POLICIES
CREATE POLICY "Students - Own record access" ON students
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Students - School staff access" ON students
  FOR SELECT USING (
    can_access_school(school_id) AND 
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN 
    ('super_admin', 'school_admin', 'teacher')
  );

CREATE POLICY "Students - Parent access to wards" ON students
  FOR SELECT USING (is_parent_of_student(id));

CREATE POLICY "Students - Admin manage" ON students
  FOR ALL USING (
    can_access_school(school_id) AND 
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('super_admin', 'school_admin')
  );

-- PARENT_STUDENT_LINKS TABLE POLICIES
CREATE POLICY "Parent student links - Parent access own links" ON parent_student_links
  FOR SELECT USING (
    parent_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Parent student links - Admin manage" ON parent_student_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      JOIN students s ON s.id = student_id
      WHERE up.id = parent_id 
      AND can_access_school(s.school_id)
      AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('super_admin', 'school_admin')
    )
  );

-- SCORES TABLE POLICIES
CREATE POLICY "Scores - Student access own scores" ON scores
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Scores - Parent access ward scores" ON scores
  FOR SELECT USING (is_parent_of_student(student_id));

CREATE POLICY "Scores - Teacher access assigned subject scores" ON scores
  FOR SELECT USING (
    is_teacher_assigned_to_subject(subject_id) OR
    is_class_teacher_for_class((SELECT class_id FROM students WHERE id = student_id))
  );

CREATE POLICY "Scores - School admin access" ON scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = student_id 
      AND can_access_school(s.school_id)
      AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('super_admin', 'school_admin')
    )
  );

CREATE POLICY "Scores - Teacher enter/update assigned subjects" ON scores
  FOR ALL USING (
    is_teacher_assigned_to_subject(subject_id) AND
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = student_id 
      AND can_access_school(s.school_id)
    )
  );

CREATE POLICY "Scores - Admin manage all scores" ON scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = student_id 
      AND can_access_school(s.school_id)
      AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('super_admin', 'school_admin')
    )
  );

-- CLASS_TEACHER_REMARKS TABLE POLICIES
CREATE POLICY "Class teacher remarks - Student access own" ON class_teacher_remarks
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Class teacher remarks - Parent access ward" ON class_teacher_remarks
  FOR SELECT USING (is_parent_of_student(student_id));

CREATE POLICY "Class teacher remarks - Class teacher manage" ON class_teacher_remarks
  FOR ALL USING (
    is_class_teacher_for_class((SELECT class_id FROM students WHERE id = student_id))
  );

CREATE POLICY "Class teacher remarks - Admin access" ON class_teacher_remarks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = student_id 
      AND can_access_school(s.school_id)
      AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('super_admin', 'school_admin')
    )
  );

-- ATTENDANCE TABLE POLICIES
CREATE POLICY "Attendance - Student access own" ON attendance
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Attendance - Parent access ward" ON attendance
  FOR SELECT USING (is_parent_of_student(student_id));

CREATE POLICY "Attendance - Class teacher manage" ON attendance
  FOR ALL USING (
    is_class_teacher_for_class((SELECT class_id FROM students WHERE id = student_id))
  );

CREATE POLICY "Attendance - School staff access" ON attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = student_id 
      AND can_access_school(s.school_id)
      AND (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN 
      ('super_admin', 'school_admin', 'teacher')
    )
  );

-- ANNOUNCEMENTS TABLE POLICIES
CREATE POLICY "Announcements - Target audience access" ON announcements
  FOR SELECT USING (
    can_access_school(school_id) AND (
      -- Check if user's role is in target audience
      (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = ANY(target_audience) OR
      -- Or if specific classes are targeted and user is in those classes
      (
        class_ids IS NOT NULL AND 
        (SELECT class_id FROM students WHERE user_id = auth.uid()) = ANY(class_ids)
      )
    )
  );

CREATE POLICY "Announcements - Admin manage" ON announcements
  FOR ALL USING (
    can_access_school(school_id) AND 
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) IN ('super_admin', 'school_admin')
  );

CREATE POLICY "Announcements - Teacher create class announcements" ON announcements
  FOR INSERT WITH CHECK (
    can_access_school(school_id) AND 
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'teacher' AND
    -- Teachers can only create announcements for their assigned classes
    (
      class_ids IS NULL OR 
      EXISTS (
        SELECT 1 FROM teacher_assignments ta
        JOIN teachers t ON t.id = ta.teacher_id
        WHERE t.user_id = auth.uid() 
        AND ta.class_id = ANY(class_ids)
      )
    )
  );
