/*
  # Fix member creation policies

  1. Changes
    - Add policy for users to create their own member record
    - Ensure users can only create a record with their own auth.uid()
    - Keep existing policies for viewing and updating profiles
    
  2. Security
    - Users can only create one member record matching their auth.uid()
    - Staff and admin policies remain unchanged
    - Maintains existing view and update restrictions
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own member record" ON members;
DROP POLICY IF EXISTS "Users can view own profile" ON members;
DROP POLICY IF EXISTS "Users can update own profile" ON members;
DROP POLICY IF EXISTS "Staff can view all members" ON members;
DROP POLICY IF EXISTS "Admins can manage all members" ON members;

-- Create new policies
CREATE POLICY "Users can create their own member record"
ON members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own profile"
ON members
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON members
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Staff can view all members"
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

CREATE POLICY "Admins can manage all members"
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