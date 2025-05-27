/*
  # Fix RLS policies for tracks table

  1. Changes
    - Drop existing policies
    - Create new policy for staff members with proper auth.uid() check
    - Create policy for viewing non-private tracks
    - Add policy for track access based on member permissions

  2. Security
    - Staff members can manage all tracks
    - Regular members can view non-private tracks
    - Members with specific track access can view private tracks
*/

-- Drop existing policies
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
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM members
    WHERE members.id = auth.uid()
    AND members.isstaff = true
  )
);

-- Create policy for viewing non-private tracks
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
    AND (
      members.trackaccess = tracks.name OR
      members.isstaff = true
    )
  )
);