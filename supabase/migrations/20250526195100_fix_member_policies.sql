/*
  # Fix RLS policies for members table

  1. Changes
    - Remove references to non-existent user_roles table
    - Fix RLS policies to use members table directly
    - Ensure member creation policy allows users to create their own record
    - Fix staff and admin policies to use correct table references
    
  2. Security
    - Users can create their own member record with auth.uid()
    - Users can view and update their own profile
    - Staff can view all members (using members table)
    - Admins can manage all members (using members table)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own member record" ON members;
DROP POLICY IF EXISTS "Users can view own profile" ON members;
DROP POLICY IF EXISTS "Users can update own profile" ON members;
DROP POLICY IF EXISTS "Staff can view all members" ON members;
DROP POLICY IF EXISTS "Admins can manage all members" ON members;

-- Drop the problematic materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS user_roles CASCADE;
DROP FUNCTION IF EXISTS refresh_user_roles() CASCADE;

-- Create corrected policies that reference the members table directly
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
    FROM members m
    WHERE m.id = auth.uid()
    AND m.isstaff = true
  )
);

CREATE POLICY "Admins can manage all members"
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
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM members m
    WHERE m.id = auth.uid()
    AND m.isstaff = true
    AND m.isadmin = true
  )
);
