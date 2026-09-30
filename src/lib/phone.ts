/**
 * Normalize a phone number to E164 international format.
 * Handles local formats like "0241234567" → "+233241234567" for GH.
 */
export function normalizePhoneToE164(phone: string, countryCode = 'GH'): string {
  const cleaned = phone.replace(/[\s\-()]/g, '')

  // Already in E164 format
  if (cleaned.startsWith('+')) {
    return cleaned
  }

  // Ghana: strip leading 0 and prepend +233
  if (countryCode === 'GH') {
    if (cleaned.startsWith('0')) {
      return `+233${cleaned.slice(1)}`
    }
    if (cleaned.startsWith('233')) {
      return `+${cleaned}`
    }
  }

  // Fallback: assume it's already international without +
  return `+${cleaned}`
}
