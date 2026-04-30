'use server'

import { createAdminSupabaseClient } from '@/lib/supabase'

interface SmsResult {
  success: boolean
  error?: string
}

/**
 * Send an SMS using Twilio REST API if configured.
 * Environment variables expected:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_FROM
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_FROM

  if (!accountSid || !authToken || !from) {
    return { success: false, error: 'Twilio not configured' }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const form = new URLSearchParams()
  form.append('To', to)
  form.append('From', from)
  form.append('Body', body)

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error('Twilio send failed:', resp.status, text)
      return { success: false, error: `Twilio error ${resp.status}` }
    }

    return { success: true }
  } catch (err) {
    console.error('Twilio send exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
