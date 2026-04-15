-- Add configurable MFA trusted-session window for device/session controls.

INSERT INTO system_settings (setting_key, setting_value, description, category)
VALUES (
  'security.mfa_trusted_session_hours',
  '12',
  'How long MFA verification is trusted on a device/session (in hours)',
  'security'
)
ON CONFLICT (setting_key) DO NOTHING;
