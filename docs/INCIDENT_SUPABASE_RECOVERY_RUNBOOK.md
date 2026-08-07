# Incident Recovery Runbook: Supabase Auth Lockout on Production

Use this when all credentials fail on the production site and password reset flows are broken because production is still using localhost-oriented auth settings.

## Goal

Restore Super Admin access on the live site, then verify the login and reset flows end to end.

## Assumptions

- Production is hosted at `https://smartsba.netlify.app`.
- You have admin access to both Netlify and Supabase Dashboard.
- The Super Admin account exists in Supabase Auth.

## 1. Stabilize Production Auth Routing

### Supabase Auth settings

In Supabase Dashboard, open Auth settings and set:

- Site URL: `https://smartsba.netlify.app`
- Additional Redirect URLs:
  - `https://smartsba.netlify.app/login`
  - `https://smartsba.netlify.app/auth/login`
  - `https://smartsba.netlify.app/reset-password`
  - `https://smartsba.netlify.app/mfa-challenge`
  - `http://localhost:3000/**`
  - Any Netlify preview URLs you use

### Netlify environment variables

Set these in Production environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_BASE_URL=https://smartsba.netlify.app`
- `NEXT_PUBLIC_APP_URL=https://smartsba.netlify.app`

Then redeploy production.

### Netlify redirect

Ensure the site redirects legacy auth login paths:

- `/auth/login` -> `/login`

This is already captured in `netlify.toml`.

## 2. Recover Super Admin Access

### Option A: Reset the password directly in Supabase

If you need the fastest path back in:

1. Open Supabase Dashboard.
2. Go to Authentication -> Users.
3. Find the Super Admin user.
4. Set a temporary password or trigger a password reset from the dashboard.
5. Sign in again on `https://smartsba.netlify.app/login`.

### Option B: Repair the profile linkage

If the password is correct but login still fails with profile lookup or role issues:

1. Check whether the `user_profiles.user_id` matches the Supabase Auth user ID.
2. Apply the profile repair script:

- `fix_super_admin_profile.sql`

3. If the issue is caused by RLS recursion or policy mismatch, apply the emergency policy fix:

- `emergency_fix_rls.sql`

4. Retest login immediately after applying the fix.

## 3. Clear Lockout Conditions

If the account is being throttled or locked out after repeated attempts:

- Clear the relevant login attempt / lockout records for the affected user or IP.
- Retest once only after the production URL and env vars are correct.

Do not keep retrying login before the production base URL is fixed, because that can make rate limiting look like a credentials problem.

## 4. Validate the Recovery

Confirm all of the following:

- Super Admin can log in on production.
- The browser no longer redirects with a configuration error.
- OTP and password reset links point to `https://smartsba.netlify.app`.
- `/auth/login` resolves to `/login`.
- Privileged pages load without unexpected forced-reset loops.
- No user-facing localhost links appear in emailed auth flows.

## 5. Follow-Up Hardening

After access is restored, schedule these cleanup tasks:

- Replace any placeholder reset-approval email sender with a real provider.
- Remove localhost defaults from all login and onboarding email templates.
- Add a pre-deploy check that fails when production auth URLs are missing.
- Rotate any exposed Supabase keys if they were committed or shared during debugging.

## Relevant Code and Docs

- `src/lib/supabase.ts`
- `src/app/api/auth/otp/route.ts`
- `src/services/emailService.ts`
- `middleware.ts`
- `netlify.toml`
- `docs/SUPER_ADMIN_LOGIN_FIX.md`
- `docs/ADMIN_CREATION_ENV_SETUP.md`
- `fix_super_admin_profile.sql`
- `emergency_fix_rls.sql`
