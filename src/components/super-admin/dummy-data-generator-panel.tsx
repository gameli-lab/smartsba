'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getClientCsrfHeaders } from '@/lib/csrf'
import { supabase } from '@/lib/supabase'

type Preset = 'full_school_fixture' | 'report_focused'

type GeneratorPayload = {
  success?: boolean
  error?: string
  result?: {
    schoolId: string
    schoolName: string
    createdCounts: Record<string, number>
  }
}

type SchoolOption = {
  id: string
  name: string
}

export function DummyDataGeneratorPanel() {
  const [preset, setPreset] = useState<Preset>('full_school_fixture')
  const [schoolId, setSchoolId] = useState('')
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratorPayload['result'] | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadSchools = async () => {
      const { data } = await supabase
        .from('schools')
        .select('id, name')
        .order('name', { ascending: true })

      if (!cancelled) {
        setSchools((data || []) as SchoolOption[])
      }
    }

    loadSchools()

    return () => {
      cancelled = true
    }
  }, [])

  const runGenerator = async () => {
    setIsRunning(true)
    setMessage(null)
    setResult(null)

    try {
      const response = await fetch('/api/super-admin/dummy-data', {
        method: 'POST',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          preset,
          schoolId: schoolId.trim() || null,
        }),
      })

      const payload = (await response.json()) as GeneratorPayload
      if (!response.ok || !payload.success || !payload.result) {
        throw new Error(payload.error || 'Dummy data generation failed')
      }

      setResult(payload.result)
      setMessage('Dummy data generated successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Dummy data generation failed')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dummy Data Generator</CardTitle>
        <CardDescription>Create realistic test fixtures for portal and reporting verification.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Preset</Label>
            <Select value={preset} onValueChange={(value) => setPreset(value as Preset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_school_fixture">Full School Fixture</SelectItem>
                <SelectItem value="report_focused">Report-Focused Dataset</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Target School</Label>
            <Select value={schoolId || '__new__'} onValueChange={(value) => setSchoolId(value === '__new__' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Create a new sandbox school" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">Create a new sandbox school</SelectItem>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>
                    {school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave this on the default option to create a fresh sandbox school, or choose an existing school to target.
            </p>
          </div>
        </div>

        <Button type="button" onClick={runGenerator} disabled={isRunning}>
          {isRunning ? 'Generating...' : 'Generate Dummy Data'}
        </Button>

        {message ? (
          <p className={`text-sm ${result ? 'text-green-700' : 'text-red-700'}`}>
            {message}
          </p>
        ) : null}

        {result ? (
          <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-700">
            <p><strong>School:</strong> {result.schoolName}</p>
            <p><strong>School ID:</strong> {result.schoolId}</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {Object.entries(result.createdCounts).map(([key, value]) => (
                <p key={key}><strong>{key}:</strong> {value}</p>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
