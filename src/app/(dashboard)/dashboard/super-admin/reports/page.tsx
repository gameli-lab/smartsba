import { Metadata } from 'next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
    <div className="space-y-8 p-4 text-gray-900 dark:text-gray-100 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Advanced Reports</h1>
          <p className="mt-2 text-muted-foreground dark:text-gray-300">
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
