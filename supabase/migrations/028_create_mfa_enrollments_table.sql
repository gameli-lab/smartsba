-- Store MFA enrollment data for privileged accounts.

CREATE TABLE IF NOT EXISTS public.mfa_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'student', 'parent')),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  secret_base32 TEXT NOT NULL,
  backup_codes_hashed JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_enrollments_role ON public.mfa_enrollments(role);
CREATE INDEX IF NOT EXISTS idx_mfa_enrollments_school_id ON public.mfa_enrollments(school_id);

CREATE OR REPLACE FUNCTION public.update_mfa_enrollments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_mfa_enrollments_timestamp ON public.mfa_enrollments;

CREATE TRIGGER trigger_update_mfa_enrollments_timestamp
BEFORE UPDATE ON public.mfa_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.update_mfa_enrollments_timestamp();

ALTER TABLE public.mfa_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages mfa enrollments"
ON public.mfa_enrollments
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.mfa_enrollments IS 'Stores MFA enrollment secrets and backup codes for privileged accounts.';