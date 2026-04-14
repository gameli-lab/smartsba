import { createAdminSupabaseClient } from '@/lib/supabase'
import { resolveTwilioSender, sendSMS } from '@/services/twilioService'

export interface EnqueueTwilioMessageInput {
  to: string
  body: string
  schoolId?: string | null
  createdBy?: string | null
  maxAttempts?: number
}

export interface QueueProcessResult {
  processed: number
  sent: number
  failed: number
  retried: number
}

interface QueueRow {
  id: string
  to_number: string
  body: string
  school_id: string | null
  attempt_count: number
  max_attempts: number
}

function computeBackoffMinutes(attemptCount: number): number {
  const steps = [1, 3, 10, 30, 60]
  return steps[Math.min(attemptCount, steps.length - 1)]
}

export async function enqueueTwilioMessage(input: EnqueueTwilioMessageInput): Promise<{ id: string }> {
  const adminClient = createAdminSupabaseClient()

  const { data, error } = await adminClient
    .from('twilio_sms_queue')
    .insert({
      to_number: input.to,
      body: input.body,
      school_id: input.schoolId || null,
      created_by: input.createdBy || null,
      max_attempts: input.maxAttempts || 3,
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to enqueue SMS')
  }

  return { id: (data as { id: string }).id }
}

export async function processTwilioQueue(batchSize = 20): Promise<QueueProcessResult> {
  const adminClient = createAdminSupabaseClient()

  const { data, error } = await adminClient
    .from('twilio_sms_queue')
    .select('id, to_number, body, school_id, attempt_count, max_attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data || []) as QueueRow[]
  const result: QueueProcessResult = {
    processed: rows.length,
    sent: 0,
    failed: 0,
    retried: 0,
  }

  for (const row of rows) {
    await adminClient
      .from('twilio_sms_queue')
      .update({ status: 'processing' })
      .eq('id', row.id)

    try {
      const sender = await resolveTwilioSender(row.school_id)
      const sent = await sendSMS({
        to: row.to_number,
        body: row.body,
        schoolId: row.school_id,
      })

      await adminClient
        .from('twilio_sms_queue')
        .update({
          status: 'sent',
          twilio_sid: sent.sid,
          sender_source: sender.source,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      result.sent += 1
    } catch (error) {
      const nextAttempt = row.attempt_count + 1
      const hasAttemptsLeft = nextAttempt < row.max_attempts

      if (hasAttemptsLeft) {
        const backoffMinutes = computeBackoffMinutes(nextAttempt)
        const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString()

        await adminClient
          .from('twilio_sms_queue')
          .update({
            status: 'pending',
            attempt_count: nextAttempt,
            next_attempt_at: nextAttemptAt,
            last_error: error instanceof Error ? error.message : 'Unknown send error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)

        result.retried += 1
      } else {
        await adminClient
          .from('twilio_sms_queue')
          .update({
            status: 'failed',
            attempt_count: nextAttempt,
            last_error: error instanceof Error ? error.message : 'Unknown send error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)

        result.failed += 1
      }
    }
  }

  return result
}
