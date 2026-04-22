import { requireSchoolAdmin } from '@/lib/auth-guards'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  await requireSchoolAdmin()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">School-level overrides (config-only for now).</p>
      </div>

      <SettingsClient />
    </div>
  )
}
