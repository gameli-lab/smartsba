-- Passwordless authentication no longer uses password-change enforcement fields.
ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS password_change_required,
  DROP COLUMN IF EXISTS password_changed_at;

DROP INDEX IF EXISTS public.idx_user_profiles_password_change_required;
