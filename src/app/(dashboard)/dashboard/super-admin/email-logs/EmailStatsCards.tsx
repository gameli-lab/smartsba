'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react'

interface EmailStats {
  total: number
  sent: number
  pending: number
  failed: number
  bounced: number
  todayCount: number
  weekCount: number
}

interface EmailStatsCardsProps {
  stats: EmailStats
}

export default function EmailStatsCards({ stats }: EmailStatsCardsProps) {
  const successRate = stats.total > 0 
    ? ((stats.sent / stats.total) * 100).toFixed(1) 
    : '0.0'

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.todayCount} today, {stats.weekCount} this week
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Successfully Sent</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {stats.sent.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {successRate}% success rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {stats.pending.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Awaiting delivery
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed</CardTitle>
          <XCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {(stats.failed + stats.bounced).toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.failed} failed, {stats.bounced} bounced
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
