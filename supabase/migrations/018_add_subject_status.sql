-- Add is_active column to subjects table for soft-delete support
ALTER TABLE subjects ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Create index for filtering by status
CREATE INDEX idx_subjects_is_active ON subjects(school_id, is_active);

-- Comment documenting the column
COMMENT ON COLUMN subjects.is_active IS 'Soft-delete flag: false indicates deactivated (archived) subject, not deleted';
