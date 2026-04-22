import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CSRF_COOKIE_NAME, createCsrfToken } from '@/lib/csrf'
import { isMfaCookieVerified, MFA_VERIFIED_COOKIE_NAME } from '@/lib/mfa-session'

const SESSION_ACTIVITY_COOKIE = 'smartsba_session_activity'
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function getSessionTimeoutMinutesFromEnv(): number {
  const raw = process.env.SESSION_TIMEOUT_MINUTES
  if (!raw) return 60

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 60

  return parsed
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/school-admin') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/teacher') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/parent') ||
    pathname.startsWith('/dashboard')
  )
}

function isPrivilegedRole(role: string): boolean {
  return role === 'super_admin' || role === 'school_admin'
}

function getRoleRedirectPath(role: string): string {
  switch (role) {
    case 'super_admin':
      return '/dashboard/super-admin'
    case 'school_admin':
      return '/school-admin'
    case 'teacher':
      return '/teacher'
    case 'student':
      return '/student'
    case 'parent':
      return '/parent'
    default:
      return '/'
  }
}

function isPrivilegedPath(pathname: string): boolean {
  return pathname.startsWith('/dashboard/super-admin') || pathname.startsWith('/school-admin')
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

function isStateChangingApiRequest(req: NextRequest): boolean {
  return isApiPath(req.nextUrl.pathname) && STATE_CHANGING_METHODS.has(req.method)
}

function sameOrigin(originHeader: string | null, req: NextRequest): boolean {
  if (!originHeader) return false

  try {
    const origin = new URL(originHeader)
    return origin.origin === req.nextUrl.origin
  } catch {
    return false
  }
}

function clearAuthCookies(req: NextRequest, response: NextResponse) {
  const existing = req.cookies.getAll()

  for (const cookie of existing) {
    if (
      cookie.name.startsWith('sb-') ||
      cookie.name === SESSION_ACTIVITY_COOKIE ||
      cookie.name === CSRF_COOKIE_NAME ||
      cookie.name === MFA_VERIFIED_COOKIE_NAME
    ) {
      response.cookies.set(cookie.name, '', {
        path: '/',
        expires: new Date(0),
      })
    }
  }
}

function applySecurityHeaders(response: NextResponse) {
  const isDev = process.env.NODE_ENV !== 'production'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Content-Security-Policy', csp)

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
}

function finalizeResponse(req: NextRequest, response: NextResponse): NextResponse {
  const csrfCookie = req.cookies.get(CSRF_COOKIE_NAME)?.value
  if (!csrfCookie) {
    response.cookies.set(CSRF_COOKIE_NAME, createCsrfToken(), {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
    })
  }

  applySecurityHeaders(response)
  return response
}

export async function middleware(req: NextRequest) {
  // Debug environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing environment variables in middleware:', {
      url: supabaseUrl ? 'SET' : 'MISSING',
      key: supabaseAnonKey ? 'SET' : 'MISSING'
    })
    // Fail closed so privileged routes never bypass auth if middleware is misconfigured.
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('reason', 'configuration_error')
    return finalizeResponse(req, NextResponse.redirect(loginUrl))
  }

  if (isStateChangingApiRequest(req)) {
    const originHeader = req.headers.get('origin')
    if (originHeader && !sameOrigin(originHeader, req)) {
      return finalizeResponse(
        req,
        NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
      )
    }

    if (originHeader) {
      const csrfCookie = req.cookies.get(CSRF_COOKIE_NAME)?.value
      const csrfHeader = req.headers.get('x-csrf-token')

      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return finalizeResponse(
          req,
          NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
        )
      }
    }
  }

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: Record<string, unknown>) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname
  const isProtected = isProtectedPath(pathname)

  if (user) {
    const timeoutMs = getSessionTimeoutMinutesFromEnv() * 60 * 1000
    const lastActivityRaw = req.cookies.get(SESSION_ACTIVITY_COOKIE)?.value
    const now = Date.now()

    if (lastActivityRaw) {
      const lastActivity = Number.parseInt(lastActivityRaw, 10)
      if (Number.isFinite(lastActivity) && now - lastActivity > timeoutMs && (isProtected || isApiPath(pathname))) {
        if (isApiPath(pathname)) {
          const expiredResponse = NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
          clearAuthCookies(req, expiredResponse)
          return finalizeResponse(req, expiredResponse)
        }

        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('reason', 'session_expired')
        const redirectResponse = NextResponse.redirect(loginUrl)
        clearAuthCookies(req, redirectResponse)
        return finalizeResponse(req, redirectResponse)
      }
    }

    response.cookies.set(SESSION_ACTIVITY_COOKIE, String(now), {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: getSessionTimeoutMinutesFromEnv() * 60,
    })
  } else {
    response.cookies.set(SESSION_ACTIVITY_COOKIE, '', {
      path: '/',
      expires: new Date(0),
    })
    response.cookies.set(MFA_VERIFIED_COOKIE_NAME, '', {
      path: '/',
      expires: new Date(0),
    })
  }

  // If user is not signed in and trying to access protected routes
  if (!user && isProtected) {
    return finalizeResponse(req, NextResponse.redirect(new URL('/login', req.url)))
  }

  let profile: { role?: string } | null = null

  if (user && (isProtected || pathname.startsWith('/login') || pathname.startsWith('/mfa-challenge'))) {
    const { data: profileRow } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    profile = profileRow as { role?: string } | null
  }

  if (user && profile?.role && isPrivilegedRole(profile.role) && isPrivilegedPath(pathname)) {
    if (!pathname.startsWith('/mfa-challenge') && !pathname.startsWith('/api/auth/mfa')) {
      const { data: enrollment } = await (supabase as any)
        .from('mfa_enrollments')
        .select('enabled, last_used_at')
        .eq('user_id', user.id)
        .maybeSingle()

      const enrollmentRow = enrollment as { enabled?: boolean; last_used_at?: string | null } | null

      const providedCookie = req.cookies.get(MFA_VERIFIED_COOKIE_NAME)?.value
      const verified = enrollmentRow?.enabled
        ? isMfaCookieVerified(user.id, enrollmentRow.last_used_at, providedCookie)
        : false

      if (!verified) {
        const challengeUrl = new URL('/mfa-challenge', req.url)
        const nextPath = `${pathname}${req.nextUrl.search || ''}`
        challengeUrl.searchParams.set('next', nextPath)
        return finalizeResponse(req, NextResponse.redirect(challengeUrl))
      }
    }
  }

  // If user is signed in and trying to access auth pages
  if (user && pathname.startsWith('/login') && profile?.role) {
    const targetPath = getRoleRedirectPath(profile.role)
    if (isPrivilegedRole(profile.role)) {
      const { data: enrollment } = await (supabase as any)
        .from('mfa_enrollments')
        .select('enabled, last_used_at')
        .eq('user_id', user.id)
        .maybeSingle()

      const enrollmentRow = enrollment as { enabled?: boolean; last_used_at?: string | null } | null
      const providedCookie = req.cookies.get(MFA_VERIFIED_COOKIE_NAME)?.value
      const verified = enrollmentRow?.enabled
        ? isMfaCookieVerified(user.id, enrollmentRow.last_used_at, providedCookie)
        : false

      if (!verified) {
        const challengeUrl = new URL('/mfa-challenge', req.url)
        challengeUrl.searchParams.set('next', targetPath)
        return finalizeResponse(req, NextResponse.redirect(challengeUrl))
      }
    }

    return finalizeResponse(req, NextResponse.redirect(new URL(targetPath, req.url)))
  }

  return finalizeResponse(req, response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
