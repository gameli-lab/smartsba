# Admin Account Creation Solutions

## Problem

The `supabase.auth.admin.createUser()` method cannot be called from client-side code due to security restrictions. This causes "User not allowed" errors when trying to create admin accounts automatically during school creation.

## Current Solution (Implemented)

The school creation now **stores admin information** and shows an alert to the Super Admin with details about which accounts need to be created manually.

### How it works:

1. School creation completes successfully
2. Admin information is collected but not automatically created
3. User sees an alert with admin details that need manual creation
4. Super Admin can create these accounts through:
   - Supabase Dashboard → Authentication → Users
   - Email invitations
   - Manual user creation

## Alternative Solution (Future Enhancement)

Created an API route `/api/create-admins` that uses the service role key to create users server-side.

### To enable automatic admin creation:

1. **Add service role key to environment variables**:

   ```bash
   # In .env.local
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

2. **Update the school creation form** to call the API:

   ```typescript
   // In createSchoolAdmins function, replace return admins with:
   const response = await fetch("/api/create-admins", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       Authorization: `Bearer ${session?.access_token}`,
     },
     body: JSON.stringify({ admins, schoolId }),
   });

   const result = await response.json();
   return result.createdAdmins || [];
   ```

3. **Benefits of API approach**:

   - Automatic admin account creation
   - Secure server-side user creation
   - Generated passwords returned to Super Admin
   - Proper error handling

4. **Security considerations**:
   - Service role key has full database access
   - API route validates super admin permissions
   - Tokens are verified before user creation
   - Consider rate limiting and additional security measures

## Recommended Approach

For now, use the **manual creation approach** as it's simpler and more secure. The API route approach can be implemented later if automatic creation becomes a requirement.

## Current Status

✅ School creation works without errors  
✅ Admin information is collected and displayed  
✅ Super Admin gets clear instructions for manual account creation  
⏸️ API route created but not integrated (optional future enhancement)

## Testing the Fix

1. Try creating a school again
2. Fill in admin information (headmaster/deputy)
3. Complete the school creation process
4. You should see a success alert with admin details
5. No more "User not allowed" errors
