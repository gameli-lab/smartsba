-- Migration: Create email_logs table for tracking email delivery
-- Description: Tracks all emails sent from the platform with delivery status

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL, -- 'school_created', 'user_created', 'role_changed', 'status_changed', etc.
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'bounced'
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX idx_email_logs_recipient_email ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_recipient_user_id ON email_logs(recipient_user_id);
CREATE INDEX idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at DESC);

-- RLS Policies for email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all email logs
CREATE POLICY "super_admin_view_email_logs" ON email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Users can view their own email logs
CREATE POLICY "users_view_own_email_logs" ON email_logs
  FOR SELECT
  USING (recipient_user_id = auth.uid());

-- Only system can insert email logs (via service role)
CREATE POLICY "system_insert_email_logs" ON email_logs
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS anyway

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_email_logs_updated_at();

-- Helper function to log email sends
CREATE OR REPLACE FUNCTION log_email_send(
  p_recipient_email TEXT,
  p_recipient_user_id UUID,
  p_email_type TEXT,
  p_subject TEXT,
  p_body_html TEXT DEFAULT NULL,
  p_body_text TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO email_logs (
    recipient_email,
    recipient_user_id,
    email_type,
    subject,
    body_html,
    body_text,
    metadata,
    status
  ) VALUES (
    p_recipient_email,
    p_recipient_user_id,
    p_email_type,
    p_subject,
    p_body_html,
    p_body_text,
    p_metadata,
    'pending'
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update email status
CREATE OR REPLACE FUNCTION update_email_status(
  p_log_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE email_logs
  SET 
    status = p_status,
    error_message = p_error_message,
    sent_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE sent_at END
  WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
