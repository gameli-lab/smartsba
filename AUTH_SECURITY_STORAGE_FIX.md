# Authentication Security & Storage RLS Fixes

## Issues Fixed

### 1. **Security Issue: Using `getSession()` instead of `getUser()`**

**Problem**: The application was using `supabase.auth.getSession()` in server-side code, which reads session data directly from cookies without validating it with Supabase Auth server. This is insecure as the data could be tampered with.

**Solution**: Replaced all server-side `getSession()` calls with `getUser()`, which authenticates the session by contacting Supabase Auth server.

**Files Updated**:
- [src/lib/auth.ts](src/lib/auth.ts)
  - `requireSchoolAdmin()` - Line ~345
  - `requireTeacher()` - Line ~395
  - `requireStudent()` - Line ~455
  - `requireParent()` - Line ~495
  - `getCurrentUser()` - Line ~278
- [middleware.ts](middleware.ts) - Lines ~73, ~115

### 2. **Storage RLS Error: Missing JWT Claims**

**Problem**: Storage RLS policies for the `school-assets` bucket require JWT claims (`app_role` and `school_id`), but the `setUserClaims()` function was commented out, preventing these claims from being set during login.

**Error Message**:
```
Error [StorageApiError]: new row violates row-level security policy
status: 400, statusCode: '403'
```

**Root Cause**: The storage policies check for:
```sql
current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'school_admin'
current_setting('request.jwt.claims', true)::json ->> 'school_id' = ...
```

These claims weren't being set because `setUserClaims()` was disabled.

**Solution**: 
1. **Enabled JWT Claims**: Uncommented the `setUserClaims()` function call in [src/lib/auth.ts](src/lib/auth.ts#L322-L336)
2. **Server-Side Storage Client**: Updated storage operations to use authenticated server-side Supabase client instead of browser client

**Files Updated**:
- [src/lib/auth.ts](src/lib/auth.ts)
  - `setUserClaims()` - Enabled the RPC call (Line ~329)
- [src/lib/storage.ts](src/lib/storage.ts)
  - Added `client` parameter to `uploadSchoolAsset()` (Line ~93)
  - Added `client` parameter to `deleteSchoolAsset()` (Line ~195)
  - Added `client` parameter to `getSchoolAssetSignedUrl()` (Line ~10)
- [src/app/(school-admin)/school-admin/school-profile/actions.ts](src/app/(school-admin)/school-admin/school-profile/actions.ts)
  - `uploadSchoolAssetAction()` - Uses `createServerComponentClient()` (Lines ~87-120)
  - `deleteSchoolAssetAction()` - Uses `createServerComponentClient()` (Lines ~165-207)

## How JWT Claims Work

### Database Function
The `set_custom_claims()` function in [supabase/migrations/006_custom_claims_function.sql](supabase/migrations/006_custom_claims_function.sql) sets custom JWT claims:

```sql
CREATE OR REPLACE FUNCTION set_custom_claims(user_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM auth.jwt_custom_claims_set(
    user_id := set_custom_claims.user_id,
    claims := jsonb_build_object(
      'app_role', user_profile.role,
      'school_id', COALESCE(user_profile.school_id::text, ''),
      'profile_id', user_profile.id::text
    )
  );
END;
$$;
```

### Automatic Trigger
The function is automatically called when a user profile is created or updated:

```sql
CREATE TRIGGER on_profile_change_trigger
  AFTER INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION on_profile_change();
```

### Manual Refresh
Users can also manually refresh their claims using:

```sql
SELECT refresh_user_claims();
```

Or via the server action in [src/app/(school-admin)/school-admin/school-profile/refresh-claims.ts](src/app/(school-admin)/school-admin/school-profile/refresh-claims.ts).

## Storage RLS Policies

The storage policies in [supabase/storage-policies.sql](supabase/storage-policies.sql) enforce security:

### Upload Policy
```sql
CREATE POLICY "school_assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'school-assets' AND
    (
      -- Super admin can upload anywhere
      (current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'super_admin') OR
      -- School admin can upload to their school folder only
      (
        current_setting('request.jwt.claims', true)::json ->> 'app_role' = 'school_admin' AND
        name ~ ('^' || (current_setting('request.jwt.claims', true)::json ->> 'school_id') || '/.+')
      )
    )
  );
```

### Security Features
- **Path Traversal Protection**: Rejects paths with `..`, `/./`, or `^./`
- **Strict Prefix Matching**: File paths must start with `school_id/`
- **First Segment Validation**: First path segment must exactly match `school_id`
- **File Type Restriction**: Only allows image extensions (jpg, jpeg, png, webp, gif)

## Testing the Fix

### 1. Verify Claims are Set
After logging in as a school admin, check that JWT claims are present:

```typescript
// In browser console
const { data: { user } } = await supabase.auth.getUser()
console.log(user?.app_metadata) // Should show app_role and school_id
```

### 2. Test File Upload
1. Navigate to `/school-admin/school-profile`
2. Upload a school logo
3. Should succeed without RLS errors

### 3. Verify Path Security
The system prevents path traversal attacks:
- ❌ `../other_school/logo.jpg` - Rejected
- ❌ `school_id/../other/logo.jpg` - Rejected
- ✅ `school_id/logos/logo.jpg` - Allowed (if school_id matches)

## Migration Status

✅ All authentication guards now use `getUser()` for secure validation  
✅ JWT custom claims are enabled and set during login  
✅ Storage operations use server-side authenticated client  
✅ RLS policies enforce multi-tenant isolation  
✅ Path traversal attacks are prevented  

## Next Steps

If you encounter storage errors after deploying:

1. **Verify Database Function Exists**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'set_custom_claims';
   ```

2. **Manually Refresh Claims** (if needed):
   ```sql
   SELECT refresh_user_claims();
   ```

3. **Check Storage Policies** in Supabase Dashboard:
   - Navigate to Storage → school-assets → Policies
   - Verify all 4 policies are enabled (INSERT, SELECT, UPDATE, DELETE)

4. **Test with Service Role** (for debugging):
   - Use service role key temporarily to verify bucket access
   - Then re-enable RLS policies

## References

- [Supabase Auth Best Practices](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Storage RLS Documentation](https://supabase.com/docs/guides/storage/security/access-control)
- [JWT Custom Claims](https://supabase.com/docs/guides/auth/custom-claims-and-role-based-access-control-rbac)
