# Environment Variables Required for Automatic Admin Creation

To enable automatic admin account creation via the `/api/create-admins` API route, you need to add the service role key to your environment variables.

## Required Environment Variables

Add these to your `.env.local` file:

```env
# Supabase Configuration (already present)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Service Role Key (ADD THIS for automatic admin creation)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## How to Get Your Service Role Key

1. Go to your **Supabase Dashboard**
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key)
4. Add it to your `.env.local` file

## Security Notes

⚠️ **IMPORTANT**: The service role key has full database access and should NEVER be exposed to the client side.

- ✅ Keep it in `.env.local` (server-side only)
- ✅ Never commit it to version control
- ✅ Only use it in API routes (server-side)
- ❌ Never use it in client-side code
- ❌ Never expose it in browser console or logs

## Testing the Setup

1. Add the service role key to `.env.local`
2. Restart your development server (`npm run dev`)
3. Try creating a school with admin information
4. Check that admin accounts are created automatically

If admin creation fails, the system will fallback to showing manual creation instructions.

## Fallback Behavior

The system is designed to be resilient:

- ✅ If API succeeds: Admins created automatically with temporary passwords
- ⚠️ If API fails: Shows manual creation instructions
- 🔒 Always verifies super admin permissions before creating accounts
- 📧 Provides temporary passwords for successful creations

## Current Status

✅ API route created and configured  
✅ Form updated to use automatic creation  
✅ Fallback to manual creation if needed  
⚠️ Service role key needs to be added to environment
