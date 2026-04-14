import { createAdminSupabaseClient } from '@/lib/supabase'

interface TwilioConfig {
  accountSid: string
  authToken: string
  messagingServiceSid: string
  globalFromNumber: string
  perSchoolEnabled: boolean
}

interface ResolveSenderResult {
  messagingServiceSid?: string
  fromNumber?: string
  source: 'school_override' | 'global_default'
}

interface SendSMSInput {
  to: string
  body: string
  schoolId?: string | null
}

interface TwilioMessageResult {
  sid: string
  status?: string
  to?: string
  from?: string
  messaging_service_sid?: string
}

const BASE_KEYS = [
  'twilio.account_sid',
  'twilio.auth_token',
  'twilio.messaging_service_sid',
  'twilio.global_from_number',
  'twilio.per_school_enabled',
] as const

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return fallback
}

async function getSettingsMap(keys: string[]): Promise<Record<string, unknown>> {
  const adminClient = createAdminSupabaseClient()
  const { data } = await adminClient
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', keys)

  const settings: Record<string, unknown> = {}
  for (const row of data || []) {
    const typed = row as { setting_key: string; setting_value: unknown }
    settings[typed.setting_key] = typed.setting_value
  }

  return settings
}

async function getTwilioConfig(): Promise<TwilioConfig> {
  const settings = await getSettingsMap([...BASE_KEYS])

  const accountSid = normalizeString(settings['twilio.account_sid']) || normalizeString(process.env.TWILIO_ACCOUNT_SID)
  const authToken = normalizeString(settings['twilio.auth_token']) || normalizeString(process.env.TWILIO_AUTH_TOKEN)
  const messagingServiceSid = normalizeString(settings['twilio.messaging_service_sid']) || normalizeString(process.env.TWILIO_MESSAGING_SERVICE_SID)
  const globalFromNumber = normalizeString(settings['twilio.global_from_number']) || normalizeString(process.env.TWILIO_FROM_NUMBER)
  const perSchoolEnabled = normalizeBool(settings['twilio.per_school_enabled'], false)

  if (!accountSid || !authToken) {
    throw new Error('Twilio integration is not configured. Required: twilio.account_sid and twilio.auth_token')
  }

  if (!messagingServiceSid && !globalFromNumber) {
    throw new Error('Twilio sender is not configured. Set twilio.messaging_service_sid or twilio.global_from_number')
  }

  return {
    accountSid,
    authToken,
    messagingServiceSid,
    globalFromNumber,
    perSchoolEnabled,
  }
}

async function getSchoolSenderOverrides(schoolId: string): Promise<ResolveSenderResult | null> {
  const settings = await getSettingsMap([
    `twilio.school.${schoolId}.messaging_service_sid`,
    `twilio.school.${schoolId}.from_number`,
  ])

  const schoolMessagingServiceSid = normalizeString(settings[`twilio.school.${schoolId}.messaging_service_sid`])
  const schoolFromNumber = normalizeString(settings[`twilio.school.${schoolId}.from_number`])

  if (!schoolMessagingServiceSid && !schoolFromNumber) {
    return null
  }

  return {
    messagingServiceSid: schoolMessagingServiceSid || undefined,
    fromNumber: schoolFromNumber || undefined,
    source: 'school_override',
  }
}

export async function resolveTwilioSender(schoolId?: string | null): Promise<ResolveSenderResult> {
  const config = await getTwilioConfig()

  if (config.perSchoolEnabled && schoolId) {
    const schoolOverride = await getSchoolSenderOverrides(schoolId)
    if (schoolOverride) {
      return schoolOverride
    }
  }

  return {
    messagingServiceSid: config.messagingServiceSid || undefined,
    fromNumber: config.globalFromNumber || undefined,
    source: 'global_default',
  }
}

export async function sendSMS(input: SendSMSInput): Promise<TwilioMessageResult> {
  const config = await getTwilioConfig()
  const sender = await resolveTwilioSender(input.schoolId)

  const params = new URLSearchParams()
  params.set('To', input.to)
  params.set('Body', input.body)

  if (sender.messagingServiceSid) {
    params.set('MessagingServiceSid', sender.messagingServiceSid)
  } else if (sender.fromNumber) {
    params.set('From', sender.fromNumber)
  } else {
    throw new Error('No valid Twilio sender is configured')
  }

  const basicAuth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Twilio send failed (${response.status}): ${text}`)
  }

  const result = (await response.json()) as TwilioMessageResult
  return result
}
