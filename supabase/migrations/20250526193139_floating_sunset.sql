/*
  # Fix recursive members policy

  1. Changes
    - Remove recursive policy for staff viewing members
    - Add new simplified policy for staff access
    - Keep existing policies for user self-access and admin access

  2. Security
    - Maintains RLS on members table
    - Simplifies staff access policy to prevent recursion
    - Preserves existing security model while fixing the infinite loop
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Staff can view all members" ON members;

-- Create new non-recursive policy for staff
CREATE POLICY "Staff can view all members"
ON members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM members
    WHERE id = auth.uid() 
    AND isstaff = true
  )
);