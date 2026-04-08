'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { saveSettings, SettingsInput } from './actions'

const defaults: SettingsInput = {
  gradingScheme: 'default',
  showPositions: true,
  showPromotionTerm3: true,
  reportTemplate: 'standard',
  featureToggles: {
    qrVerification: true,
    enableExports: true,
  },
}

export function SettingsClient() {
  const [state, setState] = useState<SettingsInput>(defaults)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await saveSettings(state)
      if (!result.success) {
        setError(result.error || 'Unable to save (TODO: storage)')
        return
      }
      setMessage('Settings saved')
    })
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Grading Overrides</CardTitle>
          <CardDescription>Set grading scheme preferences (config only).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Grading Scheme</Label>
            <Select
              value={state.gradingScheme}
              onValueChange={(v: SettingsInput['gradingScheme']) => setState((s) => ({ ...s, gradingScheme: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (A-F)</SelectItem>
                <SelectItem value="custom">Custom (TODO)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleRow
              label="Show positions"
              description="Display positions on reports"
              checked={state.showPositions}
              onChange={(v) => setState((s) => ({ ...s, showPositions: v }))}
            />
            <ToggleRow
              label="Show promotion status (Term 3)"
              description="Only show promotion decisions in 3rd term"
              checked={state.showPromotionTerm3}
              onChange={(v) => setState((s) => ({ ...s, showPromotionTerm3: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Format</CardTitle>
          <CardDescription>Choose the default report template.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select
              value={state.reportTemplate}
              onValueChange={(v: SettingsInput['reportTemplate']) => setState((s) => ({ ...s, reportTemplate: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Toggles</CardTitle>
          <CardDescription>Enable or disable optional features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleRow
              label="QR Verification"
              description="Show QR code on reports"
              checked={state.featureToggles.qrVerification}
              onChange={(v) => setState((s) => ({ ...s, featureToggles: { ...s.featureToggles, qrVerification: v } }))}
            />
            <ToggleRow
              label="Enable Exports"
              description="Allow PDF/Excel exports"
              checked={state.featureToggles.enableExports}
              onChange={(v) => setState((s) => ({ ...s, featureToggles: { ...s.featureToggles, enableExports: v } }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          TODO: Persist settings once a storage backend is provided.
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          Save (config-only)
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between border rounded-lg px-3 py-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  )
}
