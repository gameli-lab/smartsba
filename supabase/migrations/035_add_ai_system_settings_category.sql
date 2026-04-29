-- Allow AI settings in system_settings and seed the defaults used by the admin UI.

ALTER TABLE system_settings
  DROP CONSTRAINT IF EXISTS system_settings_category_check;

ALTER TABLE system_settings
  ADD CONSTRAINT system_settings_category_check
  CHECK (category IN ('features', 'grading', 'calendar', 'results', 'security', 'ai'));

INSERT INTO system_settings (setting_key, setting_value, description, category) VALUES
  ('ai.default_provider', '"anthropic"', 'Default provider for AI features', 'ai'),
  ('ai.anthropic_model', '"claude-3-5-sonnet-20241022"', 'Default Anthropic model', 'ai'),
  ('ai.openai_model', '"gpt-4o-mini"', 'Default OpenAI model', 'ai'),
  ('ai.gemini_model', '"gemini-1.5-pro"', 'Default Gemini model', 'ai')
ON CONFLICT (setting_key) DO NOTHING;