import 'server-only'

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function toBase32(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

function fromBase32(value: string): Buffer {
  const clean = value.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let accumulator = 0
  const bytes: number[] = []

  for (const character of clean) {
    const index = BASE32_ALPHABET.indexOf(character)
    if (index < 0) continue
    accumulator = (accumulator << 5) | index
    bits += 5

    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

export function generateMfaSecret(): { secretBase32: string; otpauthUrl: string } {
  const secretBase32 = toBase32(randomBytes(20))
  const otpauthUrl = `otpauth://totp/SmartSBA?secret=${secretBase32}&issuer=SmartSBA`
  return { secretBase32, otpauthUrl }
}

export function generateTotpCode(secretBase32: string, counter: number): string {
  const secret = fromBase32(secretBase32)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))

  const hmac = createHmac('sha1', secret).update(buffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return String(binary % 1_000_000).padStart(6, '0')
}

export function verifyTotpCode(secretBase32: string, code: string, window = 1, periodSeconds = 30): boolean {
  const normalizedCode = code.trim().replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalizedCode)) return false

  const currentCounter = Math.floor(Date.now() / (periodSeconds * 1000))

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotpCode(secretBase32, currentCounter + offset)
    const expectedBuffer = Buffer.from(expected)
    const providedBuffer = Buffer.from(normalizedCode)

    if (expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)) {
      return true
    }
  }

  return false
}

export function generateBackupCodes(count = 10): { codes: string[]; hashedCodes: string[] } {
  const codes = Array.from({ length: count }, () => randomBytes(5).toString('hex').toUpperCase())
  const hashedCodes = codes.map((code) => createHash('sha256').update(code).digest('hex'))
  return { codes, hashedCodes }
}