'use server'

import { supabase } from '@/lib/supabase'
import { emailTemplates } from '@/lib/email-templates'

// Email service configuration
// For now, using Supabase's built-in email functionality
// In production, you might want to use a dedicated service like Resend, SendGrid, etc.

interface SendEmailOptions {
  to: string
  userId?: string
  type: 'school_created' | 'user_created' | 'role_changed' | 'school_status_changed'
  data: unknown
  metadata?: Record<string, unknown>
}

interface EmailResult {
  success: boolean
  logId?: string
  error?: string
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
    const { data: logData, error: logError } = await supabase
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
    // NOTE: This is a placeholder - you need to implement actual email sending
    // Options:
    // 1. Use Supabase Auth admin.generateLink() for authentication emails
    // 2. Use Resend API for transactional emails
    // 3. Use SendGrid, Mailgun, or other email service
    
    try {
      // PLACEHOLDER: Replace with actual email sending logic
      const emailSent = await sendEmailViaProvider(options.to, template)
      
      if (emailSent) {
        // Update email status to 'sent'
        await supabase.rpc('update_email_status', {
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
      await supabase.rpc('update_email_status', {
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
  // IMPLEMENTATION OPTIONS:
  
  // Option 1: Resend (Recommended for production)
  // const { Resend } = require('resend')
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // const { data, error } = await resend.emails.send({
  //   from: 'SmartSBA <noreply@yourdomain.com>',
  //   to: [to],
  //   subject: template.subject,
  //   html: template.html,
  //   text: template.text,
  // })
  // return !error
  
  // Option 2: SendGrid
  // const sgMail = require('@sendgrid/mail')
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  // await sgMail.send({
  //   to,
  //   from: 'noreply@yourdomain.com',
  //   subject: template.subject,
  //   html: template.html,
  //   text: template.text,
  // })
  // return true
  
  // Option 3: Supabase Edge Function
  // const supabase = await createClient()
  // const { data, error } = await supabase.functions.invoke('send-email', {
  //   body: { to, subject: template.subject, html: template.html, text: template.text }
  // })
  // return !error
  
  // For development: Just log and pretend it was sent
  console.log('📧 Email would be sent to:', to)
  console.log('Subject:', template.subject)
  console.log('---')
  
  // Simulate async email sending
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Return true to simulate successful send
  // In production, this should be replaced with actual email provider logic
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
