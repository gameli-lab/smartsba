# Fix Migration Error - Constraint Already Exists

## Error Message
```
ERROR: 42P07: relation "unique_subject_per_level_group" already exists
```

## Solution

The migration was partially applied. The constraint `unique_subject_per_level_group` already exists. Run this simpler SQL in your Supabase SQL Editor:

```sql
-- Drop the existing constraint
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_level_group CASCADE;

-- Make class_id nullable
ALTER TABLE subjects ALTER COLUMN class_id DROP NOT NULL;

-- Add level_group column if it doesn't exist
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS level_group VARCHAR(20);

-- Drop old constraints
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_class CASCADE;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_level CASCADE;

-- Create the new constraint
ALTER TABLE subjects ADD CONSTRAINT unique_subject_per_level_group 
  UNIQUE (school_id, level_group, name) DEFERRABLE INITIALLY DEFERRED;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_subjects_level_group ON subjects(level_group);
CREATE INDEX IF NOT EXISTS idx_subjects_school_level_group ON subjects(school_id, level_group);
```

## Steps

1. Go to your Supabase project: https://app.supabase.com
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. **Copy and paste the SQL above** into the editor
5. Click **Run**
6. Wait for success message

## What This Does

- ✅ Drops the existing constraint that's causing the conflict
- ✅ Makes `class_id` nullable
- ✅ Adds `level_group` column
- ✅ Creates the new constraint correctly
- ✅ Adds performance indexes

## After Running

1. Restart your dev server: `npm run dev`
2. Go to Subjects page
3. Try creating a subject - should work now!

## If It Still Fails

Run these commands one at a time:

```sql
-- Check if constraint exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'subjects' AND constraint_name = 'unique_subject_per_level_group';
```

If it returns a row, the constraint exists. Then run:

```sql
-- Force drop it
DROP CONSTRAINT IF EXISTS unique_subject_per_level_group ON subjects;
```

Then re-run the full SQL above.

## Migration Status

The updated migration file at `/home/torvex/smartsba/supabase/migrations/010_add_level_to_subjects.sql` now includes:
- Better error handling
- Explicit constraint checking
- CASCADE drops to handle dependencies
- Idempotent operations (safe to run multiple times)
