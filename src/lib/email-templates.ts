interface EmailTemplate {
  subject: string
  html: string
  text: string
}

interface RoleChangedData {
  userName: string
  oldRole: string
  newRole: string
  schoolName: string
  changedBy: string
}

interface SchoolStatusChangedData {
  schoolName: string
  newStatus: 'active' | 'inactive'
  changedBy: string
  reason?: string
}

interface LoginOtpData {
  userName: string
  userEmail: string
  code: string
  expiresMinutes: number
  loginUrl: string
  channel: 'email' | 'sms'
}

interface MagicLinkData {
  userName: string
  userEmail: string
  magicLinkUrl: string
  expiresMinutes: number
}

export const emailTemplates = {
  roleChanged: (data: RoleChangedData): EmailTemplate => ({
    subject: `Your Role Has Been Updated - ${data.schoolName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .role-change { background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center; }
            .role-badge { display: inline-block; padding: 8px 16px; border-radius: 12px; font-weight: 600; margin: 0 10px; }
            .old-role { background: #fee2e2; color: #991b1b; }
            .new-role { background: #d1fae5; color: #065f46; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Role Update Notification</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${data.userName}</strong>,</p>
              
              <p>Your role in <strong>${data.schoolName}</strong> has been updated.</p>
              
              <div class="role-change">
                <p style="margin: 10px 0;">
                  <span class="role-badge old-role">${data.oldRole.toUpperCase().replace('_', ' ')}</span>
                  <span style="font-size: 24px;">→</span>
                  <span class="role-badge new-role">${data.newRole.toUpperCase().replace('_', ' ')}</span>
                </p>
              </div>
              
              <p>This change was made by <strong>${data.changedBy}</strong>.</p>
              
              <p>Your new role may have different permissions and access levels. Please log in to see your updated dashboard.</p>
              
              <p>If you believe this change was made in error, please contact your school administrator immediately.</p>
              
              <p>Best regards,<br><strong>SmartSBA Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} SmartSBA. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Role Update Notification

Hello ${data.userName},

Your role in "${data.schoolName}" has been updated.

OLD ROLE: ${data.oldRole.toUpperCase().replace('_', ' ')}
NEW ROLE: ${data.newRole.toUpperCase().replace('_', ' ')}

This change was made by ${data.changedBy}.

Your new role may have different permissions and access levels. Please log in to see your updated dashboard.

If you believe this change was made in error, please contact your school administrator immediately.

Best regards,
SmartSBA Team

---
© ${new Date().getFullYear()} SmartSBA. All rights reserved.
    `,
  }),

  schoolStatusChanged: (data: SchoolStatusChangedData): EmailTemplate => ({
    subject: `School Status Update - ${data.schoolName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${data.newStatus === 'active' ? '#10b981' : '#6b7280'}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .status-badge { display: inline-block; background: ${data.newStatus === 'active' ? '#d1fae5' : '#f3f4f6'}; color: ${data.newStatus === 'active' ? '#065f46' : '#374151'}; padding: 8px 20px; border-radius: 12px; font-weight: 600; font-size: 18px; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>School Status Update</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              
              <p>The status of <strong>${data.schoolName}</strong> has been updated.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="margin-bottom: 10px; color: #6b7280;">New Status:</p>
                <span class="status-badge">${data.newStatus.toUpperCase()}</span>
              </div>
              
              ${data.newStatus === 'active' 
                ? '<p style="background: #d1fae5; border-left: 4px solid #10b981; padding: 12px;">✅ Your school is now active and all features are available.</p>'
                : '<p style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 12px;">⚠️ Your school has been deactivated. Access to certain features may be restricted.</p>'
              }
              
              <p>This action was performed by <strong>${data.changedBy}</strong>.</p>
              
              ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
              
              <p>If you have any questions or concerns about this status change, please contact the platform administrator.</p>
              
              <p>Best regards,<br><strong>SmartSBA Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} SmartSBA. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
School Status Update

Hello,

The status of "${data.schoolName}" has been updated.

NEW STATUS: ${data.newStatus.toUpperCase()}

${data.newStatus === 'active' 
  ? 'Your school is now active and all features are available.'
  : 'Your school has been deactivated. Access to certain features may be restricted.'
}

This action was performed by ${data.changedBy}.

${data.reason ? `Reason: ${data.reason}` : ''}

If you have any questions or concerns about this status change, please contact the platform administrator.

Best regards,
SmartSBA Team

---
© ${new Date().getFullYear()} SmartSBA. All rights reserved.
    `,
  }),

  magicLink: (data: MagicLinkData): EmailTemplate => ({
    subject: 'Your SmartSBA Secure Sign-In Link',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
            .expiry { color: #f59e0b; font-weight: 600; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .security-note { font-size: 12px; color: #6b7280; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔗 Your SmartSBA Sign-In Link</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${data.userName}</strong>,</p>
              
              <p>You requested a secure sign-in link to access your SmartSBA account. Click the button below to sign in instantly:</p>
              
              <div style="text-align: center;">
                <a href="${data.magicLinkUrl}" class="button">Sign In to SmartSBA</a>
              </div>
              
              <p style="text-align: center; margin: 10px 0;">
                <span class="expiry">⏱️ Link expires in ${data.expiresMinutes} minutes</span>
              </p>
              
              <div class="warning">
                <strong>🔒 Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Never share this link with anyone</li>
                  <li>SmartSBA staff will never ask for your link</li>
                  <li>If you didn't request this link, ignore this email</li>
                </ul>
              </div>

              <div class="security-note">
                <p><strong>Didn't request this link?</strong></p>
                <p>If you didn't attempt to log in, please ignore this email or contact our support team if you have concerns about your account security.</p>
              </div>
              
              <p>Best regards,<br><strong>SmartSBA Security Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated security notification. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} SmartSBA. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
🔗 Your SmartSBA Sign-In Link

Hello ${data.userName},

You requested a secure sign-in link to access your SmartSBA account. Click the link below to sign in instantly:

SIGN IN LINK: ${data.magicLinkUrl}

Link expires in ${data.expiresMinutes} minutes

🔒 IMPORTANT SECURITY NOTICE:
- Never share this link with anyone
- SmartSBA staff will never ask for your link
- If you didn't request this link, ignore this email

DIDN'T REQUEST THIS LINK?
If you didn't attempt to log in, please ignore this email or contact our support team if you have concerns about your account security.

Best regards,
SmartSBA Security Team

---
This is an automated security notification. Please do not reply to this email.
© ${new Date().getFullYear()} SmartSBA. All rights reserved.
    `,
  }),

  loginOtp: (data: LoginOtpData): EmailTemplate => ({
    subject: 'Your SmartSBA Login Code',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .otp-box { background: #f3f4f6; border: 2px solid #667eea; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .otp-code { font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace; }
            .expiry { color: #f59e0b; font-weight: 600; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; text-align: center; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .security-note { font-size: 12px; color: #6b7280; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Your SmartSBA Login Code</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${data.userName}</strong>,</p>
              
              <p>You requested a login code to access your SmartSBA account. Use the code below to verify your identity:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">Enter this code:</p>
                <div class="otp-code">${data.code}</div>
              </div>
              
              <p style="text-align: center; margin: 10px 0;">
                <span class="expiry">⏱️ Code expires in ${data.expiresMinutes} minutes</span>
              </p>
              
              <div class="warning">
                <strong>🔒 Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Never share this code with anyone</li>
                  <li>SmartSBA staff will never ask for your code</li>
                  <li>If you didn't request this code, ignore this email</li>
                </ul>
              </div>
              
              <div style="text-align: center;">
                <a href="${data.loginUrl}" class="button">Go to Login Page</a>
              </div>

              <div class="security-note">
                <p><strong>Didn't request this code?</strong></p>
                <p>If you didn't attempt to log in, please ignore this email or contact our support team if you have concerns about your account security.</p>
              </div>
              
              <p>Best regards,<br><strong>SmartSBA Security Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated security notification. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} SmartSBA. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
🔐 Your SmartSBA Login Code

Hello ${data.userName},

You requested a login code to access your SmartSBA account. Use the code below to verify your identity:

LOGIN CODE: ${data.code}

Code expires in ${data.expiresMinutes} minutes

🔒 IMPORTANT SECURITY NOTICE:
- Never share this code with anyone
- SmartSBA staff will never ask for your code
- If you didn't request this code, ignore this email

LOGIN URL: ${data.loginUrl}

DIDN'T REQUEST THIS CODE?
If you didn't attempt to log in, please ignore this email or contact our support team if you have concerns about your account security.

Best regards,
SmartSBA Security Team

---
This is an automated security notification. Please do not reply to this email.
© ${new Date().getFullYear()} SmartSBA. All rights reserved.
    `,
  }),
}
