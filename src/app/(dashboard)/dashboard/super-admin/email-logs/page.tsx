import { Metadata } from 'next'
import { getEmailLogs, getEmailStats } from './actions'
import EmailLogsTable from './EmailLogsTable'
import EmailStatsCards from './EmailStatsCards'

export const metadata: Metadata = {
  title: 'Email Logs | Super Admin',
  description: 'View and monitor email delivery logs',
}

export default async function EmailLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const search = typeof params.search === 'string' ? params.search : ''
  const emailType = typeof params.type === 'string' ? params.type : undefined
  const status = typeof params.status === 'string' ? params.status : undefined
  const cursor = typeof params.cursor === 'string' ? params.cursor : undefined

  const [{ logs, count, nextCursor }, stats] = await Promise.all([
    getEmailLogs({ search, emailType, status, cursor }),
    getEmailStats(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Email Logs</h1>
        <p className="text-muted-foreground mt-2">
          Monitor email delivery status and troubleshoot issues
        </p>
      </div>

      <EmailStatsCards stats={stats} />

      <EmailLogsTable 
        logs={logs} 
        count={count} 
        nextCursor={nextCursor}
      />
    </div>
  )
}
