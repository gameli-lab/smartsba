# Applying the Database Migration

## Current Issue
The application is trying to create subjects with `level_group` but the database still requires `class_id`. The migration file has been updated and now needs to be applied to your Supabase database.

## Updated Migration File
**Location**: `/home/torvex/smartsba/supabase/migrations/010_add_level_to_subjects.sql`

**What it does**:
1. Makes `class_id` column nullable (so new subjects don't need it)
2. Adds `level_group` VARCHAR(20) column
3. Updates unique constraints to use `level_group`
4. Adds performance indexes

## How to Apply - Choose One Option

### ✅ Option 1: Supabase Dashboard (Easiest)

1. Open your Supabase project: https://app.supabase.com
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the SQL below:

```sql
-- Make class_id nullable
ALTER TABLE subjects 
ALTER COLUMN class_id DROP NOT NULL;

-- Add level_group column
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS level_group VARCHAR(20);

-- Drop old constraints
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_class;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_level;

-- Add new unique constraint
ALTER TABLE subjects ADD CONSTRAINT unique_subject_per_level_group 
  UNIQUE (school_id, level_group, name) DEFERRABLE INITIALLY DEFERRED;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_subjects_level_group ON subjects(level_group);
CREATE INDEX IF NOT EXISTS idx_subjects_school_level_group ON subjects(school_id, level_group);
```

5. Click **Run**
6. Wait for success confirmation

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
cd /home/torvex/smartsba
supabase migration list
supabase migration push
```

### Option 3: Direct Database Access

If you have psql installed:

```bash
# Replace with your actual database URL
psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" < supabase/migrations/010_add_level_to_subjects.sql
```

## After Applying Migration

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Test subject creation**:
   - Go to Subjects page
   - Click "New Subject"
   - Verify dropdown shows only 4 options: Nursery, Kindergarten, Primary, Junior High School
   - Select "Primary" and create a subject
   - Should succeed without errors

3. **Verify in database** (optional):
   ```sql
   -- Check subjects table structure
   \d subjects
   
   -- Should see:
   -- - class_id (nullable now)
   -- - level_group (new VARCHAR column)
   
   -- Check constraints
   SELECT constraint_name 
   FROM information_schema.table_constraints 
   WHERE table_name = 'subjects';
   
   -- Should see: unique_subject_per_level_group (not unique_subject_per_class)
   ```

## Common Issues After Migration

### Issue: Still getting "null value in column class_id" error
- The migration didn't apply successfully
- Check Supabase SQL Editor for error messages
- Make sure you ran the full migration (all statements)

### Issue: "duplicate key value violates unique constraint"
- There are existing subjects that would violate the new constraint
- This happens if you have duplicate subject names in the same level group
- Solution: Delete duplicate subjects and recreate them

### Issue: Migration fails on "ALTER COLUMN"
- Some database versions have syntax differences
- Try this alternative:
  ```sql
  ALTER TABLE subjects ALTER COLUMN class_id DROP NOT NULL;
  ```

## Migration Contents

The migration file is at: `/home/torvex/smartsba/supabase/migrations/010_add_level_to_subjects.sql`

It contains:
- Make `class_id` nullable for backward compatibility
- Add `level_group` column (required for new subjects)
- Drop old constraints based on class_id
- Add new constraints based on level_group
- Add indexes for query performance

## What Gets Changed

| Item | Before | After |
|------|--------|-------|
| `class_id` constraint | NOT NULL | Nullable |
| `level_group` column | Does not exist | VARCHAR(20) |
| Unique constraint | `(school_id, class_id, name)` | `(school_id, level_group, name)` |
| Subject selection | 9 numeric levels (1-9) | 4 level groups |

## Next Steps

1. ✅ Apply the migration to your database
2. ✅ Restart your dev server (`npm run dev`)
3. ✅ Test creating a subject
4. ✅ Verify the dropdown shows 4 level options

The application code is already updated and ready - just waiting for the database schema to be updated!
