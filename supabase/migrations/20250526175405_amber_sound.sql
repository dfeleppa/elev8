/*
  # Create members and staff table

  1. New Tables
    - `members`
      - Core fields: firstName, lastName, email, phone, etc.
      - Status tracking: status, memberships, tags, etc.
      - Dates: birthDate, memberSince, etc.
      - Computed: daysUntilBirthday, daysUntilAnniversary
      - Staff flag: isStaff to distinguish staff members

  2. Security
    - Enable RLS
    - Add policies for authenticated users
    
  3. Performance
    - Add indexes for commonly queried fields
    - Add trigger for updated_at maintenance
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS members CASCADE;

-- Create members table
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firstName text NOT NULL,
  lastName text NOT NULL,
  status text NOT NULL,
  memberships text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  trackAccess boolean DEFAULT false,
  email text UNIQUE NOT NULL,
  phone text,
  gender text,
  address text,
  birthDate date,
  memberSince date NOT NULL DEFAULT CURRENT_DATE,
  attendanceCount integer DEFAULT 0,
  lastClassCheckIn timestamptz,
  lastActiveOnApp timestamptz,
  statusNotes text,
  isStaff boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create functions for days calculations
CREATE OR REPLACE FUNCTION get_days_until_date(target_date date)
RETURNS integer AS $$
DECLARE
  next_occurrence date;
  current_year integer;
BEGIN
  IF target_date IS NULL THEN
    RETURN NULL;
  END IF;

  current_year := extract(year from CURRENT_DATE);
  
  -- Create date for this year
  next_occurrence := make_date(
    current_year,
    extract(month from target_date)::integer,
    extract(day from target_date)::integer
  );
  
  -- If the date has passed this year, use next year
  IF next_occurrence < CURRENT_DATE THEN
    next_occurrence := next_occurrence + interval '1 year';
  END IF;
  
  RETURN next_occurrence - CURRENT_DATE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create view for computed columns
CREATE OR REPLACE VIEW member_details AS
SELECT 
  m.*,
  get_days_until_date(m.birthDate) as daysUntilBirthday,
  get_days_until_date(m.memberSince) as daysUntilAnniversary
FROM members m;

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view all members"
  ON members
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert members"
  ON members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update members"
  ON members
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_is_staff ON members(isStaff);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_birth_date ON members(birthDate);
CREATE INDEX idx_members_member_since ON members(memberSince);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();