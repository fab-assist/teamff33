/*
  # Fix RLS Policy for Coach Registration

  ## Problem
  The current policy blocks new coach registration because it requires `auth.uid() = id`
  during INSERT, but at registration time the user session is not yet fully established.

  ## Solution
  Split the policy into separate policies:
  - INSERT: Allow authenticated users to create their own profile (WITH CHECK only)
  - SELECT/UPDATE/DELETE: Restrict to own data (USING clause)

  ## Changes
  1. Drop the existing "ALL" policy
  2. Create separate policies for each operation:
     - INSERT: Allow user to create their own profile
     - SELECT: Allow user to read their own data
     - UPDATE: Allow user to update their own data
     - DELETE: Allow user to delete their own data
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Coaches can manage their own profile" ON coaches;

-- Allow authenticated users to insert their own profile
CREATE POLICY "Coaches can create own profile"
  ON coaches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow coaches to read their own data
CREATE POLICY "Coaches can read own profile"
  ON coaches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow coaches to update their own data
CREATE POLICY "Coaches can update own profile"
  ON coaches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow coaches to delete their own data
CREATE POLICY "Coaches can delete own profile"
  ON coaches
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
