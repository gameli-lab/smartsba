import { clearAuthPersistencePreference, supabase } from './supabase'
import { UserRole, UserProfile } from '@/types'
import { getClientCsrfHeaders } from '@/lib/csrf'
import { MFA_VERIFIED_COOKIE_NAME } from '@/lib/mfa-session'

type User = NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>

export interface PasswordlessSendOtpParams {
  identifier: string
  role: UserRole
  schoolId?: string
  wardAdmissionNumber?: string
  channel?: 'sms' | 'email'
}

export interface PasswordlessVerifyOtpParams {
  requestId?: string
  prefix?: string
  code: string
  role: UserRole
  schoolId?: string
  identifier?: string
  channel?: 'sms' | 'email'
}

export interface AuthResult {
  user: User
  profile: UserProfile
}

export interface SchoolOption {
  id: string
  name: string
}

async function waitForSessionToStabilize(maxAttempts = 8, delayMs = 250): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
}

export class AuthService {
  /**
   * Request an OTP to be sent to the user via SMS (Hubtel) or Email.
   * Returns the requestId and prefix (SMS) or challengeId (Email) needed for verification.
   */
  static async requestPasswordlessOtp(params: PasswordlessSendOtpParams): Promise<{
    success: boolean
    message?: string
    requestId?: string
    prefix?: string
    expiresAt?: string
    challengeId?: string
    channel?: 'sms' | 'email'
    error?: string
  }> {
    const response = await fetch('/api/auth/passwordless', {
      method: 'POST',
      headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        action: 'send',
        ...params,
      }),
    })

    const payload = (await response.json()) as {
      success?: boolean
      message?: string
      requestId?: string
      prefix?: string
      expiresAt?: string
      challengeId?: string
      channel?: 'sms' | 'email'
      error?: string
    }

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Failed to send OTP')
    }

    return payload as {
      success: boolean
      message?: string
      requestId?: string
      prefix?: string
      expiresAt?: string
      challengeId?: string
      channel?: 'sms' | 'email'
      error?: string
    }
  }

  /**
   * Verify an OTP code (SMS via Hubtel or Email) and establish a session.
   * Exchanges the magic link token with Supabase to create the session.
   */
  static async verifyPasswordlessOtp(params: PasswordlessVerifyOtpParams): Promise<{
    success: boolean
    message?: string
    user?: { id: string; role: string; schoolId: string | null }
    tokenHash?: string | null
    verifiedAt?: string
    error?: string
    attemptsRemaining?: number
  }> {
    const response = await fetch('/api/auth/passwordless', {
      method: 'POST',
      headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        action: 'verify',
        ...params,
      }),
    })

    const payload = (await response.json()) as {
      success?: boolean
      message?: string
      user?: { id: string; role: string; schoolId: string | null }
      tokenHash?: string | null
      verifiedAt?: string
      error?: string
      attemptsRemaining?: number
    }

    if (!response.ok || !payload.success) {
      if (typeof payload.attemptsRemaining === 'number') {
        const err = new Error(payload.error || 'Failed to verify OTP') as Error & { attemptsRemaining?: number }
        err.attemptsRemaining = payload.attemptsRemaining
        throw err
      }
      throw new Error(payload.error || 'Failed to verify OTP')
    }

    if (payload.tokenHash) {
      const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: payload.tokenHash,
      })

      if (sessionError) {
        console.error('Failed to establish session from magic link:', sessionError)
        throw new Error('OTP verified but session could not be established. Please try again.')
      }

      await waitForSessionToStabilize()

      if (sessionData.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', sessionData.user.id)
          .single()

        if (profile) {
          return {
            success: true,
            message: 'OTP verified successfully',
            user: {
              id: sessionData.user.id,
              role: (profile as UserProfile).role,
              schoolId: (profile as UserProfile).school_id,
            },
            tokenHash: payload.tokenHash,
            verifiedAt: payload.verifiedAt,
          }
        }
      }
    }

    return payload as {
      success: boolean
      message?: string
      user?: { id: string; role: string; schoolId: string | null }
      tokenHash?: string | null
      verifiedAt?: string
      error?: string
      attemptsRemaining?: number
    }
  }

  /**
   * Resend a previously issued Hubtel OTP.
   */
  static async resendPasswordlessOtp(requestId: string, role: UserRole): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    const response = await fetch('/api/auth/passwordless', {
      method: 'POST',
      headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        action: 'resend',
        requestId,
        role,
      }),
    })

    const payload = (await response.json()) as {
      success?: boolean
      message?: string
      error?: string
    }

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Failed to resend OTP')
    }

    return payload as {
      success: boolean
      message?: string
      error?: string
    }
  }

  /**
   * Request a magic link to be sent to the user's email.
   * The link contains a token_hash that establishes a session when clicked.
   */
  static async requestMagicLink(params: PasswordlessSendOtpParams): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    const response = await fetch('/api/auth/passwordless', {
      method: 'POST',
      headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        action: 'magiclink',
        ...params,
      }),
    })

    const payload = (await response.json()) as {
      success?: boolean
      message?: string
      error?: string
    }

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Failed to send magic link')
    }

    return payload as {
      success: boolean
      message?: string
      error?: string
    }
  }

  static async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) return null

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) return null

    return { user, profile: profile as UserProfile }
  }

  static async signOut() {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: getClientCsrfHeaders({}),
          signal: controller.signal,
        })
      } catch (err) {
        console.warn('Logout endpoint failed or timed out:', err)
      } finally {
        clearTimeout(timeout)
      }
    } catch (e) {
      console.warn('Unexpected error during logout request setup:', e)
    }

    try {
      const signOutPromise = supabase.auth.signOut()
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('signOut timeout')), 5000))
      const result = await Promise.race([signOutPromise, timeoutPromise]).catch((err) => ({ error: err }))
      if (result && (result as any).error) {
        console.warn('Supabase signOut returned error:', (result as any).error)
      }
    } catch (err) {
      console.warn('Supabase signOut failed or timed out:', err)
    }

    try {
      clearAuthPersistencePreference()
    } catch {}

    if (typeof document !== 'undefined') {
      try {
        document.cookie = `${MFA_VERIFIED_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      } catch {}
    }
  }

  static async checkSchoolAccess(userId: string, schoolId: string): Promise<boolean> {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, school_id')
      .eq('user_id', userId)
      .single()

    if (!profile) return false

    const typedProfile = profile as UserProfile
    if (typedProfile.role === 'super_admin') return true

    return typedProfile.school_id === schoolId
  }
}
