import { NextResponse } from 'next/server'
import { MFA_VERIFIED_COOKIE_NAME } from '@/lib/mfa-session'

export async function POST() {
  const response = NextResponse.json({ success: true })

  response.cookies.set(MFA_VERIFIED_COOKIE_NAME, '', {
    path: '/',
    expires: new Date(0),
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  })

  return response
}