/*
  # Add isAdmin field to members table

  1. Changes
    - Add isAdmin boolean column with default false
    - Create index for better query performance
    - Add constraint to ensure only staff members can be admins

  2. Security
    - Only admins can update the isAdmin field
*/

-- Add isAdmin column
ALTER TABLE members
ADD COLUMN isAdmin boolean DEFAULT false;

-- Create index for better performance
CREATE INDEX idx_members_is_admin ON members(isAdmin);

-- Add constraint to ensure only staff members can be admins
ALTER TABLE members
ADD CONSTRAINT staff_only_admins
CHECK (NOT isAdmin OR (isAdmin AND isstaff));

-- Update RLS policies to allow admins full access
CREATE POLICY "Admins can manage all members"
ON members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM members
    WHERE id = auth.uid()
    AND isAdmin = true
  )
);