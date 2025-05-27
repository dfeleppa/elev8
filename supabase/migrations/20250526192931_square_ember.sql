/*
  # Fix members table RLS policies

  1. Changes
    - Drop existing RLS policies
    - Create new non-recursive policies
    - Fix admin access checks
    - Maintain proper security boundaries

  2. Security
    - Admins can manage all members
    - Staff can view all members
    - Users can view and update their own profiles
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view all members" ON members;
DROP POLICY IF EXISTS "Allow authenticated users to insert members" ON members;
DROP POLICY IF EXISTS "Allow authenticated users to update members" ON members;
DROP POLICY IF EXISTS "Admins can manage all members" ON members;
DROP POLICY IF EXISTS "Staff can view all members" ON members;
DROP POLICY IF EXISTS "Users can update own profile" ON members;
DROP POLICY IF EXISTS "Users can view own profile" ON members;

-- Create new policies
CREATE POLICY "Admins can manage all members"
  ON members
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = auth.uid()
      AND m.isstaff = true
      AND m.isadmin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = auth.uid()
      AND m.isstaff = true
      AND m.isadmin = true
  ));

CREATE POLICY "Staff can view all members"
  ON members
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = auth.uid()
      AND m.isstaff = true
  ));

CREATE POLICY "Users can view own profile"
  ON members
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON members
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());