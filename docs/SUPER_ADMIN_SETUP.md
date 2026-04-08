# Super Admin Setup Guide

## 🎯 Goal: Create the first Super Admin account to bootstrap your SmartSBA system

### **Method 1: Quick Setup (Recommended)**

#### Step 1: Create Auth User First

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Add User"**
3. Enter your email (e.g., `admin@yourschool.com`)
4. Set a strong password
5. Click **"Create User"**
6. **Copy the User UUID** (you'll need this)

#### Step 2: Create Super Admin Profile

Run this in **Supabase SQL Editor** (replace `YOUR_USER_UUID` with the actual UUID):

```sql
INSERT INTO user_profiles (
    id,
    user_id,
    school_id,
    role,
    email,
    full_name,
    staff_id
) VALUES (
    gen_random_uuid(),
    'YOUR_USER_UUID_HERE', -- Replace with real UUID from Step 1
    NULL, -- Super admin doesn't belong to a specific school
    'super_admin',
    'admin@yourschool.com', -- Use the same email from Step 1
    'Your Full Name', -- Your actual name
    'SUPER001'
);
```

#### Step 3: Verify Setup

```sql
SELECT
    up.id,
    up.user_id,
    up.role,
    up.email,
    up.full_name,
    up.staff_id,
    au.email as auth_email
FROM user_profiles up
LEFT JOIN auth.users au ON up.user_id = au.id
WHERE up.role = 'super_admin';
```

---

### **Method 2: Using the Setup Script**

1. Run `004_setup_super_admin.sql` first (creates placeholder profile)
2. Create auth user in Supabase Dashboard
3. Update the profile with real user UUID

---

## ✅ **After Setup, You Can:**

### **Login Process:**

1. Go to your Next.js app login page
2. Select **"Super Admin"** role
3. Enter the email and password you created
4. You'll be logged in as Super Admin!

### **Super Admin Capabilities:**

- ✅ Create and manage schools
- ✅ Create school administrators
- ✅ View all schools and users
- ✅ Manage system-wide settings
- ✅ Access all data across schools

### **Next Steps After Super Admin Login:**

1. **Create Schools**: Add schools to the system
2. **Create School Admins**: Set up administrators for each school
3. **School Admins Can Create**: Teachers, students, parents within their school
4. **Teachers Can**: Enter grades and manage their classes
5. **Students/Parents Can**: View results and reports

---

## 🔧 **Troubleshooting:**

### **"User not found" error:**

- Check that the `user_id` in `user_profiles` matches the UUID in `auth.users`
- Verify the email addresses match

### **"Access denied" error:**

- Check that Row Level Security policies are properly set up (run `002_rls_policies.sql`)
- Verify the user profile has `role = 'super_admin'`

### **Can't see any data:**

- Super admins should see all data across schools
- If issues persist, check RLS policies in `002_rls_policies.sql`

---

## 📋 **Complete Deployment Checklist:**

- [x] ✅ Reset database (`000_reset_database.sql`)
- [x] ✅ Create schema (`001_initial_schema.sql`)
- [x] ✅ Add security (`002_rls_policies.sql`)
- [x] ✅ Test system (`003_test_aggregates.sql`) - Optional
- [ ] 🎯 **Create Super Admin** (`004_setup_super_admin.sql` or Manual method)
- [ ] 🚀 **Login and start using the system!**

Your SmartSBA system will be fully operational after creating the Super Admin account! 🎓✨
