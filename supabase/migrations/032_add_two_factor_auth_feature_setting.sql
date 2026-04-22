-- Add the global 2FA feature toggle so new databases seed the setting instead of falling back to the client default.

INSERT INTO system_settings (setting_key, setting_value, description, category)
VALUES (
  'features.enable_two_factor_auth',
  'false',
  'Enable or disable two-factor authentication platform-wide',
  'features'
)
ON CONFLICT (setting_key) DO NOTHING;