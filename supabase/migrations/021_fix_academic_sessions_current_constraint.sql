-- Fix academic_sessions current-session uniqueness constraint
-- Problem: UNIQUE (school_id, is_current) allows only one FALSE and one TRUE row per school,
-- which breaks updates when multiple historical sessions exist.
-- Solution: enforce uniqueness only for rows where is_current = TRUE.

-- Drop the problematic table constraint from initial schema
ALTER TABLE academic_sessions
  DROP CONSTRAINT IF EXISTS unique_current_session_per_school;

-- Ensure we only enforce one CURRENT session per school (many FALSE rows allowed)
CREATE UNIQUE INDEX IF NOT EXISTS unique_current_session_per_school_true
  ON academic_sessions (school_id)
  WHERE is_current = TRUE;
