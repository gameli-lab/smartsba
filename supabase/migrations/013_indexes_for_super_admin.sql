-- Add useful indexes for Super Admin queries
-- 1) pg_trgm extension for faster ILIKE on names/emails
-- 2) GIN trigram index on lower(full_name)
-- 3) btree index on created_at for pagination
-- 4) composite index on (school_id, role) for filters

-- Create extension if not exists (safe for environments where already present)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index on lower(full_name) to speed up ILIKE '%...%'
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name_trgm ON public.user_profiles USING gin (lower(full_name) gin_trgm_ops);

-- Index on created_at for faster ordering/pagination
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON public.user_profiles (created_at DESC);

-- Composite index for school + role filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_school_role ON public.user_profiles (school_id, role);

-- Optionally index status for status filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON public.user_profiles (status);

COMMENT ON INDEX public.idx_user_profiles_full_name_trgm IS 'GIN trigram index on lower(full_name) to accelerate ILIKE searches';
COMMENT ON INDEX public.idx_user_profiles_created_at IS 'Index on created_at for pagination ordering';
COMMENT ON INDEX public.idx_user_profiles_school_role IS 'Composite index for filtering by school and role';
