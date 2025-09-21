# Supabase Edge Functions

This directory contains Supabase Edge Functions that run in the Deno runtime environment.

## ⚠️ Important Note About TypeScript Errors

You will see TypeScript errors in VS Code for these files. **This is completely normal and expected!**

### Why Do These Errors Occur?

1. **Different Runtime Environment**: Edge Functions run in **Deno**, not Node.js
2. **Different Import System**: Deno uses URL imports (`https://deno.land/...`)
3. **VS Code Configuration**: VS Code is configured for Node.js by default

### Common Errors You'll See (These are SAFE to ignore):

```
❌ Cannot find module 'https://deno.land/std@0.168.0/http/server.ts'
❌ Cannot find module 'https://esm.sh/@supabase/supabase-js@2'
❌ Cannot find name 'Deno'
❌ Parameter 'req' implicitly has an 'any' type
```

**These errors do NOT affect functionality!** The Edge Functions will work perfectly when deployed.

## 📁 Available Functions

### 1. `generate-report/`

- **Purpose**: Generates PDF report cards for students
- **Input**: `{ student_id: string, session_id: string }`
- **Output**: PDF file with comprehensive student report
- **Features**:
  - Ghanaian-style report card format
  - QR code for verification
  - Subject scores, attendance, behavior records
  - Class position and aggregate scores

### 2. `calculate-ranks/`

- **Purpose**: Calculates and updates class rankings
- **Input**: `{ class_id: string, session_id: string }`
- **Output**: Updated class positions in database
- **Features**:
  - Automatic position calculation
  - Handles tied scores correctly
  - Updates all student positions
  - Returns ranking summary

## 🚀 Deployment Commands

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy generate-report
supabase functions deploy calculate-ranks

# Test locally (requires Deno)
supabase functions serve
```

## 🧪 Testing the Functions

### Generate Report

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/generate-report' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"student_id": "student_001", "session_id": "session_2024_2"}'
```

### Calculate Ranks

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/calculate-ranks' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"class_id": "class_001", "session_id": "session_2024_2"}'
```

## 🔧 Development Tips

1. **Ignore TypeScript Errors**: The red squiggles in VS Code are false positives
2. **Use Deno Locally**: Install Deno for local testing: `curl -fsSL https://deno.land/x/install/install.sh | sh`
3. **Test After Deployment**: Always test functions after deploying to Supabase
4. **Check Logs**: Use `supabase functions logs <function-name>` for debugging

## 📚 Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [Edge Runtime Documentation](https://edge-runtime.vercel.app/)

## ✅ Status

Both Edge Functions are **fully implemented** and **production-ready**:

- ✅ PDF report generation with QR codes
- ✅ Class ranking calculations
- ✅ Error handling and validation
- ✅ Proper database integration
- ✅ Professional Ghanaian report card format
