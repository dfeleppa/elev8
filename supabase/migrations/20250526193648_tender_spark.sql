/*
  # Fix Members Table RLS Policies

  1. Changes
    - Drop existing policies
    - Create new optimized policies for members table
    - Fix naming conflicts with existing policies
    
  2. Security
    - Maintain proper access control
    - Prevent infinite recursion
    - Keep existing security boundaries
*/

-- Drop existing policies
DROP POLICY IF EXISTS "admins_manage_all_members" ON members;
DROP POLICY IF EXISTS "staff_view_all_members" ON members;
DROP POLICY IF EXISTS "users_view_own_profile" ON members;
DROP POLICY IF EXISTS "users_update_own_profile" ON members;
DROP POLICY IF EXISTS "Admins can manage all members" ON members;
DROP POLICY IF EXISTS "Staff can view all members" ON members;
DROP POLICY IF EXISTS "Users can view own profile" ON members;
DROP POLICY IF EXISTS "Users can update own profile" ON members;

-- Create new optimized policies
CREATE POLICY "admins_manage_all_members"
ON members
FOR ALL
TO authenticated
USING (
  ( SELECT (members_1.isstaff AND members_1.isadmin)
    FROM members members_1
    WHERE (members_1.id = auth.uid())
    LIMIT 1
  )
)
WITH CHECK (
  ( SELECT (members_1.isstaff AND members_1.isadmin)
    FROM members members_1
    WHERE (members_1.id = auth.uid())
    LIMIT 1
  )
);

CREATE POLICY "staff_view_all_members"
ON members
FOR SELECT
TO authenticated
USING (
  ( SELECT members_1.isstaff
    FROM members members_1
    WHERE (members_1.id = auth.uid())
    LIMIT 1
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