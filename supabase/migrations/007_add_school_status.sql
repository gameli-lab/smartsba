-- Add status field to schools table for activation/deactivation functionality
-- This allows Super Admin to temporarily disable schools without deleting data

ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
CHECK (status IN ('active', 'inactive'));

-- Update existing schools to have active status
UPDATE schools SET status = 'active' WHERE status IS NULL;

-- Add index for performance when filtering by status
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);

-- Add comment for documentation
COMMENT ON COLUMN schools.status IS 'School activation status - active schools can login, inactive schools are suspended';

-- Create function to update school status (for TypeScript compatibility)
CREATE OR REPLACE FUNCTION update_school_status(school_id UUID, new_status TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate status value
  IF new_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Invalid status value. Must be active or inactive.';
  END IF;

  -- Update the school status
  UPDATE schools 
  SET status = new_status::VARCHAR(20), updated_at = NOW()
  WHERE id = school_id;

  -- Check if any row was affected
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School with ID % not found', school_id;
  END IF;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION update_school_status(UUID, TEXT) TO authenticated;
