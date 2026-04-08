'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { acknowledgeReport } from '@/app/parent/actions'

interface ReportAcknowledgeButtonProps {
  scoreId: string
}

export function ReportAcknowledgeButton({ scoreId }: ReportAcknowledgeButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')

  const onAcknowledge = () => {
    setStatus('idle')
    startTransition(async () => {
      const result = await acknowledgeReport(scoreId)
      setStatus(result.success ? 'done' : 'error')
    })
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={onAcknowledge} disabled={isPending || status === 'done'}>
        {status === 'done' ? 'Acknowledged' : isPending ? 'Saving...' : 'Acknowledge Viewed'}
      </Button>
      {status === 'error' && <span className="text-xs text-red-600">Unable to save acknowledgment.</span>}
      {status === 'done' && <span className="text-xs text-emerald-700">Saved</span>}
    </div>
  )
}
