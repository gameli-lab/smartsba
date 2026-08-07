-- ─────────────────────────────────────────────────────────────
-- Hubtel Passwordless Login Support
-- Adds provider tracking + Hubtel session metadata to
-- login_otp_challenges table
-- ─────────────────────────────────────────────────────────────

-- Add provider column to distinguish internal vs Hubtel challenges
ALTER TABLE login_otp_challenges
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'internal'
  CHECK (provider IN ('internal', 'hubtel'));

-- Add Hubtel requestId for OTP session tracking
ALTER TABLE login_otp_challenges
  ADD COLUMN IF NOT EXISTS request_id TEXT;

-- Add Hubtel prefix (4-character phrase returned by Hubtel)
ALTER TABLE login_otp_challenges
  ADD COLUMN IF NOT EXISTS prefix TEXT;

-- Create an index for fast lookups by Hubtel requestId
CREATE INDEX IF NOT EXISTS idx_login_otp_challenges_hubtel_request
  ON login_otp_challenges(request_id)
  WHERE provider = 'hubtel' AND verified_at IS NULL;

-- Backfill existing internal challenges
UPDATE login_otp_challenges
SET provider = 'internal'
WHERE provider IS NULL;

-- Drop and re-add default constraint for provider after backfill
ALTER TABLE login_otp_challenges
  ALTER COLUMN provider SET DEFAULT 'internal';