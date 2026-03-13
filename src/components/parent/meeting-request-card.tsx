'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { requestMeeting } from '@/app/parent/actions'

interface MeetingRequestCardProps {
  wardId: string
  wardName: string
}

export function MeetingRequestCard({ wardId, wardName }: MeetingRequestCardProps) {
  const [preferredDate, setPreferredDate] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSubmit = () => {
    setFeedback(null)
    startTransition(async () => {
      const result = await requestMeeting({ wardId, preferredDate: preferredDate || undefined, message })
      if (!result.success) {
        setFeedback({ type: 'error', text: result.error || 'Failed to submit request.' })
        return
      }
      setFeedback({ type: 'success', text: 'Meeting request submitted successfully.' })
      setMessage('')
      setPreferredDate('')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request a Meeting</CardTitle>
        <CardDescription>Submit a meeting request about {wardName}. The request is logged for follow-up.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="meeting-date">Preferred Date (optional)</Label>
          <Input id="meeting-date" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meeting-message">Message</Label>
          <Textarea
            id="meeting-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="State your concern or discussion points"
            rows={4}
          />
        </div>

        {feedback && (
          <p className={`text-sm ${feedback.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>{feedback.text}</p>
        )}

        <Button onClick={onSubmit} disabled={isPending || message.trim().length < 10}>
          {isPending ? 'Submitting...' : 'Submit Request'}
        </Button>
      </CardContent>
    </Card>
  )
}
