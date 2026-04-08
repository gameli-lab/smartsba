# STAGE 2: IDENTIFIER MAPPING (SAFE ADAPTATION)
**Status**: ANALYSIS & PLANNING COMPLETE - NO CODE CHANGES YET  
**Date**: January 3, 2026  
**Scope**: Document current identifier mapping system and verify safety

---

## EXECUTIVE SUMMARY

✅ **GOOD NEWS**: The identifier mapping system **already exists and works safely**.

Current architecture:
- **Super Admin**: Uses email directly (no mapping needed)
- **Staff (Admin/Teacher)**: Staff ID → maps to email via database lookup
- **Student**: Admission Number → maps to email via database lookup
- **Parent**: Parent Name → maps to email via database lookup

**Existing users will continue to authenticate without any changes** because the system already maps identifiers to emails before calling Supabase Auth.

---

## CURRENT IDENTIFIER MAPPING SYSTEM

### Architecture Overview

```
User Input (Identifier)
        ↓
Lookup in user_profiles table
        ↓
Extract email from profile
        ↓
Authenticate via Supabase Auth
        ↓
Return user session
```

### Detailed Flow by Role

#### Super Admin Login
```
INPUT:
  - Email: "admin@smartsba.com"
  - Password: "•••••••••"

PROCESS:
  1. Call supabase.auth.signInWithPassword(email, password)
  2. Supabase Auth validates credentials
  3. Query user_profiles to verify role === 'super_admin'
  4. If role mismatch, sign out and throw error

AUTH STORAGE:
  - auth.users.email = "admin@smartsba.com" ✅ (real email)
  - user_profiles.email = "admin@smartsba.com" ✅ (same)

SECURITY:
  - ✅ Email-only login (no other roles can use this path)
  - ✅ Role verification required
  - ✅ Immediate signout on role mismatch
  - ✅ Exclusive to super admin
```

#### Staff Login (School Admin & Teacher)
```
INPUT:
  - Staff ID: "STAFF001"
  - Password: "•••••••••"
  - School ID: "school-uuid"

PROCESS:
  1. Query user_profiles WHERE staff_id = "STAFF001"
  2. Filter: role IN ('school_admin', 'teacher')
  3. Filter: school_id = provided school
  4. If no match → throw "Invalid staff credentials"
  5. Extract email from found profile
  6. Call supabase.auth.signInWithPassword(email, password)
  7. Supabase Auth validates credentials
  8. Call setUserClaims() for JWT custom claims

AUTH STORAGE:
  - auth.users.email = "teacher@school.com" (real email from profile)
  - user_profiles.staff_id = "STAFF001" (lookup identifier)
  - user_profiles.email = "teacher@school.com" (same as auth)
  - user_profiles.role = 'teacher'
  - user_profiles.school_id = 'school-uuid'

DATA FLOW:
  User enters: STAFF001
       ↓
  System finds: user_profiles row with staff_id = "STAFF001"
       ↓
  Extracts: email = "teacher@school.com"
       ↓
  Authenticates: supabase.auth.signInWithPassword("teacher@school.com", password)
       ↓
  Returns: { user, profile }

SECURITY:
  - ✅ Identifier (staff_id) not exposed to Supabase Auth
  - ✅ Real email used for authentication
  - ✅ School verification prevents cross-school login
  - ✅ Role verification (school_admin or teacher only)
```

#### Student Login
```
INPUT:
  - Admission Number: "SBA2024001"
  - Password: "•••••••••"
  - School ID: "school-uuid"

PROCESS:
  1. Query user_profiles WHERE admission_number = "SBA2024001"
  2. Filter: role = 'student'
  3. Filter: school_id = provided school
  4. If no match → throw "Invalid student credentials"
  5. Extract email from found profile
  6. Call supabase.auth.signInWithPassword(email, password)
  7. Supabase Auth validates credentials
  8. Return { user, profile }

AUTH STORAGE:
  - auth.users.email = "student@school.com" (real email from profile)
  - user_profiles.admission_number = "SBA2024001" (lookup identifier)
  - user_profiles.email = "student@school.com" (same as auth)
  - user_profiles.role = 'student'
  - user_profiles.school_id = 'school-uuid'

DATA FLOW:
  User enters: SBA2024001
       ↓
  System finds: user_profiles row with admission_number = "SBA2024001"
       ↓
  Extracts: email = "student@school.com"
       ↓
  Authenticates: supabase.auth.signInWithPassword("student@school.com", password)
       ↓
  Returns: { user, profile }

SECURITY:
  - ✅ Admission number not sent to Supabase Auth
  - ✅ Real email used for authentication
  - ✅ School verification prevents cross-school access
  - ✅ Role verification (student only)
```

#### Parent Login
```
INPUT:
  - Parent Name: "John Doe"
  - Ward Admission Number: "SBA2024002"
  - Password: "•••••••••"
  - School ID: "school-uuid"

PROCESS:
  1. Query user_profiles WHERE full_name = "John Doe" AND role = 'parent'
  2. Join with parent_student_relationships
  3. Verify student with admission_number = "SBA2024002"
  4. Verify student's school_id = provided school
  5. If no match → throw error
  6. Extract email from found profile
  7. Call supabase.auth.signInWithPassword(email, password)
  8. Supabase Auth validates credentials
  9. Return { user, profile }

AUTH STORAGE:
  - auth.users.email = "parent@domain.com" (real email from profile)
  - user_profiles.full_name = "John Doe" (lookup identifier)
  - user_profiles.email = "parent@domain.com" (same as auth)
  - user_profiles.role = 'parent'
  - parent_student_relationships.parent_id → student_id

RELATIONSHIPS:
  user_profiles (parent)
    ↓ parent_student_relationships
    ↓ students (ward)
    ↓ user_profiles (ward profile)

DATA FLOW:
  User enters: "John Doe" + ward "SBA2024002"
       ↓
  System finds: user_profiles row with full_name = "John Doe"
       ↓
  Verifies: parent_student_relationships shows ward SBA2024002
       ↓
  Extracts: email = "parent@domain.com"
       ↓
  Authenticates: supabase.auth.signInWithPassword("parent@domain.com", password)
       ↓
  Returns: { user, profile }

SECURITY:
  - ✅ Parent name not sent to Supabase Auth
  - ✅ Ward admission verified (not just parent name)
  - ✅ Real email used for authentication
  - ✅ School verification of ward
  - ✅ Role verification (parent only)
```

---

## USER PROFILE STRUCTURE

**Table**: `user_profiles`

| Column | Type | Purpose | Used By |
|--------|------|---------|---------|
| `id` | UUID | Primary key | All |
| `user_id` | UUID | FK to auth.users | Session lookup |
| `school_id` | UUID | FK to schools | School isolation |
| `role` | ENUM | User role | Access control |
| `email` | VARCHAR | Email for auth | Supabase Auth |
| `full_name` | VARCHAR | Display name | UI, parent lookup |
| `status` | ENUM | Active/disabled | Access control |
| `staff_id` | VARCHAR | Identifier for staff | Staff login lookup |
| `admission_number` | VARCHAR | Identifier for students | Student login lookup |
| `phone` | VARCHAR | Contact | UI |
| `address` | VARCHAR | Address | UI |
| `gender` | ENUM | Gender | UI |
| `date_of_birth` | DATE | DOB | UI |
| `created_at` | TIMESTAMP | Audit | Audit trail |
| `updated_at` | TIMESTAMP | Audit | Audit trail |

---

## WHY SYNTHETIC EMAILS NOT NEEDED

**Option 1: Synthetic Emails** (NOT CHOSEN)
```
staff_id@school.smartsba.internal
admission_no@student.smartsba.internal
parent_name@parent.smartsba.internal
```

**Downsides**:
- Requires creating auth users with synthetic emails
- Migration of existing users needed
- Breaks existing password reset workflows
- Email doesn't match real email (confusing)
- Cannot use real email notifications

**Option 2: Real Emails with Lookup** (CURRENT - SAFE)
```
loginStaff("STAFF001")
  → Query: WHERE staff_id = "STAFF001"
  → Gets: user_profiles.email = "real@email.com"
  → Auth: signInWithPassword("real@email.com", password)
```

**Advantages**:
- ✅ No migration needed
- ✅ Real emails for notifications
- ✅ Existing users work immediately
- ✅ Better security (email not tied to identifier)
- ✅ Can change identifier without affecting auth

---

## BACKWARD COMPATIBILITY VERIFICATION

### Existing User Authentication

**Before (still works)**:
```
User has:
  auth.users.email = "teacher@school.com"
  user_profiles.staff_id = "STAFF001"
  user_profiles.email = "teacher@school.com"
  user_profiles.role = 'teacher'
```

**Login process**:
```
1. User enters Staff ID: "STAFF001"
2. System queries: user_profiles WHERE staff_id = "STAFF001"
3. Finds: email = "teacher@school.com"
4. Authenticates: signInWithPassword("teacher@school.com", password)
5. Session established ✅
```

**Result**: ✅ No data migration needed. Existing users authenticate seamlessly.

### Email-Based Users

If Super Admin knows email:
```
Super Admin enters: "admin@smartsba.com"
Authenticates directly: signInWithPassword("admin@smartsba.com", password)
Session established ✅
```

**Result**: ✅ Super admin flow unchanged.

---

## DATABASE SCHEMA VERIFICATION

### Required Tables

✅ `auth.users` (Supabase managed)
- Stores: id, email, encrypted_password, etc.
- Used for: Supabase Auth signInWithPassword()

✅ `user_profiles` (SmartSBA managed)
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  school_id UUID REFERENCES schools(id),
  role VARCHAR NOT NULL CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'student', 'parent')),
  email VARCHAR UNIQUE NOT NULL,
  full_name VARCHAR NOT NULL,
  staff_id VARCHAR UNIQUE,
  admission_number VARCHAR UNIQUE,
  phone VARCHAR,
  address VARCHAR,
  gender VARCHAR,
  date_of_birth DATE,
  status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

✅ `parent_student_relationships` (for parent login verification)
```sql
CREATE TABLE parent_student_relationships (
  id UUID PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES user_profiles(id),
  student_id UUID NOT NULL REFERENCES user_profiles(id),
  relationship VARCHAR NOT NULL, -- e.g., "Father", "Mother", "Guardian"
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

✅ `students` (for student records)
```sql
CREATE TABLE students (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  school_id UUID NOT NULL REFERENCES schools(id),
  admission_number VARCHAR UNIQUE NOT NULL,
  ...
);
```

---

## IDENTIFIER UNIQUENESS REQUIREMENTS

| Identifier | Required | Scope | Reason |
|-----------|----------|-------|--------|
| `email` | YES | Global (unique constraint) | Supabase Auth requires unique email |
| `staff_id` | NO | Per school (unique index) | Multiple schools can have "STAFF001" |
| `admission_number` | NO | Per school (unique index) | Multiple schools can have "SBA2024001" |
| `full_name` | NO | Per school (no constraint) | Multiple parents can have same name |

**Current Implementation**:
- ✅ Email: Global unique (in auth.users)
- ✅ Staff ID: Per-school lookup (query filters by school_id)
- ✅ Admission Number: Per-school lookup (query filters by school_id)
- ✅ Parent Name: Per-school lookup + ward verification

**Safety**: 
- ✅ School isolation prevents cross-school confusion
- ✅ Ward verification prevents parent impersonation
- ✅ Email uniqueness ensures auth works correctly

---

## MIGRATION PLAN (IF FUTURE CHANGE NEEDED)

**Current state**: Real emails with identifier lookup ✅

**If synthetic emails ever needed**:

```sql
-- Step 1: Create auth users with synthetic emails (non-breaking)
INSERT INTO auth.users (id, email, encrypted_password, ...)
SELECT 
  uuid_generate_v4(),
  staff_id || '@school.smartsba.internal',
  encrypted_password,
  ...
FROM user_profiles WHERE staff_id IS NOT NULL;

-- Step 2: Update user_profiles to reference new synthetic email
UPDATE user_profiles SET email = staff_id || '@school.smartsba.internal'
WHERE staff_id IS NOT NULL;

-- Step 3: Update login methods to use synthetic email
-- (No change needed - already maps identifier to email)

-- Step 4: Disable old auth users (optional)
-- UPDATE auth.users SET disable_at = now()
-- WHERE email NOT IN (SELECT email FROM user_profiles);
```

**Result**: Switchover possible without code changes. But NOT recommended yet (breaks notifications, password resets).

---

## SECURITY IMPLICATIONS

### Data Exposure Risk

**Identifier Input (UI)**
```
User types: "STAFF001" ← Visible on screen
```
**Status**: ✅ SAFE - Staff ID visible to user typing, not to backend

**Email in Database (Database)**
```
user_profiles.email = "teacher@school.com" ← Stored in DB
```
**Status**: ⚠️ READABLE - Email visible via RLS policies to authenticated users
**Mitigation**: RLS restricts read to own profile or school-scoped records

**Email in Auth (Supabase)**
```
auth.users.email = "teacher@school.com" ← Managed by Supabase
```
**Status**: ✅ SECURE - Only accessible via Auth API with valid JWT

**Email in Transit (Network)**
```
signInWithPassword("teacher@school.com", password) ← HTTPS
```
**Status**: ✅ ENCRYPTED - All connections use HTTPS/TLS

### Authentication Security

✅ Password hashing: Supabase bcrypt (industry standard)  
✅ Session management: JWT tokens with expiration  
✅ School isolation: SQL WHERE school_id = X  
✅ Role verification: Multiple checks (profile lookup, role assertion)  
✅ Credential validation: Password never logged or exposed  

---

## MAPPING SUMMARY TABLE

| Role | User Input | Lookup Field | Lookup Result | Auth Method |
|------|-----------|--------------|---------------|------------|
| Super Admin | Email | N/A (direct) | N/A | Direct email auth |
| School Admin | Staff ID | user_profiles.staff_id | email | Email auth |
| Teacher | Staff ID | user_profiles.staff_id | email | Email auth |
| Student | Admission # | user_profiles.admission_number | email | Email auth |
| Parent | Parent Name | user_profiles.full_name | email | Email auth |

---

## CURRENT IMPLEMENTATION SAFETY CHECK

✅ **Existing users continue to work** - No changes to auth.users data  
✅ **No synthetic emails created** - Real emails maintained  
✅ **School isolation enforced** - SQL queries filter by school_id  
✅ **Role verification in place** - Role checked after credential validation  
✅ **Password handling unchanged** - Supabase Auth manages encryption  
✅ **Identifier lookup is database-backed** - No client-side assumptions  

---

## WHAT'S NOT CHANGED IN THIS STAGE

| Component | Status |
|-----------|--------|
| Supabase Auth configuration | Unchanged |
| auth.users table schema | Unchanged |
| user_profiles table schema | Unchanged |
| Parent-student relationships | Unchanged |
| Password hashing | Unchanged |
| Session management | Unchanged |
| RLS policies | Unchanged |
| School isolation logic | Unchanged |

---

## STAGE 2 CONCLUSION

**Finding**: ✅ **Identifier mapping is SAFE and already implemented.**

**Current System**:
- Super Admin uses email directly (exclusive path)
- Staff uses staff_id → mapped to email (lookup-based)
- Student uses admission_number → mapped to email (lookup-based)
- Parent uses name + ward → mapped to email (relationship-based)

**Safety**:
- ✅ No migration needed
- ✅ Existing users unaffected
- ✅ Backward compatible
- ✅ Well-isolated (school_id, role, relationships)
- ✅ Standard security practices

**No Code Changes Required This Stage** - Documentation only.

---

## RECOMMENDATIONS

### For Current Implementation ✅

Keep the current identifier mapping system:
```
Identifier Input → Database Lookup → Email Extraction → Supabase Auth
```

**Why**:
- Works with existing users
- Maintains real emails for notifications
- No data migration required
- Better security than synthetic emails

### For Future Enhancement (Optional)

Consider these improvements:

1. **Cache identifier-to-email mapping** (performance)
   - Avoid repeated database lookups
   - Use Redis or in-memory cache

2. **Add identifier validation** (UX)
   - Check identifier format before submission
   - Provide clear error messages

3. **Implement identifier history** (audit)
   - Track identifier changes
   - Support identifier rotation

4. **Add MFA support** (security)
   - Additional factor beyond password
   - Email or authenticator app

---

## FILES INVOLVED (NO CHANGES YET)

- `src/lib/auth.ts` - AuthService class (reviewed, safe)
- `src/app/(auth)/login/page.tsx` - Login form (Stage 1 complete)
- `src/types/index.ts` - Type definitions (reviewed, complete)

---

**STAGE 2 COMPLETE - READY FOR STAGE 3**

No code changes required this stage. System is safe as-is.

Proceed to STAGE 3: Authentication Flow Per Role (verify each role's auth behavior).
