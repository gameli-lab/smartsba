-- Create system_settings table for global platform configuration
-- These settings apply to the entire platform and serve as defaults for new schools

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('features', 'grading', 'calendar', 'results', 'security')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index for efficient querying
CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_key ON system_settings(setting_key);

-- Add RLS policies
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can read all settings
CREATE POLICY "Super admins can read system settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Super admins can update settings
CREATE POLICY "Super admins can update system settings"
  ON system_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Super admins can insert settings
CREATE POLICY "Super admins can insert system settings"
  ON system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Create trigger to update timestamp
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_settings_timestamp
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_timestamp();

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, description, category) VALUES
  -- Feature Toggles
  ('features.students_enabled', 'true', 'Enable/disable student module platform-wide', 'features'),
  ('features.parents_enabled', 'true', 'Enable/disable parent module platform-wide', 'features'),
  ('features.teachers_enabled', 'true', 'Enable/disable teacher module platform-wide', 'features'),
  ('features.analytics_enabled', 'true', 'Enable/disable analytics module', 'features'),
  ('features.reports_enabled', 'true', 'Enable/disable reports module', 'features'),
  ('features.announcements_enabled', 'true', 'Enable/disable announcements module', 'features'),

  -- Default Grading Scales
  ('grading.default_scale', '{"A": [70, 100], "B": [60, 69], "C": [50, 59], "D": [40, 49], "F": [0, 39]}', 'Default grading scale for new schools', 'grading'),
  ('grading.pass_mark', '40', 'Default passing mark percentage', 'grading'),
  ('grading.ca_weight', '40', 'Default CA score weight (out of 100)', 'grading'),
  ('grading.exam_weight', '60', 'Default exam score weight (out of 100)', 'grading'),

  -- Default Academic Calendar
  ('calendar.terms_per_year', '3', 'Number of academic terms per year', 'calendar'),
  ('calendar.default_term_length_weeks', '13', 'Default length of each term in weeks', 'calendar'),
  ('calendar.academic_year_start_month', '9', 'Default month for academic year start (1-12)', 'calendar'),

  -- Result Publication Rules
  ('results.auto_publish', 'false', 'Automatically publish results when entered', 'results'),
  ('results.require_approval', 'true', 'Require admin approval before publishing results', 'results'),
  ('results.allow_student_view_pending', 'false', 'Allow students to view pending (unpublished) results', 'results'),
  ('results.parent_notification_enabled', 'true', 'Send notifications to parents when results are published', 'results'),

  -- Security Policies
  ('security.password_min_length', '8', 'Minimum password length', 'security'),
  ('security.password_require_uppercase', 'true', 'Require at least one uppercase letter', 'security'),
  ('security.password_require_lowercase', 'true', 'Require at least one lowercase letter', 'security'),
  ('security.password_require_number', 'true', 'Require at least one number', 'security'),
  ('security.password_require_special', 'false', 'Require at least one special character', 'security'),
  ('security.login_lockout_attempts', '5', 'Number of failed login attempts before lockout', 'security'),
  ('security.login_lockout_duration_minutes', '30', 'Duration of account lockout in minutes', 'security'),
  ('security.session_timeout_minutes', '60', 'Session timeout duration in minutes', 'security')
ON CONFLICT (setting_key) DO NOTHING;

-- Comment on table
COMMENT ON TABLE system_settings IS 'Global platform settings that serve as defaults for new schools';
COMMENT ON COLUMN system_settings.setting_key IS 'Unique identifier for the setting (dot notation: category.name)';
COMMENT ON COLUMN system_settings.setting_value IS 'Setting value stored as JSON for flexibility';
COMMENT ON COLUMN system_settings.category IS 'Setting category: features, grading, calendar, results, security';
COMMENT ON COLUMN system_settings.updated_by IS 'User ID of the super admin who last updated this setting';
