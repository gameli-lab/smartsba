-- Migration to update subjects table for level-group-based granularity
-- Change from class_id + numeric level (1-9) to level_group (NURSERY, KG, PRIMARY, JHS)

-- Step 1: Make class_id nullable (since new subjects won't have a class_id)
ALTER TABLE subjects 
ALTER COLUMN class_id DROP NOT NULL;

-- Step 2: Add level_group column to subjects table
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS level_group VARCHAR(20);

-- Step 3: Drop old constraints if they exist
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_class CASCADE;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_level CASCADE;

-- Step 4: Remove any duplicate constraint that might exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_subject_per_level_group'
  ) THEN
    ALTER TABLE subjects DROP CONSTRAINT unique_subject_per_level_group;
  END IF;
END $$;

-- Step 5: Add new unique constraint based on school_id, level_group, and name
ALTER TABLE subjects ADD CONSTRAINT unique_subject_per_level_group 
  UNIQUE (school_id, level_group, name) DEFERRABLE INITIALLY DEFERRED;

-- Step 6: Add indexes on level_group for better query performance
CREATE INDEX IF NOT EXISTS idx_subjects_level_group ON subjects(level_group);
CREATE INDEX IF NOT EXISTS idx_subjects_school_level_group ON subjects(school_id, level_group);

-- Note: The class_id and level columns are preserved for backward compatibility
-- Existing data can stay, but new subjects only use level_group
