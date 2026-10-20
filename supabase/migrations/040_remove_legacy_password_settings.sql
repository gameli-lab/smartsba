-- Passwordless authentication no longer uses password policy settings.
DELETE FROM public.system_settings
WHERE setting_key IN (
  'security.password_min_length',
  'security.password_require_uppercase',
  'security.password_require_lowercase',
  'security.password_require_number',
  'security.password_require_special'
);
