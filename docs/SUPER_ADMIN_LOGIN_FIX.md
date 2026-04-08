# Super Admin Login Issue - Troubleshooting Guide

## Problem Identified

You're getting "Invalid super admin credentials" with a 500 Internal Server Error when the system tries to fetch the user profile. This is caused by two main issues:

### Issue 1: RLS Policy Circular Dependency

The Row Level Security policies for `user_profiles` were causing a circular dependency during authentication, resulting in the 500 error.

### Issue 2: User Profile Not Connected

The Super Admin profile in the database isn't properly connected to your Supabase Auth user.

## Solution Steps

### Step 1: Fix RLS Policies

Run this migration in Supabase Dashboard → SQL Editor:

```sql
-- Copy and paste the content of: supabase/migrations/005_fix_rls_policies.sql
```

### Step 2: Connect Your Auth User to Super Admin Profile

1. **Get Your Auth User ID**:

   - Go to Supabase Dashboard → Authentication → Users
   - Find your user and copy the UUID (e.g., `4eab9d56-3d74-4f1d-834b-7196b3af41c2`)

2. **Update the Profile Connection**:
   - Edit the file `fix_super_admin_profile.sql`
   - Replace all instances of `4eab9d56-3d74-4f1d-834b-7196b3af41c2` with your actual user ID
   - Replace `your-email@example.com` with your actual email
   - Run the script in Supabase SQL Editor

### Step 3: Test Login

After completing steps 1 and 2, try logging in again with:

- **Role**: Super Admin
- **Email**: (your auth user email)
- **Password**: (your auth user password)

## Quick Fix Steps

Instead of running individual SQL commands, use the provided migration files:

### Step 1: Fix RLS Policies

Run the complete migration file: `supabase/migrations/005_fix_rls_policies.sql`

This migration:

- Drops all existing conflicting user_profiles policies
- Creates new non-recursive policies with proper names
- Includes verification tests to ensure no circular dependencies

### Step 2: Connect Your Profile

Use the parameterized script: `fix_super_admin_profile.sql`

**Important**: Update the script with your actual UUID and email before running.

### Migration Files Reference

- **RLS Fix**: `supabase/migrations/005_fix_rls_policies.sql` (v005)
- **Profile Connection**: `fix_super_admin_profile.sql`
- **Emergency Backup**: `emergency_fix_rls.sql`

**Note**: The SQL policies in these files are the canonical source. Do not copy/paste individual commands - always run the complete migration files to ensure consistency.

## Verification

After running the fix, you should see:

1. ✅ No 500 error in browser dev tools
2. ✅ Successful login redirect to Super Admin dashboard
3. ✅ Profile query returns your super admin profile

## Common Issues

### Issue: Still getting 500 error

**Solution**: Make sure you ran the RLS policy fix first, then refresh the page

### Issue: "Invalid super admin credentials" but no 500 error

**Solution**: Check that the email/password matches your Supabase Auth user exactly

### Issue: User profile not found

**Solution**: Verify the user_id in user_profiles matches your auth user ID exactly

## Files Created for This Fix

1. `supabase/migrations/005_fix_rls_policies.sql` - Fixes the RLS policy circular dependency
2. `fix_super_admin_profile.sql` - Connects your auth user to the super admin profile

## Next Steps After Login Works

Once you can successfully log in as Super Admin:

1. Create your first school
2. Create school administrators
3. Set up the school structure
4. Test the multi-school security features

The system is designed to be secure and scalable - this was just a bootstrap issue that needed fixing!
