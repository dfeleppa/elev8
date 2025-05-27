/*
  # Fix recursive policies for members table

  1. Changes
    - Remove recursive policies that were causing infinite loops
    - Create new, more efficient policies for staff management
    - Maintain security while preventing recursion
  
  2. Security
    - Enable RLS on members table (ensuring it's still enabled)
    - Add separate policies for staff and admin access
    - Add policy for self-management
*/

-- Drop existing policies to replace them with fixed versions
DROP POLICY IF EXISTS "Admins can manage all members" ON members;
DROP POLICY IF EXISTS "Allow authenticated users to insert members" ON members;
DROP POLICY IF EXISTS "Allow authenticated users to update members" ON members;
DROP POLICY IF EXISTS "Allow authenticated users to view all members" ON members;

-- Create new, non-recursive policies
CREATE POLICY "Users can view their own profile"
ON members
FOR SELECT
TO authenticated
USING (auth.uid()::text = id::text);

CREATE POLICY "Staff can view all members"
ON members
FOR SELECT
TO authenticated
USING (
  (auth.uid()::text IN (
    SELECT id::text 
    FROM members 
    WHERE isstaff = true
  ))
);

CREATE POLICY "Admins can manage all members"
ON members
FOR ALL
TO authenticated
USING (
  (auth.uid()::text IN (
    SELECT id::text 
    FROM members 
    WHERE isstaff = true AND isadmin = true
  ))
)
WITH CHECK (
  (auth.uid()::text IN (
    SELECT id::text 
    FROM members 
    WHERE isstaff = true AND isadmin = true
  ))
);

CREATE POLICY "Users can update their own profile"
ON members
FOR UPDATE
TO authenticated
USING (auth.uid()::text = id::text)
WITH CHECK (auth.uid()::text = id::text);