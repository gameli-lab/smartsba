# School Deletion with Cascade Functionality

## Overview

The school deletion functionality has been enhanced with proper referential integrity handling to prevent orphaned records. The implementation uses both database-level CASCADE constraints and application-level transaction safety.

## Database Schema CASCADE Constraints

All foreign key relationships with the `schools` table have been configured with `ON DELETE CASCADE`:

```sql
-- Direct references to schools table
user_profiles.school_id -> schools(id) ON DELETE CASCADE
academic_sessions.school_id -> schools(id) ON DELETE CASCADE
classes.school_id -> schools(id) ON DELETE CASCADE
subjects.school_id -> schools(id) ON DELETE CASCADE
teachers.school_id -> schools(id) ON DELETE CASCADE
students.school_id -> schools(id) ON DELETE CASCADE
announcements.school_id -> schools(id) ON DELETE CASCADE
```

## Indirect CASCADE Effects

Through the direct CASCADE constraints, the following tables will also have their records automatically deleted:

- `teacher_assignments` (via teachers)
- `parent_student_links` (via students)
- `scores` (via students and subjects)
- `student_aggregates` (via students, sessions, classes)
- `class_teacher_remarks` (via students, sessions, classes)
- `attendance` (via students, sessions)

## Application-Level Implementation

### Enhanced deleteSchool Function

The `deleteSchool` function in `src/lib/school-operations.ts` now:

1. **Validates input** - Ensures school ID is valid
2. **Verifies existence** - Checks if school exists before deletion
3. **Counts related records** - Gets counts of all related data for logging
4. **Uses database function** - Calls the `safe_delete_school` database function
5. **Comprehensive logging** - Logs all operations and results
6. **Error handling** - Properly handles and reports errors

### Database Function: safe_delete_school

A PostgreSQL function that provides:

- **Existence verification** - Checks if school exists
- **Related record counting** - Counts all related records before deletion
- **Atomic deletion** - Performs deletion in a single transaction
- **Comprehensive logging** - Database-level logging with NOTICE statements
- **Structured results** - Returns JSON with operation results

## Migration: 009_ensure_cascade_constraints.sql

This migration:

- Verifies all CASCADE constraints are in place
- Creates the `safe_delete_school` database function
- Creates a `school_deletion_impact` view for monitoring
- Adds safety indexes and comments

## Usage Examples

### Basic School Deletion

```typescript
import { deleteSchool } from "@/lib/school-operations";

const result = await deleteSchool(schoolId);

if (result.error) {
  console.error("Deletion failed:", result.error.message);
} else {
  console.log("Deleted school:", result.data?.deletedSchool);
  console.log("Related records deleted:", result.data?.relatedRecordsDeleted);
}
```

### Using the Database Function Directly

```sql
SELECT safe_delete_school('school-uuid-here');
```

### Monitoring Deletion Impact

```sql
SELECT * FROM school_deletion_impact WHERE name = 'School Name';
```

## Safety Features

### Pre-deletion Validation

- School existence check
- Related record counting
- Comprehensive logging

### Transaction Safety

- All operations are atomic
- Automatic rollback on errors
- No partial deletions

### Audit Trail

- Complete logging of all operations
- Counts of deleted related records
- Timestamps for all operations

## Error Handling

The system handles various error scenarios:

1. **School not found** - Returns specific error message
2. **Database errors** - Proper error propagation
3. **Permission errors** - Clear error messages
4. **Transaction failures** - Automatic rollback

## Testing

### Manual Testing Steps

1. Create a test school with related data
2. Call the deletion function
3. Verify all related records are deleted
4. Check logs for proper operation recording

### Verification Queries

```sql
-- Check if school exists
SELECT * FROM schools WHERE id = 'school-id';

-- Check for orphaned records
SELECT 'user_profiles' as table_name, COUNT(*) as count
FROM user_profiles WHERE school_id = 'school-id'
UNION ALL
SELECT 'classes', COUNT(*) FROM classes WHERE school_id = 'school-id'
UNION ALL
SELECT 'students', COUNT(*) FROM students WHERE school_id = 'school-id';
```

## Performance Considerations

- Deletion operations are logged but performed efficiently
- CASCADE operations are handled at the database level
- Indexes are in place for deletion queries
- Related record counts are fetched in parallel

## Security

- All operations require proper authentication
- Database function uses SECURITY DEFINER
- Proper permission checks are in place
- Audit logging is comprehensive

## Future Enhancements

1. **Soft Delete Option** - Mark records as deleted instead of hard deletion
2. **Backup Before Delete** - Create backups before deletion
3. **Bulk Deletion** - Support for deleting multiple schools
4. **Recovery Options** - Ability to restore deleted schools
