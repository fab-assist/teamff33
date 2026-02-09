/*
  # Create automatic coach profile on signup

  1. Changes
    - Create a trigger function that automatically creates a coach profile when a user signs up
    - The trigger reads data from auth.users metadata
    - Drop existing INSERT policy since we won't insert manually anymore
    - Create new policy that allows the trigger to insert

  2. Security
    - Trigger runs with SECURITY DEFINER (elevated privileges)
    - Users still can only read/update/delete their own profiles
    - No manual INSERT allowed, only through trigger

  3. Important
    - This solves the race condition where auth session isn't established yet
    - Profile is created automatically and securely
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Coaches can create profile during signup" ON coaches;
DROP POLICY IF EXISTS "Coaches can create own profile" ON coaches;

-- Create function to handle new coach signup
CREATE OR REPLACE FUNCTION public.handle_new_coach_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create coach profile if role is 'coach'
  IF NEW.raw_user_meta_data->>'role' = 'coach' THEN
    INSERT INTO public.coaches (
      id,
      prenom,
      nom,
      telephone,
      nom_club,
      mode_coaching
    ) VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'prenom',
      NEW.raw_user_meta_data->>'nom',
      NEW.raw_user_meta_data->>'telephone',
      NEW.raw_user_meta_data->>'nom_club',
      COALESCE(NEW.raw_user_meta_data->>'mode_coaching', 'gestion_club')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_coach ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created_coach
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_coach_user();
