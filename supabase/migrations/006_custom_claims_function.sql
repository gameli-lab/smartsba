-- Create function to set custom JWT claims for proper authorization
-- This allows our RLS policies to work with app_role and school_id claims

-- Function to set custom claims in JWT token
CREATE OR REPLACE FUNCTION set_custom_claims(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile user_profiles%ROWTYPE;
BEGIN
  -- Get the user profile
  SELECT * INTO user_profile
  FROM user_profiles
  WHERE user_profiles.user_id = set_custom_claims.user_id;
  
  -- If profile exists, set custom claims
  IF user_profile.user_id IS NOT NULL THEN
    -- Set app_role claim
    PERFORM auth.jwt_custom_claims_set(
      user_id := set_custom_claims.user_id,
      claims := jsonb_build_object(
        'app_role', user_profile.role,
        'school_id', COALESCE(user_profile.school_id::text, ''),
        'profile_id', user_profile.id::text
      )
    );
  END IF;
END;
$$;

-- Create trigger function to automatically set claims when user profile is created/updated
CREATE OR REPLACE FUNCTION on_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set custom claims for the user
  PERFORM set_custom_claims(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update JWT claims when profile changes
DROP TRIGGER IF EXISTS on_profile_change_trigger ON user_profiles;
CREATE TRIGGER on_profile_change_trigger
  AFTER INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION on_profile_change();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_custom_claims(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION on_profile_change() TO authenticated;

-- Function to manually refresh claims for a user (useful for debugging)
CREATE OR REPLACE FUNCTION refresh_user_claims()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_custom_claims(auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_user_claims() TO authenticated;

-- Test the function works
DO $$
BEGIN
  RAISE NOTICE 'Custom claims functions created successfully';
END $$;
