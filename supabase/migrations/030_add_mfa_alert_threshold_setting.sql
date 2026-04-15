-- Add configurable threshold for MFA failed-verification spike alerts.

INSERT INTO system_settings (setting_key, setting_value, description, category)
VALUES (
  'security.mfa_failure_spike_threshold_per_hour',
  '5',
  'Number of failed MFA verifications in one hour that triggers an alert',
  'security'
)
ON CONFLICT (setting_key) DO NOTHING;
