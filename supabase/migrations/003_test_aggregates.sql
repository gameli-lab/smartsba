-- Migration to deploy the complete automated aggregate system
-- This includes user role simplification, numeric grades, and automated calculations

-- Run this after 001_initial_schema.sql and 002_rls_policies.sql

-- Simple test of the automated aggregate calculation system
-- Note: This test works without real user authentication

-- Temporarily disable the entered_by constraint for testing
ALTER TABLE scores ALTER COLUMN entered_by DROP NOT NULL;

-- Test the automated aggregate calculation system
DO $$
DECLARE
    test_school_id UUID;
    test_session_id UUID;
    test_class_id UUID;
    test_student_id UUID;
    test_subject_ids UUID[];
    test_subject_id UUID;
    i INTEGER;
BEGIN
    -- Create a test school
    INSERT INTO schools (id, name, address) 
    VALUES (gen_random_uuid(), 'Test School for Aggregates', 'Test Address')
    RETURNING id INTO test_school_id;

    -- Create test academic session
    INSERT INTO academic_sessions (id, school_id, academic_year, term, start_date, end_date, is_current)
    VALUES (gen_random_uuid(), test_school_id, '2024/2025', '1', '2024-09-01', '2025-07-31', true)
    RETURNING id INTO test_session_id;

    -- Create test class
    INSERT INTO classes (id, school_id, name, level)
    VALUES (gen_random_uuid(), test_school_id, 'Test Class 1', 1)
    RETURNING id INTO test_class_id;

    -- Create core subjects (mandatory for aggregate calculation)
    INSERT INTO subjects (id, school_id, class_id, name, code, is_core) VALUES
    (gen_random_uuid(), test_school_id, test_class_id, 'English Language', 'ENG', true),
    (gen_random_uuid(), test_school_id, test_class_id, 'Mathematics', 'MATH', true),
    (gen_random_uuid(), test_school_id, test_class_id, 'Science', 'SCI', true),
    (gen_random_uuid(), test_school_id, test_class_id, 'Social Studies', 'SOC', true);

    -- Create elective subjects
    INSERT INTO subjects (id, school_id, class_id, name, code, is_core) VALUES
    (gen_random_uuid(), test_school_id, test_class_id, 'French', 'FRE', false),
    (gen_random_uuid(), test_school_id, test_class_id, 'Music', 'MUS', false),
    (gen_random_uuid(), test_school_id, test_class_id, 'Art', 'ART', false),
    (gen_random_uuid(), test_school_id, test_class_id, 'Computer Studies', 'COMP', false),
    (gen_random_uuid(), test_school_id, test_class_id, 'Physical Education', 'PE', false);

    -- Get all subject IDs for testing
    SELECT array_agg(id) INTO test_subject_ids 
    FROM subjects WHERE school_id = test_school_id;

    -- Temporarily disable foreign key constraint for test data
    ALTER TABLE students DROP CONSTRAINT IF EXISTS students_user_id_fkey;
    
    -- Create test student (using dummy user_id for testing)
    INSERT INTO students (id, school_id, user_id, admission_number, class_id, date_of_birth, gender, admission_date)
    VALUES (gen_random_uuid(), test_school_id, gen_random_uuid(), 'TEST001', test_class_id, '2010-01-01', 'male', '2024-09-01')
    RETURNING id INTO test_student_id;
    
    -- Re-enable foreign key constraint
    ALTER TABLE students ADD CONSTRAINT students_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Create test scores for the student (core subjects + some electives)
    i := 1;
    FOREACH test_subject_id IN ARRAY test_subject_ids
    LOOP
        -- Create scores with varying grades (1-9, where lower is better)
        INSERT INTO scores (
            student_id, 
            subject_id, 
            session_id, 
            ca_score, 
            exam_score, 
            grade
        ) VALUES (
            test_student_id,
            test_subject_id,
            test_session_id,
            CASE WHEN i <= 8 THEN 25 + (i * 2) ELSE NULL END, -- CA scores for 8 subjects
            CASE WHEN i <= 8 THEN 45 + (i * 3) ELSE NULL END, -- Exam scores for 8 subjects
            CASE WHEN i <= 8 THEN (CASE 
                WHEN i <= 2 THEN '2'::grade  -- Excellent grades for first 2 subjects
                WHEN i <= 4 THEN '3'::grade  -- Good grades for next 2 subjects
                WHEN i <= 6 THEN '4'::grade  -- Average grades for next 2 subjects
                ELSE '5'::grade               -- Fair grades for last 2 subjects
            END) ELSE NULL END
        );
        
        i := i + 1;
        
        -- Only create 8 subjects worth of scores (4 core + 4 best electives)
        EXIT WHEN i > 8;
    END LOOP;

    -- Manually trigger aggregate calculation
    PERFORM calculate_student_aggregate(test_student_id, test_session_id);

    -- Display results
    RAISE NOTICE 'Test completed! Check student_aggregates table for student_id: %', test_student_id;
    RAISE NOTICE 'School ID: %, Session ID: %, Class ID: %', test_school_id, test_session_id, test_class_id;

END $$;

-- Verify the aggregate calculation worked
SELECT 
    sa.student_id,
    sa.aggregate_score,
    sa.total_subjects,
    sa.core_subjects_count,
    sa.elective_subjects_count,
    s.admission_number,
    sch.name as school_name
FROM student_aggregates sa
JOIN students s ON sa.student_id = s.id
JOIN schools sch ON s.school_id = sch.id
WHERE sch.name = 'Test School for Aggregates';

-- Show the scores that contributed to the aggregate
SELECT 
    sub.name as subject_name,
    sub.is_core,
    sc.ca_score,
    sc.exam_score,
    sc.grade,
    (sc.ca_score + sc.exam_score) as total_score
FROM scores sc
JOIN subjects sub ON sc.subject_id = sub.id
JOIN students st ON sc.student_id = st.id
JOIN schools sch ON st.school_id = sch.id
WHERE sch.name = 'Test School for Aggregates'
AND sc.grade IS NOT NULL
ORDER BY sub.is_core DESC, (sc.ca_score + sc.exam_score) ASC;

COMMENT ON FUNCTION calculate_student_aggregate IS 'Calculates student aggregate using 4 core subjects + best 4 electives. Lower aggregate score is better.';
COMMENT ON FUNCTION update_student_aggregate_trigger IS 'Automatically updates student aggregate when scores change';
COMMENT ON TABLE student_aggregates IS 'Stores calculated aggregates with core/elective subject counts and positions';

-- Restore the entered_by constraint after testing
ALTER TABLE scores ALTER COLUMN entered_by SET NOT NULL;
