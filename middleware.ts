import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Debug environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing environment variables in middleware:', {
      url: supabaseUrl ? 'SET' : 'MISSING',
      key: supabaseAnonKey ? 'SET' : 'MISSING'
    })
    // Allow request to continue without auth middleware
    return NextResponse.next()
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

  // If user is not signed in and trying to access protected routes
  if (!user && (req.nextUrl.pathname.startsWith('/school-admin') || req.nextUrl.pathname.startsWith('/teacher') || req.nextUrl.pathname.startsWith('/student') || req.nextUrl.pathname.startsWith('/parent') || req.nextUrl.pathname.startsWith('/dashboard'))) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // If user is signed in and trying to access auth pages or homepage
  if (user && req.nextUrl.pathname.startsWith('/login')) {
    // Get user profile to determine redirect
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile) {
      let redirectPath = '/'
      
      switch (profile.role) {
        case 'super_admin':
          redirectPath = '/dashboard/super-admin'
          break
        case 'school_admin':
          redirectPath = '/school-admin'
          break
        case 'teacher':
          redirectPath = '/teacher'
          break
        case 'student':
          redirectPath = '/student'
          break
        case 'parent':
          redirectPath = '/parent'
          break
      }
      
      return NextResponse.redirect(new URL(redirectPath, req.url))
    }
  }

  // If authenticated user visits homepage, redirect to their dashboard
  if (user && req.nextUrl.pathname === '/') {
    // Get user profile to determine redirect
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile) {
      let redirectPath = '/'
      
      switch (profile.role) {
        case 'super_admin':
          redirectPath = '/dashboard/super-admin'
          break
        case 'school_admin':
          redirectPath = '/school-admin'
          break
        case 'teacher':
          redirectPath = '/teacher'
          break
        case 'student':
          redirectPath = '/student'
          break
        case 'parent':
          redirectPath = '/parent'
          break
      }
      
      return NextResponse.redirect(new URL(redirectPath, req.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
