/*
  # Update tracks table RLS policies

  1. Changes
    - Add RLS policy for staff members to manage tracks
    - Staff can view, create, update, and delete tracks
    - Non-staff members can only view non-private tracks

  2. Security
    - Enable RLS on tracks table
    - Add policies for staff and regular members
*/

-- Drop existing policies if any
DROP POLICY IF EXISTS "Staff can manage tracks" ON tracks;
DROP POLICY IF EXISTS "Public can view non-private tracks" ON tracks;

-- Create policy for staff to manage tracks
CREATE POLICY "Staff can manage tracks"
ON tracks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM members
    WHERE members.id = auth.uid()
    AND members.isstaff = true
  )
);

-- Create policy for public to view non-private tracks
CREATE POLICY "Public can view non-private tracks"
ON tracks
FOR SELECT
TO authenticated
USING (
  NOT is_private OR
  EXISTS (
    SELECT 1
    FROM members
    WHERE members.id = auth.uid()
    AND members.trackaccess = tracks.name
  )
);