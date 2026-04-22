import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { isMfaCookieVerified } from '@/lib/mfa-session'
import { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export type MfaEnrollmentRow = {
  enabled: boolean
  enabled_at: string | null
  last_used_at: string | null
  backup_codes_hashed?: string[] | null
  secret_base32?: string | null
  role?: string
  school_id?: string | null
}

export type MfaVerificationState = {
  enrolled: boolean
  enabled: boolean
  verified: boolean
  lastUsedAt: string | null
}

function normalizeMfaEnrollmentRow(row: unknown): MfaEnrollmentRow | null {
  if (!row || typeof row !== 'object') {
    return null
  }

  const enrollment = row as Record<string, unknown>

  return {
    enabled: Boolean(enrollment.enabled),
    enabled_at: typeof enrollment.enabled_at === 'string' ? enrollment.enabled_at : null,
    last_used_at: typeof enrollment.last_used_at === 'string' ? enrollment.last_used_at : null,
    backup_codes_hashed: Array.isArray(enrollment.backup_codes_hashed)
      ? (enrollment.backup_codes_hashed.filter((value): value is string => typeof value === 'string'))
      : null,
    secret_base32: typeof enrollment.secret_base32 === 'string' ? enrollment.secret_base32 : null,
    role: typeof enrollment.role === 'string' ? enrollment.role : undefined,
    school_id: typeof enrollment.school_id === 'string' ? enrollment.school_id : null,
  }
}

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
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Called from Server Component - cookies are read-only
          }
        },
        remove(name: string, options: CookieOptions) {
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

  return createClient<Database>(url as string, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

export async function getMfaEnrollmentForUser(userId: string): Promise<MfaEnrollmentRow | null> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await (admin as any)
    .from('mfa_enrollments')
    .select('enabled, enabled_at, last_used_at, backup_codes_hashed, secret_base32, role, school_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeMfaEnrollmentRow(data)
}

export async function getMfaVerificationState(
  userId: string,
  providedCookie?: string | null
): Promise<MfaVerificationState> {
  const enrollment = await getMfaEnrollmentForUser(userId)

  return {
    enrolled: Boolean(enrollment),
    enabled: Boolean(enrollment?.enabled),
    verified: Boolean(
      enrollment?.enabled &&
        isMfaCookieVerified(userId, enrollment?.last_used_at, providedCookie)
    ),
    lastUsedAt: enrollment?.last_used_at ?? null,
  }
}
