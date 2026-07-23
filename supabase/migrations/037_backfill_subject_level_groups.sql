-- Backfill subject level_group values and enforce NOT NULL
-- After migration 010 added level_group as optional, many subjects may have NULL
-- Migration 033 added infer_level_group_from_class_level() function
-- This migration fills in missing values and makes level_group required

-- Step 1: Backfill level_group for subjects that have a class_id
UPDATE subjects
SET level_group = infer_level_group_from_class_level(c.level)
FROM classes c
WHERE subjects.class_id = c.id
  AND subjects.level_group IS NULL;

-- Step 2: Backfill level_group for subjects still NULL (no class_id or class not found)
-- Safe default: infer from subject name patterns common in the system
UPDATE subjects
SET level_group = 'JHS'
WHERE level_group IS NULL
  AND (
    name ILIKE '%social studies%'
    OR name ILIKE '%integrated science%'
    OR name ILIKE '%ghanaian language%'
    OR name ILIKE '%french%'
    OR name ILIKE '%career technology%'
    OR name ILIKE '%cad%'
    OR name ILIKE '%phe%'
    OR name ILIKE '%rme%'
    OR name ILIKE '%computing%'
  );

UPDATE subjects
SET level_group = 'PRIMARY'
WHERE level_group IS NULL
  AND (
    name ILIKE '%english%'
    OR name ILIKE '%mathematics%'
    OR name ILIKE '%science%'
    OR name ILIKE '%creative arts%'
  );

-- Step 3: Any remaining NULL level_group values default to PRIMARY
UPDATE subjects
SET level_group = 'PRIMARY'
WHERE level_group IS NULL;

-- Step 4: Validation — ensure no NULLs remain
DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_count FROM subjects WHERE level_group IS NULL;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION '% subjects still have NULL level_group after backfill', v_null_count;
  END IF;

  -- Also check for invalid values
  SELECT COUNT(*) INTO v_null_count
  FROM subjects
  WHERE level_group NOT IN ('KG', 'PRIMARY', 'JHS');

  IF v_null_count > 0 THEN
    RAISE EXCEPTION '% subjects have invalid level_group values', v_null_count;
  END IF;
END $$;

-- Step 5: Add check constraint for valid level_group values
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_level_group_check;
ALTER TABLE subjects ADD CONSTRAINT subjects_level_group_check
  CHECK (level_group IN ('KG', 'PRIMARY', 'JHS'));

-- Step 6: Make level_group NOT NULL
ALTER TABLE subjects ALTER COLUMN level_group SET NOT NULL;

-- Step 7: Index for level_group queries (if not already present)
CREATE INDEX IF NOT EXISTS idx_subjects_level_group_lookup
  ON subjects(school_id, level_group, is_active)
  WHERE is_active = true;

-- Done
COMMENT ON COLUMN subjects.level_group IS 'Academic level group (KG, PRIMARY, JHS) - required as of migration 037';