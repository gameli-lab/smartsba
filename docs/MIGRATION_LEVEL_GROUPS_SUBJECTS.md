# Database Migration: Add Level Group Column to Subjects Table

## Summary
The application has been updated to use **level-group-based** subject organization instead of numeric level or class-based. This means subjects are now organized by broad level categories (Primary, Junior High School, Kindergarten, Nursery) rather than by specific numeric levels or individual classes.

## Error Encountered
```
Error creating subject: {
  code: 'PGRST204',
  message: "Could not find the 'level_group' column of 'subjects' in the schema cache"
}
```

This error occurs because the subjects table doesn't yet have the `level_group` column that the application code is trying to use.

## What Changed

### Before
- Subjects were created per numeric level (Primary 1, Primary 2, ..., JHS 7, JHS 8, JHS 9)
- Users had 9 different numeric level options in the dropdown
- Duplicate "Junior High School" appeared 3 times, "Primary" appeared 6 times, etc.

### After ✅
- Subjects are created per level group (Primary, JHS, Kindergarten, Nursery)
- Users have only 4 level group options in the dropdown
- One "Primary" subject applies to ALL primary classes (Primary 1-6)
- One "JHS" subject applies to ALL JHS classes (JHS 7-9)
- No more duplicate level displays

## Required Changes

The migration file has been created at: `/home/torvex/smartsba/supabase/migrations/010_add_level_to_subjects.sql`

This migration will:
1. **Add the `level_group` column** to the subjects table (VARCHAR type)
2. **Update constraints** to use `(school_id, level_group, name)` instead of `(school_id, class_id, name)`
3. **Add indexes** on level_group for better query performance
4. **Preserve existing data** - class_id and numeric level columns remain for backward compatibility

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
-- Add level_group column to subjects table
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS level_group VARCHAR(20);

-- Update the unique constraint to be based on level_group instead of class_id
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_class;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_level;

-- Add new unique constraint based on school_id, level_group, and name
ALTER TABLE subjects ADD CONSTRAINT unique_subject_per_level_group 
  UNIQUE (school_id, level_group, name) DEFERRABLE INITIALLY DEFERRED;

-- Add indexes on level_group for better query performance
CREATE INDEX IF NOT EXISTS idx_subjects_level_group ON subjects(level_group);
CREATE INDEX IF NOT EXISTS idx_subjects_school_level_group ON subjects(school_id, level_group);
```

## Next Steps After Migration

1. **Restart your application** - the dev server will need to refresh the schema cache
2. **Test subject creation** - try creating a new subject from the UI
3. **Verify the dropdown** - should now show only 4 options: Nursery, Kindergarten, Primary, Junior High School
4. **Migrate existing subjects** (if any) - existing subjects won't have level_group values yet. You can either:
   - Delete existing subjects and recreate them with level groups
   - Manually set level_group for existing subjects based on their context

## Verification

After applying the migration, you can verify it worked by:

1. ✅ Subject creation no longer gives the PGRST204 error
2. ✅ Level dropdown shows only 4 distinct options
3. ✅ Level displays in subject lists show the group name (e.g., "Primary" not "Primary 1")
4. ✅ Creating one "Mathematics" subject for "Primary" applies to all Primary classes (1-6)

## Changes Made to Application Code

### Updated Files:

1. **src/types/index.ts** 
   - Subject interface: `level: number` → `level_group: 'NURSERY' | 'KG' | 'PRIMARY' | 'JHS'`

2. **src/app/(school-admin)/school-admin/subjects/create-subject-dialog.tsx**
   - Shows 4 level group options instead of 9 numeric levels
   - Passes `level_group` to createSubject action

3. **src/app/(school-admin)/school-admin/subjects/edit-subject-dialog.tsx**
   - Selects from 4 level group options
   - Passes `level_group` to updateSubject action

4. **src/app/(school-admin)/school-admin/subjects/subjects-list.tsx**
   - Displays level group name (e.g., "Primary") instead of numeric level

5. **src/app/(school-admin)/school-admin/subjects/actions.ts**
   - `createSubject()`: accepts `level_group` field
   - `updateSubject()`: handles `level_group` field updates
   - Unique constraint now checks `(school_id, level_group, name)`

6. **supabase/migrations/010_add_level_to_subjects.sql** (NEW)
   - Database schema migration

## Important Notes

- The `class_id` and numeric `level` columns are preserved in the schema for backward compatibility
- Level-group-based subjects automatically apply to all classes in that group
- Teachers are still assigned to specific classes, even though subjects are now level-group-based
- The unique constraint ensures no duplicate subject names per level group within a school
- Valid `level_group` values: `NURSERY`, `KG`, `PRIMARY`, `JHS`

## Rollback

If you need to rollback this migration:

```sql
-- Rollback migration (careful - will lose new data)
ALTER TABLE subjects DROP COLUMN IF EXISTS level_group;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_level_group;
DROP INDEX IF EXISTS idx_subjects_level_group;
DROP INDEX IF EXISTS idx_subjects_school_level_group;
```
