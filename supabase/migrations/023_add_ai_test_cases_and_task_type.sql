-- Extend AI task types and persist generated test cases

ALTER TABLE ai_sessions
  DROP CONSTRAINT IF EXISTS ai_sessions_task_type_check;

ALTER TABLE ai_sessions
  ADD CONSTRAINT ai_sessions_task_type_check
  CHECK (task_type IN ('switch_role', 'feature_audit', 'security_audit', 'test_plan'));

CREATE TABLE IF NOT EXISTS ai_test_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE NOT NULL,
  case_id TEXT NOT NULL,
  title TEXT NOT NULL,
  role user_role NOT NULL,
  route TEXT NOT NULL,
  objective TEXT NOT NULL,
  preconditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_result TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_test_cases_session ON ai_test_cases(session_id, created_at DESC);

ALTER TABLE ai_test_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_test_cases_select_policy ON ai_test_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM ai_sessions s
      WHERE s.id = ai_test_cases.session_id
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
