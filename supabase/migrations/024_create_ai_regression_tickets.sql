-- Persist regression tickets generated from AI test cases

CREATE TABLE IF NOT EXISTS ai_regression_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE NOT NULL,
  test_case_id UUID REFERENCES ai_test_cases(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_ticket_per_test_case UNIQUE (test_case_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_regression_tickets_session ON ai_regression_tickets(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_regression_tickets_status ON ai_regression_tickets(status, priority);

ALTER TABLE ai_regression_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_regression_tickets_select_policy ON ai_regression_tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM ai_sessions s
      WHERE s.id = ai_regression_tickets.session_id
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

CREATE TRIGGER update_ai_regression_tickets_updated_at
  BEFORE UPDATE ON ai_regression_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
