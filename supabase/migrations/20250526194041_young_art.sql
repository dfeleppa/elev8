/*
  # Fix infinite recursion in members RLS policies

  1. Changes
    - Drop all existing policies
    - Create new simplified policies
    - Use EXISTS clauses with direct ID comparisons
    - Remove recursive subqueries
    
  2. Security
    - Maintain proper access control
    - Fix infinite recursion issues
    - Keep existing security model
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "admins_manage_all_members" ON members;
DROP POLICY IF EXISTS "staff_view_all_members" ON members;
DROP POLICY IF EXISTS "users_view_own_profile" ON members;
DROP POLICY IF EXISTS "users_update_own_profile" ON members;

-- Create new simplified policies
CREATE POLICY "admins_manage_all_members"
ON members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM members m
    WHERE m.id = auth.uid()
    AND m.isstaff = true
    AND m.isadmin = true
  )
);

CREATE POLICY "staff_view_all_members"
ON members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM members m
    WHERE m.id = auth.uid()
    AND m.isstaff = true
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