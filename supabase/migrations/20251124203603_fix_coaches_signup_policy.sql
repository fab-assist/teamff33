/*
  # Fix Coach Signup Policy

  1. Changes
    - Drop existing restrictive INSERT policy
    - Create new INSERT policy that allows signup during registration
    - Policy checks that the id matches auth.uid() which will be set by Supabase during signup

  2. Security
    - Users can only insert their own profile (id must match their auth.uid())
    - This works because Supabase sets auth.uid() BEFORE the insert happens during signup
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Coaches can create own profile" ON coaches;

-- Create new policy that works with signup
CREATE POLICY "Coaches can create profile during signup"
  ON coaches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
