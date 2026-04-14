-- Queue-backed Twilio retries + persisted security rule check history

CREATE TABLE IF NOT EXISTS twilio_sms_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  twilio_sid TEXT,
  last_error TEXT,
  sender_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twilio_sms_queue_status_next_attempt
  ON twilio_sms_queue(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_twilio_sms_queue_created_by
  ON twilio_sms_queue(created_by, created_at DESC);

ALTER TABLE twilio_sms_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY twilio_sms_queue_select_policy ON twilio_sms_queue
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role = 'super_admin'
    )
  );

CREATE TABLE IF NOT EXISTS security_rule_check_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target TEXT,
  content_hash TEXT,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_advisory TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_rule_check_runs_actor
  ON security_rule_check_runs(actor_user_id, created_at DESC);

ALTER TABLE security_rule_check_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_rule_check_runs_select_policy ON security_rule_check_runs
  FOR SELECT USING (
    actor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role = 'super_admin'
    )
  );

CREATE TRIGGER update_twilio_sms_queue_updated_at
  BEFORE UPDATE ON twilio_sms_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
