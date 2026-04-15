-- Store suspicious login, reset, MFA, and export events with risk scoring.

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  identifier TEXT,
  event_type TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_actor_user_id ON public.security_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_school_id ON public.security_events(school_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages security events"
ON public.security_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.security_events IS 'Tracks suspicious or noteworthy security events with risk scores.';