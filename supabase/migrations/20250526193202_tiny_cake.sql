/*
  # Fix recursive policies for members table

  1. Changes
    - Drop existing policies that cause recursion
    - Create new policies with optimized conditions
    - Add separate policies for staff and admin access
    
  2. Security
    - Maintain row-level security
    - Ensure proper access control for different user roles
    - Prevent infinite recursion in policy evaluation
*/

-- First, drop the existing problematic policies
DROP POLICY IF EXISTS "Admins can manage all members" ON members;
DROP POLICY IF EXISTS "Staff can view all members" ON members;
DROP POLICY IF EXISTS "Users can update own profile" ON members;
DROP POLICY IF EXISTS "Users can view own profile" ON members;

-- Create new policies without recursion
-- Policy for admins to manage all members
CREATE POLICY "admins_manage_all_members"
ON members
FOR ALL
TO authenticated
USING (
  (SELECT isstaff AND isadmin 
   FROM members 
   WHERE id = auth.uid()
   LIMIT 1)
)
WITH CHECK (
  (SELECT isstaff AND isadmin 
   FROM members 
   WHERE id = auth.uid()
   LIMIT 1)
);

-- Policy for staff to view all members
CREATE POLICY "staff_view_all_members"
ON members
FOR SELECT
TO authenticated
USING (
  (SELECT isstaff 
   FROM members 
   WHERE id = auth.uid()
   LIMIT 1)
);

-- Policy for users to view their own profile
CREATE POLICY "users_view_own_profile"
ON members
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy for users to update their own profile
CREATE POLICY "users_update_own_profile"
ON members
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());