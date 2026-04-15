export const MFA_VERIFIED_COOKIE_NAME = 'smartsba_mfa_verified'

export function buildMfaCookieValue(userId: string, lastUsedAt: string): string {
  return `${userId}:${lastUsedAt}`
}
