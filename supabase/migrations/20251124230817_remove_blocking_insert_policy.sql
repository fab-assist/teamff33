/*
  # Remove blocking INSERT policy for coaches

  1. Changes
    - Remove the INSERT policy that blocks the trigger from working
    - The trigger already handles coach profile creation securely
  
  2. Security
    - Coach profiles are created ONLY through the database trigger
    - Users cannot manually insert coach profiles (prevents abuse)
    - Trigger runs with elevated privileges (SECURITY DEFINER)
*/

-- Remove the INSERT policy that conflicts with the trigger
DROP POLICY IF EXISTS "Users can create own coach profile during signup" ON coaches;
DROP POLICY IF EXISTS "Coaches can create own profile" ON coaches;
DROP POLICY IF EXISTS "Coaches can create profile during signup" ON coaches;
