# Task 002: Verify Teacher Dashboard Service

**Assigned Agent**: `engineering-code-reviewer.md`
**Priority**: Medium
**Status**: Pending

## Context

The `Subject` TypeScript type was recently updated in `src/types/index.ts`:
- Added `class_id?: string` (was missing, now matches DB schema)
- Changed `level_group` from `'NURSERY' | 'KG' | 'PRIMARY' | 'JHS'` to `'KG' | 'PRIMARY' | 'JHS'`

The `teacherDashboardService.ts` queries the `subjects` table and references `class_id` on the result. This needs verification that the type changes don't break the service.

## Task

Review `src/services/teacherDashboardService.ts` for type compatibility with the updated `Subject` interface:

1. **Check line 42**: `supabase.from('subjects').select('id, name, class_id').in('class_id', classIds)` — verify this query still works with the new Subject type (class_id is now optional, but the query explicitly selects it)

2. **Check line 52**: `const subjects = (subjectsData || []) as Array<{ id: string; name: string; class_id: string }>` — verify this cast is still valid

3. **Check line 55**: `const selectedSubjectId = filters?.subjectId || subjects.find((s) => s.class_id === selectedClassId)?.id` — verify this filter logic still works

4. **General review**: Scan the entire file for any other Subject type usage that might break

## Deliverable

A brief report with:
- 🔴 Blockers (must fix before deployment)
- 🟡 Suggestions (should fix but not blocking)
- 💭 Nits (nice-to-haves)

## References
- `src/services/teacherDashboardService.ts` - the service to review
- `src/types/index.ts` - updated Subject type
- `src/app/(school-admin)/school-admin/classes/actions.ts` - also queries subjects with class_id