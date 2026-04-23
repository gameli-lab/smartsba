-- School academic configuration and automatic class/subject setup

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'school_stream_type') THEN
    CREATE TYPE school_stream_type AS ENUM ('single', 'double', 'cluster');
  END IF;
END $$;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS education_levels TEXT[] NOT NULL DEFAULT ARRAY['PRIMARY']::TEXT[],
  ADD COLUMN IF NOT EXISTS stream_type school_stream_type NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS stream_count INTEGER,
  ADD COLUMN IF NOT EXISTS academic_config_updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE schools
  DROP CONSTRAINT IF EXISTS schools_stream_count_valid;

ALTER TABLE schools
  ADD CONSTRAINT schools_stream_count_valid CHECK (
    (stream_type = 'cluster' AND stream_count IS NOT NULL AND stream_count >= 2 AND stream_count <= 26)
    OR (stream_type IN ('single', 'double') AND stream_count IS NULL)
  );

ALTER TABLE schools
  DROP CONSTRAINT IF EXISTS schools_education_levels_valid;

ALTER TABLE schools
  ADD CONSTRAINT schools_education_levels_valid CHECK (
    education_levels <@ ARRAY['KG', 'PRIMARY', 'JHS', 'SHS', 'SHTS']::TEXT[]
    AND array_length(education_levels, 1) >= 1
  );

CREATE INDEX IF NOT EXISTS idx_schools_stream_type ON schools(stream_type);

CREATE TABLE IF NOT EXISTS subject_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_group VARCHAR(20) NOT NULL,
  subject_key VARCHAR(80) NOT NULL UNIQUE,
  subject_name VARCHAR(255) NOT NULL,
  is_core BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  assignment_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_subject_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  level_group VARCHAR(20) NOT NULL,
  subject_key VARCHAR(80) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_core BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_school_subject_setting UNIQUE (school_id, level_group, subject_key)
);

CREATE INDEX IF NOT EXISTS idx_school_subject_settings_school_level
  ON school_subject_settings(school_id, level_group, is_enabled);

CREATE TABLE IF NOT EXISTS class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  level_group VARCHAR(20) NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'default',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_class_subject UNIQUE (class_id, subject_id),
  CONSTRAINT class_subject_source_valid CHECK (source IN ('default', 'override'))
);

CREATE INDEX IF NOT EXISTS idx_class_subjects_school_class
  ON class_subjects(school_id, class_id, is_enabled);

INSERT INTO subject_catalog (level_group, subject_key, subject_name, is_core, sort_order, assignment_rule)
VALUES
  ('KG', 'kg_language_literacy', 'Language & Literacy', true, 1, '{}'::jsonb),
  ('KG', 'kg_numeracy', 'Numeracy', true, 2, '{}'::jsonb),
  ('KG', 'kg_creative_arts', 'Creative Arts', false, 3, '{}'::jsonb),
  ('KG', 'kg_physical_development_health', 'Physical Development & Health', false, 4, '{}'::jsonb),
  ('KG', 'kg_rme', 'Religious and Moral Education (RME)', true, 5, '{}'::jsonb),
  ('KG', 'kg_ghanaian_language', 'Ghanaian Language', true, 6, '{}'::jsonb),
  ('PRIMARY', 'primary_english', 'English Language', true, 1, '{}'::jsonb),
  ('PRIMARY', 'primary_ghanaian_language', 'Ghanaian Language', true, 2, '{}'::jsonb),
  ('PRIMARY', 'primary_mathematics', 'Mathematics', true, 3, '{}'::jsonb),
  ('PRIMARY', 'primary_rme', 'Religious and Moral Education (RME)', true, 4, '{}'::jsonb),
  ('PRIMARY', 'primary_cad', 'Creative Arts and Design (CAD)', false, 5, '{}'::jsonb),
  ('PRIMARY', 'primary_phe', 'Physical and Health Education (PHE)', false, 6, '{}'::jsonb),
  ('PRIMARY', 'primary_computing', 'Computing', false, 7, '{}'::jsonb),
  ('PRIMARY', 'primary_science', 'Science', true, 8, '{"min_level":4,"max_level":6}'::jsonb),
  ('JHS', 'jhs_english', 'English Language', true, 1, '{}'::jsonb),
  ('JHS', 'jhs_mathematics', 'Mathematics', true, 2, '{}'::jsonb),
  ('JHS', 'jhs_integrated_science', 'Integrated Science', true, 3, '{}'::jsonb),
  ('JHS', 'jhs_social_studies', 'Social Studies', true, 4, '{}'::jsonb),
  ('JHS', 'jhs_rme', 'Religious and Moral Education (RME)', true, 5, '{}'::jsonb),
  ('JHS', 'jhs_ghanaian_language', 'Ghanaian Language', false, 6, '{}'::jsonb),
  ('JHS', 'jhs_french', 'French', false, 7, '{}'::jsonb),
  ('JHS', 'jhs_computing', 'Computing', false, 8, '{}'::jsonb),
  ('JHS', 'jhs_career_technology', 'Career Technology', false, 9, '{}'::jsonb),
  ('JHS', 'jhs_cad', 'Creative Arts and Design', false, 10, '{}'::jsonb),
  ('JHS', 'jhs_phe', 'Physical and Health Education (PHE)', false, 11, '{}'::jsonb)
ON CONFLICT (subject_key) DO UPDATE SET
  level_group = EXCLUDED.level_group,
  subject_name = EXCLUDED.subject_name,
  is_core = EXCLUDED.is_core,
  sort_order = EXCLUDED.sort_order,
  assignment_rule = EXCLUDED.assignment_rule,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION stream_suffixes_for_school(
  p_stream_type school_stream_type,
  p_stream_count INTEGER
)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  suffixes TEXT[] := ARRAY[]::TEXT[];
  i INTEGER;
BEGIN
  IF p_stream_type = 'single' THEN
    RETURN ARRAY[NULL::TEXT];
  END IF;

  IF p_stream_type = 'double' THEN
    RETURN ARRAY['A', 'B'];
  END IF;

  IF p_stream_type = 'cluster' THEN
    FOR i IN 1..COALESCE(p_stream_count, 0) LOOP
      suffixes := suffixes || CHR(64 + i);
    END LOOP;
    RETURN suffixes;
  END IF;

  RETURN ARRAY[NULL::TEXT];
END;
$$;

CREATE OR REPLACE FUNCTION infer_level_group_from_class_level(p_level INTEGER)
RETURNS VARCHAR
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_level IN (-1, 0) THEN
    RETURN 'KG';
  ELSIF p_level BETWEEN 1 AND 6 THEN
    RETURN 'PRIMARY';
  ELSIF p_level BETWEEN 7 AND 9 THEN
    RETURN 'JHS';
  END IF;
  RETURN 'UNKNOWN';
END;
$$;

CREATE OR REPLACE FUNCTION generate_school_classes(p_school_id UUID)
RETURNS TABLE(created_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_levels TEXT[];
  v_stream_type school_stream_type;
  v_stream_count INTEGER;
  v_suffixes TEXT[];
  v_suffix TEXT;
  v_created INTEGER := 0;
  v_name TEXT;
BEGIN
  SELECT education_levels, stream_type, stream_count
  INTO v_levels, v_stream_type, v_stream_count
  FROM schools
  WHERE id = p_school_id;

  IF v_levels IS NULL THEN
    RAISE EXCEPTION 'School % not found or missing education levels', p_school_id;
  END IF;

  v_suffixes := stream_suffixes_for_school(v_stream_type, v_stream_count);

  IF 'KG' = ANY(v_levels) THEN
    FOREACH v_suffix IN ARRAY v_suffixes LOOP
      INSERT INTO classes (school_id, name, level, stream)
      VALUES (p_school_id, 'KG 1', -1, v_suffix)
      ON CONFLICT (school_id, name, stream) DO NOTHING;

      IF FOUND THEN v_created := v_created + 1; END IF;

      INSERT INTO classes (school_id, name, level, stream)
      VALUES (p_school_id, 'KG 2', 0, v_suffix)
      ON CONFLICT (school_id, name, stream) DO NOTHING;

      IF FOUND THEN v_created := v_created + 1; END IF;
    END LOOP;
  END IF;

  IF 'PRIMARY' = ANY(v_levels) THEN
    FOR i IN 1..6 LOOP
      v_name := 'Basic ' || i;
      FOREACH v_suffix IN ARRAY v_suffixes LOOP
        INSERT INTO classes (school_id, name, level, stream)
        VALUES (p_school_id, v_name, i, v_suffix)
        ON CONFLICT (school_id, name, stream) DO NOTHING;

        IF FOUND THEN v_created := v_created + 1; END IF;
      END LOOP;
    END LOOP;
  END IF;

  IF 'JHS' = ANY(v_levels) THEN
    FOR i IN 1..3 LOOP
      v_name := 'JHS ' || i;
      FOREACH v_suffix IN ARRAY v_suffixes LOOP
        INSERT INTO classes (school_id, name, level, stream)
        VALUES (p_school_id, v_name, i + 6, v_suffix)
        ON CONFLICT (school_id, name, stream) DO NOTHING;

        IF FOUND THEN v_created := v_created + 1; END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_created;
END;
$$;

CREATE OR REPLACE FUNCTION seed_school_subject_settings(p_school_id UUID)
RETURNS TABLE(created_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_levels TEXT[];
  v_created INTEGER := 0;
BEGIN
  SELECT education_levels INTO v_levels FROM schools WHERE id = p_school_id;

  IF v_levels IS NULL THEN
    RAISE EXCEPTION 'School % not found', p_school_id;
  END IF;

  WITH inserted AS (
    INSERT INTO school_subject_settings (
      school_id,
      level_group,
      subject_key,
      subject_name,
      is_enabled,
      is_core,
      sort_order,
      metadata
    )
    SELECT
      p_school_id,
      sc.level_group,
      sc.subject_key,
      sc.subject_name,
      true,
      sc.is_core,
      sc.sort_order,
      sc.assignment_rule
    FROM subject_catalog sc
    WHERE sc.level_group = ANY(v_levels)
    ON CONFLICT (school_id, level_group, subject_key) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_created FROM inserted;

  RETURN QUERY SELECT v_created;
END;
$$;

CREATE OR REPLACE FUNCTION seed_class_subjects_from_settings(p_school_id UUID)
RETURNS TABLE(created_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_created INTEGER := 0;
BEGIN
  INSERT INTO subjects (school_id, level_group, name, code, description, is_core, is_active)
  SELECT
    sss.school_id,
    sss.level_group,
    sss.subject_name,
    NULL,
    NULL,
    sss.is_core,
    true
  FROM school_subject_settings sss
  WHERE sss.school_id = p_school_id
    AND sss.is_enabled = true
    AND NOT EXISTS (
      SELECT 1 FROM subjects sub
      WHERE sub.school_id = sss.school_id
        AND sub.level_group = sss.level_group
        AND lower(sub.name) = lower(sss.subject_name)
        AND coalesce(sub.is_active, true) = true
    );

  WITH map_rows AS (
    SELECT
      c.id AS class_id,
      c.school_id,
      c.level,
      infer_level_group_from_class_level(c.level) AS class_level_group,
      s.id AS subject_id,
      s.name AS subject_name,
      s.level_group,
      coalesce((sss.metadata ->> 'min_level')::INTEGER, NULL) AS min_level,
      coalesce((sss.metadata ->> 'max_level')::INTEGER, NULL) AS max_level
    FROM classes c
    JOIN school_subject_settings sss
      ON sss.school_id = c.school_id
      AND sss.is_enabled = true
      AND sss.level_group = infer_level_group_from_class_level(c.level)
    JOIN subjects s
      ON s.school_id = c.school_id
      AND s.level_group = sss.level_group
      AND lower(s.name) = lower(sss.subject_name)
    WHERE c.school_id = p_school_id
  ), inserted AS (
    INSERT INTO class_subjects (class_id, school_id, subject_id, level_group, source, is_enabled)
    SELECT
      class_id,
      school_id,
      subject_id,
      level_group,
      'default',
      true
    FROM map_rows
    WHERE
      (
        lower(subject_name) <> 'science'
        OR (level BETWEEN 4 AND 6)
      )
      AND (min_level IS NULL OR level >= min_level)
      AND (max_level IS NULL OR level <= max_level)
    ON CONFLICT (class_id, subject_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_created FROM inserted;

  RETURN QUERY SELECT v_created;
END;
$$;

ALTER TABLE school_subject_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_subject_settings_staff_manage ON school_subject_settings;
CREATE POLICY school_subject_settings_staff_manage ON school_subject_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role IN ('super_admin', 'school_admin', 'teacher')
        AND (up.role = 'super_admin' OR up.school_id = school_subject_settings.school_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role IN ('super_admin', 'school_admin')
        AND (up.role = 'super_admin' OR up.school_id = school_subject_settings.school_id)
    )
  );

DROP POLICY IF EXISTS class_subjects_staff_manage ON class_subjects;
CREATE POLICY class_subjects_staff_manage ON class_subjects
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role IN ('super_admin', 'school_admin', 'teacher')
        AND (up.role = 'super_admin' OR up.school_id = class_subjects.school_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role IN ('super_admin', 'school_admin')
        AND (up.role = 'super_admin' OR up.school_id = class_subjects.school_id)
    )
  );
