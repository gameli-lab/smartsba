'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { FileDown, Loader2 } from 'lucide-react'
import {
  exportSchoolPerformanceToPDF,
  exportUsageTrendsToPDF,
  exportFeatureAdoptionToPDF,
} from '@/lib/pdf-export'
import type { SchoolPerformance, UsageTrend, FeatureAdoption } from './actions'

interface ReportsExportProps {
  schoolPerformance: SchoolPerformance[]
  usageTrends: UsageTrend[]
  featureAdoption: FeatureAdoption[]
  dateRange?: { startDate?: string; endDate?: string }
}

export default function ReportsExport({
  schoolPerformance,
  usageTrends,
  featureAdoption,
  dateRange,
}: ReportsExportProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async (type: 'performance' | 'trends' | 'adoption' | 'all') => {
    setLoading(true)
    try {
      if (type === 'performance' || type === 'all') {
        const result = await exportSchoolPerformanceToPDF(schoolPerformance, dateRange)
        if (!result.success) {
          alert(result.error || 'Failed to export school performance report')
        }
      }

      if (type === 'trends' || type === 'all') {
        const result = await exportUsageTrendsToPDF(usageTrends, dateRange)
        if (!result.success) {
          alert(result.error || 'Failed to export usage trends report')
        }
      }

      if (type === 'adoption' || type === 'all') {
        const result = await exportFeatureAdoptionToPDF(featureAdoption, dateRange)
        if (!result.success) {
          alert(result.error || 'Failed to export feature adoption report')
        }
      }

      if (type === 'all') {
        alert('All reports exported successfully!')
      }
    } catch (error) {
      console.error('Export error:', error)
      alert('An error occurred while exporting')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              Export Reports
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="dark:border-gray-800 dark:bg-gray-950">
        <DropdownMenuLabel>Export as PDF</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('performance')}>
          School Performance
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('trends')}>
          Usage Trends
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('adoption')}>
          Feature Adoption
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('all')}>
          Export All Reports
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
