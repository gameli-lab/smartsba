-- View: vw_user_profiles_with_email
-- Returns user_profiles joined with auth.users.email and schools.name

CREATE OR REPLACE VIEW public.vw_user_profiles_with_email AS
SELECT
  up.id,
  up.user_id,
  up.full_name,
  up.role,
  up.school_id,
  up.status,
  up.created_at,
  up.updated_at,
  au.email AS email,
  s.name AS school_name
FROM public.user_profiles up
LEFT JOIN auth.users au ON au.id = up.user_id
LEFT JOIN public.schools s ON s.id = up.school_id;

COMMENT ON VIEW public.vw_user_profiles_with_email IS 'View combining user_profiles with auth.users.email and schools.name for Super Admin APIs.';
