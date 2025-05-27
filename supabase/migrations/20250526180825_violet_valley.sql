/*
  # Update members table schema

  1. Changes
    - Drop existing view to allow column modifications
    - Modify column types and constraints
    - Recreate view with updated schema
    - Update indexes for better performance

  2. Notes
    - All non-essential fields made nullable
    - Added appropriate default values
    - Improved index coverage
*/

-- Drop the existing view first
DROP VIEW IF EXISTS member_details;

-- Modify the members table
ALTER TABLE members
  ALTER COLUMN status TYPE text,
  ALTER COLUMN memberships SET DEFAULT '{}'::text[],
  ALTER COLUMN tags SET DEFAULT '{}'::text[],
  ALTER COLUMN trackaccess SET DEFAULT false,
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN gender DROP NOT NULL,
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN birthdate DROP NOT NULL,
  ALTER COLUMN membersince SET DEFAULT CURRENT_DATE,
  ALTER COLUMN attendancecount SET DEFAULT 0,
  ALTER COLUMN lastclasscheckin DROP NOT NULL,
  ALTER COLUMN lastactiveonapp DROP NOT NULL,
  ALTER COLUMN statusnotes DROP NOT NULL,
  ALTER COLUMN isstaff SET DEFAULT false;

-- Create function for calculating days until date
CREATE OR REPLACE FUNCTION get_days_until_date(target_date date)
RETURNS integer AS $$
BEGIN
  IF target_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN (
    target_date + ((EXTRACT(year FROM current_date)::int - EXTRACT(year FROM target_date)::int + 
      CASE 
        WHEN (target_date + ((EXTRACT(year FROM current_date)::int - EXTRACT(year FROM target_date)::int) * interval '1 year')) < current_date 
        THEN 1 
        ELSE 0 
      END) * interval '1 year') - current_date
  )::integer;
END;
$$ LANGUAGE plpgsql;

-- Recreate the member_details view
CREATE VIEW member_details AS
SELECT 
  m.*,
  get_days_until_date(m.birthdate) as daysuntilbirthday,
  get_days_until_date(m.membersince) as daysuntilanniversary
FROM members m;

-- Recreate indexes for better performance
DROP INDEX IF EXISTS idx_members_email;
DROP INDEX IF EXISTS idx_members_is_staff;
DROP INDEX IF EXISTS idx_members_status;
DROP INDEX IF EXISTS idx_members_birth_date;
DROP INDEX IF EXISTS idx_members_member_since;

CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_is_staff ON members(isstaff);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_birth_date ON members(birthdate);
CREATE INDEX idx_members_member_since ON members(membersince);
CREATE INDEX idx_members_last_class_checkin ON members(lastclasscheckin);
CREATE INDEX idx_members_last_active ON members(lastactiveonapp);