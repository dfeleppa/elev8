/*
  # Fix Members Table RLS Policies

  1. Changes
    - Drop existing problematic policies causing infinite recursion
    - Create new, optimized policies for members table access
    
  2. Security
    - Maintain RLS enabled on members table
    - Add clear, non-recursive policies for:
      - Admins can manage all members
      - Staff can view all members
      - Users can view and update their own profile
*/

-- Drop existing policies to replace them with fixed versions
DROP POLICY IF EXISTS "Admins can manage all members" ON members;
DROP POLICY IF EXISTS "Staff can view all members" ON members;
DROP POLICY IF EXISTS "Users can update own profile" ON members;
DROP POLICY IF EXISTS "Users can view own profile" ON members;

-- Create new, optimized policies
CREATE POLICY "Admins can manage all members"
ON members
FOR ALL
TO authenticated
USING (
  isstaff = true AND isadmin = true
)
WITH CHECK (
  isstaff = true AND isadmin = true
);

CREATE POLICY "Staff can view all members"
ON members
FOR SELECT
TO authenticated
USING (
  isstaff = true
);

CREATE POLICY "Users can view own profile"
ON members
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "Users can update own profile"
ON members
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);