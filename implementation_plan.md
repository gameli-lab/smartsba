# Implementation Plan

[Overview]
Stabilize the MFA flow so privileged users do not loop back to `/mfa-challenge` after a successful verification, while making MFA enforcement consistent across middleware, server guards, API routes, and the challenge page.

The current MFA implementation is spread across `middleware.ts`, `src/lib/auth-guards.ts`, `src/app/api/auth/mfa/route.ts`, `src/app/api/super-admin/assume-role/route.ts`, `src/lib/mfa-session.ts`, `src/lib/supabase.ts`, and `src/app/mfa-challenge/page.tsx`. The loop is not caused by a single comparison bug; it is the result of duplicated MFA enforcement logic with different data-access models and different assumptions about when the verification cookie becomes readable. In particular, middleware currently performs privileged-route MFA checks itself, even though the canonical enrollment data lives in `public.mfa_enrollments`, which is protected by RLS for `service_role` only. The implementation also contains stale schema assumptions in the super-admin assume-role route and a client-side verify flow that immediately redirects after verification, which can race cookie visibility.

The high-level approach is to make MFA validation deterministic and centralized. The shared cookie helper in `src/lib/mfa-session.ts` remains the canonical cookie format/check. Service-role reads of `mfa_enrollments` must be performed only through server-safe helpers, not ad hoc queries with user-scoped clients. Privileged page access should be enforced in one consistent way, ideally by server auth guards and a small number of trusted API checks, while middleware should avoid becoming a second independent MFA authority unless it is using the same source of truth and failure semantics. The challenge page should only navigate once verified session state has been re-observed, rather than assuming that a successful POST implies the browser has already applied the new cookie for the next navigation.

The implementation also needs to reconcile schema usage with the actual migration. `supabase/migrations/028_create_mfa_enrollments_table.sql` defines `enabled` and `last_used_at`; there is no `is_verified` column. Any code still querying `is_verified` is stale and will create false negatives. The final implementation must remove these mismatches and make the trust window behavior explicit, testable, and uniform across all privileged flows including super-admin role assumption.

[Types]
Unify MFA session and enrollment typing so all MFA consumers use the same field names and validation rules.

Introduce or standardize the following TypeScript shapes in the existing MFA/session-related modules:

- `type MfaEnrollmentRow = { enabled: boolean; enabled_at: string | null; last_used_at: string | null; backup_codes_hashed?: string[] | null; secret_base32?: string | null; role?: string; school_id?: string | null }`
  - Represents the actual `public.mfa_enrollments` table shape used by application code.
  - `enabled` is the authoritative enrollment-active flag.
  - `last_used_at` is the authoritative timestamp used to mint/validate the trusted-session cookie.
  - `enabled_at` tracks first enablement but is not sufficient for trusted-session validation.
  - `backup_codes_hashed` is an array-like JSON payload and may be absent depending on the select shape.
  - No code should refer to `is_verified`; that field does not exist in the schema.

- `type MfaVerificationState = { enrolled: boolean; enabled: boolean; verified: boolean; lastUsedAt: string | null }`
  - A normalized server-side result used internally by guards/middleware/API code.
  - `enrolled` means a row exists.
  - `enabled` means MFA has been activated.
  - `verified` means `isMfaCookieVerified(userId, last_used_at, cookie)` is true.
  - `lastUsedAt` mirrors the enrollment row and is included so all callers use the same timestamp basis.

- `type PrivilegedRole = 'super_admin' | 'school_admin'`
  - Shared conceptual role type for MFA-required roles.
  - Avoids repeating string literal checks across middleware and API routes.

- `type MfaStatusResponse = { role?: string; schoolId?: string | null; enrolled?: boolean; enabled?: boolean; verified?: boolean; backupCodesRemaining?: number; requiredForRole?: boolean; trustedSessionHours?: number }`
  - This already exists on the challenge page and should remain aligned with `GET /api/auth/mfa`.
  - `verified` must be computed with the same helper used everywhere else.
  - `requiredForRole` is derived from role, not from enrollment presence.

Validation rules:
- Cookie verification is valid only when both `last_used_at` and the presented cookie are present.
- Cookie value must be derived solely from `userId` plus normalized ISO timestamp from `last_used_at`.
- Privileged-role enforcement must never infer verification from `enabled` alone.
- Any missing environment variables required for service-role MFA checks must fail closed for protected privileged flows and fail clearly in logs.

[Files]
Consolidate MFA enforcement logic across a small set of existing files; no broad structural rewrite is required.

Existing files to be modified:

- `src/lib/mfa-session.ts`
  - Keep as the canonical MFA cookie formatter/verifier.
  - Potentially add one or more small shared helpers if needed for normalized verification state, but preserve current cookie contract.
  - Ensure all other modules consume this helper instead of manually rebuilding/ comparing cookie values.

- `src/lib/supabase.ts`
  - Add a dedicated server-safe helper for MFA enrollment reads if needed, using the existing service-role facilities.
  - Avoid duplicating raw `createClient(url, serviceRoleKey)` setup in multiple files when the project already exposes `createAdminSupabaseClient()`.
  - Ensure edge/server-runtime expectations are explicit in the helper naming and usage.

- `middleware.ts`
  - Remove or greatly narrow ad hoc MFA enrollment querying logic.
  - Keep auth/session timeout/CSRF responsibilities.
  - If MFA checks remain in middleware, they must use a single shared helper and the same semantics as server guards and API routes.
  - Prefer not to duplicate privileged MFA enforcement in both middleware and page guards unless there is a clearly documented reason.

- `src/lib/auth-guards.ts`
  - Treat this as the canonical server-side privileged page gate.
  - Continue enforcing MFA for `requireSuperAdmin()` and `requireSchoolAdmin()`, but move repeated enrollment lookup logic behind a shared helper if introduced.
  - Preserve existing assume-role flow, while ensuring super-admin actor MFA verification uses the real schema and shared cookie validation.

- `src/app/api/auth/mfa/route.ts`
  - Continue to serve as the authoritative enrollment/verify endpoint.
  - Normalize GET verification logic to use the shared cookie checker rather than manual equality.
  - Keep POST verify as the only place that updates `last_used_at` and mints the trusted cookie.
  - Preserve current trusted-session TTL behavior from `system_settings`.

- `src/app/mfa-challenge/page.tsx`
  - Replace immediate redirect-after-verify behavior with a verified-status recheck flow.
  - Ensure `loadStatus()` becomes the authoritative post-verify redirect trigger.
  - Keep enrollment UI intact; only the verification/navigation lifecycle should change.

- `src/app/api/super-admin/assume-role/route.ts`
  - Replace stale `is_verified` query logic with the actual `enabled`/`last_used_at` model.
  - Replace raw cookie comparison with the shared helper from `src/lib/mfa-session.ts`.
  - Keep role-assumption cookie behavior unchanged.

- `src/components/auth/portal-login-shell.tsx`
  - Likely no major structural change required.
  - Confirm that privileged login continues redirecting to `/mfa-challenge?next=...` and does not try to second-guess verification state itself.

- `supabase/migrations/028_create_mfa_enrollments_table.sql`
  - No schema change is planned.
  - This file serves as the source-of-truth reference for the implementation and for tests/assertions.

Optional file additions:

- `tests/mfa-session.test.ts`
  - Unit tests for cookie normalization and verification semantics.

- `tests/mfa-flow.test.ts` or similar targeted auth test file
  - Focused integration-style tests for verification-state evaluation if the current Jest setup makes route/unit extraction practical.

No files should be deleted or moved. No configuration changes are required unless verification tests reveal a missing alias mapping or route-test utility issue.

[Functions]
Refactor a small number of functions and add shared helpers so MFA status is derived once and reused consistently.

1. `buildMfaCookieValue(userId: string, lastUsedAt: string): string`
- Existing location: `src/lib/mfa-session.ts`
- Purpose: Canonically derive the trusted MFA cookie value.
- Parameters:
  - `userId`: authenticated user id
  - `lastUsedAt`: server timestamp from `mfa_enrollments.last_used_at`
- Returns: normalized cookie string in the format `${userId}:${isoTimestamp}`
- Key implementation details:
  - Must continue normalizing timestamps via `new Date(lastUsedAt).toISOString()`.
  - Must remain backward-compatible with currently minted cookies.
- Error handling:
  - Invalid dates should continue falling back to the original string representation through the existing normalization behavior.

2. `isMfaCookieVerified(userId: string, lastUsedAt: string | null | undefined, providedCookie: string | null | undefined): boolean`
- Existing location: `src/lib/mfa-session.ts`
- Purpose: Single source of truth for trusted-session verification.
- Parameters:
  - `userId`
  - `lastUsedAt`
  - `providedCookie`
- Returns: `true` only when `providedCookie` exactly matches `buildMfaCookieValue(userId, lastUsedAt)`
- Key implementation details:
  - All MFA consumers must call this instead of doing manual comparisons.
- Error handling:
  - Missing timestamp or cookie must return `false`, never throw.

3. `getMfaEnrollmentForUser(userId: string): Promise<MfaEnrollmentRow | null>`
- Proposed location: `src/lib/supabase.ts` or a new helper colocated with MFA session utilities if that proves cleaner.
- Purpose: Centralized service-role read helper for `mfa_enrollments`.
- Parameters:
  - `userId`
- Returns: normalized enrollment row or `null`
- Key implementation details:
  - Must use service-role client access.
  - Must select only schema-real fields such as `enabled`, `enabled_at`, `last_used_at`, `backup_codes_hashed`, `secret_base32` as needed.
  - Should avoid repeated inline `(admin as any).from(...).select(...)` blocks throughout the codebase where possible.
- Error handling:
  - Missing service-role config should either throw a clear server error or return `null` only when the caller is designed to fail closed and log appropriately.
  - Query errors should be handled in a way that prevents silent verification bypass.

4. `getMfaVerificationState(userId: string, providedCookie?: string | null): Promise<MfaVerificationState>`
- Proposed shared helper location in MFA-related library code.
- Purpose: Normalize the concepts of enrolled/enabled/verified for all privileged checks.
- Parameters:
  - `userId`
  - `providedCookie`
- Returns: normalized verification state
- Key implementation details:
  - Reads enrollment using the shared service-role helper.
  - Computes `verified` through `isMfaCookieVerified`.
  - Makes it impossible for one caller to check only `enabled` while another also checks the cookie.
- Error handling:
  - On read failure, callers enforcing privileged access should fail closed.

5. `requirePrivilegedMfa(userId: string): Promise<void>`
- Existing location: `src/lib/auth-guards.ts`
- Purpose: Canonical server-side redirect gate for privileged pages.
- Parameters:
  - `userId`
- Returns: resolves on success, otherwise redirects.
- Key implementation details:
  - Should call the shared enrollment/verification helper.
  - Must keep redirect target `/mfa-challenge`.
- Error handling:
  - Missing/disabled enrollment or invalid cookie redirects to `/mfa-challenge`.

6. `loadStatus(): Promise<void>`
- Existing location: `src/app/mfa-challenge/page.tsx`
- Purpose: Authoritative client-side MFA status fetch and redirect decision.
- Parameters: none
- Returns: void promise updating component state
- Key implementation details:
  - Must include same-origin credentials in fetches.
  - After `POST verify`, this should be re-run and should perform the redirect only when `GET /api/auth/mfa` reports `verified: true`.
  - Redirect target should continue using sanitized `next` or role-based fallback.
- Error handling:
  - On missing session token, redirect to `/login`.
  - On API failure, show an error message and leave the user on the challenge page.

7. `enforceSuperAdminMfa(admin, userId, presentedCookie): Promise<NextResponse | null>`
- Existing location: `src/app/api/super-admin/assume-role/route.ts`
- Purpose: Ensure role assumption only starts after valid super-admin MFA verification.
- Parameters:
  - `admin`: service-role Supabase client
  - `userId`
  - `presentedCookie`
- Returns: `null` when allowed, error response when blocked
- Key implementation details:
  - Must query real schema fields, not `is_verified`.
  - Must use `isMfaCookieVerified`, not bespoke expected-cookie logic.
- Error handling:
  - Missing enrollment, disabled MFA, missing `last_used_at`, or invalid cookie returns 403.

[Changes]
Implement a focused MFA consistency pass that removes duplicate state derivation and aligns every privileged code path with the actual schema.

1. Re-establish the current source of truth.
   - Treat `supabase/migrations/028_create_mfa_enrollments_table.sql` as canonical for schema fields.
   - Document that `enabled` and `last_used_at` are the only fields needed for trust validation.
   - Remove any assumptions about `is_verified`.

2. Centralize enrollment reads.
   - Add a shared helper for service-role MFA enrollment retrieval.
   - Replace ad hoc inline reads in middleware, auth guards, and super-admin assume-role logic with the helper or with a normalized verification-state helper built on top of it.
   - This reduces the current drift where one file uses `createAdminSupabaseClient()`, another creates a fresh service-role client inline, and another uses stale schema.

3. Make one verification algorithm authoritative.
   - Keep `isMfaCookieVerified()` as the single trusted comparison function.
   - Update `GET /api/auth/mfa` to use the shared helper rather than manual expected-cookie equality.
   - Update `src/app/api/super-admin/assume-role/route.ts` to use the same helper.
   - Ensure no code path checks `enabled` without also validating the cookie where trust is required.

4. Simplify middleware responsibilities.
   - Reevaluate whether middleware should enforce privileged MFA at all.
   - Preferred approach: middleware handles session presence, timeout, CSRF, and coarse login redirect behavior; server auth guards remain the authoritative privileged-page MFA gate.
   - If privileged redirect behavior from `/login` still needs middleware assistance, it should use the same normalized verification-state helper and must not become a divergent implementation.
   - Avoid any design where both middleware and guards independently compute MFA validity differently.

5. Fix client-side verification race conditions.
   - Keep the challenge page’s POST verify request credentialed.
   - After a successful verify response, do not immediately navigate based only on POST success.
   - Re-fetch status through `loadStatus()` and only redirect once `verified` is observable from `GET /api/auth/mfa`.
   - Preserve the success messaging and `next` sanitization logic.

6. Repair super-admin role assumption checks.
   - Update `enforceSuperAdminMfa()` to query `enabled, last_used_at` instead of `is_verified`.
   - Replace direct `buildMfaCookieValue()` comparison with `isMfaCookieVerified()`.
   - Keep the rest of the assume-role issuance logic unchanged.

7. Verify login-to-challenge-to-target transitions.
   - Confirm that `src/components/auth/portal-login-shell.tsx` still sends privileged users to `/mfa-challenge?next=...`.
   - Confirm that once the challenge page re-observes verification, navigation goes to `/school-admin` or `/dashboard/super-admin` as intended.
   - Confirm that non-privileged roles are unaffected.

8. Add targeted test coverage.
   - Unit-test cookie normalization and matching edge cases such as timestamp formatting differences.
   - Test normalized verification-state behavior for:
     - no enrollment row
     - enrollment exists but disabled
     - enabled enrollment with missing cookie
     - enabled enrollment with stale cookie
     - enabled enrollment with matching cookie
   - Add at least one focused test covering stale `is_verified` assumptions indirectly by asserting that `enabled` is the queried field in the helper behavior or by testing the normalization logic extracted from the assume-role path.

9. Validate runtime behavior.
   - Run targeted tests and, if feasible in this codebase, a local dev verification of:
     - privileged login → challenge
     - correct code entry → target page
     - revisit protected page with trusted session → no challenge loop
     - logout → MFA cookie cleared
   - Confirm no regressions to teacher/student/parent flows.

[Tests]
Use a focused mix of unit tests and targeted integration validation to prove MFA trust-state consistency and eliminate the redirect loop.

Unit tests to be written:
- `tests/mfa-session.test.ts`
  - `buildMfaCookieValue()` normalizes valid timestamps to ISO.
  - `buildMfaCookieValue()` preserves invalid timestamp strings without throwing.
  - `isMfaCookieVerified()` returns false for missing cookie.
  - `isMfaCookieVerified()` returns false for missing `last_used_at`.
  - `isMfaCookieVerified()` returns true for equivalent timestamps with different input formatting.
  - `isMfaCookieVerified()` returns false for mismatched user id or timestamp.

Integration-style or extracted-helper tests:
- Tests for shared MFA enrollment/verification-state helper:
  - no row -> `{ enrolled: false, enabled: false, verified: false }`
  - disabled row -> `verified: false`
  - enabled row + null `last_used_at` -> `verified: false`
  - enabled row + stale cookie -> `verified: false`
  - enabled row + matching cookie -> `verified: true`

Route/behavior validation:
- `GET /api/auth/mfa` should report `verified: true` only when the shared helper says true.
- Super-admin assume-role MFA enforcement should reject when cookie is absent or stale and allow when it matches the real `last_used_at`.
- Challenge page verify flow should not redirect until post-verify status confirms `verified: true`.

Test data requirements:
- Mock user ids and ISO timestamps.
- Mock `mfa_enrollments` rows aligned to the actual schema (`enabled`, `last_used_at`, etc.).
- Mock cookies for present, absent, stale, and matching scenarios.

Edge cases to cover:
- Invalid `last_used_at` formatting.
- Service-role configuration missing.
- Enrollment exists but is disabled.
- Backup-code verification updates `last_used_at`, producing a new cookie basis.
- Logout clears trusted MFA cookie and causes future privileged access to require re-verification.

Performance considerations:
- Shared MFA state helpers should query only minimal fields needed for verification.
- Middleware must not perform redundant heavy queries on every request if the final design shifts MFA authority to server guards.
- Tests should isolate helper logic rather than requiring full Next.js runtime boot for every case.
