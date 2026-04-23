ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_password_change_required
  ON user_profiles(password_change_required)
  WHERE password_change_required = true;
