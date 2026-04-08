# 🏫 School Assets Storage Configuration

## 📋 **Storage Setup Instructions**

### **1. Create Storage Bucket**

In your **Supabase Dashboard** → **Storage**:

1. **Click "Create bucket"**
2. **Bucket name**: `school-assets`
3. **Public bucket**: `❌ NO` (Keep it private)
4. **File size limit**: `2MB`
5. **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif`

### **2. Apply RLS Policies**

Copy and paste the contents of `/supabase/storage-policies.sql` into your **SQL Editor**:

```sql
-- This will create secure RLS policies for:
-- ✅ School-specific folder access (school_id/type/filename)
-- ✅ Role-based permissions (Super Admin vs School Admin)
-- ✅ File type validation (images only)
-- ✅ Signed URL generation for secure access
```

### **3. Apply Database Migrations**

Run these migrations in order:

```bash
# 1. Add school status field
-- Apply: /supabase/migrations/007_add_school_status.sql

# 2. Add storage policies
-- Apply: /supabase/storage-policies.sql
```

---

## 🔒 **Security Model**

### **Private Bucket Benefits**

- ✅ **Sensitive Documents**: Headmaster signatures are protected
- ✅ **School Privacy**: Logos and stamps aren't publicly accessible
- ✅ **Access Control**: Only authorized users can view files
- ✅ **Audit Trail**: Track who accesses what files

### **Folder Structure**

```
school-assets/
├── {school-id-1}/
│   ├── logos/
│   │   └── 1234567890-logo.png
│   ├── stamps/
│   │   └── 1234567890-stamp.png
│   └── signatures/
│       └── 1234567890-signature.png
└── {school-id-2}/
    ├── logos/
    ├── stamps/
    └── signatures/
```

### **Access Permissions**

| Role                 | Upload         | View           | Update         | Delete         |
| -------------------- | -------------- | -------------- | -------------- | -------------- |
| **Super Admin**      | ✅ All schools | ✅ All schools | ✅ All schools | ✅ All schools |
| **School Admin**     | ✅ Own school  | ✅ Own school  | ✅ Own school  | ❌ No          |
| **Teachers**         | ❌ No          | ✅ Own school  | ❌ No          | ❌ No          |
| **Students/Parents** | ❌ No          | ❌ No          | ❌ No          | ❌ No          |

---

## 🛠️ **Technical Implementation**

### **File Upload Process**

1. User selects file in Create School Form
2. File is validated (type, size)
3. File uploaded to `school-assets/{school_id}/{type}s/{timestamp}-{filename}`
4. File path stored in database (not public URL)
5. Signed URLs generated when needed for display

### **Accessing Files**

```typescript
// Get signed URL for displaying images
const { data } = await supabase.storage
  .from('school-assets')
  .createSignedUrl('school-id/logos/logo.png', 60) // 60 seconds

// Use signed URL in components
<Image src={data?.signedUrl} alt="School Logo" />
```

### **Helper Function Usage**

```sql
-- Check if user can access a file
SELECT get_school_asset_url('school-id-123/logos/logo.png');
-- Returns: file path if authorized, NULL if not
```

---

## 🚀 **Next Steps**

1. **✅ Apply migrations** (`007_add_school_status.sql` + `storage-policies.sql`)
2. **✅ Create storage bucket** with private settings
3. **✅ Test file upload** in Create School form
4. **✅ Verify RLS policies** work as expected
5. **🔄 Update TypeScript types** after schema changes

---

## 📝 **Common Issues & Solutions**

### **Issue: "Public URL not working"**

**Solution**: This is expected! Private buckets don't have public URLs. Use signed URLs instead.

### **Issue: "Upload permission denied"**

**Solution**: Make sure JWT claims include `app_role` and `school_id`.

### **Issue: "TypeScript errors"**

**Solution**: Run `npx supabase gen types typescript --local > src/types/database.ts` after applying migrations.

---

## 🔧 **Development vs Production**

### **Development**

- Use Supabase local development with Docker
- Test uploads with temporary files
- Verify RLS policies work correctly

### **Production**

- Monitor storage usage in Supabase Dashboard
- Set up backup policies for critical assets
- Consider CDN for frequently accessed logos

This setup provides enterprise-grade security while maintaining ease of use! 🎉
