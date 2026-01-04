import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file:\n' +
    `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}\n` +
    `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'MISSING'}\n` +
    'Make sure these are set in your .env.local file and restart your development server.'
  )
}

// Client-side Supabase client
export const supabase = createBrowserClient<Database>(supabaseUrl as string, supabaseAnonKey as string)

// Server-side Supabase client for Server Components (reads session from cookies)
export async function createServerComponentClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  
  return createServerClient<Database>(
    supabaseUrl as string,
    supabaseAnonKey as string,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Called from Server Component - cookies are read-only
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', options)
          } catch {
            // Called from Server Component - cookies are read-only
          }
        },
      },
    }
  )
}

// Server-side Supabase client factory (for use in server components/API routes)
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing from environment variables')
  }

  return createServerClient<Database>(
    url as string,
    serviceRoleKey,
    {
      cookies: {
        get() {
          return undefined
        },
        set() {
          // No-op in server environment
        },
        remove() {
          // No-op in server environment
        },
      },
    }
  )
}

// Admin client factory for server-side operations with service role key
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase environment variables for admin client:\n' +
      `NEXT_PUBLIC_SUPABASE_URL: ${url ? 'SET' : 'MISSING'}\n` +
      `SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? 'SET' : 'MISSING'}\n` +
      'Make sure these are set in your .env.local file and restart your development server.'
    )
  }

  return createServerClient<Database>(
    url as string,
    serviceRoleKey,
    {
      cookies: {
        get() {
          return undefined
        },
        set() {
          // No-op in server environment
        },
        remove() {
          // No-op in server environment
        },
      },
    }
  )
}
