export const MFA_VERIFIED_COOKIE_NAME = 'smartsba_mfa_verified'

function normalizeMfaTimestamp(lastUsedAt: string): string {
  const normalized = new Date(lastUsedAt)

  if (Number.isNaN(normalized.getTime())) {
    return lastUsedAt
  }

  return normalized.toISOString()
}

export function buildMfaCookieValue(userId: string, lastUsedAt: string): string {
  return `${userId}:${normalizeMfaTimestamp(lastUsedAt)}`
}

export function isMfaCookieVerified(
  userId: string,
  lastUsedAt: string | null | undefined,
  providedCookie: string | null | undefined
): boolean {
  if (!lastUsedAt || !providedCookie) {
    return false
  }

  return buildMfaCookieValue(userId, lastUsedAt) === providedCookie
}
