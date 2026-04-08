# Database Migration: Add Level Column to Subjects Table

## Summary
The application has been updated to use level-based subject granularity instead of class-based. However, the database schema needs to be updated to reflect this change.

## Error Encountered
```
Error creating subject: {
  code: 'PGRST204',
  message: "Could not find the 'level' column of 'subjects' in the schema cache"
}
```

This error occurs because the subjects table doesn't yet have the `level` column that the application code is trying to use.

## Required Changes

The migration file has been created at: `/home/torvex/smartsba/supabase/migrations/010_add_level_to_subjects.sql`

This migration will:
1. **Add the `level` column** to the subjects table (INTEGER type)
2. **Update constraints** to use `(school_id, level, name)` instead of `(school_id, class_id, name)`
3. **Add indexes** on level for better query performance
4. **Preserve existing data** - class_id column remains for backward compatibility

## How to Apply the Migration

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project at https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Create a new query and paste the contents of: `/home/torvex/smartsba/supabase/migrations/010_add_level_to_subjects.sql`
5. Click **Run** button
6. Confirm that the migration executes successfully

### Option 2: Via Supabase CLI

If you have the Supabase CLI installed:

```bash
cd /home/torvex/smartsba
supabase migration push 010_add_level_to_subjects.sql
```

### Option 3: Via Terminal (if you have direct database access)

```bash
psql "your_database_connection_string" < supabase/migrations/010_add_level_to_subjects.sql
```

## Migration SQL Content

```sql
-- Add level column to subjects table
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS level INTEGER;

-- Update the unique constraint to be based on level instead of class_id
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_class;

-- Add new unique constraint based on school_id, level, and name
ALTER TABLE subjects ADD CONSTRAINT unique_subject_per_level 
  UNIQUE (school_id, level, name) DEFERRABLE INITIALLY DEFERRED;

-- Add indexes on level for better query performance
CREATE INDEX IF NOT EXISTS idx_subjects_level ON subjects(level);
CREATE INDEX IF NOT EXISTS idx_subjects_school_level ON subjects(school_id, level);
```

## Next Steps After Migration

1. **Restart your application** - the dev server will need to refresh the schema cache
2. **Test subject creation** - try creating a new subject from the UI
3. **Migrate existing subjects** (if any) - existing subjects won't have level values yet. You can either:
   - Delete existing subjects and recreate them with levels
   - Manually set levels for existing subjects based on their class's level

## Verification

After applying the migration, you can verify it worked by:

1. Check that subject creation no longer gives the PGRST204 error
2. Verify level dropdown shows distinct levels (not duplicates like "Junior High School" three times)
3. Confirm that subject lists display the level correctly (e.g., "Junior High School 7" instead of "Junior High School")

## Changes Made to Application Code

The following files were updated to use level-based granularity:

1. **src/types/index.ts** - Subject interface now has `level: number` instead of `class_id`
2. **src/app/(school-admin)/school-admin/subjects/create-subject-dialog.tsx** - Dialog now selects level only
3. **src/app/(school-admin)/school-admin/subjects/edit-subject-dialog.tsx** - Dialog now edits level only
4. **src/app/(school-admin)/school-admin/subjects/subjects-list.tsx** - Table displays level instead of class
5. **src/app/(school-admin)/school-admin/subjects/actions.ts** - Create and update actions use level field
6. **supabase/migrations/010_add_level_to_subjects.sql** - NEW - Database schema migration

## Notes

- The `class_id` column is preserved in the schema for backward compatibility but is no longer actively used
- Level-based subjects automatically apply to all classes at that level
- Teachers are still assigned to specific classes, even though subjects are now level-based
- The unique constraint ensures no duplicate subject names per level within a school
