/*
  # Définir le Super Admin
  
  Ce script marque f.Brissaud33@gmail.com comme super admin
  et met son status à 'approved' s'il existe déjà.
  
  À exécuter APRÈS avoir créé votre compte avec cet email.
*/

-- Mettre à jour le coach existant comme super admin
UPDATE coaches
SET 
  is_super_admin = true,
  status = 'approved'
WHERE email = 'f.Brissaud33@gmail.com';

-- Alternative : si le compte n'existe pas encore, créer une fonction
-- qui le fera automatiquement lors de l'inscription
CREATE OR REPLACE FUNCTION public.auto_approve_super_admin()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si c'est l'email du super admin, approuver automatiquement
  IF NEW.email = 'f.Brissaud33@gmail.com' THEN
    NEW.is_super_admin := true;
    NEW.status := 'approved';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger pour auto-approuver le super admin
DROP TRIGGER IF EXISTS auto_approve_super_admin_trigger ON coaches;
CREATE TRIGGER auto_approve_super_admin_trigger
  BEFORE INSERT ON coaches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_super_admin();

