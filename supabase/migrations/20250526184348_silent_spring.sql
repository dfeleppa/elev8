/*
  # Add Stripe Customer ID to members table

  1. Changes
    - Add stripe_customer_id column to members table
    - Make it nullable since not all members will have a Stripe account
    - Add index for better query performance
*/

ALTER TABLE members
ADD COLUMN stripe_customer_id text;

CREATE INDEX idx_members_stripe_customer_id ON members(stripe_customer_id);