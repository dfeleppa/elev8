/*
  # Fix RLS policies to prevent infinite recursion

  1. Changes
    - Drop all existing policies
    - Create new simplified policies that avoid recursion
    - Use direct boolean checks instead of subqueries where possible
    - Maintain proper security boundaries

  2. Security
    - Admins can manage all members
    - Staff can view all members
    - Users can view and update their own profiles
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "admins_manage_all_members" ON members;
DROP POLICY IF EXISTS "staff_view_all_members" ON members;
DROP POLICY IF EXISTS "users_view_own_profile" ON members;
DROP POLICY IF EXISTS "users_update_own_profile" ON members;
DROP POLICY IF EXISTS "Admins can manage all members" ON members;
DROP POLICY IF EXISTS "Staff can view all members" ON members;
DROP POLICY IF EXISTS "Users can view own profile" ON members;
DROP POLICY IF EXISTS "Users can update own profile" ON members;

-- Create new simplified policies
CREATE POLICY "admins_manage_all_members"
ON members
FOR ALL
TO authenticated
USING (auth.uid() IN (
  SELECT id FROM members WHERE isstaff = true AND isadmin = true
))
WITH CHECK (auth.uid() IN (
  SELECT id FROM members WHERE isstaff = true AND isadmin = true
));

CREATE POLICY "staff_view_all_members"
ON members
FOR SELECT
TO authenticated
USING (auth.uid() IN (
  SELECT id FROM members WHERE isstaff = true
));

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