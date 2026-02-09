/*
  # Allow client-side coach profile creation

  1. Changes
    - Add INSERT policy for coaches table to allow authenticated users to create their own profile during signup
    - This works alongside the trigger for redundancy
  
  2. Security
    - Only authenticated users can insert
    - Users can only insert a row with their own user ID
    - This ensures each user can only create one coach profile (their own)
*/

-- Create INSERT policy for coaches
CREATE POLICY "Users can create own coach profile during signup"
  ON coaches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
