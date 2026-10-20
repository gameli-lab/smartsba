-- Password reset requests are no longer used by the passwordless authentication flow.
DROP TABLE IF EXISTS public.password_reset_requests;
DROP TYPE IF EXISTS public.password_reset_status;
