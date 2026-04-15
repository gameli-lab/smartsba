-- Track failed login attempts and temporary account lockouts.

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'staff', 'student', 'parent')),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  identifier_hint TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_role ON public.login_attempts(role);
CREATE INDEX IF NOT EXISTS idx_login_attempts_school_id ON public.login_attempts(school_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until ON public.login_attempts(locked_until);

CREATE OR REPLACE FUNCTION public.update_login_attempts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_login_attempts_timestamp ON public.login_attempts;

CREATE TRIGGER trigger_update_login_attempts_timestamp
BEFORE UPDATE ON public.login_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_login_attempts_timestamp();

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages login attempts"
ON public.login_attempts
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.login_attempts IS 'Tracks failed login attempts and lockout state for authentication identifiers.';
COMMENT ON COLUMN public.login_attempts.scope_key IS 'Hashed scope key of role + school + identifier.';
COMMENT ON COLUMN public.login_attempts.identifier_hint IS 'Sanitized identifier prefix for troubleshooting, not full identifier.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_requests'
  ) THEN
    ALTER TABLE public.password_reset_requests
      ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');
  END IF;
END
$$;
