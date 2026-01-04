-- Add status column to classes table for lifecycle management (Stage 6)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived'));
CREATE INDEX IF NOT EXISTS idx_classes_school_status ON classes(school_id, status);
