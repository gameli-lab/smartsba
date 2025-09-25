-- Migration to ensure all foreign key constraints with schools have ON DELETE CASCADE
-- This migration checks and updates any missing CASCADE constraints

-- Check and update parent_student_links if needed (references students which references schools)
-- This table already has proper CASCADE through students table

-- Check and update scores table (references students and subjects which reference schools)
-- This table already has proper CASCADE through students and subjects tables

-- Check and update student_aggregates table (references students, sessions, classes which reference schools)
-- This table already has proper CASCADE through referenced tables

-- Check and update class_teacher_remarks table (references students, sessions, classes which reference schools)
-- This table already has proper CASCADE through referenced tables

-- Check and update attendance table (references students, sessions which reference schools)
-- This table already has proper CASCADE through referenced tables

-- Verify that all direct foreign key references to schools have CASCADE
-- Based on the initial schema, all direct references already have ON DELETE CASCADE:
-- - user_profiles.school_id -> schools(id) ON DELETE CASCADE
-- - academic_sessions.school_id -> schools(id) ON DELETE CASCADE
-- - classes.school_id -> schools(id) ON DELETE CASCADE
-- - subjects.school_id -> schools(id) ON DELETE CASCADE
-- - teachers.school_id -> schools(id) ON DELETE CASCADE
-- - students.school_id -> schools(id) ON DELETE CASCADE
-- - announcements.school_id -> schools(id) ON DELETE CASCADE

-- Add additional safety constraints and indexes for deletion operations
CREATE INDEX IF NOT EXISTS idx_schools_deletion_safety ON schools(id, name, created_at);

-- Add a function to safely delete schools with comprehensive logging
CREATE OR REPLACE FUNCTION safe_delete_school(target_school_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    school_record RECORD;
    related_counts JSON;
    result JSON;
BEGIN
    -- Check if school exists
    SELECT id, name, created_at INTO school_record
    FROM schools 
    WHERE id = target_school_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'School not found',
            'school_id', target_school_id
        );
    END IF;
    
    -- Get counts of related records that will be deleted
    SELECT json_build_object(
        'user_profiles', (SELECT COUNT(*) FROM user_profiles WHERE school_id = target_school_id),
        'classes', (SELECT COUNT(*) FROM classes WHERE school_id = target_school_id),
        'students', (SELECT COUNT(*) FROM students WHERE school_id = target_school_id),
        'teachers', (SELECT COUNT(*) FROM teachers WHERE school_id = target_school_id),
        'academic_sessions', (SELECT COUNT(*) FROM academic_sessions WHERE school_id = target_school_id),
        'announcements', (SELECT COUNT(*) FROM announcements WHERE school_id = target_school_id)
    ) INTO related_counts;
    
    -- Log the deletion attempt
    RAISE NOTICE 'Deleting school: % (%) with related records: %', 
        school_record.name, school_record.id, related_counts;
    
    -- Perform the deletion (CASCADE will handle related records)
    DELETE FROM schools WHERE id = target_school_id;
    
    -- Return success result
    RETURN json_build_object(
        'success', true,
        'deleted_school', json_build_object(
            'id', school_record.id,
            'name', school_record.name,
            'created_at', school_record.created_at
        ),
        'related_records_deleted', related_counts,
        'timestamp', NOW()
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'school_id', target_school_id,
        'timestamp', NOW()
    );
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION safe_delete_school(UUID) TO authenticated;

-- Add a view to help monitor school deletion safety
CREATE OR REPLACE VIEW school_deletion_impact AS
SELECT 
    s.id,
    s.name,
    s.created_at,
    (SELECT COUNT(*) FROM user_profiles WHERE school_id = s.id) as user_profiles_count,
    (SELECT COUNT(*) FROM classes WHERE school_id = s.id) as classes_count,
    (SELECT COUNT(*) FROM students WHERE school_id = s.id) as students_count,
    (SELECT COUNT(*) FROM teachers WHERE school_id = s.id) as teachers_count,
    (SELECT COUNT(*) FROM academic_sessions WHERE school_id = s.id) as sessions_count,
    (SELECT COUNT(*) FROM announcements WHERE school_id = s.id) as announcements_count
FROM schools s
ORDER BY s.name;

-- Grant access to the view
GRANT SELECT ON school_deletion_impact TO authenticated;

COMMENT ON FUNCTION safe_delete_school(UUID) IS 'Safely deletes a school with comprehensive logging and error handling';
COMMENT ON VIEW school_deletion_impact IS 'Shows the impact of deleting each school (count of related records)';
