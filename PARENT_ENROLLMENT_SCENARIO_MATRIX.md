# Parent Enrollment Scenario Matrix

Date: 2026-03-13

## Scope
Validate end-to-end behavior after the guardian-to-parent automation changes in student creation and parent management.

## Resolution Rules (Implemented)
1. Student creation always stores guardian snapshot fields on `students`.
2. If `guardian_email` exists and belongs to `role='parent'`, auto-link the student to that parent.
3. If `guardian_email` exists and is unused, auto-create parent auth + parent profile + link.
4. If `guardian_email` exists but belongs to non-parent role, do not auto-create parent; keep student created and return conflict metadata.
5. Parent management allows manual parent creation with zero wards and later linking.
6. Parent creation with existing parent email reuses the existing parent and links selected wards idempotently.

## Scenario Matrix

| # | Input condition | Expected outcome | Implemented status |
|---|-----------------|------------------|--------------------|
| 1 | New student + new guardian email | Student created, parent auto-created, parent linked, both temp passwords shown | ✅ |
| 2 | New student + guardian email already on parent account | Student created, existing parent auto-linked, no parent temp password | ✅ |
| 3 | New student + guardian email on non-parent role | Student created, parent not auto-created, conflict notice shown | ✅ |
| 4 | New student + no guardian email | Student created, parent resolution skipped | ✅ |
| 5 | Manual parent create + no wards selected | Parent account created only (unlinked), visible in parent list | ✅ |
| 6 | Manual parent create + existing parent email + wards selected | Existing parent reused, only missing links inserted | ✅ |
| 7 | Manual parent create + existing non-parent email | Action blocked with explicit role conflict message | ✅ |
| 8 | Duplicate link attempt | No duplicate link rows inserted | ✅ |

## Audit Events
Expected actions:
- `student_create_auto_parent_created`
- `student_create_auto_parent_linked`
- `student_create_parent_resolution_skipped_no_email`
- `student_create_parent_resolution_skipped_invalid_email`
- `student_create_parent_resolution_conflict_non_parent_email`
- `create_parent_and_link`
- `create_parent_only`
- `link_existing_parent_from_create_flow`
- `reuse_existing_parent_no_link`

## Verification Performed
- Full automated suite executed: **10/10 suites passed, 133/133 tests passed**.
- Type diagnostics on edited files: no errors.

## Recommended Manual QA (UI)
1. Create student with fresh guardian email; confirm parent temp password appears.
2. Create second student with same guardian email; confirm existing parent auto-link message (no new parent password).
3. Create student using guardian email from teacher account; confirm conflict message and successful student creation.
4. Create parent without selecting wards; confirm parent appears as unlinked.
5. Use Link Existing Parent to attach an unlinked parent to a ward.
6. Re-run same link; confirm no duplicate relationship is created.

## Pass Criteria
- No failed action for valid paths.
- No duplicate parent auth/profile creation for repeated guardian email.
- Parent list includes unlinked parent records for the school.
- Audit logs capture all parent resolution outcomes.
