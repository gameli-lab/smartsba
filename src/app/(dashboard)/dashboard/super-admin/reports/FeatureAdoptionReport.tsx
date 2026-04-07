'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import type { FeatureAdoption } from './actions'

interface FeatureAdoptionReportProps {
  data: FeatureAdoption[]
}

export default function FeatureAdoptionReport({ data }: FeatureAdoptionReportProps) {
  const getAdoptionColor = (rate: number) => {
    if (rate >= 75) return 'text-green-600'
    if (rate >= 50) return 'text-yellow-600'
    if (rate >= 25) return 'text-orange-600'
    return 'text-red-600'
  }

  const totalUsage = data.reduce((acc, feature) => acc + feature.usage_count, 0)
  const avgAdoptionRate = data.length > 0
    ? data.reduce((acc, feature) => acc + feature.adoption_rate, 0) / data.length
    : 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Features Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Adoption Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getAdoptionColor(avgAdoptionRate)}`}>
              {avgAdoptionRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Feature Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Adoption Table */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Adoption by Schools</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No feature data available
            </div>
          ) : (
            <div className="space-y-6">
              {data.map((feature) => (
                <div key={feature.feature_name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{feature.feature_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {feature.schools_using} of {feature.total_schools} schools using this feature
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getAdoptionColor(feature.adoption_rate)}`}>
                        {feature.adoption_rate.toFixed(1)}%
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {feature.usage_count.toLocaleString()} total uses
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={feature.adoption_rate} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Feature Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-right">Schools Using</TableHead>
                  <TableHead className="text-right">Total Schools</TableHead>
                  <TableHead className="text-right">Adoption Rate</TableHead>
                  <TableHead className="text-right">Total Usage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((feature) => (
                  <TableRow key={feature.feature_name}>
                    <TableCell className="font-medium">{feature.feature_name}</TableCell>
                    <TableCell className="text-right">{feature.schools_using}</TableCell>
                    <TableCell className="text-right">{feature.total_schools}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold ${getAdoptionColor(feature.adoption_rate)}`}>
                        {feature.adoption_rate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{feature.usage_count.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
