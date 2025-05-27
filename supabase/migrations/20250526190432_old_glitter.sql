/*
  # Add tracks table and update members table

  1. New Tables
    - `tracks`
      - `id` (uuid, primary key)
      - `name` (text)
      - `is_private` (boolean)
      - `num_levels` (integer)
      - `level_colors` (text[])
      - `workout_reveal_delay` (interval)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Modify members.trackaccess to be text
*/

-- Drop existing view to allow column modification
DROP VIEW IF EXISTS member_details;

-- Modify trackaccess column
ALTER TABLE members 
  ALTER COLUMN trackaccess TYPE text USING CASE 
    WHEN trackaccess = true THEN 'default'
    ELSE NULL
  END;

-- Create tracks table
CREATE TABLE tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_private boolean DEFAULT false,
  num_levels integer CHECK (num_levels BETWEEN 1 AND 3) DEFAULT 1,
  level_colors text[] DEFAULT '{}',
  workout_reveal_delay interval,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can manage tracks"
  ON tracks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE id = auth.uid() 
      AND isstaff = true
    )
  );

-- Recreate member_details view
CREATE VIEW member_details AS
SELECT 
  m.*,
  get_days_until_date(m.birthdate) as daysuntilbirthday,
  get_days_until_date(m.membersince) as daysuntilanniversary
FROM members m;