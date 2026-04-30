export const OTP_VERIFIED_COOKIE_NAME = 'smartsba_otp_verified'

function normalizeOtpTimestamp(verifiedAt: string): string {
  const normalized = new Date(verifiedAt)

  if (Number.isNaN(normalized.getTime())) {
    return verifiedAt
  }

  return normalized.toISOString()
}

/**
 * Build an OTP verification cookie value in format: userId:verifiedAt
 * This mirrors the MFA session pattern for consistency
 * @param userId User ID who completed OTP verification
 * @param verifiedAt ISO timestamp of when OTP was verified
 * @returns Cookie value string
 */
export function buildOtpCookieValue(userId: string, verifiedAt: string): string {
  return `${userId}:${normalizeOtpTimestamp(verifiedAt)}`
}

/**
 * Verify that an OTP cookie is valid for the given user
 * Compares the provided cookie against the expected value
 * @param userId User ID to verify against
 * @param verifiedAt ISO timestamp when OTP was verified (from database)
 * @param providedCookie The cookie value from request
 * @returns true if cookie is valid, false otherwise
 */
export function isOtpCookieVerified(
  userId: string,
  verifiedAt: string | null | undefined,
  providedCookie: string | null | undefined
): boolean {
  if (!verifiedAt || !providedCookie) {
    return false
  }

  return buildOtpCookieValue(userId, verifiedAt) === providedCookie
}
