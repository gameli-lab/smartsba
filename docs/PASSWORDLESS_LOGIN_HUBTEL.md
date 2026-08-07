# Hubtel Passwordless Login Implementation

## Overview

Replaced the password-based authentication with **passwordless login via Hubtel OTP**. Users now verify their identity with a one-time SMS code delivered to their registered phone number.

## Flow

```
1. User selects role (Student / Staff / Parent / SysAdmin)
2. User enters identifier:
   - Student: Admission Number
   - Staff: Staff ID
   - Parent: Parent Name/Email + Ward Admission Number
   - SysAdmin: Email
3. System resolves identifier → phone number (user_profiles.phone)
4. Hubtel POST /otp/send → SMS with 4-char prefix + 4-digit code
5. User enters prefix + code
6. Hubtel POST /otp/verify → success (HTTP 200)
7. System generates Supabase magic link, exchanges token to create session
8. OTP verification cookie (`smartsba_otp_verified`) set
9. User redirected to role dashboard
```

## Hubtel API Integration

### Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://api-otp.hubtel.com/otp/send` | POST | Send OTP via SMS |
| `https://api-otp.hubtel.com/otp/verify` | POST | Verify OTP (no response body, check HTTP status) |
| `https://api-otp.hubtel.com/otp/resend` | POST | Resend previously issued OTP |

### Rate Limits
- **5 requests per minute** across all Hubtel OTP endpoints
- App-side rate limiting at 5 attempts per minute via `applyRateLimit`

## Environment Variables

```bash
# Base64-encoded "username:password" for Hubtel Basic Auth
HUBTEL_OTP_API_KEY=
# Approved Sender ID (≤11 alphanumeric chars, Hubtel must approve)
HUBTEL_OTP_SENDER_ID=
# ISO 3166-1 alpha-2 country code (default: GH)
HUBTEL_OTP_COUNTRY_CODE=GH
```

## Database Changes

**Migration**: `supabase/migrations/037_hubtel_passwordless_login.sql`

Adds to `login_otp_challenges`:
- `provider` TEXT — `'internal'` (legacy) or `'hubtel'`
- `request_id` TEXT — Hubtel OTP session identifier
- `prefix` TEXT — 4-character phrase from Hubtel

## Files Changed

| File | Purpose |
|------|---------|
| `src/services/hubtelOtpService.ts` | Hubtel API client (send/verify/resend) |
| `src/app/api/auth/passwordless/route.ts` | Server API: send/verify/resend + session establishment |
| `src/lib/auth.ts` | Added `requestPasswordlessOtp`, `verifyPasswordlessOtp`, `resendPasswordlessOtp` |
| `src/components/auth/portal-login-shell.tsx` | Full passwordless UI (removed all password fields) |
| `middleware.ts` | Accepts OTP-verified sessions for privileged roles |
| `src/lib/auth-guards.ts` | `requirePrivilegedMfa` accepts Hubtel OTP cookie |
| `supabase/migrations/037_hubtel_passwordless_login.sql` | DB migration for provider/request_id/prefix |
| `.env` | Hubtel env vars added |

## USSD Fallback

If SMS delivery fails, users can dial `*713*90#` from their registered phone number to view the code. This is documented in the login help modal.

## Security

- Hubtel codes are **never stored locally** — only the `requestId` and `prefix`
- OTP challenge attempts limited to 5 per session
- In-memory rate limiting per IP + identifier (5 req/min)
- Security events: `otp_challenge`, `otp_verified` logged
- OTP verified cookie is HttpOnly, SameSite=Lax, 30-min TTL
- Session established via Supabase magic link (PKCE flow)

## Testing

1. Apply migration: `supabase/migrations/037_hubtel_passwordless_login.sql`
2. Set `HUBTEL_OTP_API_KEY`, `HUBTEL_OTP_SENDER_ID` in `.env`
3. Ensure users have `phone` populated in `user_profiles` (E164 format)
4. Navigate to `/login`, select role, enter identifier → receives SMS
5. Enter 4-digit prefix + 4-digit code → redirected to dashboard