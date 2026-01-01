"use client"

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface PerformanceData {
  session: {
    id: string
    academic_year: string
    term: number
  }
  aggregate: {
    aggregate_score: number | null
    class_position: number | null
  } | null
  remark: {
    remark: string | null
    promotion_status: string | null
  } | null
}

interface PerformanceClientProps {
  studentId: string
  schoolId: string
  sessions: Array<{ id: string; academic_year: string; term: number }>
  initialData: PerformanceData | null
}

export function PerformanceClient({ studentId, schoolId, sessions, initialData }: PerformanceClientProps) {
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedTerm, setSelectedTerm] = useState<string>('')
  const [data, setData] = useState<PerformanceData | null>(initialData)
  const [loading, setLoading] = useState(false)

  // Get unique years
  const years = Array.from(new Set(sessions.map(s => s.academic_year))).sort((a, b) => b.localeCompare(a))
  
  // Get terms for selected year
  const availableTerms = selectedYear 
    ? sessions.filter(s => s.academic_year === selectedYear).map(s => s.term).sort()
    : []

  useEffect(() => {
    if (sessions.length > 0 && !selectedYear) {
      // Default to most recent year
      const latestYear = years[0]
      setSelectedYear(latestYear)
      
      // Default to most recent term in that year
      const termsInYear = sessions.filter(s => s.academic_year === latestYear).map(s => s.term)
      const latestTerm = Math.max(...termsInYear)
      setSelectedTerm(latestTerm.toString())
    }
  }, [sessions, years, selectedYear])

  useEffect(() => {
    async function fetchData() {
      if (!selectedYear || !selectedTerm) return

      setLoading(true)
      try {
        const session = sessions.find(s => s.academic_year === selectedYear && s.term === parseInt(selectedTerm))
        if (!session) {
          setData(null)
          return
        }

        const response = await fetch(`/api/student/performance?session_id=${session.id}`)
        const result = await response.json()
        
        setData({
          session,
          aggregate: result.aggregate || null,
          remark: result.remark || null,
        })
      } catch (error) {
        console.error('Failed to fetch performance data:', error)
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedYear, selectedTerm, sessions])

  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    // Reset term to first available in new year
    const termsInYear = sessions.filter(s => s.academic_year === year).map(s => s.term)
    if (termsInYear.length > 0) {
      setSelectedTerm(termsInYear[0].toString())
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Academic Year</label>
          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Term</label>
          <Select value={selectedTerm} onValueChange={setSelectedTerm} disabled={!selectedYear}>
            <SelectTrigger>
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              {availableTerms.map(term => (
                <SelectItem key={term} value={term.toString()}>
                  Term {term}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Loading...</p>
          </CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">No performance data available for the selected period.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Term Average</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {data.aggregate?.aggregate_score !== null && data.aggregate?.aggregate_score !== undefined
                    ? `${data.aggregate.aggregate_score}%`
                    : 'N/A'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Class Position</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {data.aggregate?.class_position !== null && data.aggregate?.class_position !== undefined
                    ? data.aggregate.class_position
                    : 'N/A'}
                </div>
              </CardContent>
            </Card>
          </div>

          {data.remark && (
            <Card>
              <CardHeader>
                <CardTitle>Class Teacher's Remark</CardTitle>
                <CardDescription>Feedback from your class teacher for this term.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.remark.remark ? (
                  <p className="text-sm text-gray-700">{data.remark.remark}</p>
                ) : (
                  <p className="text-sm text-gray-500">No remark provided yet.</p>
                )}
                
                {data.session.term === 3 && data.remark.promotion_status && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Promotion Status:</span>
                      <Badge
                        variant={
                          data.remark.promotion_status === 'promoted'
                            ? 'default'
                            : data.remark.promotion_status === 'repeated'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {data.remark.promotion_status.charAt(0).toUpperCase() + data.remark.promotion_status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
