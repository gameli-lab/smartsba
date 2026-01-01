"use client"

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
}

export function PerformanceClient({ data, availableYears }: PerformanceClientProps) {
  const [selectedYear, setSelectedYear] = useState<string>(availableYears[0] || '')
  const [selectedTerm, setSelectedTerm] = useState<string>('all')

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
