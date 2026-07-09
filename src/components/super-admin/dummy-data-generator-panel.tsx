"use client"

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
**/






'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Database, FileText, CheckCircle2, XCircle } from 'lucide-react'

type Preset = 'full_school_fixture' | 'report_focused'

type CreatedCounts = {
  users: number
  profiles: number
  classes: number
  subjects: number
  students: number
  teachers: number
  scores: number
  attendance: number
  remarks: number
  assignments: number
}

type GeneratorResult = {
  schoolId: string
  schoolName: string
  createdCounts: CreatedCounts
}

type ApiResponse = {
  success?: boolean
  result?: GeneratorResult
  error?: string
}

const PRESET_CONFIG = {
  full_school_fixture: {
    label: 'Full School Fixture',
    description: '3 classes · 4 teachers · 30 students · all subjects · complete scores, attendance, remarks & rankings',
    icon: Database,
  },
  report_focused: {
    label: 'Report Focused',
    description: '1 class · 2 teachers · 15 students · core + 2 electives · complete term-end report data',
    icon: FileText,
  },
} satisfies Record<Preset, { label: string; description: string; icon: React.ElementType }>

export function DummyDataGeneratorPanel() {
  const [selected, setSelected]   = useState<Preset | null>(null)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<GeneratorResult | null>(null)
  const [error, setError]         = useState<string | null>(null)

  async function handleGenerate() {
    if (!selected) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/super-admin/dummy-data', {
        method: 'POST',
        headers: getClientCsrfHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'same-origin',
        body: JSON.stringify({ preset: selected }),
      })

      const data = (await res.json()) as ApiResponse

      if (!res.ok || !data.success || !data.result) {
        throw new Error(data.error || 'Generation failed')
      }

      setResult(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dummy Data Generator</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Generate a complete term-end dataset — scores, attendance, class teacher remarks, and rankings — ready for report preview.
        </p>
      </div>

      {/* Preset selector */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(Object.entries(PRESET_CONFIG) as [Preset, typeof PRESET_CONFIG[Preset]][]).map(([key, cfg]) => {
          const Icon = cfg.icon
          const isSelected = selected === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setSelected(key); setResult(null); setError(null) }}
              className={[
                'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600 dark:hover:bg-gray-800/60',
              ].join(' ')}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
              <div>
                <p className={`font-medium ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                  {cfg.label}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{cfg.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={!selected || loading}
        className="w-full sm:w-auto"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating data…
          </>
        ) : (
          'Generate Dataset'
        )}
      </Button>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="flex items-start gap-3 pt-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Generation failed</p>
              <p className="mt-0.5 text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success result */}
      {result && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <CardTitle className="text-base text-green-700 dark:text-green-300">Dataset generated successfully</CardTitle>
            </div>
            <CardDescription className="text-green-600 dark:text-green-400">
              {result.schoolName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {(Object.entries(result.createdCounts) as [keyof CreatedCounts, number][]).map(([key, val]) => (
                <div key={key} className="rounded-md border border-green-200 bg-white px-3 py-2 dark:border-green-900 dark:bg-gray-900">
                  <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{key}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{val}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              School ID: <span className="font-mono">{result.schoolId}</span>
            </p>
            <p className="mt-1 text-xs text-green-700 dark:text-green-400">
              All student report cards are ready to preview. Log in as any generated student to verify.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}