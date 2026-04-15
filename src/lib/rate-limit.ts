type RateLimitOptions = {
  limit: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

type Bucket = {
  windowStart: number
  count: number
}

const globalForRateLimit = globalThis as typeof globalThis & {
  __smartsbaRateLimitBuckets?: Map<string, Bucket>
}

const buckets = globalForRateLimit.__smartsbaRateLimitBuckets ?? new Map<string, Bucket>()

if (!globalForRateLimit.__smartsbaRateLimitBuckets) {
  globalForRateLimit.__smartsbaRateLimitBuckets = buckets
}

export function applyRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || now - existing.windowStart >= options.windowMs) {
    buckets.set(key, { windowStart: now, count: 1 })
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - 1),
      retryAfterSeconds: 0,
    }
  }

  existing.count += 1
  buckets.set(key, existing)

  if (existing.count <= options.limit) {
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - existing.count),
      retryAfterSeconds: 0,
    }
  }

  const retryAfterMs = Math.max(0, options.windowMs - (now - existing.windowStart))

  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
  }
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  return 'unknown-ip'
}

export function normalizeRateLimitIdentifier(value: string): string {
  return value.trim().toLowerCase()
}