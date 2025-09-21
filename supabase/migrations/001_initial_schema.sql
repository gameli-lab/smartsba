-- Create enums
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'school_admin', 
  'teacher',
  'student',
  'parent'
);

CREATE TYPE gender AS ENUM ('male', 'female');
CREATE TYPE academic_term AS ENUM ('1', '2', '3');
CREATE TYPE grade AS ENUM ('1', '2', '3', '4', '5', '6', '7', '8', '9');
CREATE TYPE promotion_status AS ENUM ('promoted', 'repeated', 'withdrawn', 'pending');

-- Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  motto TEXT,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  logo_url TEXT,
  stamp_url TEXT,
  head_signature_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  staff_id VARCHAR(50),
  admission_number VARCHAR(50),
  phone VARCHAR(20),
  address TEXT,
  gender gender,
  date_of_birth DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraints
  CONSTRAINT unique_staff_id_per_school UNIQUE (school_id, staff_id),
  CONSTRAINT unique_admission_number_per_school UNIQUE (school_id, admission_number),
  
  -- Check constraints
  CONSTRAINT check_staff_id_for_staff CHECK (
    (role IN ('school_admin', 'teacher') AND staff_id IS NOT NULL) OR
    (role NOT IN ('school_admin', 'teacher'))
  ),
  CONSTRAINT check_admission_number_for_student CHECK (
    (role = 'student' AND admission_number IS NOT NULL) OR
    (role != 'student')
  )
);

-- Create academic_sessions table
CREATE TABLE IF NOT EXISTS academic_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  academic_year VARCHAR(20) NOT NULL, -- e.g., "2024/2025"
  term academic_term NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  vacation_date DATE,
  reopening_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint - only one current session per school
  CONSTRAINT unique_current_session_per_school UNIQUE (school_id, is_current) DEFERRABLE INITIALLY DEFERRED
);

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL, -- e.g., "JHS 1", "Primary 6"
  stream VARCHAR(10), -- e.g., "A", "B", "C"
  level INTEGER NOT NULL, -- 1-9 for basic education
  description TEXT,
  class_teacher_id UUID, -- Will reference teachers table
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint
  CONSTRAINT unique_class_stream_per_school UNIQUE (school_id, name, stream)
);

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  description TEXT,
  is_core BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint
  CONSTRAINT unique_subject_per_class UNIQUE (class_id, name)
);

-- Create teachers table
CREATE TABLE IF NOT EXISTS teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  staff_id VARCHAR(50) NOT NULL,
  specialization VARCHAR(100),
  qualification VARCHAR(255),
  hire_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraints
  CONSTRAINT unique_teacher_user UNIQUE (user_id),
  CONSTRAINT unique_teacher_staff_id_per_school UNIQUE (school_id, staff_id)
);

-- Create teacher_assignments table
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  is_class_teacher BOOLEAN DEFAULT FALSE,
  academic_year VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraints
  CONSTRAINT unique_teacher_subject_assignment UNIQUE (teacher_id, subject_id, academic_year),
  CONSTRAINT unique_class_teacher_per_class UNIQUE (class_id, academic_year, is_class_teacher) DEFERRABLE INITIALLY DEFERRED
);

-- Create students table  
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  admission_number VARCHAR(50) NOT NULL,
  roll_number VARCHAR(20),
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  date_of_birth DATE NOT NULL,
  gender gender NOT NULL,
  guardian_name VARCHAR(255),
  guardian_phone VARCHAR(20),
  guardian_email VARCHAR(255),
  address TEXT,
  admission_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraints
  CONSTRAINT unique_student_user UNIQUE (user_id),
  CONSTRAINT unique_student_admission_per_school UNIQUE (school_id, admission_number),
  CONSTRAINT unique_student_roll_per_class UNIQUE (class_id, roll_number)
);

-- Create parent_student_links table
CREATE TABLE IF NOT EXISTS parent_student_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  relationship VARCHAR(50) NOT NULL DEFAULT 'Guardian',
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint
  CONSTRAINT unique_parent_student_link UNIQUE (parent_id, student_id)
);

-- Create scores table
CREATE TABLE IF NOT EXISTS scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  ca_score DECIMAL(5,2) CHECK (ca_score >= 0 AND ca_score <= 30),
  exam_score DECIMAL(5,2) CHECK (exam_score >= 0 AND exam_score <= 70),
  total_score DECIMAL(5,2) GENERATED ALWAYS AS (COALESCE(ca_score, 0) + COALESCE(exam_score, 0)) STORED,
  grade grade,
  position INTEGER,
  subject_remark TEXT,
  entered_by UUID REFERENCES user_profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint
  CONSTRAINT unique_student_subject_session UNIQUE (student_id, subject_id, session_id)
);

-- Create student_aggregates table for automated aggregate calculations
CREATE TABLE IF NOT EXISTS student_aggregates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  total_subjects INTEGER NOT NULL DEFAULT 0,
  core_subjects_count INTEGER NOT NULL DEFAULT 0,
  elective_subjects_count INTEGER NOT NULL DEFAULT 0,
  aggregate_score INTEGER NOT NULL DEFAULT 0, -- Sum of best 6-8 subjects including all 4 core
  class_position INTEGER,
  overall_position INTEGER,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint
  CONSTRAINT unique_student_session_aggregate UNIQUE (student_id, session_id)
);

-- Create class_teacher_remarks table
CREATE TABLE IF NOT EXISTS class_teacher_remarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  remark TEXT NOT NULL,
  promotion_status promotion_status,
  next_class_id UUID REFERENCES classes(id),
  entered_by UUID REFERENCES user_profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint
  CONSTRAINT unique_student_session_remark UNIQUE (student_id, session_id)
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  present_days INTEGER NOT NULL DEFAULT 0 CHECK (present_days >= 0),
  total_days INTEGER NOT NULL DEFAULT 0 CHECK (total_days >= 0),
  percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_days = 0 THEN 0 
      ELSE ROUND((present_days::DECIMAL / total_days::DECIMAL) * 100, 2) 
    END
  ) STORED,
  entered_by UUID REFERENCES user_profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint
  CONSTRAINT unique_student_session_attendance UNIQUE (student_id, session_id),
  
  -- Check constraint
  CONSTRAINT check_present_days_not_greater_than_total CHECK (present_days <= total_days)
);

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  target_audience user_role[] NOT NULL,
  class_ids UUID[],
  is_urgent BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES user_profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for class_teacher_id
ALTER TABLE classes 
ADD CONSTRAINT fk_class_teacher 
FOREIGN KEY (class_teacher_id) 
REFERENCES teachers(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_user_profiles_school_id ON user_profiles(school_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_staff_id ON user_profiles(staff_id);
CREATE INDEX idx_user_profiles_admission_number ON user_profiles(admission_number);

CREATE INDEX idx_academic_sessions_school_id ON academic_sessions(school_id);
CREATE INDEX idx_academic_sessions_current ON academic_sessions(school_id, is_current);

CREATE INDEX idx_classes_school_id ON classes(school_id);
CREATE INDEX idx_subjects_class_id ON subjects(class_id);
CREATE INDEX idx_subjects_school_id ON subjects(school_id);

CREATE INDEX idx_teachers_school_id ON teachers(school_id);
CREATE INDEX idx_teachers_user_id ON teachers(user_id);
CREATE INDEX idx_teacher_assignments_teacher_id ON teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assignments_class_id ON teacher_assignments(class_id);
CREATE INDEX idx_teacher_assignments_subject_id ON teacher_assignments(subject_id);

CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_students_admission_number ON students(admission_number);

CREATE INDEX idx_scores_student_id ON scores(student_id);
CREATE INDEX idx_scores_subject_id ON scores(subject_id);
CREATE INDEX idx_scores_session_id ON scores(session_id);
CREATE INDEX idx_scores_grade ON scores(grade);

CREATE INDEX idx_student_aggregates_student_id ON student_aggregates(student_id);
CREATE INDEX idx_student_aggregates_session_id ON student_aggregates(session_id);
CREATE INDEX idx_student_aggregates_class_id ON student_aggregates(class_id);
CREATE INDEX idx_student_aggregates_score ON student_aggregates(aggregate_score);
CREATE INDEX idx_student_aggregates_class_ranking ON student_aggregates(class_id, aggregate_score);

CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_session_id ON attendance(session_id);

CREATE INDEX idx_announcements_school_id ON announcements(school_id);
CREATE INDEX idx_announcements_target_audience ON announcements USING GIN(target_audience);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to calculate student aggregate
CREATE OR REPLACE FUNCTION calculate_student_aggregate(
  p_student_id UUID,
  p_session_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_class_id UUID;
  v_core_subjects INTEGER := 0;
  v_total_aggregate INTEGER := 0;
  v_elective_count INTEGER := 0;
  core_score RECORD;
  elective_score RECORD;
BEGIN
  -- Get student's class
  SELECT class_id INTO v_class_id 
  FROM students 
  WHERE id = p_student_id;
  
  -- Calculate core subjects aggregate (English, Mathematics, Science, Social Studies)
  FOR core_score IN 
    SELECT s.grade::INTEGER as grade_value
    FROM scores s
    JOIN subjects sub ON sub.id = s.subject_id
    WHERE s.student_id = p_student_id 
    AND s.session_id = p_session_id
    AND sub.is_core = true
    AND sub.name IN ('English Language', 'Mathematics', 'Integrated Science', 'Social Studies')
    AND s.grade IS NOT NULL
  LOOP
    v_total_aggregate := v_total_aggregate + core_score.grade_value;
    v_core_subjects := v_core_subjects + 1;
  END LOOP;
  
  -- If not all 4 core subjects are completed, return 0 (incomplete)
  IF v_core_subjects < 4 THEN
    RETURN 0;
  END IF;
  
  -- Add best elective subjects (up to 4 more subjects)
  FOR elective_score IN 
    SELECT s.grade::INTEGER as grade_value
    FROM scores s
    JOIN subjects sub ON sub.id = s.subject_id
    WHERE s.student_id = p_student_id 
    AND s.session_id = p_session_id
    AND (sub.is_core = false OR sub.name NOT IN ('English Language', 'Mathematics', 'Integrated Science', 'Social Studies'))
    AND s.grade IS NOT NULL
    ORDER BY s.grade::INTEGER ASC  -- Best grades first (1 is better than 9)
    LIMIT 4
  LOOP
    v_total_aggregate := v_total_aggregate + elective_score.grade_value;
    v_elective_count := v_elective_count + 1;
  END LOOP;
  
  RETURN v_total_aggregate;
END;
$$ LANGUAGE plpgsql;

-- Function to update student aggregate after score changes
CREATE OR REPLACE FUNCTION update_student_aggregate_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_student_id UUID;
  v_session_id UUID;
  v_class_id UUID;
  v_aggregate INTEGER;
BEGIN
  -- Get the student and session from the score
  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
    v_session_id := OLD.session_id;
  ELSE
    v_student_id := NEW.student_id;
    v_session_id := NEW.session_id;
  END IF;
  
  -- Get student's class
  SELECT class_id INTO v_class_id 
  FROM students 
  WHERE id = v_student_id;
  
  -- Calculate new aggregate
  v_aggregate := calculate_student_aggregate(v_student_id, v_session_id);
  
  -- Update or insert aggregate record
  INSERT INTO student_aggregates (
    student_id, 
    session_id, 
    class_id, 
    aggregate_score,
    total_subjects,
    core_subjects_count,
    elective_subjects_count
  ) 
  VALUES (
    v_student_id,
    v_session_id,
    v_class_id,
    v_aggregate,
    (SELECT COUNT(*) FROM scores WHERE student_id = v_student_id AND session_id = v_session_id AND grade IS NOT NULL),
    (SELECT COUNT(*) FROM scores s JOIN subjects sub ON sub.id = s.subject_id 
     WHERE s.student_id = v_student_id AND s.session_id = v_session_id AND sub.is_core = true 
     AND sub.name IN ('English Language', 'Mathematics', 'Integrated Science', 'Social Studies') AND s.grade IS NOT NULL),
    (SELECT COUNT(*) FROM scores s JOIN subjects sub ON sub.id = s.subject_id 
     WHERE s.student_id = v_student_id AND s.session_id = v_session_id AND 
     (sub.is_core = false OR sub.name NOT IN ('English Language', 'Mathematics', 'Integrated Science', 'Social Studies')) AND s.grade IS NOT NULL)
  )
  ON CONFLICT (student_id, session_id) 
  DO UPDATE SET 
    aggregate_score = EXCLUDED.aggregate_score,
    total_subjects = EXCLUDED.total_subjects,
    core_subjects_count = EXCLUDED.core_subjects_count,
    elective_subjects_count = EXCLUDED.elective_subjects_count,
    calculated_at = NOW();
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_academic_sessions_updated_at BEFORE UPDATE ON academic_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teacher_assignments_updated_at BEFORE UPDATE ON teacher_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_class_teacher_remarks_updated_at BEFORE UPDATE ON class_teacher_remarks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add aggregate calculation triggers
CREATE TRIGGER trigger_calculate_aggregate_on_score_change
  AFTER INSERT OR UPDATE OR DELETE ON scores
  FOR EACH ROW EXECUTE FUNCTION update_student_aggregate_trigger();
