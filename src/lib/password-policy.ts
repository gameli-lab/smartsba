import { createAdminSupabaseClient } from '@/lib/supabase'

export type PasswordPolicy = {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumber: boolean
  requireSpecial: boolean
}

const DEFAULT_SPECIAL_CHARACTERS = '@#$%&*!'

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,
}

function getRandomValues(length: number): Uint32Array {
  const values = new Uint32Array(length)

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(values)
    return values
  }

  for (let index = 0; index < length; index += 1) {
    values[index] = Math.floor(Math.random() * 0xffffffff)
  }

  return values
}

function pickCharacter(characters: string, randomValue: number): string {
  return characters.charAt(randomValue % characters.length)
}

function shuffleCharacters(characters: string[]): string[] {
  const shuffled = [...characters]
  const randomValues = getRandomValues(shuffled.length)

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomValues[index] % (index + 1)
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

export function validatePasswordPolicy(password: string, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`)
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter')
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter')
  }

  if (policy.requireNumber && !/\d/.test(password)) {
    errors.push('Password must include at least one number')
  }

  if (policy.requireSpecial && !/[!@#$%&*?_\-]/.test(password)) {
    errors.push('Password must include at least one special character')
  }

  return { valid: errors.length === 0, errors }
}

export function generateCompliantPassword(length = 16, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): string {
  const effectiveLength = Math.max(length, policy.minLength)
  const requiredCharacters: string[] = []
  const charsetParts: string[] = []

  if (policy.requireUppercase) {
    charsetParts.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    requiredCharacters.push(pickCharacter('ABCDEFGHIJKLMNOPQRSTUVWXYZ', getRandomValues(1)[0]))
  }

  if (policy.requireLowercase) {
    charsetParts.push('abcdefghijklmnopqrstuvwxyz')
    requiredCharacters.push(pickCharacter('abcdefghijklmnopqrstuvwxyz', getRandomValues(1)[0]))
  }

  if (policy.requireNumber) {
    charsetParts.push('0123456789')
    requiredCharacters.push(pickCharacter('0123456789', getRandomValues(1)[0]))
  }

  if (policy.requireSpecial) {
    charsetParts.push(DEFAULT_SPECIAL_CHARACTERS)
    requiredCharacters.push(pickCharacter(DEFAULT_SPECIAL_CHARACTERS, getRandomValues(1)[0]))
  }

  const charset = charsetParts.join('') || 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const remainingLength = Math.max(0, effectiveLength - requiredCharacters.length)
  const randomValues = getRandomValues(remainingLength)
  const generatedCharacters: string[] = [...requiredCharacters]

  for (let index = 0; index < remainingLength; index += 1) {
    generatedCharacters.push(pickCharacter(charset, randomValues[index]))
  }

  return shuffleCharacters(generatedCharacters).join('')
}

export function generatePrefixedTemporaryPassword(prefix: string, totalLength = 16): string {
  const sanitizedPrefix = prefix.trim()
  const separator = sanitizedPrefix.endsWith('@') ? '' : '@'
  const bodyLength = Math.max(8, totalLength - sanitizedPrefix.length - separator.length)
  return `${sanitizedPrefix}${separator}${generateCompliantPassword(bodyLength, {
    ...DEFAULT_PASSWORD_POLICY,
    minLength: bodyLength,
    requireSpecial: true,
  })}`
}

type PasswordPolicySettingRow = {
  setting_key: string
  setting_value: unknown
}

function readBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return fallback
}

function readNumberSetting(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return fallback
}

export async function getPasswordPolicyFromSettings(): Promise<PasswordPolicy> {
  try {
    const adminSupabase = createAdminSupabaseClient()
    const { data, error } = await adminSupabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'security.password_min_length',
        'security.password_require_uppercase',
        'security.password_require_lowercase',
        'security.password_require_number',
        'security.password_require_special',
      ])

    if (error || !data) {
      return DEFAULT_PASSWORD_POLICY
    }

    const rows = data as PasswordPolicySettingRow[]
    const byKey = new Map(rows.map((row) => [row.setting_key, row.setting_value]))

    return {
      minLength: readNumberSetting(byKey.get('security.password_min_length'), DEFAULT_PASSWORD_POLICY.minLength),
      requireUppercase: readBooleanSetting(byKey.get('security.password_require_uppercase'), DEFAULT_PASSWORD_POLICY.requireUppercase),
      requireLowercase: readBooleanSetting(byKey.get('security.password_require_lowercase'), DEFAULT_PASSWORD_POLICY.requireLowercase),
      requireNumber: readBooleanSetting(byKey.get('security.password_require_number'), DEFAULT_PASSWORD_POLICY.requireNumber),
      requireSpecial: readBooleanSetting(byKey.get('security.password_require_special'), DEFAULT_PASSWORD_POLICY.requireSpecial),
    }
  } catch {
    return DEFAULT_PASSWORD_POLICY
  }
}