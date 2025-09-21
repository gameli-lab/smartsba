// Debug script to test environment variables
console.log('=== Environment Variables Debug ===')
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING')
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING')
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING')

// Full values (be careful with these in production)
console.log('\n=== Full Values (for debugging only) ===')
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...')
console.log('ANON_KEY length:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length)
console.log('SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length)

export {}
