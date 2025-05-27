/*
  # Add member self-registration policy

  1. Security Changes
    - Add RLS policy to allow authenticated users to insert their own member record
    - Policy ensures users can only create a record with their own auth.uid()
    - This enables the automatic member creation during first login
*/

CREATE POLICY "Users can create their own member record"
  ON members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);