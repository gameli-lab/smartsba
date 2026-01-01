import { Metadata } from 'next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileDown } from 'lucide-react'
import {
  getSchoolPerformanceReport,
  getUsageTrendsReport,
  getFeatureAdoptionReport,
} from './actions'
import SchoolPerformanceReport from './SchoolPerformanceReport'
import UsageTrendsReport from './UsageTrendsReport'
import FeatureAdoptionReport from './FeatureAdoptionReport'
import DateRangeSelector from './DateRangeSelector'
import ReportsExport from './ReportsExport'

export const metadata: Metadata = {
  title: 'Advanced Reports | Super Admin',
  description: 'Platform analytics and performance reports',
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const startDate = typeof params.startDate === 'string' ? params.startDate : undefined
  const endDate = typeof params.endDate === 'string' ? params.endDate : undefined

  const dateRange = { startDate, endDate }

  const [schoolPerformance, usageTrends, featureAdoption] = await Promise.all([
    getSchoolPerformanceReport(dateRange),
    getUsageTrendsReport(dateRange),
    getFeatureAdoptionReport(dateRange),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advanced Reports</h1>
          <p className="text-muted-foreground mt-2">
            Platform analytics, performance metrics, and insights
          </p>
        </div>
        <ReportsExport
          schoolPerformance={schoolPerformance.data}
          usageTrends={usageTrends.data}
          featureAdoption={featureAdoption.data}
          dateRange={dateRange}
        />
      </div>

      <DateRangeSelector />

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">School Performance</TabsTrigger>
          <TabsTrigger value="usage">Usage Trends</TabsTrigger>
          <TabsTrigger value="adoption">Feature Adoption</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <SchoolPerformanceReport data={schoolPerformance.data} />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <UsageTrendsReport data={usageTrends.data} />
        </TabsContent>

        <TabsContent value="adoption" className="space-y-4">
          <FeatureAdoptionReport data={featureAdoption.data} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
