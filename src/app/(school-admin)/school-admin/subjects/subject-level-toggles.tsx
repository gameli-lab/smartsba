"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { getClientCsrfHeaders } from '@/lib/csrf'

type SubjectSetting = {
  id: string
  level_group: 'KG' | 'PRIMARY' | 'JHS' | 'SHS' | 'SHTS'
  subject_key: string
  subject_name: string
  is_enabled: boolean
}

export function SubjectLevelToggles({
  schoolId,
  settings,
}: {
  schoolId: string
  settings: SubjectSetting[]
}) {
  const router = useRouter()
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())

  const grouped = settings.reduce<Record<string, SubjectSetting[]>>((acc, setting) => {
    acc[setting.level_group] = acc[setting.level_group] || []
    acc[setting.level_group].push(setting)
    return acc
  }, {})

  const handleToggle = async (setting: SubjectSetting, nextEnabled: boolean) => {
    const key = `${setting.level_group}:${setting.subject_key}`
    setPendingKeys((prev) => new Set(prev).add(key))

    try {
      const response = await fetch(`/api/schools/${schoolId}/subjects/toggle`, {
        method: 'PATCH',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          level_group: setting.level_group,
          subject_key: setting.subject_key,
          is_enabled: nextEnabled,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload?.error || 'Failed to update subject toggle')
      }

      router.refresh()
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to update subject toggle')
    } finally {
      setPendingKeys((prev) => {
        const copy = new Set(prev)
        copy.delete(key)
        return copy
      })
    }
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([levelGroup, rows]) => (
        <div key={levelGroup} className="space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{levelGroup}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {rows
              .sort((a, b) => a.subject_name.localeCompare(b.subject_name))
              .map((setting) => {
                const pendingKey = `${setting.level_group}:${setting.subject_key}`
                const pending = pendingKeys.has(pendingKey)

                return (
                  <div key={setting.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{setting.subject_name}</Label>
                    <Switch
                      checked={setting.is_enabled}
                      disabled={pending}
                      onCheckedChange={(checked) => handleToggle(setting, checked)}
                    />
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
