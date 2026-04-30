-- Create login_otp_challenges table for OTP-based authentication
CREATE TABLE IF NOT EXISTS login_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL, -- 'student' | 'teacher' | 'parent' | 'school_admin' | 'super_admin'
  school_id UUID,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')), -- Delivery channel
  destination TEXT NOT NULL, -- Email address or phone number (hashed in production recommended)
  code_hash TEXT NOT NULL, -- Hashed OTP code (bcrypt after generation)
  attempts INT DEFAULT 0, -- Number of verification attempts
  max_attempts INT DEFAULT 6, -- Maximum allowed attempts before lockout
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure user_id and role are set
  CONSTRAINT valid_destination CHECK (destination IS NOT NULL AND destination != '')
);

-- Create index for faster lookups by user_id and expiration
CREATE INDEX idx_login_otp_challenges_user_expires 
  ON login_otp_challenges(user_id, expires_at DESC)
  WHERE verified_at IS NULL;

-- Create index for lookups by destination (email/phone) for rate limiting
CREATE INDEX idx_login_otp_challenges_destination_created 
  ON login_otp_challenges(destination, created_at DESC)
  WHERE verified_at IS NULL;

-- Enable RLS (Row Level Security) for login_otp_challenges
ALTER TABLE login_otp_challenges ENABLE ROW LEVEL SECURITY;

-- Service role can read/write all OTP challenges (for server-side operations)
CREATE POLICY "Service role can manage OTP challenges"
  ON login_otp_challenges
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Create a function to clean up expired OTP challenges
CREATE OR REPLACE FUNCTION cleanup_expired_otp_challenges()
RETURNS void AS $$
BEGIN
  DELETE FROM login_otp_challenges
  WHERE expires_at < NOW() AND verified_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to update updated_at on row modification
CREATE OR REPLACE FUNCTION update_login_otp_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_login_otp_challenges_updated_at
  BEFORE UPDATE ON login_otp_challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_login_otp_challenges_updated_at();
