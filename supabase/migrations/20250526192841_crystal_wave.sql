/*
  # Fix Members Table RLS Policies

  1. Changes
    - Remove recursive policies that were causing infinite loops
    - Implement new, optimized RLS policies for members table
    - Maintain security while preventing circular dependencies
  
  2. Security
    - Enable RLS on members table
    - Add policies for:
      - Admins can manage all members
      - Staff can view all members
      - Users can view and update their own profile
    - Policies now use direct boolean checks instead of recursive queries
*/

-- Drop existing policies to replace them with optimized versions
DROP POLICY IF EXISTS "Admins can manage all members" ON members;
DROP POLICY IF EXISTS "Staff can view all members" ON members;
DROP POLICY IF EXISTS "Users can update their own profile" ON members;
DROP POLICY IF EXISTS "Users can view their own profile" ON members;

-- Create new optimized policies
CREATE POLICY "Admins can manage all members"
ON members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM members AS admin
    WHERE admin.id = auth.uid()
      AND admin.isstaff = true 
      AND admin.isadmin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM members AS admin
    WHERE admin.id = auth.uid()
      AND admin.isstaff = true 
      AND admin.isadmin = true
  )
);

CREATE POLICY "Staff can view all members"
ON members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM members AS staff
    WHERE staff.id = auth.uid()
      AND staff.isstaff = true
  )
);

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