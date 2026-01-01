-- Create audit_logs table for tracking critical system actions
-- This table stores a complete audit trail of all important operations

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('super_admin', 'school_admin', 'teacher', 'student', 'parent')),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_composite ON audit_logs(action_type, entity_type, created_at DESC);

-- Add RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can read all audit logs
CREATE POLICY "Super admins can read all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- School admins can read logs for their school's entities
CREATE POLICY "School admins can read their school audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'school_admin'
      AND user_profiles.school_id IS NOT NULL
    )
  );

-- System can insert audit logs (via service role)
-- Users cannot directly insert/update/delete audit logs

-- Create helper function to log actions
CREATE OR REPLACE FUNCTION log_audit_action(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_action_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    actor_user_id,
    actor_role,
    action_type,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_actor_user_id,
    p_actor_role,
    p_action_type,
    p_entity_type,
    p_entity_id,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Comment on table
COMMENT ON TABLE audit_logs IS 'System-wide audit trail for critical actions';
COMMENT ON COLUMN audit_logs.action_type IS 'Type of action: school_created, school_updated, school_deleted, school_activated, school_deactivated, user_role_changed, bulk_import, admin_override';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity affected: school, user, session, class, etc.';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context about the action (JSON format)';
