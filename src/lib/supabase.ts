import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { isMfaCookieVerified } from '@/lib/mfa-session'
import { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const AUTH_PERSISTENCE_COOKIE = 'smartsba_auth_persistence'
const REMEMBER_ME_COOKIE_VALUE = 'remember'
const SESSION_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60

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

function isBrowserRuntime(): boolean {
  return typeof document !== 'undefined'
}

function readCookie(name: string): string | null {
  if (!isBrowserRuntime()) {
    return null
  }

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))

  if (!cookie) {
    return null
  }

  const [, value] = cookie.split('=')
  return value ? decodeURIComponent(value) : null
}

function writeCookie(name: string, value: string, options: CookieOptions = {}) {
  if (!isBrowserRuntime()) {
    return
  }

  const segments = [`${name}=${encodeURIComponent(value)}`, `path=${options.path ?? '/'}`]

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`)
  } else {
    segments.push('SameSite=Lax')
  }

  if (options.secure) {
    segments.push('Secure')
  }

  if (typeof options.maxAge === 'number') {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`)
  }

  if (options.expires instanceof Date) {
    segments.push(`Expires=${options.expires.toUTCString()}`)
  }

  document.cookie = segments.join('; ')
}

function removeCookie(name: string) {
  writeCookie(name, '', {
    path: '/',
    expires: new Date(0),
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

function getAuthPersistenceCookieValue(): 'remember' | 'session' {
  return readCookie(AUTH_PERSISTENCE_COOKIE) === REMEMBER_ME_COOKIE_VALUE ? 'remember' : 'session'
}

function getAuthStorageOptions(): CookieOptions {
  const rememberMeEnabled = getAuthPersistenceCookieValue() === 'remember'

  return {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    ...(rememberMeEnabled
      ? { maxAge: SESSION_COOKIE_MAX_AGE_SECONDS }
      : {}),
  }
}

function createBrowserAuthStorage() {
  return {
    isServer: false,
    getItem: async (key: string) => {
      if (!isBrowserRuntime()) {
        return null
      }

      return readCookie(key)
    },
    setItem: async (key: string, value: string) => {
      if (!isBrowserRuntime()) {
        return
      }

      writeCookie(key, value, getAuthStorageOptions())
    },
    removeItem: async (key: string) => {
      if (!isBrowserRuntime()) {
        return
      }

      removeCookie(key)
    },
  }
}

export function setAuthPersistencePreference(rememberMe: boolean): void {
  if (!isBrowserRuntime()) {
    return
  }

  if (rememberMe) {
    writeCookie(AUTH_PERSISTENCE_COOKIE, REMEMBER_ME_COOKIE_VALUE, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    })
    return
  }

  removeCookie(AUTH_PERSISTENCE_COOKIE)
}

export function clearAuthPersistencePreference(): void {
  removeCookie(AUTH_PERSISTENCE_COOKIE)
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
export const supabase = createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storage: createBrowserAuthStorage(),
    flowType: 'pkce',
  },
})

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
