# Task 001: Backfill Subject level_group

**Assigned Agent**: `engineering-backend-architect.md`
**Priority**: High
**Status**: Pending

## Context

Migration 010 (`010_add_level_to_subjects.sql`) added `level_group` to the `subjects` table but made it optional for backward compatibility. Many existing subjects may have `NULL` level_group. Migration 033 (`033_school_academics_and_subject_configuration.sql`) introduced the new subject catalog and provisioning system that relies on `level_group`.

The TypeScript types have been updated (`src/types/index.ts`, `src/types/supabase.ts`) to require `level_group` as `'KG' | 'PRIMARY' | 'JHS'`. Code in `src/lib/school-provisioning.ts` and `src/app/(school-admin)/school-admin/subjects/actions.ts` now uses `level_group`.

## Task

Create a new migration file at `supabase/migrations/037_backfill_subject_level_groups.sql` that:

1. **Backfills** subjects with `level_group IS NULL` by inferring from:
   - The `class_id` → look up the class's `level` → `infer_level_group_from_class_level()` function (exists from migration 033)
   - If `class_id` is also NULL, mark as `'PRIMARY'` (safe default for existing data)

2. **Makes `level_group` NOT NULL** after backfill (adds `ALTER TABLE subjects ALTER COLUMN level_group SET NOT NULL;`)

3. **Adds a check constraint** to ensure `level_group` is one of: `'KG'`, `'PRIMARY'`, `'JHS'`

4. **Adds a validation query** at the end to verify no NULLs remain (raises exception if any)

## Relevant Schema

```sql
-- Current subjects table definition (after migrations 001, 010, 033)
-- Table already has: id, school_id, class_id (nullable), level_group (nullable), 
--   name, code, description, is_core, is_active, created_at, updated_at
```

## References
- `supabase/migrations/010_add_level_to_subjects.sql` - original level_group addition
- `supabase/migrations/033_school_academics_and_subject_configuration.sql` - has `infer_level_group_from_class_level()` function
- `src/lib/school-provisioning.ts` - current code using level_group
- `src/lib/core-subjects.ts` - `CORE_SUBJECTS_BY_LEVEL` structure
- `src/types/index.ts` - updated Subject type