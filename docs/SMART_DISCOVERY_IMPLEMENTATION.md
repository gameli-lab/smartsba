# Smart Discovery Implementation - Approach 2

## Overview
This document outlines the implementation of **Smart Discovery** for school selection during login. With this approach, school selection becomes optional, and the system automatically discovers which school(s) a user belongs to based on their identifier.

## Key Features

### 1. Optional School Selection
- School field is now **optional** during login
- Users can skip school selection for faster login
- Users can still provide school name/code if they want to bypass auto-detection

### 2. Smart Auto-Detection
The system attempts to auto-detect a user's school by:
- **Staff (Admin/Teacher)**: Querying by `staff_id` without school constraint
- **Students**: Querying by `admission_number` without school constraint  
- **Parents**: Querying by `full_name + ward_admission_number` without school constraint

### 3. School Selection Dialog
If a user's identifier is found in **multiple schools**:
1. A modal dialog appears showing available schools
2. User selects their school
3. Login is automatically retried with the selected school

### 4. Error Handling
- If identifier not found in any school → "Invalid credentials"
- If identifier found in multiple schools → Show dialog
- If identifier found in one school → Auto-login
- If school provided manually → Use that school, no dialog

## Implementation Details

### Files Modified

#### 1. [src/lib/auth.ts](src/lib/auth.ts)
Added `MultipleSchoolsFoundError` class to signal when multiple schools are found:
```typescript
export class MultipleSchoolsFoundError extends Error {
  schools: SchoolOption[]
  constructor(schools: SchoolOption[]) {
    super('Multiple schools found for this identifier')
    this.name = 'MultipleSchoolsFoundError'
    this.schools = schools
  }
}
```

**Updated Methods:**
- `loginStaff()`: Now queries all schools for staff_id, throws MultipleSchoolsFoundError if multiple matches
- `loginStudent()`: Now queries all schools for admission_number, throws MultipleSchoolsFoundError if multiple matches
- `loginParent()`: Now queries all schools for parent (using ward relationship), throws MultipleSchoolsFoundError if multiple matches

**Key Changes:**
- Changed from `.single()` to `.select()` to get all matching records
- Added logic to detect multiple schools and throw MultipleSchoolsFoundError
- Queries include `schools(id, name)` to get school details for dialog

#### 2. [src/components/auth/SchoolSelectionDialog.tsx](src/components/auth/SchoolSelectionDialog.tsx)
New component to handle school selection:
- Displays list of available schools as radio buttons
- User selects school and clicks "Continue"
- Calls `onSelect` callback with selected school ID
- Shows loading state during login attempt

#### 3. [src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx)
Updated login page to implement Smart Discovery flow:

**New State Variables:**
```typescript
// School Selection Dialog (Smart Discovery)
const [showSchoolDialog, setShowSchoolDialog] = useState(false)
const [availableSchools, setAvailableSchools] = useState<SchoolOption[]>([])
const [pendingLoginData, setPendingLoginData] = useState<{
  role: AuthRole
  wardAdmissionNumber?: string
} | null>(null)
```

**Updated Form:**
- School field is now optional (removed `required` attribute)
- Label shows "(Optional)" with explanation text
- Placeholder explains auto-detection

**Updated Login Handler:**
```typescript
const handleAuthSubmit = async (e: React.FormEvent, schoolIdOverride?: string) => {
  // If no school provided, let auth service auto-detect
  // If MultipleSchoolsFoundError thrown, show school dialog
  // If school provided (override), use that for login attempt
}
```

**School Selection Handler:**
```typescript
const handleSchoolSelected = async (schoolId: string) => {
  setShowSchoolDialog(false)
  // Retry login with selected school
  await handleAuthSubmit(e, schoolId)
}
```

## Login Flow Diagram

```
User enters credentials (without or with optional school)
           ↓
    Call AuthService.login()
           ↓
    ┌─────────────────────────────────┐
    │  Query by identifier            │
    │  (without school constraint)    │
    └─────────────────────────────────┘
           ↓
    ┌─────────────────────────────────┐
    │  How many matches?              │
    └─────────────────────────────────┘
           ↓
    ┌──────┬──────────┬──────┐
    │ 0    │    1     │ 2+   │
    │      │          │      │
    ↓      ↓          ↓
  Error  Login   Show Dialog
         Success   (User selects)
                    ↓
                  Retry login
                  with selected
                  school ID
                    ↓
                  Login Success
```

## Database Queries

### Staff (Admin/Teacher) Auto-Detection
```typescript
let query = supabase
  .from('user_profiles')
  .select('*, schools(id, name)')
  .eq('staff_id', staffId)
  .in('role', ['school_admin', 'teacher'])

// If schoolId provided, filter by it
if (schoolId) {
  query = query.eq('school_id', schoolId)
}
```

### Student Auto-Detection
```typescript
let query = supabase
  .from('user_profiles')
  .select('*, schools(id, name)')
  .eq('admission_number', admissionNumber)
  .eq('role', 'student')

// If schoolId provided, filter by it
if (schoolId) {
  query = query.eq('school_id', schoolId)
}
```

### Parent Auto-Detection
```typescript
let query = supabase
  .from('user_profiles')
  .select(`
    *,
    schools(id, name),
    parent_student_relationships!inner(
      student:students!inner(
        admission_number,
        school_id,
        user_profiles!inner(full_name)
      )
    )
  `)
  .eq('role', 'parent')
  .eq('full_name', parentName)
  .eq('parent_student_relationships.student.admission_number', wardAdmissionNumber)

// If schoolId provided, filter by it
if (schoolId) {
  query = query.eq('parent_student_relationships.student.school_id', schoolId)
}
```

## User Scenarios

### Scenario 1: User with Unique Identifier
**Input:**
- Role: Student
- Admission Number: SBA2024001
- School: (left blank)
- Password: correct

**Flow:**
1. System queries for student with admission_number = SBA2024001
2. Only one match found (belongs to Wellington School)
3. Auto-login successful, user redirected to dashboard

### Scenario 2: User with Identifier in Multiple Schools
**Input:**
- Role: Teacher
- Staff ID: STAFF001
- School: (left blank)
- Password: correct

**Flow:**
1. System queries for teacher with staff_id = STAFF001
2. Multiple matches found (Wellington School, St. Mary's School)
3. SchoolSelectionDialog shown with both schools
4. User selects "St. Mary's School"
5. System retries login with selected school_id
6. Login succeeds, user redirected to dashboard

### Scenario 3: User Provides School Name
**Input:**
- Role: Teacher
- Staff ID: STAFF001
- School: "St. Mary's School"
- Password: correct

**Flow:**
1. System resolves "St. Mary's School" to school_id
2. System queries for teacher with staff_id = STAFF001 AND school_id = resolved_id
3. One match found
4. Login succeeds, no dialog shown, user redirected to dashboard

### Scenario 4: User Not Found
**Input:**
- Role: Student
- Admission Number: INVALID999
- School: (left blank)
- Password: correct

**Flow:**
1. System queries for student with admission_number = INVALID999
2. No matches found
3. Error shown: "Invalid student credentials"

## Benefits

1. **Better User Experience**: Faster login for users with unique identifiers
2. **Security**: No school directory exposed on login page
3. **Flexibility**: Users can still provide school for explicit selection
4. **Backwards Compatible**: Existing workflows still work
5. **Reduced Support**: Fewer users asking "which school ID should I use?"

## Security Considerations

### RLS (Row Level Security)
- Queries use multi-tenant patterns
- No credentials leaked even if school discovery fails
- Each user can only access their own data after authentication

### Error Messages
- Generic "Invalid credentials" error if no matches
- Dialog only shown when legitimate user found in multiple schools
- No information about which schools have matching identifiers

### Password Validation
- Password still required and validated
- School discovery happens BEFORE password verification
- Multi-step protection prevents brute force attacks

## Testing Checklist

- [ ] Student login with unique admission number (no school selection)
- [ ] Student login with admission number in multiple schools
- [ ] Teacher login with unique staff ID (no school selection)
- [ ] Teacher login with staff ID in multiple schools
- [ ] Parent login with unique parent name + ward (no school selection)
- [ ] Parent login with parent name + ward in multiple schools
- [ ] User provides manual school name (bypasses discovery)
- [ ] Invalid credentials show correct error
- [ ] Wrong password shows correct error
- [ ] Dialog appears only when multiple schools found
- [ ] Dialog closes on selection
- [ ] Login successful after school selection

## Future Enhancements

1. **School History**: Remember last-used school for user
2. **Quick Login**: If user has only one school, auto-select on return
3. **School Search**: If many schools in dialog, add search/filter
4. **Mobile Optimization**: Ensure dialog works well on mobile devices
5. **Analytics**: Track how often school discovery dialog is shown

## Migration Notes

No database schema changes required. This is a purely application-level change.

### Backwards Compatibility
- Users who were providing school name/ID before will still work
- Users who were providing school ID before will still work
- New feature only adds auto-detection when school not provided

## Troubleshooting

### Issue: MultipleSchoolsFoundError not thrown
**Check:**
- User actually exists in multiple schools
- Query is not filtering by school_id when it shouldn't be
- `.select()` returning results from multiple schools

### Issue: Dialog not appearing
**Check:**
- SchoolSelectionDialog component imported correctly
- `showSchoolDialog` state is true
- `availableSchools` array is populated

### Issue: Login fails after school selection
**Check:**
- `handleSchoolSelected` properly passes schoolId to `handleAuthSubmit`
- Auth service correctly handles the provided schoolId
- User actually belongs to selected school

## Code Examples

### Catching MultipleSchoolsFoundError

```typescript
try {
  const result = await AuthService.login(credentials)
  // Login successful
} catch (err) {
  if (err instanceof MultipleSchoolsFoundError) {
    // Show school selection dialog
    setAvailableSchools(err.schools)
    setShowSchoolDialog(true)
  } else {
    // Show generic error
    setError(err.message)
  }
}
```

### Using SchoolSelectionDialog

```typescript
{showSchoolDialog && (
  <SchoolSelectionDialog
    schools={availableSchools}
    onSelect={handleSchoolSelected}
    isLoading={isLoading}
  />
)}
```
