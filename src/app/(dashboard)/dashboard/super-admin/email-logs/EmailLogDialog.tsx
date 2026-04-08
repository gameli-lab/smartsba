'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import type { EmailLog } from './actions'

interface EmailLogDialogProps {
  log: EmailLog
  open: boolean
  onClose: () => void
}

export default function EmailLogDialog({ log, open, onClose }: EmailLogDialogProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      sent: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      bounced: 'bg-orange-100 text-orange-800',
    }

    return (
      <Badge className={colors[status]}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Email Details</span>
            {getStatusBadge(log.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email Metadata */}
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Recipient</dt>
                  <dd className="mt-1 text-sm font-semibold">{log.recipient_email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Email Type</dt>
                  <dd className="mt-1 text-sm">
                    {log.email_type.replace(/_/g, ' ').toUpperCase()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                  <dd className="mt-1 text-sm">{formatDate(log.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Sent At</dt>
                  <dd className="mt-1 text-sm">
                    {log.sent_at ? formatDate(log.sent_at) : 'Not sent yet'}
                  </dd>
                </div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-muted-foreground">Metadata</dt>
                    <dd className="mt-1">
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Error Message */}
          {log.error_message && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-red-900 mb-1">
                      Error Message
                    </h4>
                    <p className="text-sm text-red-800">{log.error_message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Email Subject */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Subject</h4>
            <p className="text-sm font-semibold">{log.subject}</p>
          </div>

          {/* Email Content Tabs */}
          <Tabs defaultValue="html">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="html">HTML Preview</TabsTrigger>
              <TabsTrigger value="text">Plain Text</TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="border rounded-md overflow-hidden">
                    <iframe
                      srcDoc={log.body_html}
                      className="w-full h-[500px]"
                      title="Email HTML Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="text" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-md">
                    {log.body_text}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
