-- AI Governance Assistant persistence tables
-- Stores AI command sessions, messages, actions, and security findings

CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_role user_role NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('switch_role', 'feature_audit', 'security_audit')),
  target_role user_role,
  focus TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE NOT NULL,
  action_name TEXT NOT NULL,
  action_payload JSONB DEFAULT '{}'::jsonb,
  outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'failure')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_findings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  area TEXT NOT NULL,
  finding TEXT NOT NULL,
  suggested_fix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_actor ON ai_sessions(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_school ON ai_sessions(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_actions_session ON ai_actions(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_findings_session ON ai_findings(session_id, severity, status);

ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_findings ENABLE ROW LEVEL SECURITY;

-- Users can view their own AI sessions; super admins can view all
CREATE POLICY ai_sessions_select_policy ON ai_sessions
  FOR SELECT USING (
    actor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'super_admin'
    )
  );

-- Only service role should insert/update/delete in AI tables.
-- Keep direct user writes disabled by absence of write policies.

CREATE POLICY ai_messages_select_policy ON ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM ai_sessions s
      WHERE s.id = ai_messages.session_id
      AND (
        s.actor_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM user_profiles up
          WHERE up.user_id = auth.uid()
          AND up.role = 'super_admin'
        )
      )
    )
  );

CREATE POLICY ai_actions_select_policy ON ai_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM ai_sessions s
      WHERE s.id = ai_actions.session_id
      AND (
        s.actor_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM user_profiles up
          WHERE up.user_id = auth.uid()
          AND up.role = 'super_admin'
        )
      )
    )
  );

CREATE POLICY ai_findings_select_policy ON ai_findings
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM ai_sessions s
      WHERE s.id = ai_findings.session_id
      AND (
        s.actor_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM user_profiles up
          WHERE up.user_id = auth.uid()
          AND up.role = 'super_admin'
        )
      )
    )
  );

CREATE TRIGGER update_ai_sessions_updated_at
  BEFORE UPDATE ON ai_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_findings_updated_at
  BEFORE UPDATE ON ai_findings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
