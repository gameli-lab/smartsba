-- RESET SCRIPT: Run this FIRST to clean up existing tables
-- This will drop all existing tables and start fresh
-- Using CASCADE to handle dependencies automatically

-- Drop all tables with CASCADE (this handles all dependencies)
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS class_teacher_remarks CASCADE;
DROP TABLE IF EXISTS student_aggregates CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS parent_student_links CASCADE;
DROP TABLE IF EXISTS teacher_assignments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS academic_sessions CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS schools CASCADE;

-- Drop all custom types
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS gender CASCADE;
DROP TYPE IF EXISTS academic_term CASCADE;
DROP TYPE IF EXISTS grade CASCADE;
DROP TYPE IF EXISTS promotion_status CASCADE;

-- Drop all functions (CASCADE will handle dependencies)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS calculate_student_aggregate(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS update_student_aggregate_trigger() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_profile() CASCADE;
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS get_user_school_id() CASCADE;
DROP FUNCTION IF EXISTS get_user_role() CASCADE;

-- Success message
SELECT 'Database reset completed successfully! You can now run 001_initial_schema.sql' as message;
