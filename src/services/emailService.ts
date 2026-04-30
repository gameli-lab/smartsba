'use server'

import nodemailer from 'nodemailer'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { emailTemplates } from '@/lib/email-templates'

// Email service configuration
// For now, using Supabase's built-in email functionality
// In production, you might want to use a dedicated service like Resend, SendGrid, etc.

interface SendEmailOptions {
  to: string
  userId?: string
  type: 'school_created' | 'user_created' | 'role_changed' | 'school_status_changed' | 'login_otp'
  data: unknown
  metadata?: Record<string, unknown>
}

interface EmailResult {
  success: boolean
  logId?: string
  error?: string
}

interface EmailSettings {
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  sender_name: string
  sender_email: string
}

interface EmailSettingRow {
  setting_key: string
  setting_value: unknown
}

const EMAIL_SETTINGS_CACHE_TTL_MS = 60_000
const EMAIL_SETTING_KEYS = [
  'email.smtp_host',
  'email.smtp_port',
  'email.smtp_user',
  'email.smtp_password',
  'email.sender_name',
  'email.sender_email',
] as const

let cachedEmailSettings: { loadedAt: number; config: EmailSettings } | null = null

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function normalizePort(value: unknown, fallback = 587): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

async function getEmailSettings(): Promise<EmailSettings> {
  const now = Date.now()
  if (cachedEmailSettings && now - cachedEmailSettings.loadedAt < EMAIL_SETTINGS_CACHE_TTL_MS) {
    return cachedEmailSettings.config
  }

  const adminSupabase = createAdminSupabaseClient()
  const { data, error } = await adminSupabase
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [...EMAIL_SETTING_KEYS])

  if (error) {
    console.warn('Unable to load email settings from system_settings, falling back to environment variables:', error)
  }

  const rows = (data || []) as EmailSettingRow[]
  const settingsMap = rows.reduce<Record<string, unknown>>((acc, row) => {
    acc[row.setting_key] = row.setting_value
    return acc
  }, {})

  const config: EmailSettings = {
    smtp_host: normalizeString(settingsMap['email.smtp_host'], normalizeString(process.env.SMTP_HOST)),
    smtp_port: normalizePort(settingsMap['email.smtp_port'], normalizePort(process.env.SMTP_PORT, 587)),
    smtp_user: normalizeString(settingsMap['email.smtp_user'], normalizeString(process.env.SMTP_USER)),
    smtp_password: normalizeString(settingsMap['email.smtp_password'], normalizeString(process.env.SMTP_PASSWORD)),
    sender_name: normalizeString(settingsMap['email.sender_name'], normalizeString(process.env.SMTP_SENDER_NAME, 'SmartSBA System')),
    sender_email: normalizeString(
      settingsMap['email.sender_email'],
      normalizeString(process.env.SMTP_SENDER_EMAIL, normalizeString(process.env.SMTP_USER, 'noreply@smartsba.local'))
    ),
  }

  if (!config.smtp_host) {
    throw new Error('Email SMTP host is not configured. Set email.smtp_host in system settings or SMTP_HOST in the environment.')
  }

  cachedEmailSettings = { loadedAt: now, config }
  return config
}

/**
 * Send an email using the configured email service
 * This function logs the email attempt and tracks delivery status
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  try {
    // Generate email content from template
    const template = getEmailTemplate(options.type, options.data)
    
    // Log the email attempt in database
    const adminSupabase = createAdminSupabaseClient()
    const { data: logData, error: logError } = await adminSupabase
      .rpc('log_email_send', {
        p_recipient_email: options.to,
        p_recipient_user_id: options.userId || null,
        p_email_type: options.type,
        p_subject: template.subject,
        p_body_html: template.html,
        p_body_text: template.text,
        p_metadata: options.metadata || {}
      })
    
    if (logError) {
      console.error('Failed to log email:', logError)
      return { success: false, error: 'Failed to log email attempt' }
    }
    
    const logId = logData as string
    
    // Send the email
    try {
      const emailSent = await sendEmailViaProvider(options.to, template)
      
      if (emailSent) {
        // Update email status to 'sent'
        await adminSupabase.rpc('update_email_status', {
          p_log_id: logId,
          p_status: 'sent',
          p_error_message: null
        })
        
        return { success: true, logId }
      } else {
        throw new Error('Email sending failed')
      }
    } catch (sendError) {
      // Update email status to 'failed'
      await adminSupabase.rpc('update_email_status', {
        p_log_id: logId,
        p_status: 'failed',
        p_error_message: sendError instanceof Error ? sendError.message : 'Unknown error'
      })
      
      return { 
        success: false, 
        error: sendError instanceof Error ? sendError.message : 'Failed to send email',
        logId 
      }
    }
  } catch (error) {
    console.error('Email service error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Email service error' 
    }
  }
}

/**
 * Get the appropriate email template based on type
 */
function getEmailTemplate(type: string, data: unknown) {
  switch (type) {
    case 'school_created':
      return emailTemplates.schoolCreated(data)
    case 'user_created':
      return emailTemplates.userCreated(data)
    case 'role_changed':
      return emailTemplates.roleChanged(data)
    case 'school_status_changed':
      return emailTemplates.schoolStatusChanged(data)
    default:
      throw new Error(`Unknown email type: ${type}`)
  }
}

/**
 * Placeholder function for actual email sending
 * Replace this with your chosen email provider's API
 */
async function sendEmailViaProvider(
  to: string,
  template: { subject: string; html: string; text: string }
): Promise<boolean> {
  const settings = await getEmailSettings()

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.smtp_port === 465,
    auth: settings.smtp_user ? {
      user: settings.smtp_user,
      pass: settings.smtp_password,
    } : undefined,
  })

  await transporter.sendMail({
    from: `"${settings.sender_name}" <${settings.sender_email}>`,
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  })

  return true
}

/**
 * Send school creation notification email
 */
export async function sendSchoolCreatedEmail(data: {
  schoolName: string
  adminName: string
  adminEmail: string
  adminUserId: string
  temporaryPassword: string
  schoolId: string
}): Promise<EmailResult> {
  return sendEmail({
    to: data.adminEmail,
    userId: data.adminUserId,
    type: 'school_created',
    data: {
      schoolName: data.schoolName,
      adminName: data.adminName,
      adminEmail: data.adminEmail,
      temporaryPassword: data.temporaryPassword,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
    },
    metadata: {
      school_id: data.schoolId,
    },
  })
}

/**
 * Send user creation notification email
 */
export async function sendUserCreatedEmail(data: {
  userName: string
  userEmail: string
  userId: string
  role: string
  schoolName: string
  schoolId: string
  temporaryPassword: string
}): Promise<EmailResult> {
  return sendEmail({
    to: data.userEmail,
    userId: data.userId,
    type: 'user_created',
    data: {
      userName: data.userName,
      userEmail: data.userEmail,
      role: data.role,
      schoolName: data.schoolName,
      temporaryPassword: data.temporaryPassword,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
    },
    metadata: {
      school_id: data.schoolId,
      role: data.role,
    },
  })
}

/**
 * Send role change notification email
 */
export async function sendRoleChangedEmail(data: {
  userName: string
  userEmail: string
  userId: string
  oldRole: string
  newRole: string
  schoolName: string
  schoolId: string
  changedBy: string
}): Promise<EmailResult> {
  return sendEmail({
    to: data.userEmail,
    userId: data.userId,
    type: 'role_changed',
    data: {
      userName: data.userName,
      oldRole: data.oldRole,
      newRole: data.newRole,
      schoolName: data.schoolName,
      changedBy: data.changedBy,
    },
    metadata: {
      school_id: data.schoolId,
      old_role: data.oldRole,
      new_role: data.newRole,
    },
  })
}

/**
 * Send school status change notification email
 */
export async function sendSchoolStatusChangedEmail(data: {
  schoolName: string
  schoolId: string
  adminEmail: string
  adminUserId: string
  newStatus: 'active' | 'inactive'
  changedBy: string
  reason?: string
}): Promise<EmailResult> {
  return sendEmail({
    to: data.adminEmail,
    userId: data.adminUserId,
    type: 'school_status_changed',
    data: {
      schoolName: data.schoolName,
      newStatus: data.newStatus,
      changedBy: data.changedBy,
      reason: data.reason,
    },
    metadata: {
      school_id: data.schoolId,
      new_status: data.newStatus,
    },
  })
}

/**
 * Send login OTP code email
 * Sends a one-time password for email-based authentication
 */
export async function sendLoginOtpEmail(data: {
  userEmail: string
  userId: string
  userName: string
  code: string
  expiresMinutes: number
  loginUrl: string
  schoolId?: string
}): Promise<EmailResult> {
  return sendEmail({
    to: data.userEmail,
    userId: data.userId,
    type: 'login_otp',
    data: {
      userEmail: data.userEmail,
      userName: data.userName,
      code: data.code,
      expiresMinutes: data.expiresMinutes,
      loginUrl: data.loginUrl,
      channel: 'email',
    },
    metadata: {
      school_id: data.schoolId || null,
      delivery_method: 'email',
      code_length: data.code.length,
    },
  })
}
