# OTP (One-Time Password) Deployment & Testing Guide

## Overview

This guide covers the OTP implementation for SmartSBA, which provides an alternative second factor authentication method via email or SMS in addition to authenticator apps.

## Architecture

### Components

- **Database**: `login_otp_challenges` table stores OTP codes, attempts, and verification status
- **API Route**: `/api/auth/otp` handles OTP send/verify operations
- **Client UI**: MFA challenge page at `/mfa-challenge` with Email Code tab
- **Services**: 
  - Email delivery via SMTP (configured in `system_settings`)
  - SMS delivery via Twilio REST API (requires environment variables)

### Authentication Flow

```
1. User enters credentials (password-first flow)
2. Successful password auth
3. User is redirected to /mfa-challenge for MFA
4. User selects either:
   a. Authenticator (TOTP)
   b. Email Code (OTP sent via email)
5. Upon successful MFA, user is redirected to their dashboard
```

### OTP Cookie

Upon successful OTP verification, a cookie `smartsba_otp_verified` is set with:
- TTL: 30 minutes
- HttpOnly: true
- Secure: true (production only)
- SameSite: lax

This cookie is validated in `requirePrivilegedMfa()` as an alternative to the MFA verification cookie.

## Database Migration

### Status Check

The migration `supabase/migrations/036_create_login_otp_challenges_table.sql` creates:
- `login_otp_challenges` table with fields:
  - `id` (UUID, primary key)
  - `user_id` (UUID, foreign key)
  - `role` (text, user's role at time of OTP)
  - `school_id` (UUID, optional)
  - `channel` (email|sms)
  - `destination` (email or phone)
  - `code_hash` (bcrypt hash of 6-digit code)
  - `attempts` (current attempt count)
  - `max_attempts` (6)
  - `expires_at` (10 minutes from generation)
  - `verified_at` (timestamp when verified)
  - `created_at` / `updated_at`

- RLS Policy: Users can only view/update their own OTP challenges
- Automatic cleanup: Expired challenges deleted via trigger
- Rate limiting: Enforced at API level

### Applying the Migration

#### Option 1: Supabase SQL Editor (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy the contents of `supabase/migrations/036_create_login_otp_challenges_table.sql`
5. Run the query
6. Verify the table appears in the Tables view

#### Option 2: Supabase CLI
```bash
supabase db push
```
*(Requires Supabase CLI installed and configured)*

#### Option 3: Manual PostgreSQL Client
```bash
# Using psql
psql "postgresql://[user]:[password]@[host]:[port]/[database]" < supabase/migrations/036_create_login_otp_challenges_table.sql
```

## Email OTP Configuration

### SMTP Settings

Email OTP uses the standard SmartSBA SMTP configuration stored in `system_settings`:

```sql
SELECT setting_value FROM system_settings 
WHERE setting_key IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'SENDER_EMAIL');
```

Configure via:
1. Admin dashboard → System Settings → Email
2. Or directly in `system_settings` table:
   ```sql
   INSERT INTO system_settings (setting_key, category, setting_value, updated_by, updated_at)
   VALUES 
     ('SENDER_EMAIL', 'email', 'noreply@smartsba.local', 'system', NOW()),
     ('smtp_host', 'email', 'smtp.gmail.com', 'system', NOW()),
     ('smtp_port', 'email', '587', 'system', NOW()),
     ('smtp_user', 'email', 'your-email@gmail.com', 'system', NOW()),
     ('smtp_password', 'email', 'your-app-password', 'system', NOW());
   ```

### Testing Email OTP

```bash
curl -X POST "http://localhost:3000/api/auth/otp" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send",
    "identifier": "user@example.com",
    "channel": "email"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "OTP sent to email",
  "expiresAt": "2026-04-30T22:00:00.000Z",
  "challengeId": "uuid-here"
}
```

## SMS OTP Configuration

### Twilio Setup

1. **Create Twilio Account**
   - Sign up at https://www.twilio.com/console
   - Get your Account SID and Auth Token
   - Purchase a phone number

2. **Environment Variables**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_FROM=+1234567890
   ```

3. **Add to `.env.local` or Production Secrets**
   ```bash
   # For development
   echo "TWILIO_ACCOUNT_SID=..." >> .env.local
   echo "TWILIO_AUTH_TOKEN=..." >> .env.local
   echo "TWILIO_PHONE_FROM=..." >> .env.local
   ```

4. **Verify User Phone Numbers**
   - Ensure `user_profiles.phone` is populated with E.164 format: `+14155552671`
   - Or via student records: `students.phone`

### Testing SMS OTP

```bash
curl -X POST "http://localhost:3000/api/auth/otp" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send",
    "identifier": "+14155552671",
    "channel": "sms"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "OTP sent to phone",
  "expiresAt": "2026-04-30T22:00:00.000Z",
  "challengeId": "uuid-here"
}
```

## End-to-End Testing

### Test Scenario 1: Email OTP Complete Flow

1. **Setup**
   ```sql
   INSERT INTO user_profiles (user_id, email, role, school_id)
   VALUES ('test-user-id', 'test@example.com', 'school_admin', NULL);
   ```

2. **Send OTP**
   ```bash
   curl -X POST "http://localhost:3000/api/auth/otp" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "send",
       "identifier": "test@example.com",
       "channel": "email"
     }'
   ```

3. **Retrieve Code from Database** *(for testing)*
   ```sql
   SELECT code_hash, expires_at FROM login_otp_challenges 
   WHERE user_id = 'test-user-id' 
   AND channel = 'email'
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
   
   *(In production, users receive the code via email)*

4. **Verify OTP** *(Note: need to compute matching plaintext code)*
   ```bash
   curl -X POST "http://localhost:3000/api/auth/otp" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "verify",
       "identifier": "test@example.com",
       "channel": "email",
       "code": "123456"
     }'
   ```

5. **Check Cookie**
   ```bash
   # Note: Cookie set with secure, httpOnly flags
   # Check response headers for Set-Cookie: smartsba_otp_verified=...
   ```

### Test Scenario 2: SMS OTP Complete Flow

*(Requires Twilio credentials configured)*

1. **Setup** *(with phone number)*
   ```sql
   INSERT INTO user_profiles (user_id, email, phone, role, school_id)
   VALUES ('test-sms-user', 'sms.test@example.com', '+14155552671', 'school_admin', NULL);
   ```

2. **Send SMS OTP**
   ```bash
   curl -X POST "http://localhost:3000/api/auth/otp" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "send",
       "identifier": "+14155552671",
       "channel": "sms"
     }'
   ```

3. **Verify SMS OTP**
   ```bash
   # User receives SMS with code, then submits
   curl -X POST "http://localhost:3000/api/auth/otp" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "verify",
       "identifier": "+14155552671",
       "channel": "sms",
       "code": "123456"
     }'
   ```

### Test Scenario 3: UI Flow - School Admin Login

1. Navigate to login page
2. Select "Staff" role
3. Enter school-admin credentials
4. Upon successful password auth, should redirect to `/mfa-challenge?next=%2Fschool-admin`
5. On MFA Challenge page:
   - See "Authenticator" and "Email Code" tabs
   - Click "Email Code" tab
   - Click "Send Email Code"
   - See: "OTP code sent to your email address."
   - Enter 6-digit code received in email
   - Click "Verify Code"
   - Should redirect to `/school-admin`

## Rate Limiting

### Limits

- **Per User/Channel Combo**: 6 OTP attempts per 15 minutes
- **Per Failed Verify**: 6 verification attempts per OTP challenge
- **Response Code**: 429 Too Many Requests with `Retry-After` header

### Testing Rate Limits

```bash
# Send 7 OTP requests in quick succession (same user/channel)
for i in {1..7}; do
  curl -X POST "http://localhost:3000/api/auth/otp" \
    -H "Content-Type: application/json" \
    -d '{"action":"send","identifier":"test@example.com","channel":"email"}'
  sleep 1
done

# 7th request should return 429
```

## Monitoring & Logs

### Security Events

Check `security_events` table for OTP-related activity:

```sql
SELECT * FROM security_events 
WHERE event_type IN ('otp_challenge', 'otp_verified')
ORDER BY created_at DESC 
LIMIT 50;
```

### Event Types

- `otp_challenge`: OTP send attempt
  - Metadata: `action`, `channel`, `rate_limit_exceeded`, `send_failed`, `user_found`
- `otp_verified`: Successful OTP verification
  - Metadata: `channel`, `attempts` (count used)

### Application Logs

Check Next.js/server logs for:

```
- "OTP API error: ..."
- "Failed to send OTP: ..."
- "Failed to insert OTP challenge: ..."
- "Twilio send failed: ..." (if SMS enabled)
```

## Troubleshooting

### Issue: OTP Email Not Received

**Possible Causes:**
1. SMTP configuration incorrect
2. Email marked as spam
3. Sender email domain not verified

**Fix:**
```sql
-- Verify SMTP config
SELECT setting_key, setting_value FROM system_settings 
WHERE category = 'email';

-- Check security events for errors
SELECT metadata FROM security_events 
WHERE event_type = 'otp_challenge' AND metadata->>'send_failed' = 'true'
LIMIT 5;
```

### Issue: SMS Not Received

**Possible Causes:**
1. Twilio credentials not set
2. Phone number in wrong format (should be E.164: `+1234567890`)
3. User phone field empty
4. Twilio account out of credits

**Fix:**
```bash
# Verify environment variables set
env | grep TWILIO

# Test Twilio credentials with direct API call
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json" \
  -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}" \
  -d "To=+14155552671&From=${TWILIO_PHONE_FROM}&Body=Test"

# Check if user has phone field
SELECT user_id, phone FROM user_profiles WHERE user_id = 'test-user-id';
```

### Issue: Verification Fails (Invalid Code)

**Check:**
1. Code entered correctly (6 digits)
2. Code not expired (expires 10 minutes after send)
3. Attempts not exceeded (max 6)

```sql
SELECT id, attempts, max_attempts, expires_at, verified_at FROM login_otp_challenges 
WHERE user_id = 'test-user-id' 
ORDER BY created_at DESC 
LIMIT 3;
```

### Issue: Cookie Not Being Set

**Check:**
1. Response headers include `Set-Cookie` header
2. Same-origin requests being made (for httpOnly cookie)
3. Browser accepting cookies

```bash
# Check response headers with verbose curl
curl -v -X POST "http://localhost:3000/api/auth/otp" \
  -H "Content-Type: application/json" \
  -d '{"action":"verify","identifier":"test@example.com","channel":"email","code":"123456"}' 
  # Look for "Set-Cookie: smartsba_otp_verified=..."
```

## Production Checklist

- [ ] Migrate `login_otp_challenges` table to production database
- [ ] Configure SMTP credentials in `system_settings`
- [ ] Configure Twilio credentials as environment variables (if using SMS)
- [ ] Set `NODE_ENV=production` for secure cookie flag
- [ ] Test email OTP end-to-end with real credentials
- [ ] Test SMS OTP end-to-end with real phone (if enabled)
- [ ] Monitor `security_events` table for suspicious activity
- [ ] Set up alerts for failed OTP verification attempts
- [ ] Document user-facing SMS/Email instructions in help pages
- [ ] Enable rate limiting review in security dashboard
- [ ] Backup database before applying migration

## Future Enhancements

- [ ] SMS vs Email selection in UI (currently email-only in MFA page)
- [ ] SMS confirmation before enabling (e.g., verify one SMS code before storing phone)
- [ ] OTP backup codes (similar to TOTP)
- [ ] Resend OTP with cooldown (prevent abuse)
- [ ] Device fingerprinting for trusted device exemptions
- [ ] Risk-based MFA (require OTP only for suspicious logins)
- [ ] Hardware security keys integration
- [ ] WebAuthn / FIDO2 support

## Support & Questions

For issues or questions about OTP implementation:
1. Check `security_events` table for error metadata
2. Check application logs for error messages
3. Verify database migration applied successfully
4. Verify credentials configured in environment/system_settings
5. Test components independently (send → verify)
