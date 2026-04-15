import { createHmac, timingSafeEqual } from 'crypto'
import { cookies, headers } from 'next/headers'

export type AssumableRole = 'school_admin' | 'teacher' | 'student' | 'parent'

type AssumeRoleTokenPayload = {
  actorUserId: string
  assumedUserId: string
  assumedRole: AssumableRole
  issuedAt: number
  expiresAt: number
  requestFingerprint: string
}

export type AssumeRoleContext = AssumeRoleTokenPayload

export const ASSUME_ROLE_COOKIE_NAME = 'smartsba_assume_role'
const DEFAULT_ASSUME_ROLE_TTL_SECONDS = 30 * 60

function getCookieSecret(): string | null {
  return (
    process.env.ASSUME_ROLE_COOKIE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null
  )
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(input: string): string {
  const normalized = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const pad = normalized.length % 4
  const padded = pad === 0 ? normalized : `${normalized}${'='.repeat(4 - pad)}`
  return Buffer.from(padded, 'base64').toString('utf8')
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function clampTtlSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ASSUME_ROLE_TTL_SECONDS
  // Keep assumption sessions short-lived by policy.
  return Math.min(Math.max(Math.floor(value), 60), 4 * 60 * 60)
}

export function getAssumeRoleTtlSeconds(): number {
  const raw = process.env.ASSUME_ROLE_SESSION_TTL_SECONDS
  if (!raw) return DEFAULT_ASSUME_ROLE_TTL_SECONDS
  const parsed = Number.parseInt(raw, 10)
  return clampTtlSeconds(parsed)
}

function getClientIp(headerBag: Headers): string {
  const forwarded = headerBag.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = headerBag.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return 'unknown'
}

export function getRequestFingerprintFromHeaders(headerBag: Headers): string {
  const ip = getClientIp(headerBag)
  const userAgent = headerBag.get('user-agent')?.trim() || 'unknown'
  return createHmac('sha256', `${ip}:${userAgent}`).update('assume-role-fingerprint').digest('hex')
}

export function createAssumeRoleCookieValue(payload: AssumeRoleTokenPayload): string {
  const secret = getCookieSecret()
  if (!secret) {
    throw new Error('ASSUME_ROLE_COOKIE_SECRET is not configured')
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = sign(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

export function parseAssumeRoleCookieValue(rawValue: string | undefined | null): AssumeRoleContext | null {
  if (!rawValue) return null

  const [encodedPayload, signature] = rawValue.split('.')
  if (!encodedPayload || !signature) return null

  const secret = getCookieSecret()
  if (!secret) return null

  const expectedSignature = sign(encodedPayload, secret)

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null
  }

  const valid = timingSafeEqual(signatureBuffer, expectedBuffer)
  if (!valid) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AssumeRoleTokenPayload
    if (
      !payload.actorUserId ||
      !payload.assumedUserId ||
      !payload.assumedRole ||
      !payload.issuedAt ||
      !payload.expiresAt ||
      !payload.requestFingerprint
    ) {
      return null
    }

    if (!Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt)) {
      return null
    }

    if (Date.now() >= payload.expiresAt) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export async function getAssumeRoleContextForActor(actorUserId: string): Promise<AssumeRoleContext | null> {
  const headerBag = await headers()
  const cookieStore = await cookies()
  const context = parseAssumeRoleCookieValue(cookieStore.get(ASSUME_ROLE_COOKIE_NAME)?.value)
  if (!context) return null
  if (context.actorUserId !== actorUserId) return null
  if (context.requestFingerprint !== getRequestFingerprintFromHeaders(headerBag)) return null
  return context
}
