'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

export default function DateRangeSelector() {
  const router = useRouter()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleApply = () => {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    router.push(`?${params.toString()}`)
  }

  const handleReset = () => {
    setStartDate('')
    setEndDate('')
    router.push('/dashboard/super-admin/reports')
  }

  const setPreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
    
    const params = new URLSearchParams()
    params.set('startDate', start.toISOString().split('T')[0])
    params.set('endDate', end.toISOString().split('T')[0])
    router.push(`?${params.toString()}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Date Range Filter
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApply}>Apply</Button>
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 w-full mt-2">
            <Button variant="secondary" size="sm" onClick={() => setPreset(7)}>
              Last 7 Days
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPreset(30)}>
              Last 30 Days
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPreset(90)}>
              Last 90 Days
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPreset(365)}>
              Last Year
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
