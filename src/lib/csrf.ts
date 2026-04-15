export const CSRF_COOKIE_NAME = 'smartsba_csrf_token'

const CSRF_HEADER_NAME = 'x-csrf-token'

export function createCsrfToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getClientCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${CSRF_COOKIE_NAME}=`))

  if (!cookie) {
    return null
  }

  const [, value] = cookie.split('=')
  return value ? decodeURIComponent(value) : null
}

export function getClientCsrfHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getClientCsrfToken()

  if (!token) {
    return extraHeaders
  }

  return {
    ...extraHeaders,
    [CSRF_HEADER_NAME]: token,
  }
}