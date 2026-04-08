interface EmailTemplate {
  subject: string
  html: string
  text: string
}

interface SchoolCreatedData {
  schoolName: string
  adminName: string
  adminEmail: string
  temporaryPassword: string
  loginUrl: string
}

interface UserCreatedData {
  userName: string
  userEmail: string
  role: string
  schoolName: string
  temporaryPassword: string
  loginUrl: string
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

export const emailTemplates = {
  schoolCreated: (data: SchoolCreatedData): EmailTemplate => ({
    subject: `Welcome to SmartSBA - ${data.schoolName}`,
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
            .credentials { background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to SmartSBA!</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${data.adminName}</strong>,</p>
              
              <p>Congratulations! Your school <strong>${data.schoolName}</strong> has been successfully registered on SmartSBA platform.</p>
              
              <p>You have been assigned as the School Administrator with full access to manage your school's data, students, teachers, and academic records.</p>
              
              <div class="credentials">
                <h3>📧 Your Login Credentials</h3>
                <p><strong>Email:</strong> ${data.adminEmail}</p>
                <p><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${data.temporaryPassword}</code></p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> For security reasons, you will be required to change this password upon your first login.
              </div>
              
              <div style="text-align: center;">
                <a href="${data.loginUrl}" class="button">Login to Your Dashboard</a>
              </div>
              
              <h3>📚 Getting Started</h3>
              <ol>
                <li>Click the login button above</li>
                <li>Enter your email and temporary password</li>
                <li>Set a new secure password</li>
                <li>Complete your school profile</li>
                <li>Start adding students and teachers</li>
              </ol>
              
              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              
              <p>Best regards,<br><strong>SmartSBA Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} SmartSBA. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to SmartSBA!

Hello ${data.adminName},

Congratulations! Your school "${data.schoolName}" has been successfully registered on SmartSBA platform.

You have been assigned as the School Administrator with full access to manage your school's data, students, teachers, and academic records.

YOUR LOGIN CREDENTIALS:
Email: ${data.adminEmail}
Temporary Password: ${data.temporaryPassword}

IMPORTANT: For security reasons, you will be required to change this password upon your first login.

Login URL: ${data.loginUrl}

GETTING STARTED:
1. Visit the login URL above
2. Enter your email and temporary password
3. Set a new secure password
4. Complete your school profile
5. Start adding students and teachers

If you have any questions or need assistance, please contact our support team.

Best regards,
SmartSBA Team

---
This is an automated message. Please do not reply to this email.
© ${new Date().getFullYear()} SmartSBA. All rights reserved.
    `,
  }),

  userCreated: (data: UserCreatedData): EmailTemplate => ({
    subject: `Your SmartSBA Account - ${data.schoolName}`,
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
            .credentials { background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .role-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 14px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to SmartSBA!</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${data.userName}</strong>,</p>
              
              <p>An account has been created for you on SmartSBA platform for <strong>${data.schoolName}</strong>.</p>
              
              <p>Your role: <span class="role-badge">${data.role.toUpperCase().replace('_', ' ')}</span></p>
              
              <div class="credentials">
                <h3>📧 Your Login Credentials</h3>
                <p><strong>Email:</strong> ${data.userEmail}</p>
                <p><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${data.temporaryPassword}</code></p>
              </div>
              
              <p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px;">
                <strong>⚠️ Important:</strong> Please change this password upon your first login.
              </p>
              
              <div style="text-align: center;">
                <a href="${data.loginUrl}" class="button">Login Now</a>
              </div>
              
              <p>If you have any questions, please contact your school administrator.</p>
              
              <p>Best regards,<br><strong>SmartSBA Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} SmartSBA. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to SmartSBA!

Hello ${data.userName},

An account has been created for you on SmartSBA platform for "${data.schoolName}".

Your role: ${data.role.toUpperCase().replace('_', ' ')}

YOUR LOGIN CREDENTIALS:
Email: ${data.userEmail}
Temporary Password: ${data.temporaryPassword}

IMPORTANT: Please change this password upon your first login.

Login URL: ${data.loginUrl}

If you have any questions, please contact your school administrator.

Best regards,
SmartSBA Team

---
© ${new Date().getFullYear()} SmartSBA. All rights reserved.
    `,
  }),

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
}
