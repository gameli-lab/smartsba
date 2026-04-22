'use server'

import { requireSchoolAdmin } from '@/lib/auth-guards'

export interface SettingsInput {
  gradingScheme: 'default' | 'custom'
  showPositions: boolean
  showPromotionTerm3: boolean
  reportTemplate: 'standard' | 'compact'
  featureToggles: {
    qrVerification: boolean
    enableExports: boolean
  }
}

// Placeholder action until a storage backend for settings is defined.
export async function saveSettings(input: SettingsInput) {
  void input
  await requireSchoolAdmin()
  return { success: false, error: 'TODO: Persist settings when storage is available.' }
}
