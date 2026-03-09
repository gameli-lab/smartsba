-- Create a view to alias parent_student_links as parent_student_relationships
-- This provides backward compatibility for code that references the relationships table

-- Drop the view if it exists
DROP VIEW IF EXISTS parent_student_relationships CASCADE;

-- Create view that mirrors the parent_student_links table
CREATE VIEW parent_student_relationships AS
SELECT 
  id,
  parent_id,
  student_id,
  relationship,
  is_primary,
  created_at
FROM parent_student_links;

-- Grant appropriate permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON parent_student_relationships TO authenticated;
GRANT SELECT ON parent_student_relationships TO anon;

-- Note: The view allows all operations (SELECT, INSERT, UPDATE, DELETE)
-- The actual RLS policies on parent_student_links will still apply
