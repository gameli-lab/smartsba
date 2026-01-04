# Smart Discovery - Visual Implementation Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LOGIN PAGE                                   │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Role Selection: Student / Teacher / School Admin / Parent     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  School (Optional)    [_______________________]                 │ │
│  │  Identifier *         [_______________________]                 │ │
│  │  Ward Admission # *   [_______________________]  (Parents only) │ │
│  │  Password *           [_______________________]                 │ │
│  │                                                                  │ │
│  │  [Sign In]                                                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│                    ↓                                                  │
│            handleAuthSubmit()                                        │
│                    ↓                                                  │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ↓
        ┌─────────────────────────────────────┐
        │    AuthService.login()              │
        │                                     │
        │  1. Check school provided?          │
        │     No → Resolve school ID          │
        │                                     │
        │  2. Call role-specific login:       │
        │     - loginStaff()                  │
        │     - loginStudent()                │
        │     - loginParent()                 │
        │                                     │
        │  3. Query identifier in DB          │
        │                                     │
        │  4. Check matches:                  │
        │     0 → Throw Error                 │
        │     1 → Verify password + Login     │
        │     2+ → Throw MultipleSchoolsFound │
        │                                     │
        └─────────────────────────────────────┘
                    │        │        │
         ───────────┼────────┼────────┼───────────
         │          │        │        │          │
         ↓          ↓        ↓        ↓          ↓
    Multi.      Single     Valid   Invalid   Wrong
    School      School     Pass    Creds     Pass
         │          │        │        │         │
         ↓          ↓        ↓        ↓         ↓
    Throw    Return   Return   Throw   Throw
    Multi.    User    User    Error   Error
    Error    Profile Profile
         │          │        │
         ↓          ↓        ↓
    Catch      ✅        ✅
    Error    LOGIN      LOGIN
    in page  SUCCESS    SUCCESS
         │        │        │
         ↓        ↓        ↓
    Show      Redirect  Redirect
    Dialog   to Role    to Role
         │    Dashboard Dashboard
         │
         ↓
    ┌──────────────────────────────┐
    │   SCHOOL SELECTION DIALOG    │
    │                              │
    │  "Select Your School:"       │
    │                              │
    │  ◯ Wellington School         │
    │  ◯ St. Mary's School         │
    │                              │
    │  [Continue]                  │
    └──────────────────────────────┘
         │
         ↓ (user selects school)
         │
         ↓
    Retry handleAuthSubmit()
    with schoolId override
         │
         ↓
    AuthService.login()
    (with schoolId)
         │
         ↓
      ✅ LOGIN SUCCESS
         │
         ↓
      Redirect to Role Dashboard
```

## Component Structure

```
(auth)/login/page.tsx
│
├─── State Management
│    ├─── authRole
│    ├─── identifier
│    ├─── password
│    ├─── selectedSchool
│    ├─── wardAdmissionNumber (parent only)
│    ├─── showSchoolDialog (new)
│    ├─── availableSchools (new)
│    └─── pendingLoginData (new)
│
├─── Event Handlers
│    ├─── handleAuthSubmit()
│    │   └─── Catches MultipleSchoolsFoundError
│    │
│    └─── handleSchoolSelected() (new)
│        └─── Retries login with schoolId
│
├─── Render Components
│    ├─── Tabs (User / Super Admin)
│    ├─── Role Selection Buttons
│    ├─── Form Fields
│    │   ├─── School (now optional)
│    │   ├─── Identifier
│    │   ├─── Ward Admission (conditional)
│    │   └─── Password
│    │
│    └─── SchoolSelectionDialog (new)
│        ├─── Show when availableSchools.length > 0
│        ├─── Pass schools list
│        └─── Pass onSelect callback
│
└─── Conditional Rendering
     ├─── Ward Admission field (only for parent)
     └─── School Dialog (only when MultipleSchoolsFoundError)
```

## Database Schema (Relevant Parts)

```
┌─────────────────────────────┐
│      user_profiles          │
├─────────────────────────────┤
│ user_id (PK)                │
│ email                       │
│ full_name                   │
│ role                        │
│ school_id (FK)              │
│ staff_id (unique, indexed)  │
│ admission_number (indexed)  │
│ created_at                  │
└─────────────────────────────┘
        │ (has)
        ↓
┌─────────────────────────────┐
│        schools              │
├─────────────────────────────┤
│ id (PK)                     │
│ name                        │
│ school_code                 │
│ ...other fields             │
└─────────────────────────────┘
        ↑ (references)
        │
        │
┌─────────────────────────────────────────┐
│  parent_student_relationships           │
├─────────────────────────────────────────┤
│ parent_id (FK) → user_profiles          │
│ student_id (FK) → students              │
└─────────────────────────────────────────┘
                │
                ↓
        ┌─────────────────┐
        │   students      │
        ├─────────────────┤
        │ id (PK)         │
        │ admission_num.  │
        │ school_id (FK)  │
        │ user_id (FK)    │
        └─────────────────┘
```

## Query Examples

### Staff (Admin/Teacher) Auto-Detection

```typescript
// User enters: Staff ID = "STAFF001", no school
supabase
  .from('user_profiles')
  .select('*, schools(id, name)')
  .eq('staff_id', 'STAFF001')
  .in('role', ['school_admin', 'teacher'])

// Returns:
[
  {
    user_id: 'uuid-1',
    staff_id: 'STAFF001',
    school_id: 'sch-001',
    schools: { id: 'sch-001', name: 'Wellington School' }
  },
  {
    user_id: 'uuid-2',
    staff_id: 'STAFF001',
    school_id: 'sch-002',
    schools: { id: 'sch-002', name: 'St. Mary\'s School' }
  }
]

// Multiple matches → Throw MultipleSchoolsFoundError
```

### Student Auto-Detection

```typescript
// User enters: Admission = "SBA2024001", no school
supabase
  .from('user_profiles')
  .select('*, schools(id, name)')
  .eq('admission_number', 'SBA2024001')
  .eq('role', 'student')

// Returns:
[
  {
    user_id: 'uuid-3',
    admission_number: 'SBA2024001',
    school_id: 'sch-001',
    schools: { id: 'sch-001', name: 'Wellington School' }
  }
]

// Single match → Auto-login
```

### Parent Auto-Detection

```typescript
// User enters: Parent Name = "John Doe", Ward = "SBA2024001", no school
supabase
  .from('user_profiles')
  .select(`
    *,
    schools(id, name),
    parent_student_relationships!inner(
      student:students!inner(
        admission_number,
        school_id
      )
    )
  `)
  .eq('role', 'parent')
  .eq('full_name', 'John Doe')
  .eq('parent_student_relationships.student.admission_number', 'SBA2024001')

// Returns:
[
  {
    user_id: 'uuid-4',
    full_name: 'John Doe',
    schools: { id: 'sch-001', name: 'Wellington School' },
    parent_student_relationships: [
      {
        student: {
          admission_number: 'SBA2024001',
          school_id: 'sch-001'
        }
      }
    ]
  }
]

// Single match → Auto-login
```

## Error Handling Flow

```
┌─────────────────────────────────────────┐
│      handleAuthSubmit()                  │
│                                         │
│  try {                                  │
│    const result = login(credentials)    │
│  } catch (err)                          │
└─────────────────────────────────────────┘
                │
                ↓
    ┌───────────────────────┐
    │ Error Type Check      │
    └───────────────────────┘
            │       │
            │       │
    MultipleSchools  Other
    FoundError       Error
            │       │
            ↓       ↓
    ┌──────────┐  ┌──────────┐
    │ Show     │  │ Display  │
    │ Dialog   │  │ Error    │
    │          │  │ Message  │
    │ Extract  │  │          │
    │ schools  │  │ "Invalid │
    │ from err │  │ Creds"   │
    │ .schools │  │          │
    └──────────┘  └──────────┘
```

## State Transitions

```
Initial State:
└─ showSchoolDialog = false
└─ availableSchools = []
└─ pendingLoginData = null

User Clicks "Sign In":
└─ Call handleAuthSubmit()
  └─ isLoading = true
  └─ error = ""

MultipleSchoolsFoundError Caught:
└─ showSchoolDialog = true
└─ availableSchools = [School1, School2, ...]
└─ pendingLoginData = { role, wardAdmissionNumber }
└─ Dialog appears on screen

User Selects School in Dialog:
└─ Call handleSchoolSelected(schoolId)
└─ showSchoolDialog = false
└─ Call handleAuthSubmit(event, schoolId)

Login Success:
└─ isLoading = false
└─ Navigate to role dashboard

Login Error:
└─ isLoading = false
└─ error = error message
└─ showSchoolDialog = false
└─ Form remains on screen
└─ User can retry
```

## UI Flow Mockup

```
INITIAL LOGIN FORM:
┌──────────────────────────────────────────┐
│  Smart SBA System                        │
│  School-Based Assessment Platform        │
│                                          │
│  ┌─ User Login ─ Super Admin ──────────┐ │
│                                        │ │
│  Role Selection:                       │ │
│  [Student] [Teacher] [Admin] [Parent] │ │
│                                        │ │
│  School Name or ID (Optional):         │ │
│  [________________________________]    │ │
│  Leave blank to auto-detect...        │ │
│                                        │ │
│  Admission Number *:                   │ │
│  [________________________________]    │ │
│                                        │ │
│  Password *:                           │ │
│  [________________________________]    │ │
│                                        │ │
│  [Sign In]         [Forgot Password?] │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘


IF MULTIPLE SCHOOLS FOUND:
┌──────────────────────────────────────┐
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (backdrop) │
│   ┌───────────────────────────┐      │
│   │ Select Your School        │      │
│   │                           │      │
│   │ Your identifier is assoc- │      │
│   │ iated with multiple       │      │
│   │ schools. Please select:   │      │
│   │                           │      │
│   │ ◯ Wellington School       │      │
│   │ ◯ St. Mary's School       │      │
│   │                           │      │
│   │ [Continue]                │      │
│   └───────────────────────────┘      │
└──────────────────────────────────────┘
```

## Performance Considerations

### Index Usage
- `staff_id` - indexed for fast lookup
- `admission_number` - indexed for fast lookup
- `user_profiles.role` - can use filter index
- `schools.id` - indexed for relationship join

### Query Optimization
```
Efficient (uses indexes):
├─ WHERE staff_id = 'value'
├─ WHERE admission_number = 'value'
├─ WHERE full_name = 'value'
└─ WHERE role IN (['student', 'teacher'])

Then Joins:
├─ LEFT JOIN schools (fast, indexed)
└─ LEFT JOIN parent_student_relationships (indexed)

No N+1 queries - everything fetched in one go
```

## Security Layers

```
Layer 1: SQL Injection Prevention
└─ Use Supabase parameterized queries
└─ No string concatenation in queries

Layer 2: RLS (Row Level Security)
└─ After authentication, JWT claim controls access
└─ Users can only see their own data

Layer 3: Password Verification
└─ School discovery doesn't bypass auth
└─ Password verified before profile returned

Layer 4: Error Messages
└─ Generic errors on no match
└─ No info about which schools have identifiers
└─ Dialog shown only to legitimate users

Layer 5: Session Management
└─ Supabase handles session tokens
└─ Tokens expire and rotate
```

This multi-layered approach ensures security while improving user experience.
