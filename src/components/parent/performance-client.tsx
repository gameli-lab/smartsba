"use client"

import { useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PerformanceRecord {
  session_id: string
  academic_year: string
  term: number
  aggregate_score: number | null
  total_subjects: number | null
  class_position: number | null
}

interface PerformanceClientProps {
  data: PerformanceRecord[]
  availableYears: string[]
  subjectTrendData: Array<{
    subject_id: string
    subject_name: string
    total_score: number | null
    academic_year: string
    term: number
  }>
}

export function PerformanceClient({ data, availableYears, subjectTrendData }: PerformanceClientProps) {
  const [selectedYear, setSelectedYear] = useState<string>(availableYears[0] || '')
  const [selectedTerm, setSelectedTerm] = useState<string>('all')

  const timeline = useMemo(() => [...data].reverse(), [data])

  const latestWithScore = timeline.filter((item) => item.aggregate_score !== null)
  const latestScore = latestWithScore[latestWithScore.length - 1]?.aggregate_score ?? null
  const previousScore = latestWithScore.length > 1 ? latestWithScore[latestWithScore.length - 2].aggregate_score : null
  const trendDelta = latestScore !== null && previousScore !== null ? Number((latestScore - previousScore).toFixed(2)) : null

  const bestTerm = timeline
    .filter((item) => item.aggregate_score !== null)
    .reduce<PerformanceRecord | null>((best, row) => {
      if (!best || (row.aggregate_score as number) > (best.aggregate_score as number)) return row
      return best
    }, null)

  const subjectInsights = useMemo(() => {
    const grouped = new Map<string, { subjectName: string; scores: number[] }>()

    subjectTrendData.forEach((row) => {
      if (row.total_score === null) return
      const existing = grouped.get(row.subject_id)
      if (!existing) {
        grouped.set(row.subject_id, { subjectName: row.subject_name, scores: [row.total_score] })
        return
      }
      existing.scores.push(row.total_score)
    })

    return Array.from(grouped.values())
      .map((entry) => {
        const first = entry.scores[0]
        const last = entry.scores[entry.scores.length - 1]
        const delta = Number((last - first).toFixed(2))
        return {
          subjectName: entry.subjectName,
          first,
          last,
          delta,
          points: entry.scores.length,
        }
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 8)
  }, [subjectTrendData])

  const filteredData = data.filter((record) => {
    const matchesYear = selectedYear === '' || record.academic_year === selectedYear
    const matchesTerm = selectedTerm === 'all' || record.term.toString() === selectedTerm
    return matchesYear && matchesTerm
  })

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Performance History</CardTitle>
          <CardDescription>Select academic year and term to view specific records.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">Academic Year</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">Term</label>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger>
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                <SelectItem value="1">Term 1</SelectItem>
                <SelectItem value="2">Term 2</SelectItem>
                <SelectItem value="3">Term 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Latest Average</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-gray-900">{latestScore !== null ? `${latestScore}%` : 'N/A'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Trend vs Previous Term</CardTitle>
          </CardHeader>
          <CardContent>
            {trendDelta === null ? (
              <p className="text-2xl font-semibold text-gray-900">N/A</p>
            ) : (
              <div className="flex items-center gap-2">
                {trendDelta > 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : trendDelta < 0 ? (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                ) : (
                  <Minus className="h-5 w-5 text-gray-500" />
                )}
                <p className="text-2xl font-semibold text-gray-900">
                  {trendDelta > 0 ? '+' : ''}{trendDelta}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Best Term</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-gray-900">
              {bestTerm ? `${bestTerm.academic_year} T${bestTerm.term}` : 'N/A'}
            </p>
            <p className="text-xs text-gray-500">
              {bestTerm?.aggregate_score !== null && bestTerm?.aggregate_score !== undefined ? `${bestTerm.aggregate_score}%` : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Term-over-Term Trend</CardTitle>
          <CardDescription>Average score progression across recorded terms.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timeline.map((record) => {
              const score = record.aggregate_score ?? 0
              const width = Math.max(4, Math.min(100, score))
              return (
                <div key={record.session_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{record.academic_year} • Term {record.term}</span>
                    <span>{record.aggregate_score !== null ? `${record.aggregate_score}%` : 'N/A'}</span>
                  </div>
                  <div className="h-2 w-full rounded bg-gray-100">
                    <div className="h-2 rounded bg-purple-600" style={{ width: `${record.aggregate_score !== null ? width : 4}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subject Trend Insights</CardTitle>
          <CardDescription>Largest changes between earliest and latest recorded scores per subject.</CardDescription>
        </CardHeader>
        <CardContent>
          {subjectInsights.length === 0 ? (
            <p className="text-sm text-gray-500">Not enough subject data to compute trends.</p>
          ) : (
            <div className="space-y-2">
              {subjectInsights.map((item) => (
                <div key={item.subjectName} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.subjectName}</p>
                    <p className="text-xs text-gray-500">{item.points} record{item.points === 1 ? '' : 's'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{item.last}%</p>
                    <p className={`text-xs ${item.delta > 0 ? 'text-emerald-600' : item.delta < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {item.delta > 0 ? '+' : ''}{item.delta}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {filteredData.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">No performance records found for the selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredData.map((record) => (
            <Card key={record.session_id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {record.academic_year} • Term {record.term}
                  </CardTitle>
                  <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                    Session Record
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <div className="text-sm font-medium text-gray-600">Term Average</div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">
                      {record.aggregate_score !== null ? `${record.aggregate_score}%` : 'N/A'}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <div className="text-sm font-medium text-gray-600">Class Position</div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">
                      {record.class_position !== null ? `${record.class_position}` : 'N/A'}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <div className="text-sm font-medium text-gray-600">Total Subjects</div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">
                      {record.total_subjects !== null ? `${record.total_subjects}` : 'N/A'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
