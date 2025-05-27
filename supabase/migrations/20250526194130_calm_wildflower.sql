/*
  # Fix RLS policies using materialized view

  1. Changes
    - Create materialized view for caching user roles
    - Simplify RLS policies to use the materialized view
    - Add function to refresh the materialized view
    
  2. Security
    - Maintain same security model
    - Prevent recursion by using cached roles
*/

-- Create materialized view for caching user roles
CREATE MATERIALIZED VIEW user_roles AS
SELECT 
  id,
  isstaff,
  isadmin
FROM members;

CREATE UNIQUE INDEX user_roles_id ON user_roles(id);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_user_roles()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_roles;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh materialized view
CREATE TRIGGER refresh_user_roles_trigger
AFTER INSERT OR UPDATE OR DELETE ON members
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_user_roles();

-- Drop existing policies
DROP POLICY IF EXISTS "admins_manage_all_members" ON members;
DROP POLICY IF EXISTS "staff_view_all_members" ON members;
DROP POLICY IF EXISTS "users_view_own_profile" ON members;
DROP POLICY IF EXISTS "users_update_own_profile" ON members;

-- Create new simplified policies using materialized view
CREATE POLICY "admins_manage_all_members"
ON members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE id = auth.uid()
    AND isstaff = true
    AND isadmin = true
  )
);

CREATE POLICY "staff_view_all_members"
ON members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE id = auth.uid()
    AND isstaff = true
  )
);

CREATE POLICY "users_view_own_profile"
ON members
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "users_update_own_profile"
ON members
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());